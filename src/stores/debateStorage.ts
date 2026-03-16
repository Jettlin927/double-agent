import type { DebateSession, DebateRound, ChatMessage, AgentConfig } from '../types';

const STORAGE_KEY = 'double-agent-debates';

export class DebateStorage {
  private sessions: Map<string, DebateSession> = new Map();
  private currentSessionId: string | null = null;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const sessions = JSON.parse(data) as DebateSession[];
        sessions.forEach(session => {
          this.sessions.set(session.id, session);
        });
      }
    } catch (error) {
      console.error('Failed to load debates from storage:', error);
    }
  }

  private saveToStorage() {
    try {
      const sessions = Array.from(this.sessions.values());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    } catch (error) {
      console.error('Failed to save debates to storage:', error);
    }
  }

  createSession(
    userQuestion: string,
    gentleConfig: AgentConfig,
    angryConfig: AgentConfig
  ): DebateSession {
    const session: DebateSession = {
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: userQuestion.slice(0, 50) + (userQuestion.length > 50 ? '...' : ''),
      userQuestion,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      rounds: [],
      maxRounds: Math.min(gentleConfig.maxRounds, angryConfig.maxRounds),
      gentleConfig,
      angryConfig,
    };

    this.sessions.set(session.id, session);
    this.currentSessionId = session.id;
    this.saveToStorage();
    return session;
  }

  addRound(sessionId: string, round: DebateRound) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.rounds.push(round);
    session.updatedAt = Date.now();
    this.saveToStorage();
  }

  getSession(id: string): DebateSession | undefined {
    return this.sessions.get(id);
  }

  getCurrentSession(): DebateSession | undefined {
    if (!this.currentSessionId) return undefined;
    return this.sessions.get(this.currentSessionId);
  }

  getAllSessions(): DebateSession[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  setCurrentSession(id: string) {
    if (this.sessions.has(id)) {
      this.currentSessionId = id;
    }
  }

  deleteSession(id: string) {
    this.sessions.delete(id);
    if (this.currentSessionId === id) {
      this.currentSessionId = null;
    }
    this.saveToStorage();
  }

  // Export to JSONL format
  exportToJSONL(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session) return '';

    const lines: string[] = [];

    // Add session metadata as first line
    lines.push(JSON.stringify({
      type: 'metadata',
      sessionId: session.id,
      title: session.title,
      userQuestion: session.userQuestion,
      createdAt: session.createdAt,
      maxRounds: session.maxRounds,
    }));

    // Add each round as a line
    session.rounds.forEach((round, index) => {
      lines.push(JSON.stringify({
        type: 'round',
        round: round.round,
        gentle: {
          id: round.gentleResponse.id,
          content: round.gentleResponse.content,
          timestamp: round.gentleResponse.timestamp,
        },
        angry: {
          id: round.angryResponse.id,
          content: round.angryResponse.content,
          timestamp: round.angryResponse.timestamp,
        },
      }));
    });

    return lines.join('\n');
  }

  // Import from JSONL format
  importFromJSONL(jsonlContent: string): DebateSession | null {
    try {
      const lines = jsonlContent.trim().split('\n').filter(line => line.trim());
      if (lines.length === 0) return null;

      // Parse metadata
      const metadata = JSON.parse(lines[0]);
      if (metadata.type !== 'metadata') return null;

      const session: DebateSession = {
        id: `imported-${Date.now()}`,
        title: metadata.title || '导入的对话',
        userQuestion: metadata.userQuestion || '',
        createdAt: metadata.createdAt || Date.now(),
        updatedAt: Date.now(),
        rounds: [],
        maxRounds: metadata.maxRounds || 3,
        gentleConfig: { id: '', name: '温和Agent', personality: 'gentle', apiType: 'openai', baseURL: '', apiKey: '', model: '', systemPrompt: '', temperature: 0.7, maxRounds: 3 },
        angryConfig: { id: '', name: '暴躁Agent', personality: 'angry', apiType: 'openai', baseURL: '', apiKey: '', model: '', systemPrompt: '', temperature: 0.8, maxRounds: 3 },
      };

      // Parse rounds
      for (let i = 1; i < lines.length; i++) {
        const roundData = JSON.parse(lines[i]);
        if (roundData.type === 'round') {
          const round: DebateRound = {
            round: roundData.round,
            gentleResponse: {
              id: roundData.gentle?.id || `gentle-${Date.now()}-${i}`,
              role: 'assistant',
              content: roundData.gentle?.content || '',
              timestamp: roundData.gentle?.timestamp || Date.now(),
              agentId: 'gentle-agent',
            },
            angryResponse: {
              id: roundData.angry?.id || `angry-${Date.now()}-${i}`,
              role: 'assistant',
              content: roundData.angry?.content || '',
              timestamp: roundData.angry?.timestamp || Date.now(),
              agentId: 'angry-agent',
            },
          };
          session.rounds.push(round);
        }
      }

      this.sessions.set(session.id, session);
      this.currentSessionId = session.id;
      this.saveToStorage();
      return session;
    } catch (error) {
      console.error('Failed to import JSONL:', error);
      return null;
    }
  }

  // Export all sessions as JSONL
  exportAllToJSONL(): string {
    const allSessions = this.getAllSessions();
    const lines: string[] = [];

    allSessions.forEach(session => {
      lines.push(this.exportToJSONL(session.id));
      lines.push(''); // Empty line between sessions
    });

    return lines.join('\n');
  }

  clearAll() {
    this.sessions.clear();
    this.currentSessionId = null;
    localStorage.removeItem(STORAGE_KEY);
  }
}

// Singleton instance
export const debateStorage = new DebateStorage();
