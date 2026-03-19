# 工具系统概述

工具系统为 AI Agent 提供了与外部世界交互的能力，包括网络搜索、代码执行、对话总结等功能。

## 架构

```
┌─────────────────────────────────────────┐
│           Agent Response                │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│           Tool Parser                   │
│      提取 ```tool 代码块                │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│          Tool Registry                  │
│      查找并执行工具处理函数              │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│         Tool Handler                    │
│      执行具体工具逻辑                    │
└─────────────┬───────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────┐
│         ToolResult                      │
│      返回执行结果                        │
└─────────────────────────────────────────┘
```

## 核心组件

### 1. ToolRegistry

位置: `src/tools/registry.ts`

**职责**: 管理所有工具的注册、查询和执行

**核心方法**:
```typescript
class ToolRegistry {
  // 注册工具
  register(definition: ToolDefinition, handler: ToolHandler): void;

  // 获取工具
  getTool(name: string): ToolDefinition | undefined;
  getAllTools(): ToolDefinition[];

  // 执行工具
  execute(
    toolName: string,
    args: Record<string, unknown>,
    context: ToolContext
  ): Promise<ToolResult>;

  // 生成工具描述的 prompt
  generateToolsPrompt(): string;
}
```

**单例实例**:
```typescript
export const toolRegistry = new ToolRegistry();
```

### 2. Tool Parser

位置: `src/tools/parser.ts`

**职责**: 从 Agent 回复中提取工具调用

**调用格式**:
```json
```tool
{
  "tool": "web_search",
  "arguments": {
    "query": "TypeScript 最新版本"
  }
}
```
```

### 3. 类型定义

位置: `src/tools/types.ts`

**核心类型**:
```typescript
// 工具定义
interface ToolDefinition {
  type: 'function' | 'web_search' | 'web_search_preview';
  name?: string;
  description?: string;
  parameters?: ToolParameter[];
}

// 参数定义
interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  enum?: string[];
}

// 执行上下文
interface ToolContext {
  agentId: string;
  agentName: string;
  sessionId: string;
  askOtherAgent?: (question: string) => Promise<string>;
  getConversationHistory?: () => string;
  otherAgentName?: string;
}

// 执行结果
interface ToolResult {
  success: boolean;
  data: unknown;
  error?: string;
  executionTime: number;
}

// 处理函数类型
type ToolHandler = (
  args: Record<string, unknown>,
  context: ToolContext
) => Promise<ToolResult>;
```

## 内置工具

### 1. web_search - 网络搜索

**状态**: 模拟实现，需配置搜索引擎 API

**参数**:
- `query` (string, 必填): 搜索关键词
- `limit` (number, 可选): 返回结果数量，默认 5

**返回值**:
```typescript
{
  query: string;
  results: [{ title: string; snippet: string; url: string }];
  note: string;  // 配置提示
}
```

### 2. execute_code - 代码执行

**状态**: 模拟实现，需配置安全执行环境

**参数**:
- `language` (string, 必填): 编程语言，可选: `['python', 'javascript', 'bash']`
- `code` (string, 必填): 要执行的代码
- `timeout` (number, 可选): 超时时间（秒），默认 30

**返回值**:
```typescript
{
  language: string;
  code: string;
  output: string;
  executed: boolean;
  note: string;
}
```

### 3. ask_other_agent - 询问另一个 Agent

**状态**: 功能完整

**参数**:
- `question` (string, 必填): 要问的问题
- `context` (string, 可选): 额外的上下文信息

**使用场景**: 双 Agent 辩论中，一个 Agent 征求另一个 Agent 的意见

**返回值**:
```typescript
{
  from: string;      // 被询问的 Agent 名称
  question: string;  // 完整问题（含上下文）
  response: string;  // 对方回复
}
```

### 4. summarize - 对话总结

**状态**: 基础实现，可接入 LLM 增强

**参数**:
- `format` (string, 必填): 总结格式，可选: `['brief', 'detailed', 'bullet_points']`
- `focus` (string, 可选): 关注特定方面

**返回值**:
```typescript
{
  format: string;
  focus: string;
  historyLength: number;
  note: string;
}
```

### 5. fact_check - 事实核查

**状态**: 基础框架，需接入搜索引擎和知识库

**参数**:
- `claim` (string, 必填): 需要核查的陈述
- `evidence` (string, 可选): 支持或反驳的证据

**返回值**:
```typescript
{
  claim: string;
  evidence?: string;
  status: 'pending';  // 未来: 'verified' | 'disputed' | 'false'
  note: string;
}
```

### 6. calculate - 精确计算

**状态**: 功能完整

**参数**:
- `expression` (string, 必填): 数学表达式

**安全处理**: 使用正则过滤危险字符 `[^0-9+\-*/().\sMath\w]`

**返回值**:
```typescript
{
  expression: string;
  result: number;
  type: string;
}
```

### 7. memory - 记忆存储

**状态**: 功能完整，使用内存 Map 存储

**参数**:
- `action` (string, 必填): 操作类型，可选: `['store', 'retrieve', 'list']`
- `key` (string, 可选): 记忆的键名
- `value` (string, 可选): 要存储的值
- `category` (string, 可选): 分类

**返回值**: 根据 action 不同返回不同结构

## 在角色中启用工具

### AgentLoop 方式（推荐）

在创建 AgentLoop 时传入工具列表：

```typescript
const agentLoop = new AgentLoop({
  config: agentConfig,
  sessionId: 'session-123',
  tools: toolRegistry.getAllTools(),
});
```

AgentLoop 会自动将工具定义转换为 OpenAI Function Calling 格式：

```typescript
{
  type: 'function',
  function: {
    name: 'web_search',
    description: '搜索网络信息...',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' }
      },
      required: ['query']
    }
  }
}
```

### 传统方式（AgentTeam）

将工具描述添加到 system prompt：

```typescript
import { toolRegistry } from '../tools';

