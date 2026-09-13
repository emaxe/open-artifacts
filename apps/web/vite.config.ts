import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      // Trailing slash matters: a bare "/s" is a prefix match against every request path (Vite's
      // proxy does `path.startsWith(key)`), which was silently swallowing every `/src/*` dev
      // module request too — the whole dev server only "worked" because the browser's initial
      // navigation to "/" isn't itself prefixed by "/s". `/s/` only matches real share links
      // (`/s/:token`, `/s/:token/unlock`, `/s/:token/download`).
      "/s/": "http://localhost:3000",
      "/embed": "http://localhost:3000",
    },
  },
  build: {
    outDir: "dist",
  },
});
