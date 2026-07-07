import { useState, useEffect, useRef } from "react";

/* ===========================================================================
   PenPal+ — interactive showcase
   A self-contained walkthrough of the product's core loop: choose where you
   are, find a pen pal, write a letter, then watch it travel a real distance
   before it's read. No backend, no storage — everything lives in memory.
   Visual direction: vintage airmail / aerogramme.
   ========================================================================= */

const C = {
  ink: "#20304d",
  inkSoft: "#41506a",
  paper: "#f0e8d6",
  paper2: "#fbf6ea",
  edge: "#e4d9c0",
  red: "#b23a2e",
  blue: "#2b4c7e",
  sepia: "#7a6a55",
  gold: "#b8893b",
  ok: "#4b7d5b",
};

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Spectral:ital,wght@0,400;0,500;0,600;1,400&family=Courier+Prime:wght@400;700&display=swap');
@keyframes pp-fly { from { offset-distance: 0%; } to { offset-distance: 100%; } }
@keyframes pp-dash { to { stroke-dashoffset: -100; } }
@keyframes pp-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes pp-pop { 0% { transform: scale(0.6) rotate(-12deg); opacity: 0; } 60% { transform: scale(1.08) rotate(-9deg); } 100% { transform: scale(1) rotate(-9deg); opacity: 0.85; } }
@keyframes pp-toast { 0% { transform: translateY(20px); opacity: 0; } 12% { transform: none; opacity: 1; } 88% { transform: none; opacity: 1; } 100% { transform: translateY(-8px); opacity: 0; } }
.pp * { box-sizing: border-box; }
.pp-mono { font-family: 'Courier Prime', monospace; }
.pp-btn { font-family: 'Courier Prime', monospace; text-transform: uppercase; letter-spacing: 0.1em; font-size: 13px; border: 1px solid ${C.ink}; background: ${C.ink}; color: ${C.paper2}; padding: 11px 20px; border-radius: 4px; cursor: pointer; transition: transform .08s, box-shadow .15s, opacity .15s; }
.pp-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(32,48,77,.2); }
.pp-btn:disabled { opacity: .4; cursor: not-allowed; transform: none; box-shadow: none; }
.pp-ghost { background: transparent; color: ${C.ink}; }
.pp-ghost:hover { background: rgba(32,48,77,.06); }
@media (prefers-reduced-motion: reduce) { .pp *, .pp *::before, .pp *::after { animation: none !important; } }
`;

/* ---- mock world: real coordinates, so distances are honest -------------- */
const ME = { city: "Cairo", country: "Egypt", code: "EG", lat: 30.04, lng: 31.24 };
const PALS = [
  { id: 1, name: "Haruki Tanaka", handle: "haruki_k", city: "Tokyo", country: "Japan", code: "JP",
    lat: 35.68, lng: 139.65, color: "#b23a2e", langs: ["Japanese", "English"],
    teach: "speaks Japanese · learning Arabic", topics: ["Tea", "Film", "Cities"], match: 88,
    reply: "Your letter reached me on a grey Tokyo morning, and it made the tea taste better.\n\nThe season here is all wet pavement and the last of the cherry blossoms going soft underfoot. You asked what I notice first in a new city — it's always the sound. Cairo must roar. Tokyo only hums.\n\nWrite back when the heat lets you. I'll be here, kettle on." },
  { id: 2, name: "Sigrún Jónsdóttir", handle: "sigrun_is", city: "Reykjavík", country: "Iceland", code: "IS",
    lat: 64.15, lng: -21.94, color: "#2b4c7e", langs: ["Icelandic", "English"],
    teach: "speaks Icelandic · learning Arabic", topics: ["Books", "Nature", "Music"], match: 81,
    reply: "Greetings from the edge of the map.\n\nIt is bright here almost all night now — the sun just grazes the horizon and climbs back up. I read your letter by that strange midnight light and felt, for a moment, very close to a desert I have never seen.\n\nTell me about the river. I will trade you a glacier." },
  { id: 3, name: "Mateo Silva", handle: "mateo_br", city: "São Paulo", country: "Brazil", code: "BR",
    lat: -23.55, lng: -46.64, color: "#4b7d5b", langs: ["Portuguese", "Spanish"],
    teach: "speaks Portuguese · learning English", topics: ["Music", "Food", "Football"], match: 74,
    reply: "Olá, friend across the ocean!\n\nYour envelope had a stamp I'd never seen and I kept it on my desk for a week before opening it — anticipation is half the pleasure, no? São Paulo is loud and warm and always a little behind on sleep. Much like me.\n\nSend me a word in Arabic I can carry around. I'll send you one in Portuguese." },
];

function haversine(a, b) {
  const R = 6371, toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)));
}

const STAMPS = [
  { id: "a", name: "Desert Kite", motif: "🪁", color: "#b23a2e", rarity: "common" },
  { id: "b", name: "Paper Boat", motif: "⛵", color: "#2b4c7e", rarity: "common" },
  { id: "c", name: "Night Heron", motif: "🪶", color: "#7a6a55", rarity: "uncommon" },
  { id: "d", name: "Gold Quill", motif: "🖋", color: "#b8893b", rarity: "rare" },
];

/* ===========================================================================
   Root
   ========================================================================= */
export default function PenPalShowcase() {
  const [scene, setScene] = useState("onboard");
  const [me, setMe] = useState({ name: "", ...ME });
  const [pal, setPal] = useState(null);
  const [letter, setLetter] = useState(null); // { subject, body, stamp }
  const [toast, setToast] = useState(null);

  const distance = pal ? haversine(me, pal) : 0;

  function fireToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 4200);
  }

  return (
    <div
      className="pp"
      style={{
        fontFamily: "'Spectral', Georgia, serif",
        color: C.ink,
        background: C.paper,
        backgroundImage:
          `radial-gradient(circle at 10% -10%, rgba(43,76,126,.06), transparent 42%), radial-gradient(circle at 92% 110%, rgba(178,58,46,.06), transparent 40%)`,
        minHeight: 560,
        padding: "26px 18px 40px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <style>{FONTS}</style>

      <Header scene={scene} me={me} />

      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {scene === "onboard" && (
          <Onboard
            me={me}
            setMe={setMe}
            onDone={() => setScene("discover")}
          />
        )}
        {scene === "discover" && (
          <Discover
            me={me}
            onPick={(p) => { setPal(p); setScene("compose"); }}
          />
        )}
        {scene === "compose" && pal && (
          <Compose
            me={me}
            pal={pal}
            distance={distance}
            onBack={() => setScene("discover")}
            onSend={(l) => { setLetter(l); setScene("transit"); }}
          />
        )}
        {scene === "transit" && pal && (
          <Transit
            me={me}
            pal={pal}
            distance={distance}
            letter={letter}
            onArrived={() => { setScene("read"); fireToast({ icon: "🏅", title: "Achievement unlocked", text: "First Letter — your words have left home." }); }}
          />
        )}
        {scene === "read" && pal && (
          <ReadReply
            me={me}
            pal={pal}
            distance={distance}
            onRestart={() => { setPal(null); setLetter(null); setScene("discover"); }}
          />
        )}
      </div>

      {toast && <Toast {...toast} />}
    </div>
  );
}

/* ===========================================================================
   Header + progress
   ========================================================================= */
const STEPS = ["onboard", "discover", "compose", "transit", "read"];
const STEP_LABEL = { onboard: "Arrive", discover: "Discover", compose: "Write", transit: "Travel", read: "Read" };

function Header({ scene, me }) {
  const idx = STEPS.indexOf(scene);
  return (
    <div style={{ maxWidth: 720, margin: "0 auto 22px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 24, letterSpacing: "-0.01em" }}>
          ✉ PenPal<span style={{ color: C.red }}>+</span>
        </div>
        <div className="pp-mono" style={{ fontSize: 11, letterSpacing: "0.18em", color: C.sepia, textTransform: "uppercase" }}>
          {me.name ? `${me.name} · ${flag(me.code)} ${me.city}` : "Letters that travel"}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ flex: 1 }}>
            <div style={{ height: 3, borderRadius: 2, background: i <= idx ? C.red : C.edge, transition: "background .4s" }} />
            <div className="pp-mono" style={{ fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 5, color: i === idx ? C.ink : C.sepia }}>
              {STEP_LABEL[s]}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===========================================================================
   Scene 1 — Onboard
   ========================================================================= */
const CITY_CHOICES = [
  { city: "Cairo", country: "Egypt", code: "EG", lat: 30.04, lng: 31.24 },
  { city: "London", country: "United Kingdom", code: "GB", lat: 51.51, lng: -0.13 },
  { city: "New York", country: "United States", code: "US", lat: 40.71, lng: -74.01 },
  { city: "Mumbai", country: "India", code: "IN", lat: 19.08, lng: 72.88 },
  { city: "Sydney", country: "Australia", code: "AU", lat: -33.87, lng: 151.21 },
];

function Onboard({ me, setMe, onDone }) {
  const [name, setName] = useState(me.name);
  const [city, setCity] = useState(me.city);
  const choice = CITY_CHOICES.find((c) => c.city === city) || CITY_CHOICES[0];

  return (
    <AirmailPanel style={{ animation: "pp-in .5s ease both" }}>
      <Eyebrow>Welcome to the post office</Eyebrow>
      <h1 style={h1}>The slow way to know someone</h1>
      <p style={{ color: C.inkSoft, marginTop: 0 }}>
        No feeds, no likes — just letters that take real time to cross real distance.
        First, tell us where you're writing from.
      </p>

      <Label>Your name</Label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Layla"
        style={input}
      />

      <Label>Posting from</Label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {CITY_CHOICES.map((c) => (
          <button
            key={c.city}
            onClick={() => setCity(c.city)}
            className="pp-mono"
            style={{
              ...chip,
              cursor: "pointer",
              background: city === c.city ? C.blue : C.paper,
              color: city === c.city ? C.paper2 : C.inkSoft,
              borderColor: city === c.city ? C.blue : C.edge,
            }}
          >
            {flag(c.code)} {c.city}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 26 }}>
        <button
          className="pp-btn"
          disabled={!name.trim()}
          onClick={() => { setMe({ name: name.trim(), ...choice }); onDone(); }}
        >
          Open my mailbox →
        </button>
      </div>
    </AirmailPanel>
  );
}

/* ===========================================================================
   Scene 2 — Discover
   ========================================================================= */
function Discover({ me, onPick }) {
  return (
    <div style={{ animation: "pp-in .5s ease both" }}>
      <Eyebrow>Find a pen pal</Eyebrow>
      <h2 style={h2}>People worth writing to</h2>
      <p style={{ color: C.inkSoft, marginTop: 0 }}>
        Matched on the languages you share or could teach each other, what you're into, and how far
        apart you are. Pick someone to write your first letter.
      </p>

      <div style={{ display: "grid", gap: 14, marginTop: 4 }}>
        {PALS.map((p, i) => {
          const d = haversine(me, p);
          return (
            <div
              key={p.id}
              style={{ ...card, padding: 16, animation: `pp-in .5s ease both`, animationDelay: `${i * 90}ms` }}
            >
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <Avatar name={p.name} color={p.color} size={48} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                    <div>
                      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 18 }}>{p.name}</div>
                      <div className="pp-mono" style={{ fontSize: 12, color: C.sepia }}>
                        @{p.handle} · {flag(p.code)} {p.city}, {p.country}
                      </div>
                    </div>
                    <MatchBadge score={p.match} />
                  </div>
                  <div className="pp-mono" style={{ fontSize: 12, color: C.blue, marginTop: 8 }}>↔ {p.teach}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {p.topics.map((t) => (
                      <span key={t} className="pp-mono" style={{ ...chip, padding: "3px 9px", fontSize: 11 }}>{t}</span>
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                    <span className="pp-mono" style={{ fontSize: 12, color: C.sepia }}>
                      ✈ {d.toLocaleString()} km away
                    </span>
                    <button className="pp-btn" style={{ padding: "8px 16px" }} onClick={() => onPick(p)}>
                      Write a letter ✍
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ===========================================================================
   Scene 3 — Compose
   ========================================================================= */
function Compose({ me, pal, distance, onBack, onSend }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [stamp, setStamp] = useState(STAMPS[0]);
  const eta = etaText(distance);

  return (
    <div style={{ animation: "pp-in .5s ease both" }}>
      <button className="pp-btn pp-ghost" style={{ padding: "7px 13px", marginBottom: 14 }} onClick={onBack}>← Discover</button>
      <AirmailPanel>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <Eyebrow>To</Eyebrow>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              <Avatar name={pal.name} color={pal.color} size={40} />
              <div>
                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 17 }}>{pal.name}</div>
                <div className="pp-mono" style={{ fontSize: 12, color: C.sepia }}>{flag(pal.code)} {pal.city}, {pal.country}</div>
              </div>
            </div>
          </div>
          <div className="pp-mono" style={{ textAlign: "right", fontSize: 12, color: C.sepia }}>
            <div>{distance.toLocaleString()} km</div>
            <div style={{ color: C.red }}>~{eta} in transit</div>
          </div>
        </div>

        <div style={{ height: 1, background: C.edge, margin: "16px 0" }} />

        <Label>Subject</Label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Say hello…" style={input} />

        <Label>Your letter</Label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Tell them where you are, what the day looks like, what you're curious about…"
          style={{ ...input, minHeight: 130, lineHeight: 1.7, resize: "vertical" }}
        />

        <Label>Affix a stamp</Label>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {STAMPS.map((s) => (
            <button
              key={s.id}
              onClick={() => setStamp(s)}
              style={{
                background: "none", border: "none", cursor: "pointer", padding: 0,
                outline: stamp.id === s.id ? `2px solid ${C.blue}` : "none", outlineOffset: 3, borderRadius: 2,
              }}
              title={`${s.name} · ${s.rarity}`}
            >
              <StampGraphic stamp={s} size={52} />
            </button>
          ))}
        </div>

        <div style={{ marginTop: 22, display: "flex", alignItems: "center", gap: 14 }}>
          <button className="pp-btn" disabled={!subject.trim() || !body.trim()} onClick={() => onSend({ subject, body, stamp })}>
            Seal &amp; send →
          </button>
          <span className="pp-mono" style={{ fontSize: 11.5, color: C.sepia }}>
            It will be sealed until it lands.
          </span>
        </div>
      </AirmailPanel>
    </div>
  );
}

/* ===========================================================================
   Scene 4 — Transit (the hero moment)
   ========================================================================= */
function Transit({ me, pal, distance, letter, onArrived }) {
  // Demo travel time scaled from the real distance, kept watchable (7–15s).
  const total = Math.min(15, Math.max(7, Math.round(distance / 1100)));
  const [left, setLeft] = useState(total);
  const startedRef = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = (Date.now() - startedRef.current) / 1000;
      const remaining = Math.max(0, total - elapsed);
      setLeft(remaining);
      if (remaining <= 0) {
        clearInterval(id);
        setTimeout(onArrived, 700);
      }
    }, 100);
    return () => clearInterval(id);
  }, [total, onArrived]);

  const progress = 1 - left / total;

  return (
    <div style={{ animation: "pp-in .5s ease both" }}>
      <AirmailPanel>
        <div style={{ textAlign: "center" }}>
          <Eyebrow>On its way</Eyebrow>
          <h2 style={{ ...h2, marginTop: 6 }}>Your letter is travelling</h2>
          <p style={{ color: C.inkSoft, marginTop: 0 }}>
            {flag(me.code)} {me.city} &nbsp;→&nbsp; {flag(pal.code)} {pal.city}
          </p>
        </div>

        <FlightPath progress={progress} fromLabel={me.city} toLabel={pal.city} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <Metric label="Distance" value={`${distance.toLocaleString()} km`} />
          <Metric label="Sealed stamp" graphic={<StampGraphic stamp={letter.stamp} size={40} />} />
          <Metric label="Arrives in" value={fmt(left)} accent />
        </div>

        <div className="pp-mono" style={{ textAlign: "center", fontSize: 11.5, color: C.sepia, marginTop: 18 }}>
          In the real product this is hours or days, set by the true distance. Here it's sped up so you
          can watch the whole journey.
        </div>
      </AirmailPanel>
    </div>
  );
}

/* ===========================================================================
   Scene 5 — Read the reply
   ========================================================================= */
function ReadReply({ me, pal, distance, onRestart }) {
  return (
    <div style={{ animation: "pp-in .5s ease both" }}>
      <div className="pp-mono" style={{ textAlign: "center", color: C.ok, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>
        ✓ Delivered · a reply arrived
      </div>
      <article style={{ ...card, overflow: "hidden" }}>
        <div style={{ background: C.paper, borderBottom: `1px dashed ${C.edge}`, padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Avatar name={pal.name} color={pal.color} size={46} />
            <div>
              <div className="pp-mono" style={{ fontSize: 11, color: C.sepia }}>FROM</div>
              <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 17 }}>{pal.name}</div>
              <div className="pp-mono" style={{ fontSize: 12, color: C.sepia }}>{flag(pal.code)} {pal.city}, {pal.country}</div>
            </div>
          </div>
          <Postmark code={pal.code} />
        </div>

        <div style={{
          padding: "26px 30px 22px",
          backgroundImage: `repeating-linear-gradient(transparent, transparent 31px, rgba(43,76,126,.08) 31px, rgba(43,76,126,.08) 32px)`,
          backgroundPosition: "0 12px",
        }}>
          <h2 style={{ ...h2, fontSize: 22, marginBottom: 16 }}>A letter back</h2>
          <div style={{ fontSize: 17, lineHeight: "32px", whiteSpace: "pre-wrap" }}>{pal.reply}</div>
          <div style={{ marginTop: 22, paddingTop: 14, borderTop: `1px solid ${C.edge}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="pp-mono" style={{ fontSize: 11.5, color: C.sepia }}>Travelled {distance.toLocaleString()} km · arrived just now</span>
            <button className="pp-btn" onClick={onRestart}>Write to someone else →</button>
          </div>
        </div>
      </article>

      <div className="pp-mono" style={{ textAlign: "center", fontSize: 11.5, color: C.sepia, marginTop: 16 }}>
        That's the loop: discover → write → wait → read. Friends, communities, stamps and achievements
        grow from here.
      </div>
    </div>
  );
}

