#!/bin/bash

# 单元测试运行脚本
# 用于运行所有单元测试并生成覆盖率报告

set -e

echo "🧪 开始运行单元测试..."
echo "================================"

# 设置颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 清理之前的覆盖率报告
if [ -d "coverage" ]; then
    echo "📁 清理旧的覆盖率报告..."
    rm -rf coverage
fi

# 运行测试的函数
run_test_suite() {
    local test_path=$1
    local suite_name=$2
    
    echo ""
    echo "📋 运行测试套件: ${suite_name}"
    echo "----------------------------"
    
    if npm run test -- "${test_path}" --silent 2>&1 | tee test-output.tmp; then
        echo -e "${GREEN}✅ ${suite_name} 测试通过${NC}"
    else
        echo -e "${RED}❌ ${suite_name} 测试失败${NC}"
    fi
    
    # 提取测试统计
    grep -E "Tests:|Test Suites:" test-output.tmp || true
    rm -f test-output.tmp
}

# 运行各个测试套件
echo ""
echo "🔍 运行认证与安全测试..."
run_test_suite "src/__tests__/unit/lib/auth" "JWT工具"
run_test_suite "src/__tests__/unit/lib/permission" "权限管理"

echo ""
echo "🔍 运行核心服务测试..."
run_test_suite "src/__tests__/unit/lib/services" "服务层"

# 运行所有测试并生成覆盖率
echo ""
echo "📊 生成完整覆盖率报告..."
echo "================================"

npm run test:coverage -- --silent 2>&1 | tee coverage-output.tmp

# 提取覆盖率统计
echo ""
echo "📈 覆盖率摘要："
echo "----------------------------"
grep -A 10 "Coverage summary" coverage-output.tmp 2>/dev/null || \
    grep -E "Statements|Branches|Functions|Lines" coverage-output.tmp 2>/dev/null || \
    echo "未能提取覆盖率信息"

rm -f coverage-output.tmp

# 生成HTML报告
if [ -f "coverage/lcov-report/index.html" ]; then
    echo ""
    echo -e "${GREEN}✅ HTML覆盖率报告已生成${NC}"
    echo "📂 报告位置: coverage/lcov-report/index.html"
    
    # 在macOS上自动打开报告
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo ""
        read -p "是否打开HTML报告? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            open coverage/lcov-report/index.html
        fi
    fi
fi

# 测试结果总结
echo ""
echo "================================"
echo "📋 测试运行完成！"
echo ""

# 统计总体情况
TOTAL_TESTS=$(npm run test -- --listTests 2>/dev/null | grep -c "test.ts" || echo "0")
echo "📁 测试文件总数: ${TOTAL_TESTS}"

# 检查是否所有测试都通过
if npm run test -- --silent 2>&1 | grep -q "failed"; then
    echo -e "${YELLOW}⚠️  部分测试失败，请检查输出${NC}"
    exit 1
else
    echo -e "${GREEN}✅ 所有测试通过！${NC}"
fi

echo "================================"