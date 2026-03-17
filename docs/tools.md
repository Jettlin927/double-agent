# 工具系统 (Tool System)

本文档介绍 Double Agent 项目的工具系统，允许 AI Agent 调用外部工具来增强能力。

## 目录

- [概述](#概述)
- [架构](#架构)
- [内置工具](#内置工具)
- [使用方式](#使用方式)
- [添加新工具](#添加新工具)

---

## 概述

工具系统为 AI Agent 提供了与外部世界交互的能力：

- 网络搜索
- 代码执行
- 询问另一个 Agent
- 对话总结
- 事实核查
- 精确计算
- 记忆存储

**设计理念**：
- **声明式**：通过 JSON Schema 声明工具参数
- **可扩展**：易于注册新工具
- **类型安全**：完整的 TypeScript 类型支持

---

## 架构

### 前端工具系统

```
src/tools/
├── types.ts      # 工具类型定义
├── registry.ts   # 工具注册中心
├── parser.ts     # 工具调用解析器
└── index.ts      # 导出
```

**核心类型** (`types.ts`)：
```typescript
interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
}

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  executionTime?: number;
}

type ToolHandler = (
  args: Record<string, unknown>,
  context: ToolContext
) => Promise<ToolResult>;
```

**工具注册** (`registry.ts`)：
```typescript
export class ToolRegistry {
  register(definition: ToolDefinition, handler: ToolHandler): void;
  execute(toolName: string, args: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;
  generateToolsPrompt(): string;  // 生成系统提示词
}

export const toolRegistry = new ToolRegistry();
```

---

## 内置工具

### 1. web_search - 网络搜索

模拟网页搜索功能。

**参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| query | string | 是 | 搜索关键词 |
| limit | number | 否 | 返回结果数量（默认5） |

### 2. execute_code - 代码执行

执行代码并返回结果（模拟实现）。

**参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| language | string | 是 | 语言：'python', 'javascript', 'bash' |
| code | string | 是 | 要执行的代码 |
| timeout | number | 否 | 超时时间（秒，默认30） |

### 3. ask_other_agent - 询问另一个 Agent

让当前 Agent 询问另一个 Agent 的意见。

**参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| question | string | 是 | 要问的问题 |
| context | string | 否 | 额外的上下文信息 |

### 4. summarize - 对话总结

总结当前对话的要点和结论。

**参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| format | string | 是 | 格式：'brief', 'detailed', 'bullet_points' |
| focus | string | 否 | 关注特定方面 |

### 5. fact_check - 事实核查

核查某个陈述的事实准确性。

**参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| claim | string | 是 | 需要核查的陈述 |
| evidence | string | 否 | 支持或反驳的证据 |

### 6. calculate - 数学计算

执行精确的数学计算。

**参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| expression | string | 是 | 数学表达式 |

### 7. memory - 记忆存储

存储或检索对话中的重要信息。

**参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| action | string | 是 | 操作：'store', 'retrieve', 'list' |
| key | string | 否 | 记忆的键名 |
| value | string | 否 | 要存储的值 |
| category | string | 否 | 分类标签 |

---

## 使用方式

### 在角色中启用工具

在 `src/prompts/roles.ts` 中，将工具系统提示词添加到 systemPrompt：

```typescript
import { createToolSystemPrompt } from '../tools';

export const GENTLE_ROLES: RoleDefinition[] = [
  {
    id: 'gentle-default',
    name: '温和助手',
    systemPrompt: `你是温和助手...\n\n${createToolSystemPrompt()}`,
  },
];
```

### 工具调用格式

AI 在响应中使用以下格式调用工具：

```
```tool
{
  "tool": "web_search",
  "arguments": {
    "query": "TypeScript 最新版本"
  }
}
```
```

### 执行工具

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

// result = { success: true, data: {...}, executionTime: 100 }
```

---

## 添加新工具

### 步骤 1：定义工具

在 `src/tools/registry.ts` 中添加：

```typescript
const myTool: ToolDefinition = {
  name: 'my_tool',
  description: '工具的用途说明',
  parameters: [
    {
      name: 'param1',
      type: 'string',
      description: '参数1的说明',
      required: true,
    },
  ],
};
```

### 步骤 2：实现处理函数

```typescript
const myToolHandler: ToolHandler = async (args, context) => {
  try {
    const { param1 } = args;
    const result = await doSomething(param1);

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

```typescript
export function registerBuiltInTools(): void {
  // ... 其他工具
  toolRegistry.register(myTool, myToolHandler);
}
```

---

## 注意事项

1. **当前限制**：工具系统在前端运行，某些功能受限
2. **未来规划**：可将工具系统移至后端，实现更强大的功能
3. **安全性**：代码执行等工具需要沙箱环境
4. **错误处理**：始终返回 `ToolResult` 格式

---

## 相关文件

| 文件 | 说明 |
|------|------|
| `src/tools/types.ts` | 工具类型定义 |
| `src/tools/registry.ts` | 工具注册中心 |
| `src/tools/parser.ts` | 工具调用解析 |
| `src/prompts/roles.ts` | 角色系统提示词 |
