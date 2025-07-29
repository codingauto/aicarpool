const fs = require('fs');
const path = require('path');

// 需要修复的文件列表
const filesToFix = [
  'src/app/api/system/cleanup/route.ts',
  'src/app/api/ai-services/route.ts',
  'src/app/api/ai-proxy/chat/route.ts',
  'src/app/api/user/change-password/route.ts',
  'src/app/api/invite/[token]/route.ts',
  'src/app/api/groups/[id]/ip-subscriptions/route.ts',
  'src/app/api/groups/[id]/members/route.ts',
  'src/app/api/groups/[id]/invite-link/route.ts',
  'src/app/api/groups/[id]/ai-services/priority/route.ts',
  'src/app/api/groups/[id]/invitations/[invitationId]/route.ts',
  'src/app/api/groups/[id]/invitations/route.ts',
  'src/app/api/groups/[id]/invitations/batch/route.ts',
  'src/app/api/groups/[id]/ai-services/route.ts',
  'src/app/api/groups/[id]/ai-services/configure/route.ts',
  'src/app/api/groups/[id]/qrcode/route.ts',
  'src/app/api/groups/[id]/deployment-modes/route.ts',
  'src/app/api/groups/[id]/api-keys/route.ts',
  'src/app/api/join/[token]/route.ts',
  'src/app/api/ip-packages/route.ts',
  'src/app/api/auth/register/route.ts'
];

function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // 修复导入路径
    if (content.includes("from '@/lib/db'")) {
      content = content.replace(/from '@\/lib\/db'/g, "from '@/lib/prisma'");
      modified = true;
    }

    // 移除 AuthenticatedRequest 导入
    if (content.includes('AuthenticatedRequest')) {
      content = content.replace(/,\s*AuthenticatedRequest/g, '');
      content = content.replace(/AuthenticatedRequest,\s*/g, '');
      content = content.replace(/import\s*{\s*AuthenticatedRequest\s*}\s*from\s*'[^']*';\s*/g, '');
      modified = true;
    }

    // 修复函数签名
    content = content.replace(/async function (\w+)\(req: AuthenticatedRequest/g, 'async function $1(req: NextRequest, user: any');
    content = content.replace(/async function (\w+)\(\s*req: AuthenticatedRequest,/g, 'async function $1(req: NextRequest, user: any,');

    // 修复用户ID访问
    content = content.replace(/req\.user!\.userId/g, 'user.id');

    // 修复 withAuth 包装
    if (content.includes('export const GET = withAuth(')) {
      content = content.replace(/export const GET = withAuth\((\w+)\);/g, 'export const GET = withAuth($1);');
    }
    if (content.includes('export const POST = withAuth(')) {
      content = content.replace(/export const POST = withAuth\((\w+)\);/g, 'export const POST = withAuth($1);');
    }
    if (content.includes('export const PUT = withAuth(')) {
      content = content.replace(/export const PUT = withAuth\((\w+)\);/g, 'export const PUT = withAuth($1);');
    }
    if (content.includes('export const DELETE = withAuth(')) {
      content = content.replace(/export const DELETE = withAuth\((\w+)\);/g, 'export const DELETE = withAuth($1);');
    }

    // 确保导入了 NextRequest
    if (!content.includes("import { NextRequest }") && content.includes("NextRequest")) {
      content = "import { NextRequest } from 'next/server';\n" + content;
      modified = true;
    }

    // 移除不存在的导入
    content = content.replace(/,\s*serializeBigInt/g, '');
    content = content.replace(/serializeBigInt,\s*/g, '');
    content = content.replace(/import\s*{\s*serializeBigInt\s*}\s*from\s*'[^']*';\s*/g, '');

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ 修复了文件: ${filePath}`);
    } else {
      console.log(`⏭️  跳过文件: ${filePath} (无需修复)`);
    }
  } catch (error) {
    console.error(`❌ 修复文件失败: ${filePath}`, error.message);
  }
}

console.log('开始批量修复API路由文件...\n');

filesToFix.forEach(fixFile);

console.log('\n批量修复完成！');