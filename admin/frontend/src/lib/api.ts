const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8020";

let tokenRef: string | null = null;

export const setAuthToken = (token: string | null) => {
  tokenRef = token;
};

const parseError = async (response: Response) => {
  try {
    const data = (await response.json()) as {
      detail?: string | Array<{ msg?: string; loc?: Array<string | number> }> | { msg?: string };
      message?: string;
    };

    if (Array.isArray(data.detail)) {
      const messages = data.detail
        .map((item) => {
          const loc = Array.isArray(item.loc) ? item.loc.join(".") : "field";
          return `${loc}: ${item.msg ?? "Invalid value"}`;
        })
        .filter(Boolean);
      if (messages.length > 0) {
        return messages.join("; ");
      }
    }

    if (typeof data.detail === "object" && data.detail !== null && "msg" in data.detail) {
      return data.detail.msg ?? "Request failed.";
    }

    if (typeof data.detail === "string") {
      return data.detail;
    }

    return data.message ?? "Request failed.";
  } catch {
    return "Request failed.";
  }
};

const apiFetch = async <T>(path: string, options?: RequestInit) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
};

export const authFetch = async <T>(path: string, options?: RequestInit) => {
  if (!tokenRef) {
    throw new Error("Missing auth token.");
  }

  return apiFetch<T>(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${tokenRef}`,
      ...(options?.headers ?? {}),
    },
  });
};

export type AdminLoginResponse = {
  access_token?: string;
  token_type?: string;
  user_id?: string;
  role?: string;
  college_id?: string | null;
  requires_password_setup?: boolean;
  setup_token?: string;
};

export const login = (email: string, password: string) =>
  apiFetch<AdminLoginResponse>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

export const logoutApi = () =>
  apiFetch<{ status: string }>("/auth/logout", {
    method: "POST",
  });

export const setPassword = (setup_token: string, new_password: string) =>
  apiFetch<{ status: string }>("/auth/set-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ setup_token, new_password }),
  });

type Status = "ACTIVE" | "INACTIVE" | "PENDING";

export type DashboardSummary = {
  token_pool: {
    total_allocated: number;
    total_consumed: number;
    balance: number;
    expiry_date: string | null;
  };
  total_students: number;
  active_students: number;
  inactive_students: number;
  low_token_alert: boolean;
  recent_activity: Array<{
    student_name: string | null;
    action_type: string;
    tokens_used: number;
    created_at: string;
  }>;
};

export type StudentListItem = {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  graduation_year: number | null;
  status: Status;
  last_active_at: string | null;
  access_expiry: string | null;
  target_company: string | null;
  target_role: string | null;
};

export type StudentListResponse = {
  students: StudentListItem[];
  total: number;
  page: number;
  per_page: number;
};

export type StudentDetail = {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  graduation_year: number | null;
  status: Status;
  created_at: string;
  last_active_at: string | null;
  access_expiry: string | null;
  per_action_breakdown: Array<{ action_type: string; tokens_used: number }>;
  prep_details: {
    target_company: string | null;
    target_role: string | null;
    prep_mode: string | null;
    tone: string | null;
    interview_date: string | null;
  };
  resume_summary: {
    ats_score: number | null;
    last_scan_at: string | null;
  };
  study_plan: {
    completed_tasks: number;
    total_tasks: number;
    completion_percentage: number | null;
  };
};

export type InviteResult = {
  imported: number;
  skipped: Array<{ email: string; reason: string }>;
  error?: string | null;
};

export type BulkInvitePreview = {
  valid_rows: Array<{
    row: number;
    full_name: string;
    email: string;
    phone?: string;
    department?: string;
    graduation_year?: number;
  }>;
  invalid_rows: Array<{ row: number; email?: string; errors: string[] }>;
  total_valid: number;
  total_invalid: number;
};

export type TokenPoolResponse = {
  total_allocated: number;
  total_consumed: number;
  balance: number;
  expiry_date: string | null;
  student_allocations: Array<{
    student_id: string;
    name: string | null;
    email: string | null;
    status: Status;
    allocated: number;
    consumed: number;
    balance: number;
    cap: number | null;
  }>;
};

export type ReadinessOverview = {
  average_ats_score: number | null;
  coding_completion_rate: number | null;
  study_plan_completion: number | null;
  top_target_companies: Array<{ name: string; count: number }>;
  top_target_roles: Array<{ name: string; count: number }>;
  students_not_started: number;
};

export type StudentDatabaseRecord = {
  id: string;
  college_id: string;
  roll_no: string;
  name: string;
  department: string;
  cgpa: number;
  backlogs: number;
  email: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type StudentDatabaseListResponse = {
  records: StudentDatabaseRecord[];
  total: number;
  page: number;
  per_page: number;
};

export type UploadResult = {
  imported: number;
  skipped: number;
  error?: string | null;
};

export async function getDashboardSummary() {
  return authFetch<DashboardSummary>("/dashboard/summary");
}

export async function listStudents(params: {
  search?: string;
  status?: string;
  target_company?: string;
  target_role?: string;
  sort_by?: string;
  sort_dir?: string;
  page?: number;
  per_page?: number;
}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      qs.set(key, String(value));
    }
  });
  return authFetch<StudentListResponse>(`/students${qs.toString() ? `?${qs.toString()}` : ""}`);
}

export async function getStudent(id: string) {
  return authFetch<StudentDetail>(`/students/${id}`);
}

export async function inviteStudents(emails: string[]) {
  return authFetch<InviteResult>("/students/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emails }),
  });
}

export async function bulkInvitePreview(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return authFetch<BulkInvitePreview>("/students/bulk-invite/preview", {
    method: "POST",
    body: formData,
  });
}

export async function bulkInviteConfirm(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return authFetch<InviteResult>("/students/bulk-invite/confirm", {
    method: "POST",
    body: formData,
  });
}

export async function listPendingStudents() {
  return authFetch<StudentListResponse>("/students/pending");
}

export async function approveStudent(id: string) {
  return authFetch<{ status: string }>(`/students/${id}/approve`, { method: "PATCH" });
}

export async function rejectStudent(id: string) {
  return authFetch<{ status: string }>(`/students/${id}/reject`, { method: "PATCH" });
}

export async function toggleStudentStatus(id: string, status: "ACTIVE" | "INACTIVE") {
  return authFetch<{ status: string }>(`/students/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export async function setStudentExpiry(id: string, date: string) {
  return authFetch<{ status: string }>(`/students/${id}/expiry`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_expiry: date || null }),
  });
}

