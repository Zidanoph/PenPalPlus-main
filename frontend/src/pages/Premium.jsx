import { useEffect, useState, useCallback } from "react";
import { api, ApiError } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Spinner, Banner } from "../components/ui.jsx";

function money(cents, currency) {
  if (!cents) return "Free";
  const amount = (cents / 100).toFixed(2).replace(/\.00$/, "");
  const sign = currency === "USD" || !currency ? "$" : currency + " ";
  return `${sign}${amount}`;
}

export default function Premium() {
  const { user, refreshMe } = useAuth();
  const [plans, setPlans] = useState(null);
  const [sub, setSub] = useState(null);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const [p, s] = await Promise.all([
      api.get("/plans").catch(() => []),
      api.get("/subscriptions/me").catch(() => null),
    ]);
    setPlans(p);
    setSub(s);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function subscribe(plan) {
    setBusy(plan.id);
    setMsg("");
    try {
      await api.post("/subscriptions", { plan_id: plan.id });
      await Promise.all([refreshMe(), load()]);
      setMsg(`You're on ${plan.name}. Welcome to Plus ✦`);
    } catch (e) {
      setMsg(e instanceof ApiError ? String(e.detail) : "Payment could not be completed.");
    }
    setBusy(null);
  }

  async function cancel() {
    setBusy("cancel");
    try {
      await api.post("/subscriptions/cancel");
      await Promise.all([refreshMe(), load()]);
      setMsg("Your plan was cancelled. You'll keep Plus until the period ends.");
    } catch { setMsg("Could not cancel right now."); }
    setBusy(null);
  }

  if (plans === null) return <Spinner label="Fetching the plans" />;

  return (
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      <div className="center-text">
        <div className="eyebrow">Support slow mail</div>
        <h1 className="mb0">PenPal+ Plus</h1>
        <p className="muted" style={{ maxWidth: 520, margin: "8px auto 0" }}>
          The free post is generous. Plus lifts the limits, opens premium stamps, and helps keep the
          letters travelling — no ads, ever.
        </p>
      </div>

      <Banner kind={msg.includes("Welcome") || msg.includes("cancelled") ? "ok" : "err"}>{msg}</Banner>

      {user?.is_premium && sub ? (
        <div className="airmail-edge" style={{ padding: 22, margin: "18px 0" }}>
          <div className="between" style={{ position: "relative", zIndex: 1 }}>
            <div>
              <div className="eyebrow">Active plan</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", fontWeight: 600 }}>
                {sub.plan?.name} <span style={{ color: "var(--seal-gold)" }}>✦</span>
              </div>
              {sub.current_period_end ? (
                <div className="mono" style={{ fontSize: "0.74rem", color: "var(--sepia)" }}>
                  Renews {new Date(sub.current_period_end).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              ) : null}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={cancel} disabled={busy === "cancel"}>
              {busy === "cancel" ? "…" : "Cancel plan"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid cols3" style={{ marginTop: 22 }}>
        {plans.map((plan) => {
          const isCurrent = sub?.plan?.id === plan.id;
          const free = !plan.price_cents;
          const featured = plan.code?.includes("yearly");
          return (
            <div
              key={plan.id}
              className={featured ? "airmail-edge" : "card"}
              style={{ padding: featured ? 4 : 0, display: "flex" }}
            >
              <div
                className={featured ? "" : "card-pad"}
                style={{
                  position: "relative",
                  zIndex: 1,
                  padding: featured ? "24px 22px" : undefined,
                  background: featured ? "var(--paper-2)" : undefined,
                  borderRadius: featured ? 10 : undefined,
                  display: "flex",
                  flexDirection: "column",
                  width: "100%",
                }}
              >
                {featured ? (
                  <div className="mono" style={{ fontSize: "0.62rem", color: "var(--postal-red)", letterSpacing: "0.18em", marginBottom: 6 }}>
                    BEST VALUE
                  </div>
                ) : null}
                <h3 className="mb0">{plan.name}</h3>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 600, margin: "8px 0 2px" }}>
                  {money(plan.price_cents, plan.currency)}
                </div>
                <div className="mono" style={{ fontSize: "0.7rem", color: "var(--sepia)" }}>
                  {free ? "forever" : `per ${plan.interval}`}
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: "16px 0", flexGrow: 1 }}>
                  {(plan.features || []).map((f, i) => (
                    <li key={i} className="row gap6" style={{ marginBottom: 8, fontSize: "0.95rem" }}>
                      <span style={{ color: "var(--ok)" }}>✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className={`btn ${featured ? "btn-gold" : free ? "btn-ghost" : ""}`}
                  disabled={free || isCurrent || busy === plan.id}
                  onClick={() => subscribe(plan)}
                >
                  {isCurrent ? "Current plan" : free ? "Included" : busy === plan.id ? "Processing…" : "Choose plan"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mono center-text" style={{ fontSize: "0.68rem", color: "var(--sepia)", marginTop: 18 }}>
        Demo checkout — no real payment is taken.
      </p>
    </div>
  );
}
