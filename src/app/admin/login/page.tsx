import { AdminLoginClient } from "./admin-login-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminLoginPage() {
  return <AdminLoginClient />;
}
