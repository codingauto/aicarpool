# 阶段 5：性能测试指南

## 📋 本阶段目标

通过负载测试、压力测试和性能基准测试，确保系统能够处理预期的用户负载并保持良好性能。

**预计时间**: 1周  
**前置要求**: 基础测试完成，生产环境或类生产环境可用

## 🚀 k6 性能测试

### 安装和配置

```bash
# macOS
brew install k6

# Linux
sudo snap install k6

# Windows
choco install k6

# 或使用 Docker
docker pull grafana/k6
```

### 项目结构

```
k6-tests/
├── config/
│   ├── base.json
│   ├── load.json
│   └── stress.json
├── scenarios/
│   ├── auth.js
│   ├── api.js
│   └── workflow.js
├── utils/
│   ├── helpers.js
│   └── data.js
└── run.sh
```

## 📊 基础配置

### 配置文件

创建 `k6-tests/config/base.json`:

```json
{
  "stages": [
    { "duration": "30s", "target": 10 },
    { "duration": "1m", "target": 10 },
    { "duration": "30s", "target": 0 }
  ],
  "thresholds": {
    "http_req_duration": ["p(95)<500"],
    "http_req_failed": ["rate<0.1"],
    "http_reqs": ["rate>10"]
  },
  "summaryTrendStats": ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"]
}
```

### 工具函数

创建 `k6-tests/utils/helpers.js`:

```javascript
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

// 自定义指标
export const errorRate = new Rate('errors')
export const apiDuration = new Trend('api_duration')

// 基础URL
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000'

// 通用请求头
export function getHeaders(token = null) {
  const headers = {
    'Content-Type': 'application/json',
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  return headers
}

// 检查响应
export function checkResponse(res, expectedStatus = 200) {
  const result = check(res, {
    [`status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'response has body': (r) => r.body !== null,
  })
  
  // 记录错误
  errorRate.add(!result)
  
  // 记录API响应时间
  if (res.timings) {
    apiDuration.add(res.timings.duration)
  }
  
  return result
}

// 随机延迟
export function randomPause(min = 1, max = 3) {
  sleep(Math.random() * (max - min) + min)
}

// 生成测试数据
export function generateUser() {
  const timestamp = Date.now()
  return {
    email: `test.user.${timestamp}@example.com`,
    password: 'Test123!@#',
    name: `Test User ${timestamp}`
  }
}
```

## 🔄 负载测试

### 登录负载测试

创建 `k6-tests/scenarios/auth-load.js`:

```javascript
import http from 'k6/http'
import { check, sleep } from 'k6'
import { SharedArray } from 'k6/data'
import { Rate } from 'k6/metrics'
import { BASE_URL, checkResponse, randomPause } from '../utils/helpers.js'

// 测试用户数据
const users = new SharedArray('users', function () {
  return JSON.parse(open('../data/users.json'))
})

// 自定义指标
const loginFailureRate = new Rate('login_failures')
const tokenRefreshRate = new Rate('token_refreshes')

// 测试配置
export const options = {
  scenarios: {
    login_scenario: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // 逐步增加到50用户
        { duration: '5m', target: 50 },   // 保持50用户
        { duration: '2m', target: 100 },  // 增加到100用户
        { duration: '5m', target: 100 },  // 保持100用户
        { duration: '2m', target: 0 },    // 逐步减少到0
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<1000'],
    'http_req_failed': ['rate<0.05'],
    'login_failures': ['rate<0.01'],
    'token_refreshes': ['rate<0.1'],
  },
}

