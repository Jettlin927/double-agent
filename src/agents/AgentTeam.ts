import type { AgentConfig, Message, ChatMessage, DebateRound, StreamChunk, DebateSession, AgentMode } from '../types';
import { OpenAIAdapter } from './OpenAIAdapter';
import { AnthropicAdapter } from './AnthropicAdapter';
import { debateStorage } from '../stores/debateStorage';
import { getEndingPrompt, getRoleById } from '../prompts';

export type StreamCallback = (agentId: string, chunk: StreamChunk) => void;
export type RoundCompleteCallback = (round: number, shouldEnd: boolean) => void;

interface EndingCheckResult {
  shouldEnd: boolean;
  reason?: string;
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
        session.rounds.forEach((round, index) => {
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
    const endingPrompt = getEndingPrompt(config.systemPrompt, isSingleMode);

    const checkMessages: Message[] = [
      ...conversationHistory,
      { role: 'user', content: endingPrompt },
    ];

    try {
      const response = await this.request(config, checkMessages, signal);
      const content = response.trim();

      // 解析结果
      if (content.includes('[END]')) {
        return { shouldEnd: true, reason: content };
      }

      return { shouldEnd: false, reason: content };
    } catch (error) {
      console.error('结束判断失败:', error);
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

    const session = debateStorage.createSession(
      userQuestion,
      this.gentleConfig,
      this.angryConfig,
      'single'
    );
    this.currentSessionId = session.id;

    this.fullMessageHistory = [{ role: 'user', content: userQuestion }];
    this.currentRound = 0;

    while (this.currentRound < this.maxAutoRounds) {
      this.currentRound++;

      // 生成回复
      const response = await this.streamResponse(
        this.gentleConfig,
        [...this.fullMessageHistory],
        onChunk,
        signal
      );

      const message: ChatMessage = {
        id: `gentle-${Date.now()}`,
        role: 'assistant',
        content: response,
        agentId: this.gentleConfig.id,
        timestamp: Date.now(),
      };

      this.fullMessageHistory.push({ role: 'assistant', content: response });

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
      debateStorage.addRound(this.currentSessionId, round);

      // 检查是否应该结束（第一轮不检查，至少需要一轮回复）
      if (this.currentRound >= 1) {
        const { shouldEnd } = await this.checkShouldEnd(
          this.gentleConfig,
          this.fullMessageHistory,
          true,
          signal
        );

        onRoundComplete?.(this.currentRound, shouldEnd);

        if (shouldEnd) {
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

    const session = debateStorage.createSession(
      userQuestion,
      this.gentleConfig,
      this.angryConfig,
      'double'
    );
    this.currentSessionId = session.id;

    this.fullMessageHistory = [{ role: 'user', content: userQuestion }];
    this.currentRound = 0;

    while (this.currentRound < this.maxAutoRounds) {
      this.currentRound++;

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

      const gentleMessage: ChatMessage = {
        id: `gentle-${Date.now()}`,
        role: 'assistant',
        content: gentleResponse,
        agentId: this.gentleConfig.id,
        timestamp: Date.now(),
      };

      this.fullMessageHistory.push({ role: 'assistant', content: gentleResponse });

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

      const angryMessage: ChatMessage = {
        id: `angry-${Date.now()}`,
        role: 'assistant',
        content: angryResponse,
        agentId: this.angryConfig.id,
        timestamp: Date.now(),
      };

      this.fullMessageHistory.push({ role: 'assistant', content: angryResponse });

      // 保存本轮
      const round: DebateRound = {
        round: this.currentRound,
        gentleResponse: gentleMessage,
        angryResponse: angryMessage,
      };

      this.debateHistory.push(round);
      debateStorage.addRound(this.currentSessionId, round);

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

        if (shouldEnd) {
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
