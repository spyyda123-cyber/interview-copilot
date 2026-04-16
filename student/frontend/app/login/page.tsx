"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import LoadingSpinner from "../components/LoadingSpinner";
import { loginStudent } from "@/src/lib/api";

export default function LoginPage() {
  const router = useRouter();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await loginStudent({
        email: email.trim(),
        password: password,
      });

      sessionStorage.setItem("student_id", String(response.student_id));
      sessionStorage.setItem("student_email", email.trim());

      router.push("/onboarding");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f4f3ed] p-4 text-slate-800" style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}>
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-slate-200/60 p-8">
        
        {/* Logo and Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-teal-400 mb-4 shadow-sm"></div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
          <p className="text-sm text-slate-500 mt-1">Sign in to Interview Copilot</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="enter your email"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-600">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="pt-2">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-sm font-semibold rounded-lg shadow-sm transition-colors flex justify-center items-center"
            >
              {loading ? <span className="flex items-center gap-2"><LoadingSpinner /> Signing in...</span> : "Sign in"}
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200">
              {error}
            </div>
          )}
          
          <div className="text-center mt-6 pt-2">
            <p className="text-xs text-slate-500">
              Don't have an account? <Link href="/signup" className="text-blue-600 font-medium hover:underline">Create account</Link>
            </p>
          </div>

        </form>
      </div>
    </div>
  );
}
