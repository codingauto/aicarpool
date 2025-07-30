import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, createApiResponse } from '@/lib/middleware';
import QRCode from 'qrcode';

// 生成邀请二维码
async function getHandler(req: NextRequest, { params }: { params: Promise<{ id: string }> }, user: any) {
  try {
    const userId = user.id;
    const { id: groupId } = await params;
    const { searchParams } = new URL(req.url);
    const linkId = searchParams.get('linkId'); // 可选：指定特定的邀请链接ID

    // 检查用户是否为该组管理员
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        status: 'active',
        role: 'admin',
      },
    });

    if (!membership) {
      return createApiResponse(false, null, '只有管理员可以生成邀请二维码', 403);
    }

    let inviteUrl: string;

    if (linkId) {
      // 使用指定的邀请链接
      const inviteLink = await prisma.inviteLink.findFirst({
        where: {
          id: linkId,
          groupId,
          status: 'active',
        },
      });

      if (!inviteLink) {
        return createApiResponse(false, null, '邀请链接不存在或已失效', 404);
      }

      inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/join/${inviteLink.token}`;
    } else {
      // 创建一个默认的邀请链接
      const { generateInviteToken } = await import('@/lib/auth');
      
      // 计算过期时间（7天）
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const token = generateInviteToken(groupId, `qr_${Date.now()}`);

      const inviteLink = await prisma.inviteLink.create({
        data: {
          token,
          name: '二维码邀请链接',
          groupId,
          creatorId: userId,
          maxUses: 50, // 默认最多50次使用
          usedCount: 0,
          expiresAt,
          status: 'active',
        },
      });

      inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/join/${token}`;
    }

    // 生成二维码
    const qrCodeDataUrl = await QRCode.toDataURL(inviteUrl, {
      width: 256,
      margin: 2,
      color: {
        dark: '#1f2937',
        light: '#ffffff',
      },
    });

    return createApiResponse(true, {
      qrCode: qrCodeDataUrl,
      inviteUrl,
      size: 256,
    }, '二维码生成成功');

  } catch (error) {
    console.error('Generate QR code error:', error);
    return createApiResponse(false, null, '生成二维码失败', 500);
  }
}

export const GET = withAuth(getHandler);