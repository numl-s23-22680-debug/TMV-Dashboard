import React, { useEffect, useState } from "react";
import { SegmentedControl } from "../../../../ui";
import { navigateAdmin } from "../utils/reportNavigation";
import { NotificationsPage } from "./NotificationsPage";
import { AlertsPage } from "./AlertsPage";
import { OperationalAttentionPanel } from "../components/OperationalAttentionPanel";

type NotificationsTab = "notifications" | "alerts";
function currentTab(): NotificationsTab {
  const params = new URLSearchParams(window.location.search);
  return params.get("notificationsTab") === "notifications"
    ? "notifications"
    : "alerts";
}

export function NotificationsAlertsPage() {
  const [tab, setTab] = useState(currentTab);
  const [historyOpen, setHistoryOpen] = useState(false);
  useEffect(() => {
    const read = () => setTab(currentTab());
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  const selectTab = (next: NotificationsTab) => {
    if (next === tab) return;
    const url = new URL(window.location.href);
    url.searchParams.set("section", "notifications");
    url.searchParams.set("notificationsTab", next);
    navigateAdmin(url.pathname + url.search);
  };
  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <div className="flex justify-end">
        <SegmentedControl
          aria-label="Alerts views"
          value={tab}
          onChange={selectTab}
          options={[
            { value: "alerts" as const, label: "Needs attention" },
            { value: "notifications" as const, label: "Delivery log" },
          ]}
        />
      </div>
      {tab === "notifications" ? (
        <NotificationsPage />
      ) : (
        <>
          <OperationalAttentionPanel />
          <details
            onToggle={(event) => setHistoryOpen(event.currentTarget.open)}
            className="rounded-module border border-admin-line bg-white p-4"
          >
            <summary className="cursor-pointer text-[14px] font-medium text-fg">
              All tracker events · history and filters
            </summary>
            {historyOpen && (
              <div className="mt-5">
                <AlertsPage />
              </div>
            )}
          </details>
        </>
      )}
    </div>
  );
}
