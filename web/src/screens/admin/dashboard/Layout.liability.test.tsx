import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Layout } from "./Layout";
vi.mock("../../../api/admin", async (original) => ({
  ...(await original<typeof import("../../../api/admin")>()),
  fetchAdminProfile: vi
    .fn()
    .mockResolvedValue({ email: "admin@example.invalid" }),
}));
vi.mock("./utils/useOperationalAttention", () => ({
  useOperationalAttention: () => ({ items: [{ id: "issue" }], errors: [] }),
}));
vi.mock("./pages/ApiSettingsPage", () => ({ ApiSettingsPage: () => null }));
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
function mount(section: string = "overview", select = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Layout activeSection={section} onSelectSection={select}>
        <div>Content</div>
      </Layout>
    </QueryClientProvider>,
  );
  return select;
}
describe("eight-destination navigation", () => {
  it("keeps exact labels and order in expanded and collapsed states", () => {
    mount();
    const nav = screen.getByRole("navigation");
    const names = () =>
      within(nav)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label"));
    const expected = [
      "Overview",
      "Jobs",
      "Live Fleet",
      "Drivers",
      "Vehicles",
      "Evidence & Liability",
      "Alerts",
      "Settings",
    ];
    expect(names()).toEqual(expected);
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(names()).toEqual(expected);
    expect(
      within(nav)
        .getAllByRole("button")
        .every((button) => !!button.getAttribute("title")),
    ).toBe(true);
  });
  it.each([
    ["driverreport", "Drivers"],
    ["finished", "Jobs"],
    ["parking", "Evidence & Liability"],
    ["alerts", "Alerts"],
    ["pricing", "Settings"],
    ["messaging", "Settings"],
  ])("highlights the correct parent for legacy %s", (section, label) => {
    mount(section);
    expect(
      within(screen.getByRole("navigation")).getByRole("button", {
        name: label,
      }),
    ).toHaveAttribute("aria-current", "page");
  });
  it("opens the same operational attention source through the bell", () => {
    const select = mount();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Open operational alerts, 1 recorded feed issues",
      }),
    );
    expect(select).toHaveBeenCalledWith("notifications");
  });
});
