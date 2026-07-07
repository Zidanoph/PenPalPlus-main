"""End-to-end smoke test for the PenPal+ API. Exercises the full core loop."""
import os, sys, json, time, urllib.request, urllib.error

# Defaults to the same port the README starts uvicorn on (8000).
# Override with: PENPAL_API=http://127.0.0.1:9000 python smoke_test.py
BASE = os.environ.get("PENPAL_API", "http://127.0.0.1:8000")

def call(method, path, token=None, json_body=None, form=None):
    url = BASE + path
    headers = {}
    data = None
    if json_body is not None:
        data = json.dumps(json_body).encode()
        headers["Content-Type"] = "application/json"
    elif form is not None:
        data = "&".join(f"{k}={v}" for k, v in form.items()).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            body = r.read().decode()
            return r.status, (json.loads(body) if body else None)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, body

ok = 0
fail = 0
def check(label, cond, detail=""):
    global ok, fail
    if cond:
        ok += 1
        print(f"  PASS  {label}")
    else:
        fail += 1
        print(f"  FAIL  {label}  {detail}")

print("=== 1. Register a brand-new user (Paris) ===")
st, body = call("POST", "/auth/register", json_body={
    "email": "tester@penpal.app", "password": "testpass123",
    "display_name": "Test Wanderer", "handle": "tester",
    "country": "France", "country_code": "FR", "city": "Paris",
    "latitude": 48.8566, "longitude": 2.3522,
})
check("register returns 201", st == 201, f"got {st}: {body}")
check("register returns token pair", isinstance(body, dict) and "access_token" in body, str(body)[:200])
tok = body.get("access_token") if isinstance(body, dict) else None

print("\n=== 2. Login via OAuth2 form ===")
st, body = call("POST", "/auth/login", form={"username": "tester@penpal.app", "password": "testpass123"})
check("login returns 200", st == 200, f"got {st}: {body}")
check("login returns access + refresh", "access_token" in body and "refresh_token" in body, str(body)[:200])
tok = body["access_token"]
refresh = body["refresh_token"]

print("\n=== 3. Complete onboarding (PUT /profile: languages, topics, bio) ===")
st, me = call("PUT", "/profile", token=tok, json_body={
    "bio": "Bonjour from Paris. Lover of old books and slow mornings.",
    "languages": [
        {"code": "fr", "name": "French", "fluency": "native"},
        {"code": "ar", "name": "Arabic", "fluency": "learning"},
    ],
    "topics": [
        {"slug": "books", "label": "Books"},
        {"slug": "travel", "label": "Travel"},
    ],
})
check("PUT /profile returns 200", st == 200, f"got {st}")

print("\n=== 3b. /profile/me reflects onboarding ===")
st, me = call("GET", "/profile/me", token=tok)
check("me returns 200", st == 200, f"got {st}")
check("me has correct handle", me.get("profile",{}).get("handle") == "tester", str(me)[:200])
check("me exposes languages", any(l.get("name")=="French" for l in me.get("languages",[])), str(me)[:200])

print("\n=== 4. Refresh token (rotation) ===")
st, body = call("POST", "/auth/refresh-token", json_body={"refresh_token": refresh})
check("refresh returns 200", st == 200, f"got {st}: {body}")
check("refresh issues new access token", "access_token" in body, str(body)[:120])
tok = body.get("access_token", tok)

print("\n=== 5. Discover suggestions (ranked pen pals) ===")
st, cards = call("GET", "/discover/suggestions", token=tok)
check("discover returns 200", st == 200, f"got {st}")
check("discover returns a list", isinstance(cards, list) and len(cards) > 0, f"count={len(cards) if isinstance(cards,list) else 'n/a'}")
if isinstance(cards, list) and cards:
    c0 = cards[0]
    check("card has match score", "match_score" in c0, str(c0)[:200])
    check("card has distance_km", "distance_km" in c0, str(c0)[:200])
    target_id = cards[0]["profile"]["user_id"]
    print(f"        top match: {cards[0]['profile']['display_name']} in {cards[0]['profile']['city']} "
          f"({cards[0]['match_score']}%, {cards[0]['distance_km']} km)")
else:
    target_id = None

print("\n=== 6. Pick a free stamp from the catalog ===")
st, stamps = call("GET", "/stamps", token=tok)
check("stamp catalog 200", st == 200, f"got {st}")
free_stamp = next((s for s in stamps if not s.get("premium_only")), None) if isinstance(stamps, list) else None
check("found a free stamp", free_stamp is not None, str(stamps)[:160])
if free_stamp:
    st, _ = call("POST", f"/stamps/{free_stamp['id']}/claim", token=tok)
    check("claim free stamp 200/201", st in (200, 201), f"got {st}")

