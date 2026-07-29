import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import path from "path";
import manifest from "./manifest.config.js";

/** Vite config for Chrome extension builds (full SPA in a tab). */
export default defineConfig({
  base: "./",
  define: {
    "import.meta.env.VITE_APP_TARGET": JSON.stringify("extension"),
  },
  plugins: [react(), crx({ manifest })],
  server: {
    port: 3002,
    strictPort: true,
    cors: {
      origin: [/chrome-extension:\/\//],
    },
  },
  build: {
    outDir: "dist-extension",
    emptyOutDir: true,
    rollupOptions: {
      preserveEntrySignatures: "exports-only",
    },
    chunkSizeWarningLimit: 1000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    extensions: [".mjs", ".js", ".jsx", ".ts", ".tsx", ".json"],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        ".js": "jsx",
      },
    },
  },
});
