import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationsPage } from "./NotificationsPage";
const mocks = vi.hoisted(() => ({
  fetchNotifications: vi.fn(),
  dismissNotifications: vi.fn(),
}));
vi.mock("../api", () => mocks);
vi.mock("../components/SendBroadcastPushModal", () => ({
  SendBroadcastPushModal: () => null,
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  window.history.replaceState(
    {},
    "",
    "/admin?section=notifications&notificationsTab=notifications&from=2026-10-01&to=2026-10-20",
  );
});
function setup() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <NotificationsPage />
    </QueryClientProvider>,
  );
}
describe("Delivery states", () => {
  it("does not render invalid empty pagination", async () => {
    mocks.fetchNotifications.mockResolvedValue({ rows: [] });
    setup();
    expect(
      await screen.findByText("No delivery records available"),
    ).toBeInTheDocument();
    expect(screen.getByText("0 matching records")).toBeInTheDocument();
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();
  });
  it("shows API failure separately from a quiet log", async () => {
    mocks.fetchNotifications.mockRejectedValue(
      new Error("Delivery source unavailable"),
    );
    setup();
    expect(
      await screen.findByText("Delivery source unavailable"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("No delivery records available"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });
  it("shows both channels in compact mobile rows without horizontal table scrolling", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    mocks.fetchNotifications.mockResolvedValue({
      rows: [
        {
          jobId: "job-mobile",
          customerName: "Example customer",
          driverInitials: "EX",
          customerEmail: "",
          customerPhone: "",
          actualStart: "2026-10-13T09:00:00Z",
          email: { state: "sent", detail: "", at: "" },
          sms: { state: "failed", detail: "", at: "" },
        },
      ],
    });
    setup();
    expect(
      await screen.findByRole("button", { name: "Open job job-mobile" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Email" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "SMS" })).toBeInTheDocument();
    expect(
      screen.getByText("Failed", { selector: "span" }),
    ).toBeInTheDocument();
  });
  it("keeps sent, disabled and read distinct and opens the exact related job", async () => {
    mocks.fetchNotifications.mockResolvedValue({
      rows: [
        {
          jobId: "job-example",
          customerName: "Example customer",
          driverInitials: "EX",
          customerEmail: "",
          customerPhone: "",
          actualStart: "2026-10-13T09:00:00Z",
          email: {
            state: "sent",
            detail: "Provider accepted",
            at: "2026-10-13T09:01:00Z",
          },
          sms: { state: "disabled", detail: "", at: "" },
        },
      ],
    });
    setup();
    expect(await screen.findByText("Disabled")).toBeInTheDocument();
    expect(screen.queryByText("Delivered")).not.toBeInTheDocument();
    expect(screen.queryByText("Read")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Open job job-example" }),
    );
    expect(new URLSearchParams(location.search).get("job")).toBe("job-example");
  });
});
