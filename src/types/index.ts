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

export interface APIAdapter {
  buildRequest(messages: Message[], config: AgentConfig): RequestInit;
  parseStream(chunk: string): StreamChunk | null;
  getEndpoint(): string;
}
