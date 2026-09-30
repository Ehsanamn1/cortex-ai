import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startTraining, trainingConfig } from "@/lib/server/training";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!trainingConfig.enabled) return NextResponse.json({ ok: true, status: "disabled" });
  const expected = process.env.CORTEX_AUTO_IMPROVE_SECRET || "";
  if (!expected || req.headers.get("authorization") !== "Bearer " + expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const agents = await db.agent.findMany({
    where: { status: "active" },
    select: { id: true, workspaceId: true },
    take: 500,
  });

  const results: Array<{ agentId: string; status: string; message?: string }> = [];

  for (const agent of agents) {
    const approved = await db.trainingExample.count({
      where: {
        agentId: agent.id,
        workspaceId: agent.workspaceId,
        approved: true,
        qualityScore: { gte: 4 },
      },
    });

    const recentJob = await db.trainingJob.findFirst({
      where: { agentId: agent.id, workspaceId: agent.workspaceId },
      orderBy: { createdAt: "desc" },
    });

    if (approved < 8) {
      results.push({ agentId: agent.id, status: "not_enough_examples" });
      continue;
    }

    try {
      const job = await startTraining({
        workspaceId: agent.workspaceId,
        agentId: agent.id,
        method: "qlora",
      });
      results.push({
        agentId: agent.id,
        status: job.status,
        message: job.id === recentJob?.id ? "existing job reused" : "new training job",
      });
    } catch (error) {
      results.push({
        agentId: agent.id,
        status: "failed",
        message: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  return NextResponse.json({ ok: true, results });
}
