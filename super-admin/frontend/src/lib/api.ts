const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8030";

let tokenRef: string | null = null;

export const setAuthToken = (token: string | null) => {
  tokenRef = token;
};

const parseError = async (response: Response) => {
  try {
    const data = (await response.json()) as { detail?: string; message?: string };
    return data.detail ?? data.message ?? "Request failed.";
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

export type LoginResponse = {
  access_token?: string;
  token_type?: string;
  user_id?: string;
  role?: string;
  college_id?: string | null;
  full_name?: string | null;
  email?: string | null;
};

export const login = (email: string, password: string) =>
  apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

export const logoutApi = () =>
  apiFetch<{ status: string }>("/auth/logout", {
    method: "POST",
  });

export type DashboardActivity = {
  id: string;
  type: "ALLOCATION" | "CONSUMPTION" | "RECLAIM";
  college_name: string | null;
  amount: number;
  actor_name: string | null;
  note: string | null;
  created_at: string;
};

export type DashboardSummary = {
  total_colleges: number;
  active_colleges: number;
  total_tokens_issued: number;
  total_tokens_consumed: number;
  total_llm_tokens: number;
  total_llm_cost_usd: number;
  recent_activity: DashboardActivity[];
};

export type CollegeStatus = "ACTIVE" | "INACTIVE";
export type CollegeListItem = {
  id: string;
  name: string;
  admin_email: string | null;

  tokens_allocated: number;
  tokens_remaining: number;
  status: CollegeStatus;
  onboarded_on: string;
  city: string | null;
};

export type CollegeListResponse = {
  colleges: CollegeListItem[];
  total: number;
  page: number;
  per_page: number;
};

export type CollegeDetail = {
  id: string;
  name: string;
  city: string | null;

  status: CollegeStatus;
  created_at: string;
  updated_at: string;
  admin_name: string | null;
  admin_email: string | null;
  admin_phone: string | null;
  tokens_allocated: number;
  tokens_consumed: number;
  tokens_remaining: number;
  token_expiry_date: string | null;
};

export type CreateCollegePayload = {
  college_name: string;
  admin_full_name: string;
  admin_email: string;
  admin_phone?: string;
  city?: string;

  initial_token_quota: number;
  token_expiry_date?: string;
};

export type UpdateCollegePayload = {
  name?: string;
  city?: string;

};

export type CreateCollegeResponse = {
  college: CollegeDetail;
  admin_email: string;
  temporary_password: string;
};

export type CollegeTokenOverview = {
  college_id: string;
  total_allocated: number;
  total_consumed: number;
  balance: number;
  expiry_date: string | null;
};

export type StudentTokenUsage = {
  student_id: string;
  name: string | null;
  email: string | null;
  allocated: number;
  consumed: number;
  balance: number;
};

export type CollegeTokenUsage = {
  college_id: string;
  total_allocated: number;
  total_consumed: number;
  balance: number;
  expiry_date: string | null;
  per_action_breakdown: Record<string, number>;
  student_usage: StudentTokenUsage[];
};

export async function getDashboardSummary() {
  return authFetch<DashboardSummary>("/dashboard/summary");
}

export async function listColleges(params: {
  search?: string;
  status?: string;

  page?: number;
  per_page?: number;
}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.status) qs.set("status", params.status);

  if (params.page) qs.set("page", String(params.page));
  if (params.per_page) qs.set("per_page", String(params.per_page));
  const query = qs.toString();
  return authFetch<CollegeListResponse>(`/colleges${query ? `?${query}` : ""}`);
}

export async function getCollege(id: string) {
  return authFetch<CollegeDetail>(`/colleges/${id}`);
}

export async function createCollege(data: CreateCollegePayload) {
  return authFetch<CreateCollegeResponse>("/colleges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateCollege(id: string, data: UpdateCollegePayload) {
  return authFetch<CollegeDetail>(`/colleges/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function toggleCollegeStatus(id: string, status: CollegeStatus) {
  return authFetch<CollegeDetail>(`/colleges/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export async function deleteCollege(id: string) {
  return authFetch<{ status: string; message: string }>(`/colleges/${id}`, {
    method: "DELETE",
  });
}

export async function getCollegeTokens(collegeId: string) {
  return authFetch<CollegeTokenOverview>(`/colleges/${collegeId}/tokens`);
}

export async function allocateTokens(
  collegeId: string,
  data: { amount: number; note?: string; new_expiry_date?: string }
) {
  return authFetch<CollegeTokenOverview>(`/colleges/${collegeId}/tokens/allocate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function getCollegeTokenUsage(collegeId: string) {
  return authFetch<CollegeTokenUsage>(`/colleges/${collegeId}/token-usage`);
}

// ── Token Requests ─────────────────────────────────────────────

export type SuperAdminTokenRequestItem = {
  id: string;
  college_id: string;
  college_name: string;
  admin_name: string | null;
  admin_email: string | null;
  count: number;
  note: string | null;
  status: string;
  created_at: string;
};

export type SuperAdminTokenRequestListResponse = {
  items: SuperAdminTokenRequestItem[];
  total: number;
  page: number;
  per_page: number;
};

export async function listAllTokenRequests(params?: { status?: string; page?: number; per_page?: number }) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.per_page) qs.set('per_page', String(params.per_page));
  return authFetch<SuperAdminTokenRequestListResponse>(`/token-requests${qs.toString() ? `?${qs.toString()}` : ''}`);
}

export async function fulfillTokenRequest(requestId: string) {
  return authFetch<{ status: string; request_id: string; tokens_allocated: number }>(
    `/token-requests/${requestId}/fulfill`,
    { method: 'POST' }
  );
}

export async function rejectTokenRequest(requestId: string) {
  return authFetch<{ status: string; request_id: string }>(
    `/token-requests/${requestId}/reject`,
    { method: 'POST' }
  );
}
