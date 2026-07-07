import { useEffect, useState } from "react";

/* ---- country flag emoji from ISO code ---------------------------------- */
export function flagOf(code) {
  if (!code || code.length !== 2) return "🌍";
  const base = 0x1f1e6;
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map((c) => base + (c.charCodeAt(0) - 65))
  );
}

/* ---- seeded avatar (no external service, no dependency) ----------------- */
export function Avatar({ name = "", color = "#2b4c7e", size = 46 }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(135deg, ${color}, ${shade(color, -22)})`,
      }}
      aria-hidden="true"
    >
      {initials || "✶"}
    </div>
  );
}

function shade(hex, amt) {
  const n = parseInt(hex.replace("#", ""), 16);
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const r = clamp((n >> 16) + amt);
  const g = clamp(((n >> 8) & 0xff) + amt);
  const b = clamp((n & 0xff) + amt);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/* ---- postage stamp ------------------------------------------------------ */
const RARITY_LABEL = { common: "", uncommon: "", rare: "RARE", epic: "EPIC", legendary: "LEGEND" };

export function Stamp({ stamp, size = 64, canceled = false }) {
  if (!stamp) return null;
  const color = stamp.color || "#2b4c7e";
  return (
    <div
      title={`${stamp.name}${stamp.rarity ? " · " + stamp.rarity : ""}`}
      style={{
        width: size,
        height: size * 1.18,
        position: "relative",
        flex: "none",
        background: "var(--paper-2)",
        padding: 4,
        borderRadius: 2,
        // perforated edge via radial mask
        filter: "drop-shadow(0 1px 1px rgba(32,48,77,0.18))",
      }}
    >
      <span
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--paper-2)",
          WebkitMask:
            "radial-gradient(circle 2.6px at center, transparent 2.2px, #000 2.4px) 0 0 / 8px 8px",
          mask: "radial-gradient(circle 2.6px at center, transparent 2.2px, #000 2.4px) 0 0 / 8px 8px",
        }}
      />
      <span
        style={{
          position: "relative",
          display: "grid",
          placeItems: "center",
          width: "100%",
          height: "100%",
          border: `1.5px solid ${color}`,
          borderRadius: 1,
          background: `linear-gradient(160deg, ${hexA(color, 0.12)}, ${hexA(color, 0.02)})`,
          color,
          fontFamily: "var(--font-mono)",
        }}
      >
        <span style={{ fontSize: size * 0.42, lineHeight: 1 }}>{stamp.motif || "✉"}</span>
        {RARITY_LABEL[stamp.rarity] ? (
          <span style={{ fontSize: size * 0.12, letterSpacing: "0.1em", marginTop: 2 }}>
            {RARITY_LABEL[stamp.rarity]}
          </span>
        ) : null}
        {canceled ? (
          <span
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "repeating-linear-gradient(115deg, transparent 0 9px, rgba(178,58,46,0.42) 9px 11px)",
            }}
          />
        ) : null}
      </span>
    </div>
  );
}

function hexA(hex, a) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 0xff}, ${n & 0xff}, ${a})`;
}

/* ---- postmark (circular date stamp over delivered mail) ----------------- */
export function Postmark({ date, location = "PENPAL" }) {
  const d = date ? new Date(date) : new Date();
  const mon = d.toLocaleString("en", { month: "short" }).toUpperCase();
  return (
    <div className="postmark" aria-label={`Postmarked ${d.toDateString()}`}>
      <span className="pm-top">★ Par Avion ★</span>
      <span className="pm-date">{`${d.getDate()} ${mon}`}</span>
      <span className="pm-loc">{location}</span>
    </div>
  );
}

/* ---- live countdown ----------------------------------------------------- */
export function useCountdown(seconds) {
  const [left, setLeft] = useState(Math.max(0, Math.floor(seconds || 0)));
  useEffect(() => {
    setLeft(Math.max(0, Math.floor(seconds || 0)));
    if (!seconds || seconds <= 0) return;
    const id = setInterval(() => setLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [seconds]);
  return left;
}

export function fmtDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/* ---- transit tracker (distance + animated ETA) -------------------------- */
export function TransitTracker({ distanceKm, etaSeconds, totalSeconds }) {
  const left = useCountdown(etaSeconds);
  const total = totalSeconds || etaSeconds || 1;
  const progress = Math.min(1, Math.max(0, 1 - left / total));
  const pct = `${(progress * 100).toFixed(1)}%`;
  return (
    <div className="tracker">
      <div className="between" style={{ fontSize: "0.78rem", color: "var(--sepia)" }}>
        <span>{Math.round(distanceKm).toLocaleString()} km</span>
        <span>{left > 0 ? `arrives in ${fmtDuration(left)}` : "arriving…"}</span>
      </div>
      <div className="track-line" aria-hidden>
        <span className="endpoint start" />
        <span className="plane" style={{ left: pct }}>✈</span>
        <span className="endpoint end" />
      </div>
    </div>
  );
}

/* ---- form field --------------------------------------------------------- */
export function Field({ label, children, hint }) {
  return (
    <div className="field">
      {label ? <label>{label}</label> : null}
      {children}
      {hint ? (
        <div className="mono" style={{ fontSize: "0.7rem", color: "var(--sepia)", marginTop: 4 }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

/* ---- misc --------------------------------------------------------------- */
export function Banner({ kind = "err", children }) {
  if (!children) return null;
  return <div className={`banner ${kind}`}>{children}</div>;
}

export function Spinner({ label = "Loading" }) {
  return (
    <div className="empty">
      <span className="spin" style={{ fontSize: "1.6rem" }}>✦</span>
      <div className="mono" style={{ marginTop: 8, fontSize: "0.8rem" }}>{label}…</div>
    </div>
  );
}

export function Empty({ icon = "✉", title, children }) {
  return (
    <div className="empty">
      <span className="stamp-emoji">{icon}</span>
      {title ? <h3 style={{ color: "var(--ink)" }}>{title}</h3> : null}
      {children ? <p className="mb0">{children}</p> : null}
    </div>
  );
}
