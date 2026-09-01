/**
 * Which source this bundle was built from (KAN-63).
 *
 * Inlined by vite.config.js at build time. Absent only when something built
 * this outside a git checkout, and "unknown" is the honest answer there —
 * never a guess, and never an empty string that renders as a blank chip.
 */
export const BUILD_SHA = import.meta.env.VITE_GIT_SHA || "unknown";
export const BUILD_BRANCH = import.meta.env.VITE_GIT_BRANCH || "unknown";

/**
 * The branch that never needs a marker.
 *
 * `main` is only ever merged into after `develop` has been deployed and
 * tested, so running it is the uneventful case. Everything else is worth
 * saying out loud.
 */
export const RELEASE_BRANCH = "main";
