import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import { prisma } from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // 从数据库获取用户信息
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
      },
    });

    if (!user || user.status !== 'active') {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export async function getUserFromRequest(request: NextRequest): Promise<AuthUser | null> {
  try {
    if (!request || !request.headers) {
      return null;
    }

    const authHeader = request.headers.get('authorization');
    
    // 开发模式：如果没有认证头，返回默认测试用户
    if (process.env.NODE_ENV === 'development' && !authHeader) {
      console.log('🔐 开发模式：使用默认测试用户认证');
      return {
        id: 'user_test_001',
        email: 'test@example.com',
        name: '测试用户',
        role: 'user'
      };
    }
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7).trim();
    
    if (!token || token === 'null' || token === 'undefined') {
      return null;
    }
    
    return await verifyToken(token);
  } catch (error) {
    console.error('Auth middleware error:', error);
    return null;
  }
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plainPassword, hashedPassword);
  } catch (error) {
    console.error('Password verification failed:', error);
    return false;
  }
}

export async function hashPassword(password: string): Promise<string> {
  try {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  } catch (error) {
    console.error('Password hashing failed:', error);
    throw new Error('密码加密失败');
  }
}

export async function authenticateUser(email: string, password: string): Promise<AuthUser | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        password: true,
      },
    });

    if (!user || user.status !== 'active') {
      return null;
    }

    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  } catch (error) {
    console.error('User authentication failed:', error);
    return null;
  }
}

export async function checkGroupPermission(
  userId: string, 
  groupId: string, 
  requiredRole: 'admin' | 'member' = 'member'
): Promise<boolean> {
  try {
    const membership = await prisma.groupMember.findFirst({
      where: {
        userId,
        groupId,
        status: 'active',
      },
    });

    if (!membership) {
      return false;
    }

    if (requiredRole === 'admin') {
      return membership.role === 'admin';
    }

    return true;
  } catch (error) {
    console.error('Permission check failed:', error);
    return false;
  }
}

// 生成邀请令牌
export function generateInviteToken(payload: Record<string, any>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

// 验证邀请令牌
export function verifyInviteToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// NextAuth 配置选项（兼容性导出）
export const authOptions = {
  secret: JWT_SECRET,
  session: {
    strategy: 'jwt' as const,
  },
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }: any) {
      if (token) {
        session.user.id = token.userId;
        session.user.role = token.role;
      }
      return session;
    },
  },
};