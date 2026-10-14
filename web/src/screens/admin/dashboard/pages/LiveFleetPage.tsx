import React from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchJobs } from "../api";
import { LiveFleetMap } from "../components/LiveFleetMap";
import { navigateAdmin, recordJobHref } from "../utils/reportNavigation";

interface Props {
  onSelectSection?: (id: string) => void;
}

export function LiveFleetPage({ onSelectSection }: Props) {
  const { data: jobsData, isError, refetch } = useQuery({
    queryKey: ["live_fleet_jobs"],
    queryFn: async () => {
      const first = await fetchJobs({ status: "IN_PROGRESS", limit: 100, page: 1 });
      const items = [...first.items];
      for (let page = 2; page <= first.pagination.totalPages; page++) {
        const next = await fetchJobs({ status: "IN_PROGRESS", limit: 100, page });
        items.push(...next.items);
      }
      return { ...first, items };
    },
    refetchInterval: 10000
  });

  const activeJobs = jobsData?.items || [];

  return (
    <div className="space-y-4 max-w-full">
      <header><h1 className="text-2xl font-semibold text-admin-ink">Live Fleet</h1><p className="mt-1 text-sm text-admin-muted">Vehicle locations, signal freshness and current work.</p></header>
      {isError && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Current job associations could not be refreshed. {jobsData ? "Previously loaded associations remain visible." : "Vehicle monitoring is still available."} <button className="font-semibold underline" onClick={() => void refetch()}>Retry job loading</button></div>}
      {/* The map component carries its own status line (live count, filters); the
          separate banner that used to sit here was pure vertical cost. */}
      <LiveFleetMap
        jobs={activeJobs}
        onSelectJob={jobId => navigateAdmin(recordJobHref(jobId))}
      />
    </div>
  );
}
