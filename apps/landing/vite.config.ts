import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Published as a GitHub Pages project site (https://emaxe.github.io/open-artifacts/), so every
// asset/module URL must carry the repo-name subpath — Pages has no way to serve this at "/".
// If a custom domain ever replaces the github.io subpath, change this to "/" (and nothing else
// in this package needs to change: no react-router basename, no other base-relative paths).
export default defineConfig({
  base: "/open-artifacts/",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
  },
  build: {
    outDir: "dist",
  },
});