export default function () {
  // 随机选择用户
  const user = users[Math.floor(Math.random() * users.length)]
  
  // 登录请求
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: user.email,
      password: user.password,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'Login' },
    }
  )
  
  const loginSuccess = check(loginRes, {
    'login successful': (r) => r.status === 200,
    'has token': (r) => JSON.parse(r.body).data?.token !== undefined,
    'has refresh token': (r) => JSON.parse(r.body).data?.refreshToken !== undefined,
  })
  
  loginFailureRate.add(!loginSuccess)
  
  if (loginSuccess) {
    const data = JSON.parse(loginRes.body).data
    const token = data.token
    const refreshToken = data.refreshToken
    
    randomPause(2, 5)
    
    // 获取用户信息
    const profileRes = http.get(
      `${BASE_URL}/api/user/profile`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        tags: { name: 'GetProfile' },
      }
    )
    
    checkResponse(profileRes, 200)
    
    randomPause(3, 8)
    
    // 模拟token刷新
    if (Math.random() > 0.7) {
      const refreshRes = http.post(
        `${BASE_URL}/api/auth/refresh`,
        JSON.stringify({ refreshToken }),
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { name: 'RefreshToken' },
        }
      )
      
      const refreshSuccess = checkResponse(refreshRes, 200)
      tokenRefreshRate.add(refreshSuccess)
    }
  }
  
  randomPause(1, 3)
}
```

### API 端点负载测试

创建 `k6-tests/scenarios/api-load.js`:

```javascript
import http from 'k6/http'
import { check, group } from 'k6'
import { Trend, Rate } from 'k6/metrics'
import { BASE_URL, getHeaders, checkResponse } from '../utils/helpers.js'

// 自定义指标
const enterpriseApiDuration = new Trend('enterprise_api_duration')
const aiAccountApiDuration = new Trend('ai_account_api_duration')
const apiErrorRate = new Rate('api_error_rate')

export const options = {
  scenarios: {
    api_test: {
      executor: 'constant-vus',
      vus: 50,
      duration: '10m',
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<800', 'p(99)<2000'],
    'enterprise_api_duration': ['p(95)<600'],
    'ai_account_api_duration': ['p(95)<700'],
    'api_error_rate': ['rate<0.02'],
  },
}

// 设置函数 - 登录获取token
export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: 'test@example.com',
      password: 'Test123!',
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
  
  const data = JSON.parse(loginRes.body).data
  return { token: data.token, enterpriseId: data.user.enterpriseId }
}

export default function (data) {
  const { token, enterpriseId } = data
  const headers = getHeaders(token)
  
  group('Enterprise APIs', () => {
    // 获取企业列表
    const listRes = http.get(
      `${BASE_URL}/api/user/enterprises`,
      { headers, tags: { name: 'ListEnterprises' } }
    )
    
    const listSuccess = checkResponse(listRes)
    apiErrorRate.add(!listSuccess)
    enterpriseApiDuration.add(listRes.timings.duration)
    
    // 获取企业详情
    const detailRes = http.get(
      `${BASE_URL}/api/enterprises/${enterpriseId}`,
      { headers, tags: { name: 'GetEnterprise' } }
    )
    
    const detailSuccess = checkResponse(detailRes)
    apiErrorRate.add(!detailSuccess)
    enterpriseApiDuration.add(detailRes.timings.duration)
    
    // 获取企业统计
    const statsRes = http.get(
      `${BASE_URL}/api/enterprises/${enterpriseId}/dashboard`,
      { headers, tags: { name: 'GetDashboard' } }
    )
    
    checkResponse(statsRes)
    enterpriseApiDuration.add(statsRes.timings.duration)
  })
  
  group('AI Account APIs', () => {
    // 获取AI账号列表
    const accountsRes = http.get(
      `${BASE_URL}/api/enterprises/${enterpriseId}/ai-accounts`,
      { headers, tags: { name: 'ListAiAccounts' } }
    )
    
    const accountsSuccess = checkResponse(accountsRes)
    apiErrorRate.add(!accountsSuccess)
    aiAccountApiDuration.add(accountsRes.timings.duration)
    
    if (accountsSuccess) {
      const accounts = JSON.parse(accountsRes.body).data.accounts
      
      if (accounts.length > 0) {
        // 获取账号详情
        const accountId = accounts[0].id
        const accountRes = http.get(
          `${BASE_URL}/api/enterprises/${enterpriseId}/ai-accounts/${accountId}`,
          { headers, tags: { name: 'GetAiAccount' } }
        )
        
        checkResponse(accountRes)
        aiAccountApiDuration.add(accountRes.timings.duration)
      }
    }
  })
}
```

## 💥 压力测试

创建 `k6-tests/scenarios/stress-test.js`:

```javascript
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate } from 'k6/metrics'
import { BASE_URL } from '../utils/helpers.js'

