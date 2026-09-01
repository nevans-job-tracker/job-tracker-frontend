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
