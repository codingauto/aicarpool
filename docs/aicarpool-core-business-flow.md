# AiCarpool 核心业务流程架构图

## 文档信息
- **创建时间**: 2025-08-08
- **文档目的**: 展示AiCarpool从组织创建到AI资源配置的核心业务流程
- **重点内容**: 企业/拼车组创建 → 组织架构 → 成员邀请 → AI资源配置 → API密钥管理

---

## 1. 核心业务流程总览

```mermaid
graph TB
    START[用户注册/登录]
    START --> CHOICE{选择模式}
    CHOICE -->|企业用户| ENTERPRISE[创建企业]
    CHOICE -->|个人/小团队| CARPOOL[创建拼车组]
    
    ENTERPRISE --> E_STRUCT[企业组织架构]
    E_STRUCT --> E_DEPT[创建部门]
    E_DEPT --> E_GROUP[创建拼车组]
    
    CARPOOL --> C_STRUCT[拼车组结构]
    C_STRUCT --> C_ROLES["设置角色<br/>组长/成员"]
    
    E_GROUP --> INVITE1[邀请成员]
    C_ROLES --> INVITE2[邀请成员]
    INVITE1 --> MEMBERS[成员加入]
    INVITE2 --> MEMBERS
    
    MEMBERS --> AI_RESOURCE[配置AI资源]
    AI_RESOURCE --> CLAUDE[Claude配置]
    AI_RESOURCE --> GEMINI[Gemini配置]
    AI_RESOURCE --> OTHER[其他AI服务]
    
    CLAUDE --> APIKEY[生成API密钥]
    GEMINI --> APIKEY
    OTHER --> APIKEY
    APIKEY --> CLI_USE[CLI工具使用]
    
    style START fill:#e1f5fe
    style ENTERPRISE fill:#f3e5f5
    style CARPOOL fill:#e8f5e8
    style AI_RESOURCE fill:#fff3e0
    style APIKEY fill:#ffebee
```

---

## 2. AI资源配置详细流程

```mermaid
graph LR
    subgraph SC["Claude 系列配置"]
        CLAUDE_CONFIG[Claude配置]
        CLAUDE_CONFIG --> OAUTH[Claude Code OAuth]
        CLAUDE_CONFIG --> CONSOLE[Claude Console]
        
        CONSOLE --> NATIVE[原生Claude API]
        CONSOLE --> PROXY[中转API]
        
        PROXY --> KIMI[Kimi k2]
        PROXY --> QWEN[通义千问 3]
        PROXY --> GLM[智谱GLM 4.5]
        PROXY --> CUSTOM[自定义中转API]
    end
    
    subgraph SO["其他AI服务"]
        OTHER_AI[其他AI服务]
        OTHER_AI --> GEMINI_CLI[Gemini CLI]
        OTHER_AI --> CURSOR[Cursor Agent]
        OTHER_AI --> AMPCODE[AmpCode CLI]
        OTHER_AI --> AUGGIE[Auggie CLI]
    end
    
    subgraph SM["账号管理模式"]
        MODE[资源绑定模式]
        MODE --> EXCLUSIVE["专属绑定<br/>拼车组模式"]
        MODE --> POOL["账号池<br/>企业模式"]
    end
    
    OAUTH --> EXCLUSIVE
    CONSOLE --> EXCLUSIVE
    OTHER_AI --> EXCLUSIVE
    
    OAUTH --> POOL
    CONSOLE --> POOL
    OTHER_AI --> POOL
    
    style CLAUDE_CONFIG fill:#e3f2fd
    style OTHER_AI fill:#f3e5f5
    style MODE fill:#e8f5e8
```

---

## 3. 组织模式对比流程

```mermaid
graph TB
    subgraph SE["企业模式流程"]
        E1[创建企业] --> E2[设置企业信息]
        E2 --> E3[创建部门结构]
        E3 --> E4[部门下创建拼车组]
        E4 --> E5[配置AI账号池]
        E5 --> E6[智能分配资源]
        E6 --> E7[成员使用]
    end
    
    subgraph SP["拼车组模式流程"]
        C1[创建拼车组] --> C2[设置组信息]
        C2 --> C3[邀请成员加入]
        C3 --> C4[绑定专属AI账号]
        C4 --> C5[1对1资源绑定]
        C5 --> C6[成员使用]
    end
    
    E7 --> API1[生成API密钥]
    C6 --> API2[生成API密钥]
    
    API1 --> CLI[CLI工具调用]
    API2 --> CLI
    
    style E1 fill:#f3e5f5
    style C1 fill:#e8f5e8
    style CLI fill:#ffebee
```

