import { execFileSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * The build stamps itself with the commit it came from (KAN-63).
 *
 * Done here rather than by exporting the variables in the deploy command, so
 * the stamp cannot be the step somebody forgets — a build that silently
 * reports the wrong commit is worse than one that reports none.
 *
 * An environment variable still wins where one is set, which is what lets a
 * build outside a checkout say something truthful.
 */
function gitValue(envName, ...args) {
  if (process.env[envName]) return process.env[envName];
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      // stderr is discarded: outside a repository this fails, and that is a
      // reportable state rather than an error worth printing on every build.
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

export default defineConfig({
  plugins: [react()],

  // Inlined at build time, which is the whole point: the bundle a browser
  // loads carries the identity of the source it was built from.
  define: {
    "import.meta.env.VITE_GIT_SHA": JSON.stringify(
      gitValue("VITE_GIT_SHA", "rev-parse", "--short", "HEAD")
    ),
    "import.meta.env.VITE_GIT_BRANCH": JSON.stringify(
      gitValue("VITE_GIT_BRANCH", "rev-parse", "--abbrev-ref", "HEAD")
    ),
  },
  server: {
    host: true,
    port: 5173,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",

    // Vitest defaults to 5s, which is a laptop number. The suite also runs
    // nightly on the deployment machine — the 2009 single-core Celeron in
    // ARCHITECTURE — where it takes 286s against 61s here, and one test went
    // over the line (KAN-88).
    //
    // Measured on that machine rather than guessed: `pagination > appends the
    // next page instead of replacing` ran in 11.1s alone and 5.5s alongside
    // two other files. It renders 50 rows, fetches, and appends 50 more, each
    // carrying a status <select>, so it is the slowest thing in the suite by
    // some distance and its cost swings with load.
    //
    // 20s is chosen against the worst of those, not the average. The test is
    // not wrong and neither is what it renders; 5s was the wrong number for
    // where this actually runs. The figure is deliberately not so large that
    // a genuine hang would sit undetected for a minute — that is the cost of
    // raising it, and 20s keeps it small.
    //
    // This matters more than one red test. `deploy/run-tests.sh` reports at
    // SSH login, and KAN-26's whole argument is that an unread failure is
    // false confidence rather than none. A banner permanently reading FAIL
    // for a known reason trains the reader to skip the line, so the next
    // real failure arrives somewhere nobody looks.
    testTimeout: 20000,

    // Reports are written on every run so they can't go stale:
    //   test-results/index.html — which tests ran and passed
    //   coverage/index.html     — line-by-line coverage
    reporters: ["default", "html"],
    outputFile: { html: "./test-results/index.html" },

    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/test/**", "src/main.jsx", "**/*.test.{js,jsx}"],
    },
  },
});
