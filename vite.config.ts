import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // FA_API_KEY from .env.local — not VITE_-prefixed, so it is never bundled; the dev proxy adds it like nginx does
  const env = loadEnv(mode, process.cwd(), "");
  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        "/api/fa": {
          target: "https://n8n.11homelab.cc",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/fa/, "/webhook/fa"),
          headers: { "X-FA-Key": env.FA_API_KEY || "" },
        },
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
