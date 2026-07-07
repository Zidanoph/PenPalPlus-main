import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth.jsx";
import {
  Avatar,
  Postmark,
  Stamp,
  TransitTracker,
  Spinner,
  Banner,
  flagOf,
} from "../components/ui.jsx";

export default function LetterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [letter, setLetter] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setLetter(await api.get(`/letters/${id}`));
    } catch (e) {
      setError(e.status === 404 ? "That letter could not be found." : "Could not open this letter.");
      setLetter(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // While a letter is in transit, poll so it flips to delivered live.
  useEffect(() => {
    if (letter && letter.state === "in_transit") {
      const t = setInterval(load, 5000);
      return () => clearInterval(t);
    }
  }, [letter, load]);

  if (letter === null) return <Spinner label="Fetching the letter" />;
  if (letter === false)
    return (
      <div>
        <Banner kind="err">{error}</Banner>
        <Link to="/inbox" className="btn btn-ghost">← Back to mailbox</Link>
      </div>
    );

  const iAmRecipient = letter.recipient?.user_id === user?.id;
  const counterpart = iAmRecipient ? letter.sender : letter.recipient;
  const inTransit = letter.state === "in_transit";

  async function toggleSave() {
    setSaving(true);
    try {
      setLetter(await api.post(`/letters/${letter.id}/save`));
    } catch { /* ignore */ }
    setSaving(false);
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <div className="between" style={{ marginBottom: 16 }}>
        <Link to="/inbox" className="btn btn-ghost btn-sm">← Mailbox</Link>
        {!inTransit && iAmRecipient ? (
          <button className="btn btn-ghost btn-sm" onClick={toggleSave} disabled={saving}>
            {letter.saved ? "★ Saved" : "☆ Save letter"}
          </button>
        ) : null}
      </div>

      {inTransit ? (
        <InTransitView letter={letter} counterpart={counterpart} iAmRecipient={iAmRecipient} />
      ) : (
        <DeliveredView
          letter={letter}
          counterpart={counterpart}
          iAmRecipient={iAmRecipient}
          onReply={() => navigate(`/compose/${counterpart.user_id}`)}
        />
      )}
    </div>
  );
}

function InTransitView({ letter, counterpart, iAmRecipient }) {
  return (
    <div className="airmail-edge" style={{ padding: 30 }}>
      <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
        <div className="eyebrow">{iAmRecipient ? "Incoming" : "On its way"}</div>
        <div style={{ fontSize: "3rem", margin: "10px 0" }}>✈</div>
        <h2 className="mb0">
          {iAmRecipient
            ? `A letter from ${counterpart.display_name} is in transit`
            : `Your letter to ${counterpart.display_name} is travelling`}
        </h2>
        <p className="muted" style={{ marginTop: 8 }}>
          {flagOf(counterpart.country_code)} {counterpart.country} ·{" "}
          {Math.round(letter.distance_km).toLocaleString()} km away
        </p>
        <div style={{ maxWidth: 380, margin: "22px auto 6px" }}>
          <TransitTracker distanceKm={letter.distance_km} etaSeconds={letter.eta_seconds} />
        </div>
        <p className="mono" style={{ fontSize: "0.74rem", color: "var(--sepia)", marginTop: 16 }}>
          {iAmRecipient
            ? "The contents stay sealed until it arrives. Patience is the point."
            : "It will be sealed until it reaches them. This page updates itself."}
        </p>
      </div>
    </div>
  );
}

function DeliveredView({ letter, counterpart, iAmRecipient, onReply }) {
  return (
    <article className="card" style={{ overflow: "hidden" }}>
      {/* envelope header band */}
      <div
        style={{
          background: "var(--paper)",
          borderBottom: "1px dashed var(--paper-edge)",
          padding: "18px 24px",
        }}
      >
        <div className="between" style={{ alignItems: "flex-start" }}>
          <div className="row center gap10">
            <Avatar name={counterpart.display_name} color={counterpart.avatar_color} size={50} />
            <div>
              <div className="mono" style={{ fontSize: "0.7rem", color: "var(--sepia)" }}>
                {iAmRecipient ? "FROM" : "TO"}
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "1.15rem", fontWeight: 600 }}>
                <Link
                  to={`/profile/${counterpart.user_id}`}
                  style={{ color: "var(--ink)", textDecoration: "none" }}
                >
                  {counterpart.display_name}
                </Link>
              </div>
              <div className="mono" style={{ fontSize: "0.74rem", color: "var(--sepia)" }}>
                @{counterpart.handle} · {flagOf(counterpart.country_code)} {counterpart.country}
              </div>
            </div>
          </div>
          <div className="row gap10" style={{ alignItems: "flex-start" }}>
            {letter.stamp ? <Stamp stamp={letter.stamp} size={58} canceled /> : null}
            <Postmark date={letter.delivered_at || letter.sent_at} location={counterpart.country_code || "PENPAL"} />
          </div>
        </div>
      </div>

      {/* letter body, on ruled paper */}
      <div
        style={{
          padding: "30px 34px 26px",
          backgroundImage:
            "repeating-linear-gradient(transparent, transparent 31px, rgba(43,76,126,0.08) 31px, rgba(43,76,126,0.08) 32px)",
          backgroundPosition: "0 14px",
        }}
      >
        <h1 style={{ fontSize: "1.7rem", marginBottom: 18 }}>{letter.subject || "(no subject)"}</h1>
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "1.12rem",
            lineHeight: "32px",
            whiteSpace: "pre-wrap",
          }}
        >
          {letter.body}
        </div>

        <div
          className="between"
          style={{ marginTop: 28, paddingTop: 16, borderTop: "1px solid var(--paper-edge)" }}
        >
          <span className="mono" style={{ fontSize: "0.72rem", color: "var(--sepia)" }}>
            Travelled {Math.round(letter.distance_km).toLocaleString()} km ·{" "}
            {new Date(letter.delivered_at || letter.sent_at).toLocaleDateString("en", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
          {iAmRecipient ? (
            <button className="btn" onClick={onReply}>Write back ✍</button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
