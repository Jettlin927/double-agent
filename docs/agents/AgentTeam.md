# AgentTeam 类

`AgentTeam` 是对话系统的核心协调类，负责管理单/双 Agent 对话流程、上下文压缩、动态结束判断和会话持久化。

## 位置

```
src/agents/AgentTeam.ts
```

## 架构位置

```
UI Components
     ↓
useAgentTeam Hook
     ↓
AgentTeam (此类)
     ↓
┌──────────┬──────────┐
│          │          │
▼          ▼          ▼
AgentLoop  Adapter   debateStorage
(OpenAI/Anthropic)   (后端 API)
```

## 核心职责

1. **对话流程管理**: 协调单 Agent 对话和双 Agent 辩论流程
2. **上下文管理**: Token 估算、自动/手动压缩
3. **动态结束判断**: AI 自主决定何时结束对话
4. **状态持久化**: 调用后端 API 保存会话和回合
5. **安全限制**: 最大 10 轮防止无限循环

## 构造函数

```typescript
constructor(
  gentleConfig: AgentConfig,
  angryConfig: AgentConfig
)
```

**参数**:
- `gentleConfig`: 温和派 Agent 配置
- `angryConfig`: 暴躁派 Agent 配置

## 属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `gentleConfig` | `AgentConfig` | 温和派配置 |
| `angryConfig` | `AgentConfig` | 暴躁派配置 |
| `debateHistory` | `DebateRound[]` | 辩论历史记录 |
| `currentRound` | `number` | 当前轮数 |
| `currentSessionId` | `string \| null` | 当前会话 ID |
| `fullMessageHistory` | `Message[]` | 完整消息历史 |
| `mode` | `AgentMode` | 运行模式 ('single' \| 'double') |
| `maxAutoRounds` | `number` | 最大自动轮数（默认 10） |
| `shouldStop` | `boolean` | 停止标志 |

## 主要方法

### 运行控制

#### `runSingle()`

单 Agent 对话模式（动态结束）。

```typescript
async runSingle(
  userQuestion: string,
  onChunk: StreamCallback,
  onRoundComplete?: RoundCompleteCallback,
  signal?: AbortSignal
): Promise<void>
```

**流程**:
1. 重置状态
2. 创建新会话（后端 API）
3. 循环直到达到最大轮数或被停止:
   - 检查并自动压缩上下文
   - 生成流式回复
   - 保存消息到历史
   - 第 1 轮后开始检查是否结束
   - 如果 `shouldEnd` 为 true，退出循环
4. 回调通知完成

#### `runDebate()`

双 Agent 辩论模式。

```typescript
async runDebate(
  userQuestion: string,
  onChunk: StreamCallback,
  onRoundComplete?: RoundCompleteCallback,
  signal?: AbortSignal
): Promise<void>
```

**流程**:
1. 重置状态
2. 创建新会话
3. 循环直到达到最大轮数或被停止:
   - 检查并自动压缩上下文
   - Gentle Agent 发言
   - Angry Agent 回应（基于 Gentle 的回复）
   - 保存本轮记录到后端
   - 第 2 轮后开始检查是否结束
4. 回调通知完成

#### `stop()`

停止当前对话。

```typescript
stop(): void
```

设置 `shouldStop = true`，下一轮循环会检测并退出。

### 上下文管理

#### `getContextStats()`

获取上下文统计信息。

```typescript
getContextStats(): ContextManagerState
```

返回:
```typescript
{
  stats: ContextStats;           // 统计信息
  gentleStats: ContextStats;     // 温和派统计
  angryStats: ContextStats;      // 暴躁派统计
  isCompacted: boolean;          // 是否已压缩
}
```

#### `compactContext()`

手动压缩上下文。

```typescript
compactContext(): boolean
```

返回是否实际执行了压缩。

#### `loadSession()`

加载历史会话并恢复上下文。

```typescript
loadSession(session: DebateSession): Message[]
```

从会话的 rounds 重建消息历史。

### 配置更新

#### `updateConfigs()`

更新 Agent 配置。

```typescript
updateConfigs(
  gentleConfig: AgentConfig,
  angryConfig: AgentConfig
): void
```

#### `setMaxAutoRounds()`

设置最大自动轮数。

```typescript
setMaxAutoRounds(max: number): void
```

#### `setContextUpdateCallback()`

设置上下文更新回调。

