"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f3f3f3] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#222222] mb-4">
            <span className="text-[#d9f36e] text-xl font-black">SA</span>
          </div>
          <h1 className="text-2xl font-bold text-[#222222]">Super Admin</h1>
          <p className="mt-1 text-sm text-[#555555]">Platform-level controls and governance.</p>
        </div>

        <div className="rounded-2xl border border-[#e8e8e8] bg-white p-8">
          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="block text-xs font-semibold text-[#555555] mb-1.5 uppercase tracking-wide">Email</label>
              <input
                className="w-full rounded-lg border border-[#e8e8e8] bg-[#f3f3f3] px-3 py-2.5 text-sm text-[#222222] placeholder-[#aaaaaa] focus:outline-none focus:border-[#d9f36e] focus:ring-2 focus:ring-[#d9f36e]/30 transition-colors"
                type="email"
                placeholder="superadmin@platform.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#555555] mb-1.5 uppercase tracking-wide">Password</label>
              <input
                className="w-full rounded-lg border border-[#e8e8e8] bg-[#f3f3f3] px-3 py-2.5 text-sm text-[#222222] placeholder-[#aaaaaa] focus:outline-none focus:border-[#d9f36e] focus:ring-2 focus:ring-[#d9f36e]/30 transition-colors"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error ? (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            ) : null}
            <button
              className="w-full rounded-lg bg-[#222222] px-4 py-2.5 text-sm font-bold text-[#d9f36e] hover:bg-[#d9f36e] hover:text-[#222222] disabled:opacity-60 transition-colors mt-2"
              disabled={loading}
              type="submit"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