// 压力测试配置 - 找出系统极限
export const options = {
  stages: [
    { duration: '2m', target: 100 },   // 正常负载
    { duration: '5m', target: 100 },   // 保持
    { duration: '2m', target: 200 },   // 增加负载
    { duration: '5m', target: 200 },   // 保持
    { duration: '2m', target: 300 },   // 高负载
    { duration: '5m', target: 300 },   // 保持
    { duration: '2m', target: 400 },   // 极限负载
    { duration: '5m', target: 400 },   // 保持
    { duration: '10m', target: 0 },    // 恢复
  ],
  thresholds: {
    'http_req_duration': ['p(99)<3000'], // 99%的请求在3秒内
    'http_req_failed': ['rate<0.1'],     // 错误率低于10%
  },
}

const errorRate = new Rate('errors')

export default function () {
  // 高频API调用
  const responses = http.batch([
    ['GET', `${BASE_URL}/api/health`],
    ['GET', `${BASE_URL}/api/monitoring/metrics`],
    ['GET', `${BASE_URL}/api/monitoring/system-health`],
  ])
  
  responses.forEach(res => {
    const success = check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 3s': (r) => r.timings.duration < 3000,
    })
    
    errorRate.add(!success)
  })
  
  sleep(1)
}

// 测试结束后的处理
export function handleSummary(data) {
  return {
    'stress-test-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  }
}

function textSummary(data, options) {
  const { metrics } = data
  
  let summary = '\n=== Stress Test Results ===\n\n'
  
  // 响应时间
  if (metrics.http_req_duration) {
    summary += 'Response Times:\n'
    summary += `  Average: ${metrics.http_req_duration.avg.toFixed(2)}ms\n`
    summary += `  P95: ${metrics.http_req_duration['p(95)'].toFixed(2)}ms\n`
    summary += `  P99: ${metrics.http_req_duration['p(99)'].toFixed(2)}ms\n\n`
  }
  
  // 错误率
  if (metrics.http_req_failed) {
    summary += `Error Rate: ${(metrics.http_req_failed.rate * 100).toFixed(2)}%\n`
  }
  
  // 吞吐量
  if (metrics.http_reqs) {
    summary += `Throughput: ${metrics.http_reqs.rate.toFixed(2)} req/s\n`
  }
  
  return summary
}
```

## 🏃 业务流程性能测试

创建 `k6-tests/scenarios/workflow-test.js`:

```javascript
import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Trend } from 'k6/metrics'
import { BASE_URL, generateUser } from '../utils/helpers.js'

// 业务流程指标
const registrationFlow = new Trend('registration_flow_duration')
const enterpriseCreationFlow = new Trend('enterprise_creation_flow_duration')
const aiAccountSetupFlow = new Trend('ai_account_setup_flow_duration')

export const options = {
  scenarios: {
    workflow: {
      executor: 'per-vu-iterations',
      vus: 20,
      iterations: 5,
      maxDuration: '30m',
    },
  },
  thresholds: {
    'registration_flow_duration': ['p(95)<5000'],
    'enterprise_creation_flow_duration': ['p(95)<3000'],
    'ai_account_setup_flow_duration': ['p(95)<4000'],
  },
}

