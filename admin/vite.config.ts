import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
/** 开发代理目标：可用 VITE_PROXY_TARGET 覆盖（如指向 Docker API :18000），默认本机 :8000 */
const proxyTarget = process.env.VITE_PROXY_TARGET || "http://127.0.0.1:8000";

// Vite config: React + Tailwind, admin on 5174 with /api proxy
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: proxyTarget,
        changeOrigin: true,
      },
      "/static": {
        target: proxyTarget,
        changeOrigin: true,
      },
    },
  },
});
