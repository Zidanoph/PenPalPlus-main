import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { Avatar, Spinner, Empty, Banner, flagOf } from "../components/ui.jsx";

export default function Friends() {
  const navigate = useNavigate();
  const [friends, setFriends] = useState(null);
  const [requests, setRequests] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    const [f, r] = await Promise.all([
      api.get("/friends").catch(() => []),
      api.get("/friends/requests").catch(() => []),
    ]);
    setFriends(f);
    setRequests(r);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const incoming = requests.filter((r) => r.direction === "incoming");
  const outgoing = requests.filter((r) => r.direction === "outgoing");

  async function respond(req, accept) {
    setBusy(req.id);
    setMsg("");
    try {
      await api.post(`/friends/requests/${req.id}/respond?accept=${accept}`);
      setMsg(accept ? `You and ${req.other.display_name} are now friends.` : "Request declined.");
      await load();
    } catch {
      setMsg("Could not update that request.");
    }
    setBusy(null);
  }

  if (friends === null) return <Spinner label="Gathering your circle" />;

  return (
    <div>
      <div className="eyebrow">Your circle</div>
      <h1>Friends</h1>

      <Banner kind={msg.includes("friends") ? "ok" : "err"}>{msg}</Banner>

      {incoming.length > 0 ? (
        <section style={{ marginBottom: 26 }}>
          <h3>Pen pal requests</h3>
          <div className="grid" style={{ gap: 12 }}>
            {incoming.map((r) => (
              <div key={r.id} className="card card-pad between">
                <div className="row center gap10">
                  <Avatar name={r.other.display_name} color={r.other.avatar_color} size={42} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.other.display_name}</div>
                    <div className="mono" style={{ fontSize: "0.72rem", color: "var(--sepia)" }}>
                      {flagOf(r.other.country_code)} {r.other.country} · wants to connect
                    </div>
                  </div>
                </div>
                <div className="row gap6">
                  <button className="btn btn-sm" disabled={busy === r.id} onClick={() => respond(r, true)}>Accept</button>
                  <button className="btn btn-ghost btn-sm" disabled={busy === r.id} onClick={() => respond(r, false)}>Decline</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h3>Friends · {friends.length}</h3>
        {friends.length === 0 ? (
          <Empty icon="🤝" title="No friends yet">
            Reply to a letter or accept a request — correspondents become friends here.{" "}
            <Link to="/discover">Find someone to write to.</Link>
          </Empty>
        ) : (
          <div className="grid cols2" style={{ gap: 12 }}>
            {friends.map((f) => (
              <div key={f.profile.user_id} className="card card-pad between">
                <Link
                  to={`/profile/${f.profile.user_id}`}
                  className="row center gap10"
                  style={{ textDecoration: "none", color: "inherit", minWidth: 0 }}
                >
                  <Avatar name={f.profile.display_name} color={f.profile.avatar_color} size={42} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{f.profile.display_name}</div>
                    <div className="mono" style={{ fontSize: "0.72rem", color: "var(--sepia)" }}>
                      {flagOf(f.profile.country_code)} @{f.profile.handle}
                    </div>
                  </div>
                </Link>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/compose/${f.profile.user_id}`)}>Write</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {outgoing.length > 0 ? (
        <section style={{ marginTop: 26 }}>
          <h3 className="muted">Sent requests · {outgoing.length}</h3>
          <div className="row wrap gap6">
            {outgoing.map((r) => (
              <span key={r.id} className="chip">
                {flagOf(r.other.country_code)} {r.other.display_name} · pending
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