---

## 4. AI账号添加流程

```mermaid
flowchart TD
    START[开始添加AI账号]
    START --> SELECT[选择AI服务类型]
    
    SELECT --> CLAUDE_PATH{Claude系列}
    SELECT --> OTHER_PATH[其他AI服务]
    
    %% Claude路径
    CLAUDE_PATH -->|OAuth模式| OAUTH_FLOW[Claude Code OAuth认证]
    OAUTH_FLOW --> OAUTH_AUTH[跳转OAuth页面]
    OAUTH_AUTH --> OAUTH_TOKEN[获取Access Token]
    OAUTH_TOKEN --> SAVE_OAUTH[保存OAuth凭证]
    
    CLAUDE_PATH -->|Console模式| CONSOLE_FLOW[Claude Console配置]
    CONSOLE_FLOW --> CONSOLE_TYPE{选择类型}
    
    CONSOLE_TYPE -->|原生| NATIVE_API[配置Claude API Key]
    CONSOLE_TYPE -->|中转| PROXY_API[选择中转服务]
    
    PROXY_API --> KIMI_API[Kimi k2 API]
    PROXY_API --> QWEN_API[通义千问3 API]
    PROXY_API --> GLM_API[智谱GLM 4.5 API]
    PROXY_API --> CUSTOM_API[自定义中转地址]
    
    %% 其他AI服务路径
    OTHER_PATH --> GEMINI[Gemini CLI配置]
    OTHER_PATH --> CURSOR[Cursor Agent配置]
    OTHER_PATH --> AMPCODE[AmpCode CLI配置]
    OTHER_PATH --> AUGGIE[Auggie CLI配置]
    
    %% 汇总保存
    SAVE_OAUTH --> BIND[绑定到组织]
    NATIVE_API --> CONFIG[配置认证信息]
    KIMI_API --> CONFIG
    QWEN_API --> CONFIG
    GLM_API --> CONFIG
    CUSTOM_API --> CONFIG
    GEMINI --> CONFIG
    CURSOR --> CONFIG
    AMPCODE --> CONFIG
    AUGGIE --> CONFIG
    
    CONFIG --> BIND
    BIND --> TEST[测试连接]
    TEST --> SUCCESS[添加成功]
    
    style START fill:#e1f5fe
    style CLAUDE_PATH fill:#f3e5f5
    style OTHER_PATH fill:#e8f5e8
    style SUCCESS fill:#c8e6c9
```

---

## 5. API密钥生成与使用流程

```mermaid
sequenceDiagram
    participant Admin as 管理员/组长
    participant System as AiCarpool系统
    participant AIService as AI服务账号
    participant Member as 组成员
    participant CLI as CLI工具
    
    Admin->>System: 进入API密钥管理
    Admin->>System: 点击创建新密钥
    
    System->>System: 显示配置界面
    Note over System: 1. 选择绑定成员<br/>2. 设置配额限制<br/>3. 选择可用AI服务
    
    Admin->>System: 完成配置并提交
    System->>AIService: 验证AI账号可用性
    AIService-->>System: 验证通过
    
    System->>System: 生成API密钥
    Note over System: 格式: aicp_<groupId>_<userId>_<random>
    
    System-->>Admin: 返回API密钥和配置指南
    Admin->>Member: 分发API密钥
    
    Member->>CLI: 配置API密钥
    Note over CLI: Claude Code: export ANTHROPIC_BASE_URL=http://localhost:4000/api/v1<br/>export ANTHROPIC_AUTH_TOKEN=aicp_xxx<br/>Gemini: export GEMINI_API_URL=http://localhost:4000/api/ai-proxy<br/>export GEMINI_API_KEY=aicp_xxx
    
    CLI->>System: 发起API请求到对应端点
    Note over System: Claude Code -> /api/v1/*<br/>Gemini/Others -> /api/ai-proxy/*
    System->>System: 验证API密钥
    System->>System: 通过SmartAiRouter选择账号
    Note over System: 1. 解析groupId和userId<br/>2. 查询拼车组资源绑定配置<br/>3. 根据绑定模式选择账号
    System->>AIService: 路由到选定的AI账号
    AIService-->>System: 返回AI响应
    System-->>CLI: 返回结果
```

