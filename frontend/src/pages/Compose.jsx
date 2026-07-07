import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, ApiError } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Avatar, Stamp, Field, Banner, Spinner, flagOf } from "../components/ui.jsx";

export default function Compose() {
  const { recipientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [recipient, setRecipient] = useState(null);
  const [recipients, setRecipients] = useState(null); // when no id, pick from suggestions/friends
  const [stamps, setStamps] = useState([]);
  const [chosenStamp, setChosenStamp] = useState(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const mine = await api.get("/stamps/mine").catch(() => []);
        if (active) {
          setStamps(mine);
          setChosenStamp(mine[0]?.stamp?.id ?? null);
        }
        if (recipientId) {
          const p = await api.get(`/profile/${recipientId}`);
          if (active) setRecipient(p);
        } else {
          const sug = await api.get("/discover/suggestions").catch(() => []);
          if (active) setRecipients(sug.map((c) => c.profile));
        }
      } catch {
        if (active) setErr("Couldn't load this page.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [recipientId]);

  async function send() {
    if (!recipient) return setErr("Choose who you're writing to.");
    if (!body.trim()) return setErr("Your letter is empty.");
    setErr("");
    setBusy(true);
    try {
      const letter = await api.post("/letters", {
        recipient_id: recipient.user_id ?? recipient.id,
        subject: subject.trim() || "(no subject)",
        body: body.trim(),
        stamp_id: chosenStamp,
      });
      navigate(`/letters/${letter.id}`, { replace: true });
    } catch (ex) {
      if (ex instanceof ApiError && ex.status === 403) {
        setErr(typeof ex.detail === "string" ? ex.detail : "You've reached the limit of letters in transit. Upgrade to PenPal+ for unlimited.");
      } else {
        setErr("Couldn't send your letter. Please try again.");
      }
      setBusy(false);
    }
  }

  if (loading) return <Spinner label="Fetching your stationery" />;

  // recipient picker (no id in URL)
  if (!recipient) {
    return (
      <div className="stack">
        <div>
          <div className="eyebrow">New letter</div>
          <h1 className="mb0">Who are you writing to?</h1>
          <p className="muted">Pick a suggested pen pal, or find someone in <Link to="/discover">Discover</Link>.</p>
        </div>
        <Banner kind="err">{err}</Banner>
        <div className="grid cols2">
          {(recipients || []).map((p) => (
            <button key={p.user_id} className="card card-pad" style={{ textAlign: "left", cursor: "pointer" }}
              onClick={() => setRecipient(p)}>
              <div className="row center gap10">
                <Avatar name={p.display_name} color={p.avatar_color} size={46} />
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 600 }}>{p.display_name}</div>
                  <div className="mono" style={{ fontSize: "0.74rem", color: "var(--sepia)" }}>
                    {flagOf(p.country_code)} {p.city}, {p.country}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const fromCity = user?.profile?.city;
  const r = recipient;

  return (
    <div className="stack" style={{ maxWidth: 760, margin: "0 auto" }}>
      <div className="between">
        <div>
          <div className="eyebrow">Composing a letter</div>
          <h1 className="mb0">Dear {r.display_name.split(" ")[0]}…</h1>
        </div>
        {recipientId ? null : (
          <button className="btn btn-ghost btn-sm" onClick={() => setRecipient(null)}>Change</button>
        )}
      </div>

      {/* envelope header: from → to */}
      <div className="card card-pad">
        <div className="between wrap gap10">
          <div className="row center gap10">
            <Avatar name={user?.profile?.display_name} color={user?.profile?.avatar_color} size={40} />
            <div className="mono" style={{ fontSize: "0.78rem" }}>
              <div style={{ color: "var(--sepia)" }}>FROM</div>
              <div>{flagOf(user?.profile?.country_code)} {fromCity}</div>
            </div>
          </div>
          <div style={{ color: "var(--sepia)", fontFamily: "var(--font-mono)" }}>✈ — — —➤</div>
          <div className="row center gap10">
            <div className="mono" style={{ fontSize: "0.78rem", textAlign: "right" }}>
              <div style={{ color: "var(--sepia)" }}>TO</div>
              <div>{flagOf(r.country_code)} {r.city}, {r.country}</div>
            </div>
            <Avatar name={r.display_name} color={r.avatar_color} size={40} />
          </div>
        </div>
      </div>

      <Banner kind="err">{err}</Banner>

      {/* the letter sheet */}
      <div className="airmail-edge">
        <div style={{ position: "relative", padding: "26px 28px" }}>
          <Field label="Subject">
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="A hello from afar" maxLength={140} />
          </Field>
          <Field label="Your letter">
            <textarea
              className="textarea"
              style={{ minHeight: 240, fontSize: "1.05rem", lineHeight: 1.8, background: "var(--paper-2)" }}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={`Write something worth the wait.\n\nThere's no rush — this letter will take real time to reach ${r.city}.`}
            />
          </Field>
          <div className="mono" style={{ fontSize: "0.72rem", color: "var(--sepia)", textAlign: "right" }}>
            {body.trim().split(/\s+/).filter(Boolean).length} words
          </div>
        </div>
      </div>

      {/* stamp picker */}
      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 10 }}>Affix a stamp</div>
        {stamps.length === 0 ? (
          <p className="muted mb0" style={{ fontSize: "0.92rem" }}>
            You don't have any stamps yet — you can still send this letter, or collect some in <Link to="/stamps">Stamps</Link>.
          </p>
        ) : (
          <div className="row wrap gap10">
            {stamps.map((us) => {
              const on = chosenStamp === us.stamp.id;
              return (
                <button key={us.stamp.id} onClick={() => setChosenStamp(on ? null : us.stamp.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 3, borderRadius: 6, outline: on ? "2px solid var(--postal-blue)" : "2px solid transparent" }}
                  title={us.stamp.name}>
                  <Stamp stamp={us.stamp} size={56} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="between wrap gap10">
        <p className="mono mb0" style={{ fontSize: "0.78rem", color: "var(--sepia)", maxWidth: 420 }}>
          ✈ Once sent, your letter travels the real distance to {r.city}. {r.display_name.split(" ")[0]} won't see it until it lands.
        </p>
        <button className="btn btn-red" onClick={send} disabled={busy}>
          {busy ? "Posting…" : "Seal & send ✉"}
        </button>
      </div>
    </div>
  );
}
