import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { api, ApiError } from "../api.js";
import { Field, Banner, flagOf } from "../components/ui.jsx";
import { AuthShell } from "./Login.jsx";

// A curated set of locations with real coordinates, so the distance-based
// delivery works without pulling in a geocoding dependency.
const CITIES = [
  { city: "Cairo", country: "Egypt", code: "EG", lat: 30.0444, lng: 31.2357 },
  { city: "London", country: "United Kingdom", code: "GB", lat: 51.5074, lng: -0.1278 },
  { city: "Paris", country: "France", code: "FR", lat: 48.8566, lng: 2.3522 },
  { city: "Berlin", country: "Germany", code: "DE", lat: 52.52, lng: 13.405 },
  { city: "Lisbon", country: "Portugal", code: "PT", lat: 38.7223, lng: -9.1393 },
  { city: "Tokyo", country: "Japan", code: "JP", lat: 35.6762, lng: 139.6503 },
  { city: "Seoul", country: "South Korea", code: "KR", lat: 37.5665, lng: 126.978 },
  { city: "Mumbai", country: "India", code: "IN", lat: 19.076, lng: 72.8777 },
  { city: "Nairobi", country: "Kenya", code: "KE", lat: -1.2864, lng: 36.8172 },
  { city: "Reykjavík", country: "Iceland", code: "IS", lat: 64.1466, lng: -21.9426 },
  { city: "São Paulo", country: "Brazil", code: "BR", lat: -23.5558, lng: -46.6396 },
  { city: "Buenos Aires", country: "Argentina", code: "AR", lat: -34.6037, lng: -58.3816 },
  { city: "Toronto", country: "Canada", code: "CA", lat: 43.6532, lng: -79.3832 },
  { city: "New York", country: "United States", code: "US", lat: 40.7128, lng: -74.006 },
  { city: "Sydney", country: "Australia", code: "AU", lat: -33.8688, lng: 151.2093 },
];

const LANGUAGES = [
  { code: "en", name: "English" }, { code: "ar", name: "Arabic" },
  { code: "fr", name: "French" }, { code: "es", name: "Spanish" },
  { code: "de", name: "German" }, { code: "pt", name: "Portuguese" },
  { code: "ja", name: "Japanese" }, { code: "ko", name: "Korean" },
  { code: "hi", name: "Hindi" }, { code: "sw", name: "Swahili" },
  { code: "is", name: "Icelandic" }, { code: "it", name: "Italian" },
];

const TOPICS = [
  { slug: "books", label: "Books" }, { slug: "travel", label: "Travel" },
  { slug: "music", label: "Music" }, { slug: "food", label: "Food" },
  { slug: "film", label: "Film" }, { slug: "history", label: "History" },
  { slug: "art", label: "Art" }, { slug: "nature", label: "Nature" },
  { slug: "languages", label: "Languages" }, { slug: "photography", label: "Photography" },
  { slug: "science", label: "Science" }, { slug: "gaming", label: "Gaming" },
];

const STEPS = ["Account", "Where", "Languages", "Interests"];

