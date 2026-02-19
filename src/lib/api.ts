const getApiBaseUrl = () => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }
  return url;
};

type ApiError = {
  message?: string;
  detail?: string;
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
  summary: string;
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
  const response = await fetch(buildUrl(path), {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
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

export const createStudent = async (payload: {
  name: string;
  email: string;
  primary_skill: string;
  known_skills: string[];
  time_left_days: number;
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

export const getLatestPrep = async (studentId: number) => {
  return apiFetch<PlanDetailResponse>(`/prep/latest/${studentId}`);
};

export const getPlanStatus = async (taskId: string) => {
  return apiFetch<PlanTaskStatusResponse>(`/plan/status/${taskId}`);
};

export const getHealth = async () => {
  return apiFetch<HealthResponse>("/health");
};

export const getSystemStatus = async () => {
  return apiFetch<SystemStatusResponse>("/system/status");
};
