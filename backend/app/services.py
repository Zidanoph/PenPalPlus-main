"""Domain services for PenPal+.

These are the pieces that give the product its character:
  * geo distance between two correspondents (great-circle / haversine)
  * how long a letter takes to travel (the signature "slow mail" mechanic)
  * how well two people match for discovery
  * the achievement engine and notification helpers
"""
from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, or_, and_
from sqlalchemy.orm import Session

from . import models
from .config import settings


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime | None) -> datetime | None:
    """SQLite returns naive datetimes; treat them as UTC for math."""
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


# ----------------------------------------------------------------------------
# Geography + delivery time
# ----------------------------------------------------------------------------
def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in kilometres."""
    if (lat1, lon1) == (0.0, 0.0) or (lat2, lon2) == (0.0, 0.0):
        # Unknown location on one side — fall back to a mid global distance
        return 4000.0
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return round(2 * r * math.asin(math.sqrt(a)), 1)


def delivery_eta(distance_km: float, sent_at: datetime) -> datetime:
    """When a letter sent now should arrive, given the distance travelled."""
    if settings.demo_fast_delivery:
        return sent_at + timedelta(seconds=settings.demo_delivery_seconds)
    hours = distance_km / max(settings.delivery_speed_kmh, 1.0)
    hours = max(settings.delivery_min_hours, min(hours, settings.delivery_max_hours))
    return sent_at + timedelta(hours=hours)


def seconds_until(dt: datetime | None) -> int:
    dt = _aware(dt)
    if dt is None:
        return 0
    delta = (dt - utcnow()).total_seconds()
    return max(0, int(delta))


# ----------------------------------------------------------------------------
# Matching / discovery
# ----------------------------------------------------------------------------
# Weights for the match score (sum to 100).
W_LANG, W_TOPIC, W_DISTANCE, W_ACTIVITY = 35, 35, 20, 10


def _distance_score(distance_km: float, pref: str) -> int:
    """Turn raw distance into a 0-100 sub-score given the viewer's preference.

    'far' rewards cultural distance (the pen-pal ideal), 'near' rewards
    proximity, 'any' is gently neutral with a slight bias toward variety.
    """
    # Normalize distance to 0..1 over half the earth's circumference (~20000km).
    d = min(distance_km / 20000.0, 1.0)
    if pref == "near":
        return int((1 - d) * 100)
    if pref == "far":
        return int(d * 100)
    # any: peak around a comfortable long-distance band
    return int((0.45 + 0.55 * d) * 100)


def compute_match(viewer: models.User, candidate: models.User,
                  viewer_langs: set[str], viewer_topics: set[str],
                  pref: str) -> dict:
    """Return match score + breakdown + human-readable complements."""
    cand_lang_rows = candidate.languages
    cand_topic_slugs = {t.slug for t in candidate.topics}

    # Language complement: best of (shared languages) and (I learn what they
    # speak natively / they learn what I speak). Cultural exchange rewards both.
    cand_langs = {l.code for l in cand_lang_rows}
    shared_langs = viewer_langs & cand_langs

    viewer_native = {l.code for l in viewer.languages if l.fluency == "native"}
    viewer_learning = {l.code for l in viewer.languages if l.fluency == "learning"}
    cand_native = {l.code for l in cand_lang_rows if l.fluency == "native"}
    cand_learning = {l.code for l in cand_lang_rows if l.fluency == "learning"}

    teach = viewer_native & cand_learning      # I can teach them
    learn = viewer_learning & cand_native      # they can teach me
    complement = teach | learn

    lang_hits = len(shared_langs) + len(complement)
    lang_score = min(lang_hits, 3) / 3 * 100

    shared_topics = viewer_topics & cand_topic_slugs
    topic_score = min(len(shared_topics), 4) / 4 * 100

    dist = haversine_km(
        viewer.profile.latitude, viewer.profile.longitude,
        candidate.profile.latitude, candidate.profile.longitude,
    )
    dist_score = _distance_score(dist, pref)

    # Activity: recency of last_active (decays over ~14 days)
    last = _aware(candidate.last_active_at) or utcnow()
    days = (utcnow() - last).total_seconds() / 86400
    activity_score = max(0, int((1 - min(days / 14, 1)) * 100))

    total = round(
        W_LANG * lang_score / 100
        + W_TOPIC * topic_score / 100
        + W_DISTANCE * dist_score / 100
        + W_ACTIVITY * activity_score / 100
    )

    notes: list[str] = []
    lang_name = {l.code: l.name for l in cand_lang_rows}
    lang_name.update({l.code: l.name for l in viewer.languages})
    for code in sorted(learn):
        notes.append(f"can help you with {lang_name.get(code, code)}")
    for code in sorted(teach):
        notes.append(f"is learning {lang_name.get(code, code)}")

    return {
        "distance_km": dist,
        "match_score": int(total),
        "breakdown": {
            "languages": int(lang_score),
            "topics": int(topic_score),
            "distance": int(dist_score),
            "activity": int(activity_score),
        },
        "shared_topics": sorted(shared_topics),
        "teach_learn": notes,
    }


# ----------------------------------------------------------------------------
# Notifications
# ----------------------------------------------------------------------------
def notify(db: Session, user_id: int, kind: str, title: str,
           body: str = "", link: str = "") -> models.Notification:
    n = models.Notification(
        user_id=user_id, kind=kind, title=title, body=body, link=link,
    )
    db.add(n)
    return n


# ----------------------------------------------------------------------------
# Stamps & friendship side effects
# ----------------------------------------------------------------------------
def grant_stamp(db: Session, user_id: int, stamp: models.Stamp) -> bool:
    """Give a user a stamp (increment quantity if already owned).
    Returns True if this is the first copy (new in collection)."""
    us = (
        db.query(models.UserStamp)
        .filter_by(user_id=user_id, stamp_id=stamp.id)
        .one_or_none()
    )
    if us:
        us.quantity += 1
        return False
    db.add(models.UserStamp(user_id=user_id, stamp_id=stamp.id, quantity=1))
    return True


def ensure_friendship(db: Session, a: int, b: int) -> bool:
    """Create an undirected friendship if it doesn't exist. Returns True if new."""
    lo, hi = sorted((a, b))
    exists = db.query(models.Friend).filter_by(user_a_id=lo, user_b_id=hi).first()
    if exists:
        return False
    db.add(models.Friend(user_a_id=lo, user_b_id=hi))
    return True


