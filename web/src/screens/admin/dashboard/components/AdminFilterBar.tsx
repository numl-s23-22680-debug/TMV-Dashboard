import React from "react";

export function AdminFilterBar({ dates, count, children, embedded = false }: { dates: React.ReactNode; count?: React.ReactNode; children?: React.ReactNode; embedded?: boolean }) {
  return <div className={`ops-filter-bar p-3 bg-white flex flex-col gap-3 ${embedded ? "embedded border-b border-admin-line" : "rounded-card border border-admin-line"}`}>
    <div role="group" aria-label="Date filters" className="ops-filter-dates flex flex-wrap items-center gap-3 min-w-0">
      {dates}
      {count && <span className="ops-filter-count ml-auto px-2 text-sm text-admin-muted font-medium whitespace-nowrap">{count}</span>}
    </div>
    {children && <div role="group" aria-label="Other filters" className="ops-filter-controls flex flex-wrap items-center gap-3 min-w-0">{children}</div>}
  </div>;
}
