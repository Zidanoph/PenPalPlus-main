"""Notification endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from .. import models, schemas, services

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[schemas.NotificationOut])
def list_notifications(unread_only: bool = False, db: Session = Depends(get_db),
                       user: models.User = Depends(get_current_user)):
    # Surface any newly-delivered letters as notifications first.
    services.deliver_due_letters(db, user.id)
    db.commit()
    q = db.query(models.Notification).filter_by(user_id=user.id)
    if unread_only:
        q = q.filter(models.Notification.is_read.is_(False))
    return q.order_by(models.Notification.created_at.desc()).limit(100).all()


@router.get("/unread-count", response_model=dict)
def unread_count(db: Session = Depends(get_db),
                 user: models.User = Depends(get_current_user)):
    services.deliver_due_letters(db, user.id)
    db.commit()
    n = (
        db.query(models.Notification)
        .filter_by(user_id=user.id, is_read=False)
        .count()
    )
    return {"count": n}


@router.post("/{notification_id}/read", status_code=200)
def mark_read(notification_id: int, db: Session = Depends(get_db),
              user: models.User = Depends(get_current_user)):
    n = db.get(models.Notification, notification_id)
    if not n or n.user_id != user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    db.commit()
    return {"detail": "ok"}


@router.post("/read-all", status_code=200)
def mark_all_read(db: Session = Depends(get_db),
                  user: models.User = Depends(get_current_user)):
    db.query(models.Notification).filter_by(user_id=user.id, is_read=False).update(
        {"is_read": True})
    db.commit()
    return {"detail": "ok"}
