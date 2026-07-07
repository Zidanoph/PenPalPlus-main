// Thin fetch wrapper around the PenPal+ API.
// - stores the access/refresh tokens in memory + localStorage
// - attaches the bearer token
// - transparently refreshes once on a 401 and retries the request

const BASE = import.meta.env.VITE_API_BASE || "/api";

const TOKENS = {
  access: localStorage.getItem("pp_access") || null,
  refresh: localStorage.getItem("pp_refresh") || null,
};

export function setTokens(access, refresh) {
  TOKENS.access = access || null;
  TOKENS.refresh = refresh || null;
  if (access) localStorage.setItem("pp_access", access);
  else localStorage.removeItem("pp_access");
  if (refresh) localStorage.setItem("pp_refresh", refresh);
  else localStorage.removeItem("pp_refresh");
}

export function clearTokens() {
  setTokens(null, null);
}

export function hasSession() {
  return Boolean(TOKENS.access);
}

export function getRefreshToken() {
  return TOKENS.refresh;
}

class ApiError extends Error {
  constructor(status, detail) {
    super(typeof detail === "string" ? detail : "Request failed");
    this.status = status;
    this.detail = detail;
  }
}

async function parse(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function rawRequest(method, path, { body, form, auth = true } = {}) {
  const headers = {};
  let payload;
  if (form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  if (auth && TOKENS.access) headers["Authorization"] = `Bearer ${TOKENS.access}`;

  const res = await fetch(BASE + path, { method, headers, body: payload });
  const data = await parse(res);
  if (!res.ok) {
    throw new ApiError(res.status, data && data.detail ? data.detail : data);
  }
  return data;
}

let refreshing = null;

async function tryRefresh() {
  if (!TOKENS.refresh) return false;
  // de-dupe concurrent refreshes
  if (!refreshing) {
    refreshing = rawRequest("POST", "/auth/refresh-token", {
      body: { refresh_token: TOKENS.refresh },
      auth: false,
    })
      .then((data) => {
        setTokens(data.access_token, data.refresh_token || TOKENS.refresh);
        return true;
      })
      .catch(() => {
        clearTokens();
        return false;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

async function request(method, path, opts = {}) {
  try {
    return await rawRequest(method, path, opts);
  } catch (err) {
    if (err.status === 401 && opts.auth !== false && TOKENS.refresh) {
      const ok = await tryRefresh();
      if (ok) return rawRequest(method, path, opts);
    }
    throw err;
  }
}

export const api = {
  get: (p) => request("GET", p),
  post: (p, body) => request("POST", p, { body }),
  put: (p, body) => request("PUT", p, { body }),
  del: (p) => request("DELETE", p),
  // OAuth2 login uses form encoding
  login: (email, password) =>
    request("POST", "/auth/login", { form: { username: email, password }, auth: false }),
  register: (payload) => request("POST", "/auth/register", { body: payload, auth: false }),
};

export { ApiError };
