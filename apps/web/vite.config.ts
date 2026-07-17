import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // 5173 занят другим локальным проектом на этой машине — фиксированный порт вместо
    // default, чтобы Vite не переключался молча на другой (см. CORS_ORIGINS в apps/api/.env).
    port: Number(process.env.WEB_PORT ?? 5183),
    strictPort: true,
  },
});
