import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RawBookingText } from "./RawBookingText";

describe("RawBookingText", () => {
  it("shows copy buttons for booking contact and address fields without changing the raw text", () => {
    render(
      <RawBookingText
        text={[
          "Customer name: Sample Customer",
          "Email: customer@example.test",
          "Phone: 07700900103",
          "Move from: 10 Example Road, London",
          "Notes: keep this raw"
        ].join("\n")}
      />
    );

    expect(screen.getByText("Customer name:")).toBeInTheDocument();
    expect(screen.getByText("Sample Customer")).toBeInTheDocument();
    expect(screen.getByLabelText("Copy Customer name")).toBeInTheDocument();
    expect(screen.getByLabelText("Copy Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Copy Phone")).toBeInTheDocument();
    expect(screen.getByLabelText("Copy Move from")).toBeInTheDocument();
    expect(screen.queryByLabelText("Copy Notes")).not.toBeInTheDocument();
  });
});
