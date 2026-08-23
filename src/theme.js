import { useCallback, useEffect, useState } from "react";

/**
 * Light/dark theme (KAN-44).
 *
 * The stored choice and the attribute on <html> are the two halves; the inline
 * script in index.html applies the attribute before React mounts, and this
 * keeps it in step afterwards. Nothing here runs on first paint, which is why
 * that script exists — see the comment there.
 */

export const STORAGE_KEY = "job-tracker-theme";

const systemPrefersDark = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

/** The stored choice if there is one, otherwise whatever the device prefers. */
export function readTheme() {
  let stored = null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private browsing can make localStorage throw on read. A theme is not
    // worth failing a page load over; fall back to the device preference.
  }
  if (stored === "light" || stored === "dark") return stored;
  return systemPrefersDark() ? "dark" : "light";
}

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function useTheme() {
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Same as above: the theme still applies for this session, it just
        // will not be remembered.
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
