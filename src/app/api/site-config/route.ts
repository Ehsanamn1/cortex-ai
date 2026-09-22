import { NextResponse } from "next/server";
import { getPublicSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await getPublicSiteSettings();
  return NextResponse.json({
    settings: {
      "site.name": settings["site.name"],
      "site.description": settings["site.description"],
      "site.supportEmail": settings["site.supportEmail"],
      "site.maxUploadMb": settings["site.maxUploadMb"],
      "site.welcomeTitle": settings["site.welcomeTitle"],
    },
  });
}
