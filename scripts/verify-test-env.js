#!/usr/bin/env node

/**
 * 测试环境验证脚本
 * 检查所有测试所需的环境配置是否正确
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 验证测试环境配置...\n');

let hasError = false;
const warnings = [];
const successes = [];

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function success(msg) {
  console.log(`${colors.green}✅ ${msg}${colors.reset}`);
  successes.push(msg);
}

function error(msg) {
  console.log(`${colors.red}❌ ${msg}${colors.reset}`);
  hasError = true;
}

function warning(msg) {
  console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`);
  warnings.push(msg);
}

function info(msg) {
  console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`);
}

// 1. 检查Node.js版本
function checkNodeVersion() {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion >= 18) {
    success(`Node.js版本: ${nodeVersion}`);
  } else {
    error(`Node.js版本过低: ${nodeVersion}，需要 >= 18`);
  }
}

// 2. 检查必要的文件
function checkRequiredFiles() {
  const requiredFiles = [
    '.env.test',
    'jest.config.js',
    'tsconfig.json',
    'package.json'
  ];
  
  requiredFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      success(`找到配置文件: ${file}`);
    } else {
      error(`缺少配置文件: ${file}`);
    }
  });
}

// 3. 检查测试环境变量
function checkEnvVariables() {
  const envPath = path.join(process.cwd(), '.env.test');
  
  if (!fs.existsSync(envPath)) {
    error('缺少 .env.test 文件');
    return;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'NODE_ENV'
  ];
  
  requiredVars.forEach(varName => {
    if (envContent.includes(`${varName}=`)) {
      success(`环境变量已设置: ${varName}`);
    } else {
      error(`缺少环境变量: ${varName}`);
    }
  });
  
  // 检查NODE_ENV是否为test
  if (envContent.includes('NODE_ENV="test"') || envContent.includes("NODE_ENV='test'")) {
    success('NODE_ENV 正确设置为 test');
  } else {
    warning('NODE_ENV 应该设置为 test');
  }
}

// 4. 检查Jest配置
function checkJestConfig() {
  const configPath = path.join(process.cwd(), 'jest.config.js');
  
  if (!fs.existsSync(configPath)) {
    error('缺少 jest.config.js');
    return;
  }
  
  const config = require(configPath);
  
  if (config.preset === 'ts-jest') {
    success('Jest配置使用 ts-jest');
  } else {
    warning('建议使用 ts-jest preset');
  }
  
  if (config.testEnvironment === 'node') {
    success('测试环境设置为 node');
  } else {
    warning('测试环境应该设置为 node');
  }
  
  if (config.coverageDirectory) {
    success(`覆盖率目录: ${config.coverageDirectory}`);
  }
  
  if (config.setupFilesAfterEnv && config.setupFilesAfterEnv.length > 0) {
    success('找到测试设置文件');
  }
}

// 5. 检查测试文件
function checkTestFiles() {
  const testDir = path.join(process.cwd(), 'src/__tests__');
  
  if (!fs.existsSync(testDir)) {
    error('缺少测试目录: src/__tests__');
    return;
  }
  
  let testCount = 0;
  
  function countTests(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        countTests(filePath);
      } else if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) {
        testCount++;
      }
    });
  }
  
  countTests(testDir);
  
  if (testCount > 0) {
    success(`找到 ${testCount} 个测试文件`);
  } else {
    error('没有找到测试文件');
  }
}

// 6. 检查依赖包
function checkDependencies() {
  const packageJson = require(path.join(process.cwd(), 'package.json'));
  const devDeps = packageJson.devDependencies || {};
  
  const requiredPackages = [
    'jest',
    '@types/jest',
    'ts-jest',
    '@testing-library/react',
    '@testing-library/jest-dom'
  ];
  
  requiredPackages.forEach(pkg => {
    if (devDeps[pkg]) {
      success(`测试依赖已安装: ${pkg}`);
    } else {
      error(`缺少测试依赖: ${pkg}`);
    }
  });
}

// 7. 检查测试脚本
function checkTestScripts() {
  const packageJson = require(path.join(process.cwd(), 'package.json'));
  const scripts = packageJson.scripts || {};
  
  const requiredScripts = [
    'test',
    'test:watch',
    'test:coverage'
  ];
  
  requiredScripts.forEach(script => {
    if (scripts[script]) {
      success(`测试脚本已定义: npm run ${script}`);
    } else {
      warning(`建议添加脚本: npm run ${script}`);
    }
  });
}

// 8. 检查Mock和工具文件
function checkTestUtils() {
  const utilsDir = path.join(process.cwd(), 'src/test-utils');
  
  if (fs.existsSync(utilsDir)) {
    success('找到测试工具目录: src/test-utils');
    
    const subdirs = ['factories', 'helpers', 'mocks'];
    subdirs.forEach(subdir => {
      const subdirPath = path.join(utilsDir, subdir);
      if (fs.existsSync(subdirPath)) {
        const files = fs.readdirSync(subdirPath);
        if (files.length > 0) {
          success(`  └─ ${subdir}/: ${files.length} 个文件`);
        }
      }
    });
  } else {
    warning('缺少测试工具目录: src/test-utils');
  }
}

// 9. 试运行一个简单测试
function tryRunTest() {
  try {
    info('\n尝试运行测试...');
    const result = execSync('npm run test -- --listTests --findRelatedTests src/__tests__/setup/test-environment.test.ts 2>&1', {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    
    if (result.includes('.test.ts')) {
      success('Jest能够找到测试文件');
    }
  } catch (err) {
    warning('无法运行测试命令，请手动验证');
  }
}

// 执行所有检查
console.log('📋 开始环境检查\n');
console.log('='.repeat(50));

checkNodeVersion();
console.log();

checkRequiredFiles();
console.log();

checkEnvVariables();
console.log();

checkJestConfig();
console.log();

checkTestFiles();
console.log();

checkDependencies();
console.log();

checkTestScripts();
console.log();

checkTestUtils();
console.log();

tryRunTest();

// 输出总结
console.log('\n' + '='.repeat(50));
console.log('\n📊 检查结果总结\n');

if (successes.length > 0) {
  console.log(`${colors.green}✅ 通过项: ${successes.length}${colors.reset}`);
}

if (warnings.length > 0) {
  console.log(`${colors.yellow}⚠️  警告项: ${warnings.length}${colors.reset}`);
  warnings.forEach(w => console.log(`   - ${w}`));
}

if (hasError) {
  console.log(`\n${colors.red}❌ 测试环境配置不完整，请修复上述错误${colors.reset}`);
  process.exit(1);
} else {
  console.log(`\n${colors.green}✅ 测试环境配置完整，可以运行测试！${colors.reset}`);
  console.log(`\n运行以下命令开始测试:`);
  console.log(`  ${colors.blue}npm run test${colors.reset}           # 运行所有测试`);
  console.log(`  ${colors.blue}npm run test:watch${colors.reset}      # 监视模式`);
  console.log(`  ${colors.blue}npm run test:coverage${colors.reset}   # 生成覆盖率报告`);
}

console.log('\n' + '='.repeat(50));