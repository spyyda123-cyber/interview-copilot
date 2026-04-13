import type { Metadata } from "next";
import "./globals.css";

import AdminGuard from "@/components/AdminGuard";
import AppShell from "@/components/layout/AppShell";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata: Metadata = {
  title: "Interview Copilot - College Admin",
  description: "College admin console",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AdminGuard>
            <AppShell>{children}</AppShell>
          </AdminGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
