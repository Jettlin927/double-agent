# 后端概述

Double Agent 后端采用 Python + FastAPI + SQLite 构建，提供 REST API 和 Server-Sent Events (SSE) 流式响应。

## 技术栈

- **框架**: FastAPI + Python 3.11+
- **数据库**: SQLite + SQLAlchemy 2.0 (异步)
- **ORM**: SQLAlchemy AsyncSession
- **API 文档**: FastAPI 自动生成 (/docs)
- **部署**: Uvicorn ASGI 服务器

## 目录结构

```
backend/
├── app/
│   ├── main.py              # FastAPI 应用入口
│   ├── config.py            # 应用配置 (Pydantic Settings)
│   ├── core/
│   │   └── database.py      # 数据库连接和会话管理
│   ├── models/              # SQLAlchemy 数据库模型
│   │   ├── session.py       # Session 模型
│   │   ├── round.py         # Round 模型
│   │   └── message.py       # Message 模型 (AgentLoop)
│   ├── routers/             # API 路由
│   │   ├── sessions.py      # 会话管理 API
│   │   ├── debate.py        # 辩论流式 API (SSE)
│   │   ├── config.py        # 配置 API
│   │   └── messages.py      # 消息/迭代 API
│   ├── schemas/             # Pydantic 模型
│   │   ├── session.py       # 会话相关 Schema
│   │   ├── agent.py         # Agent 配置 Schema
│   │   └── message.py       # 消息相关 Schema
│   └── services/            # 业务逻辑
│       ├── agent_team.py    # Agent 协调逻辑
│       ├── llm_adapter.py   # LLM 适配器
│       └── tool_executor.py # 工具执行器
└── data/                    # SQLite 数据库文件
    └── double_agent.db
```

## 启动后端

```bash
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt

# 启动开发服务器
uvicorn app.main:app --reload --port 8000

# 或生产环境
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## 核心模块

### 1. 应用入口 (main.py)

```python
from fastapi import FastAPI
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时初始化数据库
    await init_db()
    yield
    # 关闭时释放资源
    await close_db()

app = FastAPI(
    title="Double Agent API",
    description="双智能体对话/辩论系统后端 API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(sessions.router, prefix="/api")
app.include_router(debate.router, prefix="/api")
```

### 2. 数据库配置 (core/database.py)

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = "sqlite+aiosqlite:///./data/double_agent.db"

engine = create_async_engine(DATABASE_URL, echo=True)
async_session_maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

async def get_db() -> AsyncSession:
    async with async_session_maker() as session:
        yield session

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
```

### 3. 数据模型

#### Session 模型

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

    # 关系
    rounds: Mapped[list["Round"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
```

#### Round 模型

```python
class Round(Base):
    __tablename__ = "rounds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id"))
    round_number: Mapped[int] = mapped_column(Integer)
    gentle_content: Mapped[str] = mapped_column(Text)
    gentle_reasoning: Mapped[str | None] = mapped_column(Text)
    gentle_agent_id: Mapped[str] = mapped_column(String)
    angry_content: Mapped[str] = mapped_column(Text)
    angry_reasoning: Mapped[str | None] = mapped_column(Text)
    angry_agent_id: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime)

    session: Mapped["Session"] = relationship(back_populates="rounds")
```

## API 路由

### 会话管理 (/api/sessions)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/sessions` | GET | 获取所有会话 |
| `/sessions` | POST | 创建新会话 |
| `/sessions/{id}` | GET | 获取会话详情 |
| `/sessions/{id}` | PATCH | 更新会话 |
| `/sessions/{id}` | DELETE | 删除会话 |
| `/sessions/{id}/export` | POST | 导出会话为 JSONL |
| `/sessions/import` | POST | 导入会话 |

### 辩论流式 (/api/debate)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/debate/stream` | POST | 流式辩论 (SSE) |

### 配置 (/api/config)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/config/models` | GET | 获取模型配置 |
| `/config/roles` | GET | 获取角色配置 |

### 消息/迭代 (/api/messages)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/messages/iterations` | POST | 创建迭代记录 |
| `/messages/iterations/{id}/messages` | POST | 保存消息 |
| `/messages/iterations/{id}/status` | PATCH | 更新迭代状态 |

## 配置管理 (config.py)

```python
from pydantic_settings import BaseSettings

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
        extra = "ignore"

settings = Settings()
```

## 服务层 (services/)

### agent_team.py

业务逻辑核心：
- 协调 Agent 对话流程
- 调用 LLM API
- 处理工具执行
- 管理对话状态

### llm_adapter.py

LLM API 调用适配：
- 支持 OpenAI 格式
- 支持 Anthropic 格式
- 流式响应处理

### tool_executor.py

工具执行服务：
- 执行注册的工具
- 管理工具上下文
- 返回执行结果

## 开发注意事项

### 数据库迁移

项目使用 SQLAlchemy 自动创建表结构：

```python
# 启动时自动创建
await init_db()
```

**注意**: 生产环境建议使用 Alembic 进行数据库迁移。

### 异步操作

所有数据库操作都是异步的：

```python
@app.get("/api/sessions")
async def get_sessions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Session))
    return result.scalars().all()
```

### 错误处理

```python
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={"error": str(exc)}
    )
```

## 相关文件

| 文件 | 说明 |
|------|------|
| `app/main.py` | FastAPI 入口 |
| `app/config.py` | 配置管理 |
| `app/core/database.py` | 数据库连接 |
| `app/models/*.py` | 数据模型 |
| `app/routers/*.py` | API 路由 |
| `app/services/*.py` | 业务逻辑 |