const systemPrompt = `你是温和助手...

${toolRegistry.generateToolsPrompt()}`;
```

生成的 prompt 示例：

```markdown
## 可用工具
你可以使用以下工具来辅助讨论：

### web_search
搜索网络信息，获取最新数据和事实
参数：
  - query: string (必填) - 搜索关键词
  - limit: number (可选) - 返回结果数量（默认5）

### calculate
执行数学计算，返回精确结果
参数：
  - expression: string (必填) - 数学表达式

## 如何使用工具
当你需要使用工具时，请在回复中包含以下格式的JSON：
```tool
{
  "tool": "工具名称",
  "arguments": {
    "参数名": "参数值"
  }
}
```
系统会执行工具并将结果返回给你。
```

## 添加自定义工具

```typescript
import { toolRegistry } from '@/tools';

// 1. 定义工具
const myTool = {
  type: 'function' as const,
  name: 'my_tool',
  description: '我的自定义工具',
  parameters: [
    {
      name: 'input',
      type: 'string' as const,
      description: '输入参数',
      required: true,
    },
  ],
};

// 2. 实现处理函数
const myHandler = async (args, context) => {
  const { input } = args;

  // 执行工具逻辑
  const result = await doSomething(input);

  return {
    success: true,
    data: result,
    executionTime: 0,
  };
};

// 3. 注册工具
toolRegistry.register(myTool, myHandler);
```

## 工具调用流程

### AgentLoop 中的工具调用

```
1. 发送请求（包含 tools 参数）
     │
     ▼
2. LLM 决定调用工具
   返回 function_call
     │
     ▼
3. AgentLoop 解析 function_call
   提取 name, arguments, call_id
     │
     ▼
4. 调用 toolRegistry.execute()
   执行工具处理函数
     │
     ▼
5. 获取 ToolResult
     │
     ▼
6. 创建 FunctionCallOutputItem
   将结果返回给 LLM
     │
     ▼
7. 继续下一轮迭代
   LLM 基于工具结果生成回复
```

### 传统方式（AgentTeam）中的工具调用

```
1. Agent 生成包含 ```tool 代码块的回复
     │
     ▼
2. Parser 提取工具调用
     │
     ▼
3. 调用 toolRegistry.execute()
     │
     ▼
4. 将结果返回给 Agent
     │
     ▼
5. Agent 基于结果继续回复
```

## 相关文件

| 文件 | 说明 |
|------|------|
| `registry.ts` | 工具注册中心和内置工具实现 |
| `types.ts` | 工具类型定义 |
| `parser.ts` | 工具调用解析 |
| `AgentLoop.ts` | 集成工具调用的 Agent 循环 |
