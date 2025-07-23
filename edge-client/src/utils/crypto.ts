/**
 * 加密工具函数
 */
import crypto from 'crypto';
import forge from 'node-forge';
import fs from 'fs/promises';
import path from 'path';

export class CryptoUtil {
  /**
   * 生成RSA密钥对
   */
  static generateKeyPair(): { publicKey: string; privateKey: string } {
    const keyPair = forge.pki.rsa.generateKeyPair({ bits: 2048 });
    
    const publicKey = forge.pki.publicKeyToPem(keyPair.publicKey);
    const privateKey = forge.pki.privateKeyToPem(keyPair.privateKey);
    
    return { publicKey, privateKey };
  }

  /**
   * 使用私钥签名数据
   */
  static signData(data: string, privateKey: string): string {
    const key = forge.pki.privateKeyFromPem(privateKey);
    const md = forge.md.sha256.create();
    md.update(data, 'utf8');
    
    const signature = key.sign(md);
    return forge.util.encode64(signature);
  }

  /**
   * 使用公钥验证签名
   */
  static verifySignature(data: string, signature: string, publicKey: string): boolean {
    try {
      const key = forge.pki.publicKeyFromPem(publicKey);
      const md = forge.md.sha256.create();
      md.update(data, 'utf8');
      
      const decodedSignature = forge.util.decode64(signature);
      return key.verify(md.digest().bytes(), decodedSignature);
    } catch (error) {
      return false;
    }
  }

  /**
   * 使用公钥加密数据
   */
  static encryptData(data: string, publicKey: string): string {
    const key = forge.pki.publicKeyFromPem(publicKey);
    const encrypted = key.encrypt(data, 'RSA-OAEP');
    return forge.util.encode64(encrypted);
  }

  /**
   * 使用私钥解密数据
   */
  static decryptData(encryptedData: string, privateKey: string): string {
    const key = forge.pki.privateKeyFromPem(privateKey);
    const decoded = forge.util.decode64(encryptedData);
    return key.decrypt(decoded, 'RSA-OAEP');
  }

  /**
   * 生成JWT Token
   */
  static generateJWT(payload: any, privateKey: string, expiresIn: string = '1h'): string {
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const exp = now + this.parseTimeToSeconds(expiresIn);

    const jwtPayload = {
      ...payload,
      iat: now,
      exp: exp
    };

    const headerBase64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadBase64 = Buffer.from(JSON.stringify(jwtPayload)).toString('base64url');
    
    const data = `${headerBase64}.${payloadBase64}`;
    const signature = this.signData(data, privateKey);
    const signatureBase64 = Buffer.from(signature, 'base64').toString('base64url');

    return `${data}.${signatureBase64}`;
  }

  /**
   * 验证JWT Token
   */
  static verifyJWT(token: string, publicKey: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      const [headerBase64, payloadBase64, signatureBase64] = parts;
      const data = `${headerBase64}.${payloadBase64}`;
      
      const signature = Buffer.from(signatureBase64, 'base64url').toString('base64');
      
      if (!this.verifySignature(data, signature, publicKey)) {
        throw new Error('Invalid signature');
      }

      const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString());
      
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token expired');
      }

      return payload;
    } catch (error) {
      throw new Error(`JWT verification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 生成随机字符串
   */
  static generateRandomString(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * 计算文件哈希值
   */
  static async calculateFileHash(filePath: string, algorithm: string = 'sha256'): Promise<string> {
    const hash = crypto.createHash(algorithm);
    const data = await fs.readFile(filePath);
    hash.update(data);
    return hash.digest('hex');
  }

  /**
   * 安全地保存密钥到文件
   */
  static async saveKeyToFile(key: string, filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, key, { mode: 0o600 });
  }

  /**
   * 从文件读取密钥
   */
  static async loadKeyFromFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf8');
  }

  /**
   * 将时间字符串解析为秒数
   */
  private static parseTimeToSeconds(timeStr: string): number {
    const match = timeStr.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error('Invalid time format');
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 60 * 60 * 24;
      default: throw new Error('Invalid time unit');
    }
  }
}