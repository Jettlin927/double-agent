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
│   ├── ConfigModal.tsx    # 配置弹窗（支持角色和模型选择）
│   ├── Header.tsx         # 顶部导航
│   └── UserInput.tsx      # 用户输入框
├── hooks/                 # React Hooks
│   └── useAgentTeam.ts    # Agent团队状态管理Hook
├── prompts/               # Prompt和模型预设
│   ├── roles.ts           # 角色定义（温和/暴躁各4种角色）
│   ├── models.ts          # 模型预设（OpenAI/Anthropic/DeepSeek/通义/Kimi/GLM）
│   └── index.ts           # 导出
├── stores/                # 状态存储
│   ├── agentStore.ts      # Agent配置存储（Zustand）
│   ├── debateStorage.ts   # 对话历史存储（localStorage + JSONL）
│   └── envConfig.ts       # .env配置持久化
├── tools/                 # 工具系统
│   ├── types.ts           # Tool类型定义
│   ├── registry.ts        # Tool注册表和内置工具
│   ├── parser.ts          # Tool调用解析器
│   └── index.ts           # 导出
├── utils/                 # 工具函数
│   └── tokenCounter.ts    # Token计数和上下文压缩
├── types/                 # TypeScript类型定义
│   └── index.ts           # 核心类型定义
└── App.tsx                # 主应用组件
```

## 核心模块设计

### 1. Agent系统 (`src/agents/`)

#### AgentTeam 类 (`AgentTeam.ts`)
核心协调器，管理双Agent对话流程，支持动态结束判断：

```typescript
class AgentTeam {
  // 模式支持
  mode: 'single' | 'double'
  maxAutoRounds: number          // 安全上限（默认10轮）

  // 核心方法
  runSingle(question, onChunk, onRoundComplete, signal)     // 单Agent模式
  runDebate(question, onChunk, onRoundComplete, signal)     // 双Agent辩论模式
  loadSession(session)                     // 加载历史会话

  // 动态结束判断
  checkShouldEnd(config, history, isSingleMode): Promise<{shouldEnd, reason}>
}
```

**动态结束机制**：
1. 每轮对话后，发送结束判断请求给Agent
2. Agent 根据对话内容判断是否应该结束（回复 `[END]` 或 `[CONTINUE]`）
3. 如果 `[END]`，则停止对话；如果 `[CONTINUE]`，继续下一轮
4. 设置 `maxAutoRounds` 安全上限（默认10轮）防止无限循环

**上下文构建策略**：
- 每轮对话都将完整历史发送给LLM
- 使用用户消息作为引导（"另一位助手说：xxx"）
- 单Agent模式下直接对话，无辩论引导

#### API适配器
- **OpenAIAdapter**: 支持GPT、DeepSeek、通义千问等OpenAI格式API
- **AnthropicAdapter**: 支持Claude原生API格式

### 2. 上下文管理 (`src/utils/tokenCounter.ts`)

Token计数和上下文压缩工具，用于管理LLM上下文窗口：

```typescript
// Token估算
estimateTokens(text: string): number
estimateMessagesTokens(messages): number

// 上下文限制查询
getContextLimit(model: string): number
CONTEXT_LIMITS: Record<string, number>  // 各模型上下文限制

// 上下文统计
calculateContextStats(messages, model): ContextStats

// 上下文压缩
compactMessages(messages, keepRecent = 4): messages
shouldCompact(stats, threshold = 80): boolean
```

**压缩策略**：
- 保留系统消息和最近 N 条消息
- 中间消息生成摘要替换
- 可配置压缩阈值（默认80%）

### 3. Tool系统 (`src/tools/`)

Agent可调用工具的基础架构，详见 [tools.md](./tools.md)。

```typescript
// Tool定义
interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
}

// Tool调用
interface ToolCall {
  id: string;
  tool: string;
  arguments: Record<string, unknown>;
  agentId: string;
}

// Tool注册表
class ToolRegistry {
  register(definition, handler)
  execute(toolName, args, context): Promise<ToolResult>
  generateToolsPrompt(): string
}
```

**内置工具**：
- `web_search` - 网络搜索
- `execute_code` - 代码执行
- `ask_other_agent` - 询问另一个Agent
- `summarize` - 对话总结
- `fact_check` - 事实核查
- `calculate` - 精确计算
- `memory` - 信息存储/检索

### 4. .env配置持久化 (`src/stores/envConfig.ts` + `vite-env-save-plugin.ts`)

支持通过 `.env.local` 文件持久化Agent配置：

```typescript
// 从环境变量加载配置
loadEnvConfig(): { gentle, angry }
hasEnvConfig(): boolean

// 导出配置为.env格式
exportToEnv(gentleConfig, angryConfig): string
downloadEnvFile(content, filename)

// 保存到服务器
saveEnvToServer(gentleConfig, angryConfig): Promise<{ success, message }>

