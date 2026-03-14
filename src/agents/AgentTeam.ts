import type { AgentConfig, Message, ChatMessage, DebateRound, StreamChunk } from '../types';
import { OpenAIAdapter } from './OpenAIAdapter';
import { AnthropicAdapter } from './AnthropicAdapter';

export type StreamCallback = (agentId: string, chunk: StreamChunk) => void;

export class AgentTeam {
  private gentleConfig: AgentConfig;
  private angryConfig: AgentConfig;
  private debateHistory: DebateRound[] = [];
  private currentRound = 0;

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
  }

  getDebateHistory(): DebateRound[] {
    return [...this.debateHistory];
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
    const endpoint = config.baseURL.replace(/\/$/, '') + adapter.getEndpoint();
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
    const maxRounds = Math.min(
      this.gentleConfig.maxRounds,
      this.angryConfig.maxRounds
    );

    // Round 1: Gentle Agent responds to user
    this.currentRound = 1;
    const gentleMessages: Message[] = [
      { role: 'user', content: userQuestion },
    ];

    const gentleResponse = await this.streamResponse(
      this.gentleConfig,
      gentleMessages,
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

    // Round 1: Angry Agent responds to user and comments on Gentle's response
    const angryRound1Messages: Message[] = [
      { role: 'user', content: userQuestion },
      {
        role: 'assistant',
        content: `另一位助手刚刚这样回答："${gentleResponse}"\n\n请给出你的观点，并指出上述回答中你可能不同意的地方。`,
      },
    ];

    const angryResponse1 = await this.streamResponse(
      this.angryConfig,
      angryRound1Messages,
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

    this.debateHistory.push({
      round: 1,
      gentleResponse: gentleMessage,
      angryResponse: angryMessage1,
    });

    // Additional rounds
    for (let round = 2; round <= maxRounds; round++) {
      this.currentRound = round;

      // Gentle responds to Angry
      const gentleDebateMessages: Message[] = [
        { role: 'user', content: userQuestion },
        { role: 'assistant', content: gentleResponse },
        { role: 'user', content: `另一位助手反驳道："${angryResponse1}"\n\n请回应这个反驳，解释你的观点或者承认对方合理的部分。这是第${round}轮讨论。` },
      ];

      const gentleResponseNext = await this.streamResponse(
        this.gentleConfig,
        gentleDebateMessages,
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

      // Angry responds back
      const angryDebateMessages: Message[] = [
        { role: 'user', content: userQuestion },
        { role: 'assistant', content: angryResponse1 },
        { role: 'user', content: `另一位助手回应道："${gentleResponseNext}"\n\n请继续辩论，坚持你的观点或者提出新的反驳。这是第${round}轮讨论。` },
      ];

      const angryResponseNext = await this.streamResponse(
        this.angryConfig,
        angryDebateMessages,
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

      this.debateHistory.push({
        round,
        gentleResponse: gentleMessageNext,
        angryResponse: angryMessageNext,
      });
    }
  }
}
