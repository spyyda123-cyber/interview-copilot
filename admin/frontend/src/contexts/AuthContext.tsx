"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { login, logoutApi, setAuthToken, type AdminLoginResponse } from "@/lib/api";

type UserClaims = {
  sub: string;
  role: string;
  college_id?: string;
};

type AuthContextType = {
  token: string | null;
  user: UserClaims | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ firstLogin: boolean; setupToken?: string }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const decodePayload = (token: string): UserClaims => {
  const payload = token.split(".")[1];
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(atob(padded)) as UserClaims;
};

const toAuthState = (response: AdminLoginResponse) => {
  if (response.requires_password_setup) {
    return { firstLogin: true, setupToken: response.setup_token };
  }

  if (!response.access_token) {
    throw new Error("Login failed: missing token.");
  }

  const claims = decodePayload(response.access_token);
  if (claims.role !== "COLLEGE_ADMIN") {
    throw new Error("Unauthorized role for admin console.");
  }

  return {
    firstLogin: false,
    token: response.access_token,
    user: claims,
  };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserClaims | null>(null);

  const value = useMemo<AuthContextType>(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token && user),
      login: async (email: string, password: string) => {
        const response = await login(email, password);
        const result = toAuthState(response);
        if (result.firstLogin) {
          return { firstLogin: true, setupToken: result.setupToken };
        }

        setToken(result.token ?? null);
        setUser(result.user ?? null);
        setAuthToken(result.token ?? null);
        return { firstLogin: false };
      },
      logout: async () => {
        try {
          await logoutApi();
        } catch {
          // Always clear local state on logout.
        }
        setToken(null);
        setUser(null);
        setAuthToken(null);
        router.replace("/login");
      },
    }),
    [router, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
