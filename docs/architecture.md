# 双Agent对话系统 - 架构设计文档

## 项目概述

双Agent对话系统是一个支持两种对话模式的Web应用：
- **双Agent辩论模式**：两个性格迥异的AI Agent（温和 vs 暴躁）进行多轮对话辩论
- **单Agent对话模式**：单个Agent进行常规对话

## 技术栈

- **前端框架**: React 19 + TypeScript
- **构建工具**: Vite 8
- **样式**: TailwindCSS v4 + PostCSS
- **状态管理**: Zustand（持久化存储）
- **图标**: Lucide React
- **流式API**: Fetch API + ReadableStream

## 目录结构

```
src/
├── agents/                 # Agent核心逻辑
│   ├── AgentTeam.ts       # Agent团队协调器（核心）
│   ├── AgentConfig.ts     # Agent配置工具
│   ├── OpenAIAdapter.ts   # OpenAI格式API适配器
│   └── AnthropicAdapter.ts # Anthropic原生API适配器
├── components/            # UI组件
│   ├── Sidebar.tsx        # 侧边栏（会话列表+模式切换）
│   ├── AgentPanel.tsx     # Agent对话面板
│   ├── ConfigModal.tsx    # 配置弹窗
│   ├── Header.tsx         # 顶部导航
│   └── UserInput.tsx      # 用户输入框
├── hooks/                 # React Hooks
│   └── useAgentTeam.ts    # Agent团队状态管理Hook
├── stores/                # 状态存储
│   ├── agentStore.ts      # Agent配置存储（Zustand）
│   └── debateStorage.ts   # 对话历史存储（localStorage + JSONL）
├── types/                 # TypeScript类型定义
│   └── index.ts           # 核心类型定义
└── App.tsx                # 主应用组件
```

## 核心模块设计

### 1. Agent系统 (`src/agents/`)

#### AgentTeam 类 (`AgentTeam.ts`)
核心协调器，管理双Agent对话流程：

```typescript
class AgentTeam {
  // 模式支持
  mode: 'single' | 'double'

  // 核心方法
  runSingle(question, onChunk, signal)     // 单Agent模式
  runDebate(question, onChunk, signal)     // 双Agent辩论模式
  loadSession(session)                     // 加载历史会话
  continueDebate(rounds, onChunk, signal)  // 继续辩论

  // 上下文管理
  fullMessageHistory: Message[]  // 累积完整对话历史
}
```

**上下文构建策略**：
- 每轮对话都将完整历史发送给LLM
- 使用用户消息作为引导（"另一位助手说：xxx"）
- 单Agent模式下直接对话，无辩论引导

#### API适配器
- **OpenAIAdapter**: 支持GPT、DeepSeek、通义千问等OpenAI格式API
- **AnthropicAdapter**: 支持Claude原生API格式

### 2. 状态管理

#### Agent配置存储 (`src/stores/agentStore.ts`)
使用Zustand + persist中间件：
```typescript
interface AgentState {
  gentleConfig: AgentConfig   // 温和Agent配置
  angryConfig: AgentConfig    // 暴躁Agent配置
  updateConfig(personality, updates)
  resetConfigs()
}
```

#### 对话历史存储 (`src/stores/debateStorage.ts`)
基于localStorage的持久化存储：
```typescript
class DebateStorage {
  createSession(question, gentleConfig, angryConfig, mode)
  addRound(sessionId, round)
  exportToJSONL(sessionId): string     // 导出JSONL
  importFromJSONL(content): Session    // 导入JSONL
  getAllSessions(): Session[]
  deleteSession(sessionId)
}
```

### 3. JSONL格式规范

每行一个JSON对象，第一行为metadata，后续为round数据：

```jsonl
{"type":"metadata","sessionId":"...","title":"...","userQuestion":"...","createdAt":1234567890,"maxRounds":3,"mode":"double"}
{"type":"round","round":1,"gentle":{"id":"...","content":"...","timestamp":1234567890},"angry":{"id":"...","content":"...","timestamp":1234567890}}
```

**字段说明**：
- `mode`: `"single"` 或 `"double"`，标识对话模式
- `gentle`: 温和Agent的回复（单Agent模式下angry可为空）
- `angry`: 暴躁Agent的回复

### 4. UI组件架构

#### 模式切换 (`Sidebar.tsx`)
侧边栏提供模式切换按钮：
- 新对话按钮：清空当前上下文
- 模式切换按钮：单Agent ↔ 双Agent
- 当前模式指示器

#### 布局适配 (`App.tsx`)
根据模式动态调整布局：
- **单Agent**: 单个面板居中显示（最大宽度768px）
- **双Agent**: 左右50/50分栏

### 5. 数据流

```
用户输入 → useAgentTeam.runDebate()
                ↓
         AgentTeam.runSingle() / runDebate()
                ↓
         API调用 (OpenAI/Anthropic Adapter)
                ↓
         流式响应 → onChunk回调
                ↓
         UI更新 (gentleStream/angryStream)
                ↓
         保存到DebateStorage (localStorage)
```

### 6. 会话恢复

加载历史会话时：
1. 从localStorage读取session数据
2. 调用 `AgentTeam.loadSession(session)`
3. 重建 `fullMessageHistory` 数组
4. 根据 `session.mode` 设置当前模式
5. UI显示历史消息

## 关键文件引用

| 文件 | 用途 | 关键导出 |
|------|------|----------|
| `src/agents/AgentTeam.ts` | Agent协调核心 | `AgentTeam` 类 |
| `src/stores/debateStorage.ts` | 持久化存储 | `debateStorage` 实例 |
| `src/hooks/useAgentTeam.ts` | React状态集成 | `useAgentTeam` Hook |
| `src/types/index.ts` | 类型定义 | `DebateSession`, `AgentMode` |
| `src/components/Sidebar.tsx` | 会话管理UI | `Sidebar` 组件 |
| `src/App.tsx` | 主应用 | 布局与模式切换逻辑 |

## 扩展点

1. **添加新Agent模式**：修改 `AgentMode` 类型，在 `AgentTeam` 添加对应方法
2. **支持新API格式**：实现 `APIAdapter` 接口
3. **自定义持久化**：替换 `DebateStorage` 中的localStorage为后端API
4. **添加导出格式**：在 `DebateStorage` 中添加新方法（如exportToMarkdown）
