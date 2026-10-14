import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SendBroadcastPushModal } from "./SendBroadcastPushModal";
const mocks = vi.hoisted(() => ({
  fetchDrivers: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("../../../../api/admin", () => ({ fetchDrivers: mocks.fetchDrivers }));
vi.mock("../../../../components/ui/Toast", () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchDrivers.mockResolvedValue([
    { initials: "EX", fullName: "Example driver", active: true },
    { initials: "EX2", fullName: "Second driver", active: false },
  ]);
});
function setup() {
  const close = vi.fn();
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <SendBroadcastPushModal isOpen onClose={close} />
    </QueryClientProvider>,
  );
  return close;
}
describe("Deliberate broadcast", () => {
  it("shows account count and preview before an explicit send; preview never sends", async () => {
    const send = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ result: { sent: 1 } }),
      });
    vi.stubGlobal("fetch", send);
    setup();
    expect(
      await screen.findByText(/1 active driver account selected/),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Message/), {
      target: { value: "Example notice" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview notice" }));
    expect(
      screen.getByRole("dialog", { name: "Confirm broadcast notice" }),
    ).toBeInTheDocument();
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByText("Example notice")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm and send" }));
    await waitFor(() => expect(send).toHaveBeenCalledOnce());
    expect(JSON.parse(send.mock.calls[0][1].body)).toEqual({
      title: "The Man Van Operations",
      body: "Example notice",
      url: "/?tab=jobs",
    });
    vi.unstubAllGlobals();
  });
  it("prevents sending when the recipient source fails", async () => {
    mocks.fetchDrivers.mockRejectedValueOnce(new Error("No roster"));
    setup();
    expect(
      await screen.findByText("Could not load recipients"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Preview notice" }),
    ).toBeDisabled();
  });
});
