"""Achievement endpoints: the catalog annotated with the user's progress."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from .. import models, schemas, services

router = APIRouter(prefix="/achievements", tags=["achievements"])


@router.get("", response_model=list[schemas.AchievementOut])
def list_achievements(db: Session = Depends(get_db),
                      user: models.User = Depends(get_current_user)):
    # Re-evaluate so the list is always current when viewed.
    services.check_achievements(db, user.id)
    db.commit()

    unlocked = {
        ua.achievement_id: ua.unlocked_at
        for ua in db.query(models.UserAchievement).filter_by(user_id=user.id)
    }
    out = []
    for a in db.query(models.Achievement).order_by(models.Achievement.id).all():
        out.append(schemas.AchievementOut(
            code=a.code, name=a.name, description=a.description, icon=a.icon,
            unlocked=a.id in unlocked, unlocked_at=unlocked.get(a.id),
        ))
    return out
