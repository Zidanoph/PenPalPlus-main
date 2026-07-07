"""Stamp endpoints: the global catalog + a user's personal collection."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from .. import models, schemas

router = APIRouter(prefix="/stamps", tags=["stamps"])


@router.get("", response_model=list[schemas.StampOut])
def catalog(db: Session = Depends(get_db),
            user: models.User = Depends(get_current_user)):
    """All stamps available in the world. Premium stamps are listed but the
    `premium_only` flag tells the client to gate them."""
    return db.query(models.Stamp).order_by(models.Stamp.rarity, models.Stamp.name).all()


@router.get("/mine", response_model=list[schemas.UserStampOut])
def my_collection(db: Session = Depends(get_db),
                  user: models.User = Depends(get_current_user)):
    rows = (
        db.query(models.UserStamp)
        .filter_by(user_id=user.id)
        .order_by(models.UserStamp.acquired_at.desc())
        .all()
    )
    return [
        schemas.UserStampOut(
            stamp=r.stamp, quantity=r.quantity, acquired_at=r.acquired_at)
        for r in rows
    ]


@router.post("/{stamp_id}/claim", response_model=schemas.UserStampOut, status_code=201)
def claim_free_stamp(stamp_id: int, db: Session = Depends(get_db),
                     user: models.User = Depends(get_current_user)):
    """Claim a non-premium stamp from the catalog (one free copy)."""
    stamp = db.get(models.Stamp, stamp_id)
    if not stamp:
        raise HTTPException(status_code=404, detail="Stamp not found")
    if stamp.premium_only and not user.is_premium:
        raise HTTPException(status_code=402, detail="This stamp is for PenPal+ members")
    existing = (
        db.query(models.UserStamp)
        .filter_by(user_id=user.id, stamp_id=stamp_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Already in your collection")
    us = models.UserStamp(user_id=user.id, stamp_id=stamp_id, quantity=1)
    db.add(us)
    db.commit()
    db.refresh(us)
    return schemas.UserStampOut(stamp=us.stamp, quantity=us.quantity,
                                acquired_at=us.acquired_at)
