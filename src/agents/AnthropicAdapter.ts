import type { APIAdapter, AgentConfig, Message, StreamChunk } from '../types';

export class AnthropicAdapter implements APIAdapter {
  getEndpoint(): string {
    return '/v1/messages';
  }

  buildRequest(messages: Message[], config: AgentConfig): RequestInit {
    // Separate system message from other messages
    const systemMessage = messages.find(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');

    return {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 4096,
        temperature: config.temperature,
        system: systemMessage?.content || config.systemPrompt,
        messages: otherMessages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
      }),
    };
  }

  parseStream(chunk: string): StreamChunk | null {
    const lines = chunk.split('\n');
    let content = '';
    let reasoning = '';
    let done = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Handle event types
      if (trimmed.startsWith('event: ')) {
        const event = trimmed.slice(7);
        if (event === 'message_stop') {
          done = true;
        }
        continue;
      }

      if (trimmed.startsWith('data: ')) {
        try {
          const data = JSON.parse(trimmed.slice(6));

          // Handle content block delta
          if (data.type === 'content_block_delta') {
            if (data.delta?.text) {
              content += data.delta.text;
            }
            if (data.delta?.thinking) {
              reasoning += data.delta.thinking;
            }
          }

          // Handle content block start (for thinking blocks)
          if (data.type === 'content_block_start') {
            if (data.content_block?.type === 'thinking') {
              reasoning += data.content_block.thinking || '';
            }
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }

    if (content || reasoning || done) {
      return { content, reasoning, done };
    }

    return null;
  }
}
