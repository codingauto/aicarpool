/**
 * 应用性能优化索引脚本
 * v2.7 高并发优化 - 数据库索引优化
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

// 索引创建配置
const INDEX_CONFIG = {
  BATCH_SIZE: 5, // 每批创建的索引数量
  DELAY_BETWEEN_BATCHES: 2000, // 批次间延迟(ms)
  TIMEOUT_PER_INDEX: 30000, // 单个索引创建超时(ms)
  DRY_RUN: process.env.DRY_RUN === 'true', // 是否为预演模式
} as const;

interface IndexInfo {
  name: string;
  sql: string;
  table: string;
  type: 'btree' | 'gin' | 'partial' | 'covering';
  priority: 'high' | 'medium' | 'low';
  description: string;
}

// 定义需要创建的索引
const PERFORMANCE_INDEXES: IndexInfo[] = [
  // 高优先级索引 - API Key验证相关
  {
    name: 'idx_api_keys_key_status_expires',
    sql: `CREATE INDEX IF NOT EXISTS idx_api_keys_key_status_expires 
          ON api_keys(key, status, expires_at) 
          WHERE status = 'active'`,
    table: 'api_keys',
    type: 'partial',
    priority: 'high',
    description: 'API Key验证查询优化 - 最关键的性能瓶颈'
  },
  {
    name: 'idx_usage_stats_daily_quota',
    sql: `CREATE INDEX IF NOT EXISTS idx_usage_stats_daily_quota 
          ON usage_stats(group_id, request_time) 
          WHERE request_time >= CURRENT_DATE`,
    table: 'usage_stats',
    type: 'partial',
    priority: 'high',
    description: '每日配额检查优化'
  },
  {
    name: 'idx_ai_accounts_service_health',
    sql: `CREATE INDEX IF NOT EXISTS idx_ai_accounts_service_health 
          ON ai_service_accounts(service_type, is_enabled, status, current_load) 
          WHERE is_enabled = true AND status = 'active'`,
    table: 'ai_service_accounts',
    type: 'partial',
    priority: 'high',
    description: 'SmartAiRouter账号选择优化'
  },
  {
    name: 'idx_group_members_user_group_status',
    sql: `CREATE INDEX IF NOT EXISTS idx_group_members_user_group_status 
          ON group_members(user_id, group_id, status) 
          WHERE status = 'active'`,
    table: 'group_members',
    type: 'partial',
    priority: 'high',
    description: '拼车组成员查询优化'
  },

  // 中等优先级索引 - 速率限制和统计查询
  {
    name: 'idx_usage_stats_rate_limit',
    sql: `CREATE INDEX IF NOT EXISTS idx_usage_stats_rate_limit 
          ON usage_stats(group_id, request_time, total_tokens) 
          WHERE request_time >= NOW() - INTERVAL '1 hour'`,
    table: 'usage_stats',
    type: 'partial',
    priority: 'medium',
    description: '速率限制检查优化'
  },
  {
    name: 'idx_api_keys_group_status',
    sql: `CREATE INDEX IF NOT EXISTS idx_api_keys_group_status 
          ON api_keys(group_id, status) 
          WHERE status IN ('active', 'inactive')`,
    table: 'api_keys',
    type: 'partial',
    priority: 'medium',
    description: 'API Key列表查询优化'
  },
  {
    name: 'idx_account_health_checks_recent',
    sql: `CREATE INDEX IF NOT EXISTS idx_account_health_checks_recent 
          ON account_health_checks(account_id, checked_at DESC) 
          WHERE checked_at >= NOW() - INTERVAL '24 hours'`,
    table: 'account_health_checks',
    type: 'partial',
    priority: 'medium',
    description: '账号健康检查历史查询优化'
  },

  // GIN索引 - JSON字段查询优化
  {
    name: 'idx_api_keys_metadata_gin',
    sql: `CREATE INDEX IF NOT EXISTS idx_api_keys_metadata_gin 
          ON api_keys USING GIN (metadata) 
          WHERE metadata IS NOT NULL`,
    table: 'api_keys',
    type: 'gin',
    priority: 'medium',
    description: 'API Key元数据JSON查询优化'
  },
  {
    name: 'idx_usage_stats_api_key_metadata',
    sql: `CREATE INDEX IF NOT EXISTS idx_usage_stats_api_key_metadata 
          ON usage_stats USING GIN ((metadata->>'apiKeyId')) 
          WHERE metadata ? 'apiKeyId'`,
    table: 'usage_stats',
    type: 'gin',
    priority: 'medium',
    description: 'API Key使用统计查询优化'
  },

  // 覆盖索引 - 避免回表查询
  {
    name: 'idx_api_keys_validation_covering',
    sql: `CREATE INDEX IF NOT EXISTS idx_api_keys_validation_covering 
          ON api_keys(key, status, expires_at) 
          INCLUDE (id, group_id, user_id, quota_limit, quota_used, metadata)
          WHERE status = 'active'`,
    table: 'api_keys',
    type: 'covering',
    priority: 'medium',
    description: 'API Key验证覆盖索引 - 避免回表查询'
  },

  // 低优先级索引 - 统计和管理查询
  {
    name: 'idx_usage_stats_monthly_budget',
    sql: `CREATE INDEX IF NOT EXISTS idx_usage_stats_monthly_budget 
          ON usage_stats(group_id, request_time, cost) 
          WHERE request_time >= DATE_TRUNC('month', CURRENT_DATE)`,
    table: 'usage_stats',
    type: 'partial',
    priority: 'low',
    description: '月度预算查询优化'
  },
  {
    name: 'idx_ai_accounts_usage_stats',
    sql: `CREATE INDEX IF NOT EXISTS idx_ai_accounts_usage_stats 
          ON ai_service_accounts(service_type, total_requests DESC, total_cost DESC)`,
    table: 'ai_service_accounts',
    type: 'btree',
    priority: 'low',
    description: '账号使用统计查询优化'
  }
];

/**
 * 检查索引是否已存在
 */
