import { describe, expect, it } from "vitest";
import { todayISO } from "./dates.js";

describe("todayISO", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(todayISO(new Date(2026, 8, 11, 12, 0))).toBe("2026-09-11");
  });

  it("pads single-digit months and days", () => {
    expect(todayISO(new Date(2026, 0, 5, 12, 0))).toBe("2026-01-05");
  });

  it("reads the local date late in the evening, not the UTC one", () => {
    // The whole reason this function exists. `new Date(2026, 8, 11, 23, 30)` is
    // half past eleven on the 11th wherever the reader is; converting to UTC
    // first rolls it to the 12th anywhere west of UTC, which is most of the
    // evening for this app's one user.
    const lateOnTheEleventh = new Date(2026, 8, 11, 23, 30);

    expect(todayISO(lateOnTheEleventh)).toBe("2026-09-11");
  });

  it("reads the local date in the small hours, not the previous UTC one", () => {
    // The mirror case, which bites east of UTC instead.
    expect(todayISO(new Date(2026, 8, 12, 0, 30))).toBe("2026-09-12");
  });

  it("defaults to now", () => {
    // Asserted against the same local parts rather than a literal, so the test
    // does not fail overnight.
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    expect(todayISO()).toBe(expected);
  });
});
