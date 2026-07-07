import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import { Spinner } from "./components/ui.jsx";
import Layout from "./components/Layout.jsx";

import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Discover from "./pages/Discover.jsx";
import Profile from "./pages/Profile.jsx";
import Compose from "./pages/Compose.jsx";
import Inbox from "./pages/Inbox.jsx";
import LetterDetail from "./pages/LetterDetail.jsx";
import Friends from "./pages/Friends.jsx";
import Stamps from "./pages/Stamps.jsx";
import Achievements from "./pages/Achievements.jsx";
import Premium from "./pages/Premium.jsx";
import Communities from "./pages/Communities.jsx";
import Journey from "./pages/Journey.jsx";

function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner label="Opening your mailbox" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (user) return <Navigate to="/discover" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />

      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/discover" element={<Discover />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/:id" element={<Profile />} />
        <Route path="/compose" element={<Compose />} />
        <Route path="/compose/:recipientId" element={<Compose />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/letters/:id" element={<LetterDetail />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/stamps" element={<Stamps />} />
        <Route path="/achievements" element={<Achievements />} />
        <Route path="/premium" element={<Premium />} />
        <Route path="/communities" element={<Communities />} />
        <Route path="/communities/:id" element={<Communities />} />
        <Route path="/journey" element={<Journey />} />
      </Route>

      <Route path="/" element={<Navigate to="/discover" replace />} />
      <Route path="*" element={<Navigate to="/discover" replace />} />
    </Routes>
  );
}
