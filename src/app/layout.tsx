
import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/query-provider";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f6f7fb",
  colorScheme: "light",
};

export const metadata: Metadata = {
  title: "Cortex AI",
  description: "ساخت و مدیریت ایجنت‌های هوش مصنوعی با دانش واقعی کسب‌وکار.",
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Cpath d='M24 4.5 40.45 13.9v19.2L24 42.5 7.55 33.1V13.9Z' fill='none' stroke='%23356DFF' stroke-width='3.5' stroke-linejoin='round'/%3E%3Ccircle cx='24' cy='23.5' r='5.5' fill='%2360708A'/%3E%3C/svg%3E",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k="cortex-theme-v2",t=localStorage.getItem(k),d=t==="dark";document.documentElement.classList.toggle("dark",d);document.documentElement.dataset.theme=d?"dark":"light";document.documentElement.style.colorScheme=d?"dark":"light"}catch(e){document.documentElement.classList.remove("dark");document.documentElement.dataset.theme="light";document.documentElement.style.colorScheme="light"}})();`,
          }}
        />
      </head>
      <body className={vazirmatn.variable + " antialiased bg-background text-foreground"}>
        <QueryProvider>
          {children}
        </QueryProvider>
        <Toaster position="top-center" dir="rtl" richColors />
      </body>
    </html>
  );
}
