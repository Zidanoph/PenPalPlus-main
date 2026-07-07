"""Pydantic v2 schemas (request bodies + response models)."""
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict


# --- shared / nested ------------------------------------------------------
class LanguageIn(BaseModel):
    code: str
    name: str
    fluency: str = "learning"   # native | fluent | learning


class TopicIn(BaseModel):
    slug: str
    label: str


class LanguageOut(LanguageIn):
    model_config = ConfigDict(from_attributes=True)


class TopicOut(TopicIn):
    model_config = ConfigDict(from_attributes=True)


# --- auth -----------------------------------------------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str = Field(min_length=1, max_length=80)
    handle: str = Field(min_length=3, max_length=40, pattern=r"^[a-zA-Z0-9_]+$")
    country: str = ""
    country_code: str = ""
    city: str = ""
    latitude: float = 0.0
    longitude: float = 0.0


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshIn(BaseModel):
    refresh_token: str


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


# --- profile --------------------------------------------------------------
class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    display_name: str
    handle: str
    bio: str
    country: str
    country_code: str
    city: str
    latitude: float
    longitude: float
    timezone: str
    avatar_seed: str
    avatar_color: str
    gender: str
    birth_year: int | None


class PublicProfile(BaseModel):
    """A profile as seen by other users (no precise coordinates)."""
    user_id: int
    display_name: str
    handle: str
    bio: str
    country: str
    country_code: str
    city: str
    avatar_seed: str
    avatar_color: str
    languages: list[LanguageOut] = []
    topics: list[TopicOut] = []
    is_premium: bool = False


class MeOut(BaseModel):
    id: int
    email: EmailStr
    is_premium: bool
    is_admin: bool
    profile: ProfileOut
    languages: list[LanguageOut] = []
    topics: list[TopicOut] = []
    settings: "SettingsOut"


class ProfileUpdate(BaseModel):
    display_name: str | None = None
    bio: str | None = None
    country: str | None = None
    country_code: str | None = None
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    timezone: str | None = None
    gender: str | None = None
    birth_year: int | None = None
    avatar_color: str | None = None
    languages: list[LanguageIn] | None = None
    topics: list[TopicIn] | None = None


class SettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    auto_translate: bool
    discoverable: bool
    notify_on_delivery: bool
    distance_pref: str
    locale: str


class SettingsUpdate(BaseModel):
    auto_translate: bool | None = None
    discoverable: bool | None = None
    notify_on_delivery: bool | None = None
    distance_pref: str | None = None
    locale: str | None = None


# --- discovery ------------------------------------------------------------
class DiscoverFilter(BaseModel):
    query: str | None = None
    languages: list[str] | None = None   # language codes
    topics: list[str] | None = None      # topic slugs
    distance: str | None = None          # near | far | any
    limit: int = 20


class MatchBreakdown(BaseModel):
    languages: int
    topics: int
    distance: int
    activity: int


class DiscoverCard(BaseModel):
    profile: PublicProfile
    distance_km: float
    match_score: int
    breakdown: MatchBreakdown
    shared_topics: list[str]
    teach_learn: list[str]   # human-readable language complement notes


# --- letters --------------------------------------------------------------
class LetterCreate(BaseModel):
    recipient_id: int
    subject: str = Field(default="", max_length=160)
    body: str = Field(min_length=1)
    stamp_id: int | None = None
    reply_to_id: int | None = None


class PartyBrief(BaseModel):
    user_id: int
    display_name: str
    handle: str
    country: str
    country_code: str
    avatar_seed: str
    avatar_color: str


class StampOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str
    country: str
    country_code: str
    motif: str
    color: str
    rarity: str
    premium_only: bool


class LetterOut(BaseModel):
    id: int
    subject: str
    body: str | None          # hidden until delivered
    state: str
    distance_km: float
    sent_at: datetime
    deliver_at: datetime
    delivered_at: datetime | None
    read_at: datetime | None
    eta_seconds: int          # seconds until delivery (0 if delivered)
    sender: PartyBrief
    recipient: PartyBrief
    stamp: StampOut | None
    reply_to_id: int | None
    saved: bool = False


class DraftIn(BaseModel):
    recipient_id: int | None = None
    subject: str = ""
    body: str = ""


class DraftOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    recipient_id: int | None
    subject: str
    body: str
    updated_at: datetime


# --- friends --------------------------------------------------------------
class FriendRequestOut(BaseModel):
    id: int
    status: str
    created_at: datetime
    other: PartyBrief
    direction: str   # incoming | outgoing


class FriendOut(BaseModel):
    profile: PartyBrief
    since: datetime


# --- achievements / stamps ------------------------------------------------
class AchievementOut(BaseModel):
    code: str
    name: str
    description: str
    icon: str
    unlocked: bool
    unlocked_at: datetime | None


class UserStampOut(BaseModel):
    stamp: StampOut
    quantity: int
    acquired_at: datetime


# --- subscriptions --------------------------------------------------------
class PlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str
    price_cents: int
    currency: str
    interval: str
    features: list[str]


class SubscribeIn(BaseModel):
    plan_id: int
    # mock card token; any non-empty string "succeeds"
    payment_token: str = "tok_demo_visa"


class SubscriptionOut(BaseModel):
    status: str
    plan: PlanOut
    started_at: datetime
    current_period_end: datetime | None


# --- community ------------------------------------------------------------
class CommunityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    slug: str
    name: str
    description: str
    color: str
    member_count: int = 0
    joined: bool = False


class PostCreate(BaseModel):
    title: str = ""
    body: str = Field(min_length=1)


class CommentCreate(BaseModel):
    body: str = Field(min_length=1)


class CommentOut(BaseModel):
    id: int
    body: str
    created_at: datetime
    author: PartyBrief


class PostOut(BaseModel):
    id: int
    title: str
    body: str
    created_at: datetime
    author: PartyBrief
    comment_count: int = 0


# --- notifications --------------------------------------------------------
class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    kind: str
    title: str
    body: str
    link: str
    is_read: bool
    created_at: datetime


# --- admin ----------------------------------------------------------------
class AdminStats(BaseModel):
    users: int
    premium_users: int
    letters: int
    letters_in_transit: int
    communities: int
    open_reports: int


# --- journey (world map) ---------------------------------------------------
class JourneyHome(BaseModel):
    city: str
    country: str
    country_code: str
    latitude: float
    longitude: float


class JourneyPin(BaseModel):
    user_id: int
    display_name: str
    handle: str
    avatar_seed: str
    avatar_color: str
    country: str
    country_code: str
    city: str
    latitude: float
    longitude: float
    distance_km: float
    letters_count: int
    delivered_count: int
    last_letter_at: datetime
    is_friend: bool
    stamp_codes: list[str] = []


class JourneyHighlight(BaseModel):
    user_id: int
    display_name: str
    country: str
    country_code: str
    distance_km: float


class JourneyStats(BaseModel):
    total_km: float
    countries_count: int
    correspondents_count: int
    letters_sent: int
    letters_delivered: int
    farthest: JourneyHighlight | None
    nearest: JourneyHighlight | None


class JourneyOut(BaseModel):
    home: JourneyHome
    pins: list[JourneyPin]
    stats: JourneyStats


MeOut.model_rebuild()
