import type { AgentConfig, Message, ChatMessage, DebateRound, StreamChunk, DebateSession } from '../types';
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
  private fullMessageHistory: Message[] = []; // 累积完整对话历史

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
  }

  getDebateHistory(): DebateRound[] {
    return [...this.debateHistory];
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  // 加载历史会话并恢复上下文
  loadSession(session: DebateSession): Message[] {
    this.reset();
    this.currentSessionId = session.id;
    this.debateHistory = [...session.rounds];
    this.currentRound = session.rounds.length;

    // 重建完整消息历史
    const messages: Message[] = [];

    if (session.rounds.length > 0) {
      // 第一轮包含用户问题
      messages.push({ role: 'user', content: session.userQuestion });

      session.rounds.forEach((round, index) => {
        // Gentle的回复
        messages.push({
          role: 'assistant',
          content: round.gentleResponse.content,
        });

        // 如果不是最后一轮，添加用户引导下一轮的提示
        if (index < session.rounds.length - 1) {
          messages.push({
            role: 'user',
            content: `另一位助手回复："${round.angryResponse.content}"\n\n请继续讨论。`,
          });
        }
      });
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
    // 智能处理baseURL，避免重复的/v1路径
    let baseURL = config.baseURL.replace(/\/$/, '');
    const apiPath = adapter.getEndpoint(); // e.g. /v1/chat/completions

    // 如果baseURL已经包含/v1，且apiPath也以/v1开头，则去掉baseURL末尾的/v1
    if (baseURL.endsWith('/v1') && apiPath.startsWith('/v1/')) {
      baseURL = baseURL.slice(0, -3); // 移除末尾的/v1
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

      // Process remaining buffer
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

  async runDebate(
    userQuestion: string,
    onChunk: StreamCallback,
    signal?: AbortSignal
  ): Promise<void> {
    this.reset();

    // 创建新会话
    const session = debateStorage.createSession(
      userQuestion,
      this.gentleConfig,
      this.angryConfig
    );
    this.currentSessionId = session.id;

    const maxRounds = Math.min(
      this.gentleConfig.maxRounds,
      this.angryConfig.maxRounds
    );

    // 初始化完整消息历史，包含用户问题
    this.fullMessageHistory = [
      { role: 'user', content: userQuestion },
    ];

    // Round 1: Gentle Agent 基于用户问题回复
    this.currentRound = 1;

    const gentleResponse = await this.streamResponse(
      this.gentleConfig,
      [...this.fullMessageHistory], // 发送完整历史
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

    // 将Gentle的回复加入历史
    this.fullMessageHistory.push({
      role: 'assistant',
      content: gentleResponse,
    });

    // Round 1: Angry Agent 看到用户问题和Gentle的回复
    // 添加用户引导，让Angry知道要反驳
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

    // 将Angry的回复加入历史（作为assistant，但在下一轮会添加user引导）
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

    // Additional rounds - 每轮都累积完整历史
    for (let round = 2; round <= maxRounds; round++) {
      this.currentRound = round;

      // Gentle回应Angry - 使用累积的完整历史
      // 添加用户引导，让Gentle回应反驳
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

      // 更新历史
      this.fullMessageHistory.push({
        role: 'assistant',
        content: gentleResponseNext,
      });

      // Angry回应 - 使用更新后的完整历史
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

      // 更新历史
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

  // 继续已有会话进行额外轮次
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

      // 获取最后一轮的回复
      const lastRound = this.debateHistory[this.debateHistory.length - 1];
      const lastGentleResponse = lastRound.gentleResponse.content;
      const lastAngryResponse = lastRound.angryResponse.content;

      // Gentle先回应
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

      // Angry回应
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
