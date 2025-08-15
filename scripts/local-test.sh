#!/bin/bash

# 本地测试脚本
# 用于在本地运行所有测试，替代CI/CD

echo "🚀 开始本地测试..."

# 检查环境
if [ ! -f .env.test ]; then
    echo "⚠️  未找到 .env.test 文件，从示例文件创建..."
    cp .env.test.example .env.test
fi

# 运行测试
echo "📦 安装依赖..."
npm install

echo "🧪 运行测试..."
npm test

echo "📊 生成测试报告..."
npm run test:coverage

echo "✅ 测试完成！"