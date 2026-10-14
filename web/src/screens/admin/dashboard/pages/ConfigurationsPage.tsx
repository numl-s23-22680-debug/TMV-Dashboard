import React, { useEffect, useState } from "react";
import { SegmentedControl } from "../../../../ui";
import { navigateAdmin } from "../utils/reportNavigation";
import { PricingSettingsPage } from "./PricingSettingsPage";
import { MessagingPage } from "./MessagingPage";
import { DeviceNotificationsSettings } from "../components/DeviceNotificationsSettings";

export const CONFIGURATION_SECTIONS = [
  "configurations",
  "pricing",
  "messaging",
  "settings",
] as readonly string[];
type ConfigurationTab = "pricing" | "messaging" | "device";
function currentTab(): ConfigurationTab {
  const params = new URLSearchParams(window.location.search);
  const section = params.get("section");
  if (section === "messaging") return "messaging";
  if (section === "pricing") return "pricing";
  const tab = params.get("configurationTab");
  return tab === "messaging" || tab === "device" ? tab : "pricing";
}

export function ConfigurationsPage() {
  const [tab, setTab] = useState(currentTab);
  useEffect(() => {
    const read = () => setTab(currentTab());
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  const selectTab = (next: ConfigurationTab) => {
    if (next === tab) return;
    const url = new URL(window.location.href);
    url.searchParams.set("section", "configurations");
    url.searchParams.set("configurationTab", next);
    navigateAdmin(url.pathname + url.search);
  };
  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <div className="flex justify-end">
        <SegmentedControl
          aria-label="Settings views"
          value={tab}
          onChange={selectTab}
          className="grid w-full grid-cols-3 sm:inline-flex sm:w-auto [&_button]:min-w-0 [&_button]:h-auto [&_button]:min-h-11 [&_button]:whitespace-normal sm:[&_button]:h-9 sm:[&_button]:min-h-0 sm:[&_button]:whitespace-nowrap"
          options={[
            { value: "pricing" as const, label: "Pricing" },
            { value: "messaging" as const, label: "Message templates" },
            { value: "device" as const, label: "Device notifications" },
          ]}
        />
      </div>
      {tab === "pricing" ? (
        <PricingSettingsPage />
      ) : tab === "messaging" ? (
        <MessagingPage />
      ) : (
        <DeviceNotificationsSettings />
      )}
    </div>
  );
}