export default function () {
  const user = generateUser()
  let token, enterpriseId, accountId
  
  // 完整注册流程
  group('User Registration Flow', () => {
    const startTime = Date.now()
    
    // 1. 注册
    const registerRes = http.post(
      `${BASE_URL}/api/auth/register`,
      JSON.stringify(user),
      { headers: { 'Content-Type': 'application/json' } }
    )
    
    check(registerRes, {
      'registration successful': (r) => r.status === 201,
    })
    
    // 2. 登录
    const loginRes = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({
        email: user.email,
        password: user.password,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
    
    const loginData = JSON.parse(loginRes.body).data
    token = loginData.token
    
    // 3. 验证邮箱（模拟）
    sleep(1)
    
    registrationFlow.add(Date.now() - startTime)
  })
  
  // 企业创建流程
  group('Enterprise Creation Flow', () => {
    const startTime = Date.now()
    
    // 1. 创建企业
    const createRes = http.post(
      `${BASE_URL}/api/enterprises`,
      JSON.stringify({
        name: `Test Enterprise ${Date.now()}`,
        description: 'Performance test enterprise',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        }
      }
    )
    
    check(createRes, {
      'enterprise created': (r) => r.status === 201,
    })
    
    const enterpriseData = JSON.parse(createRes.body).data
    enterpriseId = enterpriseData.id
    
    // 2. 配置企业设置
    const settingsRes = http.patch(
      `${BASE_URL}/api/enterprises/${enterpriseId}/settings`,
      JSON.stringify({
        defaultQuota: 10000,
        monthlyBudget: 1000,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        }
      }
    )
    
    check(settingsRes, {
      'settings updated': (r) => r.status === 200,
    })
    
    enterpriseCreationFlow.add(Date.now() - startTime)
  })
  
  // AI账号配置流程
  group('AI Account Setup Flow', () => {
    const startTime = Date.now()
    
    // 1. 添加AI账号
    const addAccountRes = http.post(
      `${BASE_URL}/api/enterprises/${enterpriseId}/ai-accounts`,
      JSON.stringify({
        name: 'Test AI Account',
        platform: 'claude',
        authType: 'api_key',
        apiKey: 'test-key-' + Date.now(),
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        }
      }
    )
    
    check(addAccountRes, {
      'account added': (r) => r.status === 201,
    })
    
    const accountData = JSON.parse(addAccountRes.body).data
    accountId = accountData.account.id
    
    // 2. 验证账号
    const validateRes = http.post(
      `${BASE_URL}/api/enterprises/${enterpriseId}/ai-accounts/${accountId}/validate`,
      '{}',
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        }
      }
    )
    
    check(validateRes, {
      'account validated': (r) => r.status === 200,
    })
    
    // 3. 绑定到组
    const bindRes = http.post(
      `${BASE_URL}/api/groups/${enterpriseId}/bind-account`,
      JSON.stringify({
        accountId: accountId,
        priority: 1,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        }
      }
    )
    
    check(bindRes, {
      'account bound': (r) => r.status === 200 || r.status === 201,
    })
    
    aiAccountSetupFlow.add(Date.now() - startTime)
  })
}
```

## 📈 数据库性能测试

创建 `k6-tests/scenarios/database-test.js`:

```javascript
import http from 'k6/http'
import { check } from 'k6'
import { Trend } from 'k6/metrics'

const dbQueryDuration = new Trend('db_query_duration')
const dbConnectionPoolUtilization = new Trend('db_connection_pool_utilization')

export const options = {
  scenarios: {
    database_test: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
  },
  thresholds: {
    'db_query_duration': ['p(95)<100', 'p(99)<500'],
    'db_connection_pool_utilization': ['value<0.8'],
  },
}

