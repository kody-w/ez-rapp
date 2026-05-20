import { defineConfig } from "electron-vite";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";

const sharedAlias = { "@shared": resolve(__dirname, "shared") };

export default defineConfig({
  main: {
    build: {
      rollupOptions: { input: { index: resolve(__dirname, "electron/main.ts") } },
      outDir: "out/main",
    },
    resolve: { alias: sharedAlias },
  },
  preload: {
    build: {
      rollupOptions: { input: { index: resolve(__dirname, "electron/preload.ts") } },
      outDir: "out/preload",
    },
    resolve: { alias: sharedAlias },
  },
  renderer: {
    root: resolve(__dirname),
    build: { rollupOptions: { input: resolve(__dirname, "index.html") }, outDir: "out/renderer" },
    plugins: [react()],
    resolve: { alias: sharedAlias },
    server: { port: 5173 },
  },
});