```typescript
setContextUpdateCallback(callback: ContextUpdateCallback): void
```

## 私有方法

### 流式响应处理

```typescript
private async streamResponse(
  config: AgentConfig,
  messages: Message[],
  onChunk: StreamCallback,
  signal?: AbortSignal
): Promise<string>
```

1. 根据 `apiType` 选择适配器（OpenAI/Anthropic）
2. 处理 baseURL（避免 `/v1` 重复）
3. 发送流式请求
4. 逐行解析 SSE 数据
5. 通过 `onChunk` 回调更新 UI

### 结束判断

```typescript
private async checkShouldEnd(
  config: AgentConfig,
  conversationHistory: Message[],
  isSingleMode: boolean,
  signal?: AbortSignal
): Promise<EndingCheckResult>
```

**逻辑**:
1. 拼接结束判断提示词
2. 使用 `temperature=0` 确保确定性输出
3. 解析响应中的 `[END]` / `[CONTINUE]` 标记
4. 如果没有明确标记，根据关键词推断
5. 出错时默认继续（安全策略）

**结束判断提示词**:
```
请判断当前对话是否已经可以结束。
如果认为对话可以结束，请回复："[END]"
如果认为还需要继续讨论，请回复："[CONTINUE]"
只回复上述标记之一。
```

### 适配器选择

```typescript
private getAdapter(apiType: string): APIAdapter
```

- `'anthropic'` → `AnthropicAdapter`
- 其他 → `OpenAIAdapter`

## 回调类型

### `StreamCallback`

```typescript
type StreamCallback = (
  agentId: string,
  chunk: StreamChunk
) => void
```

每收到一个内容块时调用，用于更新 UI。

### `RoundCompleteCallback`

```typescript
type RoundCompleteCallback = (
  round: number,
  shouldEnd: boolean
) => void
```

每轮完成时调用，通知是否应结束对话。

### `ContextUpdateCallback`

```typescript
type ContextUpdateCallback = (
  stats: ContextStats,
  gentleConfig: AgentConfig,
  angryConfig: AgentConfig
) => void
```

上下文统计更新时调用。

## 使用示例

```typescript
import { AgentTeam } from '@/agents/AgentTeam';

const agentTeam = new AgentTeam(gentleConfig, angryConfig);

// 设置上下文更新回调
agentTeam.setContextUpdateCallback((stats, gentle, angry) => {
  console.log(`Token 使用率: ${stats.usagePercentage.toFixed(1)}%`);
});

// 运行双 Agent 辩论
await agentTeam.runDebate(
  '人工智能会取代人类工作吗？',
  (agentId, chunk) => {
    // 更新 UI
    console.log(`${agentId}: ${chunk.content}`);
  },
  (round, shouldEnd) => {
    console.log(`第 ${round} 轮完成，${shouldEnd ? '结束' : '继续'}`);
  }
);

// 手动停止
agentTeam.stop();

// 加载历史会话
const session = await debateStorage.getSession(sessionId);
agentTeam.loadSession(session);
```

## 双 Agent 辩论流程图

```
开始
  │
  ▼
重置状态
  │
  ▼
创建会话 (后端 API)
  │
  ▼
┌─────────────────┐
│ 循环 (max 10 轮) │◄──────┐
└────────┬────────┘       │
         │                │
         ▼                │
    检查 shouldStop       │
         │                │
         ▼                │
    currentRound++        │
         │                │
         ▼                │
    自动压缩上下文?       │
         │                │
         ▼                │
    Gentle Agent 发言     │
         │ (流式)         │
         ▼                │
    检查 shouldStop       │
         │                │
         ▼                │
    Angry Agent 回应      │
         │ (流式)         │
         ▼                │
    保存回合到后端        │
         │                │
         ▼                │
    round >= 2? ──否──────┘
         │
         是
         ▼
    检查是否结束
         │
         ▼
    shouldEnd? ──否───────┐
         │                │
         是                │
         │                │
         ▼                │
    退出循环              │
         │                │
         ▼                │
    完成                  │
```

## 相关文件

| 文件 | 说明 |
|------|------|
| `AgentLoop.ts` | 新一代 Agent 循环实现 |
| `OpenAIAdapter.ts` | OpenAI 格式适配器 |
| `AnthropicAdapter.ts` | Claude 原生适配器 |
| `debateStorage.ts` | 后端存储 API 调用 |
| `tokenCounter.ts` | Token 估算和压缩 |
