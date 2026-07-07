import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { Avatar, Spinner, Empty, Banner, flagOf } from "../components/ui.jsx";
import WorldMap from "../components/WorldMap.jsx";

export default function Journey() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get("/journey").then(setData).catch(() => setError("Couldn't load your journey right now."));
  }, []);

  if (error) return <Banner kind="err">{error}</Banner>;
  if (!data) return <Spinner label="Charting your routes" />;

  const { home, pins, stats } = data;
  const selectedPin = pins.find((p) => p.user_id === selected) || null;

  return (
    <div className="stack">
      <div>
        <div className="eyebrow">Every letter, mapped</div>
        <h1 className="mb0">Your journey</h1>
        <p className="muted">
          Everywhere your words have travelled from {home.city}, {home.country}.
        </p>
      </div>

      <div className="grid cols3">
        <StatCard label="Distance travelled" value={`${Math.round(stats.total_km).toLocaleString()} km`} />
        <StatCard label="Countries reached" value={stats.countries_count} />
        <StatCard label="Pen pals written to" value={stats.correspondents_count} />
      </div>

      {pins.length === 0 ? (
        <Empty icon="🗺" title="Your map is still blank">
          Write your first letter and it'll appear here, tracing a line straight to them.{" "}
          <Link to="/discover">Find someone to write to.</Link>
        </Empty>
      ) : (
        <>
          <WorldMap home={home} pins={pins} selectedId={selected} onSelect={setSelected} />

          {stats.farthest ? (
            <p className="mono muted center-text" style={{ fontSize: "0.8rem" }}>
              ✈ Farthest letter: {flagOf(stats.farthest.country_code)} {stats.farthest.display_name} in{" "}
              {stats.farthest.country} — {Math.round(stats.farthest.distance_km).toLocaleString()} km
            </p>
          ) : null}

          <div className="grid cols2" style={{ marginTop: 4 }}>
            {[...pins].sort((a, b) => b.distance_km - a.distance_km).map((p) => (
              <button
                key={p.user_id}
                className="card card-pad row center gap12"
                style={{
                  textAlign: "left", cursor: "pointer", width: "100%",
                  outline: selected === p.user_id ? "2px solid var(--postal-red)" : "none",
                }}
                onClick={() => setSelected(p.user_id === selected ? null : p.user_id)}
              >
                <Avatar name={p.display_name} color={p.avatar_color} size={44} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="between">
                    <div style={{ fontWeight: 600 }}>
                      {p.display_name} {p.is_friend ? <span title="Friend">🤝</span> : null}
                    </div>
                    <Link to={`/profile/${p.user_id}`} className="btn btn-ghost btn-sm" onClick={(e) => e.stopPropagation()}>
                      Profile
                    </Link>
                  </div>
                  <div className="mono" style={{ fontSize: "0.72rem", color: "var(--sepia)" }}>
                    {flagOf(p.country_code)} {p.city}, {p.country} · {Math.round(p.distance_km).toLocaleString()} km ·{" "}
                    {p.letters_count} {p.letters_count === 1 ? "letter" : "letters"}
                  </div>
                  {p.stamp_codes?.length ? (
                    <div className="mono" style={{ fontSize: "0.66rem", color: "var(--sepia)", marginTop: 2 }}>
                      {p.stamp_codes.length} stamp{p.stamp_codes.length > 1 ? "s" : ""} exchanged
                    </div>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="card card-pad center-text">
      <div style={{ fontFamily: "var(--font-display)", fontSize: "1.7rem", fontWeight: 600 }}>{value}</div>
      <div className="mono" style={{ fontSize: "0.7rem", color: "var(--sepia)", marginTop: 2 }}>{label}</div>
    </div>
  );
}
