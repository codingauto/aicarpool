# AiCarpool 当前系统架构关系图

## 文档信息
- **创建时间**: 2025-08-08
- **文档目的**: 梳理AiCarpool当前系统的模块关系和架构设计
- **适用版本**: v2.7（包含高并发优化）

---

## 1. 系统整体架构图

```mermaid
graph TB
    subgraph "客户端层"
        CLI1[Claude Code CLI]
        CLI2[Gemini CLI]
        CLI3[Cursor Agent]
        CLI4[AmpCode CLI]
        CLI5[Auggie CLI]
        WEB[Web浏览器]
        MOBILE[Mobile App]
    end
    
    subgraph "接入层"
        LB[负载均衡器]
        GATEWAY[API Gateway]
    end
    
    subgraph "应用层"
        AUTH[认证中间件]
        PERM[权限管理]
        ROUTER[SmartAiRouter]
        STATS[统计服务]
        BUDGET[预算控制]
        APIKEY[API Key管理]
    end
    
    subgraph "服务层"
        GM[拼车组管理]
        EM[企业管理]
        UM[用户管理]
        ARM[AI资源管理]
    end
    
    subgraph "数据层"
        DB[(MySQL)]
        REDIS[(Redis缓存)]
        QUEUE[消息队列]
    end
    
    subgraph "外部服务"
        AI1[Claude API]
        AI2[Gemini API]
        AI3[Kimi k2]
        AI4[通义千问3]
        AI5[智谱GLM 4.5]
    end
    
    %% 连接关系
    CLI1 --> LB
    CLI2 --> LB
    CLI3 --> LB
    CLI4 --> LB
    CLI5 --> LB
    WEB --> LB
    MOBILE --> LB
    
    LB --> GATEWAY
    GATEWAY --> AUTH
    AUTH --> PERM
    AUTH --> ROUTER
    
    ROUTER --> ARM
    ROUTER --> STATS
    ROUTER --> BUDGET
    ROUTER --> AI1
    ROUTER --> AI2
    ROUTER --> AI3
    ROUTER --> AI4
    ROUTER --> AI5
    
    PERM --> UM
    APIKEY --> GM
    APIKEY --> EM
    
    GM --> DB
    EM --> DB
    UM --> DB
    ARM --> DB
    STATS --> QUEUE
    QUEUE --> DB
    
    AUTH --> REDIS
    ROUTER --> REDIS
    STATS --> REDIS
    
    style CLI1 fill:#e1f5fe
    style CLI2 fill:#e1f5fe
    style CLI3 fill:#e1f5fe
    style ROUTER fill:#f3e5f5
    style DB fill:#fff3e0
    style REDIS fill:#ffebee
```

---

## 2. 双模式架构对比图

```mermaid
graph LR
    subgraph "🚗 拼车组模式"
        CG[拼车组]
        CG -->|1:1专属绑定| CA[AI账号]
        CG --> CM[成员管理]
        CG --> CS[简单统计]
        CG --> CC[费用分摊]
        
        CM --> CMR[组长/成员]
        CS --> CSD[使用量统计]
        CC --> CCP[平均分摊]
    end
    
    subgraph "🏢 企业模式"
        E[企业]
        E -->|1:N账号池| EP[AI账号池]
        E --> ED[部门管理]
        E --> EB[预算控制]
        E --> ES[智能分配]
        
        ED --> EDG[多个拼车组]
        EB --> EBQ[配额管理]
        ES --> ESA[负载均衡]
        EP --> EPA[多账号管理]
    end
    
    style CG fill:#e8f5e8
    style E fill:#f3e5f5
```

---

## 3. 核心功能模块关系图

```mermaid
graph TB
    subgraph "用户管理模块"
        USER[用户服务]
        USER --> AUTH_SERVICE[身份认证]
        USER --> PROFILE[用户信息]
        USER --> ROLE[角色管理]
    end
    
    subgraph "组织管理模块"
        ORG[组织服务]
        ORG --> GROUP[拼车组管理]
        ORG --> ENTERPRISE[企业管理]
        GROUP --> MEMBER[成员管理]
        GROUP --> INVITE[邀请管理]
    end
    
    subgraph "AI资源管理模块"
        RESOURCE[资源服务]
        RESOURCE --> ACCOUNT[账号管理]
        RESOURCE --> BINDING[资源绑定]
        ACCOUNT --> POOL[账号池]
        ACCOUNT --> EXCLUSIVE[专属账号]
    end
    
    subgraph "API Key管理模块"
        APIKEY_MOD[API Key服务]
        APIKEY_MOD --> KEY_GEN[密钥生成]
        APIKEY_MOD --> KEY_VALID[密钥验证]
        APIKEY_MOD --> QUOTA_CTRL[配额控制]
        APIKEY_MOD --> RATE_LIMIT[速率限制]
    end
    
    subgraph "权限管理模块"
        PERMISSION[权限服务]
        PERMISSION --> RBAC[角色权限]
        PERMISSION --> ACCESS[访问控制]
        RBAC --> SYSTEM_ADMIN[系统管理员]
        RBAC --> OWNER[所有者]
        RBAC --> ADMIN[管理员]
        RBAC --> MEMBER_ROLE[成员]
    end
    
    subgraph "智能路由模块"
        SMART_ROUTER[SmartAiRouter]
        SMART_ROUTER --> ROUTE_ALGO[路由算法]
        SMART_ROUTER --> HEALTH_CHECK[健康检查]
        SMART_ROUTER --> LOAD_BALANCE[负载均衡]
        SMART_ROUTER --> FAILOVER[故障转移]
    end
    
    subgraph "统计监控模块"
        MONITOR[监控服务]
        MONITOR --> USAGE_STAT[使用统计]
        MONITOR --> COST_CALC[费用计算]
        MONITOR --> REPORT[报表生成]
        MONITOR --> ALERT[告警通知]
    end
    
    %% 模块间关系
    USER --> ORG
    ORG --> RESOURCE
    RESOURCE --> SMART_ROUTER
    APIKEY_MOD --> SMART_ROUTER
    PERMISSION --> ALL[所有模块]
    SMART_ROUTER --> MONITOR
    
    style SMART_ROUTER fill:#f3e5f5
    style PERMISSION fill:#ffebee
    style APIKEY_MOD fill:#e8f5e8
```

