import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Stamp, Spinner, Banner, flagOf } from "../components/ui.jsx";

export default function Stamps() {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState(null);
  const [mine, setMine] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    const [cat, owned] = await Promise.all([
      api.get("/stamps").catch(() => []),
      api.get("/stamps/mine").catch(() => []),
    ]);
    setCatalog(cat);
    setMine(owned);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const ownedIds = new Set(mine.map((u) => u.stamp.id));

  async function claim(stamp) {
    setBusy(stamp.id);
    setMsg("");
    try {
      await api.post(`/stamps/${stamp.id}/claim`);
      setMsg(`“${stamp.name}” added to your collection.`);
      await load();
    } catch (e) {
      setMsg(e instanceof ApiError ? String(e.detail) : "Could not claim that stamp.");
    }
    setBusy(null);
  }

  if (catalog === null) return <Spinner label="Opening the stamp drawer" />;

  const collectable = catalog.filter((s) => !ownedIds.has(s.id));

  return (
    <div>
      <div className="eyebrow">Philately</div>
      <h1>Stamp collection</h1>
      <p className="muted" style={{ marginTop: -6 }}>
        Affix a stamp to a letter before you send it. Rare and premium stamps are earned, traded, or
        unlocked with Plus.
      </p>

      <Banner kind={msg.includes("added") ? "ok" : "err"}>{msg}</Banner>

      <h3 style={{ marginTop: 22 }}>Your drawer · {mine.length}</h3>
      {mine.length === 0 ? (
        <p className="muted">Empty for now. Claim a few below to get started.</p>
      ) : (
        <div className="row wrap gap16" style={{ marginTop: 8 }}>
          {mine.map((u) => (
            <figure key={u.stamp.id} style={{ margin: 0, textAlign: "center", width: 92 }}>
              <Stamp stamp={u.stamp} size={72} />
              <figcaption className="mono" style={{ fontSize: "0.66rem", color: "var(--sepia)", marginTop: 6 }}>
                {u.stamp.name}
                {u.quantity > 1 ? ` ×${u.quantity}` : ""}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <hr className="divider" />

      <h3>Available to collect</h3>
      <div className="grid cols3" style={{ marginTop: 8 }}>
        {collectable.map((s) => {
          const locked = s.premium_only && !user?.is_premium;
          return (
            <div key={s.id} className="card card-pad row center gap16">
              <Stamp stamp={s} size={64} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{s.name}</div>
                <div className="mono" style={{ fontSize: "0.7rem", color: "var(--sepia)" }}>
                  {flagOf(s.country_code)} {s.country} · {s.rarity}
                </div>
                <button
                  className={`btn btn-sm ${locked ? "btn-gold" : ""}`}
                  style={{ marginTop: 8 }}
                  disabled={busy === s.id}
                  onClick={() => (locked ? (window.location.href = "/premium") : claim(s))}
                >
                  {locked ? "Plus only" : busy === s.id ? "Claiming…" : "Claim"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {collectable.length === 0 ? (
        <p className="muted">You've collected every stamp currently on offer. A true philatelist.</p>
      ) : null}
    </div>
  );
}
