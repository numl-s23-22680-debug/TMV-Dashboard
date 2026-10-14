import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { recordReturnHref, reportReturnHref } from "../utils/reportNavigation";

const returnTarget = () => reportReturnHref() || recordReturnHref();

export function ReportReturnButton({ compact = false }: { compact?: boolean }) {
  const [href, setHref] = useState(returnTarget);
  useEffect(() => {
    const read = () => setHref(returnTarget());
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  if (!href) return null;
  const section = new URL(href, window.location.origin).searchParams.get("section") || "overview";
  const labels: Record<string, string> = { livefleet: "Live Fleet", overview: "Overview", drivers: "Drivers", van: "Vehicles", liabilities: "Evidence & Liability", notifications: "Alerts", alerts: "Alerts" };
  const label = reportReturnHref() ? "Back to driver report" : `Back to ${labels[section] || "Overview"}`;
  return <button type="button" title={label} aria-label={label}
    className="no-print inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border border-admin-line bg-white px-3 py-2 text-[13px] font-medium text-admin-brand hover:bg-admin-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-admin-brand"
    onClick={() => { const target = returnTarget(); if (!target) return; window.history.replaceState({}, "", target); window.dispatchEvent(new PopStateEvent("popstate")); }}>
    <ArrowLeft className="h-4 w-4 shrink-0" /><span className={compact ? "hidden sm:inline" : ""}>{label}</span>
  </button>;
}
