import type { AgentConfig, Message, ChatMessage, DebateRound, StreamChunk, DebateSession, AgentMode } from '../types';
import { OpenAIAdapter } from './OpenAIAdapter';
import { AnthropicAdapter } from './AnthropicAdapter';
import { debateStorage } from '../stores/debateStorage';
import { getEndingPrompt } from '../prompts';
import { calculateContextStats, compactMessages, shouldCompact, type ContextStats } from '../utils/tokenCounter';

export type StreamCallback = (agentId: string, chunk: StreamChunk) => void;
export type RoundCompleteCallback = (round: number, shouldEnd: boolean) => void;
export type ContextUpdateCallback = (stats: ContextStats, gentleConfig: AgentConfig, angryConfig: AgentConfig) => void;

interface EndingCheckResult {
  shouldEnd: boolean;
  reason?: string;
}

export interface ContextManagerState {
  stats: ContextStats;
  gentleStats: ContextStats;
  angryStats: ContextStats;
  isCompacted: boolean;
}

export class AgentTeam {
  private gentleConfig: AgentConfig;
  private angryConfig: AgentConfig;
  private debateHistory: DebateRound[] = [];
  private currentRound = 0;
  private currentSessionId: string | null = null;
  private fullMessageHistory: Message[] = [];
  private mode: AgentMode = 'double';
  private maxAutoRounds = 10; // 防止无限循环的安全上限
  private shouldStop = false; // 停止标志
  private onContextUpdate?: ContextUpdateCallback;

  constructor(gentleConfig: AgentConfig, angryConfig: AgentConfig) {
    this.gentleConfig = gentleConfig;
    this.angryConfig = angryConfig;
  }

  updateConfigs(gentleConfig: AgentConfig, angryConfig: AgentConfig) {
    this.gentleConfig = gentleConfig;
    this.angryConfig = angryConfig;
  }

  reset() {
    this.debateHistory = [];
    this.currentRound = 0;
    this.currentSessionId = null;
    this.fullMessageHistory = [];
    this.mode = 'double';
    this.shouldStop = false;
  }

