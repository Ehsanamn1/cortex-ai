import handler from "vinext/server/fetch-handler";
import { withPrismaRequest } from "@/lib/db";

export default {
  fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    return withPrismaRequest(() => handler.fetch(request, env, ctx));
  },
};
