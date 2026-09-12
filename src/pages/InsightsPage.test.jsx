import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import InsightsPage from "./InsightsPage.jsx";
import * as api from "../api/client.js";

function renderPage() {
  return render(
    <MemoryRouter>
      <InsightsPage />
    </MemoryRouter>
  );
}

const timeline = {
  series: [
    { date: "2026-08-01", counts: { interested: 2 } },
    { date: "2026-08-02", counts: { interested: 1, applied: 1 } },
  ],
  opening_count: 2,
};

describe("InsightsPage", () => {
  beforeEach(() => {
    vi.spyOn(api, "getStatusTimeline").mockResolvedValue(timeline);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the chart once the timeline arrives", async () => {
    const { container } = renderPage();
    await waitFor(() =>
      expect(container.querySelectorAll(".chart-band")).toHaveLength(2)
    );
  });

  it("passes the opening count through to the caveat", async () => {
    renderPage();
    expect(
      await screen.findByText(/2 applications enter on the first day/)
    ).toBeInTheDocument();
  });

  it("offers a way back to the list", async () => {
    renderPage();
    await screen.findByRole("img");

    // A link rather than history.back(): this screen is bookmarkable, so
    // there is not always a list behind it.
    expect(screen.getByRole("link", { name: /All applications/ })).toHaveAttribute(
      "href",
      "/"
    );
  });

  it("puts the way out ahead of the title, as the detail screen does", async () => {
    renderPage();
    await screen.findByRole("img");

    // The two screens disagreed about where "back" lives — right here, top
    // left there. Asserted as document order rather than a class, because what
    // matters is what a reader meets first.
    const link = screen.getByRole("link", { name: /All applications/ });
    const heading = screen.getByRole("heading", { name: "Insights" });
    expect(link.compareDocumentPosition(heading)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    // The toggle keeps the right-hand side, so the link must not sit with it.
    expect(link.closest(".header-actions")).toBeNull();
  });

  it("keeps the header top-aligned, so the toggle stays level with the link", async () => {
    renderPage();
    await screen.findByRole("img");

    // Asserting the class, not the geometry: jsdom does not lay out, so it
    // cannot see that dropping this puts the toggle in the gap between the
    // link and the heading, level with neither. Measured in a real browser
    // instead — link and toggle both at y=64 at desktop width and at 375px.
    // The class is the only thing standing between that and the default
    // centring, so it is what there is to guard.
    expect(document.querySelector("header")).toHaveClass("header-stacked");
  });

  it("shows an empty state rather than empty axes", async () => {
    api.getStatusTimeline.mockResolvedValue({ series: [], opening_count: 0 });
    const { container } = renderPage();

    expect(await screen.findByText(/Nothing to chart yet/)).toBeInTheDocument();
    expect(container.querySelector(".chart-svg")).toBeNull();
  });

  it("surfaces a failure instead of an empty chart", async () => {
    api.getStatusTimeline.mockRejectedValue(new Error("API is down"));
    renderPage();

    expect(await screen.findByText("API is down")).toBeInTheDocument();
    // The empty state would read as "no data", which is a different and wrong
    // claim about a request that failed.
    expect(screen.queryByText(/Nothing to chart yet/)).not.toBeInTheDocument();
  });

  it("carries the theme toggle, like every other screen", async () => {
    renderPage();
    await screen.findByRole("img");
    expect(screen.getByRole("button", { name: /mode/i })).toBeInTheDocument();
  });
});
