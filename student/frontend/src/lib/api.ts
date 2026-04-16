/**
 * API CLIENT - Interview Copilot Backend Integration
 *
 * This module provides all HTTP client functions for communicating with the backend API.
 *
 * CRITICAL SECURITY NOTES:
 * - Backend license binding relies on license_key being passed on every protected call
 * - All 403 responses trigger session cleanup and redirect to /license
 * - This is NOT JWT auth - license_key is the auth mechanism
 * - Every API call includes Content-Type header to prevent MIME type errors
 *
 * ERROR HANDLING:
 * - 403 Forbidden = License invalid/expired → Session cleared, redirect to /license
 * - 404 Not Found = Resource doesn't exist (student profile, target, etc)
 * - 500 Server Error = Backend issue (display to user)
 * - Timeout after 15 seconds = Network issue (display "Please try again")
 *
 * POLLING PATTERN:
 * - Plan generation is async (Celery worker runs in background)
 * - getPrepStatus is polled by frontend every 2-3 seconds
 * - Possible statuses: "generating" | "ready" | "failed" | "missing"
 * - Once "ready", call getLatestPrep to fetch the plan details
 *
 * SESSION STORAGE DEPENDENCY:
 * - Refer to app/docs/session-contract.ts for session key meanings
 * - Every protected page assumes student_id and license_key exist
 * - If either missing, ActivationGuard redirects to /license
 */

const getApiBaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }
  if (url.includes(":8000")) {
    throw new Error(
      "NEXT_PUBLIC_API_URL points to deprecated port 8000. Use backend port 8010."
    );
  }
  return url;
};

const API_TIMEOUT_MS = 15000;

type ApiError = {
  message?: string;
  detail?: string;
};

/**
 * Session keys to clear when user logs out or gets 403 response.
 * See app/docs/session-contract.ts for detailed explanation of each key.
 */
const SESSION_KEYS_TO_CLEAR = [
  "student_id",
  "student_name",
  "student_email",
  "company_name",
  "interview_date",
  "role",
  "target_id",
  "resume_id",
  "primary_skill",
  "known_skills",
  "support_mode",
  "tone",
  "coding_required",
  "jd_text",
] as const;

const clearSessionAndRedirectToLicense = () => {
  /**
   * CRITICAL: Called when API returns 403 (license invalid/expired/not found)
   *
   * This function:
   * 1. Clears ALL session storage keys (see SESSION_KEYS_TO_CLEAR)
   * 2. Redirects user to /license page to re-activate
   *
   * Why:
   * - 403 means backend rejected the license_key
   * - Session state is now inconsistent with backend
   * - User MUST re-activate with a valid license_key
   * - Clearing session prevents stale data from causing downstream errors
   *
   * Used by: apiFetch when response.status === 403
   * Side effects: Wipes all user data from sessionStorage, full page redirect
   * Recovery: User enters valid license_key on /license page
   */
  if (typeof window === "undefined") {
    return;
  }

  SESSION_KEYS_TO_CLEAR.forEach((key) => {
    window.sessionStorage.removeItem(key);
  });

  if (window.location.pathname !== "/login" && window.location.pathname !== "/signup") {
    window.location.replace("/login");
  }
};

export type ResumeUploadResponse = {
  resume_id: number;
  status: string;
  missing_skills: string[];
  ats_score: number;
};

export type StudentCreateResponse = {
  student_id: number;
};

export type TargetAnalyzeResponse = {
  target_id: number;
  status: string;
};

export type TargetStatusResponse = {
  target_id: number;
  status: string;
  error?: string | null;
  required_skills?: string[];
  difficulty?: string | null;
  round_structure?: string | null;
};

export type PrepGenerateResponse = {
  task_id: string;
  status: string;
};

export type PlanDetailResponse = {
  plan_id: number;
  student_id: number;
  company_name: string;
  role: string;
  days_available: number;
  plan_json: Record<string, unknown>;
};

export type PlanTaskStatusResponse = {
  task_id: string;
  status: string;
};

export type HealthResponse = {
  status: string;
};

export type AuthResponse = {
  student_id: number;
};

export type SystemStatusResponse = {
  api: string;
  database: string;
  redis: string;
  celery_worker: string;
  openai_key: string;
  details?: Record<string, string>;
};

const buildUrl = (path: string) => {
  if (path.startsWith("http")) {
    return path;
  }
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
};

const parseErrorMessage = async (response: Response) => {
  try {
    const data = (await response.json()) as ApiError;
    return data.message ?? data.detail ?? "Request failed.";
  } catch {
    return "Request failed.";
  }
};

const apiFetch = async <T>(path: string, options?: RequestInit) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options?.headers ?? {}),
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    if (response.status === 403) {
      clearSessionAndRedirectToLicense();
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
};

