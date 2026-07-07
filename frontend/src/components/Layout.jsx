import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { api } from "../api.js";
import { Avatar } from "./ui.jsx";

const LINKS = [
  { to: "/discover", label: "Discover" },
  { to: "/inbox", label: "Mailbox" },
  { to: "/compose", label: "Write" },
  { to: "/journey", label: "Journey" },
  { to: "/friends", label: "Friends" },
  { to: "/communities", label: "Communities" },
  { to: "/stamps", label: "Stamps" },
  { to: "/premium", label: "Premium" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    const poll = () =>
      api
        .get("/notifications/unread-count")
        .then((d) => active && setUnread(d?.count || 0))
        .catch(() => {});
    poll();
    const id = setInterval(poll, 20000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/discover" className="brand">
            <span aria-hidden>✉</span> PenPal<span className="plus">+</span>
          </NavLink>
          <nav className="nav">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                {l.label}
                {l.to === "/inbox" && unread > 0 ? (
                  <span className="badge">{unread > 9 ? "9+" : unread}</span>
                ) : null}
              </NavLink>
            ))}
            <NavLink
              to="/profile"
              className={({ isActive }) => (isActive ? "active" : "")}
              style={{ display: "flex", alignItems: "center", gap: 7 }}
              title={user?.profile?.display_name}
            >
              <Avatar
                name={user?.profile?.display_name}
                color={user?.profile?.avatar_color}
                size={24}
              />
              <span className="hide-sm">{user?.profile?.handle}</span>
            </NavLink>
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: "rgba(251,246,234,0.8)", borderColor: "rgba(251,246,234,0.3)" }}
              onClick={async () => {
                await logout();
                navigate("/login");
              }}
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <main className="page">
        <Outlet context={{ refreshUnread: () => api.get("/notifications/unread-count").then((d) => setUnread(d?.count || 0)).catch(() => {}) }} />
      </main>
    </div>
  );
}