async function checkIndexExists(indexName: string): Promise<boolean> {
  try {
    const result = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = $1
      ) as exists
    `, indexName);
    
    return (result as any)[0]?.exists || false;
  } catch (error) {
    console.error(`检查索引失败 ${indexName}:`, error);
    return false;
  }
}

/**
 * 创建单个索引
 */
async function createIndex(index: IndexInfo): Promise<{ success: boolean; time: number; error?: string }> {
  const startTime = Date.now();
  
  try {
    console.log(`🔧 创建索引: ${index.name} (${index.description})`);
    
    if (INDEX_CONFIG.DRY_RUN) {
      console.log(`[DRY RUN] ${index.sql}`);
      return { success: true, time: 0 };
    }

    // 检查索引是否已存在
    const exists = await checkIndexExists(index.name);
    if (exists) {
      console.log(`⚠️ 索引已存在，跳过: ${index.name}`);
      return { success: true, time: Date.now() - startTime };
    }

    // 设置索引创建超时
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('索引创建超时')), INDEX_CONFIG.TIMEOUT_PER_INDEX);
    });

    // 执行索引创建
    const createPromise = prisma.$executeRawUnsafe(index.sql);
    
    await Promise.race([createPromise, timeoutPromise]);
    
    const time = Date.now() - startTime;
    console.log(`✅ 索引创建成功: ${index.name} (${time}ms)`);
    
    return { success: true, time };

  } catch (error) {
    const time = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    console.error(`❌ 索引创建失败: ${index.name} (${time}ms):`, errorMessage);
    
    return { success: false, time, error: errorMessage };
  }
}

/**
 * 批量创建索引
 */
async function createIndexesBatch(indexes: IndexInfo[]): Promise<{
  successful: number;
  failed: number;
  totalTime: number;
  results: { [indexName: string]: { success: boolean; time: number; error?: string } };
}> {
  const results: { [indexName: string]: { success: boolean; time: number; error?: string } } = {};
  let successful = 0;
  let failed = 0;
  const totalStartTime = Date.now();

  // 按优先级排序
  const sortedIndexes = [...indexes].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // 分批处理
  const batches = chunkArray(sortedIndexes, INDEX_CONFIG.BATCH_SIZE);
  
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    console.log(`\n📦 处理批次 ${i + 1}/${batches.length} (${batch.length} 个索引)`);
    
    // 并行创建批次中的索引
    const batchPromises = batch.map(index => createIndex(index));
    const batchResults = await Promise.allSettled(batchPromises);
    
    // 统计结果
    batch.forEach((index, idx) => {
      const result = batchResults[idx];
      
      if (result.status === 'fulfilled') {
        results[index.name] = result.value;
        if (result.value.success) {
          successful++;
        } else {
          failed++;
        }
      } else {
        results[index.name] = {
          success: false,
          time: 0,
          error: result.reason?.message || '未知错误'
        };
        failed++;
      }
    });
    
    // 批次间延迟
    if (i < batches.length - 1) {
      console.log(`⏱️ 等待 ${INDEX_CONFIG.DELAY_BETWEEN_BATCHES}ms 后处理下一批次...`);
      await new Promise(resolve => setTimeout(resolve, INDEX_CONFIG.DELAY_BETWEEN_BATCHES));
    }
  }

  const totalTime = Date.now() - totalStartTime;
  console.log(`\n📊 索引创建完成: 成功 ${successful}，失败 ${failed}，总耗时 ${totalTime}ms`);

  return { successful, failed, totalTime, results };
}

/**
 * 更新表统计信息
 */
async function updateTableStats(): Promise<void> {
  const tables = ['api_keys', 'usage_stats', 'ai_service_accounts', 'group_members', 'groups'];
  
  console.log('\n📈 更新表统计信息...');
  
  for (const table of tables) {
    try {
      if (INDEX_CONFIG.DRY_RUN) {
        console.log(`[DRY RUN] ANALYZE ${table}`);
        continue;
      }

      await prisma.$executeRawUnsafe(`ANALYZE ${table}`);
      console.log(`✅ 统计信息已更新: ${table}`);
      
    } catch (error) {
      console.error(`❌ 更新统计信息失败 ${table}:`, error);
    }
  }
}

/**
 * 生成索引性能报告
 */
async function generatePerformanceReport(): Promise<void> {
  try {
    console.log('\n📋 生成索引性能报告...');
    
    if (INDEX_CONFIG.DRY_RUN) {
      console.log('[DRY RUN] 跳过性能报告生成');
      return;
    }

    // 查询索引使用统计
    const indexStats = await prisma.$queryRawUnsafe(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        idx_tup_read,
        idx_tup_fetch,
        idx_scan,
        pg_size_pretty(pg_relation_size(indexrelid)) as size
      FROM pg_stat_user_indexes 
      WHERE tablename IN ('api_keys', 'usage_stats', 'ai_service_accounts', 'group_members')
      ORDER BY tablename, idx_scan DESC
    `);

    console.log('\n📊 索引使用统计:');
    console.table(indexStats);

    // 查询表扫描统计
    const tableStats = await prisma.$queryRawUnsafe(`
      SELECT 
        schemaname,
        tablename,
        seq_scan,
        seq_tup_read,
        idx_scan,
        idx_tup_fetch,
        pg_size_pretty(pg_total_relation_size(relid)) as total_size
      FROM pg_stat_user_tables 
      WHERE tablename IN ('api_keys', 'usage_stats', 'ai_service_accounts', 'group_members')
      ORDER BY seq_scan DESC
    `);

    console.log('\n📊 表扫描统计:');
    console.table(tableStats);

  } catch (error) {
    console.error('生成性能报告失败:', error);
  }
}

