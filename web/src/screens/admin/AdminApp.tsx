import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { adminLogout, fetchAdminSession } from "../../api/admin";
import { AdminLoginScreen } from "./AdminLoginScreen";
import { Layout } from "./dashboard/Layout";
import { OverviewPage } from "./dashboard/pages/OverviewPage";
import { LiveFleetPage } from "./dashboard/pages/LiveFleetPage";
import { JobsPage } from "./dashboard/pages/JobsPage";
import { VanMileagePage } from "./dashboard/pages/VanMileagePage";
import { FinishedJobsPage } from "./dashboard/pages/FinishedJobsPage";
import { NotificationsAlertsPage } from "./dashboard/pages/NotificationsAlertsPage";
import { DriversPage } from "./dashboard/pages/DriversPage";
import { DriverReportPage } from "./dashboard/pages/DriverReportPage";
import { LiabilityPage, LIABILITY_SECTIONS } from "./dashboard/pages/LiabilityPage";
import { ConfigurationsPage, CONFIGURATION_SECTIONS } from "./dashboard/pages/ConfigurationsPage";
import { MaintenancePage } from "./dashboard/pages/MaintenancePage";
import { useServiceWorkerUpdate } from "../pwa-settings/hooks/useServiceWorkerUpdate";

/**
 * Entry point for the /admin path on dashboard.themanvan.co.uk (see App.tsx's
 * hostname+pathname check). Fully independent of the driver login flow -- its own
 * session cookie (tmv_admin_session), its own password, mounted at /api/admin.
 *
 * The bulk of this -- Layout + all 13 pages -- is TMV-Chat-bot's dashboard/web ported
 * into tmv-pwa (see ./dashboard/*), so this domain can run entirely off tmv-pwa's own
 * Mongo backend instead of the retired Sheets/Drive-dependent project.
 */
export function AdminApp() {
  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("overview");

  useEffect(() => {
    fetchAdminSession()
      .then(setLoggedIn)
      .finally(() => setChecking(false));
  }, []);

  // The dashboard is a desktop ops tool, not an offline PWA -- when a new build ships
  // there is no value in a "refresh available?" prompt (that's the driver app's
  // UpdateBanner). Apply a waiting service-worker update automatically so a deploy
  // lands within a poll cycle instead of being stuck behind the cache until every tab
  // is closed. The reload is loop-guarded in the registration singleton; the short
  // delay lets React settle first.
  const { needRefresh, applyUpdate } = useServiceWorkerUpdate();
  useEffect(() => {
    if (!needRefresh) return;
    const t = setTimeout(() => void applyUpdate(), 2000);
    return () => clearTimeout(t);
  }, [needRefresh, applyUpdate]);

  // Device notification permission is a deliberate action in Settings.

  /**
   * Section state lives in ?section=. pushState was already being called on every
   * change, but nothing listened for popstate -- so the browser's Back button changed
   * the URL and left the UI on the same page, which is worse than not pushing history
   * at all. This listener closes that loop.
   */
  useEffect(() => {
    const readSection = (event?: PopStateEvent) => {
      // Native history has already moved the URL. Ask the active editor before
      // this early listener changes section state and unmounts that editor.
      if (event?.isTrusted && !window.dispatchEvent(new CustomEvent("tmv:before-navigate", {
        detail: { href: window.location.pathname + window.location.search, history: true },
        cancelable: true,
      }))) return;
      const params = new URLSearchParams(window.location.search);
      const sec = params.get("section");
      const job = params.get("job");
      if (!sec && job) {
        setActiveSection("jobs");
        return;
      }
      const aliases: Record<string,string> = { vehicles: "van", finance: "overview" };
      const known = ["overview", "jobs", "finished", "driverreport", "drivers", "livefleet", "van", "notifications", "configurations", "liabilities", "maintenance", ...LIABILITY_SECTIONS, ...CONFIGURATION_SECTIONS, "alerts"];
      const resolved = aliases[sec || ""] || (known.includes(sec || "") ? sec : "overview");
      setActiveSection(LIABILITY_SECTIONS.includes(resolved || "") ? "liabilities" : resolved === "alerts" ? "notifications" : CONFIGURATION_SECTIONS.includes(resolved || "") ? "configurations" : resolved || "overview");
    };
    readSection();
    window.addEventListener("popstate", readSection);
    return () => window.removeEventListener("popstate", readSection);
  }, []);

  function handleSelectSection(section: string) {
    if (section === activeSection) return; // don't stack duplicate history entries
    const url = new URL(window.location.pathname, window.location.origin);
    url.searchParams.set("section", section);
    const next = url.pathname + url.search;
    if (!window.dispatchEvent(new CustomEvent("tmv:before-navigate", { detail: { href: next }, cancelable: true }))) return;
    window.history.pushState({ section }, "", next);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  async function performLogout() {
    try {
      await adminLogout();
    } finally {
      setLoggedIn(false);
    }
  }

  function handleLogout() {
    if (window.dispatchEvent(new CustomEvent("tmv:before-navigate", { detail: { href: window.location.pathname, proceed: performLogout }, cancelable: true }))) void performLogout();
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-admin-bg">
        <Loader2 className="w-6 h-6 animate-spin text-admin-muted" />
      </div>
    );
  }

  if (!loggedIn) {
    return <AdminLoginScreen onLoggedIn={() => setLoggedIn(true)} />;
  }

  return (
    <Layout activeSection={activeSection} onSelectSection={handleSelectSection} onLogout={handleLogout}>
      {activeSection === "overview" && <OverviewPage onSelectSection={handleSelectSection} />}
      {activeSection === "livefleet" && <LiveFleetPage onSelectSection={handleSelectSection} />}
      {activeSection === "jobs" && <JobsPage />}
      {activeSection === "van" && <VanMileagePage />}
      {activeSection === "finished" && <JobsPage initialStatus="Finished" />}
      {activeSection === "notifications" && <NotificationsAlertsPage />}
      {activeSection === "liabilities" && <LiabilityPage />}
      {activeSection === "drivers" && <DriversPage />}
      {activeSection === "driverreport" && <DriverReportPage />}
      {activeSection === "configurations" && <ConfigurationsPage />}
      {activeSection === "maintenance" && <MaintenancePage />}
    </Layout>
  );
}
