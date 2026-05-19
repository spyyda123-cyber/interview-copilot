/**
 * STATUS PAGE (/status)
 *
 * Displays system health status - checks if backend API and all dependencies are operational.
 * Public page (no auth required).
 */
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

const getIndicatorColor = (value: string) => {
  if (["ok", "running", "present"].includes(value)) return "bg-emerald-500";
  if (["error", "not_detected", "missing"].includes(value)) return "bg-red-500";
  return "bg-amber-400";
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
    const initial = setTimeout(() => {
      void fetchStatus();
    }, 0);
    const timer = setInterval(fetchStatus, REFRESH_INTERVAL_MS);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, []);

  const detailsEntries = useMemo(() => {
    if (!status?.details) return [];
    return Object.entries(status.details);
  }, [status]);

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6 animate-fade-in">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">System Status</h1>
        <p className="mt-2 text-[15px] text-[var(--text-secondary)]">
          Live health checks for backend services
        </p>
      </div>

      <div className="card-elevated p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Services</p>
          {lastUpdated && (
            <p className="text-xs text-[var(--text-muted)]">Updated: {lastUpdated}</p>
          )}
        </div>

        <div className="space-y-2">
          {STATUS_ITEMS.map((item) => {
            const value = status?.[item.key] ?? "checking";
            return (
              <div
                key={item.key}
                className="flex items-center justify-between rounded-xl bg-[var(--surface-muted)] px-4 py-3"
              >
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {item.label}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full ${getIndicatorColor(value)}`} />
                  <span className="text-sm text-[var(--text-secondary)] capitalize">{value}</span>
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {detailsEntries.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <p className="font-semibold mb-2">Details</p>
            <div className="space-y-1 text-xs">
              {detailsEntries.map(([key, message]) => (
                <p key={key}>
                  <span className="font-medium">{key}:</span> {message}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