---

## 6. 完整业务数据流

```mermaid
graph TB
    subgraph SG1["组织层"]
        ORG[企业/拼车组]
        ORG --> DEPT["部门<br/>仅企业模式"]
        ORG --> GROUP[拼车组]
    end
    
    subgraph SG2["成员层"]
        GROUP --> MEMBER[成员]
        MEMBER --> ROLE{角色}
        ROLE -->|管理员| ADMIN_PERM[可管理所有资源]
        ROLE -->|普通成员| MEMBER_PERM[使用分配的资源]
    end
    
    subgraph SG3["AI资源层"]
        AI_ACCOUNT[AI服务账号]
        AI_ACCOUNT --> CLAUDE_OAUTH[Claude OAuth]
        AI_ACCOUNT --> CLAUDE_CONSOLE[Claude Console]
        AI_ACCOUNT --> GEMINI_ACCOUNT[Gemini账号]
        AI_ACCOUNT --> OTHER_ACCOUNT[其他CLI账号]
        
        CLAUDE_CONSOLE --> PROXY_SERVICE[中转服务]
        PROXY_SERVICE --> KIMI_SERVICE[Kimi k2]
        PROXY_SERVICE --> QWEN_SERVICE[通义千问3]
        PROXY_SERVICE --> GLM_SERVICE[GLM 4.5]
        PROXY_SERVICE --> CUSTOM_SERVICE[自定义API]
    end
    
    subgraph SG4["绑定关系"]
        GROUP -->|企业模式| ACCOUNT_POOL["账号池<br/>N对N"]
        GROUP -->|拼车组模式| EXCLUSIVE_BIND["专属绑定<br/>1对1"]
        
        ACCOUNT_POOL --> AI_ACCOUNT
        EXCLUSIVE_BIND --> AI_ACCOUNT
    end
    
    subgraph SG5["API密钥层"]
        MEMBER --> API_KEY[API密钥]
        API_KEY --> KEY_CONFIG[密钥配置]
        KEY_CONFIG --> QUOTA[配额限制]
        KEY_CONFIG --> RATE_LIMIT[速率限制]
        KEY_CONFIG --> SERVICE_PERM[服务权限]
    end
    
    subgraph SG6["使用层"]
        API_KEY --> CLI_TOOLS[CLI工具]
        CLI_TOOLS --> CLAUDE_CODE[Claude Code]
        CLI_TOOLS --> GEMINI_CLI[Gemini CLI]
        CLI_TOOLS --> CURSOR_AGENT[Cursor Agent]
        CLI_TOOLS --> AMPCODE_CLI[AmpCode CLI]
        CLI_TOOLS --> AUGGIE_CLI[Auggie CLI]
    end
    
    style ORG fill:#e3f2fd
    style AI_ACCOUNT fill:#f3e5f5
    style API_KEY fill:#e8f5e8
    style CLI_TOOLS fill:#fff3e0
```

---

## 7. API Key路由验证详解

### 7.1 客户端配置与路由映射

| CLI工具 | 环境变量配置 | 请求端点 | 路由处理 |
|---------|------------|---------|---------|
| **Claude Code** | `ANTHROPIC_BASE_URL=http://localhost:4000/api/v1`<br/>`ANTHROPIC_AUTH_TOKEN=aicp_xxx` | `/api/v1/*` | 需要实现v1兼容接口 |
| **Gemini CLI** | `GEMINI_API_URL=http://localhost:4000/api/ai-proxy`<br/>`GEMINI_API_KEY=aicp_xxx` | `/api/ai-proxy/chat` | 已实现，通过SmartAiRouter路由 |
| **Cursor Agent** | `CURSOR_API_URL=http://localhost:4000/api/ai-proxy`<br/>`CURSOR_API_KEY=aicp_xxx` | `/api/ai-proxy/chat` | 同Gemini处理逻辑 |
| **AmpCode CLI** | `AMPCODE_BASE_URL=http://localhost:4000/api/ai-proxy`<br/>`AMPCODE_API_KEY=aicp_xxx` | `/api/ai-proxy/chat` | 同Gemini处理逻辑 |

