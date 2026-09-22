import crypto from 'crypto';

function keyBytes(): Buffer {
  const secret = process.env.APP_SECRET_KEY;
  if (!secret || secret.length < 32) throw new Error('APP_SECRET_KEY باید حداقل ۳۲ کاراکتر باشد.');
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBytes(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptSecret(payload: string): string {
  const [version, ivRaw, tagRaw, dataRaw] = payload.split(':');
  if (version !== 'v1' || !ivRaw || !tagRaw || !dataRaw) throw new Error('Secret رمزنگاری‌شده معتبر نیست.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBytes(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataRaw, 'base64url')), decipher.final()]).toString('utf8');
}
