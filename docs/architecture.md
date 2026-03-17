# Double Agent - 架构设计文档

## 项目概述

Double Agent 是一个支持两种对话模式的双智能体对话系统：
- **双Agent辩论模式**：两个性格迥异的AI Agent（温和 vs 暴躁）进行多轮对话辩论
- **单Agent对话模式**：单个Agent进行常规对话

## 技术栈

### 前端
- **框架**: React 19 + TypeScript
- **构建工具**: Vite 8
- **样式**: TailwindCSS v4 + PostCSS
- **状态管理**: Zustand（持久化存储）
- **图标**: Lucide React
- **流式API**: Fetch API + ReadableStream

### 后端
- **框架**: FastAPI + Python 3.11+
- **数据库**: SQLite + SQLAlchemy 2.0 (异步)
- **ORM**: SQLAlchemy AsyncSession
- **API文档**: FastAPI 自动生成 (/docs)

## 目录结构

```
├── backend/                  # 后端代码
│   ├── app/
│   │   ├── main.py          # FastAPI 应用入口
│   │   ├── config.py        # 应用配置 (Pydantic Settings)
│   │   ├── core/
│   │   │   └── database.py  # 数据库连接和会话管理
│   │   ├── models/
│   │   │   ├── session.py   # Session 数据库模型
│   │   │   └── round.py     # Round 数据库模型
│   │   ├── routers/
│   │   │   ├── sessions.py  # 会话管理 API
│   │   │   ├── debate.py    # 辩论流式 API
│   │   │   └── config.py    # 配置 API
│   │   ├── schemas/
│   │   │   ├── session.py   # Pydantic 会话模型
│   │   │   └── agent.py     # Pydantic Agent 模型
│   │   └── services/
│   │       ├── agent_team.py # Agent 协调逻辑
│   │       └── llm_adapter.py # LLM 适配器
│   └── data/                # SQLite 数据库文件目录
├── src/                     # 前端代码
│   ├── agents/              # Agent 核心逻辑（已移至后端，保留适配器）
│   ├── api/
│   │   └── client.ts        # 后端 API 客户端
│   ├── components/          # UI 组件
│   ├── hooks/
│   │   └── useAgentTeam.ts  # Agent 团队状态管理 Hook
│   ├── stores/
│   │   └── debateStorage.ts # 对话存储（调用后端 API）
│   └── types/
│       └── index.ts         # TypeScript 类型定义
└── docs/                    # 文档目录
```

## 架构概览

### 前后端分离架构

```
┌─────────────────┐      HTTP/SSE       ┌─────────────────┐
│     Frontend    │ ◄──────────────────► │    Backend      │
│   (React + Vite)│                     │  (FastAPI)      │
└─────────────────┘                     └─────────────────┘
                                               │
                                               ▼
                                        ┌─────────────────┐
                                        │   SQLite DB     │
                                        │  (Persistent)   │
                                        └─────────────────┘
```

## 核心模块设计

### 1. 后端架构

#### 1.1 FastAPI 应用 (`app/main.py`)

```python
app = FastAPI(
    title="Double Agent API",
    description="双智能体对话/辩论系统后端 API",
    version="0.1.0",
    lifespan=lifespan  # 管理数据库生命周期
)
```

**生命周期管理**：
- 启动时调用 `init_db()` 创建数据库表
- 关闭时调用 `close_db()` 释放连接池

#### 1.2 数据库模型

**Session 模型** (`app/models/session.py`):
```python
class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    user_question: Mapped[str] = mapped_column(String, nullable=False)
    mode: Mapped[str] = mapped_column(String, default="double")
    max_rounds: Mapped[int] = mapped_column(Integer, default=3)
    gentle_config: Mapped[dict] = mapped_column(JSON, nullable=False)
    angry_config: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    updated_at: Mapped[datetime] = mapped_column(DateTime)

    # 关系：一个 Session 有多个 Round
    rounds: Mapped[list["Round"]] = relationship(...)
```

**Round 模型** (`app/models/round.py`):
```python
class Round(Base):
    __tablename__ = "rounds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"))
    round_number: Mapped[int] = mapped_column(Integer)
    gentle_content: Mapped[str] = mapped_column(Text)
    gentle_reasoning: Mapped[str | None] = mapped_column(Text)
    angry_content: Mapped[str] = mapped_column(Text)
    angry_reasoning: Mapped[str | None] = mapped_column(Text)
```

#### 1.3 API 路由

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/sessions` | GET | 列出所有会话 |
| `/api/sessions` | POST | 创建新会话 |
| `/api/sessions/{id}` | GET | 获取会话详情 |
| `/api/sessions/{id}` | PATCH | 更新会话 |
| `/api/sessions/{id}` | DELETE | 删除会话 |
| `/api/sessions/{id}/export` | POST | 导出会话 |
| `/api/sessions/import` | POST | 导入会话 |
| `/api/debate/stream` | POST | 流式辩论 (SSE) |
| `/api/config/models` | GET | 获取模型配置 |
| `/api/config/roles` | GET | 获取角色配置 |

### 2. 前端 API 客户端 (`src/api/client.ts`)

```typescript
class ApiClient {
    // 会话管理
    async getSessions(): Promise<DebateSession[]>
    async createSession(request: CreateSessionRequest): Promise<DebateSession>
    async getSession(id: string): Promise<DebateSession>
    async deleteSession(id: string): Promise<void>

