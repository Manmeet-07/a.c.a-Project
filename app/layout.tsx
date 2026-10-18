import type { Metadata } from "next";
import { connection } from "next/server";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";

// Editorial accent face for single words in headlines (Instrument Serif, OFL).
const accentSerif = localFont({
  src: [
    { path: "../node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2", style: "italic", weight: "400" },
    { path: "../node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2", style: "normal", weight: "400" },
  ],
  variable: "--font-instrument-serif",
  display: "swap",
});

const description = "Match your resume to any job description, see what to highlight, and track every application. ACA never invents skills.";

export const metadata: Metadata = {
  title: { default: "ACA · Apply with a resume that fits", template: "%s" },
  description,
  openGraph: { title: "ACA · Apply with a resume that fits", description, type: "website" },
  twitter: { card: "summary_large_image", title: "ACA · Apply with a resume that fits", description },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${accentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
