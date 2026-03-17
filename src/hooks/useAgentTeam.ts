import { useCallback, useState, useEffect, useRef } from 'react';
import type { StreamChunk, DebateSession, AgentMode, AgentConfig } from '../types';
import { apiClient } from '../api/client';
import { debateStorage } from '../stores/debateStorage';

interface UseAgentTeamOptions {
  gentleConfig: AgentConfig;
  angryConfig: AgentConfig;
}

interface UseAgentTeamReturn {
  isRunning: boolean;
  error: string | null;
  gentleStream: StreamChunk | null;
  angryStream: StreamChunk | null;
  currentRound: number;
  totalRounds: number;
  isEnding: boolean;
  contextStats: { stats: { usagePercent: number }; isCompacted: boolean } | null;
  currentSession: DebateSession | null;
  sessions: DebateSession[];
  mode: AgentMode;
  setMode: (mode: AgentMode) => void;
  runDebate: (question: string) => Promise<void>;
  compactContext: () => boolean; // Deprecated - backend handles context
  loadSession: (sessionId: string) => void;
  createNewSession: () => void;
  deleteSession: (sessionId: string) => void;
  stopDebate: () => void;
  reset: () => void;
}

export function useAgentTeam(options: UseAgentTeamOptions): UseAgentTeamReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gentleStream, setGentleStream] = useState<StreamChunk | null>(null);
  const [angryStream, setAngryStream] = useState<StreamChunk | null>(null);
  const [currentSession, setCurrentSession] = useState<DebateSession | null>(null);
  const [sessions, setSessions] = useState<DebateSession[]>([]);
  const [mode, setMode] = useState<AgentMode>('double');
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [isEnding, setIsEnding] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load sessions list
  const refreshSessions = useCallback(async () => {
    try {
      const sessions = await debateStorage.getAllSessions();
      setSessions(sessions);
    } catch (err) {
      console.error('Failed to refresh sessions:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshSessions();
    const loadCurrentSession = async () => {
      const current = await debateStorage.getCurrentSession();
      if (current) {
        setCurrentSession(current);
        setMode(current.mode || 'double');
        setTotalRounds(current.rounds.length);
      }
    };
    loadCurrentSession();
  }, [refreshSessions]);

  const runDebate = useCallback(async (question: string) => {
    if (!question.trim()) return;

    setError(null);
    setIsRunning(true);
    setGentleStream({ content: '', reasoning: '', done: false });
    setAngryStream({ content: '', reasoning: '', done: false });
    setCurrentRound(0);
    setIsEnding(false);

    abortControllerRef.current = new AbortController();

    try {
      // Prepare configs without apiKey for backend
      const gentleConfigForBackend = {
        ...options.gentleConfig,
        apiKey: '', // Backend doesn't need apiKey
      };
      const angryConfigForBackend = {
        ...options.angryConfig,
        apiKey: '', // Backend doesn't need apiKey
      };

      const request = {
        session_id: currentSession?.id,
        question,
        mode,
        gentle_config: gentleConfigForBackend,
        angry_config: angryConfigForBackend,
      };

      let sessionId = currentSession?.id;

      for await (const event of apiClient.streamDebate(request)) {
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }

        switch (event.type) {
          case 'chunk':
            if (event.agent_id === 'gentle') {
              setGentleStream(prev => ({
                ...prev,
                content: (prev?.content || '') + (event.content || ''),
                reasoning: (prev?.reasoning || '') + (event.reasoning || ''),
                done: false,
              }));
            } else {
              setAngryStream(prev => ({
                ...prev,
                content: (prev?.content || '') + (event.content || ''),
                reasoning: (prev?.reasoning || '') + (event.reasoning || ''),
                done: false,
              }));
            }
            break;

          case 'round_complete':
            setCurrentRound(event.round);
            setIsEnding(event.should_end);
            // Mark streams as done for this round
            if (mode === 'double') {
              setGentleStream(prev => prev ? { ...prev, done: true } : null);
              setAngryStream(prev => prev ? { ...prev, done: true } : null);
            } else {
              setGentleStream(prev => prev ? { ...prev, done: true } : null);
            }
            break;

          case 'error':
            throw new Error(event.message);

          case 'complete':
            sessionId = event.session_id;
            setTotalRounds(event.total_rounds);
            break;
        }
      }

      // Refresh session data from backend
      if (sessionId) {
        const session = await debateStorage.getSession(sessionId);
        if (session) {
          setCurrentSession(session);
          setTotalRounds(session.rounds.length);
        }
      }
      await refreshSessions();
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setIsRunning(false);
      setIsEnding(false);
    }
  }, [currentSession, mode, options.gentleConfig, options.angryConfig, refreshSessions]);

  const loadSession = useCallback(async (sessionId: string) => {
    try {
      const session = await debateStorage.getSession(sessionId);
      if (session) {
        await debateStorage.setCurrentSession(sessionId);
        setCurrentSession(session);
        setMode(session.mode || 'double');
        setTotalRounds(session.rounds.length);
        setGentleStream(null);
        setAngryStream(null);
        setError(null);
      }
    } catch (err) {
      console.error('Failed to load session:', err);
      setError('Failed to load session');
    }
  }, []);

  const createNewSession = useCallback(() => {
    setCurrentSession(null);
    setGentleStream(null);
    setAngryStream(null);
    setError(null);
    setCurrentRound(0);
    setTotalRounds(0);
    setIsEnding(false);
    debateStorage.setCurrentSession('');
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await debateStorage.deleteSession(sessionId);
      await refreshSessions();
      if (currentSession?.id === sessionId) {
        createNewSession();
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
      setError('Failed to delete session');
    }
  }, [currentSession, createNewSession, refreshSessions]);

  const compactContext = useCallback(() => {
    // Deprecated - backend handles context compression
    console.warn('compactContext is deprecated - context is managed by the backend');
    return false;
  }, []);

  const stopDebate = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    setGentleStream(null);
    setAngryStream(null);
    setError(null);
    setIsRunning(false);
    setCurrentRound(0);
    setIsEnding(false);
  }, []);

  return {
    isRunning,
    error,
    gentleStream,
    angryStream,
    currentRound,
    totalRounds,
    isEnding,
    contextStats: null,
    currentSession,
    sessions,
    mode,
    setMode,
    runDebate,
    compactContext,
    loadSession,
    createNewSession,
    deleteSession,
    stopDebate,
    reset,
  };
}
