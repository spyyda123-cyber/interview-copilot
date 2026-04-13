"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import ConfirmModal from "@/components/ui/ConfirmModal";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { getCollege, getCollegeTokens, toggleCollegeStatus, type CollegeDetail, type CollegeStatus, type CollegeTokenOverview } from "@/lib/api";

const formatNumber = (value: number) => new Intl.NumberFormat("en-IN").format(value);

export default function CollegeDetailPage() {
  const params = useParams<{ id: string }>();
  const collegeId = params.id;

  const [college, setCollege] = useState<CollegeDetail | null>(null);
  const [tokens, setTokens] = useState<CollegeTokenOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [collegeData, tokenData] = await Promise.all([getCollege(collegeId), getCollegeTokens(collegeId)]);
      setCollege(collegeData);
      setTokens(tokenData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load college details.");
    } finally {
      setLoading(false);
    }
  }, [collegeId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onToggle = async () => {
    if (!college) {
      return;
    }
    const nextStatus: CollegeStatus = college.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setStatusLoading(true);
    try {
      await toggleCollegeStatus(college.id, nextStatus);
      setModalOpen(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to change status.");
    } finally {
      setStatusLoading(false);
    }
  };

  if (loading) {
    return <div className="h-40 animate-pulse rounded-xl bg-[var(--color-primary-light)]" />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--color-danger)]/40 bg-red-50 p-4 text-sm text-[var(--color-danger)]">
        <p>{error}</p>
        <button type="button" onClick={() => void loadData()} className="mt-3 rounded-lg bg-[var(--color-danger)] px-3 py-2 text-white">
          Retry
        </button>
      </div>
    );
  }

  if (!college) {
    return <p className="text-sm text-[var(--color-text-secondary)]">College not found.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={college.name}
        description={college.city ?? "City not provided"}
        action={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
            >
              Toggle Status
            </button>
            <Link href={`/colleges/${college.id}/edit`} className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white">
              Edit
            </Link>
          </div>
        }
      />

      <section className="grid grid-cols-1 gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:grid-cols-2">

        <div>
          <p className="text-xs text-[var(--color-text-secondary)]">Status</p>
          <StatusBadge status={college.status} />
        </div>
        <div>
          <p className="text-xs text-[var(--color-text-secondary)]">Admin Name</p>
          <p className="font-medium">{college.admin_name ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-text-secondary)]">Admin Email</p>
          <p className="font-medium">{college.admin_email ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-text-secondary)]">Admin Phone</p>
          <p className="font-medium">{college.admin_phone ?? "-"}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-text-secondary)]">Onboarded On</p>
          <p className="font-medium">{new Date(college.created_at).toLocaleDateString()}</p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:grid-cols-4">
        <div>
          <p className="text-xs text-[var(--color-text-secondary)]">Invite Slots Allocated</p>
          <p className="text-xl font-semibold">{formatNumber(tokens?.total_allocated ?? 0)}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-text-secondary)]">Students Invited</p>
          <p className="text-xl font-semibold">{formatNumber(tokens?.total_consumed ?? 0)}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-text-secondary)]">Seats Remaining</p>
          <p className="text-xl font-semibold">{formatNumber(tokens?.balance ?? 0)}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--color-text-secondary)]">Expiry</p>
          <p className="text-xl font-semibold">
            {tokens?.expiry_date ? new Date(tokens.expiry_date).toLocaleDateString() : "-"}
          </p>
        </div>

        <div className="md:col-span-4 flex flex-wrap gap-3 pt-2">
          <Link href={`/colleges/${college.id}/allocate`} className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white">
            Add Invite Slots
          </Link>
          <Link href={`/colleges/${college.id}/token-usage`} className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm">
            View Invite Usage
          </Link>
        </div>
      </section>

      <ConfirmModal
        open={modalOpen}
        title={college.status === "ACTIVE" ? `Deactivate ${college.name}?` : `Reactivate ${college.name}?`}
        message={
          college.status === "ACTIVE"
            ? "This will block college admin and student logins for this college."
            : "The college admin will regain access after reactivation."
        }
        confirmLabel={college.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
        destructive={college.status === "ACTIVE"}
        busy={statusLoading}
        onCancel={() => setModalOpen(false)}
        onConfirm={() => void onToggle()}
      />
    </div>
  );
}
