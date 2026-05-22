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
import { DM_Sans, Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import ActivationGuard from "./components/ActivationGuard";
import ScrollToTop from "./components/ScrollToTop";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
        suppressHydrationWarning
        className={`${dmSans.variable} ${inter.variable} ${jetBrainsMono.variable} ${playfairDisplay.variable} antialiased`}
      >
        <ActivationGuard>
          <ScrollToTop />
          {children}
        </ActivationGuard>
      </body>
    </html>
  );
}