### 7.2 API Key解析与路由流程

```mermaid
flowchart TD
    START[CLI发起请求] --> PARSE[解析API Key]
    PARSE --> EXTRACT[提取信息]
    
    EXTRACT --> INFO["API Key: aicp_cmdyads9_cmdvjxn1_640b9937285908fa"]
    INFO --> GROUP_ID["groupId: cmdyads9xxx"]
    INFO --> USER_ID["userId: cmdvjxn1xxx"]
    
    GROUP_ID --> QUERY_GROUP[查询拼车组配置]
    QUERY_GROUP --> BINDING{资源绑定模式?}
    
    BINDING -->|专属绑定| DEDICATED[查找专属账号]
    BINDING -->|账号池| POOL[从池中选择]
    BINDING -->|混合模式| HYBRID["优先专属,降级到池"]
    
    DEDICATED --> ACCOUNT[获取AI账号凭证]
    POOL --> ACCOUNT
    HYBRID --> ACCOUNT
    
    ACCOUNT --> ROUTE[路由到AI服务]
    ROUTE --> RESPONSE[返回响应]
    
    style START fill:#e1f5fe
    style PARSE fill:#f3e5f5
    style ACCOUNT fill:#e8f5e8
    style RESPONSE fill:#c8e6c9
```

### 7.3 实际路由验证

基于代码分析，当前系统的路由机制：

1. **API Key验证**（`/api/ai-proxy/chat/route.ts`）:
   - 从请求头提取Bearer Token
   - 查询ApiKey表验证有效性
   - 检查用户和组的状态

2. **资源选择**（`SmartAiRouter`）:
   - 根据groupId查询GroupResourceBinding
   - 根据绑定模式（dedicated/shared/hybrid）选择账号
   - 专属模式：使用绑定的专属账号
   - 共享模式：从账号池中智能选择
   - 混合模式：优先专属，不可用时降级到共享池

3. **当前问题**:
   - `/api/v1/*` 端点未实现（Claude Code需要）
   - 路由器部分功能在维护中
   - 需要完善OAuth模式的支持

## 8. 支持的AI服务类型汇总

```mermaid
mindmap
  root((AiCarpool<br/>AI服务))
    Claude系列
      Claude Code
        OAuth认证模式
        直接对接官方API
      Claude Console
        原生API模式
          官方API Key
        中转API模式
          Kimi k2
          通义千问3
          智谱GLM 4.5
          自定义中转API
    Gemini系列
      Gemini CLI
        API Key认证
    其他CLI工具
      Cursor Agent
        Token认证
      AmpCode CLI
        API Key认证
      Auggie CLI
        Token认证
```

---

## 总结

AiCarpool的核心业务流程遵循以下主线：

1. **组织创建** → 用户选择企业模式或拼车组模式创建组织
2. **组织架构** → 企业可创建部门和多个拼车组，拼车组直接设置角色
3. **成员邀请** → 通过邀请链接或邮件邀请成员加入
4. **AI资源配置** → 支持多种AI服务：
   - Claude系列（OAuth和Console两种模式）
   - Console模式支持原生API和多种中转服务
   - 其他CLI工具（Gemini、Cursor、AmpCode、Auggie等）
5. **资源绑定** → 企业模式使用账号池，拼车组模式使用专属绑定
6. **API密钥生成** → 为成员生成统一格式的API密钥，支持多种CLI工具

### API Key路由验证结果

✅ **可以正确路由**：系统通过API Key中包含的groupId和userId信息，能够：
- 识别所属拼车组和用户
- 查询对应的资源绑定配置
- 根据绑定模式（专属/共享/混合）选择正确的AI账号
- 将请求路由到对应的AI服务

⚠️ **需要完善的部分**：
- Claude Code需要的`/api/v1/*`端点尚未实现
- 部分路由功能处于维护状态
- OAuth认证模式需要进一步开发

整个流程设计既支持企业级的灵活管理，也满足小团队的简单需求，通过统一的API密钥实现多种AI服务的无缝接入。