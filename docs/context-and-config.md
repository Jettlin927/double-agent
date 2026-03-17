# 上下文管理与配置系统

本文档介绍 Double Agent 项目的上下文管理和配置系统。

## 目录

- [数据持久化](#数据持久化)
- [上下文管理](#上下文管理)
- [配置系统](#配置系统)
- [动态结束判断机制](#动态结束判断机制)

---

## 数据持久化

### SQLite 数据库

项目使用 **SQLite** 作为持久化存储，通过 SQLAlchemy 异步 ORM 操作。

#### 数据库位置

```
backend/data/double_agent.db
```

#### 表结构

**sessions 表** - 存储对话会话元数据：
```sql
CREATE TABLE sessions (
    id VARCHAR PRIMARY KEY,
    title VARCHAR NOT NULL,
    user_question VARCHAR NOT NULL,
    mode VARCHAR DEFAULT 'double',
    max_rounds INTEGER DEFAULT 3,
    gentle_config JSON NOT NULL,  -- Agent 配置 (JSON)
    angry_config JSON NOT NULL,
    created_at DATETIME,
    updated_at DATETIME
);
```

**rounds 表** - 存储每轮对话内容：
```sql
CREATE TABLE rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id VARCHAR REFERENCES sessions(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    gentle_content TEXT NOT NULL,
    gentle_reasoning TEXT,  -- 思维链内容
    gentle_agent_id VARCHAR NOT NULL,
    angry_content TEXT NOT NULL,
    angry_reasoning TEXT,
    angry_agent_id VARCHAR NOT NULL,
    created_at DATETIME
);
```

#### 后端数据库操作

```python
# 创建会话
async def create_session(request: SessionCreateRequest, db: AsyncSession):
    db_session = SessionModel(
        id=generate_session_id(),
        title=request.user_question[:50],
        user_question=request.user_question,
        mode=request.mode.value,
        gentle_config=request.gentle_config.model_dump(),
        angry_config=request.angry_config.model_dump(),
    )
    db.add(db_session)
    await db.commit()

# 查询会话（带关联的 rounds）
async def get_session(session_id: str, db: AsyncSession):
    result = await db.execute(
        select(SessionModel)
        .options(selectinload(SessionModel.rounds))
        .where(SessionModel.id == session_id)
    )
    return result.scalar_one_or_none()
```

#### 前端存储层

**debateStorage** (`src/stores/debateStorage.ts`) - 调用后端 API：

```typescript
export class DebateStorage {
    // 创建会话
    async createSession(...): Promise<DebateSession> {
        return apiClient.createSession(request);
    }

    // 获取所有会话
    async getAllSessions(): Promise<DebateSession[]> {
        return apiClient.getSessions();
    }

    // 获取单个会话
    async getSession(id: string): Promise<DebateSession | undefined> {
        return apiClient.getSession(id);
    }

    // 删除会话
    async deleteSession(id: string): Promise<void> {
        return apiClient.deleteSession(id);
    }
}
```

---

## 上下文管理

上下文管理负责监控对话的 token 使用量，防止超出模型的上下文限制。

### Token 计数器

```typescript
// src/utils/tokenCounter.ts

// 估算单条文本的 token 数
export function estimateTokens(text: string): number {
  // 中文字符：每个约 1.5 tokens
  // 英文单词：每个约 1.3 tokens
}

// 支持的模型上下文限制
export const CONTEXT_LIMITS: Record<string, number> = {
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'claude-3-5-sonnet': 200000,
  'deepseek-chat': 64000,
  // ...
};
```

### 上下文压缩

当 token 使用量达到 **80% 阈值**时，系统触发压缩：

```typescript
// 压缩策略：保留系统消息 + 最近 N 条消息
export function compactMessages(
  messages: Array<{ role: string; content: string }>,
  keepRecent: number = 4
): Array<{ role: string; content: string }>
```

**注意**：当前上下文压缩在前端实现，未来可移至后端处理。

---

## 配置系统

### 后端配置

**Pydantic Settings** (`backend/app/config.py`)：

```python
class Settings(BaseSettings):
    # 数据库
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/double_agent.db"

    # API Keys (从环境变量读取)
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com"
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_BASE_URL: str = "https://api.anthropic.com"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    class Config:
        env_file = ".env"
        extra = "ignore"  # 忽略未定义的环境变量
```

**配置优先级**：
1. 环境变量
2. `.env` 文件
3. 默认值

### 前端配置

**Agent 配置** (`src/stores/agentStore.ts`)：

```typescript
interface AgentState {
  gentleConfig: AgentConfig;
  angryConfig: AgentConfig;
  updateConfig: (personality, updates) => void;
}

// 使用 Zustand + persist 持久化到 localStorage
export const useAgentStore = create<AgentState>()(
  persist(..., { name: 'double-agent-config' })
);
```

**注意**：API Key 不会被持久化（安全考虑）：
```typescript
partialize: (state) => ({
  gentleConfig: { ...state.gentleConfig, apiKey: '' },
  angryConfig: { ...state.angryConfig, apiKey: '' },
})
```

### 环境变量清单

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DATABASE_URL` | SQLite 数据库路径 | `sqlite+aiosqlite:///./data/double_agent.db` |
| `OPENAI_API_KEY` | OpenAI API 密钥 | `sk-...` |
| `OPENAI_BASE_URL` | OpenAI API 地址 | `https://api.openai.com` |
| `ANTHROPIC_API_KEY` | Claude API 密钥 | `sk-ant-...` |
| `ANTHROPIC_BASE_URL` | Claude API 地址 | `https://api.anthropic.com` |

---

## 动态结束判断机制

AI 自主决定对话何时结束，而不是固定轮数。

### 实现原理

#### 1. 结束判断提示词

每个角色在 `src/prompts/roles.ts` 中定义 `endingPrompt`：

```typescript
{
  endingPrompt: `请判断当前对话是否已经可以结束。

如果认为对话可以结束，请回复："[END]"
如果认为还需要继续讨论，请回复："[CONTINUE]"

只回复上述标记之一。`,
}
```

#### 2. 结束判断流程

**单 Agent 模式**：
- 从第 1 轮开始检查
- 每轮回复后调用 `checkShouldEnd()`

**双 Agent 模式**：
- 从第 2 轮开始检查（让双方都有发言机会）
- 使用温和 Agent 来判断是否结束（更保守）

#### 3. 安全上限

```typescript
private maxAutoRounds = 10;  // 最大自动轮数

while (this.currentRound < this.maxAutoRounds) {
  // 对话循环...
}
```

---

## 相关文件

| 文件 | 说明 |
|------|------|
| `backend/app/config.py` | 后端配置管理 |
| `backend/app/core/database.py` | 数据库连接 |
| `backend/app/models/session.py` | Session 数据模型 |
| `backend/app/models/round.py` | Round 数据模型 |
| `src/stores/debateStorage.ts` | 前端存储层 |
| `src/stores/agentStore.ts` | Agent 配置存储 |
| `src/utils/tokenCounter.ts` | Token 估算 |
| `src/prompts/roles.ts` | 角色定义和结束判断提示 |
