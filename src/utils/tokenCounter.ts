// 简化的 Token 计数器
// 使用字符数估算，实际生产环境应该使用 tiktoken 等库

export function estimateTokens(text: string): number {
  // 简化的估算：中文字符 + 英文单词
  // 中文：每个字符约 1.5 tokens
  // 英文：每个单词约 1.3 tokens

  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  const otherChars = text.length - chineseChars - englishWords;

  return Math.ceil(chineseChars * 1.5 + englishWords * 1.3 + otherChars * 0.5);
}

export function estimateMessagesTokens(messages: Array<{ role: string; content: string }>): number {
  // 每条消息有额外的开销（role 标记等）
  const overheadPerMessage = 4;

  return messages.reduce((total, msg) => {
    return total + estimateTokens(msg.content) + overheadPerMessage;
  }, 0);
}

// 不同模型的上下文限制
export const CONTEXT_LIMITS: Record<string, number> = {
  // OpenAI
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'gpt-4': 8192,
  'gpt-3.5-turbo': 16385,

  // Anthropic
  'claude-3-5-sonnet': 200000,
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,

  // DeepSeek
  'deepseek-chat': 64000,
  'deepseek-reasoner': 64000,

  // 阿里云
  'qwen-max': 32000,
  'qwen-plus': 32000,
  'qwen-turbo': 8000,

  // Moonshot
  'kimi-latest': 200000,
  'kimi-k1': 200000,

  // 智谱
  'glm-4': 128000,
  'glm-4-flash': 128000,
};

export function getContextLimit(model: string): number {
  // 尝试精确匹配
  if (CONTEXT_LIMITS[model]) {
    return CONTEXT_LIMITS[model];
  }

  // 尝试部分匹配
  for (const [key, value] of Object.entries(CONTEXT_LIMITS)) {
    if (model.includes(key) || key.includes(model)) {
      return value;
    }
  }

  // 默认 8k
  return 8192;
}

export interface ContextStats {
  totalTokens: number;
  maxTokens: number;
  usagePercent: number;
  messageCount: number;
}

export function calculateContextStats(
  messages: Array<{ role: string; content: string }>,
  model: string
): ContextStats {
  const totalTokens = estimateMessagesTokens(messages);
  const maxTokens = getContextLimit(model);
  const usagePercent = (totalTokens / maxTokens) * 100;

  return {
    totalTokens,
    maxTokens,
    usagePercent,
    messageCount: messages.length,
  };
}

// 压缩策略：总结早期对话
export function compactMessages(
  messages: Array<{ role: string; content: string }>,
  keepRecent: number = 4
): Array<{ role: string; content: string }> {
  if (messages.length <= keepRecent + 1) {
    return messages;
  }

  // 保留系统消息（如果有）
  const systemMessages = messages.filter(m => m.role === 'system');

  // 保留最近的消息
  const recentMessages = messages.slice(-keepRecent);

  // 中间的消息需要压缩
  const middleMessages = messages.slice(systemMessages.length, -keepRecent);

  if (middleMessages.length === 0) {
    return [...systemMessages, ...recentMessages];
  }

  // 创建摘要
  const summaryContent = `[之前对话的摘要]\n${middleMessages.map(m =>
    m.role === 'user' ? `用户: ${m.content.substring(0, 100)}...` :
    `助手: ${m.content.substring(0, 100)}...`
  ).join('\n')}`;

  const summaryMessage = {
    role: 'user' as const,
    content: summaryContent,
  };

  return [...systemMessages, summaryMessage, ...recentMessages];
}

// 检查是否需要压缩
export function shouldCompact(stats: ContextStats, threshold: number = 80): boolean {
  return stats.usagePercent >= threshold;
}