  getDebateHistory(): DebateRound[] {
    return [...this.debateHistory];
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  getMode(): AgentMode {
    return this.mode;
  }

  setMaxAutoRounds(max: number) {
    this.maxAutoRounds = max;
  }

  setContextUpdateCallback(callback: ContextUpdateCallback) {
    this.onContextUpdate = callback;
  }

  // 停止对话
  stop() {
    this.shouldStop = true;
  }

  private checkShouldStop(): boolean {
    return this.shouldStop;
  }

  // 获取上下文统计信息
  getContextStats(): ContextManagerState {
    const gentleStats = calculateContextStats(this.fullMessageHistory, this.gentleConfig.model);
    const angryStats = calculateContextStats(this.fullMessageHistory, this.angryConfig.model);

    return {
      stats: gentleStats,
      gentleStats,
      angryStats,
      isCompacted: false,
    };
  }

  // 手动压缩上下文
  compactContext(): boolean {
    const originalLength = this.fullMessageHistory.length;
    this.fullMessageHistory = compactMessages(this.fullMessageHistory, 4) as Message[];
    const wasCompacted = this.fullMessageHistory.length < originalLength;

    this.updateContextStats();

    return wasCompacted;
  }

  // 检查并自动压缩上下文
  private checkAndAutoCompact(): boolean {
    const stats = this.getContextStats();

    if (shouldCompact(stats.stats, 80)) {
      return this.compactContext();
    }

    return false;
  }

  private updateContextStats() {
    const stats = this.getContextStats();
    this.onContextUpdate?.(stats.stats, this.gentleConfig, this.angryConfig);
  }

  // 加载历史会话并恢复上下文
  loadSession(session: DebateSession): Message[] {
    this.reset();
    this.currentSessionId = session.id;
    this.debateHistory = [...session.rounds];
    this.currentRound = session.rounds.length;
    this.mode = session.mode || 'double';

    const messages: Message[] = [];

    if (session.rounds.length > 0) {
      messages.push({ role: 'user', content: session.userQuestion });

      if (session.mode === 'single') {
        session.rounds.forEach((round) => {
          if (round.gentleResponse.content) {
            messages.push({
              role: 'assistant',
              content: round.gentleResponse.content,
            });
          }
        });
      } else {
        session.rounds.forEach((round) => {
          messages.push({
            role: 'assistant',
            content: round.gentleResponse.content,
          });

          if (round.angryResponse.content) {
            messages.push({
              role: 'assistant',
              content: `[对方回应] ${round.angryResponse.content}`,
            });
          }
        });
      }
    }

    this.fullMessageHistory = messages;
    return messages;
  }

  private getAdapter(apiType: string) {
    return apiType === 'anthropic' ? new AnthropicAdapter() : new OpenAIAdapter();
  }

  private async streamResponse(
    config: AgentConfig,
    messages: Message[],
    onChunk: StreamCallback,
    signal?: AbortSignal
  ): Promise<string> {
    const adapter = this.getAdapter(config.apiType);
    let baseURL = config.baseURL.replace(/\/$/, '');
    const apiPath = adapter.getEndpoint();

    if (baseURL.endsWith('/v1') && apiPath.startsWith('/v1/')) {
      baseURL = baseURL.slice(0, -3);
    }

    const endpoint = baseURL + apiPath;
    const request = adapter.buildRequest(messages, config);

    const response = await fetch(endpoint, {
      ...request,
      signal,
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
    let fullContent = '';
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const chunk = adapter.parseStream(line + '\n');
          if (chunk?.content) {
            fullContent += chunk.content;
            onChunk(config.id, chunk);
          }
        }
      }

      if (buffer) {
        const chunk = adapter.parseStream(buffer);
        if (chunk?.content) {
          fullContent += chunk.content;
          onChunk(config.id, chunk);
        }
      }
    } finally {
      reader.releaseLock();
    }

    return fullContent;
  }

