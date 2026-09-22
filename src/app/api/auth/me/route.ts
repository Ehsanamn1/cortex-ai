import { applyCors, jsonError, jsonOk, toErrorResponse } from "@/lib/server/http";
import { getSession, publicUser, publicWorkspaces } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session) {
      return applyCors(jsonError("وارد نشده‌اید.", 401), req.headers.get("origin"));
    }
    return applyCors(
      jsonOk({ user: publicUser(session.user), workspaces: publicWorkspaces(session) }),
      req.headers.get("origin")
    );
  } catch (e) {
    return toErrorResponse(e);
  }
}
