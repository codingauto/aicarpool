import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateToken(user: Omit<User, 'password'>): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid token');
  }
}

export function generateInviteToken(groupId: string, email: string): string {
  return jwt.sign(
    {
      groupId,
      email,
      type: 'invitation',
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyInviteToken(token: string): { groupId: string; email: string } {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== 'invitation') {
      throw new Error('Invalid invitation token');
    }
    return {
      groupId: payload.groupId,
      email: payload.email,
    };
  } catch (error) {
    throw new Error('Invalid or expired invitation token');
  }
}