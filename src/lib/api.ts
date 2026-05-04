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

const API_TIMEOUT_MS = 30000; // 30 seconds for async operations and LLM generation

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
  "license_key",
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

  if (window.location.pathname !== "/license") {
    window.location.replace("/license");
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

export type LicenseActivateResponse = {
  student_id: number;
  company_name: string;
  role?: string | null;
  interview_date: string;
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
    licenseKey?: string;
  }
) => {
  /**
   * Upload student resume (PDF) and trigger async parsing + gap analysis.
   *
   * ENDPOINT: POST /resume/upload
   * REQUIRED FIELDS:
   * - file: PDF file (validated by backend, must be PDF)
   * - metadata.studentId: Student ID from session
   * - metadata.licenseKey: License key from session (auth)
   *
   * RESPONSE: ResumeUploadResponse
   * - resume_id: Use to track parsing status
   * - status: "processing" or "complete"
   * - missing_skills: Skills from JD not found in resume
   * - ats_score: Keyword match score (0-100)
   *
   * FAILURE MODES:
   * - 403: License invalid → clearSessionAndRedirectToLicense()
   * - 400: Invalid file format (not PDF)
   * - 404: Student profile not found
   *
   * ASYNC BEHAVIOR:
   * - PDF parsing happens in background (Celery worker)
   * - Response includes resume_id immediately
   * - Frontend should poll or wait for notification when parsing completes
   *
   * Used by: /resume page (first step after activation)
   */
  const formData = new FormData();
  if (metadata?.studentId !== undefined) {
    formData.append("student_id", String(metadata.studentId));
  }
  if (metadata?.licenseKey) {
    formData.append("license_key", metadata.licenseKey);
  }
  formData.append("file", file);

  return apiFetch<ResumeUploadResponse>("/resume/upload", {
    method: "POST",
    body: formData,
  });
};

export const createStudent = async (payload: {
  name: string;
  email: string;
  primary_skill: string;
  known_skills: string[];
  support_mode: string;
  tone: string;
  coding_required: boolean;
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
  license_key: string;
  student_id: number;
  company_name: string;
  role?: string | null;
  jd_text: string;
}) => {
  /**
   * Submit job description for AI analysis (skill extraction, difficulty, format).
   *
   * ENDPOINT: POST /target/analyze
   * REQUIRED FIELDS:
   * - license_key: From session (auth)
   * - student_id: From session (student identification)
   * - company_name: From session (validate same company as license)
   * - jd_text: Full job description text (copy-pasted by user)
   * - role: Specific job title (optional, defaults to license role)
   *
   * RESPONSE: TargetAnalyzeResponse
   * - target_id: Unique ID for this job posting analysis
   * - status: "processing" (async Celery job queued)
   *
   * ASYNC BEHAVIOR:
   * - Gemini analyzes JD in background
   * - Extract: required skills, difficulty (entry/mid/senior), interview format
   * - Frontend polls getTargetStatus(target_id) until status="done"
   * - Once done, call generatePrep with this target_id
   *
   * FAILURE MODES:
   * - 403: License invalid → clearSessionAndRedirectToLicense()
   * - 404: Student not found
   * - 400: JD text too short or invalid
   *
   * Used by: /target page (third step - job description input)
   * Flow: /onboarding → /target (calls this) → poll status → /prep
   *
   * BACKEND SECURITY:
   * - company_name must match license company_name
   * - This prevents analyzing JD for unauthorized companies
   */
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

export const generatePrep = async (student_id: number, license_key: string) => {
  /**
   * Trigger learning plan generation or retrieve existing plan.
   *
   * ENDPOINT: POST /prep/generate
   * REQUIRED FIELDS:
   * - student_id: From session
   * - license_key: From session (auth)
   *
   * RESPONSE: PrepGenerateResponse
   * - task_id: Plan ID (or Celery task ID)
   * - status: "generating" | "ready" | "failed" | "missing"
   *
   * BEHAVIOR BY STATUS:
   * - "generating": Plan is being generated by worker → poll getPrepStatus every 2 sec
   * - "ready": Plan is complete → call getLatestPrep to fetch full details
   * - "failed": Generation failed (worker error) → show error, allow retry
   * - "missing": No target interview found → redirect to /target
   *
   * ASYNC CACHING MECHANISM:
   * - Backend builds deterministic signature: student_id:company:role:interview_date
   * - Same signature = same plan (avoids duplicate Gemini calls)
   * - Multiple calls with same signature return cached plan
   * - If plan exists and ready, immediately returns task_id="plan.id" status="ready"
   * - If no plan or plan failed, creates new one and enqueues worker
   *
   * PLAN GENERATION (async, in Celery worker):
   * 1. Gather student profile, resume, target requirements, gap analysis
   * 2. Fetch company knowledge base context
   * 3. Build comprehensive Gemini prompt
   * 4. Call Gemini API (EXPENSIVE: ~1-2 tokens spent here)
   * 5. Parse JSON response (daily_plan structure)
   * 6. Create LearningTask records for each task
   * 7. Mark plan.status="ready" and license.plan_generated=True
   *
   * FAILURE MODES:
   * - 403: License invalid → clearSessionAndRedirectToLicense()
   * - 404: Student not found or no target interview
   * - 500: Gemini API error or database error
   *
   * Used by: /prep page (calls once on mount, then polls status)
   * Flow: /target → /prep (calls this) → poll getPrepStatus → display plan
   *
   * IMPORTANT: This call is intentionally "generate OR get" - idempotent
   * Multiple calls with same session = safe, returns same plan
   */
  return apiFetch<PrepGenerateResponse>("/prep/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      student_id,
      license_key,
    }),
  });
};

