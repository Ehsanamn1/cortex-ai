import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, assertWorkspaceAccess } from "@/lib/server/auth";
import { loadAgentForSession } from "@/lib/server/access";
import { processSource } from "@/lib/knowledge/pipeline";
import { sanitizeFilename } from "@/lib/knowledge/extract";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_FILE_SIZE = 200 * 1024 * 1024;

type ClientPayload = {
  agentId?: unknown;
  originalName?: unknown;
  size?: unknown;
  mimeType?: unknown;
};

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const session = await requireSession(request);

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let payload: ClientPayload = {};
        try {
          payload = clientPayload ? (JSON.parse(clientPayload) as ClientPayload) : {};
        } catch {
          throw new Error("اطلاعات فایل معتبر نیست.");
        }

        const agentId = typeof payload.agentId === "string" ? payload.agentId : "";
        const originalName = sanitizeFilename(typeof payload.originalName === "string" ? payload.originalName : pathname);
        const size = typeof payload.size === "number" ? payload.size : 0;
        const mimeType = typeof payload.mimeType === "string" ? payload.mimeType.slice(0, 120) : "";

        if (!agentId || size <= 0 || size > MAX_FILE_SIZE) {
          throw new Error("حجم یا اطلاعات فایل معتبر نیست. سقف فایل ۲۰۰ مگابایت است.");
        }

        await loadAgentForSession(session, agentId);

        return {
          addRandomSuffix: true,
          access: "private",
          tokenPayload: JSON.stringify({
            userId: session.user.id,
            agentId,
            originalName,
            size,
            mimeType,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = JSON.parse(tokenPayload) as {
          userId: string;
          agentId: string;
          originalName: string;
          size: number;
          mimeType: string;
        };

        const owner = await db.user.findUnique({
          where: { id: payload.userId },
          include: { memberships: true },
        });
        if (!owner) throw new Error("کاربر بارگذاری‌کننده یافت نشد.");

        const agent = await db.agent.findUnique({ where: { id: payload.agentId } });
        if (!agent || !owner.memberships.some((m) => m.workspaceId === agent.workspaceId)) {
          throw new Error("دسترسی این فایل به ایجنت معتبر نیست.");
        }

        const source = await db.knowledgeSource.create({
          data: {
            agentId: agent.id,
            name: payload.originalName,
            type: "file",
            status: "pending",
          },
        });

        await db.knowledgeDocument.create({
          data: {
            sourceId: source.id,
            name: payload.originalName,
            mimeType: payload.mimeType || blob.contentType || null,
            sizeBytes: payload.size,
            url: blob.pathname,
            status: "pending",
          },
        });

        void processSource(source.id);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}
