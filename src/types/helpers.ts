/**
 * 统一消息类型系统辅助函数
 * 提供 InputItem/OutputItem 与传统 Message 类型之间的转换
 */

import type {
  Message,
  InputItem,
  MessageItem,
  ReasoningItem,
  FunctionCallItem,
  FunctionCallOutputItem,
  CompactionItem,
  ContentPart,
  MessageRole,
  ChatMessage,
} from './index';

// ============================================================
// 创建 InputItem 的便捷函数
// ============================================================

export function createUserMessage(content: string): MessageItem {
  return {
    type: 'message',
    role: 'user',
    content: [{ type: 'input_text', text: content }],
  };
}

export function createAssistantMessage(content: string): MessageItem {
  return {
    type: 'message',
    role: 'assistant',
    content: [{ type: 'output_text', text: content }],
  };
}

export function createSystemMessage(content: string): MessageItem {
  return {
    type: 'message',
    role: 'system',
    content: [{ type: 'input_text', text: content }],
  };
}

export function createDeveloperMessage(content: string): MessageItem {
  return {
    type: 'message',
    role: 'developer',
    content: [{ type: 'input_text', text: content }],
  };
}

export function createReasoning(summary: string): ReasoningItem {
  return {
    type: 'reasoning',
    summary: [{ type: 'summary_text', text: summary }],
  };
}

export function createFunctionCall(
  name: string,
  args: unknown,
  callId?: string
): FunctionCallItem {
  return {
    type: 'function_call',
    name,
    arguments: JSON.stringify(args),
    call_id: callId || generateCallId(),
  };
}

export function createFunctionCallOutput(
  callId: string,
  output: unknown
): FunctionCallOutputItem {
  return {
    type: 'function_call_output',
    call_id: callId,
    output: typeof output === 'string' ? output : JSON.stringify(output),
  };
}

export function createCompaction(
  encryptedContent: string,
  summary: string,
  originalCount: number
): CompactionItem {
  return {
    type: 'compaction',
    encrypted_content: encryptedContent,
    summary: [{ type: 'summary_text', text: summary }],
    original_message_count: originalCount,
  };
}

// ============================================================
// 类型转换函数
// ============================================================

/**
 * 将传统的 Message[] 转换为 InputItem[]
 */
export function messagesToInputItems(messages: Message[]): InputItem[] {
  return messages.map((msg) => ({
    type: 'message',
    role: msg.role as MessageRole,
    content: [{ type: msg.role === 'assistant' ? 'output_text' : 'input_text', text: msg.content }],
  }));
}

/**
 * 将 InputItem[] 转换为传统的 Message[]
 * 注意：会丢失 reasoning、function_call 等非消息类型的信息
 */
export function inputItemsToMessages(items: InputItem[]): Message[] {
  return items
    .filter((item): item is MessageItem => item.type === 'message')
    .map((item) => ({
      role: item.role as 'system' | 'user' | 'assistant',
      content: extractTextContent(item.content),
    }));
}

/**
 * 提取 ContentPart 数组中的文本内容
 */
export function extractTextContent(parts: ContentPart[]): string {
  return parts
    .filter((part): part is { type: 'input_text' | 'output_text'; text: string } =>
      part.type === 'input_text' || part.type === 'output_text'
    )
    .map((part) => part.text)
    .join('');
}

/**
 * 将 ChatMessage 转换为 MessageItem
 */
export function chatMessageToItem(msg: ChatMessage): MessageItem {
  const content: ContentPart[] = [{ type: 'output_text', text: msg.content }];

  return {
    type: 'message',
    role: msg.role,
    content,
    id: msg.id,
    agentId: msg.agentId,
    timestamp: msg.timestamp,
  };
}

/**
 * 将 MessageItem 转换为 ChatMessage
 */
export function messageItemToChatMessage(item: MessageItem): ChatMessage {
  return {
    id: item.id || generateId(),
    role: item.role as 'user' | 'assistant',
    content: extractTextContent(item.content),
    agentId: item.agentId,
    timestamp: item.timestamp || Date.now(),
  };
}

// ============================================================
// InputItem 操作函数
// ============================================================

/**
 * 获取 InputItem 的文本表示（用于调试和日志）
 */
export function getItemTextRepresentation(item: InputItem): string {
  switch (item.type) {
    case 'message':
      return `[${item.role}] ${extractTextContent(item.content).slice(0, 100)}...`;
    case 'reasoning':
      return `[reasoning] ${item.summary.map((s) => s.type === 'summary_text' ? s.text : '[image]').join(' ').slice(0, 100)}...`;
    case 'function_call':
      return `[function_call] ${item.name}(${item.arguments.slice(0, 50)}...)`;
    case 'function_call_output':
      return `[function_call_output] call_id=${item.call_id} output=${item.output.slice(0, 50)}...`;
    case 'compaction':
      return `[compaction] original_messages=${item.original_message_count}`;
    default:
      return '[unknown]';
  }
}