---

## 4. API请求处理流程图

```mermaid
sequenceDiagram
    participant CLI as CLI工具
    participant GW as API Gateway
    participant AUTH as 认证中间件
    participant CACHE as Redis缓存
    participant PERM as 权限验证
    participant ROUTER as SmartAiRouter
    participant AI as AI服务
    participant QUEUE as 消息队列
    participant DB as 数据库
    
    CLI->>GW: 发送请求(带API Key)
    GW->>AUTH: 转发请求
    AUTH->>CACHE: 查询API Key缓存
    
    alt 缓存命中
        CACHE-->>AUTH: 返回缓存数据
    else 缓存未命中
        AUTH->>DB: 查询API Key
        DB-->>AUTH: 返回数据
        AUTH->>CACHE: 更新缓存
    end
    
    AUTH->>PERM: 权限验证
    PERM-->>AUTH: 验证通过
    
    AUTH->>ROUTER: 转发到路由器
    ROUTER->>CACHE: 查询资源配置
    ROUTER->>ROUTER: 选择最优AI账号
    ROUTER->>AI: 调用AI服务
    AI-->>ROUTER: 返回响应
    
    ROUTER->>QUEUE: 异步记录使用统计
    ROUTER-->>CLI: 返回结果
    
    QUEUE->>DB: 批量写入统计数据
    
    Note over CACHE: v2.7优化：缓存层
    Note over QUEUE: v2.7优化：异步处理
```

---

## 5. 数据模型关系图

```mermaid
erDiagram
    User ||--o{ UserEnterprise : "加入"
    User ||--o{ GroupMember : "属于"
    User ||--o{ ApiKey : "拥有"
    
    Enterprise ||--o{ UserEnterprise : "包含"
    Enterprise ||--o{ CarpoolGroup : "管理"
    Enterprise ||--o{ AiServiceAccount : "拥有账号池"
    
    CarpoolGroup ||--o{ GroupMember : "包含"
    CarpoolGroup ||--o{ GroupInvite : "邀请"
    CarpoolGroup ||--o{ ApiKey : "生成"
    CarpoolGroup ||--|| AiServiceAccount : "绑定(拼车组模式)"
    CarpoolGroup ||--o{ UsageStat : "产生"
    
    AiServiceAccount ||--o{ UsageStat : "记录"
    ApiKey ||--o{ UsageStat : "产生"
    
    User {
        string id PK
        string email
        string name
        string avatarUrl
        datetime createdAt
    }
    
    Enterprise {
        string id PK
        string name
        string description
        string ownerId FK
        datetime createdAt
    }
    
    CarpoolGroup {
        string id PK
        string name
        string description
        string creatorId FK
        string enterpriseId FK
        string boundAccountId FK
        boolean isActive
    }
    
    GroupMember {
        string id PK
        string groupId FK
        string userId FK
        string role
        datetime joinedAt
    }
    
    AiServiceAccount {
        string id PK
        string name
        string serviceType
        string apiKey
        string ownerType
        string ownerId FK
        boolean isEnabled
    }
    
    ApiKey {
        string id PK
        string key UK
        string name
        string groupId FK
        string userId FK
        string status
        bigint quotaLimit
        bigint quotaUsed
        json metadata
        datetime expiresAt
    }
    
    UsageStat {
        string id PK
        string groupId FK
        string accountId FK
        string apiKeyId FK
        bigint totalTokens
        decimal totalCost
        datetime requestTime
    }
```

---

## 6. 权限体系层级关系图

