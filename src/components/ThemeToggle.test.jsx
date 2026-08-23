import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ThemeToggle from "./ThemeToggle.jsx";
import { readTheme, STORAGE_KEY } from "../theme.js";

/** jsdom has no matchMedia; the app treats its absence as "no preference". */
function systemPrefers(dark) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches: dark, addEventListener() {}, removeEventListener() {} })
  );
}

const theme = () => document.documentElement.getAttribute("data-theme");
const button = () => screen.getByRole("button");

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  systemPrefers(false);
});

afterEach(() => vi.unstubAllGlobals());

describe("readTheme", () => {
  it("follows the device when nothing is stored", () => {
    systemPrefers(true);
    expect(readTheme()).toBe("dark");
  });

  it("follows the device the other way too", () => {
    systemPrefers(false);
    expect(readTheme()).toBe("light");
  });

  it("prefers a stored choice over the device", () => {
    systemPrefers(true);
    window.localStorage.setItem(STORAGE_KEY, "light");
    expect(readTheme()).toBe("light");
  });

  it("ignores a stored value that is not a theme", () => {
    // Anything could be in localStorage; a bad value must not stamp a
    // data-theme nothing styles.
    systemPrefers(true);
    window.localStorage.setItem(STORAGE_KEY, "banana");
    expect(readTheme()).toBe("dark");
  });

  it("survives localStorage throwing", () => {
    // Private browsing can make reads throw. A theme is not worth failing a
    // page load over.
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    systemPrefers(true);
    expect(readTheme()).toBe("dark");
    spy.mockRestore();
  });

  it("treats a browser without matchMedia as light", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(readTheme()).toBe("light");
  });
});

describe("ThemeToggle", () => {
  it("applies the current theme on mount", () => {
    systemPrefers(true);
    render(<ThemeToggle />);
    expect(theme()).toBe("dark");
  });

  it("switches the theme when pressed", async () => {
    render(<ThemeToggle />);
    expect(theme()).toBe("light");

    await userEvent.click(button());
    expect(theme()).toBe("dark");
  });

  it("switches back", async () => {
    render(<ThemeToggle />);
    await userEvent.click(button());
    await userEvent.click(button());
    expect(theme()).toBe("light");
  });

  it("remembers the choice", async () => {
    render(<ThemeToggle />);
    await userEvent.click(button());
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("dark");
  });

  it("keeps a deliberate light choice even on a dark device", async () => {
    // Storing only on toggle would otherwise let the device preference win
    // back on the next load, silently undoing the choice.
    systemPrefers(true);
    render(<ThemeToggle />);
    await userEvent.click(button());
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("light");
    expect(readTheme()).toBe("light");
  });

  it("names where it goes, not where you are", async () => {
    // A control reading "Dark mode" while the page is already dark is the
    // ambiguity that makes these annoying.
    render(<ThemeToggle />);
    expect(button()).toHaveTextContent("Dark mode");

    await userEvent.click(button());
    expect(button()).toHaveTextContent("Light mode");
  });

  it("carries a label rather than an icon alone", async () => {
    render(<ThemeToggle />);
    expect(button()).toHaveAccessibleName("Switch to dark mode");

    await userEvent.click(button());
    expect(button()).toHaveAccessibleName("Switch to light mode");
  });

  it("keeps the visible text inside the accessible name", () => {
    // Otherwise the two disagree for anyone driving this by voice. The icon is
    // aria-hidden and not part of what anyone would say, so it is excluded.
    render(<ThemeToggle />);
    const name = button().getAttribute("aria-label").toLowerCase();
    const spoken = button().textContent.replace(/[^a-z\s]/gi, "").trim().toLowerCase();
    expect(spoken).not.toBe("");
    expect(name).toContain(spoken);
  });

  it("reports its state to assistive technology", async () => {
    render(<ThemeToggle />);
    expect(button()).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(button());
    expect(button()).toHaveAttribute("aria-pressed", "true");
  });

  it("still switches when localStorage refuses to write", async () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    render(<ThemeToggle />);
    await userEvent.click(button());
    // Applies for this session even though it cannot be remembered.
    expect(theme()).toBe("dark");
    spy.mockRestore();
  });
});

describe("the pre-mount script in index.html", () => {
  // It duplicates readTheme() on purpose — the theme has to be applied before
  // React exists, or every load flashes the wrong palette. Duplication is the
  // price, and this is what stops the two drifting apart silently.
  // From the project root: vitest runs there, and import.meta.url is not a
  // file: URL under the jsdom environment.
  const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");

  it("reads the same storage key", () => {
    expect(html).toContain(`getItem("${STORAGE_KEY}")`);
  });

  it("honours a stored light choice over a dark device", () => {
    expect(html).toContain('stored !== "light"');
  });

  it("falls back to the same media query", () => {
    expect(html).toContain("(prefers-color-scheme: dark)");
  });

  it("stamps the attribute the stylesheet keys off", () => {
    expect(html).toMatch(/setAttribute\(\s*"data-theme"/);
  });

  it("does not let a storage failure stop the page", () => {
    expect(html).toMatch(/try \{[\s\S]*catch/);
  });
});
