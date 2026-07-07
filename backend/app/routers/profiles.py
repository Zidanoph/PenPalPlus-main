"""Profile endpoints (PRD Part 4: /profile/*)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from .. import models, schemas, services

router = APIRouter(tags=["profile"])


def _languages(db: Session, user_id: int):
    return db.query(models.UserLanguage).filter_by(user_id=user_id).all()


def _topics(db: Session, user_id: int):
    return db.query(models.UserTopic).filter_by(user_id=user_id).all()


def _public_profile(db: Session, user: models.User) -> schemas.PublicProfile:
    p = user.profile
    return schemas.PublicProfile(
        user_id=user.id,
        display_name=p.display_name,
        handle=p.handle,
        bio=p.bio,
        country=p.country,
        country_code=p.country_code,
        city=p.city,
        avatar_seed=p.avatar_seed,
        avatar_color=p.avatar_color,
        languages=_languages(db, user.id),
        topics=_topics(db, user.id),
        is_premium=user.is_premium,
    )


@router.get("/profile/me", response_model=schemas.MeOut)
def get_me(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return schemas.MeOut(
        id=user.id,
        email=user.email,
        is_premium=user.is_premium,
        is_admin=user.is_admin,
        profile=user.profile,
        languages=_languages(db, user.id),
        topics=_topics(db, user.id),
        settings=user.settings,
    )


@router.get("/profile/{user_id}", response_model=schemas.PublicProfile)
def get_profile(user_id: int, db: Session = Depends(get_db),
                viewer: models.User = Depends(get_current_user)):
    user = db.get(models.User, user_id)
    if not user or not user.profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    if services.is_blocked_between(db, viewer.id, user_id):
        raise HTTPException(status_code=403, detail="Unavailable")
    return _public_profile(db, user)


@router.put("/profile", response_model=schemas.MeOut)
def update_profile(payload: schemas.ProfileUpdate, db: Session = Depends(get_db),
                   user: models.User = Depends(get_current_user)):
    p = user.profile
    for field in ("display_name", "bio", "country", "city", "timezone",
                  "gender", "birth_year", "avatar_color", "latitude", "longitude"):
        val = getattr(payload, field)
        if val is not None:
            setattr(p, field, val)
    if payload.country_code is not None:
        p.country_code = payload.country_code.upper()[:2]

    if payload.languages is not None:
        db.query(models.UserLanguage).filter_by(user_id=user.id).delete()
        for lang in payload.languages:
            db.add(models.UserLanguage(
                user_id=user.id, code=lang.code, name=lang.name, fluency=lang.fluency,
            ))
    if payload.topics is not None:
        db.query(models.UserTopic).filter_by(user_id=user.id).delete()
        for t in payload.topics:
            db.add(models.UserTopic(user_id=user.id, slug=t.slug, label=t.label))

    db.flush()
    services.check_achievements(db, user.id)
    db.commit()
    db.refresh(user)
    return schemas.MeOut(
        id=user.id, email=user.email, is_premium=user.is_premium,
        is_admin=user.is_admin, profile=user.profile,
        languages=_languages(db, user.id), topics=_topics(db, user.id),
        settings=user.settings,
    )


@router.get("/profile/settings", response_model=schemas.SettingsOut, tags=["settings"])
def get_settings(user: models.User = Depends(get_current_user)):
    return user.settings


@router.put("/profile/settings", response_model=schemas.SettingsOut, tags=["settings"])
def update_settings(payload: schemas.SettingsUpdate, db: Session = Depends(get_db),
                    user: models.User = Depends(get_current_user)):
    s = user.settings
    for field in ("auto_translate", "discoverable", "notify_on_delivery",
                  "distance_pref", "locale"):
        val = getattr(payload, field)
        if val is not None:
            setattr(s, field, val)
    db.commit()
    db.refresh(s)
    return s
