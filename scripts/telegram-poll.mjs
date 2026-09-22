const base = process.env.CORTEX_BASE_URL || 'http://127.0.0.1:3000';
const secret = process.env.TELEGRAM_INTERNAL_SECRET;
if (!secret) throw new Error('TELEGRAM_INTERNAL_SECRET is required');
console.log(`[cortex] telegram polling started: ${base}`);
while (true) {
  try {
    const response = await fetch(`${base}/api/telegram/internal/poll`, {
      method: 'POST', headers: { 'x-cortex-internal-secret': secret }, signal: AbortSignal.timeout(60_000),
    });
    const data = await response.json().catch(() => null);
    console.log(new Date().toISOString(), response.status, JSON.stringify(data));
  } catch (error) { console.error('[cortex][telegram-poll]', error instanceof Error ? error.message : error); }
  await new Promise(r => setTimeout(r, 1000));
}
