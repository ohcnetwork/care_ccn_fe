/**
 * Replaces the CommonJS `use-sync-external-store/shim` (aliased in
 * `vite.config.mts`). That package does `require("react")`, which federation
 * does not swap for CARE's shared React, so the bundle got a second React
 * with no renderer and base-ui's dialogs and selects crashed
 * ("Cannot read properties of null (reading 'useSyncExternalStore')").
 * React 19 has the hook built in; this ES module import is shared.
 */
// A plain import: federation rewrites imports, not `export … from` re-exports.
import { useSyncExternalStore } from "react";

export { useSyncExternalStore };
