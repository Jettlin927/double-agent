import type { AgentConfig, DebateSession, DebateRound, AgentMode } from '../types';

const API_BASE = '/api';

export interface DebateRequest {
  session_id?: string;
  question: string;
  mode: AgentMode;
  gentle_config: AgentConfig;
  angry_config: AgentConfig;
}

export interface StreamChunkEvent {
  type: 'chunk';
  agent_id: 'gentle' | 'angry';
  content?: string;
  reasoning?: string;
}

export interface StreamRoundCompleteEvent {
  type: 'round_complete';
  round: number;
  should_end: boolean;
}

export interface StreamErrorEvent {
  type: 'error';
  message: string;
}

export interface StreamCompleteEvent {
  type: 'complete';
  session_id: string;
  total_rounds: number;
}

export type StreamEvent =
  | StreamChunkEvent
  | StreamRoundCompleteEvent
  | StreamErrorEvent
  | StreamCompleteEvent;

export interface CreateSessionRequest {
  user_question: string;
  gentle_config: AgentConfig;
  angry_config: AgentConfig;
  mode: AgentMode;
}

class ApiClient {
  private async fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async *streamDebate(request: DebateRequest): AsyncGenerator<StreamEvent> {
    const response = await fetch(`${API_BASE}/debate/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
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
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              return;
            }
            try {
              const event: StreamEvent = JSON.parse(data);
              yield event;
            } catch (e) {
              console.error('Failed to parse SSE data:', data, e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // Session management
  async getSessions(): Promise<DebateSession[]> {
    const response = await this.fetchJson<{ sessions: DebateSession[]; total: number }>('/sessions');
    return response.sessions;
  }

  async createSession(request: CreateSessionRequest): Promise<DebateSession> {
    return this.fetchJson<DebateSession>('/sessions', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getSession(id: string): Promise<DebateSession> {
    return this.fetchJson<DebateSession>(`/sessions/${id}`);
  }

  async deleteSession(id: string): Promise<void> {
    await this.fetchJson<void>(`/sessions/${id}`, {
      method: 'DELETE',
    });
  }

  async exportSession(id: string): Promise<string> {
    const response = await fetch(`${API_BASE}/sessions/${id}/export`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    return response.text();
  }

  async importSession(jsonl: string): Promise<DebateSession> {
    const response = await fetch(`${API_BASE}/sessions/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: jsonl,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // Add a round to an existing session (for local state updates)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async addRound(_sessionId: string, _round: DebateRound): Promise<void> {
    // This is a local operation in the backend architecture
    // The backend handles round storage during streaming
    // This method exists for compatibility with the old API
    console.warn('addRound is deprecated - rounds are stored by the backend during streaming');
  }
}

export const apiClient = new ApiClient();