/* ===========================================================================
   Pieces
   ========================================================================= */
function FlightPath({ progress, fromLabel, toLabel }) {
  // a gentle arc from left to right; the plane rides offset-path along it,
  // and the red "travelled" stroke reveals as progress climbs from 0 → 1.
  const path = "M 30 130 Q 250 18 470 130";
  return (
    <div style={{ position: "relative", margin: "10px 0 4px" }}>
      <svg viewBox="0 0 500 160" style={{ width: "100%", height: "auto", display: "block" }}>
        {/* faint globe latitude lines */}
        {[58, 100, 142].map((y) => (
          <line key={y} x1="10" y1={y} x2="490" y2={y} stroke={C.edge} strokeWidth="1" />
        ))}
        {/* full route, faint dashed */}
        <path d={path} fill="none" stroke={C.sepia} strokeWidth="1.5" strokeDasharray="2 6" opacity="0.5" strokeLinecap="round" />
        {/* travelled portion — revealed via normalized dashoffset */}
        <path
          d={path}
          fill="none"
          stroke={C.red}
          strokeWidth="2.5"
          strokeLinecap="round"
          pathLength="1"
          strokeDasharray="1"
          strokeDashoffset={1 - progress}
          style={{ transition: "stroke-dashoffset .12s linear" }}
        />
        {/* endpoints */}
        <circle cx="30" cy="130" r="6" fill={C.blue} />
        <circle cx="470" cy="130" r="6" fill={C.red} opacity={progress > 0.98 ? 1 : 0.4} style={{ transition: "opacity .3s" }} />
        {/* plane riding the path */}
        <g style={{ offsetPath: `path('${path}')`, offsetRotate: "auto", offsetDistance: `${(progress * 100).toFixed(1)}%`, transition: "offset-distance .12s linear" }}>
          <text x="0" y="0" fontSize="19" textAnchor="middle" dominantBaseline="central">✈</text>
        </g>
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: -6 }}>
        <span className="pp-mono" style={{ fontSize: 11, color: C.blue }}>{fromLabel}</span>
        <span className="pp-mono" style={{ fontSize: 11, color: C.red }}>{toLabel}</span>
      </div>
    </div>
  );
}

