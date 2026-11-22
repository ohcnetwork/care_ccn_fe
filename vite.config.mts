import federation from "@originjs/vite-plugin-federation";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  envPrefix: "REACT_",
  plugins: [
    federation({
      name: "care_ccn_fe",
      filename: "remoteEntry.js",
      exposes: {
        "./manifest": "./src/manifest.tsx",
      },
      // Must match the host's shared list: one React, one QueryClient, one router.
      shared: [
        "react",
        "react-dom",
        "react-i18next",
        "@tanstack/react-query",
        "@tanstack/react-router",
        "sonner",
      ],
    }),
    tailwindcss(),
    react(),
  ],
  build: {
    target: "esnext",
    minify: false,
    cssCodeSplit: false,
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      output: {
        format: "esm",
      },
      input: {
        main: "./src/index.tsx",
      },
    },
  },
  preview: {
    port: 4174,
    allowedHosts: true,
    host: "0.0.0.0",
    cors: {
      origin: "*",
      methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
      credentials: true,
    },
  },
  resolve: {
    alias: [
      // CommonJS `require("react")` is not shared through federation; these
      // ES versions import CARE's React instead (see `src/lib/shims`).
      {
        find: /^use-sync-external-store\/shim\/with-selector(\.js)?$/,
        replacement: path.resolve(
          __dirname,
          "./src/lib/shims/useSyncExternalStoreWithSelector.ts",
        ),
      },
      {
        find: /^use-sync-external-store\/shim(\/index\.js)?$/,
        replacement: path.resolve(
          __dirname,
          "./src/lib/shims/useSyncExternalStore.ts",
        ),
      },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
});
