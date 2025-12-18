import crypto from 'crypto';

export function generateApiKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function verifyApiKey(key: string, hash: string): boolean {
  return hashApiKey(key) === hash;
}
