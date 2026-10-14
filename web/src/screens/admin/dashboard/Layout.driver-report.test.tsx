import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Layout } from "./Layout";
vi.mock("../../../api/admin", async (original) => ({
  ...(await original<typeof import("../../../api/admin")>()),
  fetchAdminProfile: vi
    .fn()
    .mockResolvedValue({ email: "admin@example.invalid" }),
}));
vi.mock("./utils/useOperationalAttention", () => ({
  useOperationalAttention: () => ({ items: [], errors: [] }),
}));
vi.mock("./pages/ApiSettingsPage", () => ({ ApiSettingsPage: () => null }));
const layout = (client: QueryClient, section: string) => (
  <QueryClientProvider client={client}>
    <Layout activeSection={section} onSelectSection={vi.fn()}>
      <div>Report content</div>
    </Layout>
  </QueryClientProvider>
);
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});
afterEach(() => vi.unstubAllGlobals());
describe("sidebar preference", () => {
  it("preserves expanded sidebar when entering and leaving reports", () => {
    const client = new QueryClient();
    const { rerender } = render(layout(client, "drivers"));
    rerender(layout(client, "driverreport"));
    expect(
      screen.getByRole("button", { name: "Collapse sidebar" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Drivers" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    rerender(layout(client, "jobs"));
    expect(
      screen.getByRole("button", { name: "Collapse sidebar" }),
    ).toBeInTheDocument();
  });
  it("retains a collapsed preference across navigation and remount", () => {
    const client = new QueryClient();
    const { rerender, unmount } = render(layout(client, "overview"));
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    rerender(layout(client, "driverreport"));
    expect(
      screen.getByRole("button", { name: "Expand sidebar" }),
    ).toBeInTheDocument();
    unmount();
    render(layout(client, "overview"));
    expect(
      screen.getByRole("button", { name: "Expand sidebar" }),
    ).toBeInTheDocument();
  });
  it("closes mobile navigation on report entry and removes hidden links from focus", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    const client = new QueryClient();
    const { rerender } = render(layout(client, "overview"));
    const button = screen.getByRole("button", { name: "Open navigation menu" });
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    rerender(layout(client, "driverreport"));
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(
      document.querySelector('aside[aria-label="Main navigation"]'),
    ).toHaveAttribute("inert");
  });
});