function Metric({ label, value, graphic, accent }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div className="pp-mono" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.sepia, marginBottom: 6 }}>{label}</div>
      {graphic ? graphic : (
        <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 20, color: accent ? C.red : C.ink }}>{value}</div>
      )}
    </div>
  );
}

function Postmark({ code }) {
  const d = new Date();
  const mon = d.toLocaleString("en", { month: "short" }).toUpperCase();
  return (
    <div style={{
      width: 86, height: 86, border: `2.5px solid ${C.red}`, borderRadius: "50%",
      display: "grid", placeContent: "center", textAlign: "center", color: C.red,
      fontFamily: "'Courier Prime', monospace", transform: "rotate(-9deg)", flex: "none",
      animation: "pp-pop .6s ease both", position: "relative",
    }}>
      <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: "0.16em" }}>★ Par Avion ★</div>
      <div style={{ fontSize: 14, fontWeight: 700, margin: "2px 0" }}>{d.getDate()} {mon}</div>
      <div style={{ fontSize: 8, letterSpacing: "0.1em" }}>{code} · PENPAL</div>
    </div>
  );
}

function StampGraphic({ stamp, size = 52 }) {
  return (
    <div style={{ width: size, height: size * 1.18, position: "relative", background: C.paper2, padding: 3, borderRadius: 2, filter: "drop-shadow(0 1px 1px rgba(32,48,77,.18))" }}>
      <span style={{
        position: "absolute", inset: 0, background: C.paper2,
        WebkitMask: "radial-gradient(circle 2.4px at center, transparent 2px, #000 2.2px) 0 0 / 7px 7px",
        mask: "radial-gradient(circle 2.4px at center, transparent 2px, #000 2.2px) 0 0 / 7px 7px",
      }} />
      <span style={{
        position: "relative", display: "grid", placeItems: "center", width: "100%", height: "100%",
        border: `1.5px solid ${stamp.color}`, color: stamp.color, fontFamily: "'Courier Prime', monospace",
        background: hexA(stamp.color, 0.08),
      }}>
        <span style={{ fontSize: size * 0.42, lineHeight: 1 }}>{stamp.motif}</span>
      </span>
    </div>
  );
}

