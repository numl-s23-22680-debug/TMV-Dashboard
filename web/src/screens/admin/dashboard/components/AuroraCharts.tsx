import React, { useId, useState } from "react";
import type { StatusSegment } from "../utils/auroraAnalytics";

/** Shared ring language; labels and keyboard actions stay in the accompanying legend. */
export function AuroraDonut({
  segments,
  value,
  label,
  accessibleLabel,
  activeKey,
}: {
  segments: StatusSegment[];
  value: React.ReactNode;
  label: string;
  accessibleLabel: string;
  activeKey?: string | null;
}) {
  const id = useId().replaceAll(":", "");
  const total = segments.reduce((sum, item) => sum + item.value, 0);
  const radius = 91;
  const circumference = 2 * Math.PI * radius;
  const nonzero = segments.filter((item) => item.value > 0);
  const gap =
    nonzero.length > 1 ? Math.min(7, circumference / nonzero.length / 3) : 0;
  let start = 0;
  return (
    <div className="aurora-donut">
      <svg viewBox="0 0 244 244" role="img" aria-labelledby={`${id}-title`}>
        <title id={`${id}-title`}>{accessibleLabel}</title>
        <circle
          className="aurora-donut-track"
          cx="122"
          cy="122"
          r={radius}
          fill="none"
          strokeWidth="22"
        />
        <circle
          className="aurora-donut-inner-track"
          cx="122"
          cy="122"
          r="72"
          fill="none"
          strokeWidth="1"
        />
        {nonzero.map((item) => {
          const length = (item.value / total) * circumference;
          const offset = start;
          const width = activeKey === item.key ? 26 : 22;
          // Round caps extend the painted arc by one stroke width. Budget for
          // that width; a tiny segment keeps accurate flat ends instead of an
          // oversized round dot that exaggerates its share.
          const rounded = nonzero.length > 1 && length > gap + width;
          const padding = rounded ? gap + width : 0;
          const dashLength = length - padding;
          start += length;
          return (
            <circle
              key={item.key}
              cx="122"
              cy="122"
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={width}
              strokeLinecap={rounded ? "round" : "butt"}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={-(offset + padding / 2)}
              transform="rotate(-90 122 122)"
              opacity={activeKey && activeKey !== item.key ? 0.3 : 1}
              className="aurora-donut-segment"
            >
              <title>
                {item.label}: {item.value}
              </title>
            </circle>
          );
        })}
      </svg>
      <div className="aurora-donut-center">
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

export function AuroraStatusDistribution({
  segments,
  total,
  complete,
  onOpen,
}: {
  segments: StatusSegment[];
  total?: number;
  complete: boolean;
  onOpen: (status?: string) => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  const subtotal = segments.reduce((sum, row) => sum + row.value, 0);
  return (
    <div className="aurora-distribution">
      <AuroraDonut
        segments={segments}
        value={complete ? (total ?? subtotal) : subtotal}
        label={complete ? "Jobs in scope" : "Reported statuses"}
        accessibleLabel={`Job status composition. ${segments.map((item) => `${item.label}: ${item.value}`).join(". ")}. ${complete ? "Complete status coverage." : "Reported status coverage is incomplete; percentages are unavailable."}`}
        activeKey={active}
      />
      <div className="aurora-status-breakdown">
        {segments.map((row) => {
          const content = (
            <>
              <span
                className="aurora-status-key"
                style={{ background: row.color }}
              />
              <span className="aurora-status-label">{row.label}</span>
              <strong>{row.value}</strong>
              <span className="aurora-status-percentage">
                {complete && subtotal > 0
                  ? `${Math.round((row.value / subtotal) * 100)}%`
                  : "—"}
              </span>
            </>
          );
          return row.filter ? (
            <button
              type="button"
              className={`aurora-status-item ${active === row.key ? "is-highlighted" : ""}`}
              key={row.key}
              aria-label={`View ${row.label.toLowerCase()} jobs: ${row.value}`}
              onClick={() => onOpen(row.filter)}
              onMouseEnter={() => setActive(row.key)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(row.key)}
              onBlur={() => setActive(null)}
            >
              {content}
            </button>
          ) : (
            <div className="aurora-status-item" key={row.key}>
              {content}
            </div>
          );
        })}
        <p className="aurora-chart-caption">
          Select a status to open its jobs.
        </p>
      </div>
    </div>
  );
}

/** A true proportion only; null operands produce a neutral unknown track. */
export function AuroraRadialMetric({
  value,
  total,
  color,
}: {
  value?: number;
  total?: number;
  color: string;
}) {
  const valid =
    value != null && total != null && total > 0 && value >= 0 && value <= total;
  const circumference = 2 * Math.PI * 25;
  return (
    <svg className="aurora-mini-ring" viewBox="0 0 64 64" aria-hidden="true">
      <circle
        cx="32"
        cy="32"
        r="25"
        fill="none"
        stroke="var(--aurora-chart-grid, #ebe8f5)"
        strokeWidth="5"
      />
      {valid && value! > 0 && (
        <circle
          cx="32"
          cy="32"
          r="25"
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${(value! / total!) * circumference} ${circumference}`}
          transform="rotate(-90 32 32)"
        />
      )}
      <circle cx="32" cy="32" r="3" fill={color} />
    </svg>
  );
}
