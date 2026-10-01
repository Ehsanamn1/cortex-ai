import type { Metadata } from "next";
import OperatorConsoleHost from "@/components/operator-console-host";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Cortex Operator Console",
  robots: { index: false, follow: false, nocache: true },
};

export default function PrivateOperatorConsolePage() {
  return <OperatorConsoleHost />;
}
