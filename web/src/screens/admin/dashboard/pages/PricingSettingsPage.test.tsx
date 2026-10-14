import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PricingSettingsPage } from "./PricingSettingsPage";
const mocks = vi.hoisted(() => ({
  fetchSettings: vi.fn(),
  saveSetting: vi.fn(),
}));
vi.mock("../api", () => mocks);
const settings = [
  {
    key: "CREW_RATE_1_MAN",
    label: "One person",
    type: "number",
    fallback: "35",
    value: "35",
  },
  {
    key: "PACKING_RATE",
    label: "Packing",
    type: "number",
    fallback: "60",
    value: "60",
  },
  {
    key: "CONGESTION_CHARGE",
    label: "Congestion",
    type: "number",
    fallback: "15",
    value: "15",
  },
  {
    key: "TUNNEL_CHARGE",
    label: "Tunnel",
    type: "number",
    fallback: "4",
    value: "4",
  },
  {
    key: "OVERTIME_RATE_PER_30",
    label: "Overtime",
    type: "number",
    fallback: "",
    value: "",
  },
  {
    key: "OVERTIME_GRACE_MINS",
    label: "Grace",
    type: "number",
    fallback: "5",
    value: "5",
  },
];
beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchSettings.mockResolvedValue({ settings });
  mocks.saveSetting.mockResolvedValue(undefined);
  window.history.replaceState({}, "", "/admin?section=configurations");
});
async function setup() {
  render(<PricingSettingsPage />);
  return await screen.findByLabelText(/1-person crew/);
}
describe("Pricing save outcomes", () => {
  it("discards to the latest saved baseline after save, edit, discard", async () => {
    const crew = await setup();
    fireEvent.change(crew, { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText("1 change saved.");
    fireEvent.change(crew, { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(crew).toHaveValue(40);
    expect(mocks.saveSetting).toHaveBeenCalledWith("CREW_RATE_1_MAN", "40");
    expect(screen.queryByText(/unsaved change/)).not.toBeInTheDocument();
  });
  it("keeps failed fields dirty, updates successful baselines, and retries only unsaved fields", async () => {
    const crew = await setup();
    mocks.saveSetting.mockImplementation(async (key: string) => {
      if (key === "PACKING_RATE") throw new Error("Temporary failure");
    });
    fireEvent.change(crew, { target: { value: "40" } });
    fireEvent.change(screen.getByLabelText("Packing service"), {
      target: { value: "70" },
    });
    fireEvent.change(screen.getByLabelText("Congestion"), {
      target: { value: "20" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText(
      "2 of 3 changes saved. 1 failed; those changes remain unsaved.",
    );
    expect(screen.getByText("1 unsaved change")).toBeInTheDocument();
    expect(
      screen.getByText("Not saved: Temporary failure"),
    ).toBeInTheDocument();
    mocks.saveSetting.mockClear().mockResolvedValue(undefined);
    fireEvent.click(
      screen.getByRole("button", { name: "Retry unsaved changes" }),
    );
    await screen.findByText("1 change saved.");
    expect(mocks.saveSetting).toHaveBeenCalledTimes(1);
    expect(mocks.saveSetting).toHaveBeenCalledWith("PACKING_RATE", "70");
    fireEvent.change(crew, { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(crew).toHaveValue(40);
  });
  it("clears dirtiness when a field is restored manually and validates invalid numeric rates", async () => {
    const crew = await setup();
    fireEvent.change(crew, { target: { value: "-1" } });
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(
      screen.getByText("Enter a valid amount of zero or more."),
    ).toBeInTheDocument();
    fireEvent.change(crew, { target: { value: "35" } });
    expect(
      screen.queryByRole("button", { name: "Save changes" }),
    ).not.toBeInTheDocument();
  });
  it("guards route changes and logout without silently dropping edits", async () => {
    const crew = await setup();
    fireEvent.change(crew, { target: { value: "40" } });
    const logout = vi.fn();
    const event = new CustomEvent("tmv:before-navigate", {
      detail: { href: "/admin", proceed: logout },
      cancelable: true,
    });
    fireEvent(window, event);
    expect(event.defaultPrevented).toBe(true);
    expect(
      screen.getByRole("dialog", { name: "Discard unsaved changes?" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(logout).not.toHaveBeenCalled();
    expect(crew).toHaveValue(40);
    fireEvent(
      window,
      new CustomEvent("tmv:before-navigate", {
        detail: { href: "/admin", proceed: logout },
        cancelable: true,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Discard and continue" }),
    );
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
    expect(crew).toHaveValue(35);
  });
  it("restores the editor URL before a centralized native-history reader changes the screen", async () => {
    const crew = await setup();
    fireEvent.change(crew, { target: { value: "49" } });
    const destination = "/admin?section=jobs&jobsPage=3&search=example";
    // Native traversal moves history first. AdminApp announces it before reading section state.
    window.history.replaceState({}, "", destination);
    const historyEvent = new CustomEvent("tmv:before-navigate", {
      detail: { href: destination, history: true },
      cancelable: true,
    });
    fireEvent(window, historyEvent);
    expect(historyEvent.defaultPrevented).toBe(true);
    expect(new URLSearchParams(location.search).get("section")).toBe(
      "configurations",
    );
    expect(crew).toHaveValue(49);
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(crew).toHaveValue(49);
    window.history.replaceState({}, "", destination);
    fireEvent(
      window,
      new CustomEvent("tmv:before-navigate", {
        detail: { href: destination, history: true },
        cancelable: true,
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Discard and continue" }),
    );
    expect(window.location.pathname + window.location.search).toBe(destination);
    expect(crew).toHaveValue(35);
  });
  it("offers a recoverable load failure", async () => {
    mocks.fetchSettings.mockRejectedValueOnce(new Error("Pricing unavailable"));
    render(<PricingSettingsPage />);
    expect(await screen.findByText("Pricing unavailable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByLabelText("1-person crew")).toHaveValue(35);
  });
});