export const uploadResume = async (
  file: File,
  metadata?: {
    studentId?: number;
  }
) => {
  const formData = new FormData();
  if (metadata?.studentId !== undefined) {
    formData.append("student_id", String(metadata.studentId));
  }
  formData.append("file", file);

  return apiFetch<ResumeUploadResponse>("/resume/upload", {
    method: "POST",
    body: formData,
  });
};

export const uploadMarksheet = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  return apiFetch<{file_path: string, file_name: string}>("/marksheets/upload", {
    method: "POST",
    body: formData,
  });
};

export const createStudent = async (payload: {
  first_name: string;
  last_name: string;
  phone: string;
  department: string;
  email: string;
  primary_skill: string;
  known_skills: { skill: string; proficiency: string }[];
  support_mode: string;
  tone: string;
  coding_required: boolean;
  marksheets?: any[];
}) => {
  /**
   * Create student profile after license activation.
   *
   * ENDPOINT: POST /student/create
   * REQUIRED FIELDS:
   * - name: Student name (can be different from license holder)
   * - email: Student email
   * - primary_skill: Main technical skill (e.g., "Java")
   * - known_skills: Array of already-known skills (e.g., ["Python", "SQL"])
   * - support_mode: "guided" | "self" | "adaptive"
   * - tone: "supportive" | "direct" | "neutral"
   * - coding_required: boolean (include hands-on coding in plan?)
   *
   * RESPONSE: StudentCreateResponse
   * - student_id: Backend student record ID (store in session)
   *
   * FAILURE MODES:
   * - 400: Missing required fields
   * - 409: Duplicate student profile (shouldn't happen per student_id)
   *
   * BACKEND BEHAVIOR:
   * - Creates StudentProfile record with preferences
   * - student_id is used for all future API calls
   * - Preferences influence Gemini plan generation (tone, support_mode)
   *
   * Used by: /onboarding page (second step - personality/skill setup)
   * Flow: /license → /onboarding (calls this) → /target (JD upload)
   */
  return apiFetch<StudentCreateResponse>("/student/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};

export const analyzeTarget = async (payload: {
  student_id: number;
  company_name: string;
  role?: string | null;
  jd_text: string;
}) => {
  return apiFetch<TargetAnalyzeResponse>("/target/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};

export const getTargetStatus = async (targetId: number) => {
  /**
   * Poll job description analysis status.
   *
   * ENDPOINT: GET /target/status?target_id={targetId}
   * REQUIRED PARAMS: targetId (from previous analyzeTarget call)
   *
   * RESPONSE: TargetStatusResponse
   * - target_id: Echoes input target ID
   * - status: "processing" | "done" | "error"
   * - If status="done":
   *   - required_skills: Extracted skills from JD (e.g., ["Python", "REST APIs"])
   *   - difficulty: "entry" | "mid" | "senior"
   *   - round_structure: Interview format (e.g., "phone screen + 2 coding rounds + system design")
   * - If status="error":
   *   - error: Error message explaining what went wrong
   *
   * POLLING PATTERN:
   * - Call this function every 2 seconds after analyzeTarget
   * - Stop when status becomes "done" or "error"
   * - If error, display error message and let user retry
   * - If done, proceed to generatePrep
   *
   * BACKEND ASYNC:
   * - analyze_target_task runs in Celery worker
   * - Calls Gemini to parse JD and extract requirements
   * - Stores results in TargetInterview record
   * - This endpoint just queries the current status
   *
   * Used by: /target page (during/after JD analysis)
   */
  return apiFetch<TargetStatusResponse>(`/target/status?target_id=${targetId}`);
};

export const generatePrep = async (student_id: number) => {
  return apiFetch<PrepGenerateResponse>("/prep/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      student_id,
    }),
  });
};

export const signupStudent = async (payload: {
  name: string;
  email: string;
  password: string;
  roll_number?: string;
  department?: string;
  college?: string;
}) => {
  return apiFetch<AuthResponse>("/auth/signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};

export const loginStudent = async (payload: {
  email: string;
  password: string;
}) => {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};

export const getLatestPrep = async (
  studentId: number,
  targetId: number
) => {
  return apiFetch<PlanDetailResponse>(
    `/prep/latest/${studentId}?target_id=${targetId}`
  );
};

export const getPrepStatus = async (
  studentId: number,
  targetId: number
) => {
  return apiFetch<PrepGenerateResponse>(
    `/prep/status/${studentId}?target_id=${targetId}`
  );
};

export const getHealth = async () => {
  return apiFetch<HealthResponse>("/health");
};

export const getSystemStatus = async () => {
  return apiFetch<SystemStatusResponse>("/system/status");
};

export const generateCodeReport = async (payload: {
  question: string;
  code: string;
  language: string;
  test_results: any[];
  concepts_in_course: string[];
}) => {
  return apiFetch<any>("/prep/code-report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};
