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

    // 使用与参考代码相同的Claude OAuth配置
    const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
    const redirectUri = 'https://console.anthropic.com/oauth/code/callback';
    const scope = 'org:create_api_key user:profile user:inference';

    // 生成PKCE参数
    const codeVerifier = generateRandomString(128);
    const codeChallenge = base64URLEncode(sha256(codeVerifier));
    const authState = state || generateRandomString(32);

    // 构建Claude OAuth授权URL
    const authParams = new URLSearchParams({
      code: 'true',
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: scope,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: authState
    });

    const authUrl = `https://claude.ai/oauth/authorize?${authParams.toString()}`;

    console.log(`生成Claude OAuth URL: ${authUrl}`);

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
    console.error('生成Claude OAuth授权URL失败:', error);
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
