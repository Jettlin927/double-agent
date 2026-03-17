# AgentLoop 类

`AgentLoop` 是参考 OpenAI Codex CLI 设计的新一代 Agent 循环实现，支持多轮工具调用、统一消息类型系统和流式事件处理。

## 位置

```
src/agents/AgentLoop.ts
```

## 设计理念

参考 OpenAI Codex CLI 的 Agent Loop 架构：

- **统一消息类型系统**: 使用 `InputItem`/`OutputItem` 表示所有内容
- **多轮工具调用循环**: Agent 可以多次调用工具直到完成任务
- **流式事件处理**: 实时推送推理、内容、工具调用等事件
- **上下文自动压缩**: 超过阈值自动压缩历史
- **后端持久化集成**: 自动保存到后端数据库

## 类型系统

### InputItem（输入）

```typescript
type InputItem =
  | MessageItem          // 消息
  | ReasoningItem        // 推理
  | FunctionCallItem     // 函数调用
  | FunctionCallOutputItem  // 函数调用输出
  | CompactionItem;      // 压缩记录
```

### OutputItem（输出）

```typescript
type OutputItem =
  | MessageItem          // 消息
  | ReasoningItem        // 推理
  | FunctionCallItem;    // 函数调用
```

### MessageItem（消息项目）

```typescript
interface MessageItem {
  type: 'message';
  role: MessageRole;     // 'system' | 'developer' | 'user' | 'assistant'
  content: ContentPart[];
  id?: string;
  agentId?: string;
  timestamp?: number;
}

type ContentPart =
  | { type: 'input_text'; text: string }
  | { type: 'output_text'; text: string }
  | { type: 'input_image'; image_url: string }
  | { type: 'input_file'; file_name: string; file_content: string };
```

### ReasoningItem（推理项目）

```typescript
interface ReasoningItem {
  type: 'reasoning';
  summary: SummaryPart[];
  encrypted_content?: string;  // 加密的完整推理内容
}
```

### FunctionCallItem（函数调用）

```typescript
interface FunctionCallItem {
  type: 'function_call';
  name: string;          // 函数名
  arguments: string;     // JSON 字符串
  call_id: string;       // 调用 ID
}
```

## 构造函数

```typescript
constructor(options: AgentLoopOptions)

interface AgentLoopOptions {
  config: AgentConfig;           // Agent 配置
  sessionId: string;             // 会话 ID
  iterationNumber: number;       // 迭代序号
  maxIterations?: number;        // 最大迭代数（默认 10）
  maxTokens?: number;            // Token 上限（默认 8000）
  enableStorage?: boolean;       // 是否启用后端存储（默认 true）
  tools?: ToolDefinition[];      // 可用工具列表
}
```

## 核心方法

### `run()`

运行 Agent Loop。

```typescript
async run(initialInput: InputItem[]): Promise<AgentLoopResult>

interface AgentLoopResult {
  finalMessage: MessageItem;         // 最终消息
  iterations: AgentLoopIteration[];  // 迭代历史
  totalDuration: number;             // 总耗时
  toolCallsCount: number;            // 工具调用次数
  wasCompacted: boolean;             // 是否压缩过上下文
}
```

**执行流程**:

```
开始
  │
  ▼
初始化状态
  │
  ▼
创建迭代记录（后端）
  │
  ▼
┌─────────────────┐
│ 迭代循环        │◄───────────────┐
└────────┬────────┘                │
         │                         │
         ▼                         │
    设置状态: thinking             │
         │                         │
         ▼                         │
    发送: response.created         │
         │                         │
         ▼                         │
    调用模型（流式）               │
         │                         │
         ▼                         │
    解析输出项                     │
         │                         │
         ▼                         │
    有工具调用?                    │
         │                        │
    是 ──┼──► 设置状态: executing_tool
         │        │              │
         │        ▼              │
         │    执行工具调用        │
         │        │              │
         │        ▼              │
         │    保存工具结果        │
         │        │              │
         └───────►│◄─────────────┘
                  │
    否 ───────────┘
                  │
                  ▼
           设置状态: completed
                  │
                  ▼
           返回结果
```

### `abort()`

中止循环。

```typescript
abort(): void
```

### `getStats()`

获取统计信息。

```typescript
getStats(): ContextStats
```

### 回调设置

```typescript
setEventCallback(callback: AgentLoopEventCallback): void
setStatusCallback(callback: AgentLoopStatusCallback): void
```

## 流式事件类型

```typescript
type StreamEventType =
  | 'response.created'                    // 响应创建
  | 'response.in_progress'                // 响应进行中
  | 'response.reasoning_summary_text.delta'  // 推理内容增量
  | 'response.reasoning_summary_text.done'   // 推理完成
  | 'response.output_item.added'          // 输出项添加
  | 'response.output_text.delta'          // 文本内容增量
  | 'response.output_text.done'           // 文本完成
  | 'response.function_call_arguments.delta' // 工具参数增量
  | 'response.function_call_arguments.done'  // 工具参数完成
  | 'response.completed'                  // 响应完成
  | 'response.error';                     // 错误

interface StreamEvent {
  type: StreamEventType;
  delta?: string;        // 增量内容
  name?: string;         // 工具名
  call_id?: string;      // 调用 ID
  error?: string;        // 错误信息
}
```

