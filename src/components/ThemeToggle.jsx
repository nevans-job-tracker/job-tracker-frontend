import { useTheme } from "../theme.js";

/**
 * Sits in the header of both screens (KAN-44).
 *
 * One component used twice rather than a shared layout wrapper — there is no
 * app chrome today, and introducing one to hold a single button would be a
 * larger change than the feature itself.
 */
export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      className="link-button theme-toggle"
      onClick={toggle}
      // The icon alone is ambiguous — a moon could mean "is dark" or "go
      // dark". The label says which, for anything reading it aloud.
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span aria-hidden="true">{dark ? "☀" : "☾"}</span>
    </button>
  );
}
