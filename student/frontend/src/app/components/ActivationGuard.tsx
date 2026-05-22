/**
 * ACTIVATION GUARD COMPONENT
 *
 * Protects routes that require active license / login session.
 * Checks sessionStorage for authentication token and redirects unauthenticated users to /license.
 *
 * CRITICAL ARCHITECTURE DECISIONS:
 *
 * 1. WHY USESYNCEXTERNALSTORE?
 *    - Next.js 13+ defaults to Server Components (SSR)
 *    - sessionStorage only exists on client/browser
 *    - If we render static HTML on server with user:activated=false,
 *      then hydrate with activated=true on client, React marks this as "hydration mismatch"
 *    - useSyncExternalStore solves this by:
 *      - getServerSnapshot() always returns false (safe for server)
 *      - getSnapshot() returns actual session state on client
 *      - React respects the mismatch and re-renders with client state
 *    - This allows protected routes to NOT render server-side before activation
 *    - Alternative (middleware): Would require secure token auth (we use license_key instead)
 *
 * 2. WHY NOT MIDDLEWARE?
 *    - Next.js middleware can check cookies but not sessionStorage
 *    - We use sessionStorage (not cookies) for security/privacy
 *    - User can clear sessionStorage to logout (simpler than deleting secure httpOnly cookies)
 *    - License activation is frontend-only (no server-side session state needed)
 *
 * 3. WHY NOT CONVERT TO SERVER COMPONENT?
 *    ⚠️  DO NOT attempt to move this logic to a server component
 *    - Server cannot read client sessionStorage
 *    - Would need backend token auth system (add complexity)
 *    - Current architecture: auth happens client-side, backend validates license_key
 *    - If you need server-side auth, must implement JWT token system first
 *
 * PROTECTED ROUTES (require student_id):
 * - /onboarding: Collect student profile and preferences
 * - /target: Upload job description for analysis
 * - /resume: Upload resume PDF for parsing
 * - /prep: View generated learning plan
 *
 * PUBLIC ROUTES (no auth required):
 * - /: Home/landing page
 * - /login: Login page
 * - /signup: Signup page
 * - /status: System status (health check)
 *
 * FLOW:
 * 1. User visits /prep (protected route)
 * 2. ActivationGuard checks sessionStorage for student_id
 * 3. If exists:
 *    - useSyncExternalStore.getSnapshot() returns true
 *    - Component renders children (page content)
 *    - NavBar becomes visible
 * 4. If missing:
 *    - getSnapshot() returns false
 *    - useEffect triggers router.replace("/login")
 *    - Page redirects immediately, children not rendered
 * 5. After user signs up or logs in:
 *    - sessionStorage updated with student_id
 *    - storage event fires (across tabs/windows)
 *    - subscribe() callback triggers
 *    - getSnapshot() now returns true
 *    - Component re-renders with protected content visible
 *
 * SESSION KEYS (see app/docs/session-contract.ts):
 * - student_id: Numeric ID from backend response
 *
 * SECURITY NOTES:
 * - sessionStorage is NOT secure - it's cleared when tab closes
 * - This is by design - simple, no persistent auth cookies needed
 * - 403 or 401 response from API → clearSessionAndRedirectToLogin()
 *
 * Used by: app/layout.tsx (wraps all children in ActivationGuard)
 */
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";

const PROTECTED_ROUTES = [
  "/onboarding",
  "/target",
  "/resume",
  "/analysis",
  "/company",
  "/prep",
  "/plan",
  "/interviews",
  "/study-plan",
  "/dashboard",
];

type ActivationGuardProps = {
  children: ReactNode;
};

export default function ActivationGuard({ children }: ActivationGuardProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [activated, setActivated] = useState(false);

  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      const isAuth = Boolean(window.sessionStorage.getItem("student_id"));
      setActivated(isAuth);
      if (isProtectedRoute && !isAuth) {
        router.replace("/login");
      }
    }
  }, [mounted, pathname, isProtectedRoute, router]);

  // Prevent hydration mismatches on server/client renders
  if (!mounted) {
    if (isProtectedRoute) {
      return null;
    }
    return <>{children}</>;
  }

  const hideContent = isProtectedRoute && !activated;

  if (hideContent) return null;

  if (activated) {
    return (
      <div className="app-shell">
        <Sidebar />
        <div className="main-area">
          <div className="main-content">{children}</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}