export default function () {
  // 测试复杂查询
  const complexQueryRes = http.get(
    `${BASE_URL}/api/monitoring/analytics?` +
    'startDate=2024-01-01&endDate=2024-12-31&' +
    'groupBy=platform&includeDetails=true',
    {
      headers: { 'Authorization': `Bearer ${__ENV.TEST_TOKEN}` },
      tags: { name: 'ComplexQuery' },
    }
  )
  
  check(complexQueryRes, {
    'query successful': (r) => r.status === 200,
    'query fast': (r) => r.timings.duration < 500,
  })
  
  // 从响应头获取数据库指标
  const dbTime = complexQueryRes.headers['X-Db-Query-Time']
  const poolUtil = complexQueryRes.headers['X-Db-Pool-Utilization']
  
  if (dbTime) {
    dbQueryDuration.add(parseFloat(dbTime))
  }
  
  if (poolUtil) {
    dbConnectionPoolUtilization.add(parseFloat(poolUtil))
  }
  
  // 测试并发写入
  const writeRes = http.post(
    `${BASE_URL}/api/monitoring/metrics`,
    JSON.stringify({
      metric: 'test_metric',
      value: Math.random() * 100,
      timestamp: new Date().toISOString(),
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${__ENV.TEST_TOKEN}`,
      },
      tags: { name: 'ConcurrentWrite' },
    }
  )
  
  check(writeRes, {
    'write successful': (r) => r.status === 201 || r.status === 200,
  })
}
```

## 🔥 缓存性能测试

创建 `k6-tests/scenarios/cache-test.js`:

```javascript
import http from 'k6/http'
import { check } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const cacheHitRate = new Rate('cache_hits')
const cacheMissRate = new Rate('cache_misses')
const cacheResponseTime = new Trend('cache_response_time')

export const options = {
  scenarios: {
    cache_test: {
      executor: 'constant-vus',
      vus: 30,
      duration: '5m',
    },
  },
  thresholds: {
    'cache_hits': ['rate>0.8'],           // 80%缓存命中率
    'cache_response_time': ['p(95)<50'],  // 95%的缓存响应在50ms内
  },
}

export default function () {
  // 请求可缓存的数据
  const resourceId = Math.floor(Math.random() * 100) // 100个不同的资源
  
  const res = http.get(
    `${BASE_URL}/api/cached-resource/${resourceId}`,
    {
      headers: { 'Authorization': `Bearer ${__ENV.TEST_TOKEN}` },
      tags: { name: 'CachedResource' },
    }
  )
  
  check(res, {
    'request successful': (r) => r.status === 200,
  })
  
  // 检查缓存头
  const cacheStatus = res.headers['X-Cache-Status']
  
  if (cacheStatus === 'HIT') {
    cacheHitRate.add(1)
    cacheMissRate.add(0)
  } else {
    cacheHitRate.add(0)
    cacheMissRate.add(1)
  }
  
  // 记录缓存响应时间
  if (cacheStatus === 'HIT') {
    cacheResponseTime.add(res.timings.duration)
  }
}
```

## 📝 运行脚本

创建 `k6-tests/run.sh`:

```bash
#!/bin/bash

# 运行脚本
# Usage: ./run.sh [test-type] [environment]

TEST_TYPE=${1:-load}
ENVIRONMENT=${2:-local}

# 设置环境变量
if [ "$ENVIRONMENT" = "local" ]; then
  export BASE_URL="http://localhost:4000"
  export TEST_TOKEN="your-test-token"
elif [ "$ENVIRONMENT" = "staging" ]; then
  export BASE_URL="https://staging.aicarpool.com"
  export TEST_TOKEN="staging-token"
fi

# 运行测试
case $TEST_TYPE in
  load)
    echo "Running Load Test..."
    k6 run scenarios/auth-load.js
    k6 run scenarios/api-load.js
    ;;
  stress)
    echo "Running Stress Test..."
    k6 run scenarios/stress-test.js
    ;;
  workflow)
    echo "Running Workflow Test..."
    k6 run scenarios/workflow-test.js
    ;;
  database)
    echo "Running Database Test..."
    k6 run scenarios/database-test.js
    ;;
  cache)
    echo "Running Cache Test..."
    k6 run scenarios/cache-test.js
    ;;
  all)
    echo "Running All Tests..."
    k6 run scenarios/auth-load.js
    k6 run scenarios/api-load.js
    k6 run scenarios/stress-test.js
    k6 run scenarios/workflow-test.js
    ;;
  *)
    echo "Usage: $0 [load|stress|workflow|database|cache|all] [local|staging]"
    exit 1
    ;;
esac

echo "Test completed. Check the results in the output files."
```

## 📊 结果分析

### Grafana Dashboard

创建 `docker-compose.yml` for k6 + Grafana:

```yaml
version: '3.8'

services:
  influxdb:
    image: influxdb:1.8
    ports:
      - "8086:8086"
    environment:
      - INFLUXDB_DB=k6
      - INFLUXDB_ADMIN_USER=admin
      - INFLUXDB_ADMIN_PASSWORD=admin123

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=admin123
    volumes:
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./grafana/datasources:/etc/grafana/provisioning/datasources

  k6:
    image: grafana/k6:latest
    command: run /tests/scenarios/load-test.js
    environment:
      - K6_OUT=influxdb=http://influxdb:8086/k6
    volumes:
      - ./k6-tests:/tests
    depends_on:
      - influxdb
```

## 📋 检查清单

- [ ] k6已安装配置
- [ ] 负载测试场景已创建
- [ ] 压力测试场景已创建
- [ ] 业务流程测试已创建
- [ ] 性能指标已定义
- [ ] 监控仪表板已配置

## 🎯 下一步

1. 🔧 [CI/CD集成](./06-ci-cd-integration.md)
2. 🐛 [故障排查](./troubleshooting.md)
3. 📊 查看[测试总览](./testing-overview.md)

---

*性能测试确保系统在高负载下稳定运行。定期执行，持续优化！*