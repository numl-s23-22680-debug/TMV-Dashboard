import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessagingPage } from "./MessagingPage";
const mocks = vi.hoisted(() => ({
  fetchMessages: vi.fn(),
  toggleMessage: vi.fn(),
  saveMessageTemplate: vi.fn(),
}));
vi.mock("../api", () => mocks);
const item = {
  id: "customer-booking",
  audience: "customer",
  channel: "Email",
  label: "Booking confirmation",
  hint: "Sent after booking",
  variables: ["{customerName}"],
  enabled: true,
  hasTitle: true,
  hasHtml: true,
  title: "Booking",
  titleFallback: "Booking",
  body: "Hello {customerName}",
  bodyFallback: "Hello {customerName}",
  html: "<p>Hello {customerName}</p>",
  htmlFallback: "<p>Hello {customerName}</p>",
  htmlEnabled: false,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchMessages.mockResolvedValue({ items: [item] });
  mocks.toggleMessage.mockResolvedValue(undefined);
  mocks.saveMessageTemplate.mockResolvedValue(undefined);
});
function setup() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MessagingPage />
    </QueryClientProvider>,
  );
}
describe("Message template editing", () => {
  it("previews sample values without sending and blocks unsupported template variables", async () => {
    setup();
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Booking confirmation" }),
    );
    expect(screen.getByText("Hello Example customer")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Message text" }), {
      target: { value: "Hello {unsupported}" },
    });
    expect(screen.getByText("Unsupported variables")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(mocks.saveMessageTemplate).not.toHaveBeenCalled();
    expect(mocks.toggleMessage).not.toHaveBeenCalled();
  });
  it("keeps entered content on save failure and protects cancel with unsaved changes", async () => {
    mocks.saveMessageTemplate.mockRejectedValueOnce(
      new Error("Template unavailable"),
    );
    setup();
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Booking confirmation" }),
    );
    const text = screen.getByRole("textbox", { name: "Message text" });
    fireEvent.change(text, { target: { value: "Changed {customerName}" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Template unavailable")).toBeInTheDocument();
    expect(text).toHaveValue("Changed {customerName}");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.getByRole("dialog", { name: "Discard unsaved changes?" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(text).toHaveValue("Changed {customerName}");
  });
  it("rolls back failed enabled-state saves and shows the failure", async () => {
    mocks.toggleMessage.mockRejectedValueOnce(
      new Error("Connection unavailable"),
    );
    setup();
    const toggle = await screen.findByRole("switch", {
      name: "Disable Booking confirmation",
    });
    fireEvent.click(toggle);
    expect(
      await screen.findByText(/Could not update Booking confirmation/),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("switch", { name: "Disable Booking confirmation" }),
      ).toHaveAttribute("aria-checked", "true"),
    );
  });
  it("keeps advanced HTML preview sandboxed and blocks all external preview resources", async () => {
    setup();
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Booking confirmation" }),
    );
    fireEvent.click(screen.getByRole("radio", { name: "Advanced HTML" }));
    const iframe = screen.getByTitle("Booking confirmation HTML preview");
    expect(iframe).toHaveAttribute("sandbox", "");
    expect(iframe.getAttribute("srcdoc")).toContain("default-src 'none'");
  });
});
