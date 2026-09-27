import { getUsdTomanRate } from "@/lib/server/fx";
import { applyCors, jsonOk, toErrorResponse } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    return applyCors(jsonOk(await getUsdTomanRate()), req.headers.get("origin"));
  } catch (e) {
    return toErrorResponse(e, req.headers.get("origin"));
  }
}
