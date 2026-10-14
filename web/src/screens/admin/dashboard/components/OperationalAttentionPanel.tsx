import React from "react";
import { DateTime } from "luxon";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Alert, Button, EmptyState } from "../../../../ui";
import { useOperationalAttention } from "../utils/useOperationalAttention";
import { navigateAdmin, recordJobHref } from "../utils/reportNavigation";
import { formatLondonDateTime } from "../utils/date";
function eventTime(value: string) {
  const sql = DateTime.fromSQL(value, { zone: "utc" });
  return sql.isValid
    ? sql.setZone("Europe/London").toFormat("dd LLL yyyy · HH:mm")
    : formatLondonDateTime(value);
}
export function OperationalAttentionPanel() {
  const {
    items,
    errors,
    isLoading,
    isFetching,
    updatedAt,
    loadedSources,
    refetch,
  } = useOperationalAttention();
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div>
          <h3 className="text-[18px] font-semibold text-fg">Needs attention</h3>
          <p className="mt-1 text-[13px] text-fg-muted">
            Failed deliveries and review signals from the latest 50 tracker
            events. This is a feed of recorded issues, not a complete
            operational exception count.
          </p>
        </div>
        <Button
          variant="ghost"
          iconLeft={<RefreshCw />}
          loading={isFetching}
          onClick={() => void refetch()}
        >
          Refresh
        </Button>
      </div>
      {errors.map((source) => (
        <Alert
          key={source.name}
          tone="warning"
          title={`${source.name} could not load`}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void refetch()}
            >
              Retry
            </Button>
          }
        >
          Other available records remain visible.{" "}
          {(source.error as Error).message}
        </Alert>
      ))}
      {isLoading && (
        <div
          role="status"
          className="rounded-module border border-admin-line bg-white p-8 text-[14px] text-fg-muted"
        >
          Loading recorded issues…
        </div>
      )}
      {!isLoading && !items.length && loadedSources > 0 && (
        <EmptyState
          icon={<AlertTriangle />}
          title={
            errors.length
              ? "No issues in the available records"
              : "No recorded issues needing review"
          }
          description={
            errors.length
              ? "Coverage is incomplete because a source could not load. Retry before relying on this view."
              : "No failed deliveries or qualifying review signals in the current feed. Other operational issues may appear on Jobs and Vehicles."
          }
        />
      )}
      {items.length > 0 && (
        <div className="overflow-hidden rounded-module border border-admin-line bg-white divide-y divide-admin-line">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-1 text-[12px] font-medium ${item.severity === "Urgent" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}
                  >
                    {item.severity}
                  </span>
                  <h4 className="text-[14px] font-semibold text-fg">
                    {item.reason}
                  </h4>
                  {item.count > 1 && (
                    <span className="text-[12px] text-fg-muted">
                      {item.count} recorded events
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[13px] text-fg-muted">
                  {item.identity} · {eventTime(item.at)} · London
                </p>
                <p className="mt-1 text-[13px] text-fg-muted">{item.detail}</p>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  const job = new URL(
                    item.href,
                    window.location.origin,
                  ).searchParams.get("job");
                  navigateAdmin(job ? recordJobHref(job) : item.href);
                }}
              >
                {item.action}
              </Button>
            </div>
          ))}
        </div>
      )}
      {Number.isFinite(updatedAt) && updatedAt > 0 && (
        <p className="text-[12px] text-fg-muted">
          Last successful update{" "}
          {DateTime.fromMillis(updatedAt)
            .setZone("Europe/London")
            .toFormat("dd LLL yyyy · HH:mm")}{" "}
          · London · {loadedSources}/2 sources available
        </p>
      )}
    </section>
  );
}
