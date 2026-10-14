import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal";

describe("Modal backdrop dismissal", () => {
  it("closes once when the backdrop itself is clicked, not when the message is clicked", () => {
    const close = vi.fn();
    const { container } = render(
      <Modal open title="Details" onClose={close}>
        <p>Message text</p>
      </Modal>,
    );
    fireEvent.mouseDown(screen.getByText("Message text"));
    expect(close).not.toHaveBeenCalled();
    fireEvent.mouseDown(container.querySelector('[aria-hidden="true"]')!);
    expect(close).toHaveBeenCalledOnce();
  });
  it("keeps non-dismissible forms protected from backdrop and Escape", () => {
    const close = vi.fn();
    const { container } = render(
      <Modal open dismissible={false} title="Saving" onClose={close}>
        Pending save
      </Modal>,
    );
    fireEvent.mouseDown(container.querySelector('[aria-hidden="true"]')!);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("Modal editing focus", () => {
  it("retains input focus across text updates with inline close callbacks", () => {
    function Editor() {
      const [text, setText] = useState("");
      return (
        <Modal open title="Edit template" onClose={() => setText("")}>
          <label htmlFor="modal-draft">Draft</label>
          <input
            id="modal-draft"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </Modal>
      );
    }
    render(<Editor />);
    const input = screen.getByRole("textbox", { name: "Draft" });
    input.focus();
    fireEvent.change(input, { target: { value: "First character" } });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: "First character and more" } });
    expect(input).toHaveFocus();
  });
  it("uses the latest close callback and dismissibility without moving editor focus", () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender } = render(
      <Modal open title="Editor" onClose={first}>
        <input aria-label="Draft" />
      </Modal>,
    );
    const input = screen.getByRole("textbox", { name: "Draft" });
    input.focus();
    rerender(
      <Modal open title="Editor" onClose={latest} dismissible={false}>
        <input aria-label="Draft" />
      </Modal>,
    );
    expect(input).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(latest).not.toHaveBeenCalled();
    rerender(
      <Modal open title="Editor" onClose={latest}>
        <input aria-label="Draft" />
      </Modal>,
    );
    expect(input).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(latest).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
  });
  it("restores focus to the opening control on close", () => {
    const opener = document.createElement("button");
    opener.textContent = "Edit";
    document.body.appendChild(opener);
    opener.focus();
    const { rerender } = render(
      <Modal open title="Editor" onClose={() => {}}>
        Draft
      </Modal>,
    );
    expect(screen.getByRole("dialog")).toHaveFocus();
    rerender(
      <Modal open={false} title="Editor" onClose={() => {}}>
        Draft
      </Modal>,
    );
    expect(opener).toHaveFocus();
    opener.remove();
  });
});
