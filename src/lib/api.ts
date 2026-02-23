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
  return apiFetch<TargetAnalyzeResponse>("/target/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
};

export const getTargetStatus = async (targetId: number) => {
  return apiFetch<TargetStatusResponse>(`/target/status?target_id=${targetId}`);
};

export const generatePrep = async (student_id: number, license_key: string) => {
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
