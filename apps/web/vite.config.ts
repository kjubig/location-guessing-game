import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // MapLibre 6 loads its renderer from a sibling ESM worker file. Vite's
  // dependency pre-bundler can move the main module without that sibling.
  // Serving MapLibre as native ESM keeps both files together.
  optimizeDeps: {
    exclude: ["maplibre-gl"],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: false,
  },
});
