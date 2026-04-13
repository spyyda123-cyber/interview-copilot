import type { Metadata } from "next";
import "./globals.css";

import AppShell from "@/components/layout/AppShell";
import SuperAdminGuard from "@/components/SuperAdminGuard";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata: Metadata = {
  title: "Interview Copilot - Super Admin",
  description: "Super admin console",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <SuperAdminGuard>
            <AppShell>{children}</AppShell>
          </SuperAdminGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
