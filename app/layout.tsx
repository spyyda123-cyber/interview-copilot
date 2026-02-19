import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import NavBar from "./components/NavBar";

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
            <NavBar />
            <main className="mt-10 flex-1">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
