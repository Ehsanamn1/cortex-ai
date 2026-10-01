import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OperatorConsole } from "@/components/operator-console";
import { operatorDashboardPath, operatorDashboardPathFromAdminSecret } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Cortex Operator Console",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PrivateOperatorConsolePage({ params }: { params: Promise<{ routeKey: string }> }) {
  const { routeKey } = await params;
  const expectedPath = "/ops/" + routeKey + "/console";
  const configured = process.env.CORTEX_ADMIN_ACCESS_TOKEN?.trim();
  const matchesAccessTokenPath = Boolean(configured && operatorDashboardPath(configured) === expectedPath);
  const matchesPasswordLoginPath = operatorDashboardPathFromAdminSecret() === expectedPath;
  if (!matchesAccessTokenPath && !matchesPasswordLoginPath) {
    notFound();
  }
  return <OperatorConsole />;
}
