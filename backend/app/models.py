"""SQLAlchemy models for PenPal+.

Organized by the domains in the spec: User, Messaging, Social, Community,
Achievement, Subscription, Notification, and Audit. Kept in one module for a
project of this size; each block is clearly separated.
"""
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text,
    UniqueConstraint, Index,
)
from sqlalchemy.orm import relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# Association table: which topics a profile is interested in.
# (Modeled explicitly as UserTopic below to allow extra columns later.)


# ----------------------------------------------------------------------------
# User domain
# ----------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    is_premium = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    last_active_at = Column(DateTime, default=utcnow, nullable=False)

    profile = relationship(
        "Profile", back_populates="user", uselist=False,
        cascade="all, delete-orphan",
    )
    settings = relationship(
        "UserSettings", back_populates="user", uselist=False,
        cascade="all, delete-orphan",
    )
    languages = relationship("UserLanguage", cascade="all, delete-orphan")
    topics = relationship("UserTopic", cascade="all, delete-orphan")
    sessions = relationship("UserSession", cascade="all, delete-orphan")


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    display_name = Column(String(80), nullable=False)
    handle = Column(String(40), unique=True, nullable=False, index=True)
    bio = Column(Text, default="")
    # A representative location for delivery distance + discovery.
    country = Column(String(80), default="")
    country_code = Column(String(2), default="")
    city = Column(String(120), default="")
    latitude = Column(Float, default=0.0)
    longitude = Column(Float, default=0.0)
    timezone = Column(String(60), default="UTC")
    # Avatar is rendered client-side from a seed + color (no object storage needed).
    avatar_seed = Column(String(40), default="")
    avatar_color = Column(String(7), default="#2B4C7E")
    gender = Column(String(20), default="")
    birth_year = Column(Integer, nullable=True)

    user = relationship("User", back_populates="profile")


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    auto_translate = Column(Boolean, default=False)
    discoverable = Column(Boolean, default=True)
    notify_on_delivery = Column(Boolean, default=True)
    # Preferred distance band for matching: near | far | any
    distance_pref = Column(String(10), default="any")
    locale = Column(String(10), default="en")

    user = relationship("User", back_populates="settings")


