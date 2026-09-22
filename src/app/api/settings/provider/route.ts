import { db } from '@/lib/db';
import { applyCors, jsonError, jsonOk, readJson, toErrorResponse } from '@/lib/server/http';
import { requireSession, assertWorkspaceAccess } from '@/lib/server/auth';
import { encryptSecret } from '@/lib/server/secrets';
import { llmManager } from '@/lib/providers/llm/manager';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    const workspaceId = new URL(req.url).searchParams.get('workspaceId') || session.memberships[0]?.workspaceId;
    if (!workspaceId) return applyCors(jsonError('فضای کاری یافت نشد.', 400), req.headers.get('origin'));
    assertWorkspaceAccess(session, workspaceId);
    const config = await db.providerConfig.findUnique({ where: { workspaceId } });
    const status = await llmManager.statusForWorkspace(workspaceId);
    return applyCors(jsonOk({ config: config ? { id: config.id, providerName: config.providerName, baseUrl: config.baseUrl, model: config.model, authMode: config.authMode, enabled: config.enabled, hasApiKey: Boolean(config.apiKeyEncrypted) } : null, status }), req.headers.get('origin'));
  } catch (e) { return toErrorResponse(e); }
}

export async function PUT(req: Request) {
  try {
    const session = await requireSession(req);
    const body = await readJson<Record<string, unknown>>(req);
    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : session.memberships[0]?.workspaceId;
    if (!workspaceId) return applyCors(jsonError('فضای کاری یافت نشد.', 400), req.headers.get('origin'));
    const membership = assertWorkspaceAccess(session, workspaceId);
    if (!['owner', 'admin'].includes(membership.role)) {
      return applyCors(jsonError('فقط مالک یا مدیر می‌تواند اتصال هوش مصنوعی را تغییر دهد.', 403), req.headers.get('origin'));
    }
    const providerName = typeof body.providerName === 'string' ? body.providerName.trim().slice(0, 80) : '';
    const baseUrl = typeof body.baseUrl === 'string' ? body.baseUrl.trim().replace(/\/$/, '') : '';
    const model = typeof body.model === 'string' ? body.model.trim().slice(0, 160) : '';
    const authMode = typeof body.authMode === 'string' && ['bearer','x-api-key','none'].includes(body.authMode) ? body.authMode : 'bearer';
    const enabled = body.enabled !== false;
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
    if (providerName.length < 2 || baseUrl.length < 8 || !model) return applyCors(jsonError('نام سرویس، Base URL و Model الزامی هستند.', 400), req.headers.get('origin'));
    if (!/^https?:\/\//i.test(baseUrl)) return applyCors(jsonError('Base URL باید با http:// یا https:// شروع شود.', 400), req.headers.get('origin'));
    const current = await db.providerConfig.findUnique({ where: { workspaceId } });
    const config = await db.providerConfig.upsert({ where: { workspaceId }, update: { providerName, baseUrl, model, authMode, enabled, ...(apiKey ? { apiKeyEncrypted: encryptSecret(apiKey) } : {}) }, create: { workspaceId, providerName, baseUrl, model, authMode, enabled, apiKeyEncrypted: apiKey ? encryptSecret(apiKey) : null } });
    await db.auditLog.create({ data: { workspaceId, userId: session.user.id, action: 'provider.updated', entityType: 'provider_config', entityId: config.id, metadata: JSON.stringify({ providerName, baseUrl, model, authMode, enabled, rotatedKey: Boolean(apiKey), hadPreviousConfig: Boolean(current) }) } });
    return applyCors(jsonOk({ config: { id: config.id, providerName: config.providerName, baseUrl: config.baseUrl, model: config.model, authMode: config.authMode, enabled: config.enabled, hasApiKey: Boolean(config.apiKeyEncrypted) }, status: await llmManager.statusForWorkspace(workspaceId) }), req.headers.get('origin'));
  } catch (e) { return toErrorResponse(e); }
}
