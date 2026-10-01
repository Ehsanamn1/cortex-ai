import handler from "vinext/server/fetch-handler";
import { withPrismaRequest } from "@/lib/db";

const PRIVATE_ADMIN_LOGIN_PATH = "/ops/cx-7vK3m9Qp2Lx8R4tN6yH5cW1dZ0aB/login";

export default {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if ((request.method === "GET" || request.method === "HEAD") && (url.pathname === "/admin/login" || url.pathname === "/admin/access")) {
      url.pathname = PRIVATE_ADMIN_LOGIN_PATH;
      const rewritten = new Request(url, request);
      return withPrismaRequest(() => handler.fetch(rewritten, env, ctx));
    }
    return withPrismaRequest(() => handler.fetch(request, env, ctx));
  },
};