```mermaid
graph TD
    subgraph "系统级权限"
        SA[系统管理员]
        SA --> SAP1[system.admin]
        SA --> SAP2[所有权限]
    end
    
    subgraph "企业级权限"
        EO[企业所有者]
        EA[企业管理员]
        EO --> EOP1[enterprise.manage]
        EO --> EOP2[group.create]
        EO --> EOP3[ai.manage]
        EA --> EAP1[enterprise.view]
        EA --> EAP2[group.manage]
        EA --> EAP3[user.invite]
    end
    
    subgraph "拼车组级权限"
        GO[拼车组长]
        GM[拼车组成员]
        GO --> GOP1[group.manage]
        GO --> GOP2[ai.use]
        GO --> GOP3[user.invite]
        GO --> GOP4[管理所有成员API Key]
        GM --> GMP1[group.view]
        GM --> GMP2[ai.use]
        GM --> GMP3[管理自己的API Key]
    end
    
    SA --> EO
    EO --> EA
    EA --> GO
    GO --> GM
    
    style SA fill:#ff6b6b
    style EO fill:#4ecdc4
    style GO fill:#45b7d1
    style GM fill:#96ceb4
```

---

## 7. 高并发优化架构图（v2.7）

```mermaid
graph TB
    subgraph "请求层"
        REQ[高并发请求]
    end
    
    subgraph "缓存层"
        C1[API Key缓存<br/>TTL: 300s]
        C2[资源绑定缓存<br/>TTL: 600s]
        C3[账号健康缓存<br/>TTL: 300s]
        C4[配额信息缓存<br/>TTL: 60s]
        C5[预计算账号池<br/>TTL: 120s]
    end
    
    subgraph "应用层优化"
        OPT1[并行查询]
        OPT2[批量处理]
        OPT3[异步统计]
        OPT4[连接池复用]
    end
    
    subgraph "异步处理层"
        MQ[消息队列]
        WORKER[批处理Worker]
        WORKER --> BATCH[批量写入<br/>100条/10秒]
    end
    
    subgraph "数据层优化"
        IDX[优化索引]
        QUERY[查询合并]
        POOL[连接池]
    end
    
    REQ --> C1
    C1 --> OPT1
    C2 --> OPT1
    C3 --> OPT1
    OPT1 --> OPT3
    OPT3 --> MQ
    MQ --> WORKER
    WORKER --> BATCH
    BATCH --> DB[(数据库)]
    
    style C1 fill:#ffebee
    style MQ fill:#e8f5e8
    style BATCH fill:#fff3e0
```

---

## 8. 模块依赖关系总览

```mermaid
graph LR
    subgraph "基础服务"
        AUTH_BASE[认证服务]
        CACHE_BASE[缓存服务]
        DB_BASE[数据库服务]
    end
    
    subgraph "核心业务"
        USER_BIZ[用户管理]
        GROUP_BIZ[组织管理]
        RESOURCE_BIZ[资源管理]
    end
    
    subgraph "增值功能"
        APIKEY_FEAT[API Key管理]
        ROUTER_FEAT[智能路由]
        STATS_FEAT[统计分析]
    end
    
    subgraph "支撑系统"
        MONITOR_SUP[监控告警]
        QUEUE_SUP[消息队列]
        SCHEDULE_SUP[定时任务]
    end
    
    %% 依赖关系
    USER_BIZ --> AUTH_BASE
    GROUP_BIZ --> USER_BIZ
    RESOURCE_BIZ --> GROUP_BIZ
    
    APIKEY_FEAT --> USER_BIZ
    APIKEY_FEAT --> GROUP_BIZ
    APIKEY_FEAT --> CACHE_BASE
    
    ROUTER_FEAT --> RESOURCE_BIZ
    ROUTER_FEAT --> CACHE_BASE
    
    STATS_FEAT --> QUEUE_SUP
    STATS_FEAT --> DB_BASE
    
    MONITOR_SUP --> ALL[所有模块]
    SCHEDULE_SUP --> CACHE_BASE
    SCHEDULE_SUP --> DB_BASE
    
    style AUTH_BASE fill:#ffebee
    style ROUTER_FEAT fill:#f3e5f5
    style STATS_FEAT fill:#e8f5e8
```

---

## 总结

AiCarpool当前架构采用了**双模式设计**（拼车组模式和企业模式），通过以下核心模块实现了完整的AI资源管理平台：

### 核心特点

1. **灵活的资源管理**
   - 拼车组模式：1对1专属绑定，确保公平性
   - 企业模式：账号池智能分配，提高资源利用率

2. **完善的权限体系**
   - 多级权限控制（系统、企业、拼车组、成员）
   - 基于角色的访问控制（RBAC）
   - API Key级别的细粒度权限

3. **智能路由系统**
   - SmartAiRouter实现智能选择最优AI账号
   - 支持负载均衡和故障转移
   - 健康检查和自动恢复

4. **高性能优化**
   - Redis缓存层减少数据库查询
   - 异步消息队列处理统计数据
   - 批量操作和查询优化

5. **统一管理界面**
   - Web端完整管理功能
   - 支持多种CLI工具接入
   - 实时监控和统计分析

### 技术栈

- **前端**: Next.js + React + TypeScript
- **后端**: Node.js + Prisma ORM
- **数据库**: MySQL
- **缓存**: Redis
- **消息队列**: Redis Queue
- **AI服务**: Claude（原生/中转）、Gemini、Kimi k2、通义千问、智谱GLM等

这个架构设计既保证了系统的灵活性和可扩展性，又通过优化确保了高并发场景下的性能表现。