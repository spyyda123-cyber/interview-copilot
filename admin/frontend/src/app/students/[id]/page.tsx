"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import ConfirmModal from "@/components/ui/ConfirmModal";
import PageHeader from "@/components/ui/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { getStudent, setStudentExpiry, toggleStudentStatus, type StudentDetail } from "@/lib/api";

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  const studentId = String(params.id);

  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusModal, setStatusModal] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setStudent(await getStudent(studentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load student details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [studentId]);

  if (loading) return <p>Loading...</p>;
  if (error || !student) return <p className="text-[var(--color-danger)]">{error ?? "Student not found"}</p>;

  const ats = student.resume_summary.ats_score;
  const atsColor = ats === null ? "text-[var(--color-text-secondary)]" : ats >= 70 ? "text-emerald-600" : ats >= 50 ? "text-amber-600" : "text-red-600";

  return (
    <div className="space-y-6">
      <PageHeader title={student.full_name} description={student.email} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-lg font-semibold">Profile</h2>
          <div className="mt-3 space-y-2 text-sm">
            <p><span className="text-[var(--color-text-secondary)]">Department:</span> {student.department ?? "-"}</p>
            <p><span className="text-[var(--color-text-secondary)]">Graduation Year:</span> {student.graduation_year ?? "-"}</p>
            <p><span className="text-[var(--color-text-secondary)]">Joined:</span> {new Date(student.created_at).toLocaleDateString()}</p>
            <p><span className="text-[var(--color-text-secondary)]">Last Active:</span> {student.last_active_at ? new Date(student.last_active_at).toLocaleString() : "Never"}</p>
            <div className="flex items-center gap-2">
              <span className="text-[var(--color-text-secondary)]">Status:</span>
              <button type="button" onClick={() => setStatusModal(true)}><StatusBadge status={student.status} /></button>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
              onClick={async () => {
                const next = prompt("Set access expiry YYYY-MM-DD (empty to clear)", student.access_expiry ?? "") ?? "";
                await setStudentExpiry(student.id, next.trim());
                await load();
              }}
            >
              Set Access Expiry
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-lg font-semibold">Prep Details</h2>
          {student.prep_details.target_company || student.prep_details.target_role || student.prep_details.interview_date ? (
            <div className="mt-3 space-y-2 text-sm">
              <p>Target Company: {student.prep_details.target_company ?? "-"}</p>
              <p>Target Role: {student.prep_details.target_role ?? "-"}</p>
              <p>Prep Mode: {student.prep_details.prep_mode ?? "-"}</p>
              <p>Tone: {student.prep_details.tone ?? "-"}</p>
              <p>Interview Date: {student.prep_details.interview_date ?? "-"}</p>
            </div>
          ) : <p className="mt-3 text-sm text-[var(--color-text-secondary)]">Student has not started interview preparation yet.</p>}
        </section>

        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-lg font-semibold">Invite Slot Activity</h2>
          <div className="mt-4 space-y-1 text-sm">
            {student.per_action_breakdown.length === 0 ? <p className="text-[var(--color-text-secondary)]">No usage events yet.</p> : null}
            {student.per_action_breakdown.map((item) => (
              <p key={item.action_type}>{item.action_type}: {item.tokens_used}</p>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-lg font-semibold">Resume & Study Plan</h2>
          <p className={`mt-3 text-3xl font-semibold ${atsColor}`}>{ats ?? "No ATS"}</p>
          <p className="text-sm text-[var(--color-text-secondary)]">Last scan: {student.resume_summary.last_scan_at ? new Date(student.resume_summary.last_scan_at).toLocaleString() : "No resume uploaded"}</p>
          <div className="mt-4">
            {student.study_plan.completion_percentage !== null ? (
              <>
                <div className="h-2 w-full rounded bg-[var(--color-surface-secondary)]">
                  <div className="h-2 rounded bg-[var(--color-primary)]" style={{ width: `${Math.min(100, student.study_plan.completion_percentage)}%` }} />
                </div>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{student.study_plan.completed_tasks} of {student.study_plan.total_tasks} tasks completed</p>
              </>
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">No study plan generated yet.</p>
            )}
          </div>
        </section>
      </div>

      <ConfirmModal
        open={statusModal}
        title={student.status === "ACTIVE" ? `Deactivate ${student.full_name}?` : `Activate ${student.full_name}?`}
        message={student.status === "ACTIVE" ? "This blocks student login." : "This allows student login."}
        destructive={student.status === "ACTIVE"}
        confirmLabel={student.status === "ACTIVE" ? "Deactivate" : "Activate"}
        onCancel={() => setStatusModal(false)}
        onConfirm={() => void toggleStudentStatus(student.id, student.status === "ACTIVE" ? "INACTIVE" : "ACTIVE").then(load).finally(() => setStatusModal(false))}
      />
    </div>
  );
}
