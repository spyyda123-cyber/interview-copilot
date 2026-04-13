"use client";

import { useEffect, useMemo, useState } from "react";

import PageHeader from "@/components/ui/PageHeader";
import { bulkInviteConfirm, bulkInvitePreview, getPoolBalance, inviteStudents, type BulkInvitePreview } from "@/lib/api";

const csvTemplate = "full_name,email,phone,department,graduation_year\nJohn Doe,john@example.com,+91-9999999999,CS,2026\n";

export default function InviteStudentsPage() {
  const [tab, setTab] = useState<"email" | "csv">("email");
  const [emailsText, setEmailsText] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BulkInvitePreview | null>(null);
  const [pool, setPool] = useState<{ total_allocated: number; total_consumed: number; balance: number } | null>(null);

  const refreshPool = async () => {
    try {
      setPool(await getPoolBalance());
    } catch {
      setPool(null);
    }
  };

  useEffect(() => {
    void refreshPool();
  }, []);

  const parsedEmails = useMemo(
    () => emailsText.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
    [emailsText]
  );

  const emailOverLimit = pool !== null && parsedEmails.length > pool.balance;
  const csvOverLimit = pool !== null && preview !== null && preview.total_valid > pool.balance;

  return (
    <div className="space-y-6">
      <PageHeader title="Invite Students" description="Invite by email or import a CSV cohort." />

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm">
        Invite Slots Available: <span className="font-semibold">{pool?.balance ?? "-"}</span> of <span className="font-semibold">{pool?.total_allocated ?? "-"}</span>
      </div>

      <div className="flex gap-2">
        <button className={`rounded-lg px-3 py-2 text-sm ${tab === "email" ? "bg-[var(--color-primary)] text-white" : "border border-[var(--color-border)]"}`} onClick={() => setTab("email")}>
          Email Invite
        </button>
        <button className={`rounded-lg px-3 py-2 text-sm ${tab === "csv" ? "bg-[var(--color-primary)] text-white" : "border border-[var(--color-border)]"}`} onClick={() => setTab("csv")}>
          CSV Upload
        </button>
      </div>

      {tab === "email" ? (
        <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <textarea
            rows={8}
            value={emailsText}
            onChange={(e) => setEmailsText(e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
            placeholder="student1@example.com\nstudent2@example.com"
          />
          {emailOverLimit ? (
            <p className="text-sm text-[var(--color-danger)]">
              You can only invite {pool?.balance ?? 0} more students. You entered {parsedEmails.length}.
            </p>
          ) : null}
          <button
            type="button"
            disabled={loading || parsedEmails.length === 0 || emailOverLimit}
            onClick={async () => {
              setLoading(true);
              setError(null);
              setResult(null);
              try {
                const response = await inviteStudents(parsedEmails);
                if (response.error) {
                  setError(response.error);
                }
                setResult(`${response.imported} invited, ${response.skipped.length} skipped`);
                await refreshPool();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Invite failed");
              } finally {
                setLoading(false);
              }
            }}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send Invitations"}
          </button>
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!file || loading}
              onClick={async () => {
                if (!file) return;
                setLoading(true);
                setError(null);
                setResult(null);
                try {
                  const response = await bulkInvitePreview(file);
                  setPreview(response);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Preview failed");
                } finally {
                  setLoading(false);
                }
              }}
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm"
            >
              Preview
            </button>
            <button
              type="button"
              disabled={!file || !preview || preview.total_valid === 0 || loading || csvOverLimit}
              onClick={async () => {
                if (!file) return;
                setLoading(true);
                setError(null);
                setResult(null);
                try {
                  const response = await bulkInviteConfirm(file);
                  if (response.error) {
                    setError(response.error);
                  }
                  setResult(`${response.imported} students imported`);
                  await refreshPool();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Import failed");
                } finally {
                  setLoading(false);
                }
              }}
              className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              Import {preview?.total_valid ?? 0} Students
            </button>
            <button
              type="button"
              onClick={() => {
                const blob = new Blob([csvTemplate], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "student_template.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm"
            >
              Download CSV Template
            </button>
          </div>

          {preview ? (
            <div className="space-y-2 text-sm">
              <p>{preview.total_valid} valid, {preview.total_invalid} invalid</p>
              {csvOverLimit ? (
                <p className="text-[var(--color-danger)]">
                  You have {pool?.balance ?? 0} invite slots but {preview.total_valid} valid students. Only {pool?.balance ?? 0} can be imported.
                </p>
              ) : null}
              {preview.invalid_rows.slice(0, 10).map((row) => (
                <p key={row.row} className="text-[var(--color-danger)]">Row {row.row}: {row.errors.join(", ")}</p>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
      {result ? <p className="text-sm text-[var(--color-success)]">{result}</p> : null}
    </div>
  );
}
