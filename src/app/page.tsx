import { LandingPage } from "@/components/cortex/landing-page";
import { DEFAULT_SITE_SETTINGS, getPublicSiteSettings } from "@/lib/site-settings";
import { withPrismaRequest } from "@/lib/db";

export const revalidate = 30;

export default async function Home() {
  let settings = DEFAULT_SITE_SETTINGS;
  try {
    settings = await withPrismaRequest(() => getPublicSiteSettings());
  } catch {
    // Public shell must remain available even when the optional DB-backed site settings are unavailable.
  }
  return <LandingPage settings={settings} />;
}
