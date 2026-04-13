"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import DataTable from "@/components/ui/DataTable";
import PageHeader from "@/components/ui/PageHeader";
import { getCollegeTokenUsage, type CollegeTokenUsage, type StudentTokenUsage } from "@/lib/api";

const formatNumber = (value: number) => new Intl.NumberFormat("en-IN").format(value);

export default function TokenUsagePage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<CollegeTokenUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const usage = await getCollegeTokenUsage(params.id);
        setData(usage);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load invite-slot usage.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [params.id]);

  if (error) {
    return <p className="text-sm text-[var(--color-danger)]">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Invite Slot Usage" description="College slot summary and invited students." />

      <section className="grid grid-cols-1 gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:grid-cols-4">
        {[
          ["Total Slots Allocated", data?.total_allocated ?? 0],
          ["Slots Consumed", data?.total_consumed ?? 0],
          ["Slots Remaining", data?.balance ?? 0],
          ["Expiry Date", data?.expiry_date ? new Date(data.expiry_date).toLocaleDateString() : "-"],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
            <p className="text-xl font-semibold">{typeof value === "number" ? formatNumber(value) : value}</p>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Invited Students</h2>
        <DataTable<StudentTokenUsage>
          loading={loading}
          rows={data?.student_usage ?? []}
          emptyMessage="No invited students yet."
          columns={[
            {
              key: "name",
              header: "Student Name",
              render: (row) => row.name ?? "-",
            },
            {
              key: "email",
              header: "Email",
              render: (row) => row.email ?? "-",
            },
            {
              key: "allocated",
              header: "Invite Slots Used",
              render: (row) => formatNumber(row.allocated),
            },
          ]}
        />
      </section>
    </div>
  );
}