## 状态机

```
         ┌─────────┐
         │  idle   │
         └────┬────┘
              │ run()
              ▼
      ┌───────────────┐
      │   thinking    │◄──────┐
      └───────┬───────┘       │
              │               │
      有工具调用?              │
              │               │
    是 ───────┼──────► executing_tool
              │               │
              │               │
              否              │
              │               │
              ▼               │
      ┌───────────────┐       │
      │  completed    │       │
      └───────────────┘       │
                              │
              ┌───────────────┘
              │
              ▼
      ┌───────────────┐
      │     error     │
      └───────────────┘
```

## 工具调用流程

```
模型输出:
{
  type: 'function_call',
  name: 'web_search',
  arguments: '{"query": "TypeScript 最新版本"}',
  call_id: 'call_123'
}

        │
        ▼
┌─────────────────┐
│   executeTool   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  toolRegistry   │
│    execute()    │
└────────┬────────┘
         │
         ▼
    web_search
    handler
         │
         ▼
  返回 ToolResult
         │
         ▼
创建 FunctionCallOutputItem:
{
  type: 'function_call_output',
  call_id: 'call_123',
  output: '{"results": [...]}'
}
         │
         ▼
    添加到 input
         │
         ▼
   继续下一轮迭代
```

## 上下文压缩

### 压缩条件

```typescript
private shouldCompactContext(): boolean {
  const stats = this.getStats();
  return stats.usagePercentage > 80;  // 超过 80% 触发
}
```

### 压缩策略

```typescript
private async compactContext(): Promise<void> {
  const compacted: InputItem[] = [];
  let messageCount = 0;

  for (let i = this.input.length - 1; i >= 0; i--) {
    const item = this.input[i];

    // 保留 compaction 项目
    if (item.type === 'compaction') {
      compacted.unshift(item);
      continue;
    }

    // 保留最近的消息（限制数量）
    if (messageCount < 10) {
      compacted.unshift(item);
      if (item.type === 'message') {
        messageCount++;
      }
    }
  }

  this.input = compacted;
  this.wasCompacted = true;
}
```

策略说明:
1. 保留已有的 `compaction` 项目
2. 保留最近 10 条消息
3. 丢弃更早的消息

## 后端集成

### 迭代记录

```typescript
private async createIterationRecord(): Promise<void> {
  await fetch('/api/messages/iterations', {
    method: 'POST',
    body: JSON.stringify({
      session_id: this.sessionId,
      agent_id: this.config.id,
      agent_name: this.config.name,
      iteration_number: this.iterationNumber,
    }),
  });
}
```

### 消息保存

```typescript
private async saveMessage(item: InputItem): Promise<void> {
  await fetch(`/api/messages/iterations/${this.iterationNumber}/messages`, {
    method: 'POST',
    body: JSON.stringify(this.inputItemToMessageCreate(item)),
  });
}
```

### 完成记录

```typescript
private async completeIterationRecord(duration: number): Promise<void> {
  await fetch(`/api/messages/iterations/${this.iterationNumber}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'completed',
      duration_ms: duration,
    }),
  });
}
```

## 使用示例

```typescript
import { AgentLoop } from '@/agents/AgentLoop';
import { toolRegistry } from '@/tools';

// 创建 AgentLoop 实例
const agentLoop = new AgentLoop({
  config: agentConfig,
  sessionId: 'session-123',
  iterationNumber: 1,
  maxIterations: 10,
  tools: toolRegistry.getAllTools(),
});

// 设置事件回调
agentLoop.setEventCallback((event) => {
  switch (event.type) {
    case 'response.output_text.delta':
      console.log('内容:', event.delta);
      break;
    case 'response.reasoning_summary_text.delta':
      console.log('推理:', event.delta);
      break;
    case 'response.function_call_arguments.delta':
      console.log('工具参数:', event.delta);
      break;
  }
});

// 设置状态回调
agentLoop.setStatusCallback((status) => {
  console.log('状态:', status);
  // idle | thinking | executing_tool | completed | error
});

// 运行
const result = await agentLoop.run([
  { type: 'message', role: 'user', content: [{ type: 'input_text', text: '你好' }] },
]);

console.log('最终结果:', result.finalMessage);
console.log('工具调用次数:', result.toolCallsCount);
console.log('总耗时:', result.totalDuration, 'ms');
```

## 与 AgentTeam 的关系

```
AgentTeam (高层协调)
        │
        │ 可能包含多个
        ▼
┌─────────────────┐
│   AgentLoop     │  处理单轮复杂任务
│  (多轮工具调用)  │
└─────────────────┘
        │
        ▼
   API Adapter
        │
        ▼
   LLM Provider
```

**AgentTeam** 负责:
- 管理多个 Agent 的协作
- 处理回合逻辑
- 动态结束判断

**AgentLoop** 负责:
- 单个 Agent 的复杂任务处理
- 多轮工具调用
- 细粒度的流式事件

## 相关文件

| 文件 | 说明 |
|------|------|
| `AgentTeam.ts` | 高层协调类 |
| `types/index.ts` | 类型定义 |
| `types/helpers.ts` | 类型辅助函数 |
| `tools/registry.ts` | 工具注册中心 |
| `tools/types.ts` | 工具类型定义 |
