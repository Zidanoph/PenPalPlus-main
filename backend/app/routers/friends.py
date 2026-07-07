"""Social endpoints: friend requests, friends list, blocks, reports."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from .. import models, schemas, services

router = APIRouter(tags=["friends"])


@router.post("/friends/request/{user_id}", response_model=schemas.FriendRequestOut, status_code=201)
def send_request(user_id: int, db: Session = Depends(get_db),
                 me: models.User = Depends(get_current_user)):
    if user_id == me.id:
        raise HTTPException(status_code=400, detail="You can't friend yourself")
    target = db.get(models.User, user_id)
    if not target or not target.profile:
        raise HTTPException(status_code=404, detail="User not found")
    if services.is_blocked_between(db, me.id, user_id):
        raise HTTPException(status_code=403, detail="Unavailable")
    if services.are_friends(db, me.id, user_id):
        raise HTTPException(status_code=409, detail="Already friends")

    existing = (
        db.query(models.FriendRequest)
        .filter_by(requester_id=me.id, addressee_id=user_id, status="pending")
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Request already pending")

    fr = models.FriendRequest(requester_id=me.id, addressee_id=user_id)
    db.add(fr)
    services.notify(db, user_id, "friend_request", "New friend request",
                    f"{me.profile.display_name} wants to connect", link="/friends")
    db.commit()
    db.refresh(fr)
    return schemas.FriendRequestOut(
        id=fr.id, status=fr.status, created_at=fr.created_at,
        other=services.party_brief(target), direction="outgoing",
    )


@router.get("/friends/requests", response_model=list[schemas.FriendRequestOut])
def list_requests(db: Session = Depends(get_db),
                  me: models.User = Depends(get_current_user)):
    out = []
    incoming = (
        db.query(models.FriendRequest)
        .filter_by(addressee_id=me.id, status="pending").all()
    )
    for fr in incoming:
        other = db.get(models.User, fr.requester_id)
        out.append(schemas.FriendRequestOut(
            id=fr.id, status=fr.status, created_at=fr.created_at,
            other=services.party_brief(other), direction="incoming",
        ))
    outgoing = (
        db.query(models.FriendRequest)
        .filter_by(requester_id=me.id, status="pending").all()
    )
    for fr in outgoing:
        other = db.get(models.User, fr.addressee_id)
        out.append(schemas.FriendRequestOut(
            id=fr.id, status=fr.status, created_at=fr.created_at,
            other=services.party_brief(other), direction="outgoing",
        ))
    return out


@router.post("/friends/requests/{request_id}/respond", response_model=dict)
def respond_request(request_id: int, accept: bool, db: Session = Depends(get_db),
                    me: models.User = Depends(get_current_user)):
    fr = db.get(models.FriendRequest, request_id)
    if not fr or fr.addressee_id != me.id or fr.status != "pending":
        raise HTTPException(status_code=404, detail="Request not found")
    fr.status = "accepted" if accept else "declined"
    if accept:
        services.ensure_friendship(db, fr.requester_id, fr.addressee_id)
        services.notify(db, fr.requester_id, "friend_added", "Request accepted",
                        f"{me.profile.display_name} accepted your request")
        services.check_achievements(db, fr.requester_id)
        services.check_achievements(db, me.id)
    db.commit()
    return {"status": fr.status}


@router.get("/friends", response_model=list[schemas.FriendOut])
def list_friends(db: Session = Depends(get_db),
                 me: models.User = Depends(get_current_user)):
    rows = (
        db.query(models.Friend)
        .filter(or_(models.Friend.user_a_id == me.id, models.Friend.user_b_id == me.id))
        .order_by(models.Friend.created_at.desc())
        .all()
    )
    out = []
    for f in rows:
        other_id = f.user_b_id if f.user_a_id == me.id else f.user_a_id
        other = db.get(models.User, other_id)
        if other and other.profile:
            out.append(schemas.FriendOut(
                profile=services.party_brief(other), since=f.created_at))
    return out


@router.delete("/friends/{user_id}", status_code=204)
def remove_friend(user_id: int, db: Session = Depends(get_db),
                  me: models.User = Depends(get_current_user)):
    lo, hi = sorted((me.id, user_id))
    f = db.query(models.Friend).filter_by(user_a_id=lo, user_b_id=hi).first()
    if f:
        db.delete(f)
        db.commit()
    return None


@router.post("/blocks/{user_id}", status_code=201)
def block_user(user_id: int, db: Session = Depends(get_db),
               me: models.User = Depends(get_current_user)):
    if user_id == me.id:
        raise HTTPException(status_code=400, detail="You can't block yourself")
    if not db.query(models.Block).filter_by(blocker_id=me.id, blocked_id=user_id).first():
        db.add(models.Block(blocker_id=me.id, blocked_id=user_id))
    # Blocking severs any friendship.
    lo, hi = sorted((me.id, user_id))
    f = db.query(models.Friend).filter_by(user_a_id=lo, user_b_id=hi).first()
    if f:
        db.delete(f)
    db.commit()
    return {"detail": "blocked"}


@router.delete("/blocks/{user_id}", status_code=204)
def unblock_user(user_id: int, db: Session = Depends(get_db),
                 me: models.User = Depends(get_current_user)):
    b = db.query(models.Block).filter_by(blocker_id=me.id, blocked_id=user_id).first()
    if b:
        db.delete(b)
        db.commit()
    return None


@router.post("/reports", status_code=201)
def create_report(reported_user_id: int | None = None, letter_id: int | None = None,
                  reason: str = "other", detail: str = "",
                  db: Session = Depends(get_db),
                  me: models.User = Depends(get_current_user)):
    if not reported_user_id and not letter_id:
        raise HTTPException(status_code=400, detail="Nothing to report")
    db.add(models.Report(
        reporter_id=me.id, reported_user_id=reported_user_id,
        letter_id=letter_id, reason=reason, detail=detail,
    ))
    db.commit()
    return {"detail": "Report received. Our moderation team will review it."}