export async function getTokenPool() {
  return authFetch<TokenPoolResponse>("/tokens");
}

export async function getPoolBalance(): Promise<{ total_allocated: number; total_consumed: number; balance: number }> {
  return authFetch<{ total_allocated: number; total_consumed: number; balance: number }>("/tokens/pool/balance");
}

export async function getReadinessOverview() {
  return authFetch<ReadinessOverview>("/readiness");
}

const triggerBrowserDownload = (blob: Blob, fileName: string) => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
};

const downloadCsv = async (path: string, fileName: string) => {
  if (!tokenRef) {
    throw new Error("Missing auth token.");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${tokenRef}`,
      Accept: "text/csv",
    },
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const blob = await response.blob();
  triggerBrowserDownload(blob, fileName);
};

export async function downloadStudentUsageReport() {
  await downloadCsv("/reports/student-usage", "student_usage_report.csv");
}

export async function downloadInviteSummaryReport() {
  await downloadCsv("/reports/invite-summary", "invite_summary_report.csv");
}

export async function downloadReadinessReport() {
  await downloadCsv("/reports/readiness", "readiness_report.csv");
}

export async function getStudentDatabase(params: {
  search?: string;
  sort_by?: string;
  sort_dir?: string;
  page?: number;
  per_page?: number;
}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      qs.set(key, String(value));
    }
  });
  return authFetch<StudentDatabaseListResponse>(`/student-db${qs.toString() ? `?${qs.toString()}` : ""}`);
}

export async function uploadStudentDatabase(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return authFetch<UploadResult>("/student-db/upload", {
    method: "POST",
    body: formData,
  });
}


export type CompanyCreate = {
  company_name: string;
  role: string;
  package_min?: number;
  package_max?: number;
  interview_date?: string;
  min_cgpa?: number;
  max_backlogs?: number;
  eligible_departments: string[];
  job_description?: string;
  exemption_list?: string[];
  status: string;
};

export type CompanyUpdate = Partial<CompanyCreate>;

export type CompanyResponse = {
  id: string;
  college_id: string;
  company_name: string;
  role: string;
  package_min?: number;
  package_max?: number;
  interview_date?: string;
  min_cgpa?: number;
  max_backlogs?: number;
  eligible_departments: string[];
  job_description?: string;
  exemption_list: string[];
  status: string;
  created_at: string;
  updated_at: string;
  interested_count: number;
  approved_count: number;
};

export type CompanyListResponse = {
  items: CompanyResponse[];
  total: number;
  page: number;
  per_page: number;
};

export async function listCompanies(page: number = 1, per_page: number = 20) {
  return authFetch<CompanyListResponse>(`/companies?page=${page}&per_page=${per_page}`);
}

export async function createCompany(payload: CompanyCreate) {
  return authFetch<CompanyResponse>('/companies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getCompany(id: string) {
  return authFetch<CompanyResponse>(`/companies/${id}`);
}

export async function updateCompany(id: string, payload: CompanyUpdate) {
  return authFetch<CompanyResponse>(`/companies/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

