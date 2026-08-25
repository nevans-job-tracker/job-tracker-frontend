import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Filters from "./Filters.jsx";

function setup(props = {}) {
  const onSearchChange = vi.fn();
  const onStatusChange = vi.fn();
  const onShowChange = vi.fn();
  render(
    <Filters
      search=""
      onSearchChange={onSearchChange}
      status=""
      onStatusChange={onStatusChange}
      show="active"
      onShowChange={onShowChange}
      {...props}
    />
  );
  return { onSearchChange, onStatusChange, onShowChange };
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
