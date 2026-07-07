import { Link } from "react-router-dom";
import { Avatar, Postmark, TransitTracker, flagOf } from "./ui.jsx";

// A single envelope in a list. `box` is "inbox" or "sent" and decides which
// party (sender/recipient) is the counterpart shown.
export default function LetterCard({ letter, box = "inbox" }) {
  const party = box === "inbox" ? letter.sender : letter.recipient;
  const inTransit = letter.state === "in_transit";
  const unread = box === "inbox" && letter.state === "delivered" && !letter.read_at;

  return (
    <Link
      to={`/letters/${letter.id}`}
      className="card"
      style={{
        display: "block",
        padding: "16px 18px",
        textDecoration: "none",
        color: "inherit",
        position: "relative",
        borderLeft: unread ? "4px solid var(--postal-red)" : undefined,
      }}
    >
      <div className="between" style={{ alignItems: "flex-start" }}>
        <div className="row center gap10" style={{ minWidth: 0 }}>
          <Avatar name={party?.display_name} color={party?.avatar_color} size={42} />
          <div style={{ minWidth: 0 }}>
            <div className="mono" style={{ fontSize: "0.72rem", color: "var(--sepia)" }}>
              {box === "inbox" ? "FROM" : "TO"} · {flagOf(party?.country_code)} {party?.country}
            </div>
            <div style={{ fontWeight: 600, fontFamily: "var(--font-display)", fontSize: "1.05rem" }}>
              {party?.display_name}
            </div>
          </div>
        </div>
        {unread ? (
          <span
            className="mono"
            style={{
              fontSize: "0.62rem",
              background: "var(--postal-red)",
              color: "#fff",
              padding: "2px 7px",
              borderRadius: 999,
              letterSpacing: "0.1em",
            }}
          >
            NEW
          </span>
        ) : null}
      </div>

      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "1.08rem",
          fontWeight: inTransit ? 400 : unread ? 600 : 500,
          marginTop: 10,
          fontStyle: inTransit ? "italic" : "normal",
          color: inTransit ? "var(--sepia)" : "var(--ink)",
        }}
      >
        {inTransit ? "✶ A letter is on its way…" : letter.subject || "(no subject)"}
      </div>

      {inTransit ? (
        <div style={{ marginTop: 8 }}>
          <TransitTracker distanceKm={letter.distance_km} etaSeconds={letter.eta_seconds} />
        </div>
      ) : (
        <div className="between" style={{ marginTop: 8 }}>
          <span className="mono" style={{ fontSize: "0.74rem", color: "var(--sepia)" }}>
            {Math.round(letter.distance_km).toLocaleString()} km travelled
          </span>
          {letter.delivered_at ? (
            <span className="mono" style={{ fontSize: "0.72rem", color: "var(--sepia)" }}>
              {new Date(letter.delivered_at).toLocaleDateString("en", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          ) : null}
        </div>
      )}
    </Link>
  );
}
