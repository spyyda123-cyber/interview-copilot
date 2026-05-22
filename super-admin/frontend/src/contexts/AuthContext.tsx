"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { login, logoutApi, setAuthToken } from "@/lib/api";

type UserClaims = {
  sub: string;
  role: string;
  college_id?: string;
  full_name?: string;
  email?: string;
};

type AuthContextType = {
  token: string | null;
  user: UserClaims | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const decodePayload = (token: string): UserClaims => {
  const payload = token.split(".")[1];
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(atob(padded)) as UserClaims;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserClaims | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("super_admin_token");
    if (storedToken) {
      try {
        const claims = decodePayload(storedToken);
        if (claims.role === "SUPER_ADMIN") {
          setToken(storedToken);
          setUser(claims);
          setAuthToken(storedToken);
        } else {
          localStorage.removeItem("super_admin_token");
        }
      } catch {
        localStorage.removeItem("super_admin_token");
      }
    }
    setIsLoading(false);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token && user),
      isLoading,
      login: async (email: string, password: string) => {
        const response = await login(email, password);
        if (!response.access_token) {
          throw new Error("Login failed: missing token.");
        }

        const claims = decodePayload(response.access_token);
        if (claims.role !== "SUPER_ADMIN") {
          throw new Error("Unauthorized role for super admin console.");
        }

        setToken(response.access_token);
        setUser(claims);
        setAuthToken(response.access_token);
        localStorage.setItem("super_admin_token", response.access_token);
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
        localStorage.removeItem("super_admin_token");
        router.replace("/login");
      },
    }),
    [router, token, user, isLoading]
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