export default function Register() {
  const { register, refreshMe } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    email: "", password: "", display_name: "", handle: "",
    cityIdx: 0, bio: "",
    natives: ["en"], learning: [], topics: [],
  });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  function toggle(key, value) {
    set({ [key]: form[key].includes(value) ? form[key].filter((v) => v !== value) : [...form[key], value] });
  }

  function validateStep() {
    if (step === 0) {
      if (!form.email || !form.password || !form.display_name || !form.handle)
        return "Please fill in every field.";
      if (form.password.length < 8) return "Password needs at least 8 characters.";
      if (!/^[a-zA-Z0-9_]{3,}$/.test(form.handle)) return "Handle: 3+ letters, numbers or underscores.";
    }
    if (step === 2 && form.natives.length === 0) return "Pick at least one language you speak.";
    return "";
  }

  function next() {
    const v = validateStep();
    if (v) return setErr(v);
    setErr("");
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }
  function back() { setErr(""); setStep((s) => Math.max(0, s - 1)); }

  async function finish() {
    setErr("");
    setBusy(true);
    const loc = CITIES[form.cityIdx];
    try {
      // 1) create the account (core fields only)
      await register({
        email: form.email.trim(),
        password: form.password,
        display_name: form.display_name.trim(),
        handle: form.handle.trim(),
        country: loc.country,
        country_code: loc.code,
        city: loc.city,
        latitude: loc.lat,
        longitude: loc.lng,
      });
      // 2) enrich the profile (languages, topics, bio)
      const languages = [
        ...form.natives.map((c) => ({ ...lang(c), fluency: "native" })),
        ...form.learning.filter((c) => !form.natives.includes(c)).map((c) => ({ ...lang(c), fluency: "learning" })),
      ];
      await api.put("/profile", {
        bio: form.bio.trim(),
        languages,
        topics: form.topics.map((slug) => ({ slug, label: TOPICS.find((t) => t.slug === slug)?.label || slug })),
      });
      await refreshMe();
      navigate("/discover", { replace: true });
    } catch (ex) {
      if (ex instanceof ApiError && ex.status === 409) {
        setErr(typeof ex.detail === "string" ? ex.detail : "That email or handle is already taken.");
        setStep(0);
      } else {
        setErr("Could not create your account. Please try again.");
      }
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <div className="between" style={{ marginBottom: 14 }}>
        <div className="eyebrow">Join PenPal+ · {step + 1}/{STEPS.length}</div>
        <div className="row gap6">
          {STEPS.map((s, i) => (
            <span key={s} title={s} style={{
              width: 22, height: 4, borderRadius: 2,
              background: i <= step ? "var(--postal-red)" : "var(--paper-edge)",
            }} />
          ))}
        </div>
      </div>

      <Banner kind="err">{err}</Banner>

      {step === 0 && (
        <>
          <h2 style={{ marginBottom: 4 }}>Address your envelope</h2>
          <p className="muted" style={{ fontSize: "0.93rem" }}>The basics, so letters know where to find you.</p>
          <Field label="Display name">
            <input className="input" value={form.display_name} onChange={(e) => set({ display_name: e.target.value })} placeholder="Layla Hassan" />
          </Field>
          <Field label="Handle" hint="how pen pals find you · letters, numbers, underscores">
            <input className="input" value={form.handle} onChange={(e) => set({ handle: e.target.value.replace(/\s/g, "") })} placeholder="wanderer" />
          </Field>
          <Field label="Email">
            <input className="input" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="you@example.com" />
          </Field>
          <Field label="Password" hint="at least 8 characters">
            <input className="input" type="password" value={form.password} onChange={(e) => set({ password: e.target.value })} />
          </Field>
        </>
      )}

      {step === 1 && (
        <>
          <h2 style={{ marginBottom: 4 }}>Where do you write from?</h2>
          <p className="muted" style={{ fontSize: "0.93rem" }}>
            This sets how far your letters travel — and how long they take to arrive.
          </p>
          <Field label="Your city">
            <select className="input" value={form.cityIdx} onChange={(e) => set({ cityIdx: Number(e.target.value) })}>
              {CITIES.map((c, i) => (
                <option key={c.city} value={i}>{`${c.city}, ${c.country}`}</option>
              ))}
            </select>
          </Field>
          <div className="center-text" style={{ fontSize: "2.4rem", margin: "6px 0" }}>
            {flagOf(CITIES[form.cityIdx].code)}
          </div>
          <Field label="A line about you" hint="optional — your first impression">
            <textarea className="textarea" style={{ minHeight: 90 }} value={form.bio}
              onChange={(e) => set({ bio: e.target.value })}
              placeholder="Tea-drinker, slow reader, always curious about how mornings look somewhere else." />
          </Field>
        </>
      )}

      {step === 2 && (
        <>
          <h2 style={{ marginBottom: 4 }}>Languages</h2>
          <p className="muted" style={{ fontSize: "0.93rem" }}>Speaking and learning — we match teachers with learners.</p>
          <Field label="I speak fluently">
            <ChipGrid options={LANGUAGES.map((l) => [l.code, l.name])} selected={form.natives} onToggle={(c) => toggle("natives", c)} variant="teach" />
          </Field>
          <Field label="I'm learning">
            <ChipGrid options={LANGUAGES.map((l) => [l.code, l.name])} selected={form.learning} onToggle={(c) => toggle("learning", c)} variant="learn" />
          </Field>
        </>
      )}

      {step === 3 && (
        <>
          <h2 style={{ marginBottom: 4 }}>What do you love?</h2>
          <p className="muted" style={{ fontSize: "0.93rem" }}>Pick a few — they help us find kindred spirits.</p>
          <ChipGrid options={TOPICS.map((t) => [t.slug, t.label])} selected={form.topics} onToggle={(s) => toggle("topics", s)} />
        </>
      )}

      <div className="row gap10" style={{ marginTop: 22 }}>
        {step > 0 && <button className="btn btn-ghost" onClick={back} disabled={busy}>Back</button>}
        {step < STEPS.length - 1 ? (
          <button className="btn grow" onClick={next}>Continue</button>
        ) : (
          <button className="btn btn-red grow" onClick={finish} disabled={busy}>
            {busy ? "Sealing the envelope…" : "Start writing"}
          </button>
        )}
      </div>

      <hr className="divider" />
      <p className="center-text muted mb0" style={{ fontSize: "0.92rem" }}>
        Already have a mailbox? <Link to="/login">Sign in →</Link>
      </p>
    </AuthShell>
  );
}

function lang(code) {
  const l = LANGUAGES.find((x) => x.code === code);
  return { code, name: l ? l.name : code };
}

function ChipGrid({ options, selected, onToggle, variant }) {
  return (
    <div className="row wrap gap6">
      {options.map(([value, label]) => {
        const on = selected.includes(value);
        return (
          <button
            type="button"
            key={value}
            onClick={() => onToggle(value)}
            className={`chip selectable ${on ? "on" : ""}`}
            style={on && variant === "teach" ? { background: "var(--ok)", borderColor: "var(--ok)", color: "#fff" } : undefined}
          >
            {on ? "✓ " : ""}{label}
          </button>
        );
      })}
    </div>
  );
}
