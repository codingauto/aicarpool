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

// 加密敏感数据（类似 claude-relay-service）
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_SALT = 'ai_account_salt';

function generateEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || 'fallback-encryption-key-for-development-only';
  return crypto.scryptSync(secret, ENCRYPTION_SALT, 32);
}

export function encryptSensitiveData(data: string): string {
  if (!data) return '';
  
  try {
    const key = generateEncryptionKey();
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // 将IV和加密数据一起返回，用:分隔
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    return data; // 返回原数据作为后备
  }
}

export function decryptSensitiveData(encryptedData: string): string {
  if (!encryptedData) return '';
  
  try {
    // 检查是否是新格式（包含IV）
    if (encryptedData.includes(':')) {
      const parts = encryptedData.split(':');
      if (parts.length === 2) {
        const key = generateEncryptionKey();
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        
        const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      }
    }
    
    // 如果不是预期格式，返回原数据
    console.warn('Could not decrypt data, returning as-is');
    return encryptedData;
  } catch (error) {
    console.error('Decryption error:', error);
    return encryptedData; // 返回原数据作为后备
  }
}