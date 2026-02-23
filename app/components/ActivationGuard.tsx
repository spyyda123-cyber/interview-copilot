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