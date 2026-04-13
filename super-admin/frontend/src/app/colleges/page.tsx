"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import ConfirmModal from "@/components/ui/ConfirmModal";
import DataTable from "@/components/ui/DataTable";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  createCollege,
  deleteCollege,
  listColleges,
  toggleCollegeStatus,
  type CollegeListItem,
  type CollegeStatus,
} from "@/lib/api";

const formatNumber = (value: number) => new Intl.NumberFormat("en-IN").format(value);

export default function CollegesPage() {
  const [rows, setRows] = useState<CollegeListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [confirm, setConfirm] = useState<{
    open: boolean;
    collegeId: string;
    collegeName: string;
    targetStatus: CollegeStatus;
  }>({ open: false, collegeId: "", collegeName: "", targetStatus: "INACTIVE" });
  const [statusUpdating, setStatusUpdating] = useState(false);
  
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    collegeId: string;
    collegeName: string;
  }>({ open: false, collegeId: "", collegeName: "" });
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Onboard Modal State
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [onboardLoading, setOnboardLoading] = useState(false);
  const [onboardError, setOnboardError] = useState<string | null>(null);
  const [onboardForm, setOnboardForm] = useState({
    college_name: "",
    admin_full_name: "",
    admin_email: "",
    initial_alloc: 0,
  });
  const [createdCredential, setCreatedCredential] = useState<{
    collegeName: string;
    adminEmail: string;
    temporaryPassword: string;
  } | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const loadColleges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listColleges({
        search: search || undefined,
        status: statusFilter || undefined,
        page,
        per_page: perPage,
      });
      setRows(data.colleges);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load colleges.");
    } finally {
      setLoading(false);
    }
  }, [page, perPage, search, statusFilter]);

  useEffect(() => {
    void loadColleges();
  }, [loadColleges]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / perPage)), [total, perPage]);

  const openStatusModal = (college: CollegeListItem) => {
    const targetStatus: CollegeStatus = college.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setConfirm({
      open: true,
      collegeId: college.id,
      collegeName: college.name,
      targetStatus,
    });
  };

  const confirmStatusToggle = async () => {
    setStatusUpdating(true);
    try {
      await toggleCollegeStatus(confirm.collegeId, confirm.targetStatus);
      setConfirm({ ...confirm, open: false });
      await loadColleges();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update status.");
    } finally {
      setStatusUpdating(false);
    }
  };

  const confirmDelete = async () => {
    setDeleteBusy(true);
    try {
      await deleteCollege(deleteConfirm.collegeId);
      setDeleteConfirm({ open: false, collegeId: "", collegeName: "" });
      await loadColleges();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete college.");
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleOnboardSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setOnboardError(null);

    if (onboardForm.college_name.trim().length < 3) {
      setOnboardError("College name must be at least 3 characters.");
      return;
    }

    setOnboardLoading(true);
    try {
      const response = await createCollege({
        college_name: onboardForm.college_name,
        admin_full_name: onboardForm.admin_full_name,
        admin_email: onboardForm.admin_email,
        initial_token_quota: Number(onboardForm.initial_alloc),
      });

      setCreatedCredential({
        collegeName: onboardForm.college_name,
        adminEmail: response.admin_email,
        temporaryPassword: response.temporary_password,
      });
      
      setOnboardOpen(false);
      setOnboardForm({ college_name: "", admin_full_name: "", admin_email: "", initial_alloc: 0 });
      await loadColleges();
    } catch (err) {
      setOnboardError(err instanceof Error ? err.message : "Unable to onboard college.");
    } finally {
      setOnboardLoading(false);
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // No-op
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Colleges"
        description="Onboard and manage institutions across the platform."
        action={
          <button
            onClick={() => setOnboardOpen(true)}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)]"
          >
            Onboard New College
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:grid-cols-3">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search college or admin email"
          className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
        />

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>

        <button
          type="button"
          onClick={() => {
            setSearchInput("");
            setSearch("");
            setStatusFilter("");
            setPage(1);
          }}
          className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
        >
          Clear Filters
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-[var(--color-danger)]/40 bg-red-50 px-4 py-3 text-sm text-[var(--color-danger)]">
          {error}
        </div>
      ) : null}

      <DataTable<CollegeListItem>
        loading={loading}
        rows={rows}
        emptyMessage="No colleges yet."
        columns={[
          {
            key: "name",
            header: "College Name",
            render: (row) => (
              <Link href={`/colleges/${row.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
                {row.name}
              </Link>
            ),
          },
          {
            key: "admin",
            header: "College Admin Email",
            render: (row) => row.admin_email ?? "-",
          },
          {
            key: "allocated",
            header: "Seat Allocated",
            render: (row) => formatNumber(row.tokens_allocated),
          },
          {
            key: "remaining",
            header: "Remaining Seat",
            render: (row) => formatNumber(row.tokens_remaining),
          },
          {
            key: "status",
            header: "Status",
            render: (row) => (
              <button type="button" className="inline-flex items-center gap-2" onClick={() => openStatusModal(row)}>
                <StatusBadge status={row.status} />
              </button>
            ),
          },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <div className="flex gap-3">
                <Link href={`/colleges/${row.id}/edit`} className="text-[var(--color-primary)] hover:underline">
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() =>
                    setDeleteConfirm({
                      open: true,
                      collegeId: row.id,
                      collegeName: row.name,
                    })
                  }
                  className="text-[var(--color-danger)] hover:underline"
                >
                  Delete
                </button>
              </div>
            ),
          },
        ]}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Page {page} of {totalPages} ({total} colleges)
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-50"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      <ConfirmModal
        open={confirm.open}
        title={confirm.targetStatus === "INACTIVE" ? `Deactivate ${confirm.collegeName}?` : `Reactivate ${confirm.collegeName}?`}
        message={
          confirm.targetStatus === "INACTIVE"
            ? `This will block all logins for ${confirm.collegeName} admin and students.`
            : "The college admin will regain access."
        }
        confirmLabel={confirm.targetStatus === "INACTIVE" ? "Deactivate" : "Reactivate"}
        destructive={confirm.targetStatus === "INACTIVE"}
        busy={statusUpdating}
        onCancel={() => setConfirm((prev) => ({ ...prev, open: false }))}
        onConfirm={() => void confirmStatusToggle()}
      />

      <ConfirmModal
        open={deleteConfirm.open}
        title={`Delete ${deleteConfirm.collegeName}?`}
        message="This permanently removes the college, its admin accounts, and assign seat history. This action cannot be undone."
        confirmLabel="Delete College"
        destructive
        busy={deleteBusy}
        onCancel={() => setDeleteConfirm({ open: false, collegeId: "", collegeName: "" })}
        onConfirm={() => void confirmDelete()}
      />

      {/* Onboard Modal */}
      {onboardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl relative">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Onboard College</h3>
            
            <form onSubmit={handleOnboardSubmit} className="space-y-4">
              <label className="block space-y-1">
                <span className="text-sm text-[var(--color-text-secondary)]">College Name</span>
                <input
                  value={onboardForm.college_name}
                  onChange={(e) => setOnboardForm((prev) => ({ ...prev, college_name: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
                  required
                  minLength={3}
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm text-[var(--color-text-secondary)]">Admin Full Name</span>
                <input
                  value={onboardForm.admin_full_name}
                  onChange={(e) => setOnboardForm((prev) => ({ ...prev, admin_full_name: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
                  required
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm text-[var(--color-text-secondary)]">College Admin Email</span>
                <input
                  type="email"
                  value={onboardForm.admin_email}
                  onChange={(e) => setOnboardForm((prev) => ({ ...prev, admin_email: e.target.value }))}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
                  required
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm text-[var(--color-text-secondary)]">Allocate Seat</span>
                <input
                  type="number"
                  min={0}
                  value={onboardForm.initial_alloc}
                  onChange={(e) => setOnboardForm((prev) => ({ ...prev, initial_alloc: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
                  required
                />
              </label>

              {onboardError && <p className="text-sm text-[var(--color-danger)]">{onboardError}</p>}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOnboardOpen(false)}
                  className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={onboardLoading}
                  className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
                >
                  {onboardLoading ? "Onboarding..." : "Onboard"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Created Credential Modal */}
      {createdCredential && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">College Onboarded</h3>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Save these credentials now. The password will not be shown again.
            </p>

            <div className="mt-4 space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-4">
              <p className="text-sm text-[var(--color-text-primary)]">
                <span className="font-medium">College:</span> {createdCredential.collegeName}
              </p>
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm text-[var(--color-text-primary)]">
                  <span className="font-medium">Admin Email:</span> {createdCredential.adminEmail}
                </p>
                <button
                  type="button"
                  onClick={() => void copyText(createdCredential.adminEmail)}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-1 text-xs"
                >
                  Copy
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm text-[var(--color-text-primary)]">
                  <span className="font-medium">Temporary Password:</span> {createdCredential.temporaryPassword}
                </p>
                <button
                  type="button"
                  onClick={() => void copyText(createdCredential.temporaryPassword)}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-1 text-xs"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCreatedCredential(null)}
                className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