function MatchBadge({ score }) {
  return (
    <div style={{ textAlign: "center", flex: "none" }}>
      <div style={{
        fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 20,
        color: score >= 85 ? C.ok : C.blue,
      }}>{score}%</div>
      <div className="pp-mono" style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: C.sepia }}>match</div>
    </div>
  );
}

function Avatar({ name, color, size }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flex: "none",
      display: "grid", placeContent: "center", color: "#fff",
      fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: size * 0.4,
      background: `linear-gradient(135deg, ${color}, ${shade(color, -22)})`,
      boxShadow: "inset 0 0 0 2px rgba(255,255,255,.35)",
    }}>{initials}</div>
  );
}

function Toast({ icon, title, text }) {
  return (
    <div style={{
      position: "absolute", left: "50%", bottom: 22, transform: "translateX(-50%)",
      display: "flex", gap: 12, alignItems: "center", maxWidth: 380,
      background: C.ink, color: C.paper2, padding: "12px 16px", borderRadius: 10,
      boxShadow: "0 18px 48px rgba(32,48,77,.4)", border: `1px solid ${C.gold}`,
      animation: "pp-toast 4.2s ease both", zIndex: 20,
    }}>
      <div style={{ width: 38, height: 38, borderRadius: "50%", background: C.gold, color: "#2a1f0c", display: "grid", placeContent: "center", fontSize: 20, flex: "none" }}>{icon}</div>
      <div>
        <div className="pp-mono" style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold }}>{title}</div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 15, fontWeight: 500 }}>{text}</div>
      </div>
    </div>
  );
}

