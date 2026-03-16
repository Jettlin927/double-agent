import type { AgentConfig, Message, ChatMessage, DebateRound, StreamChunk, DebateSession, AgentMode } from '../types';
import { OpenAIAdapter } from './OpenAIAdapter';
import { AnthropicAdapter } from './AnthropicAdapter';
import { debateStorage } from '../stores/debateStorage';

export type StreamCallback = (agentId: string, chunk: StreamChunk) => void;

export class AgentTeam {
  private gentleConfig: AgentConfig;
  private angryConfig: AgentConfig;
  private debateHistory: DebateRound[] = [];
  private currentRound = 0;
  private currentSessionId: string | null = null;
  private fullMessageHistory: Message[] = [];
  private mode: AgentMode = 'double';

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
        // 单Agent模式：只有gentleResponse
        session.rounds.forEach((round) => {
          messages.push({
            role: 'assistant',
            content: round.gentleResponse.content,
          });
        });
      } else {
        // 双Agent模式：两个Agent都有
        session.rounds.forEach((round, index) => {
          messages.push({
            role: 'assistant',
            content: round.gentleResponse.content,
          });

          if (index < session.rounds.length - 1) {
            messages.push({
              role: 'user',
              content: `另一位助手回复："${round.angryResponse.content}"\n\n请继续讨论。`,
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
      console.error(`[API 404 Debug] 请求URL: ${endpoint}`);
      console.error(`[API 404 Debug] Base URL: ${config.baseURL}`);
      console.error(`[API 404 Debug] API类型: ${config.apiType}`);
      throw new Error(`API错误 (${response.status}): ${errorText} (请求URL: ${endpoint})`);
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
          if (chunk) {
            if (chunk.content) {
              fullContent += chunk.content;
            }
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

  // 单Agent对话模式
  async runSingle(
    userQuestion: string,
    onChunk: StreamCallback,
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

    this.fullMessageHistory = [
      { role: 'user', content: userQuestion },
    ];

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

    this.fullMessageHistory.push({
      role: 'assistant',
      content: response,
    });

    // 单Agent模式下，angryResponse为空占位
    const round: DebateRound = {
      round: 1,
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
  }

  // 双Agent辩论模式
  async runDebate(
    userQuestion: string,
    onChunk: StreamCallback,
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

    const maxRounds = Math.min(
      this.gentleConfig.maxRounds,
      this.angryConfig.maxRounds
    );

    this.fullMessageHistory = [
      { role: 'user', content: userQuestion },
    ];

    this.currentRound = 1;

    const gentleResponse = await this.streamResponse(
      this.gentleConfig,
      [...this.fullMessageHistory],
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

    this.fullMessageHistory.push({
      role: 'assistant',
      content: gentleResponse,
    });

    const angryContext: Message[] = [
      ...this.fullMessageHistory,
      {
        role: 'user',
        content: `另一位助手（温和派）刚刚这样回答。请给出你的观点，并指出你可能不同意的地方。保持你直率、批判性的风格。`,
      },
    ];

    const angryResponse1 = await this.streamResponse(
      this.angryConfig,
      angryContext,
      onChunk,
      signal
    );

    const angryMessage1: ChatMessage = {
      id: `angry-${Date.now()}`,
      role: 'assistant',
      content: angryResponse1,
      agentId: this.angryConfig.id,
      timestamp: Date.now(),
    };

    this.fullMessageHistory.push({
      role: 'assistant',
      content: angryResponse1,
    });

    const round1: DebateRound = {
      round: 1,
      gentleResponse: gentleMessage,
      angryResponse: angryMessage1,
    };

    this.debateHistory.push(round1);
    debateStorage.addRound(this.currentSessionId, round1);

    for (let round = 2; round <= maxRounds; round++) {
      this.currentRound = round;

      const gentleContext: Message[] = [
        ...this.fullMessageHistory,
        {
          role: 'user',
          content: `另一位助手（暴躁派）反驳道："${angryResponse1}"\n\n请回应这个反驳，解释你的观点或者承认对方合理的部分。这是第${round}轮讨论。保持你温和、理性的风格。`,
        },
      ];

      const gentleResponseNext = await this.streamResponse(
        this.gentleConfig,
        gentleContext,
        onChunk,
        signal
      );

      const gentleMessageNext: ChatMessage = {
        id: `gentle-${Date.now()}-${round}`,
        role: 'assistant',
        content: gentleResponseNext,
        agentId: this.gentleConfig.id,
        timestamp: Date.now(),
      };

      this.fullMessageHistory.push({
        role: 'assistant',
        content: gentleResponseNext,
      });

      const angryContextNext: Message[] = [
        ...this.fullMessageHistory,
        {
          role: 'user',
          content: `另一位助手（温和派）回应道："${gentleResponseNext}"\n\n请继续辩论，坚持你的观点或者提出新的反驳。这是第${round}轮讨论。保持你直率、批判性的风格。`,
        },
      ];

      const angryResponseNext = await this.streamResponse(
        this.angryConfig,
        angryContextNext,
        onChunk,
        signal
      );

      const angryMessageNext: ChatMessage = {
        id: `angry-${Date.now()}-${round}`,
        role: 'assistant',
        content: angryResponseNext,
        agentId: this.angryConfig.id,
        timestamp: Date.now(),
      };

      this.fullMessageHistory.push({
        role: 'assistant',
        content: angryResponseNext,
      });

      const roundData: DebateRound = {
        round,
        gentleResponse: gentleMessageNext,
        angryResponse: angryMessageNext,
      };

      this.debateHistory.push(roundData);
      debateStorage.addRound(this.currentSessionId, roundData);
    }
  }

  async continueDebate(
    additionalRounds: number,
    onChunk: StreamCallback,
    signal?: AbortSignal
  ): Promise<void> {
    if (!this.currentSessionId || this.debateHistory.length === 0) {
      throw new Error('没有可继续的会话');
    }

    const startRound = this.currentRound + 1;
    const endRound = this.currentRound + additionalRounds;

    for (let round = startRound; round <= endRound; round++) {
      this.currentRound = round;

      const lastRound = this.debateHistory[this.debateHistory.length - 1];
      const lastGentleResponse = lastRound.gentleResponse.content;
      const lastAngryResponse = lastRound.angryResponse.content;

      const gentleContext: Message[] = [
        ...this.fullMessageHistory,
        {
          role: 'user',
          content: `另一位助手（暴躁派）说："${lastAngryResponse}"\n\n请回应。这是第${round}轮讨论。`,
        },
      ];

      const gentleResponseNext = await this.streamResponse(
        this.gentleConfig,
        gentleContext,
        onChunk,
        signal
      );

      const gentleMessageNext: ChatMessage = {
        id: `gentle-${Date.now()}-${round}`,
        role: 'assistant',
        content: gentleResponseNext,
        agentId: this.gentleConfig.id,
        timestamp: Date.now(),
      };

      this.fullMessageHistory.push({
        role: 'assistant',
        content: gentleResponseNext,
      });

      const angryContextNext: Message[] = [
        ...this.fullMessageHistory,
        {
          role: 'user',
          content: `另一位助手（温和派）说："${gentleResponseNext}"\n\n请回应。这是第${round}轮讨论。`,
        },
      ];

      const angryResponseNext = await this.streamResponse(
        this.angryConfig,
        angryContextNext,
        onChunk,
        signal
      );

      const angryMessageNext: ChatMessage = {
        id: `angry-${Date.now()}-${round}`,
        role: 'assistant',
        content: angryResponseNext,
        agentId: this.angryConfig.id,
        timestamp: Date.now(),
      };

      this.fullMessageHistory.push({
        role: 'assistant',
        content: angryResponseNext,
      });

      const roundData: DebateRound = {
        round,
        gentleResponse: gentleMessageNext,
        angryResponse: angryMessageNext,
      };

      this.debateHistory.push(roundData);
      debateStorage.addRound(this.currentSessionId, roundData);
    }
  }
}
