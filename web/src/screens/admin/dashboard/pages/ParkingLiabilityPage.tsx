import React from "react";
import { ScenariosPage } from "./ScenariosPage";
import { ScenarioFilterControl } from "../hooks/useScenarioFilters";

/** Retain the legacy parking entry point while sharing the evidence record pattern. */
export function ParkingLiabilityPage({ filterControl, viewSwitcher }: { filterControl?: ScenarioFilterControl; viewSwitcher?: React.ReactNode } = {}) {
  return <ScenariosPage kind="parking" filterControl={filterControl} viewSwitcher={viewSwitcher} />;
}
