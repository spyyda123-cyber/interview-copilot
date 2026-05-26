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
  return url;
};

const API_TIMEOUT_MS = 200000;

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

export type SubTopic = {
  id: string;
  title: string;
};

export type CurriculumTopic = {
  id: string;
  title: string;
  description: string;
  jd_relevance_note?: string;
  difficulty: "easy" | "medium" | "hard";
  mastery_time_minutes: number;
  mastery_percent?: number;
  status?: "not_started" | "in_progress" | "mastered";
  is_critical_gap: boolean;
  proficiency_tag: "advanced" | "intermediate" | "beginner" | "missing";
  roi_label: "high" | "medium";
  stage_id?: string;
  sub_topics: SubTopic[];
};

export type CurriculumCategory = {
  category_id: string;
  category_title: string;
  roi_label: "high" | "medium";
  topics: CurriculumTopic[];
};

export type RoadmapStage = {
  id: string;
  title: string;
  description: string;
  status: "completed" | "active" | "locked" | "not_started";
};

export type LearningTask = {
  id?: number;
  day: number;
  task_order: number;
  title: string;
  description: string;
  duration_minutes: number;
  task_type: "text" | "qa" | "code";
  qa_pairs: {
    question: string;
    answer: string;
    explanation: string;
    transition_note?: string | null;
  }[] | null;
  quiz: {
    question: string;
    options: string[];
    correct_index: number;
    explanation: string;
  }[] | null;
  code_metadata: {
    initial_code: string;
    solution?: string;
    test_cases: any;
    language: string;
    difficulty?: string;
    examples?: any[];
    constraints?: string[];
    hint?: string;
  } | null;
};

export type DailyPlanItem = {
  day: number;
  focus: string;
  tasks: LearningTask[];
};

export type PlanDetailResponse = {
  plan_id: number;
  student_id: number;
  company_name: string;
  role: string;
  days_available: number;
  plan_json: {
    // New Roadmap Engine format (Prompt 1)
    student_name?: string;
    company?: string;
    role?: string;
    target_readiness_score?: number;
    days_left?: number;
    roadmap_stages?: RoadmapStage[];
    curriculum?: CurriculumCategory[];
    weak_areas?: Array<string | { skill: string; reason: string }>;
    high_roi_topic_ids?: string[];
    ats_score?: number;
    keyword_match_score?: number;
    // Legacy daily_plan format (backward compat)
    overview?: string;
    daily_plan?: DailyPlanItem[];
    resources?: string[];
  };
};

export type PlanTaskStatusResponse = {
  task_id: string;
  status: string;
};

export type HealthResponse = {
  status: string;
};

// ── Progress Sync Types ──────────────────────────────────────────

export type TopicProgressUpdate = {
  topic_id: string;
  status: string;
  coding_pct?: number;
  quiz_done?: boolean;
  concepts_read_count?: number;
};

export type TopicProgressResponse = TopicProgressUpdate & {
  target_id: number;
  student_id: number;
};

export type SyncProgressPayload = {
  updates: TopicProgressUpdate[];
};


export type AuthResponse = {
  student_id: number;
  student_name?: string | null;
  primary_skill?: string | null;
};

export type SystemStatusResponse = {
  api: string;
  database: string;
  redis: string;
  celery_worker: string;
  openai_key: string;
  details?: Record<string, string>;
};

// ── Feedback Types ──────────────────────────────────────────────
export type FeedbackSubmitPayload = {
  student_id: number;
  company_name: string;
  role: string;
  interview_date: string; // ISO date string (YYYY-MM-DD)
  experience_rating: string;
  performance_rating: string;
  course_relevance: boolean;
  relevance_score: number;
  out_of_box_questions?: string | null;
  additional_notes?: string | null;
};

export type FeedbackResponse = {
  id: number;
  student_id: number;
  company_name: string;
  role: string;
  interview_date: string;
  experience_rating: string;
  performance_rating: string;
  course_relevance: boolean;
  relevance_score: number;
  out_of_box_questions?: string | null;
  additional_notes?: string | null;
  created_at: string;
};

export type PendingFeedbackItem = {
  company_name: string;
  role: string;
  interview_date: string;
};

export type PendingFeedbackResponse = {
  pending: PendingFeedbackItem[];
  count: number;
};

// ── Placement & Profile Types ──────────────────────────────────────

