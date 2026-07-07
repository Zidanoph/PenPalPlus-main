"""The Journey map — a personal globe of everywhere a user's letters have

travelled. This is a pure read/aggregate endpoint over existing Letter +
Profile data: no new tables, no writes. Each pin is a correspondent the
user has exchanged at least one letter with, positioned at that person's
city, with the running total distance and letter count between the two.
"""
from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from .. import models, schemas

router = APIRouter(prefix="/journey", tags=["journey"])


@router.get("", response_model=schemas.JourneyOut)
def get_journey(db: Session = Depends(get_db),
                me: models.User = Depends(get_current_user)):
    letters = (
        db.query(models.Letter)
        .filter(or_(models.Letter.sender_id == me.id, models.Letter.recipient_id == me.id))
        .all()
    )

    friend_ids = set()
    for f in db.query(models.Friend).filter(
        or_(models.Friend.user_a_id == me.id, models.Friend.user_b_id == me.id)
    ):
        friend_ids.add(f.user_b_id if f.user_a_id == me.id else f.user_a_id)

    stamp_codes_by_user: dict[int, set[str]] = defaultdict(set)

    agg: dict[int, dict] = {}
    total_km = 0.0
    letters_sent = 0
    letters_delivered = 0

    for l in letters:
        counterpart_id = l.recipient_id if l.sender_id == me.id else l.sender_id
        counterpart = l.recipient if l.sender_id == me.id else l.sender
        if not counterpart or not counterpart.profile:
            continue

        if l.sender_id == me.id:
            letters_sent += 1
        if l.state == "delivered":
            letters_delivered += 1
        total_km += l.distance_km or 0.0

        if l.stamp is not None:
            stamp_codes_by_user[counterpart_id].add(l.stamp.code)

        entry = agg.get(counterpart_id)
        if entry is None:
            entry = {
                "profile": counterpart.profile,
                "distance_km": 0.0,
                "letters_count": 0,
                "delivered_count": 0,
                "last_letter_at": l.sent_at,
            }
            agg[counterpart_id] = entry

        entry["distance_km"] = max(entry["distance_km"], l.distance_km or 0.0)
        entry["letters_count"] += 1
        if l.state == "delivered":
            entry["delivered_count"] += 1
        if l.sent_at > entry["last_letter_at"]:
            entry["last_letter_at"] = l.sent_at

    pins: list[schemas.JourneyPin] = []
    for uid, entry in agg.items():
        p = entry["profile"]
        pins.append(schemas.JourneyPin(
            user_id=uid,
            display_name=p.display_name,
            handle=p.handle,
            avatar_seed=p.avatar_seed,
            avatar_color=p.avatar_color,
            country=p.country,
            country_code=p.country_code,
            city=p.city,
            latitude=p.latitude,
            longitude=p.longitude,
            distance_km=entry["distance_km"],
            letters_count=entry["letters_count"],
            delivered_count=entry["delivered_count"],
            last_letter_at=entry["last_letter_at"],
            is_friend=uid in friend_ids,
            stamp_codes=sorted(stamp_codes_by_user.get(uid, [])),
        ))
    pins.sort(key=lambda c: c.distance_km, reverse=True)

    farthest = nearest = None
    if pins:
        top = pins[0]
        bottom = pins[-1]
        farthest = schemas.JourneyHighlight(
            user_id=top.user_id, display_name=top.display_name,
            country=top.country, country_code=top.country_code,
            distance_km=top.distance_km,
        )
        nearest = schemas.JourneyHighlight(
            user_id=bottom.user_id, display_name=bottom.display_name,
            country=bottom.country, country_code=bottom.country_code,
            distance_km=bottom.distance_km,
        )

    countries = {p.country_code for p in pins if p.country_code}

    home = schemas.JourneyHome(
        city=me.profile.city, country=me.profile.country,
        country_code=me.profile.country_code,
        latitude=me.profile.latitude, longitude=me.profile.longitude,
    )

    stats = schemas.JourneyStats(
        total_km=round(total_km, 1),
        countries_count=len(countries),
        correspondents_count=len(pins),
        letters_sent=letters_sent,
        letters_delivered=letters_delivered,
        farthest=farthest,
        nearest=nearest,
    )

    return schemas.JourneyOut(home=home, pins=pins, stats=stats)
