# 架构总览

Double Agent 采用前后端分离架构，前端使用 React + Vite，后端使用 Python + FastAPI + SQLite。

## 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                React Application                         │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │  │
│  │  │ Components  │  │    Hooks    │  │  ConfigManager  │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │  │
│  │  │  AgentTeam  │  │  AgentLoop  │  │  ToolRegistry   │  │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                              │                                 │
│                              ▼                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Vite Dev Server (Port 5173)                 │  │
│  │              - 前端静态资源服务                           │  │
│  │              - API 代理 (/api/* → localhost:8000)        │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend (Port 8000)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Routers   │  │   Models    │  │       Services          │ │
│  │  - sessions │  │  - Session  │  │  - agent_team.py        │ │
│  │  - debate   │  │  - Round    │  │  - llm_adapter.py       │ │
│  │  - config   │  │  - Message  │  │  - tool_executor.py     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              SQLAlchemy + aiosqlite                      │   │
│  │              SQLite Async ORM                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│                   ┌─────────────────────┐                      │
│                   │  SQLite Database    │                      │
│                   │  data/double_agent.db│                     │
│                   └─────────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                   ┌────────────────────────┐
                   │   LLM API Providers    │
                   │  (OpenAI/Anthropic/...)│
                   └────────────────────────┘
```

## 目录结构

```
double-agent/
├── backend/                  # 后端代码 (Python + FastAPI)
│   ├── app/
│   │   ├── main.py          # FastAPI 应用入口
│   │   ├── config.py        # 应用配置 (Pydantic Settings)
│   │   ├── core/
│   │   │   └── database.py  # 数据库连接和会话管理
│   │   ├── models/          # SQLAlchemy 数据库模型
│   │   │   ├── session.py   # Session 模型
│   │   │   ├── round.py     # Round 模型
│   │   │   └── message.py   # Message 模型 (AgentLoop)
│   │   ├── routers/         # API 路由
│   │   │   ├── sessions.py  # 会话管理 API
│   │   │   ├── debate.py    # 辩论流式 API (SSE)
│   │   │   ├── config.py    # 配置 API
│   │   │   └── messages.py  # 消息/迭代 API
│   │   ├── schemas/         # Pydantic 模型
│   │   │   ├── session.py   # 会话相关 Schema
│   │   │   ├── agent.py     # Agent 配置 Schema
│   │   │   └── message.py   # 消息相关 Schema
│   │   └── services/        # 业务逻辑
│   │       ├── agent_team.py    # Agent 协调逻辑
│   │       ├── llm_adapter.py   # LLM 适配器
│   │       └── tool_executor.py # 工具执行器
│   └── data/                # SQLite 数据库文件
│
├── src/                     # 前端代码 (React + TypeScript)
│   ├── agents/              # Agent 核心逻辑
│   │   ├── AgentTeam.ts     # 主协调类 (runDebate/runSingle)
│   │   ├── AgentLoop.ts     # 新一代 Agent 循环
│   │   ├── OpenAIAdapter.ts # OpenAI 格式 API 适配器
│   │   ├── AnthropicAdapter.ts # Claude 原生 API 适配器
│   │   └── AgentConfig.ts   # Agent 配置工具
│   ├── api/
│   │   └── client.ts        # 后端 API 客户端
│   ├── components/          # React UI 组件
│   │   ├── AgentPanel.tsx   # Agent 对话面板
│   │   ├── Header.tsx       # 顶部导航
│   │   ├── Sidebar.tsx      # 侧边栏
│   │   ├── UserInput.tsx    # 用户输入区
│   │   ├── ConfigModal.tsx  # 配置管理模态框
│   │   └── config/          # 配置相关子组件
│   ├── config/              # 三层配置系统
│   │   ├── ConfigManager.ts # 配置管理器
│   │   ├── types.ts         # 配置类型
│   │   └── presets.ts       # 预设配置
│   ├── hooks/
│   │   └── useAgentTeam.ts  # React Hook for Agent
│   ├── prompts/
│   │   ├── roles.ts         # 角色定义 (温和/暴躁)
│   │   └── models.ts        # 模型预设
│   ├── stores/              # 状态管理
│   │   ├── debateStorage.ts # 会话历史存储 (调用后端 API)
│   │   ├── agentStore.ts    # Agent 配置 (Zustand)
│   │   └── envConfig.ts     # 环境变量配置
│   ├── tools/               # 工具系统
│   │   ├── types.ts         # 工具类型定义
│   │   ├── registry.ts      # 工具注册中心
│   │   └── parser.ts        # 工具调用解析
│   ├── types/               # TypeScript 类型
│   │   ├── index.ts         # 主要类型
│   │   └── helpers.ts       # 类型辅助函数
│   └── utils/
│       └── tokenCounter.ts  # Token 估算和上下文压缩
│
├── docs/                    # 文档目录
└── package.json             # 前端依赖
```

## 核心模块

### 1. 后端 (Backend)

| 模块 | 文件 | 职责 |
|------|------|------|
| 入口 | `app/main.py` | FastAPI 应用实例、生命周期管理、CORS |
| 配置 | `app/config.py` | Pydantic Settings，环境变量管理 |
| 数据库 | `app/core/database.py` | 异步 SQLAlchemy 会话、连接池 |
| 模型 | `app/models/*.py` | Session、Round、Message 表定义 |
| 路由 | `app/routers/*.py` | REST API + SSE 端点 |
| 服务 | `app/services/*.py` | 业务逻辑、LLM 调用、工具执行 |

### 2. 前端 (Frontend)

| 模块 | 文件 | 职责 |
|------|------|------|
| API 客户端 | `api/client.ts` | 封装后端 API 调用 |
| Agent 核心 | `agents/*.ts` | AgentTeam、AgentLoop、适配器 |
| 配置系统 | `config/*.ts` | Provider → Model → Agent 三层配置 |
| 状态管理 | `stores/*.ts` | Zustand + localStorage 持久化 |
| 工具系统 | `tools/*.ts` | 工具注册、执行、解析 |
| 组件 | `components/*.tsx` | React UI 组件 |

## 数据持久化

### 后端存储 (SQLite)

**数据库位置**: `backend/data/double_agent.db`

**表结构**:

```sql
-- sessions 表：存储会话元数据
CREATE TABLE sessions (
    id VARCHAR PRIMARY KEY,
    title VARCHAR NOT NULL,
    user_question VARCHAR NOT NULL,
    mode VARCHAR DEFAULT 'double',
    max_rounds INTEGER DEFAULT 3,
    gentle_config JSON NOT NULL,
    angry_config JSON NOT NULL,
    created_at DATETIME,
    updated_at DATETIME
);

-- rounds 表：存储每轮对话内容
CREATE TABLE rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id VARCHAR REFERENCES sessions(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    gentle_content TEXT NOT NULL,
    gentle_reasoning TEXT,
    gentle_agent_id VARCHAR NOT NULL,
    angry_content TEXT NOT NULL,
    angry_reasoning TEXT,
    angry_agent_id VARCHAR NOT NULL,
    created_at DATETIME
);

-- iterations 表：存储 AgentLoop 迭代记录
CREATE TABLE iterations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id VARCHAR,
    agent_id VARCHAR,
    agent_name VARCHAR,
    round_number INTEGER,
    iteration_number INTEGER,
    status VARCHAR,
    duration_ms INTEGER,
    created_at DATETIME
);

-- messages 表：存储 AgentLoop 消息
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    iteration_id INTEGER REFERENCES iterations(id),
    item_type VARCHAR,
    role VARCHAR,
    content JSON,
    sequence INTEGER,
    agent_id VARCHAR,
    timestamp INTEGER
);
```

### 前端存储 (localStorage)

| Key | 内容 | 说明 |
|-----|------|------|
| `double-agent-config-v1` | AppConfig | 三层配置系统 |
| `double-agent-current-session` | sessionId | 当前会话 ID |

**注意**: API Key 不会被持久化（安全考虑）

## 通信协议

### REST API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/sessions` | GET | 获取所有会话 |
| `/api/sessions` | POST | 创建新会话 |
| `/api/sessions/{id}` | GET | 获取会话详情 |
| `/api/sessions/{id}` | PATCH | 更新会话 |
| `/api/sessions/{id}` | DELETE | 删除会话 |
| `/api/sessions/{id}/export` | POST | 导出会话 |
| `/api/sessions/import` | POST | 导入会话 |
| `/api/config/models` | GET | 获取模型配置 |
| `/api/config/roles` | GET | 获取角色配置 |

### SSE (Server-Sent Events)

**端点**: `POST /api/debate/stream`

**事件类型**:

```
event: chunk
data: {"type":"chunk","agentId":"gentle","content":"...","reasoning":"..."}

event: round_complete
data: {"type":"round_complete","round":1,"shouldEnd":false}

event: error
data: {"type":"error","message":"..."}

event: complete
data: {"type":"complete","sessionId":"...","totalRounds":3}
```

## 部署架构

### 开发环境

```
Frontend (Vite)          Backend (FastAPI)
Port 5173  ←───────────→ Port 8000
    │                          │
    │    /api/* proxy          │
    └──────────────────────────┘
```

### 生产环境

```
Nginx / CDN              FastAPI
(Static Files)           (API + SSE)
     │                        │
     └────────────────────────┘
              │
         SQLite DB
```

## 安全考虑

1. **API Key**: 从不存储在数据库中，从前端环境变量读取
2. **CORS**: 后端配置允许的跨域来源
3. **输入验证**: Pydantic Schema 验证所有请求
4. **代码执行**: 工具系统中的代码执行仅为模拟，需要额外沙箱
