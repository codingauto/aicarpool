import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    // 验证用户身份
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { enterpriseId } = await params;
    const { state } = await request.json();

    // 使用与参考代码相同的Gemini OAuth配置
    const OAUTH_CLIENT_ID = '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com';
    const redirectUri = 'https://codeassist.google.com/authcode';
    const scope = 'https://www.googleapis.com/auth/cloud-platform';

    // 生成PKCE参数
    const codeVerifier = generateRandomString(128);
    const codeChallenge = base64URLEncode(sha256(codeVerifier));
    const authState = state || generateRandomString(32);

    // 构建Gemini OAuth授权URL
    const authParams = new URLSearchParams({
      response_type: 'code',
      client_id: OAUTH_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: scope,
      state: authState,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'select_account'
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`;

    console.log(`生成Gemini OAuth URL: ${authUrl}`);

    return NextResponse.json({
      success: true,
      data: {
        authUrl,
        sessionId: authState,
        oauthParams: {
          codeVerifier,
          state: authState,
          redirectUri
        }
      }
    });

  } catch (error) {
    console.error('生成Gemini OAuth授权URL失败:', error);
    return NextResponse.json(
      { error: '生成OAuth授权URL失败' }, 
      { status: 500 }
    );
  }
}

// 工具函数
function generateRandomString(length: number): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

function sha256(plain: string): Buffer {
  return crypto.createHash('sha256').update(plain).digest();
}

function base64URLEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
