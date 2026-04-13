"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import PageHeader from "@/components/ui/PageHeader";
import { allocateTokens, getCollegeTokens } from "@/lib/api";

const formatNumber = (value: number) => new Intl.NumberFormat("en-IN").format(value);

export default function AllocateTokensPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [form, setForm] = useState({ amount: 1, note: "", new_expiry_date: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const overview = await getCollegeTokens(params.id);
        setCurrentBalance(overview.balance);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load available slots.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [params.id]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (form.amount < 1) {
      setError("Number of seats to add must be at least 1.");
      return;
    }

    setSaving(true);
    try {
      await allocateTokens(params.id, {
        amount: Number(form.amount),
        note: form.note || undefined,
        new_expiry_date: form.new_expiry_date || undefined,
      });
      router.replace(`/colleges/${params.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add invite slots.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Add Invite Slots" description="Increase college seat capacity." />

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        {loading ? (
          <div className="h-8 animate-pulse rounded bg-[var(--color-primary-light)]" />
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Current Available Slots: <span className="text-xl font-semibold text-[var(--color-text-primary)]">{formatNumber(currentBalance ?? 0)}</span>
          </p>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-text-secondary)]">Number of Seats to Add</span>
          <input
            type="number"
            min={1}
            value={form.amount}
            onChange={(e) => setForm((prev) => ({ ...prev, amount: Number(e.target.value) }))}
            className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-text-secondary)]">Reason / Note</span>
          <textarea
            value={form.note}
            onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
            className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
            rows={3}
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-[var(--color-text-secondary)]">New Expiry Date</span>
          <input
            type="date"
            value={form.new_expiry_date}
            onChange={(e) => setForm((prev) => ({ ...prev, new_expiry_date: e.target.value }))}
            className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
          />
        </label>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white"
          >
            {saving ? "Adding..." : "Add Seats"}
          </button>
          <Link href={`/colleges/${params.id}`} className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm">
            Cancel
          </Link>
        </div>

        {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
      </form>
    </div>
  );
}
