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
 * PROTECTED ROUTES (require student_id + license_key):
 * - /onboarding: Collect student profile and preferences
 * - /target: Upload job description for analysis
 * - /resume: Upload resume PDF for parsing
 * - /prep: View generated learning plan
 *
 * PUBLIC ROUTES (no auth required):
 * - /: Home/landing page
 * - /license: License activation page
 * - /status: System status (health check)
 *
 * FLOW:
 * 1. User visits /prep (protected route)
 * 2. ActivationGuard checks sessionStorage for student_id + license_key
 * 3. If BOTH exist:
 *    - useSyncExternalStore.getSnapshot() returns true
 *    - Component renders children (page content)
 *    - NavBar becomes visible
 * 4. If either missing:
 *    - getSnapshot() returns false
 *    - useEffect triggers router.replace("/license")
 *    - Page redirects immediately, children not rendered
 * 5. After user activates license on /license:
 *    - sessionStorage updated with student_id + license_key
 *    - storage event fires (across tabs/windows)
 *    - subscribe() callback triggers
 *    - getSnapshot() now returns true
 *    - Component re-renders with protected content visible
 *
 * SESSION KEYS (see app/docs/session-contract.ts):
 * - student_id: Numeric ID from /license/activate response
 * - license_key: License key user entered on /license page
 * Both must be present for access to be granted.
 *
 * SECURITY NOTES:
 * - sessionStorage is NOT secure - it's cleared when tab closes
 * - This is by design - simple, no persistent auth cookies needed
 * - Each session requires re-activation of license_key
 * - Backend validates license_key on EVERY protected API call
 * - 403 response from API = invalid/expired license → clearSessionAndRedirectToLicense()
 *
 * Used by: app/layout.tsx (wraps all children in ActivationGuard)
 */
"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import NavBar from "./NavBar";

const PROTECTED_ROUTES = ["/onboarding", "/target", "/resume", "/prep"];

type ActivationGuardProps = {
  children: ReactNode;
};

export default function ActivationGuard({ children }: ActivationGuardProps) {
  const pathname = usePathname();
  const router = useRouter();

  const subscribe = (callback: () => void) => {
    if (typeof window === "undefined") {
      return () => {};
    }

    const handler = () => callback();
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  };

  const getSnapshot = () => {
    if (typeof window === "undefined") {
      return false;
    }

    return Boolean(
      window.sessionStorage.getItem("student_id") &&
        window.sessionStorage.getItem("license_key")
    );
  };

  const getServerSnapshot = () => false;

  const isProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  const activated = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  useEffect(() => {
    if (isProtectedRoute && !activated) {
      router.replace("/license");
    }
  }, [activated, isProtectedRoute, router]);

  const hideContent = isProtectedRoute && !activated;

  return (
    <>
      {activated ? <NavBar /> : null}
      {!hideContent ? children : null}
    </>
  );
}