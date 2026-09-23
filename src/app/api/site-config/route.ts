import { NextResponse } from "next/server";
import { getPublicSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getPublicSiteSettings();
  return NextResponse.json({ settings }, {
    headers: { "cache-control": "public, max-age=30, stale-while-revalidate=300" },
  });
}
