"""Seed PenPal+ with a believable world: catalogs, pen pals on every
continent, stamps in their collections, and letters already in transit.

Usage:
    python -m app.seed          # seed only if the database is empty
    python -m app.seed --force  # wipe and reseed
"""
import sys
from datetime import timedelta

from .database import Base, engine, SessionLocal
from . import models, security, services

# --- catalogs --------------------------------------------------------------
ACHIEVEMENTS = [
    ("first_letter", "First Letter", "Send your very first letter.", "✉️", 1),
    ("pen_pal", "Pen Pal", "Receive a letter that has finished its journey.", "📬", 1),
    ("correspondent", "Correspondent", "Send 10 letters.", "🖋️", 10),
    ("globetrotter", "Globetrotter", "Exchange letters with 5 countries.", "🌍", 5),
    ("world_citizen", "World Citizen", "Exchange letters with 15 countries.", "🗺️", 15),
    ("polyglot", "Polyglot", "List 3 or more languages on your profile.", "💬", 3),
    ("social_butterfly", "Social Butterfly", "Make 5 pen pals.", "🦋", 5),
]

STAMPS = [
    ("eg_pyramids", "Pyramids of Giza", "Egypt", "EG", "🏛️", "#C2A14D", "common", False),
    ("jp_fuji", "Mount Fuji", "Japan", "JP", "🗻", "#C0392B", "common", False),
    ("is_aurora", "Aurora Borealis", "Iceland", "IS", "🌌", "#2B4C7E", "rare", False),
    ("br_tucan", "Atlantic Toucan", "Brazil", "BR", "🦜", "#1E8449", "common", False),
    ("de_gate", "Brandenburg Gate", "Germany", "DE", "🏛️", "#5D6D7E", "common", False),
    ("ke_savanna", "Savanna Sunrise", "Kenya", "KE", "🦁", "#CA6F1E", "rare", False),
    ("kr_hanbok", "Hanbok Festival", "South Korea", "KR", "🏮", "#A93226", "common", False),
    ("ar_tango", "Tango Nights", "Argentina", "AR", "💃", "#7D3C98", "rare", False),
    ("ca_maple", "Maple Country", "Canada", "CA", "🍁", "#B23A2E", "common", False),
    ("in_lotus", "Lotus Temple", "India", "IN", "🪷", "#D4AC0D", "common", False),
    ("pt_azulejo", "Azulejo Tiles", "Portugal", "PT", "🔵", "#2471A3", "common", False),
    ("world_classic", "Par Avion Classic", "World", "", "✈️", "#1B2A4A", "common", False),
    ("gold_quill", "Gold Quill", "World", "", "🪶", "#B8893B", "epic", True),
    ("first_edition", "First Edition", "World", "", "📜", "#7A6A55", "epic", True),
]

PLANS = [
    ("free", "Free", 0, "USD", "free",
     "Up to 15 letters in transit\nGlobal discovery\nBasic stamp collection"),
    ("plus_monthly", "PenPal+ Monthly", 499, "USD", "month",
     "Unlimited letters in transit\nAdvanced discovery filters\nExclusive stamps\n"
     "Auto-translation\nPriority delivery insights"),
    ("plus_yearly", "PenPal+ Yearly", 3999, "USD", "year",
     "Everything in Monthly\nTwo months free\nEarly access to new features"),
]

COMMUNITIES = [
    ("language-exchange", "Language Exchange", "Find partners and practice together.", "#2B4C7E"),
    ("bookworms", "Bookworms", "What are you reading this month?", "#B23A2E"),
    ("wanderlust", "Wanderlust", "Stories from the road and dreams of the next trip.", "#1E8449"),
    ("slow-living", "Slow Living", "On patience, letters, and unhurried days.", "#B8893B"),
]

TOPICS = {
    "books": "Books", "travel": "Travel", "history": "History", "music": "Music",
    "food": "Food & Cooking", "film": "Film", "nature": "Nature",
    "photography": "Photography", "tech": "Technology", "philosophy": "Philosophy",
    "languages": "Languages", "writing": "Writing", "art": "Art",
    "sports": "Sports",
}

