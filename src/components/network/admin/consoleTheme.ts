import { useState } from "react";

/**
 * The developer explorer's console skin (`.ccn-console` in `src/index.css`):
 * dark (navy, the default) or light (CARE's own palette, monospace).
 * Remembered per viewer in this browser only.
 */
export type ConsoleTheme = "dark" | "light";

const STORAGE_KEY = "care_ccn_fe:explorer-theme";

function readTheme(): ConsoleTheme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function consoleClass(theme: ConsoleTheme) {
  return theme === "dark" ? "dark ccn-console" : "ccn-console";
}

export function useConsoleTheme() {
  const [theme, setTheme] = useState<ConsoleTheme>(readTheme);
  const update = (next: ConsoleTheme) => {
    setTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage blocked: the choice lasts for this page only.
    }
  };
  return { theme, setTheme: update, className: consoleClass(theme) };
}
