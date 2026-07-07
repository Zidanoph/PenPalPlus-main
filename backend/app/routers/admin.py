"""Admin endpoints (PRD: Admin Dashboard). Guarded by get_current_admin."""
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_admin
from .. import models, schemas, services

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", response_model=schemas.AdminStats)
def stats(db: Session = Depends(get_db), _: models.User = Depends(get_current_admin)):
    return schemas.AdminStats(
        users=db.query(func.count(models.User.id)).scalar() or 0,
        premium_users=db.query(func.count(models.User.id))
            .filter_by(is_premium=True).scalar() or 0,
        letters=db.query(func.count(models.Letter.id)).scalar() or 0,
        letters_in_transit=db.query(func.count(models.Letter.id))
            .filter_by(state="in_transit").scalar() or 0,
        communities=db.query(func.count(models.Community.id)).scalar() or 0,
        open_reports=db.query(func.count(models.Report.id))
            .filter_by(status="open").scalar() or 0,
    )


@router.get("/users", response_model=list[schemas.PartyBrief])
def list_users(limit: int = 100, db: Session = Depends(get_db),
               _: models.User = Depends(get_current_admin)):
    users = db.query(models.User).limit(limit).all()
    return [services.party_brief(u) for u in users if u.profile]


@router.get("/reports", response_model=list[dict])
def list_reports(db: Session = Depends(get_db),
                 _: models.User = Depends(get_current_admin)):
    reports = db.query(models.Report).order_by(models.Report.created_at.desc()).all()
    return [
        {
            "id": r.id, "reporter_id": r.reporter_id,
            "reported_user_id": r.reported_user_id, "letter_id": r.letter_id,
            "reason": r.reason, "detail": r.detail, "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in reports
    ]


@router.post("/reports/{report_id}/resolve", status_code=200)
def resolve_report(report_id: int, status: str = "reviewed",
                   db: Session = Depends(get_db),
                   _: models.User = Depends(get_current_admin)):
    r = db.get(models.Report, report_id)
    if r:
        r.status = status
        db.commit()
    return {"detail": "ok"}
