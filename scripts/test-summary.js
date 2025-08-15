#!/usr/bin/env node

/**
 * 测试总结脚本
 * 生成测试运行的详细报告
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📊 生成测试总结报告...\n');

const report = {
  timestamp: new Date().toISOString(),
  stats: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  },
  coverage: {
    lines: 0,
    branches: 0,
    functions: 0,
    statements: 0
  },
  duration: 0,
  testSuites: []
};

// 运行测试并捕获输出
try {
  console.log('🧪 运行测试...\n');
  
  const startTime = Date.now();
  const output = execSync('npm run test -- --json --outputFile=test-results.json --coverage', {
    encoding: 'utf-8',
    stdio: 'pipe'
  });
  const endTime = Date.now();
  
  report.duration = (endTime - startTime) / 1000;
  
  // 读取测试结果
  if (fs.existsSync('test-results.json')) {
    const results = JSON.parse(fs.readFileSync('test-results.json', 'utf-8'));
    
    report.stats.total = results.numTotalTests || 0;
    report.stats.passed = results.numPassedTests || 0;
    report.stats.failed = results.numFailedTests || 0;
    report.stats.skipped = results.numPendingTests || 0;
    
    // 提取测试套件信息
    if (results.testResults) {
      report.testSuites = results.testResults.map(suite => ({
        name: path.relative(process.cwd(), suite.name),
        status: suite.status,
        duration: suite.endTime - suite.startTime,
        tests: {
          total: suite.numPassingTests + suite.numFailingTests,
          passed: suite.numPassingTests,
          failed: suite.numFailingTests
        }
      }));
    }
  }
  
  // 读取覆盖率数据
  if (fs.existsSync('coverage/coverage-summary.json')) {
    const coverage = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf-8'));
    
    if (coverage.total) {
      report.coverage.lines = coverage.total.lines.pct;
      report.coverage.branches = coverage.total.branches.pct;
      report.coverage.functions = coverage.total.functions.pct;
      report.coverage.statements = coverage.total.statements.pct;
    }
  }
  
} catch (error) {
  console.error('❌ 测试运行失败:', error.message);
}

// 生成报告
console.log('\n' + '='.repeat(60));
console.log('\n📈 AiCarpool 测试总结报告');
console.log('='.repeat(60));

console.log(`\n📅 时间: ${new Date(report.timestamp).toLocaleString()}`);
console.log(`⏱️  耗时: ${report.duration.toFixed(2)}秒`);

console.log('\n📊 测试统计:');
console.log(`  总数: ${report.stats.total}`);
console.log(`  ✅ 通过: ${report.stats.passed}`);
console.log(`  ❌ 失败: ${report.stats.failed}`);
console.log(`  ⏭️  跳过: ${report.stats.skipped}`);
console.log(`  📈 通过率: ${((report.stats.passed / report.stats.total) * 100).toFixed(1)}%`);

console.log('\n🎯 覆盖率:');
console.log(`  行覆盖: ${report.coverage.lines.toFixed(1)}%`);
console.log(`  分支覆盖: ${report.coverage.branches.toFixed(1)}%`);
console.log(`  函数覆盖: ${report.coverage.functions.toFixed(1)}%`);
console.log(`  语句覆盖: ${report.coverage.statements.toFixed(1)}%`);

if (report.testSuites.length > 0) {
  console.log('\n📁 测试套件详情:');
  
  // 按状态排序（失败的优先）
  const sortedSuites = report.testSuites.sort((a, b) => {
    if (a.status === 'failed' && b.status !== 'failed') return -1;
    if (a.status !== 'failed' && b.status === 'failed') return 1;
    return 0;
  });
  
  sortedSuites.slice(0, 10).forEach(suite => {
    const icon = suite.status === 'passed' ? '✅' : '❌';
    const passRate = suite.tests.total > 0 
      ? `${suite.tests.passed}/${suite.tests.total}`
      : '0/0';
    
    console.log(`  ${icon} ${suite.name}`);
    console.log(`     通过: ${passRate}, 耗时: ${(suite.duration / 1000).toFixed(2)}s`);
  });
  
  if (report.testSuites.length > 10) {
    console.log(`  ... 还有 ${report.testSuites.length - 10} 个测试套件`);
  }
}

// 失败的测试详情
const failedSuites = report.testSuites.filter(s => s.status === 'failed');
if (failedSuites.length > 0) {
  console.log('\n⚠️  失败的测试套件:');
  failedSuites.forEach(suite => {
    console.log(`  ❌ ${suite.name}`);
  });
}

// 生成建议
console.log('\n💡 建议:');

if (report.stats.failed > 0) {
  console.log('  - 修复失败的测试用例');
}

if (report.coverage.lines < 80) {
  console.log('  - 提高代码覆盖率到80%以上');
}

if (report.coverage.branches < 70) {
  console.log('  - 增加分支覆盖测试');
}

if (report.duration > 60) {
  console.log('  - 优化测试性能，减少运行时间');
}

if (report.stats.skipped > 10) {
  console.log('  - 实现或移除跳过的测试');
}

// 保存JSON报告
const reportPath = path.join(process.cwd(), 'test-summary.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\n📄 详细报告已保存到: ${reportPath}`);

// 保存Markdown报告
const mdReport = `# AiCarpool 测试报告

**生成时间**: ${new Date(report.timestamp).toLocaleString()}  
**运行耗时**: ${report.duration.toFixed(2)}秒

## 测试统计

| 指标 | 数值 |
|------|------|
| 总测试数 | ${report.stats.total} |
| 通过 | ${report.stats.passed} |
| 失败 | ${report.stats.failed} |
| 跳过 | ${report.stats.skipped} |
| **通过率** | **${((report.stats.passed / report.stats.total) * 100).toFixed(1)}%** |

## 代码覆盖率

| 类型 | 覆盖率 |
|------|--------|
| 行覆盖 | ${report.coverage.lines.toFixed(1)}% |
| 分支覆盖 | ${report.coverage.branches.toFixed(1)}% |
| 函数覆盖 | ${report.coverage.functions.toFixed(1)}% |
| 语句覆盖 | ${report.coverage.statements.toFixed(1)}% |

## 测试套件

${report.testSuites.map(suite => {
  const icon = suite.status === 'passed' ? '✅' : '❌';
  return `- ${icon} \`${suite.name}\` (${suite.tests.passed}/${suite.tests.total})`;
}).join('\n')}

---

*报告生成于 ${new Date().toISOString()}*
`;

const mdPath = path.join(process.cwd(), 'test-summary.md');
fs.writeFileSync(mdPath, mdReport);
console.log(`📝 Markdown报告已保存到: ${mdPath}`);

// 清理临时文件
if (fs.existsSync('test-results.json')) {
  fs.unlinkSync('test-results.json');
}

console.log('\n' + '='.repeat(60));

// 设置退出码
if (report.stats.failed > 0) {
  console.log('\n❌ 测试未全部通过');
  process.exit(1);
} else {
  console.log('\n✅ 所有测试通过！');
  process.exit(0);
}