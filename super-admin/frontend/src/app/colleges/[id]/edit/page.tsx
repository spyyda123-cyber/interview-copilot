"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import PageHeader from "@/components/ui/PageHeader";
import { getCollege, updateCollege, type CollegeDetail } from "@/lib/api";

export default function EditCollegePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [college, setCollege] = useState<CollegeDetail | null>(null);
  const [form, setForm] = useState({ name: "", city: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getCollege(params.id);
        setCollege(data);
        setForm({ name: data.name, city: data.city ?? "" });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load college.");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [params.id]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await updateCollege(params.id, {
        name: form.name,
      });
      router.replace(`/colleges/${params.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update college.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-40 animate-pulse rounded-xl bg-[var(--color-primary-light)]" />;
  }

  if (!college) {
    return <p className="text-sm text-[var(--color-text-secondary)]">College not found.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${college.name}`} description="Update college profile." />

      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-sm text-[var(--color-text-secondary)]">College Name</span>
          <input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
            required
            minLength={3}
          />
        </label>

        <label className="space-y-1">
          <span className="text-sm text-[var(--color-text-secondary)]">City</span>
          <input
            value={form.city}
            onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
            className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
          />
        </label>


        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-3 text-sm">
          <p className="font-medium text-[var(--color-text-primary)]">Admin Details (Read-only)</p>
          <p className="mt-1 text-[var(--color-text-secondary)]">{college.admin_name ?? "-"}</p>
          <p className="text-[var(--color-text-secondary)]">{college.admin_email ?? "-"}</p>
          <p className="text-[var(--color-text-secondary)]">{college.admin_phone ?? "-"}</p>
        </div>

        <div className="col-span-1 flex gap-3 md:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <Link href={`/colleges/${college.id}`} className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm">
            Cancel
          </Link>
        </div>

        {error ? <p className="col-span-1 text-sm text-[var(--color-danger)] md:col-span-2">{error}</p> : null}
      </form>
    </div>
  );
}
