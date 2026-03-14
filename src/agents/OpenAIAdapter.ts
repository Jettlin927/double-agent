import type { APIAdapter, AgentConfig, Message, StreamChunk } from '../types';

export class OpenAIAdapter implements APIAdapter {
  getEndpoint(): string {
    return '/v1/chat/completions';
  }

  buildRequest(messages: Message[], config: AgentConfig): RequestInit {
    return {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: config.systemPrompt },
          ...messages,
        ],
        temperature: config.temperature,
        stream: true,
        stream_options: {
          include_usage: true,
        },
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
      if (!trimmed || trimmed === 'data: [DONE]') {
        if (trimmed === 'data: [DONE]') {
          done = true;
        }
        continue;
      }

      if (trimmed.startsWith('data: ')) {
        try {
          const data = JSON.parse(trimmed.slice(6));

          if (data.choices && data.choices[0]) {
            const delta = data.choices[0].delta;

            // Handle reasoning content (some models support this)
            if (delta?.reasoning_content) {
              reasoning += delta.reasoning_content;
            }

            // Handle regular content
            if (delta?.content) {
              content += delta.content;
            }
          }

          if (data.usage) {
            done = true;
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
