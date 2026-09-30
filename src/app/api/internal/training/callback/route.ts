import { NextResponse } from "next/server";
import { handleTrainingCallback, trainingConfig } from "@/lib/server/training";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!trainingConfig.enabled) return NextResponse.json({ error: "training_disabled" }, { status: 503 });
  const expected = process.env.CORTEX_TRAINING_CALLBACK_SECRET || "";
  if (!expected || req.headers.get("authorization") !== "Bearer " + expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const payload = await req.json();
    const job = await handleTrainingCallback(payload);
    return NextResponse.json({
      ok: true,
      job: { id: job.id, status: job.status, promoted: job.promoted },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "callback failed" },
      { status: 500 },
    );
  }
}
