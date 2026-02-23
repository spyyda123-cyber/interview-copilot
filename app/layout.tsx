/**
 * ROOT LAYOUT
 *
 * This is the top-level layout for the entire Next.js app.
 *
 * STRUCTURE:
 * - HTML: Sets lang="en"
 * - Fonts: Space Grotesk (display), IBM Plex Mono (code/monospace)
 * - Theme: Tailwind dark mode (bg-slate-50, text-slate-900)
 * - Container: Max-width 5xl, centered, with padding
 * - Guard: ActivationGuard wraps main content
 *
 * ACTIVATION GUARD:
 * - Protects all routes under /onboarding, /target, /resume, /prep
 * - Allows public routes: /, /license, /status
 * - Checks sessionStorage for student_id + license_key
 * - Redirects unauthenticated users to /license
 * - Shows NavBar (header with health status + logout button) only when activated
 * - See app/components/ActivationGuard.tsx for detailed explanation
 *
 * METADATA:
 * - Title: "Interview Prep Studio"
 * - Description: "AI interview preparation for students"
 * - Used for browser tab title and search engine results
 *
 * FLOW:
 * 1. User visits app (any route)
 * 2. layout.tsx renders (root layout)
 * 3. ActivationGuard checks session state
 * 4. If deactivated: NavBar hidden, children not rendered, redirect to /license
 * 5. If activated: NavBar shown, children rendered normally
 * 6. Specific page component renders inside <main>
 *
 * CSS:
 * - globals.css: Global Tailwind configuration, base styles
 * - Radial gradient background: Blue-to-white gradient from top
 * - 100vh min-height: Full viewport height
 * - Flexbox layout: Sticky footer at bottom
 *
 * Do not remove ActivationGuard - it's required for route protection.
 * Do not convert ActivationGuard to server component - it must be client-side.
 * See ActivationGuard.tsx for detailed notes on SSR/hydration.
 */
import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import ActivationGuard from "./components/ActivationGuard";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Interview Prep Studio",
  description: "AI interview preparation for students",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} antialiased text-slate-900`}
      >
        <div className="min-h-screen bg-slate-50 bg-[radial-gradient(circle_at_top,_#e2e8f0,_#f8fafc_60%,_#ffffff_100%)]">
          <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-8">
            <ActivationGuard>
              <main className="mt-10 flex-1">{children}</main>
            </ActivationGuard>
          </div>
        </div>
      </body>
    </html>
  );
}
