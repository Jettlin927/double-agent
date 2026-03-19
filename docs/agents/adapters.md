# API 适配器

Double Agent 支持多种 LLM API 格式，通过适配器模式隔离差异。

## 支持的 API 格式

| 提供商 | 适配器 | 端点 |
|--------|--------|------|
| OpenAI | `OpenAIAdapter` | `/v1/chat/completions` |
| Anthropic (Claude) | `AnthropicAdapter` | `/v1/messages` |
| DeepSeek | `OpenAIAdapter` | `/v1/chat/completions` |
| 通义千问 | `OpenAIAdapter` | `/v1/chat/completions` |
| Moonshot Kimi | `OpenAIAdapter` | `/v1/chat/completions` |
| 智谱 GLM | `OpenAIAdapter` | `/v1/chat/completions` |

所有 OpenAI 兼容格式的 API 都使用 `OpenAIAdapter`。

## 适配器接口

```typescript
interface APIAdapter {
  // 构建 API 请求
  buildRequest(messages: Message[], config: AgentConfig): RequestInit;

  // 解析流式响应
  parseStream(chunk: string): StreamChunk | null;

  // 获取 API 端点路径
  getEndpoint(): string;
}
```

## OpenAIAdapter

位置: `src/agents/OpenAIAdapter.ts`

### 端点

```typescript
getEndpoint(): string {
  return '/v1/chat/completions';
}
```

### 请求构建

```typescript
buildRequest(messages: Message[], config: AgentConfig): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: config.systemPrompt },
        ...messages,
      ],
      temperature: config.temperature,
      stream: true,
      stream_options: { include_usage: true },
    }),
  };
}
```

### 流式响应解析

解析 SSE 格式的数据：

```
data: {"choices":[{"delta":{"content":"Hello"}}]}

data: {"choices":[{"delta":{"reasoning_content":"思考中..."}}]}

data: [DONE]
```

提取字段:
- `choices[0].delta.content` - 文本内容
- `choices[0].delta.reasoning_content` - 推理内容（部分模型支持）
- `choices[0].delta.tool_calls` - 工具调用

## AnthropicAdapter

位置: `src/agents/AnthropicAdapter.ts`

### 端点

```typescript
getEndpoint(): string {
  return '/v1/messages';
}
```

### 请求构建

与 OpenAI 的主要区别：

1. **认证方式**: `x-api-key` header 而非 `Authorization: Bearer`
2. **版本控制**: 需要 `anthropic-version` header
3. **系统消息**: 作为顶层 `system` 字段，而非 `role: system` 消息
4. **最大 Token**: 需要指定 `max_tokens`

```typescript
buildRequest(messages: Message[], config: AgentConfig): RequestInit {
  // 分离系统消息
  const systemMessage = messages.find(m => m.role === 'system');
  const otherMessages = messages.filter(m => m.role !== 'system');

  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 4096,
      temperature: config.temperature,
      system: systemMessage?.content || config.systemPrompt,
      messages: otherMessages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
    }),
  };
}
```

### 流式响应解析

Anthropic SSE 格式：

```
event: content_block_delta
data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}

event: content_block_delta
data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"思考中..."}}
```

提取字段:
- `delta.text` - 文本内容
- `delta.thinking` - 推理内容

## 适配器选择

在 `AgentTeam` 中自动选择：

```typescript
private getAdapter(apiType: string): APIAdapter {
  return apiType === 'anthropic'
    ? new AnthropicAdapter()
    : new OpenAIAdapter();
}
```

配置示例：

```typescript
const gentleConfig: AgentConfig = {
  id: 'gentle',
  apiType: 'openai',  // 使用 OpenAI 格式
  baseURL: 'https://api.openai.com',
  model: 'gpt-4o',
  // ...
};

const angryConfig: AgentConfig = {
  id: 'angry',
  apiType: 'anthropic',  // 使用 Claude 原生格式
  baseURL: 'https://api.anthropic.com',
  model: 'claude-3-5-sonnet-20241022',
  // ...
};
```

## 扩展新适配器

要添加新的 API 格式适配器：

1. 创建新文件 `src/agents/NewAdapter.ts`

```typescript
import type { APIAdapter, AgentConfig, Message, StreamChunk } from '../types';

export class NewAdapter implements APIAdapter {
  getEndpoint(): string {
    return '/api/chat';
  }

  buildRequest(messages: Message[], config: AgentConfig): RequestInit {
    return {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: this.convertMessages(messages, config),
        temperature: config.temperature,
        stream: true,
      }),
    };
  }

  private convertMessages(messages: Message[], config: AgentConfig): unknown[] {
    // 转换为新 API 的消息格式
    return [
      { role: 'system', content: config.systemPrompt },
      ...messages,
    ];
  }

  parseStream(chunk: string): StreamChunk | null {
    // 解析 SSE 数据
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        return {
          content: data.text,
          reasoning: data.thinking,
        };
      }
    }
    return null;
  }
}
```

2. 在 `AgentTeam` 中添加适配器选择逻辑：

```typescript
private getAdapter(apiType: string): APIAdapter {
  switch (apiType) {
    case 'anthropic':
      return new AnthropicAdapter();
    case 'newapi':
      return new NewAdapter();
    default:
      return new OpenAIAdapter();
  }
}
```

## 相关文件

| 文件 | 说明 |
|------|------|
| `OpenAIAdapter.ts` | OpenAI 格式适配器 |
| `AnthropicAdapter.ts` | Claude 原生适配器 |
| `AgentTeam.ts` | 使用适配器的主类 |
| `types/index.ts` | APIAdapter 接口定义 |
