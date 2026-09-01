import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import BuildMarker from "./BuildMarker.jsx";
import { getHealth } from "../api/client.js";

vi.mock("../api/client.js", () => ({ getHealth: vi.fn() }));

function apiReports(branch, sha = "5982a40") {
  getHealth.mockResolvedValue({ status: "ok", build: { sha, branch } });
}

describe("BuildMarker (KAN-63)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiReports("main");
  });

  it("says nothing at all on main", async () => {
    // The inversion is the design: absence is the uneventful case, so its
    // presence is information. A version in the footer would be furniture.
    render(<BuildMarker branch="main" sha="abc1234" />);
    await waitFor(() => expect(getHealth).toHaveBeenCalled());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("names the branch and commit on anything else", async () => {
    apiReports("develop");
    render(<BuildMarker branch="develop" sha="abc1234" />);
    expect(await screen.findByRole("status")).toHaveTextContent(
      "develop @ abc1234"
    );
  });

  it("shows the API's commit alongside, without comparing it", async () => {
    // The two repositories have independent histories, so these SHAs are
    // unrelated by construction. Both are still worth reading.
    apiReports("develop", "5982a40");
    render(<BuildMarker branch="develop" sha="abc1234" />);

    const marker = await screen.findByRole("status");
    expect(marker).toHaveTextContent("abc1234");
    expect(marker).toHaveTextContent("api 5982a40");
    expect(marker.className).not.toContain("build-marker-warn");
  });

  it("does not call two different commits a mismatch", async () => {
    // The bug this replaced: comparing SHAs across two repositories reported
    // "half-deployed" on every load of a perfectly good deploy.
    apiReports("main", "5982a40");
    render(<BuildMarker branch="main" sha="ca1ffc2" />);
    await waitFor(() => expect(getHealth).toHaveBeenCalled());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("warns when the halves came from different branches", async () => {
    apiReports("develop");
    render(<BuildMarker branch="main" sha="abc1234" />);

    const marker = await screen.findByRole("status");
    expect(marker).toHaveTextContent("Half-deployed");
    expect(marker).toHaveTextContent("main");
    expect(marker).toHaveTextContent("develop");
    expect(marker.className).toContain("build-marker-warn");
  });

  it("does not call an unstamped API a mismatch", async () => {
    apiReports("unknown");
    render(<BuildMarker branch="main" sha="abc1234" />);
    await waitFor(() => expect(getHealth).toHaveBeenCalled());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("does not call an unstamped page a mismatch", async () => {
    // An unstamped page still shows a marker — "unknown" is not main — but it
    // must not accuse anybody of a half deploy.
    apiReports("main");
    render(<BuildMarker branch="unknown" sha="unknown" />);
    const marker = await screen.findByRole("status");
    expect(marker.className).not.toContain("build-marker-warn");
  });

  it("still reports the branch when the API cannot be reached", async () => {
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
    render(<BuildMarker />);
    await waitFor(() => expect(getHealth).toHaveBeenCalled());
  });
});
