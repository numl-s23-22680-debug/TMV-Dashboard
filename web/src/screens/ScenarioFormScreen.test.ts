import { describe, expect, it } from "vitest";
import { SCENARIOS } from "../scenarioSpec";
import { reportedAtChipLabel, scenarioInitialFields } from "./ScenarioFormScreen";

describe("ScenarioFormScreen initial fields", () => {
  it("prefills check-in and checkout client name from the job customer name", () => {
    expect(
      scenarioInitialFields(SCENARIOS.checkin, {
        customerName: "Sample Customer",
        customerEmail: "customer@example.test",
        customerPhone: "07700900102"
      }).client_name
    ).toBe("Sample Customer");

    expect(
      scenarioInitialFields(SCENARIOS.checkout, {
        customerName: "Sample Customer",
        customerEmail: "customer@example.test"
      }).client_name
    ).toBe("Sample Customer");
  });

  it("falls back to clientNamePostcode when the parsed customer name is missing", () => {
    expect(
      scenarioInitialFields(SCENARIOS.checkin, {
        customerName: "",
        clientNamePostcode: "Sample Customer SW18 1HR"
      }).client_name
    ).toBe("Sample Customer SW18 1HR");
  });

  it("falls back to the labelled name in raw Calendar description before clientNamePostcode", () => {
    expect(
      scenarioInitialFields(SCENARIOS.checkout, {
        customerName: "",
        rawDescription: "Client name: Sample Customer\nPhone: 07700900102",
        clientNamePostcode: "Wrong Fallback SW18"
      }).client_name
    ).toBe("Sample Customer");
  });
});

describe("reportedAtChipLabel", () => {
  it("shows only the selected checkpoint label, not the address", () => {
    expect(reportedAtChipLabel({ label: "Pickup", address: "10 High Street" })).toBe("Pickup");
    expect(reportedAtChipLabel({ label: "Drop-off", address: "20 Low Street" })).toBe("Drop-off");
    expect(reportedAtChipLabel(undefined)).toBe("");
  });
});
