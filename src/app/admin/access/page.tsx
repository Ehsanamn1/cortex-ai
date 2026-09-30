import { notFound } from "next/navigation";
import { AdminAccessClient } from "./admin-access-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PrivateAdminAccessQueryPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const params = await searchParams;
  const raw = params.token;
  const token = Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
  if (!token) notFound();
  return <AdminAccessClient token={token} />;
}
