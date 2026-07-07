import { useEffect, useState, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "../api.js";
import { useAuth } from "../auth.jsx";
import { Avatar, Field, Banner, Spinner, flagOf } from "../components/ui.jsx";

const FLUENCY_TONE = { native: "teach", fluent: "teach", learning: "learn" };

export default function Profile() {
  const { id } = useParams();
  const { user, refreshMe } = useAuth();
  const navigate = useNavigate();
  const isSelf = !id || String(id) === String(user?.id);

  if (isSelf) return <SelfProfile user={user} refreshMe={refreshMe} />;
  return <OtherProfile key={id} id={id} navigate={navigate} />;
}

/* ---- another pen pal's profile ----------------------------------------- */
function OtherProfile({ id, navigate }) {
  const [p, setP] = useState(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    setP(null);
    api
      .get(`/profile/${id}`)
      .then(setP)
      .catch((e) => {
        setError(e.status === 404 ? "No such pen pal." : "Could not load this profile.");
        setP(false);
      });
  }, [id]);

  if (p === null) return <Spinner label="Looking them up" />;
  if (p === false)
    return (
      <div>
        <Banner kind="err">{error}</Banner>
        <Link to="/discover" className="btn btn-ghost">← Back to Discover</Link>
      </div>
    );

  async function addFriend() {
    setNote("");
    try {
      await api.post(`/friends/request/${p.user_id}`);
      setNote("Friend request sent.");
    } catch (e) {
      setNote(e instanceof ApiError ? String(e.detail) : "Could not send request.");
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <Link to="/discover" className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}>← Discover</Link>
      <ProfileHeader p={p} />
      {p.bio ? <p style={{ fontSize: "1.12rem", marginTop: 18 }}>{p.bio}</p> : null}
      <LangTopicBlocks languages={p.languages} topics={p.topics} />
      <Banner kind={note.includes("sent") ? "ok" : "err"}>{note}</Banner>
      <div className="row gap10" style={{ marginTop: 18 }}>
        <button className="btn" onClick={() => navigate(`/compose/${p.user_id}`)}>Write a letter ✍</button>
        <button className="btn btn-ghost" onClick={addFriend}>Add friend</button>
      </div>
    </div>
  );
}

/* ---- editable own profile ---------------------------------------------- */
function SelfProfile({ user, refreshMe }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!user) return;
    setForm({
      display_name: user.profile.display_name || "",
      bio: user.profile.bio || "",
      city: user.profile.city || "",
      country: user.profile.country || "",
      avatar_color: user.profile.avatar_color || "#2b4c7e",
    });
  }, [user]);

  const settings = user?.settings;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    setSaving(true);
    setMsg("");
    try {
      await api.put("/profile", form);
      await refreshMe();
      setMsg("Saved.");
    } catch {
      setMsg("Could not save changes.");
    }
    setSaving(false);
  }

  async function toggleSetting(key) {
    try {
      await api.put("/profile/settings", { [key]: !settings[key] });
      await refreshMe();
    } catch { /* ignore */ }
  }

  if (!form) return <Spinner />;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div className="eyebrow">Your record</div>
      <h1>Profile &amp; settings</h1>

      <div className="card card-pad stack">
        <div className="row center gap16">
          <Avatar name={form.display_name} color={form.avatar_color} size={72} />
          <div className="grow">
            <div className="mono" style={{ fontSize: "0.74rem", color: "var(--sepia)" }}>
              @{user.profile.handle} · {flagOf(user.profile.country_code)} {form.country || "—"}
              {user.is_premium ? " · ✦ Plus member" : ""}
            </div>
            <Field label="Avatar colour">
              <input
                type="color"
                value={form.avatar_color}
                onChange={set("avatar_color")}
                style={{ width: 54, height: 34, border: "1px solid var(--paper-edge)", borderRadius: 4, background: "none" }}
              />
            </Field>
          </div>
        </div>

        <Field label="Display name">
          <input className="input" value={form.display_name} onChange={set("display_name")} />
        </Field>
        <div className="grid cols2">
          <Field label="City"><input className="input" value={form.city} onChange={set("city")} /></Field>
          <Field label="Country"><input className="input" value={form.country} onChange={set("country")} /></Field>
        </div>
        <Field label="About you" hint="A few honest lines. This is what pen pals read first.">
          <textarea className="textarea" value={form.bio} onChange={set("bio")} maxLength={600} />
        </Field>

        <Banner kind={msg === "Saved." ? "ok" : "err"}>{msg}</Banner>
        <div className="row gap10">
          <button className="btn" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
          <Link to="/achievements" className="btn btn-ghost">View achievements</Link>
        </div>
      </div>

      <LangTopicBlocks languages={user.languages} topics={user.topics} editableHint />

      {settings ? (
        <div className="card card-pad" style={{ marginTop: 18 }}>
          <h3>Preferences</h3>
          {[
            ["discoverable", "Show me in Discover", "Let others find you as a pen pal."],
            ["notify_on_delivery", "Notify me when mail arrives", "A nudge the moment a letter lands."],
            ["auto_translate", "Offer translations", "Surface a translation for letters in other languages."],
          ].map(([key, label, desc]) => (
            <label key={key} className="between" style={{ padding: "10px 0", borderTop: "1px solid var(--paper-edge)", cursor: "pointer" }}>
              <span>
                <div style={{ fontWeight: 500 }}>{label}</div>
                <div className="muted" style={{ fontSize: "0.86rem" }}>{desc}</div>
              </span>
              <input type="checkbox" checked={!!settings[key]} onChange={() => toggleSetting(key)} style={{ width: 20, height: 20 }} />
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ---- shared bits -------------------------------------------------------- */
function ProfileHeader({ p }) {
  return (
    <div className="row center gap16">
      <Avatar name={p.display_name} color={p.avatar_color} size={78} />
      <div>
        <h1 className="mb0">
          {p.display_name} {p.is_premium ? <span style={{ color: "var(--seal-gold)", fontSize: "0.7em" }}>✦</span> : null}
        </h1>
        <div className="mono" style={{ color: "var(--sepia)", fontSize: "0.85rem" }}>
          @{p.handle} · {flagOf(p.country_code)} {p.city ? `${p.city}, ` : ""}{p.country}
        </div>
      </div>
    </div>
  );
}

function LangTopicBlocks({ languages = [], topics = [], editableHint }) {
  return (
    <div className="grid cols2" style={{ marginTop: 18 }}>
      <div className="card card-pad">
        <div className="eyebrow">Languages</div>
        <div className="row wrap gap6" style={{ marginTop: 10 }}>
          {languages.length ? (
            languages.map((l) => (
              <span key={l.code + l.name} className={`chip ${FLUENCY_TONE[l.fluency] || ""}`}>
                {l.name}
                <span style={{ opacity: 0.7 }}>· {l.fluency}</span>
              </span>
            ))
          ) : (
            <span className="muted">None listed{editableHint ? " yet — add some above." : "."}</span>
          )}
        </div>
      </div>
      <div className="card card-pad">
        <div className="eyebrow">Interests</div>
        <div className="row wrap gap6" style={{ marginTop: 10 }}>
          {topics.length ? (
            topics.map((t) => <span key={t.slug} className="chip">{t.label}</span>)
          ) : (
            <span className="muted">None listed.</span>
          )}
        </div>
      </div>
    </div>
  );
}
