import crypto from 'crypto';

// 生成API密钥
export function generateApiKey(prefix: string = 'ac'): string {
  const secretKey = crypto.randomBytes(32).toString('hex');
  return `${prefix}_${secretKey}`;
}

// 哈希API密钥
export function hashApiKey(apiKey: string, secret: string): string {
  return crypto.createHash('sha256').update(apiKey + secret).digest('hex');
}

// 生成随机字符串
export function generateRandomString(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}