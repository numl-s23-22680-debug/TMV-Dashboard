import React, { useEffect, useId, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DateTime } from "luxon";
import {
  ArrowRight,
  Wallet,
  CheckCircle2,
  Clock3,
  Users,
  RefreshCw,
  FileText,
  BarChart3,
  Grid2X2,
  PieChart as PieChartIcon,
  ArrowUpRight,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchSummary } from "../api";
import { AdminFilterBar } from "../components/AdminFilterBar";
import {
  DateRangePicker,
  defaultDashboardDateRange,
} from "../components/DateRangePicker";
import {
  PageHeader,
  MetricCard,
  DataState,
  CoverageNotice,
} from "../components/OperationsUI";
import { JobStatusBadge } from "../components/StatusBadge";
import {
  AuroraDonut,
  AuroraRadialMetric,
  AuroraStatusDistribution,
} from "../components/AuroraCharts";
import { fetchOverviewJobs, jobAttentionReasons } from "../utils/overview";
import {
  activityDays,
  bookingActivityDays,
  groupActivity,
  operationalDistribution,
  storedChargeSummary,
  type ActivityPeriod,
  type ActivityPoint,
} from "../utils/auroraAnalytics";
import { navigateAdmin, retainRangeInUrl } from "../utils/reportNavigation";
import { formatLondonDate, formatLondonTimeOnly } from "../utils/date";
import { jobMoney } from "../utils/jobPresentation";
import "../styles/aurora-overview.css";

interface Props {
  onSelectSection?: (id: string) => void;
}
type ActivityView = "trends" | "distribution" | "heatmap";
const amount = (value: number | undefined | null) =>
  value == null || !Number.isFinite(value)
    ? "Not recorded"
    : new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
      }).format(value);
const dateLabel = (value: string) =>
  DateTime.fromISO(value, { zone: "Europe/London" }).toFormat("d LLL");
const chartTooltipStyle = {
  background: "var(--aurora-card, #fff)",
  color: "var(--aurora-ink, #20213b)",
  border: "1px solid var(--aurora-line, #e8e4f1)",
  borderRadius: 14,
  boxShadow: "0 8px 30px rgba(31,25,76,.12)",
  fontSize: 13,
};

