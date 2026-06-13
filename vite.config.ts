import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: "web",
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true, // fail loudly instead of silently hopping to 5174/5175 (which breaks the proxy)
    proxy: {
      "/api": {
        target: "http://localhost:5174",
        changeOrigin: true,
        // Don't spam the console while the API is still cold-starting; the client retries.
        configure: (proxy) => {
          proxy.on("error", () => {});
        },
      },
    },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
});
