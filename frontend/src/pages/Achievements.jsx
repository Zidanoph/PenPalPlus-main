import { useEffect, useState } from "react";
import { api } from "../api.js";
import { Spinner, Empty } from "../components/ui.jsx";

export default function Achievements() {
  const [items, setItems] = useState(null);

  useEffect(() => {
    api.get("/achievements").then(setItems).catch(() => setItems([]));
  }, []);

  if (items === null) return <Spinner label="Polishing the badges" />;

  const unlocked = items.filter((a) => a.unlocked);
  const locked = items.filter((a) => !a.unlocked);

  return (
    <div>
      <div className="eyebrow">Milestones</div>
      <h1>Achievements</h1>
      <p className="muted" style={{ marginTop: -6 }}>
        Earned for showing up and writing — {unlocked.length} of {items.length} unlocked.
      </p>

      {items.length === 0 ? (
        <Empty icon="🏅" title="Nothing here yet">
          Start writing letters and your first badge will appear.
        </Empty>
      ) : (
        <div className="grid cols2" style={{ marginTop: 18 }}>
          {[...unlocked, ...locked].map((a) => (
            <div
              key={a.code}
              className="card card-pad row center gap16"
              style={{ opacity: a.unlocked ? 1 : 0.55 }}
            >
              <div
                aria-hidden
                style={{
                  width: 56,
                  height: 56,
                  flex: "none",
                  display: "grid",
                  placeItems: "center",
                  fontSize: "1.7rem",
                  borderRadius: "50%",
                  background: a.unlocked ? "var(--seal-gold)" : "var(--paper)",
                  color: a.unlocked ? "#2a1f0c" : "var(--sepia)",
                  border: a.unlocked ? "none" : "1px dashed var(--paper-edge)",
                  filter: a.unlocked ? "none" : "grayscale(1)",
                }}
              >
                {a.unlocked ? a.icon || "✦" : "🔒"}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontFamily: "var(--font-display)" }}>{a.name}</div>
                <div className="muted" style={{ fontSize: "0.9rem" }}>{a.description}</div>
                {a.unlocked && a.unlocked_at ? (
                  <div className="mono" style={{ fontSize: "0.66rem", color: "var(--seal-gold)", marginTop: 4 }}>
                    Earned {new Date(a.unlocked_at).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