/**
 * 工具函数：数组分块
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  console.log('🚀 开始应用性能优化索引...');
  console.log(`模式: ${INDEX_CONFIG.DRY_RUN ? '预演模式' : '执行模式'}`);
  console.log(`总计 ${PERFORMANCE_INDEXES.length} 个索引需要创建\n`);

  try {
    // 1. 创建索引
    const result = await createIndexesBatch(PERFORMANCE_INDEXES);
    
    // 2. 更新表统计信息
    if (result.successful > 0) {
      await updateTableStats();
    }
    
    // 3. 生成性能报告
    await generatePerformanceReport();
    
    // 4. 输出最终结果
    console.log('\n🎉 性能优化索引应用完成!');
    console.log(`✅ 成功: ${result.successful} 个索引`);
    console.log(`❌ 失败: ${result.failed} 个索引`);
    console.log(`⏱️ 总耗时: ${result.totalTime}ms`);
    
    if (result.failed > 0) {
      console.log('\n❌ 失败的索引:');
      Object.entries(result.results)
        .filter(([_, r]) => !r.success)
        .forEach(([name, r]) => {
          console.log(`  - ${name}: ${r.error}`);
        });
    }

    // 5. 给出后续建议
    console.log('\n💡 后续建议:');
    console.log('1. 监控索引使用情况，移除未使用的索引');
    console.log('2. 定期运行 ANALYZE 更新统计信息');
    console.log('3. 观察查询性能改善情况');
    console.log('4. 根据实际使用情况调整索引策略');

  } catch (error) {
    console.error('❌ 应用性能索引失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行脚本
if (require.main === module) {
  main().catch(error => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });
}

export { main as applyPerformanceIndexes, PERFORMANCE_INDEXES };