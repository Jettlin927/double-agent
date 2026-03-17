/**
 * AgentLoop - 核心 Agent 循环实现
 *
 * 参考 OpenAI Codex CLI 的 Agent Loop 架构：
 * - 支持多轮工具调用循环
 * - 统一的消息类型系统 (InputItem/OutputItem)
 * - 流式事件处理
 * - 上下文自动压缩
 * - 持久化存储集成
 */

import type {
  AgentConfig,
  InputItem,
  OutputItem,
  MessageItem,
  ReasoningItem,
  FunctionCallItem,
  FunctionCallOutputItem,
  ToolDefinition,
  ToolCallRecord,
  AgentLoopResult,
  AgentLoopIteration,
  AgentLoopStatus,
  StreamEvent,
  ContextStats,
} from '../types';

import {
  createUserMessage,
  createAssistantMessage,
  createReasoning,
  createFunctionCall,
  createFunctionCallOutput,
  extractTextContent,
  getPendingFunctionCalls,
  estimateTokens,
  cloneInputItems,
} from '../types/helpers';

import { toolRegistry } from '../tools/registry';
import type { ToolContext } from '../tools/types';

// 流式回调类型
export type AgentLoopEventCallback = (event: StreamEvent) => void;
export type AgentLoopStatusCallback = (status: AgentLoopStatus) => void;

interface AgentLoopOptions {
  config: AgentConfig;
  sessionId: string;
  iterationNumber: number;
  maxIterations?: number; // 最大循环迭代次数，防止无限循环
  maxTokens?: number; // 上下文 token 上限
  enableStorage?: boolean; // 是否启用后端存储
  tools?: ToolDefinition[]; // 可用的工具列表
}

interface ToolCallContext extends ToolContext {
  askOtherAgent?: (question: string) => Promise<string>;
  getConversationHistory?: () => string;
}

export class AgentLoop {
  private config: AgentConfig;
  private sessionId: string;
  private iterationNumber: number;
  private maxIterations: number;
  private maxTokens: number;
  private enableStorage: boolean;
  private tools: ToolDefinition[];

  private input: InputItem[] = [];
  private iterations: AgentLoopIteration[] = [];
  private status: AgentLoopStatus = 'idle';
  private currentIteration = 0;
  private wasCompacted = false;
  private totalToolCalls = 0;

  private onEvent?: AgentLoopEventCallback;
  private onStatus?: AgentLoopStatusCallback;
  private abortController?: AbortController;

  constructor(options: AgentLoopOptions) {
    this.config = options.config;
    this.sessionId = options.sessionId;
    this.iterationNumber = options.iterationNumber;
    this.maxIterations = options.maxIterations ?? 10;
    this.maxTokens = options.maxTokens ?? 8000;
    this.enableStorage = options.enableStorage ?? true;
    this.tools = options.tools ?? toolRegistry.getAllTools();
  }

  // 设置回调函数
  setEventCallback(callback: AgentLoopEventCallback) {
    this.onEvent = callback;
  }

  setStatusCallback(callback: AgentLoopStatusCallback) {
    this.onStatus = callback;
  }

  // 获取当前状态
  getStatus(): AgentLoopStatus {
    return this.status;
  }

  // 获取当前输入上下文
  getInput(): InputItem[] {
    return cloneInputItems(this.input);
  }

  // 获取迭代历史
  getIterations(): AgentLoopIteration[] {
    return [...this.iterations];
  }

  // 获取统计信息
  getStats(): ContextStats {
    return {
      totalMessages: this.input.length,
      estimatedTokens: estimateTokens(this.input),
      contextLimit: this.maxTokens,
      usagePercentage: (estimateTokens(this.input) / this.maxTokens) * 100,
    };
  }

  // 中止循环
  abort() {
    this.abortController?.abort();
  }