/**
 * 查找指定 call_id 的 function_call
 */
export function findFunctionCall(items: InputItem[], callId: string): FunctionCallItem | undefined {
  return items.find(
    (item): item is FunctionCallItem =>
      item.type === 'function_call' && item.call_id === callId
  );
}

/**
 * 查找指定 call_id 的 function_call_output
 */
export function findFunctionCallOutput(
  items: InputItem[],
  callId: string
): FunctionCallOutputItem | undefined {
  return items.find(
    (item): item is FunctionCallOutputItem =>
      item.type === 'function_call_output' && item.call_id === callId
  );
}

/**
 * 获取所有待执行的 function_call（没有对应 output 的 call）
 */
export function getPendingFunctionCalls(items: InputItem[]): FunctionCallItem[] {
  const calls = items.filter((item): item is FunctionCallItem => item.type === 'function_call');
  const outputs = new Set(
    items
      .filter((item): item is FunctionCallOutputItem => item.type === 'function_call_output')
      .map((item) => item.call_id)
  );
  return calls.filter((call) => !outputs.has(call.call_id));
}

/**
 * 检查 InputItem 数组中是否包含 compaction
 */
export function hasCompaction(items: InputItem[]): boolean {
  return items.some((item) => item.type === 'compaction');
}

/**
 * 获取 InputItem 列表中的消息数量统计
 */
export function getItemStats(items: InputItem[]) {
  return {
    total: items.length,
    messages: items.filter((i) => i.type === 'message').length,
    reasoning: items.filter((i) => i.type === 'reasoning').length,
    functionCalls: items.filter((i) => i.type === 'function_call').length,
    functionOutputs: items.filter((i) => i.type === 'function_call_output').length,
    compactions: items.filter((i) => i.type === 'compaction').length,
  };
}

// ============================================================
// 工具函数
// ============================================================

function generateCallId(): string {
  return `call_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * 验证 FunctionCallItem 的参数是否合法 JSON
 */
export function validateFunctionCallArgs(item: FunctionCallItem): boolean {
  try {
    JSON.parse(item.arguments);
    return true;
  } catch {
    return false;
  }
}

/**
 * 解析 FunctionCallItem 的参数
 */
export function parseFunctionCallArgs<T = unknown>(item: FunctionCallItem): T | null {
  try {
    return JSON.parse(item.arguments) as T;
  } catch {
    return null;
  }
}

/**
 * 创建用于提示缓存的输入排序（静态内容在前）
 */
export function orderInputForCaching(items: InputItem[]): InputItem[] {
  const typePriority: Record<InputItem['type'], number> = {
    message: 0,
    reasoning: 1,
    function_call: 2,
    function_call_output: 3,
    compaction: 4,
  };

  const rolePriority: Record<MessageRole, number> = {
    system: 0,
    developer: 1,
    user: 2,
    assistant: 3,
  };

  return [...items].sort((a, b) => {
    // 首先按类型排序
    const typeDiff = typePriority[a.type] - typePriority[b.type];
    if (typeDiff !== 0) return typeDiff;

    // 对于消息类型，按角色排序
    if (a.type === 'message' && b.type === 'message') {
      return rolePriority[a.role] - rolePriority[b.role];
    }

    return 0;
  });
}

/**
 * 计算 InputItem 的近似 token 数量
 * 简单估算：1 token ≈ 4 个字符
 */
export function estimateTokens(items: InputItem[]): number {
  let charCount = 0;

  for (const item of items) {
    switch (item.type) {
      case 'message':
        charCount += extractTextContent(item.content).length;
        break;
      case 'reasoning':
        charCount += item.summary
          .map((s) => (s.type === 'summary_text' ? s.text.length : 100))
          .reduce((a, b) => a + b, 0);
        break;
      case 'function_call':
        charCount += item.name.length + item.arguments.length;
        break;
      case 'function_call_output':
        charCount += item.output.length;
        break;
      case 'compaction':
        charCount += item.encrypted_content.length;
        break;
    }
  }

  return Math.ceil(charCount / 4);
}

/**
 * 深度克隆 InputItem 数组
 */
export function cloneInputItems(items: InputItem[]): InputItem[] {
  return JSON.parse(JSON.stringify(items));
}

/**
 * 从 InputItem 数组中提取最后一条 assistant 消息
 */
export function getLastAssistantMessage(items: InputItem[]): MessageItem | undefined {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i];
    if (item.type === 'message' && item.role === 'assistant') {
      return item;
    }
  }
  return undefined;
}

/**
 * 从 InputItem 数组中提取用户问题的原始内容
 */
export function getOriginalUserQuestion(items: InputItem[]): string | undefined {
  // 找到第一个 user 消息的文本内容
  for (const item of items) {
    if (item.type === 'message' && item.role === 'user') {
      return extractTextContent(item.content);
    }
  }
  return undefined;
}