LANGS = {
    "en": "English", "ar": "Arabic", "ja": "Japanese", "is": "Icelandic",
    "pt": "Portuguese", "es": "Spanish", "de": "German", "sw": "Swahili",
    "ko": "Korean", "fr": "French", "hi": "Hindi",
}

# handle, display, email, country, cc, city, lat, lng, tz, color, [langs], [topics]
USERS = [
    ("wanderer", "Layla Hassan", "demo@penpal.app", "Egypt", "EG", "Cairo",
     30.0444, 31.2357, "Africa/Cairo", "#C2A14D",
     [("ar", "native"), ("en", "fluent"), ("ja", "learning")],
     ["books", "travel", "history"]),
    ("haru_t", "Haruki Tanaka", "haruki@penpal.app", "Japan", "JP", "Tokyo",
     35.6762, 139.6503, "Asia/Tokyo", "#C0392B",
     [("ja", "native"), ("en", "learning")],
     ["photography", "food", "travel", "film"]),
    ("bjork_s", "Bjork Sigurd", "bjork@penpal.app", "Iceland", "IS", "Reykjavik",
     64.1466, -21.9426, "Atlantic/Reykjavik", "#2B4C7E",
     [("is", "native"), ("en", "fluent")],
     ["nature", "music", "books"]),
    ("lucas_sp", "Lucas Oliveira", "lucas@penpal.app", "Brazil", "BR", "Sao Paulo",
     -23.5505, -46.6333, "America/Sao_Paulo", "#1E8449",
     [("pt", "native"), ("es", "fluent"), ("en", "learning")],
     ["music", "food", "sports"]),
    ("mara_b", "Mara Brandt", "mara@penpal.app", "Germany", "DE", "Berlin",
     52.5200, 13.4050, "Europe/Berlin", "#5D6D7E",
     [("de", "native"), ("en", "fluent"), ("ar", "learning")],
     ["philosophy", "tech", "history"]),
    ("amani_k", "Amani Kamau", "amani@penpal.app", "Kenya", "KE", "Nairobi",
     -1.2921, 36.8219, "Africa/Nairobi", "#CA6F1E",
     [("sw", "native"), ("en", "fluent")],
     ["nature", "travel", "writing"]),
    ("jiwoo", "Ji-woo Park", "jiwoo@penpal.app", "South Korea", "KR", "Seoul",
     37.5665, 126.9780, "Asia/Seoul", "#A93226",
     [("ko", "native"), ("en", "learning")],
     ["film", "music", "food"]),
    ("valen_ar", "Valentina Rossi", "valentina@penpal.app", "Argentina", "AR", "Buenos Aires",
     -34.6037, -58.3816, "America/Argentina/Buenos_Aires", "#7D3C98",
     [("es", "native"), ("en", "learning")],
     ["books", "music", "travel"]),
    ("oliver_ca", "Oliver Tremblay", "oliver@penpal.app", "Canada", "CA", "Toronto",
     43.6532, -79.3832, "America/Toronto", "#B23A2E",
     [("en", "native"), ("fr", "fluent"), ("ar", "learning")],
     ["books", "nature", "history"]),
    ("priya_in", "Priya Sharma", "priya@penpal.app", "India", "IN", "Mumbai",
     19.0760, 72.8777, "Asia/Kolkata", "#D4AC0D",
     [("hi", "native"), ("en", "fluent")],
     ["film", "food", "writing"]),
    ("tomas_pt", "Tomas Silva", "tomas@penpal.app", "Portugal", "PT", "Lisbon",
     38.7223, -9.1393, "Europe/Lisbon", "#2471A3",
     [("pt", "native"), ("en", "fluent"), ("es", "fluent")],
     ["music", "history", "nature"]),
]

DEMO_PASSWORD = "password123"