def are_friends(db: Session, a: int, b: int) -> bool:
    lo, hi = sorted((a, b))
    return db.query(models.Friend).filter_by(user_a_id=lo, user_b_id=hi).first() is not None


def is_blocked_between(db: Session, a: int, b: int) -> bool:
    return (
        db.query(models.Block)
        .filter(
            or_(
                and_(models.Block.blocker_id == a, models.Block.blocked_id == b),
                and_(models.Block.blocker_id == b, models.Block.blocked_id == a),
            )
        )
        .first()
        is not None
    )


# ----------------------------------------------------------------------------
# Letter delivery sweep (lazy, no background worker needed)
# ----------------------------------------------------------------------------
def deliver_due_letters(db: Session, recipient_id: int) -> list[models.Letter]:
    """Flip any in-transit letters for this user whose ETA has passed.

    Called whenever a user looks at their inbox/notifications. In production
    this same logic would run in a scheduled job (APScheduler/Celery beat);
    doing it lazily keeps the project runnable with no extra services.
    """
    now = utcnow()
    due = (
        db.query(models.Letter)
        .filter(
            models.Letter.recipient_id == recipient_id,
            models.Letter.state == "in_transit",
        )
        .all()
    )
    delivered = []
    for letter in due:
        if (_aware(letter.deliver_at) or now) <= now:
            letter.state = "delivered"
            letter.delivered_at = now
            delivered.append(letter)
            sender_name = letter.sender.profile.display_name if letter.sender.profile else "Someone"
            notify(
                db, recipient_id, "letter_delivered",
                "A letter just arrived",
                f"From {sender_name}",
                link=f"/letters/{letter.id}",
            )
    if delivered:
        db.flush()
        check_achievements(db, recipient_id)
    return delivered


