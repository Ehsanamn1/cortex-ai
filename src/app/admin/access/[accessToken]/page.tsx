import { AdminAccessClient } from "../admin-access-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PrivateAdminAccessPage({ params }: { params: Promise<{ accessToken: string }> }) {
  const { accessToken } = await params;
  return <AdminAccessClient token={decodeURIComponent(accessToken)} />;
}
