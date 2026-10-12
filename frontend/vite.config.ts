import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Em desenvolvimento, pedidos a /api/* vão para o backend (npm run dev na pasta /backend).
  server: { proxy: { "/api": "http://localhost:4000" } },
});