// 合并配置（env优先级高）
mergeWithEnvConfig(baseConfig, personality): AgentConfig
```

**Vite插件** (`vite-env-save-plugin.ts`)：
- 开发服务器提供 `/api/save-env` 端点
- 接收POST请求将配置写入 `.env.local`

### 5. Prompt系统 (`src/prompts/`)

#### 角色定义 (`roles.ts`)
预定义多种角色人格，每个角色包含系统提示词和结束判断提示词：

```typescript
interface RoleDefinition {
  id: string;
  name: string;
  personality: 'gentle' | 'angry';
  description: string;
  systemPrompt: string;      // 正常对话使用的提示词
  endingPrompt?: string;     // 判断对话是否应该结束的提示词
}

// 温和型角色
- gentle-default: 温和助手（默认）
- gentle-therapist: 心理倾听者
- gentle-teacher: 循循善诱的老师
- gentle-friend: 知心好友

// 暴躁型角色
- angry-default: 暴躁助手（默认）
- angry-critic: 毒舌评论家
- angry-debate: 辩论对手
- angry-mentor: 严师

// 结束判断标记
- "[END]" - 对话应该结束
- "[CONTINUE]" - 继续对话
```

#### 模型预设 (`models.ts`)
预配置主流AI服务商的模型参数：

```typescript
interface ModelPreset {
  id: string;
  name: string;
  provider: string;      // OpenAI/Anthropic/DeepSeek/阿里云/智谱等
  apiType: 'openai' | 'anthropic';
  baseURL: string;
  model: string;
  temperature: number;
}

// 支持的提供商
- OpenAI: GPT-4o, GPT-4o Mini, GPT-4 Turbo
- Anthropic: Claude 3.5 Sonnet, Claude 3 Opus/Sonnet
- DeepSeek: DeepSeek Chat, DeepSeek Reasoner
- 阿里云: 通义千问 Max/Plus/Turbo
- Moonshot: Kimi, Kimi K1
- 智谱AI: GLM-4, GLM-4 Flash
```

**使用方式**：在配置弹窗中选择角色和模型，自动填充对应的 systemPrompt 和 API 参数。高级设置可手动调整细节。

### 6. 状态管理

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

### 7. JSONL格式规范

每行一个JSON对象，第一行为metadata，后续为round数据：

```jsonl
{"type":"metadata","sessionId":"...","title":"...","userQuestion":"...","createdAt":1234567890,"maxRounds":3,"mode":"double"}
{"type":"round","round":1,"gentle":{"id":"...","content":"...","timestamp":1234567890},"angry":{"id":"...","content":"...","timestamp":1234567890}}
```

**字段说明**：
- `mode`: `"single"` 或 `"double"`，标识对话模式
- `gentle`: 温和Agent的回复（单Agent模式下angry可为空）
- `angry`: 暴躁Agent的回复

### 8. UI组件架构

#### 模式切换 (`Sidebar.tsx`)
侧边栏提供模式切换按钮：
- 新对话按钮：清空当前上下文
- 模式切换按钮：单Agent ↔ 双Agent
- 当前模式指示器

#### 布局适配 (`App.tsx`)
根据模式动态调整布局：
- **单Agent**: 单个面板居中显示（最大宽度768px）
- **双Agent**: 左右50/50分栏

### 9. 数据流

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

### 10. 会话恢复

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
| `src/stores/envConfig.ts` | .env配置管理 | `loadEnvConfig`, `saveEnvToServer` |
| `src/hooks/useAgentTeam.ts` | React状态集成 | `useAgentTeam` Hook |
| `src/types/index.ts` | 类型定义 | `DebateSession`, `AgentMode` |
| `src/components/Sidebar.tsx` | 会话管理UI | `Sidebar` 组件 |
| `src/components/ConfigModal.tsx` | 配置弹窗 | 角色和模型选择UI |
| `src/prompts/roles.ts` | 角色定义 | `GENTLE_ROLES`, `ANGRY_ROLES` |
| `src/prompts/models.ts` | 模型预设 | `ALL_MODEL_PRESETS` |
| `src/tools/*.ts` | 工具系统 | `ToolRegistry`, `toolRegistry` |
| `src/utils/tokenCounter.ts` | Token计数 | `estimateTokens`, `compactMessages` |
| `vite-env-save-plugin.ts` | Vite插件 | `envSavePlugin` |
| `src/App.tsx` | 主应用 | 布局与模式切换逻辑 |

## 扩展点

1. **添加新Agent模式**：修改 `AgentMode` 类型，在 `AgentTeam` 添加对应方法
2. **支持新API格式**：实现 `APIAdapter` 接口
3. **自定义持久化**：替换 `DebateStorage` 中的localStorage为后端API
4. **添加导出格式**：在 `DebateStorage` 中添加新方法（如exportToMarkdown）
5. **添加新角色**：在 `src/prompts/roles.ts` 中添加新的 `RoleDefinition`
6. **添加新模型**：在 `src/prompts/models.ts` 中添加新的 `ModelPreset`
7. **自定义角色**：未来可支持用户自定义角色并保存到localStorage
8. **添加新工具**：在 `src/tools/registry.ts` 中定义 `ToolDefinition` 和 `ToolHandler`，调用 `toolRegistry.register()` 注册
9. **自定义上下文压缩策略**：修改 `src/utils/tokenCounter.ts` 中的 `compactMessages` 函数实现自定义压缩逻辑
