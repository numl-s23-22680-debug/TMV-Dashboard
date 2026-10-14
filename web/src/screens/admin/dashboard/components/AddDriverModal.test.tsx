import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddDriverModal } from "./AddDriverModal";
import { DriverSummaryItem } from "../types";
const mocks = vi.hoisted(() => ({ save: vi.fn(), close: vi.fn() }));
vi.mock("../api", () => ({ fetchDrivers: vi.fn().mockResolvedValue({ drivers: [] }), fetchLiveFleet: vi.fn().mockResolvedValue({ vehicles: [] }), saveDriver: mocks.save }));
const mount = (driver?: DriverSummaryItem) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AddDriverModal isOpen onClose={mocks.close} driverToEdit={driver} /></QueryClientProvider>);
describe("Driver form", () => {
  beforeEach(() => { mocks.save.mockReset(); mocks.close.mockReset(); });
  it("validates identity fields inline and retains entered values after a save failure", async () => {
    mocks.save.mockRejectedValue(new Error("Synthetic save failure"));
    mount(); fireEvent.click(screen.getByRole("button", { name: "Add driver" }));
    expect(screen.getByText("Enter a full name.")).toBeInTheDocument(); expect(mocks.save).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Full name *"), { target: { value: "QA Driver" } });
    fireEvent.change(screen.getByLabelText("Email address *"), { target: { value: "qa@example.invalid" } });
    fireEvent.click(screen.getByRole("button", { name: "Add driver" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Full name *")).toHaveValue("QA Driver"); expect(screen.getByLabelText("Email address *")).toHaveValue("qa@example.invalid");
    expect(mocks.close).not.toHaveBeenCalled();
  });
  it("keeps an offline tracker assignment and omits an unchanged password", async () => {
    mocks.save.mockResolvedValue({});
    mount({ initials: "QA", fullName: "QA Driver", email: "qa@example.invalid", active: true, imei: "offline-device", vanRegistration: "QA12 ABC" } as DriverSummaryItem);
    expect(screen.getByLabelText("Tracker")).toHaveValue("offline-device");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(mocks.save.mock.calls[0][0].imei).toBe("offline-device"); expect(mocks.save.mock.calls[0][0]).not.toHaveProperty("password");
    await waitFor(() => expect(mocks.close).toHaveBeenCalled());
  });
});
