import { useTheme } from "../theme.js";

/**
 * Sits in the header of both screens (KAN-44).
 *
 * One component used twice rather than a shared layout wrapper — there is no
 * app chrome today, and introducing one to hold a single button would be a
 * larger change than the feature itself.
 *
 * The label names where the button *goes*, not where you are. A control
 * reading "Dark mode" while the page is already dark is the ambiguity that
 * makes icon-only toggles annoying, and an icon alone has it twice over — a
 * moon could equally mean "is dark" or "go dark".
 */
export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  const destination = dark ? "Light mode" : "Dark mode";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      // Contains the visible text, so the two never disagree for anyone
      // driving this by voice.
      aria-label={`Switch to ${destination.toLowerCase()}`}
      aria-pressed={dark}
    >
      <span aria-hidden="true">{dark ? "☀" : "☾"}</span>
      {destination}
    </button>
  );
}