export const activateLicense = async (payload: {
  name: string;
  email: string;
  license_key: string;
}) => {
  /**
   * Activate license key - first step in user onboarding.
   *
   * ENDPOINT: POST /license/activate
   * REQUIRED FIELDS:
   * - name: Student name
   * - email: Student email
   * - license_key: License key (generated by admin or SaaS system)
   *
   * RESPONSE: LicenseActivateResponse
   * - student_id: Backend student record ID (store in sessionStorage)
   * - company_name: Which company this license is for (read-only)
   * - interview_date: When interview is scheduled (ISO date string)
   * - role: Optional job title (can be null)
   *
   * BACKEND VALIDATION:
   * - Validates license_key exists and is not expired
   * - Validates license_key is marked "unused" (not already activated)
   * - Validates interview_date is in future (auto-expires if past)
   * - Returns student_id from license record (may be NULL on first activation)
   *
   * SESSION STORAGE AFTER SUCCESS:
   * Set these keys immediately after activation:
   * - "student_id": response.student_id
   * - "license_key": payload.license_key (the one they entered)
   * - "company_name": response.company_name
   * - "interview_date": response.interview_date
   * - "role": response.role (optional)
   * - "student_name": payload.name
   * - "student_email": payload.email
   *
   * FAILURE MODES:
   * - 400: Invalid license key format
   * - 404: License key not found
   * - 409: License already activated (status != "unused")
   * - 410: License expired (interview_date passed)
   *
   * FLOW:
   * 1. User navigates to /license page
   * 2. Enters: name, email, license_key
   * 3. App calls activateLicense()
   * 4. Success → store session data → redirect to /onboarding
   * 5. Failure → display error → user retries
   *
   * Used by: /license page (entry point)
   * CRITICAL: This is the auth mechanism - all subsequent calls use license_key
   */
  return apiFetch<LicenseActivateResponse>("/license/activate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};

export const getLatestPrep = async (
  studentId: number,
  licenseKey: string,
  targetId: number
) => {
  /**
   * Fetch completed learning plan details.
   *
   * ENDPOINT: GET /prep/latest/{studentId}?license_key=...&target_id=...
   * REQUIRED PARAMS:
   * - studentId: From session (part of URL path)
   * - licenseKey: From session (URL query auth)
   * - targetId: From session (URL query, identifies which target this plan is for)
   *
   * RESPONSE: PlanDetailResponse
   * - plan_id: Unique plan ID
   * - student_id: Echoes input
   * - company_name: Company this plan is for
   * - role: Job title plan is tailored for
   * - days_available: Days until interview (determines task density)
   * - plan_json: Complete plan structure (daily_plan array)
   *
   * PLAN STRUCTURE (plan_json):
   * {
   *   daily_plan: [
   *     {
   *       day: 1,
   *       tasks: [
   *         {
   *           title: "Learn REST API basics",
   *           description: "... detailed steps ...",
   *           duration_minutes: 90
   *         },
   *         ... more tasks for day 1 ...
   *       ]
   *     },
   *     ... more days ...
   *   ]
   * }
   *
   * FAILURE MODES:
   * - 403: License invalid → clearSessionAndRedirectToLicense()
   * - 404: Plan not found, Target not found, or Student not found
   * - 400: Invalid query parameters
   *
   * WHEN TO CALL:
   * - After generatePrep returns status="ready"
   * - Call this to fetch full plan details for display
   * - Then render plan_json as daily task list in UI
   *
   * CACHING:
   * - Backend returns same plan for same signature
   * - Multiple calls are cheap (no Gemini call needed)
   *
   * Used by: /prep page (after plan is ready)
   */
  const encodedKey = encodeURIComponent(licenseKey);
  return apiFetch<PlanDetailResponse>(
    `/prep/latest/${studentId}?license_key=${encodedKey}&target_id=${targetId}`
  );
};

export const getPrepStatus = async (
  studentId: number,
  licenseKey: string,
  targetId: number
) => {
  /**
   * Poll learning plan generation status.
   *
   * ENDPOINT: GET /prep/status/{studentId}?license_key=...&target_id=...
   * REQUIRED PARAMS: (same as getLatestPrep)
   * - studentId: From session
   * - licenseKey: From session (auth)
   * - targetId: From session
   *
   * RESPONSE: PrepGenerateResponse
   * - task_id: Plan ID or Celery task ID
   * - status: "generating" | "ready" | "failed" | "missing"
   *
   * POLLING LIFECYCLE:
   * 1. Call generatePrep() → returns status="generating"
   * 2. Show spinner/loading UI
   * 3. Poll getPrepStatus() every 2 seconds
   * 4. While status="generating": continue polling, show spinner
   * 5. If status="ready": stop polling, call getLatestPrep, display plan
   * 6. If status="failed": stop polling, show error, offer retry
   * 7. If status="missing": should not happen (means no target), redirect to /target
   *
   * STALE PLAN DETECTION:
   * - Backend marks plans as "failed" if generation takes > 10 minutes
   * - This prevents infinite polling if worker crashes
   * - Frontend should offer "Retry" button when status="failed"
   *
   * WHY ASYNC POLLING?
   * - Gemini API calls are expensive (1-2 tokens per generate)
   * - Celery workers run in background to avoid blocking HTTP
   * - Frontend polls instead of waiting for response
   * - User can navigate away and come back to check status
   *
   * FAILURE MODES:
   * - 403: License invalid → clearSessionAndRedirectToLicense()
   * - 404: Plan not found, Target not found, or Student not found
   *
   * Used by: /prep page (polling loop, called every 2 seconds during generation)
   * Companion: generatePrep (initiates generation), getLatestPrep (fetches when ready)
   */
  const encodedKey = encodeURIComponent(licenseKey);
  return apiFetch<PrepGenerateResponse>(
    `/prep/status/${studentId}?license_key=${encodedKey}&target_id=${targetId}`
  );
};

export const getHealth = async () => {
  return apiFetch<HealthResponse>("/health");
};

export const getSystemStatus = async () => {
  return apiFetch<SystemStatusResponse>("/system/status");
};
