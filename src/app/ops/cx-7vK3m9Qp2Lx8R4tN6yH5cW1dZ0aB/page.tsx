import type { Metadata } from "next";
import { AdminLoginClient } from "@/app/admin/login/admin-login-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Cortex Operator Console",
  robots: { index: false, follow: false, nocache: true },
};

export default function PrivateOperatorConsolePage() {
  return <AdminLoginClient />;
}
