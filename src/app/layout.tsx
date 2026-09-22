import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
});

export const metadata: Metadata = {
  title: "Cortex AI | محصولی از ترانوس",
  description: "ایجنت‌های هوش مصنوعی را از دانش خودتان بسازید.",
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Cpath d='M24 4.5 40.45 13.9v19.2L24 42.5 7.55 33.1V13.9Z' fill='none' stroke='%233B82FF' stroke-width='3.5' stroke-linejoin='round'/%3E%3Ccircle cx='24' cy='23.5' r='5.5' fill='%238B5CF6'/%3E%3C/svg%3E",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning className="dark">
      <body className={`${vazirmatn.variable} antialiased bg-background text-foreground`}>
        {children}
        <Toaster position="top-center" dir="rtl" richColors theme="dark" />
      </body>
    </html>
  );
}
