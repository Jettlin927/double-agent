export type AgentPersonality = 'gentle' | 'angry';
export type ApiType = 'openai' | 'anthropic';
export type AgentMode = 'double' | 'single';

export interface AgentConfig {
  id: string;
  name: string;
  personality: AgentPersonality;
  apiType: ApiType;
  baseURL: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxRounds: number;
}

// ============================================================
// 传统消息类型（向后兼容）
// ============================================================

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamChunk {
  content?: string;
  reasoning?: string;
  done?: boolean;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  agentId?: string;
  timestamp: number;
}

// ============================================================
// 统一消息类型系统（参考 Codex CLI Agent Loop）
// ============================================================

// 消息角色类型（按优先级降序排列）
export type MessageRole = 'system' | 'developer' | 'user' | 'assistant';

// 内容部分类型
export type ContentPart =
  | { type: 'input_text'; text: string }
  | { type: 'output_text'; text: string }
  | { type: 'input_image'; image_url: string }
  | { type: 'input_file'; file_name: string; file_content: string };

// 推理摘要部分
export type SummaryPart =
  | { type: 'summary_text'; text: string }
  | { type: 'summary_image'; image_url: string };

// InputItem - 发送给模型的输入项目
export type InputItem =
  | MessageItem
  | ReasoningItem
  | FunctionCallItem
  | FunctionCallOutputItem
  | CompactionItem;

// OutputItem - 模型输出的项目
export type OutputItem =
  | MessageItem
  | ReasoningItem
  | FunctionCallItem;

// 消息项目
export interface MessageItem {
  type: 'message';
  role: MessageRole;
  content: ContentPart[];
  // 兼容旧代码的便捷属性
  id?: string;
  agentId?: string;
  timestamp?: number;
}

// 推理项目
export interface ReasoningItem {
  type: 'reasoning';
  summary: SummaryPart[];
  encrypted_content?: string; // 加密的完整推理内容（可选）
}

// 函数调用项目
export interface FunctionCallItem {
  type: 'function_call';
  name: string;
  arguments: string; // JSON 字符串
  call_id: string;
}

// 函数调用结果项目
export interface FunctionCallOutputItem {
  type: 'function_call_output';
  call_id: string;
  output: string;
}

// 压缩项目 - 用于上下文压缩
export interface CompactionItem {
  type: 'compaction';
  encrypted_content: string; // 压缩后的加密内容
  summary: SummaryPart[]; // 人类可读的摘要
  original_message_count: number; // 原始消息数量
}

// ============================================================
// 工具类型定义
// ============================================================

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface ToolDefinition {
  type: 'function' | 'web_search' | 'web_search_preview';
  name?: string;
  description?: string;
  parameters?: ToolParameter[];
  strict?: boolean;
  // web_search 特有属性
  external_web_access?: boolean;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON 字符串
  };
}

export interface ToolResult {
  success: boolean;
  data: unknown;
  error?: string;
  executionTime: number;
}

// ============================================================
// Agent Loop 相关类型
// ============================================================

// Agent Loop 运行状态
export type AgentLoopStatus =
  | 'idle'
  | 'thinking'
  | 'calling_tool'
  | 'executing_tool'
  | 'responding'
  | 'completed'
  | 'error';

// Agent Loop 迭代记录
export interface AgentLoopIteration {
  iteration: number;
  input: InputItem[];
  output: OutputItem[];
  toolCalls?: ToolCallRecord[];
  duration: number;
}

// 工具调用记录
export interface ToolCallRecord {
  call_id: string;
  name: string;
  arguments: unknown;
  result: ToolResult;
  startTime: number;
  endTime: number;
}

// Agent Loop 结果
export interface AgentLoopResult {
  finalMessage: MessageItem;
  iterations: AgentLoopIteration[];
  totalDuration: number;
  toolCallsCount: number;
  wasCompacted: boolean;
}

// ============================================================
// 流式响应相关类型
// ============================================================

// 流式事件类型（类似 OpenAI Responses API）
export type StreamEventType =
  | 'response.created'
  | 'response.in_progress'
  | 'response.reasoning_summary_text.delta'
  | 'response.reasoning_summary_text.done'
  | 'response.output_item.added'
  | 'response.output_text.delta'
  | 'response.output_text.done'
  | 'response.function_call_arguments.delta'
  | 'response.function_call_arguments.done'
  | 'response.completed'
  | 'response.error';

export interface StreamEvent {
  type: StreamEventType;
  item?: OutputItem;
  delta?: string;
  item_id?: string;
  response?: unknown;
  error?: string;
}

// ============================================================
// 上下文管理相关类型
// ============================================================

export interface ContextStats {
  totalMessages: number;
  estimatedTokens: number;
  contextLimit: number;
  usagePercentage: number;
}

export interface ContextManagerState {
  stats: ContextStats;
  gentleStats: ContextStats;
  angryStats: ContextStats;
  isCompacted: boolean;
  compactionHistory: CompactionRecord[];
}

export interface CompactionRecord {
  timestamp: number;
  originalMessageCount: number;
  compactedMessageCount: number;
  summary: string;
}

// ============================================================
// 传统类型（向后兼容）
// ============================================================

export interface AgentState {
  isStreaming: boolean;
  currentContent: string;
  currentReasoning: string;
  messages: ChatMessage[];
}

export interface DebateRound {
  round: number;
  gentleResponse: ChatMessage;
  angryResponse: ChatMessage;
}

export interface DebateSession {
  id: string;
  title: string;
  userQuestion: string;
  createdAt: number;
  updatedAt: number;
  rounds: DebateRound[];
  maxRounds: number;
  gentleConfig: AgentConfig;
  angryConfig: AgentConfig;
  mode: AgentMode;
}

// ============================================================
// API 适配器接口
// ============================================================

export interface APIAdapter {
  buildRequest(messages: Message[], config: AgentConfig): RequestInit;
  parseStream(chunk: string): StreamChunk | null;
  getEndpoint(): string;
}

// 新的统一适配器接口（支持 InputItem）
export interface UnifiedAPIAdapter {
  buildRequest(input: InputItem[], config: AgentConfig, tools?: ToolDefinition[]): RequestInit;
  parseStreamEvents(chunk: string): StreamEvent[];
  getEndpoint(): string;
  convertToInputItems(response: unknown): OutputItem[];
  estimateTokens(input: InputItem[]): number;
}

// 从 helpers.ts 重新导出所有工具函数
export * from './helpers';