function ActivityData({
  points,
  period,
  basis = "summary",
}: {
  points: ActivityPoint[];
  period: ActivityPeriod;
  basis?: "summary" | "bookings";
}) {
  return (
    <details className="ops-chart-data aurora-chart-data">
      <summary>View activity values and basis</summary>
      <p>
        {basis === "bookings"
          ? "Jobs grouped by booked start in London time. All workflow statuses are included. A zero requires complete selected-range records and valid booked timestamps."
          : "Daily job counts as reported by the summary API. The backend daily date basis is not independently verified; no status-transition interpretation is inferred. Weekly/monthly groups cover only the selected range. Missing daily values and incomplete groups remain unknown."}
      </p>
      <div className="aurora-data-scroll">
        <table>
          <thead>
            <tr>
              <th>Period · London</th>
              <th>Jobs</th>
              <th>Coverage</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.date}>
                <td>
                  {formatLondonDate(point.date)}
                  {period !== "day" &&
                    point.endDate !== point.date &&
                    ` – ${formatLondonDate(point.endDate)}`}
                </td>
                <td>
                  {point.jobsCount == null
                    ? point.knownJobs > 0
                      ? `${point.knownJobs} known subtotal`
                      : "Not recorded"
                    : point.jobsCount}
                </td>
                <td>
                  {point.knownDays} of {point.expectedDays} days recorded
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function OverviewPage({ onSelectSection }: Props) {
  const [from, setFrom] = useState<string | undefined>(
    () =>
      new URLSearchParams(location.search).get("from") ||
      defaultDashboardDateRange().from,
  );
  const [to, setTo] = useState<string | undefined>(
    () =>
      new URLSearchParams(location.search).get("to") ||
      defaultDashboardDateRange().to,
  );
  const [activityView, setActivityView] = useState<ActivityView>(() => {
    try {
      const saved = localStorage.getItem("tmv:overview-chart-view");
      return saved === "heatmap" || saved === "distribution" ? saved : "trends";
    } catch {
      return "trends";
    }
  });
  const [period, setPeriod] = useState<ActivityPeriod>("day");
  const id = useId().replaceAll(":", "");
  const summary = useQuery({
    queryKey: ["summary", from, to],
    queryFn: () => fetchSummary(from, to),
  });
  const jobs = useQuery({
    queryKey: ["overview-jobs", from, to],
    queryFn: () => fetchOverviewJobs(from, to),
  });
  useEffect(() => {
    const read = () => {
      const params = new URLSearchParams(location.search);
      setFrom(params.get("from") || defaultDashboardDateRange().from);
      setTo(params.get("to") || defaultDashboardDateRange().to);
    };
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  const attention = (jobs.data?.items || [])
    .map((job) => ({ job, reasons: jobAttentionReasons(job) }))
    .filter((item) => item.reasons.length);
  const today = DateTime.now().setZone("Europe/London");
  const isToday = Boolean(
    from &&
      to &&
      DateTime.fromISO(from, { zone: "Europe/London" })
        .setZone("Europe/London")
        .hasSame(today, "day") &&
      DateTime.fromISO(to, { zone: "Europe/London" })
        .setZone("Europe/London")
        .hasSame(today, "day"),
  );
  const scope = isToday ? "Today" : "Selected range";
  const kpis = summary.data?.kpis;
  const chart = summary.data?.charts;
  const distribution = useMemo(
    () =>
      operationalDistribution(chart?.statusBreakdown || [], kpis?.totalJobs),
    [chart?.statusBreakdown, kpis?.totalJobs],
  );
  const daily = useMemo(
    () => activityDays(chart?.revenueOverTime || [], from, to),
    [chart?.revenueOverTime, from, to],
  );
  const activity = useMemo(
    () => groupActivity(daily.points, period),
    [daily.points, period],
  );
  const bookings = useMemo(
    () =>
      bookingActivityDays(
        jobs.data?.items || [],
        Boolean(jobs.data?.complete),
        from,
        to,
      ),
    [jobs.data?.items, jobs.data?.complete, from, to],
  );
  const charges = useMemo(
    () =>
      jobs.data
        ? storedChargeSummary(
            jobs.data.items,
            jobs.data.total,
            jobs.data.complete,
          )
        : null,
    [jobs.data],
  );
  const list = [...(jobs.data?.items || [])].sort((a, b) =>
    (a.bookedStart || "").localeCompare(b.bookedStart || ""),
  );
  const activeCount = jobs.data
    ? list.filter((job) => job.status === "IN_PROGRESS").length
    : null;
  const attentionValue = jobs.data
    ? jobs.data.complete
      ? attention.length
      : `${attention.length}+`
    : jobs.isError
      ? "Unavailable"
      : "…";
  const maxActivity = Math.max(
    1,
    ...bookings.points.map((point) => point.jobsCount || 0),
  );
  const firstWeekday = bookings.points[0]
    ? DateTime.fromISO(bookings.points[0].date).weekday
    : 1;
  const activityLoading =
    activityView === "heatmap" ? jobs.isPending : summary.isPending;
  const activityUnavailable = activityView === "heatmap" ? !jobs.data : !chart;
  const displayedDays =
    activityView === "heatmap" ? bookings.points : daily.points;
  const activityAvailable =
    activityView === "heatmap"
      ? Boolean(jobs.data && bookings.points.length)
      : Boolean(chart?.revenueOverTime.length);

  function openJobs(status?: string) {
    const params = new URLSearchParams({ section: "jobs" });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (status) params.set("status", status);
    navigateAdmin(location.pathname + "?" + params);
  }
  function openJob(jobId: string) {
    const params = new URLSearchParams({
      section: "jobs",
      job: jobId,
      recordReturn: location.pathname + location.search,
    });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    navigateAdmin(location.pathname + "?" + params);
  }
  function openDay(date: string) {
    const day = DateTime.fromISO(date, { zone: "Europe/London" });
    const params = new URLSearchParams({
      section: "jobs",
      from: day.startOf("day").toUTC().toISO()!,
      to: day.endOf("day").toUTC().toISO()!,
    });
    navigateAdmin(location.pathname + "?" + params);
  }
  function openPerformance() {
    const params = new URLSearchParams({
      section: "drivers",
      driversTab: "performance",
    });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    navigateAdmin(location.pathname + "?" + params);
  }
  function openAlerts() {
    if (onSelectSection) onSelectSection("notifications");
    else navigateAdmin(location.pathname + "?section=notifications");
  }
  function switchActivity(view: ActivityView) {
    setActivityView(view);
    try {
      localStorage.setItem("tmv:overview-chart-view", view);
    } catch {
      /* preference storage is optional */
    }
  }
  const metricValue = (value: number | undefined) =>
    value != null && Number.isFinite(value)
      ? value
      : summary.isError
        ? "Unavailable"
        : summary.isPending
          ? "…"
          : "Not recorded";
  const radialTotal = distribution.complete ? kpis?.totalJobs : undefined;

  return (
    <div className="aurora-overview">
      <PageHeader
        eyebrow="YOUR OPERATIONS, IN FOCUS"
        title="Operations overview"
        description={<>A clear view of your jobs, progress and next actions.</>}
        actions={
          <>
            <button className="ops-button secondary" onClick={openPerformance}>
              <Users size={16} />
              Driver performance
            </button>
            <button className="ops-button" onClick={() => openJobs()}>
              View jobs
              <ArrowUpRight size={16} />
            </button>
          </>
        }
      />
      <AdminFilterBar
        dates={
          <DateRangePicker
            from={from}
            to={to}
            onChange={(f, t) => {
              setFrom(f);
              setTo(t);
              retainRangeInUrl(f, t);
            }}
          />
        }
        count={
          kpis?.totalJobs != null
            ? `${kpis.totalJobs} jobs in scope`
            : undefined
        }
      >
        <span className="aurora-scope-meta">
          <span className="aurora-update-dot" />
          {scope} · London time
        </span>
        <span className="aurora-updated">
          {summary.data?.meta.fetchedAt
            ? `${summary.isFetching ? "Refreshing · " : "Updated "}${formatLondonTimeOnly(summary.data.meta.fetchedAt)}`
            : summary.isError
              ? "Summary unavailable"
              : "Fetching records"}
        </span>
        <button
          type="button"
          onClick={() => {
            void summary.refetch();
            void jobs.refetch();
          }}
          className="ops-text-action aurora-refresh"
          aria-label="Refresh overview"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </AdminFilterBar>
      {summary.isError && (
        <DataState
          kind="error"
          title={
            summary.data ? "Summary refresh failed" : "Summary could not load"
          }
          description={
            summary.data
              ? "Showing the last loaded summary. Retry without changing your selected range."
              : "Job records below remain available. Retry without changing your selected range."
          }
          onRetry={() => void summary.refetch()}
        />
      )}
      <div
        className="ops-metric-grid aurora-overview-metrics"
        aria-label="Operational summary"
      >
        <MetricCard
          label="Total jobs"
          value={metricValue(kpis?.totalJobs)}
          detail="All workflow statuses · selected scope"
          tone="violet"
          icon={<FileText size={18} />}
          onClick={() => openJobs()}
          visualization={
            <div className="aurora-metric-status-wheel">
              <AuroraDonut
                segments={distribution.complete ? distribution.segments : []}
                value=""
                label=""
                accessibleLabel="Reported status composition"
              />
            </div>
          }
        />
        <MetricCard
          label="In progress"
          value={metricValue(kpis?.inProgress)}
          detail="Active job workflow"
          icon={<Clock3 size={18} />}
          onClick={() => openJobs("IN_PROGRESS")}
          visualization={
            <AuroraRadialMetric
              value={kpis?.inProgress}
              total={radialTotal}
              color="var(--aurora-chart-blue, #3f8cff)"
            />
          }
        />
        <MetricCard
          label="Completed"
          value={metricValue(kpis?.completed)}
          detail={
            distribution.completionPercentage == null
              ? "Payment and evidence separate"
              : `${Math.round(distribution.completionPercentage)}% of jobs · payment separate`
          }
          tone="green"
          icon={<CheckCircle2 size={18} />}
          onClick={() => openJobs("COMPLETED")}
          visualization={
            <AuroraRadialMetric
              value={kpis?.completed}
              total={radialTotal}
              color="var(--aurora-chart-teal, #149b83)"
            />
          }
        />
        <MetricCard
          label="Final charges"
          value={
            charges
              ? jobMoney(charges.amountPence ?? undefined)
              : jobs.isError
                ? "Unavailable"
                : "…"
          }
          detail={
            <>
              <span>Stored charges · not receipts</span>
              {charges && !charges.complete && (
                <span className="aurora-charge-coverage">
                  {charges.overflow
                    ? "Total unavailable · precision limit"
                    : `${charges.known > 0 ? "Known subtotal · " : ""}${charges.known} of ${charges.total} jobs with charge values`}
                </span>
              )}
            </>
          }
          tone="amber"
          icon={<Wallet size={18} />}
          onClick={() => openJobs()}
        />
      </div>
      {jobs.data && !jobs.data.complete && (
        <CoverageNotice>
          Partial records: {jobs.data.items.length} of {jobs.data.total} jobs
          loaded. Attention is a known count, not a complete total.
        </CoverageNotice>
      )}
      {jobs.isError && jobs.data && (
        <CoverageNotice>
          Job refresh failed. Showing the last loaded records; the current state
          has not been verified.{" "}
          <button
            className="ops-text-action"
            onClick={() => void jobs.refetch()}
          >
            Retry job records
          </button>
        </CoverageNotice>
      )}
      <div className="aurora-primary-grid">
        <section className="ops-panel aurora-performance-panel">
          <div className="ops-panel-header">
            <div>
              <span className="aurora-panel-kicker">WORKFLOW AT A GLANCE</span>
              <h2>Operations performance</h2>
              <p>Job status composition · {scope.toLowerCase()}</p>
            </div>
            <span className="aurora-panel-icon violet">
              <PieChartIcon size={19} />
            </span>
          </div>
          <div className="aurora-performance-body">
            {summary.isPending ? (
              <DataState kind="loading" title="Loading job status" />
            ) : !chart ? (
              <DataState
                kind="error"
                title="Status breakdown unavailable"
                onRetry={() => void summary.refetch()}
              />
            ) : distribution.subtotal > 0 ? (
              <AuroraStatusDistribution
                segments={distribution.segments}
                total={kpis?.totalJobs}
                complete={distribution.complete}
                onOpen={openJobs}
              />
            ) : (
              <DataState
                kind="empty"
                title={
                  kpis?.totalJobs === 0
                    ? "No jobs in scope"
                    : "No status breakdown available"
                }
                description="Change the range or inspect the job list."
                action={
                  <button
                    className="ops-button secondary"
                    onClick={() => openJobs()}
                  >
                    View jobs
                  </button>
                }
              />
            )}
            {chart && !distribution.complete && (
              <CoverageNotice>
                Status counts do not cover the reported job total (
                {kpis?.totalJobs ?? "not recorded"}). {distribution.subtotal}{" "}
                jobs have reported status counts; no remainder has been
                reclassified. Percentages are unavailable.
              </CoverageNotice>
            )}
            <div className="aurora-performance-note">
              <CheckCircle2 size={16} />
              <p>
                Completion tracks workflow. Payments, evidence and review remain
                separate.
              </p>
            </div>
          </div>
        </section>
        <section
          id="needs-attention"
          className="ops-panel aurora-attention-panel"
        >
          <div className="ops-panel-header">
            <div>
              <span className="aurora-panel-kicker">YOUR NEXT ACTIONS</span>
              <h2>Needs attention</h2>
              <p>Recorded issues, grouped by job</p>
            </div>
            <button
              type="button"
              className="aurora-attention-count"
              aria-label="View needs attention"
              onClick={() => {
                const panel = document.getElementById("needs-attention");
                const more = panel?.querySelector("details");
                if (more) more.open = true;
                panel?.scrollIntoView({
                  behavior: window.matchMedia(
                    "(prefers-reduced-motion: reduce)",
                  ).matches
                    ? "auto"
                    : "smooth",
                  block: "start",
                });
              }}
            >
              {attentionValue}
            </button>
          </div>
          {jobs.isPending ? (
            <DataState kind="loading" title="Checking job records" />
          ) : jobs.isError && !jobs.data ? (
            <DataState
              kind="error"
              title="Attention records could not load"
              description="A failed request does not mean there are no issues."
              onRetry={() => void jobs.refetch()}
            />
          ) : attention.length ? (
            <div className="aurora-attention-list">
              {attention.slice(0, 3).map(({ job, reasons }) => (
                <div key={job.jobId} className="ops-attention-row">
                  <span className="ops-attention-symbol">
                    <FileText size={17} />
                  </span>
                  <div className="aurora-attention-copy">
                    <h3>{reasons[0]}</h3>
                    <p>
                      {job.customerName || "Customer not recorded"} ·{" "}
                      {job.driverName || job.driverInitials || "Unassigned"}
                    </p>
                    <span>
                      {job.jobId}
                      {reasons.length > 1
                        ? ` · ${reasons.length - 1} more review reason${reasons.length > 2 ? "s" : ""}`
                        : ""}
                    </span>
                  </div>
                  <button
                    className="ops-text-action aurora-attention-open"
                    onClick={() => openJob(job.jobId)}
                  >
                    Open job
                    <ArrowUpRight size={15} />
                  </button>
                </div>
              ))}
              {attention.length > 3 && (
                <details className="aurora-more-attention">
                  <summary>
                    View {attention.length - 3} more jobs needing attention
                  </summary>
                  {attention.slice(3).map(({ job, reasons }) => (
                    <div className="ops-attention-row" key={job.jobId}>
                      <div className="aurora-attention-copy">
                        <h3>{reasons[0]}</h3>
                        <p>
                          {job.customerName} · {job.jobId}
                        </p>
                      </div>
                      <button
                        className="ops-text-action"
                        onClick={() => openJob(job.jobId)}
                      >
                        Open job
                        <ArrowUpRight size={14} />
                      </button>
                    </div>
                  ))}
                </details>
              )}
            </div>
          ) : (
            <DataState
              kind="empty"
              title={
                jobs.data?.complete
                  ? "No recorded job issues in this scope"
                  : "No issues in the loaded records"
              }
              description="Checks recorded exceptions, failed uploads, overdue proof, stale trackers, pending invoices and missing completed-job submissions. Coverage does not certify every operational issue is known."
            />
          )}
          <div className="aurora-panel-footer">
            <span>Unique jobs · issues can overlap</span>
            <button className="ops-text-action" onClick={openAlerts}>
              View alerts
              <ArrowRight size={14} />
            </button>
          </div>
        </section>
      </div>
      <div className="aurora-secondary-grid">
        <section className="ops-panel aurora-activity-panel">
          <div className="ops-panel-header">
            <div>
              <span className="aurora-panel-kicker">YOUR WORKLOAD</span>
              <h2>Job activity & trends</h2>
              <p>
                {activityView === "heatmap"
                  ? "Bookings by scheduled day · London time"
                  : "Reported daily workload · London time"}
              </p>
            </div>
            <span className="aurora-panel-icon blue">
              <BarChart3 size={19} />
            </span>
          </div>
          <div className="aurora-activity-controls">
            <div
              className="aurora-chart-switch"
              role="group"
              aria-label="Activity visualization"
            >
              {(
                [
                  { key: "trends", label: "Trends", Icon: BarChart3 },
                  {
                    key: "distribution",
                    label: "Distribution",
                    Icon: PieChartIcon,
                  },
                  { key: "heatmap", label: "Activity heatmap", Icon: Grid2X2 },
                ] as const
              ).map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={activityView === key}
                  onClick={() => switchActivity(key)}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            {activityView === "trends" && (
              <div
                className="aurora-period-switch"
                role="group"
                aria-label="Activity grouping"
              >
                {(["day", "week", "month"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={period === value}
                    onClick={() => setPeriod(value)}
                  >
                    {value[0].toUpperCase() + value.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="aurora-activity-body">
            {activityLoading ? (
              <DataState kind="loading" title="Loading job activity" />
            ) : activityUnavailable ? (
              <DataState
                kind="error"
                title="Job activity unavailable"
                onRetry={() => {
                  if (activityView === "heatmap") void jobs.refetch();
                  else void summary.refetch();
                }}
              />
            ) : !activityAvailable && activityView !== "distribution" ? (
              <DataState
                kind="empty"
                title="No daily job values recorded"
                description="Missing daily data is not a measured zero."
              />
            ) : activityView === "distribution" ? (
              distribution.subtotal ? (
                <AuroraStatusDistribution
                  segments={distribution.segments}
                  total={kpis?.totalJobs}
                  complete={distribution.complete}
                  onOpen={openJobs}
                />
              ) : (
                <DataState
                  kind="empty"
                  title="No status distribution recorded"
                />
              )
            ) : activityView === "trends" ? (
              <div
                className="aurora-activity-chart"
                role="img"
                aria-label={`Reported job counts by ${period}. ${activity.filter((point) => point.jobsCount != null).length} of ${activity.length} groups recorded. Detailed values available below.`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={activity}
                    margin={{ left: 0, right: 8, top: 14, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id={`${id}-jobs-gradient`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--aurora-chart-violet, #725cff)"
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--aurora-chart-blue, #3f8cff)"
                          stopOpacity={0.45}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      stroke="var(--aurora-chart-grid, #eae7f2)"
                      strokeDasharray="3 5"
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={dateLabel}
                      tick={{
                        fontSize: 12,
                        fill: "var(--aurora-chart-text, #676a82)",
                      }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={26}
                    />
                    <YAxis
                      width={32}
                      allowDecimals={false}
                      tick={{
                        fontSize: 12,
                        fill: "var(--aurora-chart-text, #676a82)",
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{
                        fill: "var(--aurora-chart-grid, #eae7f2)",
                        fillOpacity: 0.4,
                      }}
                      labelFormatter={(value) =>
                        formatLondonDate(String(value))
                      }
                      formatter={(value: number) => [value, "Reported jobs"]}
                      contentStyle={chartTooltipStyle}
                    />
                    <Bar
                      dataKey="jobsCount"
                      fill={`url(#${id}-jobs-gradient)`}
                      radius={[6, 6, 2, 2]}
                      maxBarSize={38}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="aurora-heatmap-wrap">
                <div
                  className="aurora-heatmap"
                  aria-label="Bookings by scheduled day heatmap"
                >
                  <div className="aurora-heatmap-days">
                    {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
                      <span key={index}>{day}</span>
                    ))}
                  </div>
                  <div className="aurora-heatmap-cells">
                    {Array.from({ length: firstWeekday - 1 }, (_, index) => (
                      <span key={`empty-${index}`} />
                    ))}
                    {bookings.points.map((point) => {
                      const level =
                        point.jobsCount == null
                          ? "unknown"
                          : point.jobsCount === 0
                            ? "0"
                            : String(
                                Math.min(
                                  4,
                                  Math.ceil(
                                    (point.jobsCount / maxActivity) * 4,
                                  ),
                                ),
                              );
                      return (
                        <button
                          type="button"
                          key={point.date}
                          data-level={level}
                          className="aurora-heatmap-cell"
                          title={`${formatLondonDate(point.date)} · ${point.jobsCount == null ? `${point.knownJobs} known subtotal · coverage incomplete` : `${point.jobsCount} booked jobs`}`}
                          aria-label={`${formatLondonDate(point.date)}: ${point.jobsCount == null ? `${point.knownJobs} known subtotal, coverage incomplete` : `${point.jobsCount} booked jobs`}. Open jobs for this day`}
                          onClick={() => openDay(point.date)}
                        />
                      );
                    })}
                  </div>
                </div>
                <div className="aurora-heatmap-legend">
                  <span>Recorded workload</span>
                  <span>Less</span>
                  {[0, 1, 2, 3, 4].map((level) => (
                    <i key={level} data-level={level} />
                  ))}
                  <span>More</span>
                  <i data-level="unknown" />
                  <span>Not recorded</span>
                </div>
                <p className="aurora-chart-caption">
                  Select a day to open its scheduled jobs. Intensity is relative
                  to the highest complete day in this range.
                </p>
              </div>
            )}
            {activityAvailable && activityView !== "distribution" && (
              <>
                <p className="aurora-chart-caption">
                  {
                    displayedDays.filter((point) => point.jobsCount != null)
                      .length
                  }{" "}
                  of {displayedDays.length} days with complete values · missing
                  coverage remains unknown.
                </p>
                <ActivityData
                  points={
                    activityView === "heatmap" ? bookings.points : activity
                  }
                  period={activityView === "heatmap" ? "day" : period}
                  basis={activityView === "heatmap" ? "bookings" : "summary"}
                />
                {activityView === "heatmap" && !bookings.coverageComplete && (
                  <CoverageNotice>
                    Booking coverage is incomplete. Cells remain unknown; known
                    subtotals are available in the values table.
                    {bookings.invalidTimestamps > 0 &&
                      ` ${bookings.invalidTimestamps} jobs have an invalid or missing booked timestamp.`}
                  </CoverageNotice>
                )}
              </>
            )}
            {daily.truncated && (
              <CoverageNotice>
                Daily visualization is limited to the first 5,000 days. Narrow
                the range to inspect every selected day.
              </CoverageNotice>
            )}
          </div>
        </section>
        <section className="ops-panel aurora-revenue-panel">
          <div className="ops-panel-header">
            <div>
              <span className="aurora-panel-kicker">BILLING SNAPSHOT</span>
              <h2>Daily billed revenue</h2>
              <p>Reported billed values · not receipts</p>
            </div>
            <span className="aurora-panel-icon violet">£</span>
          </div>
          <div className="aurora-revenue-body">
            <div className="aurora-revenue-value">
              {summary.isPending ? "…" : amount(kpis?.revenuePounds)}
              <span>Selected range</span>
            </div>
            {summary.isPending ? (
              <DataState kind="loading" title="Loading billed values" />
            ) : !chart ? (
              <DataState
                kind="error"
                title="Billed values unavailable"
                onRetry={() => void summary.refetch()}
              />
            ) : chart.revenueOverTime.length ? (
              <>
                <div
                  className="aurora-revenue-chart"
                  role="img"
                  aria-label="Daily billed revenue. Missing days are gaps. Detailed values and basis are available below."
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={daily.points}
                      margin={{ left: 0, right: 8, top: 12, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id={`${id}-revenue-gradient`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="var(--aurora-chart-violet, #725cff)"
                            stopOpacity={0.23}
                          />
                          <stop
                            offset="100%"
                            stopColor="var(--aurora-chart-violet, #725cff)"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        vertical={false}
                        stroke="var(--aurora-chart-grid, #eae7f2)"
                        strokeDasharray="3 5"
                      />
                      <XAxis
                        dataKey="date"
                        tickFormatter={dateLabel}
                        tick={{
                          fontSize: 12,
                          fill: "var(--aurora-chart-text, #676a82)",
                        }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={32}
                      />
                      <YAxis
                        width={54}
                        tick={{
                          fontSize: 12,
                          fill: "var(--aurora-chart-text, #676a82)",
                        }}
                        tickFormatter={(value) => `£${value}`}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        labelFormatter={(value) =>
                          formatLondonDate(String(value))
                        }
                        formatter={(value: number) => [
                          amount(value),
                          "Billed revenue",
                        ]}
                        contentStyle={chartTooltipStyle}
                      />
                      <Area
                        type="linear"
                        dataKey="revenuePounds"
                        stroke="var(--aurora-chart-violet, #725cff)"
                        strokeWidth={2.5}
                        fill={`url(#${id}-revenue-gradient)`}
                        dot={{
                          r: 3,
                          strokeWidth: 2,
                          fill: "var(--aurora-card, #fff)",
                        }}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <details className="ops-chart-data aurora-chart-data">
                  <summary>View daily billed values and basis</summary>
                  <p>
                    Reported billed turnover. Cash/card summaries may have
                    different coverage and definitions. No ledger or bank
                    balance is inferred. Missing days are not zero.
                  </p>
                  <div className="aurora-data-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Date · London</th>
                          <th>Billed revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {daily.points.map((point) => (
                          <tr key={point.date}>
                            <td>{formatLondonDate(point.date)}</td>
                            <td>{amount(point.revenuePounds)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            ) : (
              <DataState kind="empty" title="No daily billed values recorded" />
            )}
            <p className="aurora-chart-caption">
              {chart && chart.revenueOverTime.length > 0 && (
                <>
                  {
                    daily.points.filter((point) => point.revenuePounds != null)
                      .length
                  }{" "}
                  of {daily.points.length} days with billed values ·{" "}
                </>
              )}
              Charges and payments received are separate measures.
            </p>
          </div>
        </section>
      </div>
      <section className="ops-panel aurora-jobs-panel">
        <div className="ops-panel-header">
          <div>
            <span className="aurora-panel-kicker">
              THE RECORDS BEHIND THE NUMBERS
            </span>
            <h2>{isToday ? "Today's jobs" : "Jobs in this range"}</h2>
            <p>Schedule, assignment and workflow at a glance</p>
          </div>
          <div className="aurora-job-header-actions">
            {activeCount != null && activeCount > 0 && (
              <button
                type="button"
                className="aurora-active-count"
                onClick={() => openJobs("IN_PROGRESS")}
              >
                <Clock3 size={14} />
                {activeCount}
                {jobs.data?.complete ? "" : "+"} in progress
              </button>
            )}
            <button className="ops-text-action" onClick={() => openJobs()}>
              All jobs
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
        {jobs.isPending ? (
          <DataState kind="loading" title="Loading jobs" />
        ) : jobs.isError && !jobs.data ? (
          <DataState
            kind="error"
            title="Jobs could not load"
            onRetry={() => void jobs.refetch()}
          />
        ) : list.length ? (
          <>
            <table className="ops-overview-table">
              <thead>
                <tr>
                  <th>Scheduled</th>
                  <th>Customer & route</th>
                  <th>Driver</th>
                  <th>Job status</th>
                  <th>
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.slice(0, 8).map((job) => (
                  <tr key={job.jobId}>
                    <td>
                      <span className="font-semibold">
                        {formatLondonTimeOnly(job.bookedStart)}
                      </span>
                      {!isToday && (
                        <div className="ops-record-meta">
                          {formatLondonDate(job.bookedStart)}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="ops-record-name">
                        {job.customerName || "Customer not recorded"}
                      </div>
                      <div className="ops-record-meta break-words">
                        {job.pickup || "Pickup not recorded"} →{" "}
                        {job.dropoff || "Dropoff not recorded"}
                      </div>
                    </td>
                    <td>
                      {job.driverName || job.driverInitials || "Unassigned"}
                    </td>
                    <td>
                      <JobStatusBadge status={job.status} />
                    </td>
                    <td>
                      <button
                        className="ops-text-action"
                        onClick={() => openJob(job.jobId)}
                        aria-label={`Open job ${job.jobId}`}
                      >
                        Open
                        <ArrowUpRight size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length > 8 && (
              <div className="aurora-panel-footer">
                <span>Showing the first 8 of {list.length} loaded jobs.</span>
                <button onClick={() => openJobs()} className="ops-text-action">
                  View complete list
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
          </>
        ) : (
          <DataState
            kind="empty"
            title={
              jobs.data?.complete
                ? "No jobs in this range"
                : "No jobs in the loaded records"
            }
            description={
              jobs.data?.complete
                ? "Choose a different date range to view bookings."
                : "Some records are unavailable. Retry to verify the selected scope."
            }
            onRetry={
              jobs.data?.complete ? undefined : () => void jobs.refetch()
            }
          />
        )}
      </section>
    </div>
  );
}
