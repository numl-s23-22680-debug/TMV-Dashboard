/** Ported from TMV-Chat-bot's dashboard/web/src/components/DateRangePicker.tsx. */
import React from "react";
import { Calendar } from "lucide-react";
import { DateTime } from "luxon";
import { londonDateInput } from "../utils/reportNavigation";

interface Props {
  from?: string;
  to?: string;
  onChange: (from?: string, to?: string) => void;
  scope?: "operations" | "report";
}

type Preset = "today" | "tomorrow" | "yesterday" | "7d" | "30d" | "month";

export function dateRangeForPreset(preset: Preset): { from?: string; to?: string } {
  const today = DateTime.now().setZone("Europe/London").startOf("day");
  const start = preset === "tomorrow" ? today.plus({ days: 1 }) : preset === "yesterday" ? today.minus({ days: 1 }) : preset === "7d" ? today.minus({ days: 6 }) : preset === "30d" ? today.minus({ days: 29 }) : preset === "month" ? today.startOf("month") : today;
  const end = preset === "7d" || preset === "30d" || preset === "month" ? today.endOf("day") : start.endOf("day");
  return { from: start.toUTC().toISO()!, to: end.toUTC().toISO()! };
}

export const defaultDashboardDateRange = () => dateRangeForPreset("today");

export function DateRangePicker({ from, to, onChange, scope = "operations" }: Props) {
  const setPreset = (preset: Preset) => {
    const range = dateRangeForPreset(preset);
    onChange(range.from, range.to);
  };

  const isPresetActive = (preset: Preset): boolean => {
    if (!from || !to) return false;
    const range = dateRangeForPreset(preset);
    return londonDateInput(from) === londonDateInput(range.from) && londonDateInput(to) === londonDateInput(range.to);
  };

  return (
    <div className="ops-date-range flex flex-wrap items-center gap-2 text-[13px]">
      <div className="ops-date-presets flex flex-wrap items-center gap-1 bg-admin-surface p-1 rounded-card" role="group" aria-label="Date range presets">
        {(scope === "report" ? ["7d", "30d", "month"] as const : ["today", "yesterday", "tomorrow", "7d", "30d"] as const).map(preset => (
          <button
            key={preset}
            type="button"
            aria-pressed={isPresetActive(preset)}
            onClick={() => setPreset(preset)}
            className={`ops-date-preset px-3 py-1.5 min-h-[44px] sm:min-h-[36px] rounded-control transition ${
              isPresetActive(preset) ? "bg-admin-brand text-white shadow-sm font-bold" : "text-admin-muted hover:text-admin-ink font-medium"
            }`}
          >
            {{ today: "Today", yesterday: "Yesterday", tomorrow: "Tomorrow", "7d": "Last 7 days", "30d": "Last 30 days", month: "This month" }[preset]}
          </button>
        ))}
      </div>

      <div className="ops-custom-range admin-date-fields flex flex-wrap items-center gap-2 bg-white px-3 py-2 rounded-card border border-admin-line text-admin-ink">
        <span className="text-admin-muted">{scope === "report" ? "Custom" : "Custom range"}</span>
        <label className="admin-date-field"><span>From</span><Calendar className="w-3.5 h-3.5 text-admin-muted" />
        <input
          type="date"
          aria-label="From date"
          value={londonDateInput(from)}
          onChange={e => onChange(e.target.value ? DateTime.fromISO(e.target.value, { zone: "Europe/London" }).startOf("day").toUTC().toISO()! : undefined, to)}
          className="bg-transparent border-0 text-[13px] focus:outline-none font-mono"
        />
        </label>
        <label className="admin-date-field"><span>To</span>
        <input
          type="date"
          aria-label="To date"
          value={londonDateInput(to)}
          onChange={e => onChange(from, e.target.value ? DateTime.fromISO(e.target.value, { zone: "Europe/London" }).endOf("day").toUTC().toISO()! : undefined)}
          className="bg-transparent border-0 text-[13px] focus:outline-none font-mono"
        />
        </label>
      </div>
    </div>
  );
}
