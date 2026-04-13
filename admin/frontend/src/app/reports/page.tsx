"use client";

import { useState } from "react";

import PageHeader from "@/components/ui/PageHeader";
import {
  downloadInviteSummaryReport,
  downloadReadinessReport,
  downloadStudentUsageReport,
} from "@/lib/api";

const cards = [
  {
    key: "student-usage",
    title: "Student Usage Report",
    description: "All students with token usage, resume scores, and activity status",
    action: downloadStudentUsageReport,
  },
  {
    key: "invite-summary",
    title: "Invite Summary Report",
    description: "College invite slot status and list of invited students",
    action: downloadInviteSummaryReport,
  },
  {
    key: "readiness",
    title: "Placement Readiness Report",
    description: "Per-student readiness metrics for placement committees",
    action: downloadReadinessReport,
  },
];

export default function ReportsPage() {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader title="Export Reports" description="Download CSV reports for operations and placement review." />

      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {cards.map((card) => (
          <section key={card.key} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="text-lg font-semibold">{card.title}</h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{card.description}</p>
            <button
              type="button"
              disabled={loadingKey !== null}
              onClick={async () => {
                setLoadingKey(card.key);
                setError(null);
                try {
                  await card.action();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Download failed");
                } finally {
                  setLoadingKey(null);
                }
              }}
              className="mt-4 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {loadingKey === card.key ? "Preparing..." : "Download CSV"}
            </button>
          </section>
        ))}
      </div>
    </div>
  );
}
