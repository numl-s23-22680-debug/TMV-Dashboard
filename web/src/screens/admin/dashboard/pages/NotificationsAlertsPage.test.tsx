import React, { useEffect } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationsAlertsPage } from "./NotificationsAlertsPage";

const mocks = vi.hoisted(() => ({ notifications: vi.fn(), alerts: vi.fn() }));
vi.mock("./NotificationsPage", () => ({
  NotificationsPage: () => {
    useEffect(() => mocks.notifications(), []);
    return <div>Existing notifications page</div>;
  },
}));
vi.mock("../components/OperationalAttentionPanel", () => ({
  OperationalAttentionPanel: () => <div>Recorded operational issues</div>,
}));
vi.mock("./AlertsPage", () => ({
  AlertsPage: () => {
    useEffect(() => mocks.alerts(), []);
    return <div>Existing alerts page</div>;
  },
}));
beforeEach(() => {
  window.history.replaceState({}, "", "/admin?section=notifications");
  vi.clearAllMocks();
});

describe("Combined Notifications & Alerts", () => {
  it("defaults to Needs attention and keeps delivery logs secondary", () => {
    render(<NotificationsAlertsPage />);
    expect(
      screen.getByRole("radio", { name: "Needs attention" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radiogroup").parentElement).toHaveClass(
      "justify-end",
    );
    expect(screen.getByText("Recorded operational issues")).toBeInTheDocument();
    expect(mocks.notifications).not.toHaveBeenCalled();
  });
  it("switches existing pages, retains URL filters and supports history restoration", () => {
    window.history.replaceState(
      {},
      "",
      "/admin?section=notifications&notificationsTab=notifications&from=2026-10-10&to=2026-10-11",
    );
    render(<NotificationsAlertsPage />);
    fireEvent.click(screen.getByRole("radio", { name: "Needs attention" }));
    expect(screen.getByText("Recorded operational issues")).toBeInTheDocument();
    expect(
      screen.queryByText("Existing notifications page"),
    ).not.toBeInTheDocument();
    expect(new URLSearchParams(location.search).get("from")).toBe("2026-10-10");
    expect(new URLSearchParams(location.search).get("notificationsTab")).toBe(
      "alerts",
    );
    fireEvent.click(screen.getByRole("radio", { name: "Delivery log" }));
    expect(screen.getByText("Existing notifications page")).toBeInTheDocument();
    window.history.replaceState(
      {},
      "",
      "/admin?section=notifications&notificationsTab=alerts",
    );
    fireEvent(window, new PopStateEvent("popstate"));
    expect(
      screen.getByRole("radio", { name: "Needs attention" }),
    ).toHaveAttribute("aria-checked", "true");
  });
  it("opens the Alerts view for legacy section=alerts links", () => {
    window.history.replaceState({}, "", "/admin?section=alerts");
    render(<NotificationsAlertsPage />);
    expect(
      screen.getByRole("radio", { name: "Needs attention" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(mocks.notifications).not.toHaveBeenCalled();
  });
});
