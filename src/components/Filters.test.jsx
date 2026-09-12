import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Filters from "./Filters.jsx";

function setup(props = {}) {
  const onSearchChange = vi.fn();
  const onSourceChange = vi.fn();
  const onStatusChange = vi.fn();
  const onShowChange = vi.fn();
  const onReset = vi.fn();
  render(
    <Filters
      search=""
      onSearchChange={onSearchChange}
      source=""
      onSourceChange={onSourceChange}
      status=""
      onStatusChange={onStatusChange}
      show="active"
      onShowChange={onShowChange}
      onReset={onReset}
      {...props}
    />
  );
  return {
    onSearchChange,
    onSourceChange,
    onStatusChange,
    onShowChange,
    onReset,
  };
}

const clear = () => screen.queryByRole("button", { name: /clear search/i });

describe("clearing the search (KAN-48)", () => {
  it("offers no control while the box is empty", () => {
    // A control that does nothing is worse than no control.
    setup();
    expect(clear()).not.toBeInTheDocument();
  });

  it("appears once there is something to clear", () => {
    setup({ search: "netflix" });
    expect(clear()).toBeInTheDocument();
  });

  it("empties the search when pressed", async () => {
    const { onSearchChange } = setup({ search: "netflix" });
    await userEvent.click(clear());
    expect(onSearchChange).toHaveBeenCalledWith("");
  });

  it("is named for assistive technology, not just an X", () => {
    setup({ search: "netflix" });
    expect(clear()).toHaveAccessibleName("Clear search");
  });

  it("does not submit anything it might be nested in", () => {
    // Without type="button" a button inside a form defaults to submit.
    setup({ search: "netflix" });
    expect(clear()).toHaveAttribute("type", "button");
  });

  it("leaves the other filters alone", async () => {
    const { onStatusChange, onShowChange } = setup({ search: "netflix" });
    await userEvent.click(clear());
    expect(onStatusChange).not.toHaveBeenCalled();
    expect(onShowChange).not.toHaveBeenCalled();
  });
});

describe("the source filter (KAN-56)", () => {
  const withSources = (props = {}) =>
    setup({ sources: ["Built In", "Dice", "LinkedIn", "Wellfound"], ...props });

  const sourceSelect = () => screen.getByLabelText(/filter by source/i);

  it("defaults to All Sources", () => {
    withSources();
    expect(sourceSelect().value).toBe("");
    expect(sourceSelect().options[0].textContent).toBe("All Sources");
  });

  it("offers every source it was given, after the All option", () => {
    withSources();
    expect([...sourceSelect().options].map((o) => o.textContent)).toEqual([
      "All Sources",
      "Built In",
      "Dice",
      "LinkedIn",
      "Wellfound",
    ]);
  });

  it("reports a choice", async () => {
    const { onSourceChange } = withSources();
    await userEvent.selectOptions(sourceSelect(), "Dice");
    expect(onSourceChange).toHaveBeenCalledWith("Dice");
  });

  it("reports clearing back to all", async () => {
    const { onSourceChange } = withSources({ source: "Dice" });
    await userEvent.selectOptions(sourceSelect(), "");
    expect(onSourceChange).toHaveBeenCalledWith("");
  });

  it("renders before its options have arrived", () => {
    // They are fetched asynchronously, so the first paint has none. A filter
    // that throws while its options are in flight would take the page with it.
    setup();
    expect(sourceSelect()).toBeInTheDocument();
    expect(sourceSelect().options).toHaveLength(1);
  });

  it("sits between the search box and the status filter", () => {
    withSources();
    const controls = [...document.querySelectorAll(".filters input, .filters select")];
    expect(controls[0]).toHaveClass("search-input");
    expect(controls[1]).toBe(sourceSelect());
    expect(controls[2]).toBe(screen.getByLabelText(/filter by status/i));
  });

  it("no longer advertises source in the search placeholder", () => {
    // The field still searches source; only the wording changes, now that
    // there is a dedicated control for it.
    withSources();
    const placeholder = screen.getByRole("textbox").getAttribute("placeholder");
    expect(placeholder).not.toMatch(/source/i);
    expect(placeholder).toMatch(/company/i);
    expect(placeholder).toMatch(/notes/i);
  });
});

describe("resetting the filters (KAN-78)", () => {
  const reset = () => screen.getByRole("button", { name: /reset filters/i });

  it("is present even when nothing is filtered", () => {
    // Deliberately unlike the search clear button above. That one sits inside
    // the input and its absence costs nothing; this one anchors the end of the
    // row, and a control that comes and goes reflows the row and cannot be
    // aimed at from memory.
    setup();
    expect(reset()).toBeInTheDocument();
  });

  it("is disabled when nothing is filtered", () => {
    setup({ canReset: false });
    expect(reset()).toBeDisabled();
  });

  it("is enabled once something is filtered", () => {
    setup({ canReset: true });
    expect(reset()).toBeEnabled();
  });

  it("asks to be reset when pressed", async () => {
    const { onReset } = setup({ canReset: true });
    await userEvent.click(reset());
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("cannot be pressed while disabled", async () => {
    const { onReset } = setup({ canReset: false });
    await userEvent.click(reset());
    expect(onReset).not.toHaveBeenCalled();
  });
});