export type StudentProfileResponse = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  department: string;
  primary_skill?: string;
  cgpa: number;
  backlogs: number;
  is_verified: boolean;
};

export type CompanyListItem = {
  id: string;
  company_name: string;
  role: string;
  package_min: number | null;
  package_max: number | null;
  interview_date: string | null;
  min_cgpa: number | null;
  max_backlogs: number | null;
  eligible_departments: string[];
  job_description: string | null;
  status: string;
  application_status: string | null;
};

export type PlacementListResponse = {
  companies: CompanyListItem[];
  total: number;
};

export type ApplicationItem = {
  application_id: string;
  company_id: string;
  company_name: string;
  role: string;
  package_min: number | null;
  package_max: number | null;
  interview_date: string | null;
  job_description: string | null;
  application_status: string;
  applied_at: string;
};

export type ApplicationListResponse = {
  applications: ApplicationItem[];
  total: number;
};

export type ActionResponse = {
  status: string;
  application_id?: string;
  message: string;
  company_name?: string;
  role?: string;
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
    const isFormData = options?.body instanceof FormData;
    
    response = await fetch(buildUrl(path), {
      ...options,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        ...(isFormData ? {} : { "Accept": "application/json" }),  // Don't set Accept for FormData
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

export const uploadMarksheet = async (
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

  return apiFetch<{id: number, file_path: string, file_name: string, file_type: string, created_at: string}>("/student/marksheets/upload", {
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

// ── Progress API Functions ───────────────────────────────────────────────

export const getStudyProgress = async (
  studentId: number,
  targetId: number
) => {
  return apiFetch<TopicProgressResponse[]>(`/progress/${studentId}/${targetId}`);
};

export const syncTopicProgress = async (
  studentId: number,
  targetId: number,
  payload: SyncProgressPayload
) => {
  return apiFetch<{ status: string; updated_count: number }>(`/progress/${studentId}/${targetId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};

// ── Prompt 2 — Topic Learning Engine ─────────────────────────────────────────

export type TopicContent = {
  topic_id: string;
  topic_name: string;
  difficulty: string;
  frequency_label: string;
  mastery_time_minutes: number;
  strategic_insights: string;
  core_concepts: Array<{
    id: string;
    title: string;
    summary: string;
    content: {
      intuition: string;
      core_mechanics: string;
      real_world_usage: string;
      tradeoffs: string;
      common_mistakes: string;
      communication_tip: string;
    };
  }>;
  interview_traps: Array<{ title: string; description: string }>;
  practice_tasks: Array<{
    id: string;
    title: string;
    task_type: "code" | "qa" | "mock";
    duration_minutes: number;
    difficulty: string;
    problem_statement?: string;
    method_signatures?: string[];
    constraints?: string[];
    hints?: string[];
    time_complexity_target?: string;
    space_complexity_target?: string;
    test_cases?: Array<{ label: string; input: string; expected_output: string }>;
    question?: string;
    ideal_answer_points?: string[];
    scenario?: string;
    evaluation_criteria?: string[];
  }>;
  quiz: Array<{
    question_text: string;
    options: string[];
    correct_option_index: number;
    explanation: string;
  }>;
  visual_explanation: {
    type: string;
    title: string;
    components: any[];
    connections: any[];
    rows: any[];
  };
  communication_tips: string[];
};

export const getTopicContent = async (
  studentId: number,
  topicId: string,
  targetId: number
): Promise<TopicContent> => {
  return apiFetch<TopicContent>(
    `/topic/${studentId}/${topicId}?target_id=${targetId}`
  );
};

export const getStudentProfile = async (studentId: number) => {
  return apiFetch<StudentProfileResponse>(`/student/${studentId}/profile`);
};

export const getHealth = async () => {
  return apiFetch<any>("/health");
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

// ── Feedback API Functions ──────────────────────────────────────

export const submitFeedback = async (payload: FeedbackSubmitPayload) => {
  return apiFetch<FeedbackResponse>("/feedback/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};

export const getPendingFeedbacks = async (studentId: number) => {
  return apiFetch<PendingFeedbackResponse>(`/feedback/pending/${studentId}`);
};

export const getFeedbackByCompany = async (studentId: number, companyName: string) => {
  return apiFetch<FeedbackResponse[]>(`/feedback/detail/${studentId}/${encodeURIComponent(companyName)}`);
};

export const getAllFeedbacks = async (studentId: number) => {
  return apiFetch<FeedbackResponse[]>(`/feedback/all/${studentId}`);
};

// ── Placement & Profile API Functions ───────────────────────────────

export const getPlacements = async (studentId: number) => {
  return apiFetch<PlacementListResponse>(`/placement/companies?student_id=${studentId}`);
};

export const getStudentApplications = async (studentId: number) => {
  return apiFetch<ApplicationListResponse>(`/placement/applications?student_id=${studentId}`);
};

export const markInterest = async (studentId: number, companyId: string) => {
  return apiFetch<ActionResponse>("/placement/interest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ student_id: studentId, company_id: companyId }),
  });
};

export const activateCompany = async (studentId: number, companyId: string) => {
  return apiFetch<ActionResponse>("/placement/activate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ student_id: studentId, company_id: companyId }),
  });
};

export const resetPrepPlan = async (studentId: number, targetId: number) => {
  return apiFetch<PrepGenerateResponse>(`/prep/reset/${studentId}?target_id=${targetId}`, {
    method: "DELETE",
  });
};

// ── STAR Method Evaluation ───────────────────────────────────────────────────

export type STAREvaluateRequest = {
  topic_id: string;
  behavioral_question: string;
  student_answer: string;
  target_role?: string;
  company?: string;
};

export type STAREvaluateResponse = {
  overall_score: number;
  grade: "Excellent" | "Good" | "Needs Work" | "Incomplete";
  situation_feedback: string;
  task_feedback: string;
  action_feedback: string;
  result_feedback: string;
  strengths: string[];
  improvements: string[];
  improved_answer_hint: string;
  is_behavioral: boolean;
};

export const evaluateSTARResponse = async (
  payload: STAREvaluateRequest
): Promise<STAREvaluateResponse> => {
  return apiFetch<STAREvaluateResponse>("/topic/star-evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
};


// ── Judge0 Code Execution ─────────────────────────────────────────────────────

export type ExecuteTestCase = {
  label: string;
  input: string;
  expected_output: string;
};

export type ExecuteRequest = {
  language: string;
  source_code: string;
  test_cases: ExecuteTestCase[];
  problem_title?: string;
};

export type ExecuteTestResult = {
  label: string;
  passed: boolean;
  input: string;
  expected: string;
  got: string;
  stderr?: string | null;
  compile_error?: string | null;
  execution_time?: string | null;
};

export type ExecuteResponse = {
  results: ExecuteTestResult[];
  passed_count: number;
  total_count: number;
  success_rate: number;
};

export const executeCode = async (payload: ExecuteRequest): Promise<ExecuteResponse> => {
  const LANG_IDS: Record<string, number> = {
    python: 71,
    javascript: 63,
    java: 62,
    cpp: 54,
  };

  const JUDGE0_BASE = "https://ce.judge0.com";
  const langId = LANG_IDS[payload.language] ?? 71;

  const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));
  const decodeB64 = (s: string | null | undefined): string => {
    if (!s) return "";
    try { return decodeURIComponent(escape(atob(s))).trim(); } catch { return s.trim(); }
  };

  // ── Build a self-contained runnable source that:
  //    1. Contains the student's code
  //    2. Reads the test input from stdin
  //    3. Calls the detected function with that input
  //    4. Prints the result so Judge0 can compare stdout vs expected_output
  const buildRunnable = (language: string, source: string, input: string): { source: string; stdin: string } => {
    if (language === "python") {
      // Detect the first top-level function name (def <name>)
      const fnMatch = source.match(/^def\s+(\w+)\s*\(/m);
      const fnName = fnMatch?.[1] ?? null;

      if (fnName) {
        // Build a harness that reads stdin, parses it, calls the function, prints result
        const harness = `
import sys as _sys
import ast as _ast

_raw = _sys.stdin.read().strip()

# Try to parse the input as a Python literal (handles strings, lists, ints, tuples)
try:
    _arg = _ast.literal_eval(_raw)
except Exception:
    _arg = _raw  # fallback: pass as plain string

# Call the detected function and print the result
_result = ${fnName}(_arg)
print(_result)
`;
        return { source: source + "\n" + harness, stdin: input };
      }
      // No function detected — just pass stdin through (script-style code)
      return { source, stdin: input };
    }

    if (language === "javascript") {
      const fnMatch = source.match(/function\s+(\w+)\s*\(/) ?? source.match(/const\s+(\w+)\s*=\s*(?:async\s*)?\(/);
      const fnName = fnMatch?.[1] ?? null;
      if (fnName) {
        const harness = `
const _lines = require('fs').readFileSync('/dev/stdin','utf8').trim();
let _arg;
try { _arg = JSON.parse(_lines); } catch(e) { _arg = _lines; }
const _result = ${fnName}(_arg);
console.log(JSON.stringify(_result) !== undefined ? JSON.stringify(_result) : String(_result));
`;
        return { source: source + "\n" + harness, stdin: input };
      }
      return { source, stdin: input };
    }

    // Java / C++ — pass stdin as-is, student code must handle it
    return { source, stdin: input };
  };

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const submitOne = async (tc: ExecuteTestCase): Promise<ExecuteTestResult> => {
    const { source: runnableSource, stdin } = buildRunnable(payload.language, payload.source_code, tc.input);

    // Retry submit up to 3 times with backoff on 429 rate limit
    let token: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await sleep(attempt * 2000); // 2s, 4s backoff
      const submitRes = await fetch(
        `${JUDGE0_BASE}/submissions?base64_encoded=true&wait=false`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            language_id: langId,
            source_code: b64(runnableSource),
            stdin: b64(stdin),
            base64_encoded: true,
            wait: false,
          }),
        }
      );
      if (submitRes.status === 429) {
        // Rate limited — wait and retry
        await sleep(3000);
        continue;
      }
      if (!submitRes.ok) throw new Error(`Judge0 submit failed: ${submitRes.status}`);
      const body = await submitRes.json();
      token = body.token ?? null;
      if (token) break;
    }
    if (!token) throw new Error("No token from Judge0 after retries");

    // Poll until done (max 20s)
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const pollRes = await fetch(
        `${JUDGE0_BASE}/submissions/${token}?base64_encoded=true`,
        { headers: { "Content-Type": "application/json" } }
      );
      const result = await pollRes.json();
      const statusId: number = result?.status?.id ?? 0;
      if (statusId === 1 || statusId === 2) continue;

      const stdout = decodeB64(result.stdout);
      const stderr = decodeB64(result.stderr);
      const compileOut = decodeB64(result.compile_output);
      const execTime: string | null = result.time ?? null;

      const expected = tc.expected_output.trim();
      const actual = stdout.trim();

      let got: string;
      let passed: boolean;
      let compileError: string | null = null;

      if (statusId === 6) {
        got = `Compile Error: ${compileOut || stderr}`;
        passed = false;
        compileError = compileOut || stderr;
      } else if (statusId === 5) {
        got = "Time Limit Exceeded";
        passed = false;
      } else if (statusId >= 7 && statusId <= 12) {
        got = `Runtime Error: ${stderr || "Unknown"}`;
        passed = false;
      } else {
        // Normalise: strip quotes if AI expected_output is a quoted string like "3"
        const normaliseVal = (v: string) => {
          const stripped = v.replace(/^["']|["']$/g, "");
          return stripped;
        };
        passed = actual === expected || normaliseVal(actual) === normaliseVal(expected);
        got = actual || (stderr ? `Error: ${stderr}` : "(no output)");
      }

      return {
        label: tc.label || "Test",
        passed,
        input: tc.input,
        expected,
        got,
        stderr: stderr || null,
        compile_error: compileError,
        execution_time: execTime,
      };
    }

    return {
      label: tc.label || "Test",
      passed: false,
      input: tc.input,
      expected: tc.expected_output,
      got: "Execution timed out",
      stderr: null,
      compile_error: null,
      execution_time: null,
    };
  };

  // Run test cases sequentially with a small gap to avoid Judge0 rate limits
  const results: ExecuteTestResult[] = [];
  for (let i = 0; i < payload.test_cases.length; i++) {
    if (i > 0) await sleep(1500); // 1.5s between submissions
    results.push(await submitOne(payload.test_cases[i]));
  }

  const passed_count = results.filter(r => r.passed).length;
  const total_count = results.length;
  return {
    results,
    passed_count,
    total_count,
    success_rate: total_count > 0 ? Math.round((passed_count / total_count) * 100) : 0,
  };
};

