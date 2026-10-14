import React from "react";
import { Search, Download, RefreshCw } from "lucide-react";
import { DateRangePicker } from "./DateRangePicker";
import { AdminFilterBar } from "./AdminFilterBar";

interface Props {
  title: string;
  viewSwitcher?: React.ReactNode;
  icon: React.ElementType;
  status?: string;
  statusColor?: "green" | "amber" | "gray";
  search: string;
  onSearchChange: (s: string) => void;
  searchPlaceholder?: string;
  driverFilter?: string;
  onDriverFilterChange?: (initials: string) => void;
  driverOptions?: Array<{ initials: string; fullName?: string }>;
  driverOptionsLoading?: boolean;
  from?: string;
  to?: string;
  onDateChange: (f?: string, t?: string) => void;
  itemCount: number;
  isFetching: boolean;
  onRefresh: () => void;
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (p: number) => void;
  tableHeader: React.ReactNode;
  tableBody: React.ReactNode;
  mobileRows?: React.ReactNode;
  onExportCsv?: () => void;
  onOriginalExportCsv?: () => void;
  onClearFilters?: () => void;
  hasFilters?: boolean;
  secondaryAction?: React.ReactNode;
  notice?: React.ReactNode;
  countLabel?: React.ReactNode;
}

export function SubmissionPageTemplate({ title, viewSwitcher, search, onSearchChange, searchPlaceholder = "Search this page", driverFilter,
  onDriverFilterChange, driverOptions, driverOptionsLoading = false, from, to, onDateChange, itemCount, isFetching, onRefresh,
  page, pageSize, totalItems, onPageChange, tableHeader, tableBody, mobileRows, onExportCsv, onOriginalExportCsv, onClearFilters, hasFilters, secondaryAction, notice, countLabel }: Props) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  return <div className="max-w-[1440px] mx-auto space-y-4 pb-8">
    <AdminFilterBar dates={<DateRangePicker scope="report" from={from} to={to} onChange={onDateChange} />} count={countLabel || <>{search ? `${itemCount} matches on page · ` : ""}{totalItems} {totalItems === 1 ? "record" : "records"} in range</>}>
      {onDriverFilterChange && <select aria-label="Filter by driver" value={driverFilter || ""} onChange={event => onDriverFilterChange(event.target.value)} disabled={driverOptionsLoading} className="shrink-0 h-10 px-3 rounded-card border border-admin-line/50 bg-admin-surface text-sm text-admin-ink"><option value="">{driverOptionsLoading ? "Loading drivers…" : "All drivers"}</option>{!driverOptionsLoading && (driverOptions || []).map(driver => <option key={driver.initials} value={driver.initials}>{driver.fullName || driver.initials}</option>)}</select>}
      <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-3 w-4 h-4 text-admin-muted" /><input aria-label="Search submissions" type="search" placeholder={searchPlaceholder} value={search} onChange={event => onSearchChange(event.target.value)} className="w-full pl-9 pr-4 h-10 rounded-card bg-admin-surface border border-admin-line/50 text-sm text-admin-ink focus:border-admin-brand focus:ring-1 focus:ring-admin-brand outline-none transition" /></div>
      {viewSwitcher}
      {hasFilters && onClearFilters && <button onClick={onClearFilters} className="h-10 px-3 rounded-card text-sm font-medium text-admin-brand hover:bg-admin-brand-soft">Clear filters</button>}
      <button onClick={onRefresh} className="shrink-0 w-10 h-10 rounded-card flex items-center justify-center border border-admin-line/50 bg-admin-surface text-admin-muted hover:text-admin-ink" title="Refresh Data" aria-label="Refresh Data"><RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} /></button>
      {onExportCsv && <button onClick={onExportCsv} className="h-10 px-3 rounded-card flex items-center gap-2 border border-admin-line/50 bg-white text-sm text-admin-ink" title="Export current page CSV" aria-label="Export current page CSV"><Download size={16} />Export page CSV</button>}
      {onOriginalExportCsv && <details className="relative"><summary className="h-10 w-10 grid place-items-center cursor-pointer text-admin-muted" aria-label="Other export options">•••</summary><div className="absolute z-20 right-0 p-3 bg-white border border-admin-line rounded-card shadow-sm w-60"><button onClick={onOriginalExportCsv} className="text-sm font-medium text-admin-ink">Original CSV export</button><p className="text-xs text-admin-muted mt-2">Original export scope has not been verified. It may include records outside these filters.</p></div></details>}
      {secondaryAction}
    </AdminFilterBar>
    {notice}
    <div className="bg-white rounded-module border border-admin-line overflow-hidden">
      <div className={mobileRows ? "hidden md:block overflow-x-auto" : "overflow-x-auto"}>
        <table aria-label={`${title} records`} className="w-full text-left text-sm border-collapse"><thead className="bg-admin-surface border-b border-admin-line"><tr>{tableHeader}</tr></thead><tbody className="divide-y divide-admin-line">{tableBody}</tbody></table>
      </div>
      {mobileRows && <div className="md:hidden divide-y divide-admin-line">{mobileRows}</div>}
      {totalItems > 0 && <div className="px-4 py-3 border-t border-admin-line flex flex-wrap items-center justify-between gap-3 text-sm text-admin-muted">
        <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalItems)} of {totalItems} records{search ? " · search applies to this page" : ""}</span>
        {totalPages > 1 && <div className="flex gap-2"><button disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))} className="h-10 px-3 rounded-control border border-admin-line disabled:opacity-50">Prev</button><span className="self-center">{page} / {totalPages}</span><button disabled={page >= totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))} className="h-10 px-3 rounded-control border border-admin-line disabled:opacity-50">Next</button></div>}
      </div>}
    </div>
    {onExportCsv && <p className="text-xs text-admin-muted">Page CSV includes the displayed records, active filters and London timezone. Use an individual record PDF for its full evidence.</p>}
  </div>;
}
