import { applyCors, jsonError, jsonOk, toErrorResponse } from '@/lib/server/http';
import { requireSession, assertWorkspaceAccess } from '@/lib/server/auth';
import { llmManager } from '@/lib/providers/llm/manager';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    const workspaceId = new URL(req.url).searchParams.get('workspaceId') || session.memberships[0]?.workspaceId;
    if (!workspaceId) return applyCors(jsonError('فضای کاری یافت نشد.', 400), req.headers.get('origin'));
    assertWorkspaceAccess(session, workspaceId);
    const status = await llmManager.statusForWorkspace(workspaceId);
    return applyCors(jsonOk({
      config: null,
      status,
      managed: true,
      message: 'اتصال Provider توسط پیشخوان Cortex مدیریت می‌شود.',
    }), req.headers.get('origin'));
  } catch (e) { return toErrorResponse(e); }
}

export async function PUT(req: Request) {
  return applyCors(
    jsonError('تنظیم مستقیم Provider برای حساب مشتری غیرفعال است؛ Provider و کلیدها فقط از پیشخوان مدیر سیستم مدیریت می‌شوند.', 410),
    req.headers.get('origin'),
  );
}
