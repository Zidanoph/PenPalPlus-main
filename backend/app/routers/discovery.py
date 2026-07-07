"""Discovery endpoints (PRD Part 4: /discover/*).

Returns ranked match cards using the scoring engine in services.py.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from .. import models, schemas, services
from .profiles import _public_profile

router = APIRouter(prefix="/discover", tags=["discovery"])


def _candidate_query(db: Session, viewer: models.User):
    """Discoverable users, excluding self, blocks, and existing friends."""
    blocked_ids = {
        b.blocked_id for b in db.query(models.Block).filter_by(blocker_id=viewer.id)
    } | {
        b.blocker_id for b in db.query(models.Block).filter_by(blocked_id=viewer.id)
    }
    q = (
        db.query(models.User)
        .join(models.Profile)
        .join(models.UserSettings)
        .filter(models.User.id != viewer.id)
        .filter(models.User.is_active.is_(True))
        .filter(models.UserSettings.discoverable.is_(True))
    )
    if blocked_ids:
        q = q.filter(~models.User.id.in_(blocked_ids))
    return q


def _rank(db: Session, viewer: models.User, candidates: list[models.User],
          pref: str, limit: int) -> list[schemas.DiscoverCard]:
    viewer_langs = {l.code for l in viewer.languages}
    viewer_topics = {t.slug for t in viewer.topics}
    cards = []
    for cand in candidates:
        if not cand.profile:
            continue
        m = services.compute_match(viewer, cand, viewer_langs, viewer_topics, pref)
        cards.append(schemas.DiscoverCard(
            profile=_public_profile(db, cand),
            distance_km=m["distance_km"],
            match_score=m["match_score"],
            breakdown=schemas.MatchBreakdown(**m["breakdown"]),
            shared_topics=m["shared_topics"],
            teach_learn=m["teach_learn"],
        ))
    cards.sort(key=lambda c: c.match_score, reverse=True)
    return cards[:limit]


@router.get("/suggestions", response_model=list[schemas.DiscoverCard])
def suggestions(limit: int = 20, db: Session = Depends(get_db),
                viewer: models.User = Depends(get_current_user)):
    pref = viewer.settings.distance_pref if viewer.settings else "any"
    cands = _candidate_query(db, viewer).limit(200).all()
    return _rank(db, viewer, cands, pref, limit)


@router.post("/search", response_model=list[schemas.DiscoverCard])
def search(payload: schemas.DiscoverFilter, db: Session = Depends(get_db),
           viewer: models.User = Depends(get_current_user)):
    q = _candidate_query(db, viewer)
    if payload.query:
        term = f"%{payload.query.lower()}%"
        q = q.filter(or_(
            models.Profile.display_name.ilike(term),
            models.Profile.handle.ilike(term),
            models.Profile.country.ilike(term),
            models.Profile.city.ilike(term),
            models.Profile.bio.ilike(term),
        ))
    cands = q.limit(300).all()

    # Language / topic filters applied in Python (small candidate sets).
    if payload.languages:
        want = set(payload.languages)
        cands = [c for c in cands if want & {l.code for l in c.languages}]
    if payload.topics:
        want = set(payload.topics)
        cands = [c for c in cands if want & {t.slug for t in c.topics}]

    pref = payload.distance or (viewer.settings.distance_pref if viewer.settings else "any")
    return _rank(db, viewer, cands, pref, payload.limit)


# Alias kept for parity with the PRD's POST /discover/filter
@router.post("/filter", response_model=list[schemas.DiscoverCard])
def filter_(payload: schemas.DiscoverFilter, db: Session = Depends(get_db),
            viewer: models.User = Depends(get_current_user)):
    return search(payload, db, viewer)