def seed():
    force = "--force" in sys.argv
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(models.User).first():
            if not force:
                print("Database already has data. Use --force to wipe and reseed.")
                return
            db.close()
            Base.metadata.drop_all(bind=engine)
            Base.metadata.create_all(bind=engine)
            db = SessionLocal()

        # catalogs ---------------------------------------------------------
        for code, name, desc, icon, thr in ACHIEVEMENTS:
            db.add(models.Achievement(code=code, name=name, description=desc,
                                      icon=icon, threshold=thr))
        stamp_by_code = {}
        for code, name, country, cc, motif, color, rarity, premium in STAMPS:
            s = models.Stamp(code=code, name=name, country=country, country_code=cc,
                             motif=motif, color=color, rarity=rarity, premium_only=premium)
            db.add(s)
            stamp_by_code[code] = s
        for code, name, cents, cur, interval, feats in PLANS:
            db.add(models.Plan(code=code, name=name, price_cents=cents, currency=cur,
                               interval=interval, features=feats))
        community_by_slug = {}
        for slug, name, desc, color in COMMUNITIES:
            c = models.Community(slug=slug, name=name, description=desc, color=color)
            db.add(c)
            community_by_slug[slug] = c
        db.flush()

        # users ------------------------------------------------------------
        user_by_handle = {}
        for (handle, display, email, country, cc, city, lat, lng, tz, color,
             langs, topics) in USERS:
            u = models.User(
                email=email, password_hash=security.hash_password(DEMO_PASSWORD),
                is_premium=(handle in ("haru_t", "bjork_s")),
            )
            db.add(u)
            db.flush()
            db.add(models.Profile(
                user_id=u.id, display_name=display, handle=handle,
                bio=f"Writing from {city}. " + _bio_for(topics),
                country=country, country_code=cc, city=city,
                latitude=lat, longitude=lng, timezone=tz,
                avatar_seed=handle, avatar_color=color,
            ))
            db.add(models.UserSettings(user_id=u.id, distance_pref="far"))
            for code, fluency in langs:
                db.add(models.UserLanguage(user_id=u.id, code=code,
                                           name=LANGS[code], fluency=fluency))
            for slug in topics:
                db.add(models.UserTopic(user_id=u.id, slug=slug, label=TOPICS[slug]))
            user_by_handle[handle] = u
        db.flush()

        # an admin ---------------------------------------------------------
        admin = models.User(
            email="admin@penpal.app",
            password_hash=security.hash_password(DEMO_PASSWORD),
            is_admin=True, is_premium=True,
        )
        db.add(admin)
        db.flush()
        db.add(models.Profile(user_id=admin.id, display_name="Postmaster",
                              handle="postmaster", country="World", country_code="",
                              city="The Sorting Office", avatar_seed="postmaster",
                              avatar_color="#1B2A4A", latitude=51.5, longitude=-0.12))
        db.add(models.UserSettings(user_id=admin.id, discoverable=False))
        db.flush()

        # give everyone their home-country stamp + the classic --------------
        cc_to_stamp = {s.country_code: s for s in stamp_by_code.values() if s.country_code}
        for handle, u in user_by_handle.items():
            services.grant_stamp(db, u.id, stamp_by_code["world_classic"])
            home = cc_to_stamp.get(u.profile.country_code)
            if home:
                services.grant_stamp(db, u.id, home)
        # demo gets a few extra stamps to play with
        demo = user_by_handle["wanderer"]
        for code in ("jp_fuji", "is_aurora", "ke_savanna", "ca_maple"):
            services.grant_stamp(db, demo.id, stamp_by_code[code])
        db.flush()

        # letters in the world --------------------------------------------
        now = services.utcnow()

        def make_letter(sender, recipient, subject, body, stamp_code=None,
                        sent_delta=None, delivered=True, reply_to=None):
            sp, rp = sender.profile, recipient.profile
            dist = services.haversine_km(sp.latitude, sp.longitude,
                                         rp.latitude, rp.longitude)
            sent_at = now - sent_delta if sent_delta else now
            if delivered:
                deliver_at = sent_at + timedelta(hours=1)
                state, delivered_at = "delivered", deliver_at
            else:
                deliver_at = services.delivery_eta(dist, sent_at)
                state, delivered_at = "in_transit", None
            letter = models.Letter(
                sender_id=sender.id, recipient_id=recipient.id, subject=subject,
                body=body, stamp_id=stamp_by_code[stamp_code].id if stamp_code else None,
                state=state, distance_km=dist, sent_at=sent_at,
                deliver_at=deliver_at, delivered_at=delivered_at,
                reply_to_id=reply_to.id if reply_to else None,
            )
            db.add(letter)
            db.flush()
            return letter

        haru = user_by_handle["haru_t"]
        bjork = user_by_handle["bjork_s"]
        mara = user_by_handle["mara_b"]
        oliver = user_by_handle["oliver_ca"]

        # Delivered letter waiting in demo's inbox (from Tokyo)
        make_letter(
            haru, demo,
            "Cherry blossoms and a question",
            "Dear Layla,\n\nThe sakura have just opened along the Meguro river and "
            "I thought of writing to a stranger far away. You said you are learning "
            "Japanese \u2014 what made you start? Here, spring feels like the whole "
            "city exhales at once.\n\nWith warm regards from Tokyo,\nHaruki",
            stamp_code="jp_fuji", sent_delta=timedelta(days=2),
        )

        # A two-way exchange Demo <-> Reykjavik (forms a friendship)
        l1 = make_letter(
            demo, bjork,
            "Greetings from Cairo",
            "Hello Bjork,\n\nI have never seen snow, and you have probably never "
            "felt the desert at noon. Tell me what silence sounds like in Iceland.\n\n"
            "Layla", stamp_code="eg_pyramids", sent_delta=timedelta(days=5),
        )
        make_letter(
            bjork, demo,
            "Re: Greetings from Cairo",
            "Dear Layla,\n\nSilence here is not empty \u2014 it is wind over lava and "
            "the far crack of glaciers. I am sending you a little of the northern "
            "light. Write back and tell me about the noon you mentioned.\n\nBjork",
            stamp_code="is_aurora", sent_delta=timedelta(days=3), reply_to=l1,
        )
        services.ensure_friendship(db, demo.id, bjork.id)

        # In-transit letter heading to demo (from Berlin) — visible as travelling
        make_letter(
            mara, demo,
            "A parcel of questions",
            "Layla, I am reading about Cairo's old libraries and have so many "
            "questions. This letter is still on its way as you read this line.",
            stamp_code="de_gate", sent_delta=timedelta(hours=1), delivered=False,
        )

        # A few letters between others to make the world feel populated
        make_letter(oliver, haru, "Maple and matcha",
                    "Greetings from Toronto! Trading you autumn leaves for tea.",
                    stamp_code="ca_maple", sent_delta=timedelta(days=1))
        make_letter(user_by_handle["lucas_sp"], user_by_handle["tomas_pt"],
                    "Saudade across the ocean",
                    "Tomas, same language, two shores. Let's compare our seas.",
                    stamp_code="br_tucan", sent_delta=timedelta(days=4))

        # Incoming friend request to demo from Berlin
        db.add(models.FriendRequest(requester_id=mara.id, addressee_id=demo.id,
                                    status="pending"))

        # Communities: demo joins two; seed a couple of posts
        for slug in ("bookworms", "slow-living"):
            db.add(models.CommunityMember(community_id=community_by_slug[slug].id,
                                          user_id=demo.id))
        p = models.Post(community_id=community_by_slug["slow-living"].id,
                        author_id=bjork.id, title="On waiting",
                        body="A letter that takes a week to arrive makes the reply "
                             "feel earned. Anyone else prefer the wait?")
        db.add(p)
        db.flush()
        db.add(models.Comment(post_id=p.id, author_id=demo.id,
                              body="Completely. The anticipation is half the joy."))

        db.commit()

        # Recompute achievements for everyone now that letters exist.
        for u in db.query(models.User).all():
            services.check_achievements(db, u.id)
        db.commit()

        print("Seeded PenPal+.")
        print(f"  Users:        {db.query(models.User).count()}")
        print(f"  Letters:      {db.query(models.Letter).count()}")
        print(f"  Stamps:       {db.query(models.Stamp).count()}")
        print(f"  Communities:  {db.query(models.Community).count()}")
        print()
        print("  Demo login:   demo@penpal.app / password123")
        print("  Admin login:  admin@penpal.app / password123")
        print("  (every seeded pen pal uses the same password)")
    finally:
        db.close()


def _bio_for(topics: list[str]) -> str:
    labels = [TOPICS[t] for t in topics]
    return "Into " + ", ".join(labels[:-1]) + (f" and {labels[-1]}." if len(labels) > 1 else f"{labels[0]}.")


if __name__ == "__main__":
    seed()
