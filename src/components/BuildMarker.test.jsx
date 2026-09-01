import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import BuildMarker from "./BuildMarker.jsx";
import { getHealth } from "../api/client.js";

vi.mock("../api/client.js", () => ({ getHealth: vi.fn() }));

/** The API agreeing with whatever the page claims to be. */
function apiReports(sha) {
  getHealth.mockResolvedValue({ status: "ok", build: { sha, branch: "any" } });
}

describe("BuildMarker (KAN-63)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiReports("abc1234");
  });

  it("says nothing at all on main", async () => {
    // The inversion is the design: absence is the uneventful case, so its
    // presence is information. A version in the footer would be furniture.
    render(<BuildMarker branch="main" sha="abc1234" />);
    await waitFor(() => expect(getHealth).toHaveBeenCalled());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("names the branch and commit on anything else", async () => {
    render(<BuildMarker branch="develop" sha="abc1234" />);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "develop @ abc1234"
    );
  });

  it("appears on main when the API is running a different build", async () => {
    // The mismatch outranks the branch — a half-finished deploy is worth
    // interrupting a clean release for.
    apiReports("999zzz9");
    render(<BuildMarker branch="main" sha="abc1234" />);

    const marker = await screen.findByRole("status");
    expect(marker).toHaveTextContent("Half-deployed");
    expect(marker).toHaveTextContent("abc1234");
    expect(marker).toHaveTextContent("999zzz9");
    expect(marker.className).toContain("build-marker-warn");
  });

  it("does not call an unstamped API a mismatch", async () => {
    // "unknown" means nobody stamped it, which is not a disagreement.
    apiReports("unknown");
    render(<BuildMarker branch="main" sha="abc1234" />);
    await waitFor(() => expect(getHealth).toHaveBeenCalled());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("does not call an unstamped page a mismatch", async () => {
    apiReports("abc1234");
    render(<BuildMarker branch="main" sha="unknown" />);
    await waitFor(() => expect(getHealth).toHaveBeenCalled());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("still reports the branch when the API cannot be reached", async () => {
    // An outage is the list's story to tell. Two complaints about one failure
    // is worse than one, but the branch is known without the API.
    getHealth.mockRejectedValue(new Error("Failed to fetch"));
    render(<BuildMarker branch="develop" sha="abc1234" />);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "develop @ abc1234"
    );
  });

  it("survives a health response with no build in it", async () => {
    // An older API that predates this story answers {"status":"ok"}.
    getHealth.mockResolvedValue({ status: "ok" });
    render(<BuildMarker branch="main" sha="abc1234" />);
    await waitFor(() => expect(getHealth).toHaveBeenCalled());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("falls back to the values built into the bundle", async () => {
    // No props: whatever vite.config.js inlined. In the test run that is a
    // real commit or "unknown", and either way it must not throw.
    render(<BuildMarker />);
    await waitFor(() => expect(getHealth).toHaveBeenCalled());
  });
});
