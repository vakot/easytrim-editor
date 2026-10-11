import { readFileSync } from "node:fs";
import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { type PluginOption, searchForWorkspaceRoot } from "vite";
import { defineConfig } from "vitest/config";

const host = process.env.TAURI_DEV_HOST;
const repositoryRoot = searchForWorkspaceRoot(__dirname);
const packageMetadata = JSON.parse(
  readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
) as { version?: unknown };

if (typeof packageMetadata.version !== "string") {
  throw new TypeError("The repository package must declare a version");
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    ...(mode === "analyze"
      ? [
          visualizer({
            filename: path.resolve(__dirname, "dist/bundle-analysis.html"),
            gzipSize: true,
            brotliSize: true,
            template: "treemap",
          }) as PluginOption,
          visualizer({
            filename: path.resolve(__dirname, "dist/bundle-analysis-network.html"),
            gzipSize: true,
            brotliSize: true,
            template: "network",
          }) as PluginOption,
        ]
      : []),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(packageMetadata.version),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  // Keep shared UI dependencies together across the optional feature chunks.
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "shared-ui",
              test: /[\\/]components[\\/]ui[\\/]/,
              minShareCount: 2,
              minSize: 12_000,
              priority: 5,
            },
            {
              name: "icons",
              test: /lucide-react/,
              priority: 10,
              minShareCount: 2,
            },
            {
              name: "radix-ui",
              test: /radix-ui/,
              priority: 10,
              minShareCount: 2,
              minSize: 12_000,
            },
          ],
        },
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
}));
