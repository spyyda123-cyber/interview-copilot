/**
 * SCORM API Client — Interview Copilot Student Frontend
 *
 * Provides typed API calls for persisting and restoring SCORM learning progress.
 * All functions read NEXT_PUBLIC_API_URL from env.
 *
 * SCORM terminology used:
 *  - completion_status: "not_attempted" | "in_progress" | "completed"
 *  - success_status per section: "passed" | "failed" | "not_attempted"
 *  - session_time: cumulative seconds on a section
 *  - bookmark: last_accessed_module + last_accessed_section
 */

const getBase = () => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  return url.replace(/\/$/, "");
};

// ─────────────────────────────────────────────
//  Type Definitions
// ─────────────────────────────────────────────

export interface ScormSectionItem {
  id: number;
  plan_id: number;
  student_id: number;
  module_index: number;
  section_index: number;
  section_title: string;
  status: "not_attempted" | "passed" | "failed";
  score_raw: number | null;
  score_max: number | null;
  time_spent_seconds: number;
  attempts: number;
  completion_date: string | null;
  updated_at: string;
}

export interface ScormProgressResponse {
  plan_id: number;
  student_id: number;
  sections: ScormSectionItem[];
}

export interface ScormSummaryResponse {
  plan_id: number;
  student_id: number;
  completion_status: "not_attempted" | "in_progress" | "completed";
  modules_completed: number;
  total_modules: number;
  sections_completed: number;
  total_sections: number;
  total_score_raw: number;
  total_score_max: number;
  total_time_seconds: number;
  /** Resume bookmark */
  last_accessed_module: number;
  last_accessed_section: number;
  updated_at: string | null;
}

export interface ScormSectionCompletePayload {
  plan_id: number;
  student_id: number;
  module_index: number;
  section_index: number;
  section_title: string;
  status: "passed" | "failed";
  score_raw: number;
  score_max: number;
  time_spent_seconds: number;
  /** Total modules in this plan (for plan-level progress tracking) */
  total_modules: number;
  /** Total sections across the entire plan */
  total_sections: number;
}

export interface ScormSectionCompleteResponse {
  ok: boolean;
  plan_id: number;
  completion_status: string;
  sections_completed: number;
  total_sections: number;
}

// ─────────────────────────────────────────────
//  API Functions
// ─────────────────────────────────────────────

/**
 * Report a section as completed (passed or failed).
 * Called after the student submits and passes the section quiz.
 * Upserts the DB row and recomputes the plan-level summary.
 */
export async function reportSectionComplete(
  payload: ScormSectionCompletePayload
): Promise<ScormSectionCompleteResponse> {
  const res = await fetch(`${getBase()}/scorm/section/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? "Failed to report section complete.");
  }
  return res.json();
}

/**
 * Fetch all section-level SCORM progress for a plan.
 * Used on study-plan page load to restore completed sections.
 */
export async function fetchScormProgress(
  studentId: number,
  planId: number
): Promise<ScormProgressResponse> {
  const res = await fetch(
    `${getBase()}/scorm/progress/${studentId}?plan_id=${planId}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? "Failed to fetch SCORM progress.");
  }
  return res.json();
}

/**
 * Fetch the plan-level SCORM completion summary + bookmark.
 * Used on load to know where the student last left off.
 */
export async function fetchScormSummary(
  studentId: number,
  planId: number
): Promise<ScormSummaryResponse> {
  const res = await fetch(
    `${getBase()}/scorm/summary/${studentId}?plan_id=${planId}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? "Failed to fetch SCORM summary.");
  }
  return res.json();
}

/**
 * Update the navigation bookmark (last_accessed_module/section).
 * Called when the student switches modules or sections without completing them.
 * Fire-and-forget — no UI dependency on the response.
 */
export async function updateBookmark(
  studentId: number,
  planId: number,
  moduleIndex: number,
  sectionIndex: number
): Promise<void> {
  await fetch(`${getBase()}/scorm/bookmark`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      student_id: studentId,
      plan_id: planId,
      module_index: moduleIndex,
      section_index: sectionIndex,
    }),
  }).catch(() => {
    // Bookmark updates are non-critical — swallow errors silently
  });
}