  // 运行 Agent Loop
  async run(initialInput: InputItem[]): Promise<AgentLoopResult> {
    this.input = cloneInputItems(initialInput);
    this.currentIteration = 0;
    this.iterations = [];
    this.wasCompacted = false;
    this.totalToolCalls = 0;

    this.abortController = new AbortController();
    const startTime = Date.now();

    try {
      // 创建迭代记录（后端存储）
      if (this.enableStorage) {
        await this.createIterationRecord();
      }

      while (this.currentIteration < this.maxIterations) {
        // 检查是否被中止
        if (this.abortController.signal.aborted) {
          break;
        }

        this.currentIteration++;
        const iterationStartTime = Date.now();

        // 更新状态
        this.setStatus('thinking');

        // 发送迭代开始事件
        this.emitEvent({ type: 'response.created' });

        // 调用模型
        const outputItems = await this.callModel();

        // 记录输出
        const iteration: AgentLoopIteration = {
          iteration: this.currentIteration,
          input: cloneInputItems(this.input),
          output: outputItems,
          toolCalls: [],
          duration: Date.now() - iterationStartTime,
        };

        // 处理输出项
        for (const item of outputItems) {
          this.input.push(item);

          // 保存到后端
          if (this.enableStorage) {
            await this.saveMessage(item);
          }

          // 处理工具调用
          if (item.type === 'function_call') {
            this.setStatus('executing_tool');
            const toolRecord = await this.executeToolCall(item);
            iteration.toolCalls?.push(toolRecord);
            this.totalToolCalls++;
          }
        }

        this.iterations.push(iteration);

        // 检查是否生成最终响应（没有工具调用）
        const hasToolCalls = outputItems.some((item) => item.type === 'function_call');
        if (!hasToolCalls) {
          this.setStatus('completed');
          break;
        }

        // 检查上下文是否需要压缩
        if (this.shouldCompactContext()) {
          await this.compactContext();
        }
      }

      // 获取最终消息
      const finalMessage = this.getFinalMessage();

      // 更新迭代记录状态
      if (this.enableStorage) {
        await this.completeIterationRecord(Date.now() - startTime);
      }

      return {
        finalMessage,
        iterations: this.iterations,
        totalDuration: Date.now() - startTime,
        toolCallsCount: this.totalToolCalls,
        wasCompacted: this.wasCompacted,
      };
    } catch (error) {
      this.setStatus('error');
      throw error;
    }
  }

  // 调用模型（流式）
  private async callModel(): Promise<OutputItem[]> {
    const outputItems: OutputItem[] = [];
    let currentReasoning = '';
    let currentContent = '';
    let currentFunctionCall: Partial<FunctionCallItem> | null = null;

    // 构建请求
    const request = this.buildRequest();

    // 发送请求
    const response = await fetch(this.getEndpoint(), {
      ...request,
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API错误 (${response.status}): ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法读取响应流');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const parsed = this.parseStreamLine(line);
          if (!parsed) continue;

          // 处理推理内容
          if (parsed.type === 'response.reasoning_summary_text.delta') {
            currentReasoning += parsed.delta || '';
            this.emitEvent(parsed);
          }

          // 处理文本内容
          if (parsed.type === 'response.output_text.delta') {
            currentContent += parsed.delta || '';
            this.emitEvent(parsed);
          }

          // 处理工具调用参数
          if (parsed.type === 'response.function_call_arguments.delta') {
            if (!currentFunctionCall) {
              currentFunctionCall = {
                type: 'function_call',
                name: parsed.name || '',
                call_id: parsed.call_id || generateCallId(),
              };
            }
            currentFunctionCall.arguments = (currentFunctionCall.arguments || '') + (parsed.delta || '');
            this.emitEvent(parsed);
          }
        }
      }

      // 处理剩余缓冲区
      if (buffer) {
        const parsed = this.parseStreamLine(buffer);
        if (parsed?.type === 'response.output_text.delta') {
          currentContent += parsed.delta || '';
        }
      }
    } finally {
      reader.releaseLock();
    }

    // 构建输出项
    // 1. 推理（如果有）
    if (currentReasoning) {
      const reasoning: ReasoningItem = {
        type: 'reasoning',
        summary: [{ type: 'summary_text', text: currentReasoning }],
      };
      outputItems.push(reasoning);
    }

    // 2. 工具调用（如果有）
    if (currentFunctionCall?.name) {
      const functionCall: FunctionCallItem = {
        type: 'function_call',
        name: currentFunctionCall.name,
        arguments: currentFunctionCall.arguments || '{}',
        call_id: currentFunctionCall.call_id || generateCallId(),
      };
      outputItems.push(functionCall);
    }

