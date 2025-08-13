#!/bin/bash

# 设置测试环境
export NODE_ENV=test
export DATABASE_URL="mysql://test:test@localhost:3306/aicarpool_test"

# 重置测试数据库
echo "🔄 重置测试数据库..."
npx prisma migrate reset --force --skip-seed

# 运行迁移
echo "📦 运行数据库迁移..."
npx prisma migrate deploy

# 生成Prisma Client
echo "🔧 生成Prisma Client..."
npx prisma generate

echo "✅ 测试数据库准备完成！"