# ----------------------------------------------------------------------------
# Achievement engine
# ----------------------------------------------------------------------------
def _unlock(db: Session, user_id: int, code: str) -> bool:
    ach = db.query(models.Achievement).filter_by(code=code).one_or_none()
    if not ach:
        return False
    already = (
        db.query(models.UserAchievement)
        .filter_by(user_id=user_id, achievement_id=ach.id)
        .first()
    )
    if already:
        return False
    db.add(models.UserAchievement(user_id=user_id, achievement_id=ach.id))
    notify(db, user_id, "achievement", "Achievement unlocked", ach.name, link="/achievements")
    return True


def check_achievements(db: Session, user_id: int) -> list[str]:
    """Evaluate all achievement rules for a user. Returns newly-unlocked codes."""
    newly: list[str] = []

    sent = db.query(func.count(models.Letter.id)).filter_by(sender_id=user_id).scalar() or 0
    received_delivered = (
        db.query(func.count(models.Letter.id))
        .filter_by(recipient_id=user_id, state="delivered")
        .scalar()
        or 0
    )
    friends = (
        db.query(func.count(models.Friend.id))
        .filter(
            or_(models.Friend.user_a_id == user_id, models.Friend.user_b_id == user_id)
        )
        .scalar()
        or 0
    )
    langs = db.query(func.count(models.UserLanguage.id)).filter_by(user_id=user_id).scalar() or 0

    # Distinct countries this user has corresponded with (sent OR received).
    partner_ids = set()
    for (rid,) in db.query(models.Letter.recipient_id).filter_by(sender_id=user_id):
        partner_ids.add(rid)
    for (sid,) in db.query(models.Letter.sender_id).filter_by(recipient_id=user_id):
        partner_ids.add(sid)
    countries = set()
    if partner_ids:
        for (cc,) in (
            db.query(models.Profile.country_code)
            .filter(models.Profile.user_id.in_(partner_ids))
        ):
            if cc:
                countries.add(cc)

    rules = [
        ("first_letter", sent >= 1),
        ("pen_pal", received_delivered >= 1),
        ("correspondent", sent >= 10),
        ("globetrotter", len(countries) >= 5),
        ("world_citizen", len(countries) >= 15),
        ("polyglot", langs >= 3),
        ("social_butterfly", friends >= 5),
    ]
    for code, ok in rules:
        if ok and _unlock(db, user_id, code):
            newly.append(code)
    return newly


# ----------------------------------------------------------------------------
# DTO builders (shared by routers)
# ----------------------------------------------------------------------------
def party_brief(user: models.User) -> dict:
    p = user.profile
    return {
        "user_id": user.id,
        "display_name": p.display_name if p else "",
        "handle": p.handle if p else "",
        "country": p.country if p else "",
        "country_code": p.country_code if p else "",
        "avatar_seed": p.avatar_seed if p else "",
        "avatar_color": p.avatar_color if p else "#2B4C7E",
    }


def letter_to_dict(db: Session, letter: models.Letter, viewer_id: int) -> dict:
    """Serialize a letter for a viewer. Body is withheld while in transit
    (you can't read a letter that hasn't arrived) — unless the viewer is the
    sender, who of course knows what they wrote."""
    is_recipient = letter.recipient_id == viewer_id
    delivered = letter.state == "delivered"
    body = letter.body
    if is_recipient and not delivered:
        body = None  # still travelling

    saved = (
        db.query(models.SavedLetter)
        .filter_by(user_id=viewer_id, letter_id=letter.id)
        .first()
        is not None
    )
    stamp = None
    if letter.stamp:
        s = letter.stamp
        stamp = {
            "id": s.id, "code": s.code, "name": s.name, "country": s.country,
            "country_code": s.country_code, "motif": s.motif, "color": s.color,
            "rarity": s.rarity, "premium_only": s.premium_only,
        }
    return {
        "id": letter.id,
        "subject": letter.subject,
        "body": body,
        "state": letter.state,
        "distance_km": letter.distance_km,
        "sent_at": _aware(letter.sent_at),
        "deliver_at": _aware(letter.deliver_at),
        "delivered_at": _aware(letter.delivered_at),
        "read_at": _aware(letter.read_at),
        "eta_seconds": seconds_until(letter.deliver_at) if not delivered else 0,
        "sender": party_brief(letter.sender),
        "recipient": party_brief(letter.recipient),
        "stamp": stamp,
        "reply_to_id": letter.reply_to_id,
        "saved": saved,
    }
