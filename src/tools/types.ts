// Tool 系统类型定义

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
}

export interface ToolCall {
  id: string;
  tool: string;
  arguments: Record<string, unknown>;
  agentId: string;  // 哪个Agent调用的
}

export interface ToolResult {
  success: boolean;
  data: unknown;
  error?: string;
  executionTime: number;
}

export type ToolHandler = (args: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;

export interface ToolContext {
  agentId: string;
  agentName: string;
  otherAgentId?: string;
  otherAgentName?: string;
  sessionId?: string;
  // 可以访问其他Agent的回调
  askOtherAgent?: (question: string) => Promise<string>;
  getConversationHistory?: () => string;
}

// 内置Tools

// 1. WebSearch - 搜索网络信息
export interface WebSearchArgs {
  query: string;
  limit?: number;
}

// 2. CodeExecution - 执行代码
export interface CodeExecutionArgs {
  language: 'python' | 'javascript' | 'bash';
  code: string;
  timeout?: number;
}

// 3. FileOperation - 文件读写
export interface FileOperationArgs {
  operation: 'read' | 'write' | 'append' | 'list';
  path: string;
  content?: string;
}

// 4. AskOtherAgent - 询问另一个Agent
export interface AskOtherAgentArgs {
  question: string;
  context?: string;
}

// 5. Summarize - 总结对话
export interface SummarizeArgs {
  format: 'brief' | 'detailed' | 'bullet_points';
  focus?: string;  // 关注特定方面
}

// 6. FactCheck - 事实核查
export interface FactCheckArgs {
  claim: string;
  evidence?: string;
}

// 7. Calculate - 精确计算
export interface CalculateArgs {
  expression: string;
}

// 8. Memory - 存储/检索关键信息
export interface MemoryArgs {
  action: 'store' | 'retrieve' | 'list';
  key?: string;
  value?: string;
  category?: string;
}