    // 3. 助手消息（如果有内容且没有工具调用）
    if (currentContent && !currentFunctionCall?.name) {
      const message: MessageItem = {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: currentContent }],
        agentId: this.config.id,
        timestamp: Date.now(),
      };
      outputItems.push(message);
    }

    this.emitEvent({ type: 'response.completed' });

    return outputItems;
  }

  // 执行工具调用
  private async executeToolCall(functionCall: FunctionCallItem): Promise<ToolCallRecord> {
    const startTime = Date.now();
    const callId = functionCall.call_id;
    const toolName = functionCall.name;

    // 解析参数
    let args: Record<string, unknown>;
    try {
      args = JSON.parse(functionCall.arguments);
    } catch {
      args = {};
    }

    // 创建工具上下文
    const toolContext: ToolCallContext = {
      agentId: this.config.id,
      agentName: this.config.name,
      sessionId: this.sessionId,
    };

    // 执行工具
    const result = await toolRegistry.execute(toolName, args, toolContext);

    // 创建工具调用记录
    const toolRecord: ToolCallRecord = {
      call_id: callId,
      name: toolName,
      arguments: args,
      result: {
        success: result.success,
        data: result.data,
        error: result.error,
        executionTime: result.executionTime,
      },
      startTime,
      endTime: Date.now(),
    };

    // 创建函数调用输出项
    const output: FunctionCallOutputItem = createFunctionCallOutput(
      callId,
      result.success ? result.data : { error: result.error }
    );

    this.input.push(output);

    // 保存到后端
    if (this.enableStorage) {
      await this.saveMessage(output);
    }

    return toolRecord;
  }

  // 构建 API 请求
  private buildRequest(): RequestInit {
    const baseURL = this.config.baseURL.replace(/\/$/, '');
    const messages = this.inputToMessages();

    return {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: this.config.systemPrompt },
          ...messages,
        ],
        temperature: this.config.temperature,
        stream: true,
        ...(this.tools.length > 0 && {
          tools: this.toolsToOpenAITools(),
          tool_choice: 'auto',
        }),
      }),
    };
  }

  // 获取 API 端点
  private getEndpoint(): string {
    const baseURL = this.config.baseURL.replace(/\/$/, '');
    return `${baseURL}/v1/chat/completions`;
  }

  // 将 InputItem 转换为 Message 格式
  private inputToMessages(): Array<{ role: string; content: string }> {
    return this.input
      .filter((item): item is MessageItem | FunctionCallItem | FunctionCallOutputItem =>
        item.type === 'message' || item.type === 'function_call' || item.type === 'function_call_output'
      )
      .map((item) => {
        if (item.type === 'message') {
          return {
            role: item.role,
            content: extractTextContent(item.content),
          };
        } else if (item.type === 'function_call') {
          return {
            role: 'assistant',
            content: `调用工具: ${item.name}(${item.arguments})`,
          };
        } else {
          return {
            role: 'tool',
            content: item.output,
          };
        }
      });
  }

  // 将工具定义转换为 OpenAI 格式
  private toolsToOpenAITools(): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: {
        type: 'object';
        properties: Record<string, unknown>;
        required: string[];
      };
    };
  }> {
    return this.tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object' as const,
          properties: tool.parameters.reduce((acc, param) => {
            acc[param.name] = {
              type: param.type,
              description: param.description,
              ...(param.enum && { enum: param.enum }),
            };
            return acc;
          }, {} as Record<string, unknown>),
          required: tool.parameters.filter((p) => p.required !== false).map((p) => p.name),
        },
      },
    }));
  }

  // 解析流式响应行
  private parseStreamLine(line: string): StreamEvent | null {
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'data: [DONE]') {
      if (trimmed === 'data: [DONE]') {
        return { type: 'response.completed' };
      }
      return null;
    }

    if (!trimmed.startsWith('data: ')) {
      return null;
    }

    try {
      const data = JSON.parse(trimmed.slice(6));

      if (data.choices?.[0]) {
        const delta = data.choices[0].delta;

        // 处理工具调用
        if (delta?.tool_calls) {
          const toolCall = delta.tool_calls[0];
          return {
            type: 'response.function_call_arguments.delta',
            delta: toolCall.function?.arguments || '',
            name: toolCall.function?.name,
            call_id: toolCall.id,
          };
        }

        // 处理推理内容
        if (delta?.reasoning_content) {
          return {
            type: 'response.reasoning_summary_text.delta',
            delta: delta.reasoning_content,
          };
        }

        // 处理普通内容
        if (delta?.content) {
          return {
            type: 'response.output_text.delta',
            delta: delta.content,
          };
        }
      }
    } catch {
      // 解析失败返回 null
    }

    return null;
  }

  // 获取最终消息
  private getFinalMessage(): MessageItem {
    // 从后往前找最后一条 assistant 消息
    for (let i = this.input.length - 1; i >= 0; i--) {
      const item = this.input[i];
      if (item.type === 'message' && item.role === 'assistant') {
        return item;
      }
    }

    // 如果没有找到，返回空消息
    return {
      type: 'message',
      role: 'assistant',
      content: [{ type: 'output_text', text: '' }],
      agentId: this.config.id,
      timestamp: Date.now(),
    };
  }

  // 检查是否需要压缩上下文
  private shouldCompactContext(): boolean {
    const stats = this.getStats();
    return stats.usagePercentage > 80;
  }

  // 压缩上下文
  private async compactContext(): Promise<void> {
    // 简化的压缩策略：保留系统消息、最近的用户消息和助手消息
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

    console.log(`[AgentLoop] 上下文已压缩，当前消息数: ${this.input.length}`);
  }

  // 设置状态
  private setStatus(status: AgentLoopStatus) {
    this.status = status;
    this.onStatus?.(status);
  }

  // 发送事件
  private emitEvent(event: StreamEvent) {
    this.onEvent?.(event);
  }

  // 创建后端迭代记录
  private async createIterationRecord(): Promise<void> {
    try {
      const response = await fetch('/api/messages/iterations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: this.sessionId,
          agent_id: this.config.id,
          agent_name: this.config.name,
          round_number: 1,
          iteration_number: this.iterationNumber,
        }),
      });

      if (!response.ok) {
        console.warn('[AgentLoop] 创建迭代记录失败:', response.status);
      }
    } catch (error) {
      console.warn('[AgentLoop] 创建迭代记录错误:', error);
    }
  }

  // 保存消息到后端
  private async saveMessage(item: InputItem): Promise<void> {
    try {
      const response = await fetch(`/api/messages/iterations/${this.iterationNumber}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.inputItemToMessageCreate(item)),
      });

      if (!response.ok) {
        console.warn('[AgentLoop] 保存消息失败:', response.status);
      }
    } catch (error) {
      console.warn('[AgentLoop] 保存消息错误:', error);
    }
  }

  // 完成迭代记录
  private async completeIterationRecord(duration: number): Promise<void> {
    try {
      const response = await fetch(`/api/messages/iterations/${this.iterationNumber}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          duration_ms: duration,
        }),
      });

      if (!response.ok) {
        console.warn('[AgentLoop] 更新迭代状态失败:', response.status);
      }
    } catch (error) {
      console.warn('[AgentLoop] 更新迭代状态错误:', error);
    }
  }

  // 将 InputItem 转换为消息创建格式
  private inputItemToMessageCreate(item: InputItem): Record<string, unknown> {
    const base = {
      item_type: item.type,
      sequence: this.input.indexOf(item),
    };

    switch (item.type) {
      case 'message':
        return {
          ...base,
          role: item.role,
          content: item.content,
          agent_id: item.agentId,
          timestamp: item.timestamp,
        };
      case 'reasoning':
        return {
          ...base,
          summary: item.summary,
          encrypted_content: item.encrypted_content,
        };
      case 'function_call':
        return {
          ...base,
          name: item.name,
          arguments: item.arguments,
          call_id: item.call_id,
        };
      case 'function_call_output':
        return {
          ...base,
          call_id: item.call_id,
          output: item.output,
        };
      case 'compaction':
        return {
          ...base,
          encrypted_content: item.encrypted_content,
          summary: item.summary,
          original_message_count: item.original_message_count,
        };
      default:
        return base;
    }
  }
}

// 生成 call_id
function generateCallId(): string {
  return `call_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}
