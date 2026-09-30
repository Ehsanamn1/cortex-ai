import { AdminAccessClient } from "./admin-access-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PrivateAdminAccessQueryPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const params = await searchParams;
  const raw = Array.isArray(params.token) ? params.token[0] : params.token;
  return <AdminAccessClient token={raw ? decodeURIComponent(raw) : ""} />;
}
