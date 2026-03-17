import type { ToolCall } from './types';

/**
 * 从Agent回复中提取工具调用
 * 支持格式：```tool\n{...}\n```
 */
export function extractToolCalls(content: string, agentId: string): { cleanedContent: string; toolCalls: ToolCall[] } {
  const toolCalls: ToolCall[] = [];

  // 匹配 ```tool\n{...}\n``` 格式
  const toolRegex = /```tool\n([\s\S]*?)\n```/g;

  let cleanedContent = content;
  let match;

  while ((match = toolRegex.exec(content)) !== null) {
    const jsonStr = match[1].trim();

    try {
      const parsed = JSON.parse(jsonStr);

      if (parsed.tool && typeof parsed.tool === 'string') {
        const toolCall: ToolCall = {
          id: `tool-${Date.now()}-${toolCalls.length}`,
          tool: parsed.tool,
          arguments: parsed.arguments || {},
          agentId,
        };

        toolCalls.push(toolCall);

        // 从内容中移除tool调用标记
        cleanedContent = cleanedContent.replace(match[0], '');
      }
    } catch {
      // JSON解析失败，保留原始内容
      console.warn('[ToolParser] 无法解析工具调用:', jsonStr);
    }
  }

  // 清理多余空行
  cleanedContent = cleanedContent.replace(/\n{3,}/g, '\n\n').trim();

  return { cleanedContent, toolCalls };
}

/**
 * 将工具结果格式化为添加到对话中的消息
 */
export function formatToolResult(toolCall: ToolCall, result: unknown): string {
  return `[工具结果: ${toolCall.tool}]\n${JSON.stringify(result, null, 2)}`;
}

/**
 * 检查内容是否包含工具调用
 */
export function hasToolCalls(content: string): boolean {
  return content.includes('```tool');
}

/**
 * 创建工具使用的系统提示词
 */
export function createToolSystemPrompt(availableTools: string[]): string {
  if (availableTools.length === 0) return '';

  return `
## 工具使用指南

你可以使用以下工具来增强你的能力：
${availableTools.map((t) => `- ${t}`).join('\n')}

当你需要使用工具时，在回复中包含以下格式：
\`\`\`tool
{
  "tool": "工具名称",
  "arguments": {
    "参数名": "参数值"
  }
}
\`\`\`

系统会执行工具并将结果返回给你。你可以在后续回复中引用工具结果。
`;
}

/**
 * 模拟流式输出工具结果
 * 将工具结果分段输出，模拟流式效果
 */
export function* generateToolResultStream(toolCall: ToolCall, result: unknown): Generator<{ content: string; done: boolean }> {
  const prefix = `[使用工具: ${toolCall.tool}]\n\n`;
  yield { content: prefix, done: false };

  const resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

  // 分段输出结果
  const chunkSize = 20;
  for (let i = 0; i < resultStr.length; i += chunkSize) {
    const chunk = resultStr.slice(i, i + chunkSize);
    yield { content: chunk, done: false };
  }

  yield { content: '\n\n[工具执行完成]\n', done: true };
}
