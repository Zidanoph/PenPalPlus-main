import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The frontend talks to the FastAPI backend. In dev we proxy /api → the
// backend so there are no CORS surprises and the same-origin fetch client
// works unchanged in production behind a reverse proxy.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_PROXY_TARGET || "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  preview: {
    // Vite 5 blocks unrecognized Host headers by default. Railway serves
    // this app behind a proxy on a *.up.railway.app domain, so it must be
    // explicitly allowed (or preview will 403 with "Blocked request").
    allowedHosts: [
      "penpalplus-main-production.up.railway.app",
      ".up.railway.app",
    ],
  },
});