/* ---- small styled primitives ------------------------------------------- */
function AirmailPanel({ children, style }) {
  return (
    <div style={{ position: "relative", background: C.paper2, borderRadius: 14, ...style }}>
      <div style={{
        position: "absolute", inset: 6, borderRadius: 10, padding: 3, pointerEvents: "none",
        background: `repeating-linear-gradient(45deg, ${C.red} 0 11px, ${C.paper2} 11px 22px, ${C.blue} 22px 33px, ${C.paper2} 33px 44px)`,
        WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        WebkitMaskComposite: "xor", maskComposite: "exclude",
      }} />
      <div style={{ position: "relative", padding: "26px 28px" }}>{children}</div>
    </div>
  );
}
function Eyebrow({ children }) {
  return <div className="pp-mono" style={{ fontSize: 11, letterSpacing: "0.22em", textTransform: "uppercase", color: C.sepia }}>{children}</div>;
}
function Label({ children }) {
  return <div className="pp-mono" style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.sepia, margin: "16px 0 6px" }}>{children}</div>;
}

const h1 = { fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 30, lineHeight: 1.1, letterSpacing: "-0.01em", margin: "8px 0 6px" };
const h2 = { fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 26, lineHeight: 1.1, letterSpacing: "-0.01em", margin: "6px 0" };
const card = { background: C.paper2, border: `1px solid ${C.edge}`, borderRadius: 14, boxShadow: "0 1px 2px rgba(32,48,77,.1)" };
const input = { width: "100%", fontFamily: "'Spectral', serif", fontSize: 16, color: C.ink, background: C.paper, border: `1px solid ${C.edge}`, borderBottom: `2px solid ${C.sepia}`, borderRadius: "4px 4px 0 0", padding: "10px 12px", outline: "none" };
const chip = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "5px 11px", borderRadius: 999, border: `1px solid ${C.edge}`, background: C.paper, color: C.inkSoft };

/* ---- helpers ------------------------------------------------------------ */
function flag(code) {
  if (!code || code.length !== 2) return "🌍";
  return String.fromCodePoint(...code.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
function shade(hex, amt) {
  const n = parseInt(hex.replace("#", ""), 16);
  const cl = (v) => Math.max(0, Math.min(255, v));
  return `#${((cl((n >> 16) + amt) << 16) | (cl(((n >> 8) & 255) + amt) << 8) | cl((n & 255) + amt)).toString(16).padStart(6, "0")}`;
}
function hexA(hex, a) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
function fmt(seconds) {
  const s = Math.ceil(seconds);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}
function etaText(distanceKm) {
  const hours = Math.min(168, Math.max(2, Math.round(distanceKm / 140)));
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days} day${days > 1 ? "s" : ""}`;
}
