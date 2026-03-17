import type { DebateSession, DebateRound, AgentConfig, AgentMode } from '../types';
import { apiClient, type CreateSessionRequest } from '../api/client';

// Local storage key for current session ID only
const CURRENT_SESSION_KEY = 'double-agent-current-session';

export class DebateStorage {
  /**
   * Create a new session via backend API
   */
  async createSession(
    userQuestion: string,
    gentleConfig: AgentConfig,
    angryConfig: AgentConfig,
    mode: AgentMode = 'double'
  ): Promise<DebateSession> {
    const request: CreateSessionRequest = {
      user_question: userQuestion,
      gentle_config: gentleConfig,
      angry_config: angryConfig,
      mode,
    };

    const session = await apiClient.createSession(request);
    this.setCurrentSession(session.id);
    return session;
  }

  /**
   * Add a round to a session
   * Note: In the backend architecture, rounds are stored by the backend during streaming.
   * This method is kept for compatibility but is a no-op.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async addRound(_sessionId: string, _round: DebateRound): Promise<void> {
    // Backend handles round storage during streaming
    console.warn('addRound is deprecated - rounds are stored by the backend during streaming');
  }

  /**
   * Get a session by ID from backend
   */
  async getSession(id: string): Promise<DebateSession | undefined> {
    try {
      return await apiClient.getSession(id);
    } catch (err) {
      console.error('Failed to get session:', err);
      return undefined;
    }
  }

  /**
   * Get the current session from localStorage reference
   */
  async getCurrentSession(): Promise<DebateSession | undefined> {
    const currentId = localStorage.getItem(CURRENT_SESSION_KEY);
    if (!currentId) return undefined;
    return this.getSession(currentId);
  }

  /**
   * Get all sessions from backend
   */
  async getAllSessions(): Promise<DebateSession[]> {
    try {
      return await apiClient.getSessions();
    } catch (err) {
      console.error('Failed to get sessions:', err);
      return [];
    }
  }

  /**
   * Set the current session ID in localStorage
   */
  setCurrentSession(id: string): void {
    if (id) {
      localStorage.setItem(CURRENT_SESSION_KEY, id);
    } else {
      localStorage.removeItem(CURRENT_SESSION_KEY);
    }
  }

  /**
   * Delete a session via backend API
   */
  async deleteSession(id: string): Promise<void> {
    await apiClient.deleteSession(id);
    const currentId = localStorage.getItem(CURRENT_SESSION_KEY);
    if (currentId === id) {
      localStorage.removeItem(CURRENT_SESSION_KEY);
    }
  }

  /**
   * Export a session to JSONL format via backend
   */
  async exportToJSONL(sessionId: string): Promise<string> {
    return apiClient.exportSession(sessionId);
  }

  /**
   * Import a session from JSONL format via backend
   */
  async importFromJSONL(jsonlContent: string): Promise<DebateSession | null> {
    try {
      const session = await apiClient.importSession(jsonlContent);
      this.setCurrentSession(session.id);
      return session;
    } catch (error) {
      console.error('Failed to import JSONL:', error);
      return null;
    }
  }

  /**
   * Export all sessions as JSONL
   * Note: This now fetches each session individually and combines them
   */
  async exportAllToJSONL(): Promise<string> {
    try {
      const sessions = await this.getAllSessions();
      const lines: string[] = [];

      for (const session of sessions) {
        const jsonl = await this.exportToJSONL(session.id);
        lines.push(jsonl);
        lines.push(''); // Empty line between sessions
      }

      return lines.join('\n');
    } catch (err) {
      console.error('Failed to export all sessions:', err);
      return '';
    }
  }

  /**
   * Clear all local session references (does not delete backend data)
   */
  clearAll(): void {
    localStorage.removeItem(CURRENT_SESSION_KEY);
  }
}

// Singleton instance
export const debateStorage = new DebateStorage();
