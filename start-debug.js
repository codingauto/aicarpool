#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 启动AiCarpool开发服务器...');
console.log('当前目录:', process.cwd());
console.log('Node版本:', process.version);

// 设置环境变量
process.env.NODE_ENV = 'development';

// 启动Next.js开发服务器
const nextProcess = spawn('npx', ['next', 'dev'], {
  stdio: 'inherit',
  cwd: __dirname,
  env: process.env
});

nextProcess.on('error', (error) => {
  console.error('❌ 启动失败:', error.message);
  process.exit(1);
});

nextProcess.on('exit', (code) => {
  console.log(`\n🔄 进程退出，退出码: ${code}`);
  if (code !== 0) {
    console.error('❌ 服务器异常退出');
    process.exit(code);
  }
});

// 处理退出信号
process.on('SIGINT', () => {
  console.log('\n⏹️  收到退出信号，正在关闭服务器...');
  nextProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n⏹️  收到退出信号，正在关闭服务器...');
  nextProcess.kill('SIGTERM');
});

console.log('✅ 启动脚本已执行，等待Next.js服务器启动...');
console.log('📱 服务器启动后可访问: http://localhost:3000');