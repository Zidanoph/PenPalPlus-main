"""Letter endpoints (PRD Part 4: /letters/*, /drafts).

Sending a letter computes the great-circle distance to the recipient and a
realistic delivery time; the letter is withheld from the recipient until it
"arrives". This is the core mechanic of the product.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from .. import models, schemas, services

router = APIRouter(tags=["letters"])

# How many letters can be simultaneously in transit on the free tier.
FREE_ACTIVE_LIMIT = 15


@router.post("/letters", response_model=schemas.LetterOut, status_code=201)
def send_letter(payload: schemas.LetterCreate, db: Session = Depends(get_db),
                sender: models.User = Depends(get_current_user)):
    if payload.recipient_id == sender.id:
        raise HTTPException(status_code=400, detail="You cannot write to yourself")
    recipient = db.get(models.User, payload.recipient_id)
    if not recipient or not recipient.is_active or not recipient.profile:
        raise HTTPException(status_code=404, detail="Recipient not found")
    if services.is_blocked_between(db, sender.id, recipient.id):
        raise HTTPException(status_code=403, detail="You can't write to this person")

    # Free-tier cap on concurrently in-transit letters the sender has out.
    if not sender.is_premium:
        active = (
            db.query(models.Letter)
            .filter_by(sender_id=sender.id, state="in_transit")
            .count()
        )
        if active >= FREE_ACTIVE_LIMIT:
            raise HTTPException(
                status_code=402,
                detail="Free plan limit reached: too many letters in transit. "
                       "Upgrade to PenPal+ for unlimited correspondence.",
            )

    stamp = None
    if payload.stamp_id is not None:
        owned = (
            db.query(models.UserStamp)
            .filter_by(user_id=sender.id, stamp_id=payload.stamp_id)
            .first()
        )
        if not owned:
            raise HTTPException(status_code=400, detail="You don't own that stamp")
        stamp = owned.stamp

    sp, rp = sender.profile, recipient.profile
    distance = services.haversine_km(sp.latitude, sp.longitude, rp.latitude, rp.longitude)
    sent_at = services.utcnow()
    deliver_at = services.delivery_eta(distance, sent_at)

    letter = models.Letter(
        sender_id=sender.id,
        recipient_id=recipient.id,
        subject=payload.subject,
        body=payload.body,
        stamp_id=stamp.id if stamp else None,
        state="in_transit",
        distance_km=distance,
        sent_at=sent_at,
        deliver_at=deliver_at,
        reply_to_id=payload.reply_to_id,
    )
    db.add(letter)
    db.flush()

    # Replying to a delivered letter forms a friendship (two-way correspondence).
    if payload.reply_to_id:
        original = db.get(models.Letter, payload.reply_to_id)
        if original and original.sender_id == recipient.id:
            if services.ensure_friendship(db, sender.id, recipient.id):
                services.notify(db, recipient.id, "friend_added",
                                "New pen pal", f"{sp.display_name} wrote back")
    db.flush()
    services.check_achievements(db, sender.id)
    db.commit()
    db.refresh(letter)
    return services.letter_to_dict(db, letter, sender.id)


@router.get("/letters/inbox", response_model=list[schemas.LetterOut])
def inbox(include_transit: bool = True, db: Session = Depends(get_db),
          user: models.User = Depends(get_current_user)):
    # Deliver anything that has arrived before showing the mailbox.
    services.deliver_due_letters(db, user.id)
    db.commit()

    q = db.query(models.Letter).filter_by(recipient_id=user.id)
    if not include_transit:
        q = q.filter(models.Letter.state == "delivered")
    letters = q.order_by(models.Letter.deliver_at.desc()).all()
    return [services.letter_to_dict(db, l, user.id) for l in letters]


@router.get("/letters/sent", response_model=list[schemas.LetterOut])
def sent(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    letters = (
        db.query(models.Letter)
        .filter_by(sender_id=user.id)
        .order_by(models.Letter.sent_at.desc())
        .all()
    )
    return [services.letter_to_dict(db, l, user.id) for l in letters]


@router.get("/letters/{letter_id}", response_model=schemas.LetterOut)
def get_letter(letter_id: int, db: Session = Depends(get_db),
               user: models.User = Depends(get_current_user)):
    letter = db.get(models.Letter, letter_id)
    if not letter or user.id not in (letter.sender_id, letter.recipient_id):
        raise HTTPException(status_code=404, detail="Letter not found")

    # Lazily deliver if this recipient's letter is due.
    if letter.recipient_id == user.id and letter.state == "in_transit":
        services.deliver_due_letters(db, user.id)
        db.refresh(letter)

    # Mark read the first time the recipient opens a delivered letter.
    if (letter.recipient_id == user.id and letter.state == "delivered"
            and letter.read_at is None):
        letter.read_at = services.utcnow()
        db.commit()
        db.refresh(letter)

    return services.letter_to_dict(db, letter, user.id)


@router.post("/letters/{letter_id}/save", response_model=schemas.LetterOut)
def save_letter(letter_id: int, db: Session = Depends(get_db),
                user: models.User = Depends(get_current_user)):
    letter = db.get(models.Letter, letter_id)
    if not letter or user.id not in (letter.sender_id, letter.recipient_id):
        raise HTTPException(status_code=404, detail="Letter not found")
    existing = (
        db.query(models.SavedLetter)
        .filter_by(user_id=user.id, letter_id=letter_id)
        .first()
    )
    if existing:
        db.delete(existing)          # toggle off
    else:
        db.add(models.SavedLetter(user_id=user.id, letter_id=letter_id))
    db.commit()
    db.refresh(letter)
    return services.letter_to_dict(db, letter, user.id)


# --- drafts ---------------------------------------------------------------
@router.post("/drafts", response_model=schemas.DraftOut, status_code=201)
def create_draft(payload: schemas.DraftIn, db: Session = Depends(get_db),
                 user: models.User = Depends(get_current_user)):
    draft = models.Draft(
        author_id=user.id, recipient_id=payload.recipient_id,
        subject=payload.subject, body=payload.body,
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return draft


@router.get("/drafts", response_model=list[schemas.DraftOut])
def list_drafts(db: Session = Depends(get_db),
                user: models.User = Depends(get_current_user)):
    return (
        db.query(models.Draft)
        .filter_by(author_id=user.id)
        .order_by(models.Draft.updated_at.desc())
        .all()
    )


@router.put("/drafts/{draft_id}", response_model=schemas.DraftOut)
def update_draft(draft_id: int, payload: schemas.DraftIn, db: Session = Depends(get_db),
                 user: models.User = Depends(get_current_user)):
    draft = db.get(models.Draft, draft_id)
    if not draft or draft.author_id != user.id:
        raise HTTPException(status_code=404, detail="Draft not found")
    draft.recipient_id = payload.recipient_id
    draft.subject = payload.subject
    draft.body = payload.body
    db.commit()
    db.refresh(draft)
    return draft


@router.delete("/drafts/{draft_id}", status_code=204)
def delete_draft(draft_id: int, db: Session = Depends(get_db),
                 user: models.User = Depends(get_current_user)):
    draft = db.get(models.Draft, draft_id)
    if not draft or draft.author_id != user.id:
        raise HTTPException(status_code=404, detail="Draft not found")
    db.delete(draft)
    db.commit()
    return None
