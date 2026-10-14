import { useId, useState } from "react";
import { DateTime } from "luxon";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from "recharts";
import type { DriverReport } from "../driverReport.types";
import { reportDuration } from "../utils/reportSemantics";

export function performanceChartData(trends: DriverReport["trends"]) {
  return trends.map(row => ({ period: row.period, jobs: row.completedJobs,
    collected: row.completedJobs > 0 && row.unknownSystemCollectionJobs >= row.completedJobs ? null : row.systemKnownCollectionsPence / 100,
    hours: row.completedJobs > 0 && row.workingMinutesUnknownJobs >= row.completedJobs ? null : row.workingMinutesKnown / 60,
    missingHours: row.workingMinutesUnknownJobs, missingReceipts: row.unknownSystemCollectionJobs,
  })).sort((a, b) => a.period.localeCompare(b.period));
}

const currency = (value: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
const metrics = {
  jobs: { title: "Completed jobs", unit: "Jobs", color: "var(--aurora-chart-blue, #3f8cff)", endColor: "var(--aurora-chart-violet, #725cff)", basis: "Completed operational records", format: (value: number) => `${value} jobs` },
  collected: { title: "Recorded receipts", unit: "GBP", color: "var(--aurora-chart-teal, #1ccfb0)", endColor: "var(--aurora-chart-teal, #1ccfb0)", basis: "Unpaid invoices excluded", format: currency },
  hours: { title: "Working time", unit: "Hours", color: "var(--aurora-chart-violet, #725cff)", endColor: "var(--aurora-chart-blue, #3f8cff)", basis: "Operational job boundaries", format: (value: number) => reportDuration(value * 60) },
} as const;
type MetricKey = keyof typeof metrics;
type ChartPoint = ReturnType<typeof performanceChartData>[number];

function TrendTooltip({ active, payload, label, selected }: TooltipProps<number, string> & { selected: MetricKey }) {
  const row = payload?.[0]?.payload as ChartPoint | undefined;
  if (!active || !row || row[selected] == null) return null;
  const metric = metrics[selected];
  const missing = selected === "collected" ? row.missingReceipts : selected === "hours" ? row.missingHours : 0;
  return <div className="rpt-chart-tooltip">
    <p>{DateTime.fromISO(String(label)).toFormat("ccc, dd LLL yyyy")}</p>
    <div><span className="rpt-chart-key" style={{ background: metric.color }} /><span>{metric.title}</span><strong>{metric.format(row[selected])}</strong></div>
    <small>{missing ? `Known subtotal · ${missing} ${selected === "hours" ? "timings missing" : "receipt records unverified"}` : metric.basis}</small>
  </div>;
}

export function DriverPerformanceCharts({ trends }: { trends: DriverReport["trends"] }) {
  const [selected, setSelected] = useState<MetricKey>("jobs");
  const chartId = useId().replace(/:/g, "");
  const gradientId = `report-trend-${chartId}-${selected}`;
  const data = performanceChartData(trends), metric = metrics[selected];
  return <section className="rpt-section rpt-performance-section" aria-label="Selected range performance charts">
    <div className="rpt-section-heading">
      <div><p className="rpt-eyebrow">Performance analytics</p><h2>Performance trend</h2><p className="rpt-muted">Daily recorded data · Selected range</p></div>
      <label className="rpt-trend-select"><span className="sr-only">Trend metric</span><select aria-label="Trend metric" value={selected} onChange={event => setSelected(event.target.value as MetricKey)}>{Object.entries(metrics).map(([key, item]) => <option key={key} value={key}>{item.title}</option>)}</select></label>
    </div>
    <div className="rpt-chart-caption"><span><i className="rpt-chart-key" style={{ background: metric.color }} />{metric.title}</span><span>{metric.unit} · {metric.basis}</span></div>
    {data.length && data.some(row => row[selected] !== null) ? <div className="rpt-chart" role="img" aria-label={`${metric.title} by date`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="38%" margin={{ top: 16, right: 8, bottom: 6, left: 0 }}>
          <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={metric.color} /><stop offset="100%" stopColor={metric.endColor} stopOpacity={0.65} /></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="var(--aurora-chart-grid, #e7eaf5)" strokeDasharray="3 5" />
          <XAxis dataKey="period" tickFormatter={value => DateTime.fromISO(value).toFormat("dd LLL")} tick={{ fontSize: 12, fill: "var(--aurora-chart-text, #626b82)" }} minTickGap={30} axisLine={false} tickLine={false} tickMargin={12} />
          <YAxis width={58} allowDecimals={selected !== "jobs"} tick={{ fontSize: 12, fill: "var(--aurora-chart-text, #626b82)" }} axisLine={false} tickLine={false} tickFormatter={value => selected === "collected" ? `£${new Intl.NumberFormat("en-GB", { notation: "compact" }).format(value)}` : String(value)} />
          <Tooltip cursor={{ fill: "var(--aurora-chart-grid, #e7eaf5)", opacity: 0.35, radius: 8 }} content={<TrendTooltip selected={selected} />} />
          <Bar dataKey={selected} name={metric.title} fill={`url(#${gradientId})`} radius={[9, 9, 3, 3]} maxBarSize={38} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div> : <div className="rpt-empty">{data.length ? `${metric.title} unavailable for this range.` : "No jobs in this range."}</div>}
    {data.some(row => row.missingHours || row.missingReceipts) && <p className="rpt-note">Known subtotals only. Dates with entirely missing records have no bar; unpaid invoices are excluded from receipts.</p>}
    <details className="rpt-chart-data"><summary>View chart data</summary><div className="rpt-table-scroll"><table aria-label="Performance trend data"><thead><tr><th>Date · London</th><th>Completed jobs</th><th>Recorded receipts</th><th>Working time</th><th>Coverage</th></tr></thead><tbody>{data.map(row => <tr key={row.period}><th scope="row">{DateTime.fromISO(row.period).toFormat("dd LLL yyyy")}</th><td>{row.jobs}</td><td>{row.collected == null ? "Unverified" : `${row.missingReceipts ? "Known subtotal " : ""}${currency(row.collected)}`}</td><td>{row.hours == null ? "Not recorded" : `${row.missingHours ? "Known subtotal " : ""}${reportDuration(row.hours * 60)}`}</td><td>{row.missingHours || row.missingReceipts ? `${row.missingHours} timings missing · ${row.missingReceipts} receipt records unverified` : "Recorded"}</td></tr>)}</tbody></table></div></details>
  </section>;
}
