import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { Avatar, Field, Spinner, Empty, Banner } from "../components/ui.jsx";

export default function Communities() {
  const { id } = useParams();
  if (id) return <CommunityRoom key={id} id={Number(id)} />;
  return <CommunityList />;
}

/* ---- list of communities ----------------------------------------------- */
function CommunityList() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => api.get("/communities").then(setItems).catch(() => setItems([])), []);
  useEffect(() => { load(); }, [load]);

  async function toggleJoin(c) {
    setBusy(c.id);
    try {
      const updated = await api.post(`/communities/${c.id}/join`);
      setItems((list) => list.map((x) => (x.id === c.id ? updated : x)));
    } catch { /* ignore */ }
    setBusy(null);
  }

  if (items === null) return <Spinner label="Gathering the circles" />;

  return (
    <div>
      <div className="eyebrow">Gather round</div>
      <h1>Communities</h1>
      <p className="muted" style={{ marginTop: -6 }}>
        Slower than a feed, warmer than a forum — shared corners for languages, places and pastimes.
      </p>
      <div className="grid cols2" style={{ marginTop: 18 }}>
        {items.map((c) => (
          <div key={c.id} className="card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ height: 8, background: c.color || "var(--postal-blue)" }} />
            <div className="card-pad" style={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
              <div className="between">
                <h3 className="mb0">{c.name}</h3>
                <span className="mono" style={{ fontSize: "0.7rem", color: "var(--sepia)" }}>{c.member_count} members</span>
              </div>
              <p className="muted" style={{ fontSize: "0.95rem", flexGrow: 1 }}>{c.description}</p>
              <div className="row gap6">
                <button className="btn btn-sm" onClick={() => navigate(`/communities/${c.id}`)}>Open</button>
                <button
                  className={`btn btn-sm ${c.joined ? "btn-ghost" : ""}`}
                  disabled={busy === c.id}
                  onClick={() => toggleJoin(c)}
                >
                  {c.joined ? "✓ Joined" : "Join"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- a single community's posts ---------------------------------------- */
function CommunityRoom({ id }) {
  const navigate = useNavigate();
  const [community, setCommunity] = useState(null);
  const [posts, setPosts] = useState(null);
  const [draft, setDraft] = useState({ title: "", body: "" });
  const [msg, setMsg] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    const all = await api.get("/communities").catch(() => []);
    setCommunity(all.find((c) => c.id === id) || false);
    setPosts(await api.get(`/communities/${id}/posts`).catch(() => []));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function submitPost() {
    if (!draft.title.trim() || !draft.body.trim()) {
      setMsg("Give your post a title and a few words.");
      return;
    }
    setPosting(true);
    setMsg("");
    try {
      await api.post(`/communities/${id}/posts`, draft);
      setDraft({ title: "", body: "" });
      await load();
    } catch (e) {
      setMsg(e.status === 403 ? "Join this community to post." : "Could not publish your post.");
    }
    setPosting(false);
  }

  if (community === null || posts === null) return <Spinner label="Opening the room" />;
  if (community === false)
    return (
      <div>
        <Banner kind="err">That community could not be found.</Banner>
        <button className="btn btn-ghost" onClick={() => navigate("/communities")}>← All communities</button>
      </div>
    );

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate("/communities")} style={{ marginBottom: 14 }}>← All communities</button>
      <div className="card" style={{ overflow: "hidden", marginBottom: 18 }}>
        <div style={{ height: 10, background: community.color || "var(--postal-blue)" }} />
        <div className="card-pad">
          <h1 className="mb0">{community.name}</h1>
          <p className="muted mb0">{community.description}</p>
        </div>
      </div>

      {community.joined ? (
        <div className="card card-pad stack" style={{ marginBottom: 18 }}>
          <div className="eyebrow">Share something</div>
          <Field label="Title">
            <input className="input" value={draft.title} maxLength={120}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
          </Field>
          <Field label="Your note">
            <textarea className="textarea" value={draft.body} maxLength={2000} style={{ minHeight: 90 }}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} />
          </Field>
          <Banner kind="err">{msg}</Banner>
          <div><button className="btn" onClick={submitPost} disabled={posting}>{posting ? "Posting…" : "Post"}</button></div>
        </div>
      ) : (
        <Banner kind="ok">Join this community from the list to start posting.</Banner>
      )}

      {posts.length === 0 ? (
        <Empty icon="📝" title="No posts yet">Be the first to write something here.</Empty>
      ) : (
        <div className="stack">
          {posts.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      )}
    </div>
  );
}

function PostCard({ post }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadComments() {
    if (!open) setComments(await api.get(`/posts/${post.id}/comments`).catch(() => []));
    setOpen((o) => !o);
  }

  async function addComment() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await api.post(`/posts/${post.id}/comments`, { body: text });
      setText("");
      setComments(await api.get(`/posts/${post.id}/comments`).catch(() => []));
    } catch { /* ignore */ }
    setBusy(false);
  }

  return (
    <article className="card card-pad">
      <div className="row center gap10" style={{ marginBottom: 8 }}>
        <Avatar name={post.author.display_name} color={post.author.avatar_color} size={34} />
        <div className="mono" style={{ fontSize: "0.72rem", color: "var(--sepia)" }}>
          {post.author.display_name} · {new Date(post.created_at).toLocaleDateString("en", { day: "numeric", month: "short" })}
        </div>
      </div>
      <h3 className="mb0">{post.title}</h3>
      <p style={{ whiteSpace: "pre-wrap" }}>{post.body}</p>
      <button className="btn btn-ghost btn-sm" onClick={loadComments}>
        {open ? "Hide" : "Show"} comments{post.comment_count ? ` · ${post.comment_count}` : ""}
      </button>

      {open ? (
        <div style={{ marginTop: 12, borderTop: "1px solid var(--paper-edge)", paddingTop: 12 }}>
          {comments === null ? (
            <span className="muted mono" style={{ fontSize: "0.8rem" }}>Loading…</span>
          ) : (
            (comments || []).map((c) => (
              <div key={c.id} style={{ marginBottom: 10 }}>
                <span className="mono" style={{ fontSize: "0.7rem", color: "var(--sepia)" }}>{c.author.display_name}</span>
                <div>{c.body}</div>
              </div>
            ))
          )}
          <div className="row gap6" style={{ marginTop: 8 }}>
            <input className="input" placeholder="Add a comment…" value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addComment()} />
            <button className="btn btn-sm" onClick={addComment} disabled={busy}>Send</button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