    // 流式辩论
    async *streamDebate(request: DebateRequest): AsyncGenerator<StreamEvent>

    // 导出/导入
    async exportSession(id: string): Promise<string>
    async importSession(jsonl: string): Promise<DebateSession>
}
```

### 3. 数据持久化

#### 3.1 SQLite 数据库

**位置**: `backend/data/double_agent.db`

**表结构**:
```sql
-- sessions 表
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

-- rounds 表
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
```

#### 3.2 前端存储

**debateStorage** (`src/stores/debateStorage.ts`):
- 使用后端 API 进行 CRUD 操作
- 不再使用 localStorage 存储会话数据
- 仅保留当前会话 ID 在 localStorage（用于页面刷新恢复）

### 4. Agent 系统

Agent 核心逻辑已移至后端 (`app/services/agent_team.py`)，前端通过 API 调用。

**流式响应格式 (SSE)**:
```
event: chunk
data: {"type":"chunk","agentId":"gentle","content":"...","reasoning":"..."}

event: round_complete
data: {"type":"round_complete","round":1,"shouldEnd":false}

event: complete
data: {"type":"complete","sessionId":"...","totalRounds":3}
```

### 5. 配置系统

**后端配置** (`app/config.py`):
```python
class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/double_agent.db"
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]
```

**配置优先级**:
1. 环境变量
2. `.env` 文件
3. 默认值

## 数据流

### 创建新对话

```
用户输入
    ↓
useAgentTeam.runDebate(question)
    ↓
apiClient.streamDebate(request) ──POST /api/debate/stream──► Backend
                                                                ↓
                                                        AgentTeam.run_debate()
                                                                ↓
                                                        创建 Session (DB)
                                                                ↓
                                                        流式响应 (SSE)
                                    ◄────────SSE─────────┘
    ↓
UI 更新 (gentleStream/angryStream)
    ↓
流结束，刷新会话列表
```

### 加载历史会话

```
Sidebar 挂载
    ↓
debateStorage.getAllSessions()
    ↓
GET /api/sessions ──► Backend
                        ↓
                查询 SQLite
                        ↓
                返回 Session[]
    ↓
渲染会话列表
```

## 关键文件引用

### 后端

| 文件 | 用途 | 关键导出 |
|------|------|----------|
| `app/main.py` | FastAPI 入口 | `app` 实例 |
| `app/config.py` | 配置管理 | `Settings`, `get_settings()` |
| `app/core/database.py` | 数据库连接 | `get_db()`, `init_db()`, `close_db()` |
| `app/models/session.py` | Session 模型 | `Session` 类 |
| `app/models/round.py` | Round 模型 | `Round` 类 |
| `app/routers/sessions.py` | 会话 API | CRUD 路由 |
| `app/routers/debate.py` | 辩论 API | 流式路由 |
| `app/schemas/session.py` | Pydantic 模型 | `DebateSession`, `DebateRound` |

### 前端

| 文件 | 用途 | 关键导出 |
|------|------|----------|
| `src/api/client.ts` | API 客户端 | `apiClient` |
| `src/stores/debateStorage.ts` | 存储层 | `debateStorage` |
| `src/hooks/useAgentTeam.ts` | 状态管理 | `useAgentTeam` |
| `src/types/index.ts` | 类型定义 | `DebateSession`, `AgentConfig` |

## 扩展点

### 后端扩展

1. **更换数据库**: 修改 `DATABASE_URL` 为 PostgreSQL/MySQL 连接字符串
2. **添加新 API**: 在 `app/routers/` 创建新路由文件
3. **自定义模型**: 在 `app/models/` 添加新表

### 前端扩展

1. **添加新组件**: 在 `src/components/` 创建
2. **自定义存储**: 修改 `debateStorage` 方法
3. **新 API 调用**: 在 `src/api/client.ts` 添加方法

## 部署注意事项

### 数据持久化

**SQLite 文件位置**: `backend/data/double_agent.db`

**Docker 部署时需要**:
1. 创建 volume 映射到 `/app/data`
2. 确保目录权限正确

### 环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `DATABASE_URL` | 数据库连接 | `sqlite+aiosqlite:///./data/double_agent.db` |
| `OPENAI_API_KEY` | OpenAI API Key | `sk-...` |
| `ANTHROPIC_API_KEY` | Claude API Key | `sk-ant-...` |
| `CORS_ORIGINS` | 允许的跨域来源 | `["http://localhost:5173"]` |
