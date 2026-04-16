/**
 * ANALYSIS LOADING PAGE (/analysis)
 *
 * Purpose: Shows AI processing progress while analyzing resume and job description.
 * Matches wireframe PAGE 4: "Researching your interview..." with progress indicators.
 *
 * This page polls target and resume analysis status and displays progress.
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getTargetStatus, generatePrep, getPrepStatus } from "@/src/lib/api";

const POLL_INTERVAL_MS = 3000;

type AnalysisStep = {
  id: string;
  label: string;
  status: "pending" | "active" | "done";
};

export default function AnalysisPage() {
  const router = useRouter();
  const [studentId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = sessionStorage.getItem("student_id");
    return stored ? Number(stored) : null;
  });
  const [targetId] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const stored = sessionStorage.getItem("target_id");
    return stored ? Number(stored) : null;
  });
  const [companyName] = useState(() => {
    if (typeof window === "undefined") return "";
    return sessionStorage.getItem("company_name") ?? "your company";
  });
  
  const [steps, setSteps] = useState<AnalysisStep[]>([
    { id: "resume", label: "Parsing your resume...", status: "done" },
    { id: "company", label: `Researching ${companyName}...`, status: "active" },
    { id: "questions", label: "Finding past questions...", status: "pending" },
    { id: "plan", label: "Generating study plan...", status: "pending" },
  ]);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [isDone, setIsDone] = useState(false);

  const updateStepStatus = useCallback((stepId: string, status: AnalysisStep["status"]) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, status } : step
      )
    );
  }, []);

  const checkStatus = useCallback(async () => {
    if (!studentId || !targetId) return;

    try {
      // Check target analysis status
      const targetStatus = await getTargetStatus(targetId);

      if (targetStatus.status === "ready") {
        // Target is ready, move to company research done
        updateStepStatus("company", "done");
        updateStepStatus("questions", "active");
        setCurrentProgress(50);

        // Start plan generation
        await generatePrep(studentId);
        
        // Check plan status
        const planStatus = await getPrepStatus(studentId, targetId);
        
        if (planStatus.status === "ready") {
          // All done!
          updateStepStatus("questions", "done");
          updateStepStatus("plan", "done");
          setCurrentProgress(100);
          setIsDone(true);
          
          // Wait a moment then redirect
          setTimeout(() => {
            router.push("/company");
          }, 1500);
        } else {
          // Plan is generating
          updateStepStatus("questions", "done");
          updateStepStatus("plan", "active");
          setCurrentProgress(75);
        }
      }
    } catch (error) {
      console.error("Status check failed:", error);
    }
  }, [studentId, targetId, router, updateStepStatus]);

  useEffect(() => {
    if (!studentId || !targetId) {
      router.push("/login");
      return;
    }

    // Start polling
    const interval = setInterval(checkStatus, POLL_INTERVAL_MS);
    const initial = setTimeout(() => {
      void checkStatus();
    }, 0);

    return () => {
      clearInterval(interval);
      clearTimeout(initial);
    };
  }, [studentId, targetId, router, checkStatus]);

  useEffect(() => {
    // Smooth progress animation
    const timer = setInterval(() => {
      setCurrentProgress((prev) => {
        if (prev >= 100 || isDone) return prev;
        return Math.min(prev + 1, 95); // Never reach 100 until actually done
      });
    }, 200);

    return () => clearInterval(timer);
  }, [isDone]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center animate-fade-in">
      <div className="card w-full max-w-lg p-8">
        {/* Animated icon */}
        <div className="mb-6 flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-indigo-400 opacity-10" />
            <div className="animate-pulse-ring relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </div>
          </div>
        </div>

        <h2 style={{ fontFamily: "var(--font-dm-sans), sans-serif" }} className="mb-1 text-center text-lg font-bold text-[var(--text-primary)] tracking-tight">Researching your interview</h2>
        <p className="mb-6 text-center text-sm text-[var(--text-muted)]">Analyzing profile and preparing a personalized plan</p>

        {/* Progress */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--accent)]">Progress</span>
            <span className="text-xs font-bold text-[var(--accent)]">{currentProgress}%</span>
          </div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${currentProgress}%` }} /></div>
        </div>

        {/* Steps */}
        <div className="space-y-2">
          {steps.map((step, index) => (
            <div key={step.id} className={`flex items-center gap-3 rounded-lg p-3 transition ${
              step.status === "active" ? "bg-indigo-50 border border-indigo-100" :
              step.status === "done" ? "bg-emerald-50/50" : "bg-[var(--bg-muted)]"
            }`}>
              <div className="flex-shrink-0">
                {step.status === "done" ? (
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                ) : step.status === "active" ? (
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-100">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
                  </div>
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--border)]">
                    <span className="text-[10px] font-bold text-[var(--text-muted)]">{index + 1}</span>
                  </div>
                )}
              </div>
              <p className={`text-sm font-medium ${
                step.status === "done" ? "text-emerald-700" : step.status === "active" ? "text-indigo-700" : "text-[var(--text-muted)]"
              }`}>{step.label}</p>
            </div>
          ))}
        </div>

        {isDone && (
          <div className="mt-5 rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-center">
            <p className="text-sm font-semibold text-emerald-700">Complete — redirecting...</p>
          </div>
        )}
      </div>
    </div>
  );
}
