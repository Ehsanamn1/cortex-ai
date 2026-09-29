import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ControlCenter } from "@/components/control-center";
import { verifyAdminSession } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const jar = await cookies();
  const session = jar.get("cortex_admin_session")?.value ?? null;
  if (!verifyAdminSession(session)) notFound();
  return <ControlCenter />;
}
