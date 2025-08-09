import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';

/**
 * 处理OAuth回调并交换授权码
 * POST /api/enterprises/[enterpriseId]/oauth/callback
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
    const { platform, code, oauthParams, proxy } = body;

    if (!platform || !code || !oauthParams) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    // 解析授权码（可能是直接的code或完整的回调URL）
    const authCode = parseAuthCode(code);
    
    // 模拟Token交换（实际项目中需要实现真正的OAuth流程）
    const tokenData = await exchangeCodeForToken(platform, authCode, oauthParams);
    
    if (!tokenData.success) {
      return NextResponse.json({ 
        error: '授权码交换失败',
        details: 'error' in tokenData ? tokenData.error : '未知错误'
      }, { status: 400 });
    }

    // 返回成功结果，让前端处理token存储
    return NextResponse.json({
      success: true,
      data: {
        platform,
        accessToken: 'accessToken' in tokenData ? tokenData.accessToken : '',
        refreshToken: 'refreshToken' in tokenData ? tokenData.refreshToken : '',
        expiresIn: 'expiresIn' in tokenData ? tokenData.expiresIn : 0,
        message: '授权成功！请在表单中继续完成账户创建。'
      }
    });

  } catch (error) {
    console.error('OAuth回调处理失败:', error);
    return NextResponse.json(
      { error: 'OAuth回调处理失败' }, 
      { status: 500 }
    );
  }
}

// 解析授权码
function parseAuthCode(code: string): string {
  // 如果是完整的回调URL，提取code参数
  if (code.includes('code=')) {
    const url = new URL(code.startsWith('http') ? code : `https://example.com${code}`);
    return url.searchParams.get('code') || code;
  }
  
  return code.trim();
}

// 交换授权码获取Token
async function exchangeCodeForToken(platform: string, code: string, oauthParams: any) {
  try {
    switch (platform) {
      case 'claude':
        return await exchangeClaudeToken(code, oauthParams);
      case 'gemini':
        return await exchangeGoogleToken(code, oauthParams);
      default:
        return { success: false, error: `不支持的平台: ${platform}` };
    }
  } catch (error) {
    console.error('Token交换失败:', error);
    return { success: false, error: 'Token交换请求失败' };
  }
}

// Claude Token交换
async function exchangeClaudeToken(code: string, oauthParams: any) {
  // 模拟实现 - 实际需要调用Claude的OAuth接口
  console.log('Claude Token交换:', { code, oauthParams });
  
  // 这里应该调用Claude的真实OAuth接口
  // const response = await fetch('https://console.anthropic.com/v1/oauth/token', { 
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  //   body: new URLSearchParams({
  //     grant_type: 'authorization_code',
  //     client_id: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
  //     code: code,
  //     redirect_uri: 'https://console.anthropic.com/oauth/code/callback',
  //     code_verifier: oauthParams.codeVerifier
  //   })
  // });
  
  // 模拟返回
  return {
    success: true,
    accessToken: `claude_token_${Date.now()}`,
    refreshToken: `claude_refresh_${Date.now()}`,
    expiresIn: 3600
  };
}

// Google Token交换  
async function exchangeGoogleToken(code: string, oauthParams: any) {
  // 模拟实现 - 实际需要调用Google的OAuth接口
  console.log('Google Token交换:', { code, oauthParams });
  
  // 这里应该调用Google的真实OAuth接口
  // const response = await fetch('https://oauth2.googleapis.com/token', { ... });
  
  // 模拟返回
  return {
    success: true,
    accessToken: `google_token_${Date.now()}`,
    refreshToken: `google_refresh_${Date.now()}`,
    expiresIn: 3600
  };
}