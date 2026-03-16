# 工具系统 (Tool System)

本文档详细介绍 Double Agent 项目的工具系统，允许 AI Agent 调用外部工具来增强能力。

## 目录

- [概述](#概述)
- [目录结构](#目录结构)
- [核心概念](#核心概念)
- [内置工具](#内置工具)
- [使用流程](#使用流程)
- [添加新工具](#添加新工具)

---

## 概述

工具系统为 AI Agent 提供了与外部世界交互的能力。当 Agent 需要执行以下操作时，可以调用相应的工具：

- 搜索网络信息
- 读取/写入文件
- 执行代码
- 询问另一个 Agent 的意见
- 总结长文本
- 验证事实
- 精确计算
- 存储和检索记忆

工具系统的设计理念：
- **声明式**：通过 JSON Schema 声明工具参数
- **可扩展**：易于注册新工具
- **类型安全**：完整的 TypeScript 类型支持
- **异步执行**：支持异步工具处理

---

## 目录结构

```
src/tools/
├── types.ts      # 工具类型定义 (Tool, ToolCall, ToolResult 等)
├── registry.ts   # 工具注册中心和内置工具实现
├── parser.ts     # 工具调用解析器 (从 AI 响应中提取工具调用)
└── index.ts      # 导出
```

---

## 核心概念

### 1. Tool 定义 (`types.ts`)

```typescript
// 工具参数定义
export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  default?: unknown;
  enum?: unknown[];  // 可选的枚举值
}

// 工具定义
export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
}

// 工具调用
export interface ToolCall {
  id: string;
  tool: string;
  arguments: Record<string, unknown>;
  agentId: string;
}

// 工具执行结果
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// 工具执行上下文
export interface ToolContext {
  agentId: string;
  agentName: string;
  personality: 'gentle' | 'angry';
  sessionId?: string;
  messageHistory?: Array<{ role: string; content: string }>;
}

// 工具处理函数类型
export type ToolHandler = (
  args: Record<string, unknown>,
  context: ToolContext
) => Promise<ToolResult>;
```

### 2. ToolRegistry 工具注册中心 (`registry.ts`)

```typescript
export class ToolRegistry {
  private tools: Map<string, Tool>;
  private handlers: Map<string, ToolHandler>;

  // 注册工具
  register(tool: Tool, handler: ToolHandler): void;

  // 执行工具
  execute(toolName: string, args: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;

  // 获取所有工具
  getAllTools(): Tool[];

  // 生成工具提示词（用于系统提示）
  generateToolsPrompt(): string;

  // 创建工具系统提示词
  createToolSystemPrompt(): string;
}

// 全局单例
export const toolRegistry = new ToolRegistry();
```

**使用示例**：

```typescript
import { toolRegistry } from '../tools';

// 执行工具
const result = await toolRegistry.execute('web_search', {
  query: 'TypeScript 最新版本'
}, {
  agentId: 'gentle-1',
  agentName: '温和助手',
  personality: 'gentle'
});
```

### 3. ToolParser 工具调用解析器 (`parser.ts`)

从 AI 的文本响应中提取工具调用：

```typescript
// 解析工具调用
export function parseToolCalls(content: string, agentId: string): ToolCall[];

// 移除工具调用标记后的纯文本
export function removeToolCalls(content: string): string;

// 检查是否包含工具调用
export function hasToolCalls(content: string): boolean;
```

**工具调用格式**：

AI 在响应中使用以下格式调用工具：

```
[TOOL:web_search]
{
  "query": "TypeScript 最新版本"
}
[/TOOL]
```

---

## 内置工具

系统内置了 7 个常用工具：

### 1. web_search - 网页搜索

模拟网页搜索功能（当前返回模拟数据）。

**参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| query | string | 是 | 搜索关键词 |
| limit | number | 否 | 返回结果数量（默认5） |

**示例**：
```json
{
  "query": "React 19 新特性",
  "limit": 3
}
```

### 2. file_operation - 文件操作

读取或写入文本文件。

**参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| operation | string | 是 | 操作类型：'read' 或 'write' |
| path | string | 是 | 文件路径 |
| content | string | 否 | 写入内容（write 时必填） |

**示例**：
```json
// 读取文件
{
  "operation": "read",
  "path": "./notes.txt"
}

// 写入文件
{
  "operation": "write",
  "path": "./output.txt",
  "content": "Hello World"
}
```

### 3. code_execution - 代码执行

执行代码并返回结果（当前为模拟实现）。

**参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| language | string | 是 | 编程语言：'javascript', 'python', 'bash' |
| code | string | 是 | 要执行的代码 |
| timeout | number | 否 | 超时时间（秒，默认30） |

**示例**：
```json
{
  "language": "javascript",
  "code": "console.log([1,2,3].map(x => x * 2))",
  "timeout": 10
}
```

### 4. ask_other_agent - 询问另一个Agent

让当前 Agent 询问另一个 Agent 的意见。

**参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| question | string | 是 | 要问的问题 |
| target_agent | string | 否 | 目标 Agent：'gentle' 或 'angry'（默认根据当前 Agent 自动选择） |

**示例**：
```json
{
  "question": "你觉得这个观点怎么样？",
  "target_agent": "angry"
}
```

### 5. summarize - 文本总结

总结长文本内容。

**参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| text | string | 是 | 要总结的文本 |
| max_length | number | 否 | 最大长度（默认200字符） |
| format | string | 否 | 格式：'bullet', 'paragraph', 'key_points'（默认'paragraph'） |

**示例**：
```json
{
  "text": "这是一段很长的文本...",
  "max_length": 100,
  "format": "bullet"
}
```

### 6. fact_check - 事实核查

验证某个陈述的事实准确性。

**参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| claim | string | 是 | 要核查的陈述 |
| context | string | 否 | 额外上下文信息 |

**示例**：
```json
{
  "claim": "TypeScript 是微软开发的",
  "context": "关于编程语言的历史"
}
```

### 7. calculate - 数学计算

执行精确的数学计算。

**参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| expression | string | 是 | 数学表达式 |
| precision | number | 否 | 小数精度（默认2） |

**示例**：
```json
{
  "expression": "(100 * 1.08) / 12 + 50",
  "precision": 4
}
```

### 8. memory - 记忆存储

存储和检索信息到 Agent 的"记忆"中。

**参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| action | string | 是 | 操作：'store', 'retrieve', 'list', 'clear' |
| key | string | 否 | 存储键名（store/retrieve 时必填） |
| value | string | 否 | 存储值（store 时必填） |
| tags | string[] | 否 | 标签（store 时使用） |

**示例**：
```json
// 存储记忆
{
  "action": "store",
  "key": "user_preference",
  "value": "用户喜欢简洁的回答",
  "tags": ["preference", "user"]
}

// 检索记忆
{
  "action": "retrieve",
  "key": "user_preference"
}

// 列出所有记忆
{
  "action": "list"
}
```

---

## 使用流程

### 1. 系统提示词集成

在 `src/prompts/roles.ts` 中，每个角色可以启用工具系统：

```typescript
import { createToolSystemPrompt } from '../tools';

export const GENTLE_ROLES: RoleDefinition[] = [
  {
    id: 'gentle-default',
    name: '温和助手',
    personality: 'gentle',
    description: '...',
    systemPrompt: `你是温和助手...\n\n${createToolSystemPrompt()}`,
  },
];
```

### 2. AgentTeam 集成

在 `AgentTeam.ts` 中处理工具调用：

```typescript
async runDebate(question, onChunk, onRoundComplete, signal) {
  // ...

  for (const agent of [this.gentleConfig, this.angryConfig]) {
    // 获取 AI 响应
    const response = await this.streamRequest(agent, messages, onChunk, signal);

    // 检查是否包含工具调用
    if (hasToolCalls(response)) {
      const toolCalls = parseToolCalls(response, agent.id);

      // 执行工具
      for (const call of toolCalls) {
        const result = await toolRegistry.execute(call.tool, call.arguments, {
          agentId: agent.id,
          agentName: agent.name,
          personality: agent.personality,
        });

        // 将工具结果添加到对话历史
        messages.push({
          role: 'system',
          content: `[Tool Result: ${call.tool}] ${JSON.stringify(result)}`
        });
      }
    }
  }
}
```

### 3. 完整对话流程

```
用户输入
    ↓
Agent 生成响应（包含可能的工具调用）
    ↓
解析工具调用 [TOOL:name]...[/TOOL]
    ↓
执行工具 → 获取结果
    ↓
将工具结果添加到对话历史
    ↓
Agent 根据工具结果生成最终响应
    ↓
显示给用户
```

---

## 添加新工具

### 步骤 1：定义工具

在 `src/tools/registry.ts` 中添加工具定义：

```typescript
const myTool: Tool = {
  name: 'my_tool',
  description: '工具的用途说明',
  parameters: [
    {
      name: 'param1',
      type: 'string',
      description: '参数1的说明',
      required: true,
    },
    {
      name: 'param2',
      type: 'number',
      description: '参数2的说明',
      required: false,
      default: 10,
    },
  ],
};
```

### 步骤 2：实现处理函数

```typescript
const myToolHandler: ToolHandler = async (args, context) => {
  try {
    const { param1, param2 = 10 } = args;

    // 执行工具逻辑
    const result = await doSomething(param1, param2);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};
```

### 步骤 3：注册工具

在 `registerBuiltinTools()` 函数中注册：

```typescript
export function registerBuiltinTools(): void {
  // ... 其他工具

  toolRegistry.register(myTool, myToolHandler);
}
```

### 参数类型参考

| 类型 | TypeScript 类型 | 示例值 |
|------|----------------|--------|
| string | `string` | `"hello"` |
| number | `number` | `42` |
| boolean | `boolean` | `true` |
| array | `unknown[]` | `["a", "b"]` |
| object | `Record<string, unknown>` | `{"key": "value"}` |

---

## 相关文件

| 文件 | 说明 |
|------|------|
| `src/tools/types.ts` | 工具类型定义 |
| `src/tools/registry.ts` | 工具注册中心和内置工具 |
| `src/tools/parser.ts` | 工具调用解析 |
| `src/tools/index.ts` | 导出 |
| `src/prompts/roles.ts` | 角色系统提示词（集成工具） |
| `src/agents/AgentTeam.ts` | Agent 协调器（工具调用处理） |

---

## 注意事项

1. **安全性**：当前工具系统在前端运行，某些工具（如 file_operation）有安全限制
2. **异步执行**：所有工具处理函数都是异步的
3. **错误处理**：始终返回 `ToolResult` 格式，包含 `success` 字段
4. **类型安全**：使用 TypeScript 类型确保参数正确性
