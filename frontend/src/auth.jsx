import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setTokens, clearTokens, hasSession, getRefreshToken } from "./api.js";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(hasSession());

  const refreshMe = useCallback(async () => {
    try {
      const me = await api.get("/profile/me");
      setUser(me);
      return me;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    if (hasSession()) {
      refreshMe().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [refreshMe]);

  const login = useCallback(async (email, password) => {
    const tokens = await api.login(email, password);
    setTokens(tokens.access_token, tokens.refresh_token);
    return refreshMe();
  }, [refreshMe]);

  const register = useCallback(async (payload) => {
    const tokens = await api.register(payload);
    setTokens(tokens.access_token, tokens.refresh_token);
    return refreshMe();
  }, [refreshMe]);

  const logout = useCallback(async () => {
    const refresh_token = getRefreshToken();
    try {
      if (refresh_token) await api.post("/auth/logout", { refresh_token });
    } catch { /* ignore */ }
    clearTokens();
    setUser(null);
  }, []);

  const value = { user, setUser, loading, login, register, logout, refreshMe };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
