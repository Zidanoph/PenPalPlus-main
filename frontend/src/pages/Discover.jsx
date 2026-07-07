import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { Avatar, Spinner, Empty, Banner, flagOf } from "../components/ui.jsx";

const DISTANCE = [
  { key: "any", label: "Anywhere" },
  { key: "near", label: "Near me" },
  { key: "far", label: "Far away" },
];

export default function Discover() {
  const navigate = useNavigate();
  const [cards, setCards] = useState(null);
  const [err, setErr] = useState("");
  const [query, setQuery] = useState("");
  const [distance, setDistance] = useState("any");
  const [busy, setBusy] = useState(false);

  async function load(opts = {}) {
    setBusy(true);
    setErr("");
    try {
      const q = opts.query ?? query;
      const d = opts.distance ?? distance;
      let data;
      if (!q && d === "any") {
        data = await api.get("/discover/suggestions");
      } else {
        data = await api.post("/discover/filter", {
          query: q || null,
          distance: d,
          limit: 24,
        });
      }
      setCards(data);
    } catch {
      setErr("Couldn't load suggestions right now.");
      setCards([]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="stack">
      <div>
        <div className="eyebrow">Find a correspondent</div>
        <h1 className="mb0">Discover pen pals</h1>
        <p className="muted">Ranked by what you share — languages, interests, and the distance you prefer.</p>
      </div>

      <div className="card card-pad">
        <div className="row gap10 wrap center">
          <input
            className="input grow"
            style={{ minWidth: 200 }}
            placeholder="Search by name, country, or interest…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
          <div className="row gap6">
            {DISTANCE.map((d) => (
              <button
                key={d.key}
                className={`chip selectable ${distance === d.key ? "on" : ""}`}
                onClick={() => { setDistance(d.key); load({ distance: d.key }); }}
              >
                {d.label}
              </button>
            ))}
          </div>
          <button className="btn btn-sm" onClick={() => load()} disabled={busy}>Search</button>
        </div>
      </div>

      <Banner kind="err">{err}</Banner>

      {cards === null || busy ? (
        <Spinner label="Sorting the mailbags" />
      ) : cards.length === 0 ? (
        <Empty icon="🔍" title="No pen pals match that yet">Try widening your search or choosing “Anywhere”.</Empty>
      ) : (
        <div className="grid cols2">
          {cards.map((c) => (
            <PenPalCard key={c.profile.user_id} card={c} onWrite={() => navigate(`/compose/${c.profile.user_id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function PenPalCard({ card, onWrite }) {
  const p = card.profile;
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "18px 20px 14px" }}>
        <div className="between" style={{ alignItems: "flex-start" }}>
          <div className="row center gap10">
            <Avatar name={p.display_name} color={p.avatar_color} size={52} />
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "1.15rem" }}>
                {p.display_name} {p.is_premium ? <span title="PenPal+ member" style={{ color: "var(--seal-gold)" }}>✦</span> : null}
              </div>
              <div className="mono" style={{ fontSize: "0.74rem", color: "var(--sepia)" }}>
                {flagOf(p.country_code)} {p.city}, {p.country}
              </div>
            </div>
          </div>
          <MatchBadge score={card.match_score} />
        </div>

        {p.bio ? (
          <p style={{ fontSize: "0.96rem", margin: "12px 0 0", color: "var(--ink-soft)" }}>
            {p.bio.length > 130 ? p.bio.slice(0, 130) + "…" : p.bio}
          </p>
        ) : null}

        {card.teach_learn?.length ? (
          <div className="row wrap gap6" style={{ marginTop: 12 }}>
            {card.teach_learn.slice(0, 3).map((t, i) => (
              <span key={i} className={`chip ${/learn/i.test(t) ? "learn" : "teach"}`}>{t}</span>
            ))}
          </div>
        ) : null}

        {card.shared_topics?.length ? (
          <div className="mono" style={{ fontSize: "0.74rem", color: "var(--sepia)", marginTop: 10 }}>
            shared: {card.shared_topics.join(" · ")}
          </div>
        ) : null}
      </div>

      <div className="between" style={{ marginTop: "auto", padding: "12px 20px", borderTop: "1px solid var(--paper-edge)", background: "var(--paper)" }}>
        <span className="mono" style={{ fontSize: "0.72rem", color: "var(--sepia)" }}>
          {Math.round(card.distance_km).toLocaleString()} km away
        </span>
        <div className="row gap6">
          <Link to={`/profile/${p.user_id}`} className="btn btn-ghost btn-sm">Profile</Link>
          <button className="btn btn-sm" onClick={onWrite}>Write</button>
        </div>
      </div>
    </div>
  );
}

function MatchBadge({ score }) {
  const color = score >= 70 ? "var(--ok)" : score >= 45 ? "var(--seal-gold)" : "var(--sepia)";
  return (
    <div style={{ textAlign: "center", flex: "none" }} title="Match score">
      <div style={{
        width: 46, height: 46, borderRadius: "50%",
        display: "grid", placeContent: "center",
        border: `2px solid ${color}`, color,
        fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "0.92rem",
      }}>
        {score}
      </div>
      <div className="mono" style={{ fontSize: "0.58rem", color: "var(--sepia)", marginTop: 2, letterSpacing: "0.1em" }}>MATCH</div>
    </div>
  );
}
