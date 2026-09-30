import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OperatorConsole } from "@/components/operator-console";
import { operatorDashboardPath } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Cortex Operator Console",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PrivateOperatorConsolePage({ params }: { params: Promise<{ routeKey: string }> }) {
  const { routeKey } = await params;
  const configured = process.env.CORTEX_ADMIN_ACCESS_TOKEN?.trim();
  if (!configured || operatorDashboardPath(configured) !== "/ops/" + routeKey + "/console") {
    notFound();
  }
  return <OperatorConsole />;
}
