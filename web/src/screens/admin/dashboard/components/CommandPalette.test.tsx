import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommandPalette, PAGE_DESTINATIONS } from "./CommandPalette";

describe("Jump to page", () => {
  it("offers exactly eight working pages and no Finance or inactive export", () => {
    expect(PAGE_DESTINATIONS.map((item) => item.section)).toEqual([
      "overview",
      "jobs",
      "drivers",
      "livefleet",
      "van",
      "liabilities",
      "notifications",
      "configurations",
    ]);
    render(
      <CommandPalette isOpen onClose={vi.fn()} onSelectSection={vi.fn()} />,
    );
    expect(
      screen.getByRole("dialog", { name: "Jump to page" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Finance/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveAttribute(
      "placeholder",
      "Find a page…",
    );
  });
  it("routes a filtered result using the keyboard and shows a useful empty state", () => {
    const select = vi.fn();
    const close = vi.fn();
    render(<CommandPalette isOpen onClose={close} onSelectSection={select} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Fleet" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(select).toHaveBeenCalledWith("livefleet");
    expect(close).toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "TMV-999" } });
    expect(screen.getByText("No matching pages")).toBeInTheDocument();
    expect(screen.getByText(/Search for job IDs/)).toBeInTheDocument();
  });
  it("restores focus to its opener when closed", async () => {
    const { rerender } = render(
      <>
        <button>Jump opener</button>
        <CommandPalette
          isOpen={false}
          onClose={vi.fn()}
          onSelectSection={vi.fn()}
        />
      </>,
    );
    const opener = screen.getByRole("button", { name: "Jump opener" });
    opener.focus();
    rerender(
      <>
        <button>Jump opener</button>
        <CommandPalette isOpen onClose={vi.fn()} onSelectSection={vi.fn()} />
      </>,
    );
    await waitFor(() => expect(screen.getByRole("combobox")).toHaveFocus());
    rerender(
      <>
        <button>Jump opener</button>
        <CommandPalette
          isOpen={false}
          onClose={vi.fn()}
          onSelectSection={vi.fn()}
        />
      </>,
    );
    expect(opener).toHaveFocus();
  });
});
