import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import pkg from "./package.json";
import { readFileSync } from "fs";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // FA_API_KEY from .env.local — not VITE_-prefixed, so it is never bundled; the dev proxy adds it like nginx does
  const env = loadEnv(mode, process.cwd(), "");
  return {
    define: { "import.meta.env.VITE_APP_VERSION": JSON.stringify(pkg.version) },
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
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      {
        // iOS fetches the touch icon without the Cloudflare Access cookie and gets the login page, so embed it in index.html
        name: "inline-touch-icon",
        apply: "build",
        transformIndexHtml(html: string) {
          const b64 = readFileSync(path.resolve(__dirname, "public/apple-touch-icon-180.png")).toString("base64");
          return html.replace('href="/apple-touch-icon-180.png"', `href="data:image/png;base64,${b64}"`);
        },
      },
      VitePWA({
        registerType: "autoUpdate",
        useCredentials: true,   // manifest fetch carries the Cloudflare Access cookie (Android install icon)
        includeAssets: ["favicon.ico", "icon.svg", "apple-touch-icon.png"],
        manifest: {
          name: "FA Spending", short_name: "FA", start_url: "/", display: "standalone",
          background_color: "#0F7B62", theme_color: "#0F7B62",
          icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        // API calls are never cached by the service worker
        workbox: { navigateFallback: "/index.html", navigateFallbackDenylist: [/^\/api\//], runtimeCaching: [] },
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
