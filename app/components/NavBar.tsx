"use client";

import { useEffect, useState } from "react";
import { getHealth } from "@/src/lib/api";

export default function NavBar() {
  const [apiStatus, setApiStatus] = useState<"ok" | "down" | "checking">(
    "checking"
  );

  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        const response = await getHealth();
        if (isMounted) {
          setApiStatus(response.status === "ok" ? "ok" : "down");
        }
      } catch {
        if (isMounted) {
          setApiStatus("down");
        }
      }
    };

    checkHealth();
    const timer = setInterval(checkHealth, 15000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const statusStyles =
    apiStatus === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : apiStatus === "down"
      ? "border-rose-200 bg-rose-50 text-rose-600"
      : "border-slate-200 bg-slate-50 text-slate-500";

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
          Interview Prep Studio
        </p>
        <p className="text-lg font-semibold text-slate-900">
          AI Interview Preparation
        </p>
      </div>
      <span
        className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${statusStyles}`}
      >
        API {apiStatus === "checking" ? "Checking" : apiStatus}
      </span>
    </header>
  );
}
