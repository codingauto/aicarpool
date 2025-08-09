import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import crypto from 'crypto';

/**
 * 生成OAuth授权URL
 * POST /api/enterprises/[enterpriseId]/oauth/auth-url
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enterpriseId: string }> }
) {
  try {
    const { enterpriseId } = await params;
    
    // 验证用户身份和权限
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const { platform, proxy } = body;

    if (!platform) {
      return NextResponse.json({ error: '缺少平台参数' }, { status: 400 });
    }

    // 生成OAuth参数（不存储到数据库，简化流程）
    const oauthParams = generateOAuthParams(platform);
    
    // 生成授权URL
    const authUrl = buildAuthUrl(platform, oauthParams);

    // 返回操作指引
    const instructions = [
      '1. 复制下面的链接到浏览器中打开',
      '2. 登录您的账户并完成授权',
      '3. 复制授权页面显示的授权码',
      '4. 在下一步中粘贴授权码完成认证'
    ];

    return NextResponse.json({
      success: true,
      data: {
        authUrl,
        instructions,
        platform,
        // 将必要的参数返回给前端，用于后续的回调处理
        oauthParams: {
          codeVerifier: oauthParams.codeVerifier,
          state: oauthParams.state
        }
      }
    });

  } catch (error) {
    console.error('生成OAuth授权URL失败:', error);
    return NextResponse.json(
      { error: '生成OAuth授权URL失败' }, 
      { status: 500 }
    );
  }
}

// 生成OAuth参数
function generateOAuthParams(platform: string) {
  const codeVerifier = generateRandomString(128);
  const codeChallenge = base64URLEncode(sha256(codeVerifier));
  const state = generateRandomString(32);

  return {
    codeVerifier,
    codeChallenge,
    state,
    redirectUri: getRedirectUri(platform)
  };
}

// 构建授权URL
function buildAuthUrl(platform: string, params: any): string {
  const { codeChallenge, state, redirectUri } = params;
  
  switch (platform) {
    case 'claude':
      // 使用与参考代码相同的配置
      const claudeParams = new URLSearchParams({
        code: 'true',
        client_id: getClientId(platform),
        response_type: 'code',
        redirect_uri: getRedirectUri(platform),
        scope: 'org:create_api_key user:profile user:inference',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state: state
      });
      return `https://claude.ai/oauth/authorize?${claudeParams.toString()}`;
        
    case 'gemini':
      return `https://accounts.google.com/o/oauth2/v2/auth?` +
        `response_type=code&` +
        `client_id=${getClientId(platform)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=https://www.googleapis.com/auth/cloud-platform&` +
        `state=${state}&` +
        `code_challenge=${codeChallenge}&` +
        `code_challenge_method=S256&` +
        `access_type=offline&` +
        `prompt=consent`;
        
    default:
      throw new Error(`不支持的平台: ${platform}`);
  }
}

// 获取客户端ID
function getClientId(platform: string): string {
  switch (platform) {
    case 'claude':
      // 使用与参考代码相同的Claude OAuth Client ID
      return '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
    case 'gemini':
      return process.env.GOOGLE_CLIENT_ID || 'google_client_id';
    default:
      throw new Error(`不支持的平台: ${platform}`);
  }
}

// 获取重定向URI
function getRedirectUri(platform: string): string {
  switch (platform) {
    case 'claude':
      // 使用与参考代码相同的重定向URI
      return 'https://console.anthropic.com/oauth/code/callback';
    case 'gemini':
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      return `${baseUrl}/oauth/callback/${platform}`;
    default:
      throw new Error(`不支持的平台: ${platform}`);
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