class UserLanguage(Base):
    __tablename__ = "user_languages"
    __table_args__ = (UniqueConstraint("user_id", "code", name="uq_user_language"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    code = Column(String(8), nullable=False)          # e.g. "en", "ar", "ja"
    name = Column(String(40), nullable=False)
    # fluency: native | fluent | learning
    fluency = Column(String(10), default="learning")


class UserTopic(Base):
    __tablename__ = "user_topics"
    __table_args__ = (UniqueConstraint("user_id", "slug", name="uq_user_topic"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    slug = Column(String(40), nullable=False)         # e.g. "books", "travel"
    label = Column(String(60), nullable=False)


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    refresh_token = Column(String(512), nullable=False, index=True)
    device = Column(String(120), default="")
    created_at = Column(DateTime, default=utcnow)
    revoked = Column(Boolean, default=False)


# ----------------------------------------------------------------------------
# Messaging domain
# ----------------------------------------------------------------------------
class Letter(Base):
    __tablename__ = "letters"
    __table_args__ = (
        Index("ix_letters_recipient_state", "recipient_id", "state"),
    )

    id = Column(Integer, primary_key=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    subject = Column(String(160), default="")
    body = Column(Text, nullable=False)
    stamp_id = Column(Integer, ForeignKey("stamps.id"), nullable=True)
    # in_transit | delivered
    state = Column(String(12), default="in_transit", nullable=False)
    distance_km = Column(Float, default=0.0)
    sent_at = Column(DateTime, default=utcnow, nullable=False)
    deliver_at = Column(DateTime, nullable=False)
    delivered_at = Column(DateTime, nullable=True)
    read_at = Column(DateTime, nullable=True)
    # Threading: a reply points at the letter it answers.
    reply_to_id = Column(Integer, ForeignKey("letters.id"), nullable=True)

    sender = relationship("User", foreign_keys=[sender_id])
    recipient = relationship("User", foreign_keys=[recipient_id])
    stamp = relationship("Stamp")


class Draft(Base):
    __tablename__ = "drafts"

    id = Column(Integer, primary_key=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    subject = Column(String(160), default="")
    body = Column(Text, default="")
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class SavedLetter(Base):
    __tablename__ = "saved_letters"
    __table_args__ = (UniqueConstraint("user_id", "letter_id", name="uq_saved_letter"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    letter_id = Column(Integer, ForeignKey("letters.id"), nullable=False)
    created_at = Column(DateTime, default=utcnow)


# ----------------------------------------------------------------------------
# Social domain
# ----------------------------------------------------------------------------
class FriendRequest(Base):
    __tablename__ = "friend_requests"
    __table_args__ = (
        UniqueConstraint("requester_id", "addressee_id", name="uq_friend_request"),
    )

    id = Column(Integer, primary_key=True)
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    addressee_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    # pending | accepted | declined
    status = Column(String(10), default="pending", nullable=False)
    created_at = Column(DateTime, default=utcnow)


class Friend(Base):
    """Undirected friendship stored once with user_a_id < user_b_id."""
    __tablename__ = "friends"
    __table_args__ = (UniqueConstraint("user_a_id", "user_b_id", name="uq_friend"),)

    id = Column(Integer, primary_key=True)
    user_a_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    user_b_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=utcnow)


class Block(Base):
    __tablename__ = "blocks"
    __table_args__ = (UniqueConstraint("blocker_id", "blocked_id", name="uq_block"),)

    id = Column(Integer, primary_key=True)
    blocker_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    blocked_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, default=utcnow)


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    reported_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    letter_id = Column(Integer, ForeignKey("letters.id"), nullable=True)
    reason = Column(String(60), nullable=False)
    detail = Column(Text, default="")
    # open | reviewed | actioned | dismissed
    status = Column(String(12), default="open", nullable=False)
    created_at = Column(DateTime, default=utcnow)


# ----------------------------------------------------------------------------
# Community domain
# ----------------------------------------------------------------------------
class Community(Base):
    __tablename__ = "communities"

    id = Column(Integer, primary_key=True)
    slug = Column(String(60), unique=True, nullable=False, index=True)
    name = Column(String(120), nullable=False)
    description = Column(Text, default="")
    color = Column(String(7), default="#B23A2E")
    created_at = Column(DateTime, default=utcnow)


class CommunityMember(Base):
    __tablename__ = "community_members"
    __table_args__ = (
        UniqueConstraint("community_id", "user_id", name="uq_community_member"),
    )

    id = Column(Integer, primary_key=True)
    community_id = Column(Integer, ForeignKey("communities.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String(10), default="member")   # member | mod
    joined_at = Column(DateTime, default=utcnow)


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True)
    community_id = Column(Integer, ForeignKey("communities.id"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(160), default="")
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utcnow)

    author = relationship("User")


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("posts.id"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utcnow)

    author = relationship("User")


# ----------------------------------------------------------------------------
# Achievement domain
# ----------------------------------------------------------------------------
class Achievement(Base):
    __tablename__ = "achievements"

    id = Column(Integer, primary_key=True)
    code = Column(String(40), unique=True, nullable=False, index=True)
    name = Column(String(80), nullable=False)
    description = Column(String(200), nullable=False)
    icon = Column(String(8), default="🏅")          # emoji glyph
    threshold = Column(Integer, default=1)


class UserAchievement(Base):
    __tablename__ = "user_achievements"
    __table_args__ = (
        UniqueConstraint("user_id", "achievement_id", name="uq_user_achievement"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    achievement_id = Column(Integer, ForeignKey("achievements.id"), nullable=False)
    unlocked_at = Column(DateTime, default=utcnow)

    achievement = relationship("Achievement")


class Stamp(Base):
    __tablename__ = "stamps"

    id = Column(Integer, primary_key=True)
    code = Column(String(40), unique=True, nullable=False, index=True)
    name = Column(String(80), nullable=False)
    country = Column(String(80), default="")
    country_code = Column(String(2), default="")
    # A two-color scheme + emoji motif used to render the stamp client-side.
    motif = Column(String(8), default="✉️")
    color = Column(String(7), default="#B23A2E")
    rarity = Column(String(10), default="common")   # common | rare | epic
    premium_only = Column(Boolean, default=False)


class UserStamp(Base):
    __tablename__ = "user_stamps"
    __table_args__ = (UniqueConstraint("user_id", "stamp_id", name="uq_user_stamp"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    stamp_id = Column(Integer, ForeignKey("stamps.id"), nullable=False)
    quantity = Column(Integer, default=1)
    acquired_at = Column(DateTime, default=utcnow)

    stamp = relationship("Stamp")


# ----------------------------------------------------------------------------
# Subscription domain
# ----------------------------------------------------------------------------
class Plan(Base):
    __tablename__ = "plans"

    id = Column(Integer, primary_key=True)
    code = Column(String(30), unique=True, nullable=False, index=True)
    name = Column(String(60), nullable=False)
    # price in minor units (cents) to avoid float money
    price_cents = Column(Integer, default=0)
    currency = Column(String(3), default="USD")
    interval = Column(String(10), default="month")   # month | year | free
    features = Column(Text, default="")               # newline-separated

    
class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    plan_id = Column(Integer, ForeignKey("plans.id"), nullable=False)
    # active | cancelled | expired
    status = Column(String(10), default="active", nullable=False)
    started_at = Column(DateTime, default=utcnow)
    current_period_end = Column(DateTime, nullable=True)

    plan = relationship("Plan")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=True)
    number = Column(String(40), unique=True, nullable=False)
    amount_cents = Column(Integer, default=0)
    currency = Column(String(3), default="USD")
    # paid | open | void
    status = Column(String(8), default="paid")
    created_at = Column(DateTime, default=utcnow)


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False, index=True)
    # mock gateway reference
    provider_ref = Column(String(60), default="")
    amount_cents = Column(Integer, default=0)
    status = Column(String(10), default="succeeded")
    created_at = Column(DateTime, default=utcnow)


# ----------------------------------------------------------------------------
# Notification domain
# ----------------------------------------------------------------------------
class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    kind = Column(String(30), nullable=False)         # letter_delivered | friend_request | achievement | system
    title = Column(String(120), nullable=False)
    body = Column(String(255), default="")
    link = Column(String(120), default="")
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow, index=True)


# ----------------------------------------------------------------------------
# Audit domain
# ----------------------------------------------------------------------------
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String(60), nullable=False)
    detail = Column(String(255), default="")
    ip = Column(String(45), default="")
    created_at = Column(DateTime, default=utcnow, index=True)
