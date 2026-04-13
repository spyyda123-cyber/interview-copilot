"use client";

import { useEffect, useState } from "react";

import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { getReadinessOverview, type ReadinessOverview } from "@/lib/api";

export default function ReadinessPage() {
  const [data, setData] = useState<ReadinessOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setData(await getReadinessOverview());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load readiness overview.");
      }
    };
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Placement Readiness Overview" description="Cross-student readiness summary for placement operations." />

      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Average ATS Score" value={data?.average_ats_score?.toFixed(1) ?? "No data"} />
        <StatCard label="Study Plan Completion %" value={data?.study_plan_completion?.toFixed(1) ?? "No data"} />
        <StatCard label="Students Not Started" value={data?.students_not_started ?? "-"} variant="warning" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-lg font-semibold">Top Target Companies</h2>
          <ol className="mt-3 space-y-1 text-sm">
            {(data?.top_target_companies ?? []).map((item, idx) => (
              <li key={item.name}>{idx + 1}. {item.name} ({item.count} students)</li>
            ))}
          </ol>
        </section>

        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-lg font-semibold">Top Target Roles</h2>
          <ol className="mt-3 space-y-1 text-sm">
            {(data?.top_target_roles ?? []).map((item, idx) => (
              <li key={item.name}>{idx + 1}. {item.name} ({item.count} students)</li>
            ))}
          </ol>
        </section>
      </div>

      <p className="text-sm text-[var(--color-text-secondary)]">Coding completion tracking will be available soon.</p>
    </div>
  );
}