print("\n=== 7. Compose & send a letter ===")
letter_id = None
if target_id:
    st, letter = call("POST", "/letters", token=tok, json_body={
        "recipient_id": target_id,
        "subject": "Greetings from Paris",
        "body": "Bonjour! I just joined PenPal+ and your profile caught my eye. "
                "What is the season like where you are right now?",
        "stamp_id": free_stamp["id"] if free_stamp else None,
    })
    check("send letter 201", st == 201, f"got {st}: {letter}")
    if isinstance(letter, dict):
        check("letter is in_transit", letter.get("state") == "in_transit", str(letter)[:200])
        check("letter has distance_km", letter.get("distance_km") is not None, str(letter)[:200])
        check("letter has eta_seconds", letter.get("eta_seconds") is not None, str(letter)[:200])
        letter_id = letter.get("id")
        print(f"        in transit: {letter.get('distance_km')} km, "
              f"ETA ~{round((letter.get('eta_seconds') or 0)/3600,1)} h")

print("\n=== 8. Sent box shows the letter ===")
st, sent = call("GET", "/letters/sent", token=tok)
check("sent box 200", st == 200, f"got {st}")
check("sent box contains our letter", isinstance(sent, list) and any(l.get("id") == letter_id for l in sent),
      f"count={len(sent) if isinstance(sent,list) else 'n/a'}")

print("\n=== 9. Log in as demo user & read the seeded inbox ===")
st, body = call("POST", "/auth/login", form={"username": "demo@penpal.app", "password": "password123"})
check("demo login 200", st == 200, f"got {st}: {body}")
demo_tok = body.get("access_token")
st, inbox = call("GET", "/letters/inbox", token=demo_tok)
check("demo inbox 200", st == 200, f"got {st}")
check("demo inbox has delivered mail", isinstance(inbox, list) and len(inbox) > 0,
      f"count={len(inbox) if isinstance(inbox,list) else 'n/a'}")
delivered = [l for l in inbox if l.get("state") == "delivered"] if isinstance(inbox, list) else []
if delivered:
    lid = delivered[0]["id"]
    st, full = call("GET", f"/letters/{lid}", token=demo_tok)
    check("open delivered letter 200", st == 200, f"got {st}")
    check("delivered letter body is present", bool(full.get("body")), str(full)[:160])
    check("delivered letter has postmark/read", full.get("read_at") is not None or full.get("delivered_at") is not None, str(full)[:160])
    print(f"        opened: \"{(full.get('subject') or '')[:40]}\" from {full.get('sender',{}).get('display_name','?')}")

print("\n=== 10. Demo achievements & notifications ===")
st, achs = call("GET", "/achievements", token=demo_tok)
check("achievements 200", st == 200, f"got {st}")
unlocked = [a for a in achs if a.get("unlocked")] if isinstance(achs, list) else []
check("demo has unlocked achievements", len(unlocked) > 0, f"unlocked={len(unlocked)}")
st, n = call("GET", "/notifications/unread-count", token=demo_tok)
check("unread-count 200", st == 200, f"got {st}: {n}")

print("\n=== 11. Premium plans & mock subscribe ===")
st, plans = call("GET", "/plans", token=tok)
check("plans 200", st == 200, f"got {st}")
paid = next((p for p in plans if (p.get("price_cents") or 0) > 0), None) if isinstance(plans, list) else None
check("found a paid plan", paid is not None, str(plans)[:160])
if paid:
    st, sub = call("POST", "/subscriptions", token=tok, json_body={"plan_id": paid["id"]})
    check("subscribe 200/201", st in (200, 201), f"got {st}: {sub}")

print("\n=== 12. Admin stats (RBAC) ===")
st, body = call("POST", "/auth/login", form={"username": "admin@penpal.app", "password": "password123"})
admin_tok = body.get("access_token")
st, stats = call("GET", "/admin/stats", token=admin_tok)
check("admin stats 200 for admin", st == 200, f"got {st}")
st, _ = call("GET", "/admin/stats", token=tok)
check("admin stats 403 for normal user", st == 403, f"got {st}")

print(f"\n==================  {ok} passed, {fail} failed  ==================")
sys.exit(1 if fail else 0)
