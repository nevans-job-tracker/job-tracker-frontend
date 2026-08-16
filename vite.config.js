import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
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
