"use client";

import { FormEvent, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { setPassword } from "@/lib/api";

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setupToken = useMemo(() => searchParams.get("setup_token") ?? "", [searchParams]);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!setupToken) {
      setError("Missing setup token.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await setPassword(setupToken, newPassword);
      router.replace("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="mt-6 space-y-4" onSubmit={onSubmit}>
      <input
        className="w-full rounded-lg border border-blue-200 px-3 py-2"
        type="password"
        placeholder="New password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        minLength={8}
        required
      />
      <input
        className="w-full rounded-lg border border-blue-200 px-3 py-2"
        type="password"
        placeholder="Confirm password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        minLength={8}
        required
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        className="w-full rounded-lg bg-blue-700 px-4 py-2 font-medium text-white hover:bg-blue-800 disabled:opacity-60"
        disabled={loading}
        type="submit"
      >
        {loading ? "Updating..." : "Set Password"}
      </button>
    </form>
  );
}

export default function SetPasswordPage() {
  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto mt-20 max-w-md rounded-2xl border border-blue-200 bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-semibold text-blue-900">Set Password</h1>
        <p className="mt-2 text-sm text-slate-600">Finish first-login setup.</p>
        <Suspense fallback={<p className="mt-6 text-sm text-slate-600">Loading form...</p>}>
          <SetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
