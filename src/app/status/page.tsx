"use client";

import { useEffect, useMemo, useState } from "react";
import { getSystemStatus, type SystemStatusResponse } from "@/src/lib/api";

const REFRESH_INTERVAL_MS = 5000;

type StatusKey = "api" | "database" | "redis" | "celery_worker" | "openai_key";

type StatusItem = {
  key: StatusKey;
  label: string;
};

const STATUS_ITEMS: StatusItem[] = [
  { key: "api", label: "API" },
  { key: "database", label: "Database" },
  { key: "redis", label: "Redis" },
  { key: "celery_worker", label: "Worker" },
  { key: "openai_key", label: "OpenAI key" },
];

const getIndicator = (value: string) => {
  if (["ok", "running", "present"].includes(value)) return "🟢";
  if (["error", "not_detected", "missing"].includes(value)) return "🔴";
  return "🟡";
};

export default function StatusPage() {
  const [status, setStatus] = useState<SystemStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const response = await getSystemStatus();
      setStatus(response);
      setError(null);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to reach /system/status";
      setError(message);
      setLastUpdated(new Date().toLocaleTimeString());
    }
  };

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchStatus, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const detailsEntries = useMemo(() => {
    if (!status?.details) return [];
    return Object.entries(status.details);
  }, [status]);

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
          Diagnostics
        </p>
        <h1 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
          System status for local development
        </h1>
        <p className="text-base text-slate-600">
          Checks update every 5 seconds. Use this page while running the backend services.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-lg shadow-slate-200/40 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-slate-900">Service checks</p>
          {lastUpdated ? (
            <p className="text-xs text-slate-400">Last updated: {lastUpdated}</p>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {STATUS_ITEMS.map((item) => {
            const value = status?.[item.key] ?? "unknown";
            return (
              <div
                key={item.key}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <span className="text-sm font-semibold text-slate-800">
                  {item.label}
                </span>
                <span className="text-sm text-slate-600">
                  {getIndicator(value)} {value}
                </span>
              </div>
            );
          })}
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error}
          </div>
        ) : null}

        {detailsEntries.length > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <p className="text-sm font-semibold">Details</p>
            <div className="mt-2 space-y-1 text-xs">
              {detailsEntries.map(([key, message]) => (
                <p key={key}>
                  {key}: {message}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
