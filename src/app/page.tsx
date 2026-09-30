import { LandingPage } from "@/components/cortex/landing-page";
import { getPublicSiteSettings } from "@/lib/site-settings";
import { withPrismaRequest } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const settings = await withPrismaRequest(() => getPublicSiteSettings());
  return <LandingPage settings={settings} />;
}
