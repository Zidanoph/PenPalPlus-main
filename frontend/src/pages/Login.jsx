import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { ApiError } from "../api.js";
import { Field, Banner } from "../components/ui.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const dest = location.state?.from?.pathname || "/discover";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e?.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate(dest, { replace: true });
    } catch (ex) {
      setErr(ex instanceof ApiError && ex.status === 401 ? "Wrong email or password." : "Could not sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function demo() {
    setEmail("demo@penpal.app");
    setPassword("password123");
  }

  return (
    <AuthShell>
      <div className="eyebrow" style={{ marginBottom: 6 }}>Welcome back</div>
      <h2 style={{ marginBottom: 4 }}>Open your mailbox</h2>
      <p className="muted" style={{ fontSize: "0.95rem" }}>
        Sign in to read what's arrived and answer the letters waiting for you.
      </p>

      <Banner kind="err">{err}</Banner>

      <form onSubmit={submit}>
        <Field label="Email">
          <input
            className="input"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </Field>
        <Field label="Password">
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <button className="btn" style={{ width: "100%" }} disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <button className="btn btn-ghost btn-sm" style={{ width: "100%", marginTop: 10 }} onClick={demo}>
        Fill demo account
      </button>

      <hr className="divider" />
      <p className="center-text muted mb0" style={{ fontSize: "0.92rem" }}>
        New here? <Link to="/register">Get your first stamp →</Link>
      </p>
    </AuthShell>
  );
}

/* Shared two-column auth canvas used by Login + Register. */
export function AuthShell({ children }) {
  return (
    <div className="shell">
      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "minmax(0,1.05fr) minmax(320px, 460px)",
          minHeight: "100vh",
        }}
        className="auth-grid"
      >
        <AuthHero />
        <div style={{ display: "grid", placeItems: "center", padding: "32px 22px", background: "var(--paper)" }}>
          <div className="airmail-edge" style={{ width: "100%", maxWidth: 400 }}>
            <div style={{ position: "relative", padding: "34px 30px" }}>{children}</div>
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 860px) {
          .auth-grid { grid-template-columns: 1fr !important; }
          .auth-hero { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function AuthHero() {
  return (
    <div
      className="auth-hero"
      style={{
        background: "var(--ink)",
        color: "var(--paper-2)",
        padding: "60px 56px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        borderRight: "3px solid var(--postal-red)",
      }}
    >
      {/* faint route lines in the background */}
      <svg
        viewBox="0 0 600 400"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.14 }}
        aria-hidden
      >
        <path d="M40 320 Q 220 80 560 120" fill="none" stroke="#fbf6ea" strokeWidth="1.5" strokeDasharray="5 7" />
        <path d="M70 90 Q 300 260 540 300" fill="none" stroke="#b23a2e" strokeWidth="1.5" strokeDasharray="5 7" />
        <circle cx="40" cy="320" r="5" fill="#fbf6ea" />
        <circle cx="560" cy="120" r="5" fill="#b23a2e" />
        <circle cx="70" cy="90" r="5" fill="#fbf6ea" />
        <circle cx="540" cy="300" r="5" fill="#b23a2e" />
      </svg>

      <div style={{ position: "relative", maxWidth: 460 }}>
        <div className="brand" style={{ fontSize: "1.7rem", marginBottom: 26 }}>
          <span aria-hidden>✉</span> PenPal<span className="plus">+</span>
        </div>
        <h1 style={{ fontSize: "clamp(2.2rem, 4vw, 3.2rem)", color: "var(--paper-2)", lineHeight: 1.05 }}>
          Letters worth the wait.
        </h1>
        <p style={{ fontSize: "1.12rem", color: "rgba(251,246,234,0.82)", lineHeight: 1.6 }}>
          Write to a stranger across the world. Their reply travels the real
          distance home — hours, sometimes days — so every envelope that lands in
          your mailbox actually means something.
        </p>
        <div className="row gap16 wrap" style={{ marginTop: 22, fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "rgba(251,246,234,0.7)" }}>
          <span>✈ distance-based delivery</span>
          <span>🗺 pen pals in 11 countries</span>
          <span>📮 collectible stamps</span>
        </div>
      </div>
    </div>
  );
}