  // 非流式请求（用于结束判断）
  private async request(
    config: AgentConfig,
    messages: Message[],
    signal?: AbortSignal
  ): Promise<string> {
    const adapter = this.getAdapter(config.apiType);
    let baseURL = config.baseURL.replace(/\/$/, '');
    const apiPath = adapter.getEndpoint();

    if (baseURL.endsWith('/v1') && apiPath.startsWith('/v1/')) {
      baseURL = baseURL.slice(0, -3);
    }

    const endpoint = baseURL + apiPath;

    // 复制请求配置但关闭流式
    const requestInit = adapter.buildRequest(messages, config);
    const body = JSON.parse(requestInit.body as string);
    body.stream = false;

    const response = await fetch(endpoint, {
      ...requestInit,
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API错误 (${response.status}): ${errorText}`);
    }

    const data = await response.json();

    // 解析 OpenAI 格式响应
    if (data.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    }

    // 解析 Anthropic 格式响应
    if (data.content?.[0]?.text) {
      return data.content[0].text;
    }

    return '';
  }

  // 检查是否应该结束对话
  private async checkShouldEnd(
    config: AgentConfig,
    conversationHistory: Message[],
    isSingleMode: boolean,
    signal?: AbortSignal
  ): Promise<EndingCheckResult> {
    // 获取角色的结束判断提示
    const endingPrompt = getEndingPrompt(isSingleMode);

    const checkMessages: Message[] = [
      ...conversationHistory,
      { role: 'user', content: endingPrompt },
    ];

    try {
      // 使用 temperature=0 确保确定性输出
      const endingCheckConfig = { ...config, temperature: 0 };
      const response = await this.request(endingCheckConfig, checkMessages, signal);
      const content = response.trim();

      console.log('[EndingCheck] 原始响应:', content.substring(0, 200));

      // 解析结果 - 严格匹配
      const endMatch = content.match(/\[END\]/i);
      const continueMatch = content.match(/\[CONTINUE\]/i);

      if (endMatch) {
        console.log('[EndingCheck] 判断结果: 应该结束');
        return { shouldEnd: true, reason: content };
      }

      if (continueMatch) {
        console.log('[EndingCheck] 判断结果: 继续对话');
        return { shouldEnd: false, reason: content };
      }

      // 如果没有明确标记，根据内容推断
      // 如果响应很短（小于50字符）且不包含继续相关的词，可能想结束
      const lowerContent = content.toLowerCase();
      const hasContinueWords = /继续|还有更多|还没说完|接着|补充/i.test(lowerContent);
      const hasEndWords = /结束|完成|够了|到此为止|over|done/i.test(lowerContent);

      if (hasEndWords && !hasContinueWords && content.length < 100) {
        console.log('[EndingCheck] 推断结果: 应该结束（关键词匹配）');
        return { shouldEnd: true, reason: content };
      }

      console.log('[EndingCheck] 推断结果: 继续对话（无明确标记）');
      return { shouldEnd: false, reason: content };
    } catch (error) {
      console.error('[EndingCheck] 结束判断失败:', error);
      // 出错时默认继续，但超过安全上限会停止
      return { shouldEnd: false };
    }
  }

  // 单Agent对话模式（动态结束）
  async runSingle(
    userQuestion: string,
    onChunk: StreamCallback,
    onRoundComplete?: RoundCompleteCallback,
    signal?: AbortSignal
  ): Promise<void> {
    this.reset();
    this.mode = 'single';

    const session = await debateStorage.createSession(
      userQuestion,
      this.gentleConfig,
      this.angryConfig,
      'single'
    );
    this.currentSessionId = session.id;

    this.fullMessageHistory = [{ role: 'user', content: userQuestion }];
    this.currentRound = 0;

    while (this.currentRound < this.maxAutoRounds) {
      // 检查是否被要求停止
      if (this.checkShouldStop()) {
        break;
      }

      this.currentRound++;

      // 检查并自动压缩上下文
      const wasCompacted = this.checkAndAutoCompact();
      if (wasCompacted) {
        console.log(`[Context] 已自动压缩上下文，当前轮数: ${this.currentRound}`);
      }

      // 更新上下文统计
      this.updateContextStats();

      // 生成回复
      const response = await this.streamResponse(
        this.gentleConfig,
        [...this.fullMessageHistory],
        onChunk,
        signal
      );

      // 检查是否被要求停止
      if (this.checkShouldStop()) {
        break;
      }

      const message: ChatMessage = {
        id: `gentle-${Date.now()}`,
        role: 'assistant',
        content: response,
        agentId: this.gentleConfig.id,
        timestamp: Date.now(),
      };

      this.fullMessageHistory.push({ role: 'assistant', content: response });
      this.updateContextStats();

      const round: DebateRound = {
        round: this.currentRound,
        gentleResponse: message,
        angryResponse: {
          id: 'empty',
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          agentId: 'angry-agent',
        },
      };

      this.debateHistory.push(round);
      if (this.currentSessionId) {
        debateStorage.addRound(this.currentSessionId, round);
      }

      // 检查是否应该结束（第一轮不检查，至少需要一轮回复）
      if (this.currentRound >= 1) {
        const { shouldEnd } = await this.checkShouldEnd(
          this.gentleConfig,
          this.fullMessageHistory,
          true,
          signal
        );

        onRoundComplete?.(this.currentRound, shouldEnd);

        if (shouldEnd || this.checkShouldStop()) {
          break;
        }
      }
    }

    // 如果达到最大轮数，强制结束
    if (this.currentRound >= this.maxAutoRounds) {
      onRoundComplete?.(this.currentRound, true);
    }
  }

  // 双Agent辩论模式（动态结束）
  async runDebate(
    userQuestion: string,
    onChunk: StreamCallback,
    onRoundComplete?: RoundCompleteCallback,
    signal?: AbortSignal
  ): Promise<void> {
    this.reset();
    this.mode = 'double';

    const session = await debateStorage.createSession(
      userQuestion,
      this.gentleConfig,
      this.angryConfig,
      'double'
    );
    this.currentSessionId = session.id;

    this.fullMessageHistory = [{ role: 'user', content: userQuestion }];
    this.currentRound = 0;

    while (this.currentRound < this.maxAutoRounds) {
      // 检查是否被要求停止
      if (this.checkShouldStop()) {
        break;
      }

      this.currentRound++;

      // 检查并自动压缩上下文
      const wasCompacted = this.checkAndAutoCompact();
      if (wasCompacted) {
        console.log(`[Context] 已自动压缩上下文，当前轮数: ${this.currentRound}`);
      }

      // 更新上下文统计
      this.updateContextStats();

      // Gentle Agent 发言
      const gentleContext: Message[] = [...this.fullMessageHistory];

      if (this.currentRound > 1) {
        // 第二轮开始添加辩论引导
        const lastRound = this.debateHistory[this.debateHistory.length - 1];
        gentleContext.push({
          role: 'user',
          content: `另一位助手（暴躁派）回应道："${lastRound.angryResponse.content}"\n\n请继续讨论，这是第${this.currentRound}轮。`,
        });
      }

      const gentleResponse = await this.streamResponse(
        this.gentleConfig,
        gentleContext,
        onChunk,
        signal
      );

      // 检查是否被要求停止
      if (this.checkShouldStop()) {
        break;
      }

      const gentleMessage: ChatMessage = {
        id: `gentle-${Date.now()}`,
        role: 'assistant',
        content: gentleResponse,
        agentId: this.gentleConfig.id,
        timestamp: Date.now(),
      };

      this.fullMessageHistory.push({ role: 'assistant', content: gentleResponse });
      this.updateContextStats();

      // Angry Agent 发言
      const angryContext: Message[] = [
        ...this.fullMessageHistory,
        {
          role: 'user',
          content: this.currentRound === 1
            ? '另一位助手（温和派）刚刚这样回答。请给出你的观点，并指出你可能不同意的地方。'
            : `另一位助手（温和派）回应道："${gentleResponse}"\n\n请继续辩论，这是第${this.currentRound}轮。`,
        },
      ];

      const angryResponse = await this.streamResponse(
        this.angryConfig,
        angryContext,
        onChunk,
        signal
      );

      // 检查是否被要求停止
      if (this.checkShouldStop()) {
        break;
      }

      const angryMessage: ChatMessage = {
        id: `angry-${Date.now()}`,
        role: 'assistant',
        content: angryResponse,
        agentId: this.angryConfig.id,
        timestamp: Date.now(),
      };

      this.fullMessageHistory.push({ role: 'assistant', content: angryResponse });
      this.updateContextStats();

      // 保存本轮
      const round: DebateRound = {
        round: this.currentRound,
        gentleResponse: gentleMessage,
        angryResponse: angryMessage,
      };

      this.debateHistory.push(round);
      if (this.currentSessionId) {
        debateStorage.addRound(this.currentSessionId, round);
      }

      // 检查是否应该结束（第二轮开始检查）
      if (this.currentRound >= 2) {
        // 使用温和Agent来判断是否结束（更保守）
        const { shouldEnd } = await this.checkShouldEnd(
          this.gentleConfig,
          this.fullMessageHistory,
          false,
          signal
        );

        onRoundComplete?.(this.currentRound, shouldEnd);

        if (shouldEnd || this.checkShouldStop()) {
          break;
        }
      }
    }

    // 如果达到最大轮数，强制结束
    if (this.currentRound >= this.maxAutoRounds) {
      onRoundComplete?.(this.currentRound, true);
    }
  }
}
