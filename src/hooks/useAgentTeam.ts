import { useCallback, useRef, useState, useEffect } from 'react';
import { AgentTeam } from '../agents/AgentTeam';
import type { StreamCallback } from '../agents/AgentTeam';
import type { AgentConfig, StreamChunk, DebateSession, AgentMode } from '../types';
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
  currentSession: DebateSession | null;
  sessions: DebateSession[];
  mode: AgentMode;
  setMode: (mode: AgentMode) => void;
  runDebate: (question: string) => Promise<void>;
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

  const agentTeamRef = useRef<AgentTeam | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize AgentTeam
  if (!agentTeamRef.current) {
    agentTeamRef.current = new AgentTeam(options.gentleConfig, options.angryConfig);
  } else {
    agentTeamRef.current.updateConfigs(options.gentleConfig, options.angryConfig);
  }

  // Load sessions list
  const refreshSessions = useCallback(() => {
    setSessions(debateStorage.getAllSessions());
  }, []);

  // Initial load
  useEffect(() => {
    refreshSessions();
    const current = debateStorage.getCurrentSession();
    if (current) {
      setCurrentSession(current);
      setMode(current.mode || 'double');
      agentTeamRef.current?.loadSession(current);
    }
  }, [refreshSessions]);

  const handleChunk: StreamCallback = useCallback((agentId: string, chunk: StreamChunk) => {
    if (agentId === options.gentleConfig.id) {
      setGentleStream(prev => ({
        ...prev,
        content: (prev?.content || '') + (chunk.content || ''),
        reasoning: (prev?.reasoning || '') + (chunk.reasoning || ''),
        done: chunk.done,
      }));
    } else {
      setAngryStream(prev => ({
        ...prev,
        content: (prev?.content || '') + (chunk.content || ''),
        reasoning: (prev?.reasoning || '') + (chunk.reasoning || ''),
        done: chunk.done,
      }));
    }
  }, [options.gentleConfig.id, options.angryConfig.id]);

  const runDebate = useCallback(async (question: string) => {
    if (!question.trim()) return;

    setError(null);
    setIsRunning(true);
    setGentleStream({ content: '', reasoning: '', done: false });
    setAngryStream({ content: '', reasoning: '', done: false });

    abortControllerRef.current = new AbortController();

    try {
      if (mode === 'single') {
        await agentTeamRef.current?.runSingle(
          question,
          handleChunk,
          abortControllerRef.current.signal
        );
      } else {
        await agentTeamRef.current?.runDebate(
          question,
          handleChunk,
          abortControllerRef.current.signal
        );
      }
      const session = debateStorage.getCurrentSession();
      setCurrentSession(session || null);
      refreshSessions();
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setIsRunning(false);
    }
  }, [handleChunk, mode, refreshSessions]);

  const loadSession = useCallback((sessionId: string) => {
    const session = debateStorage.getSession(sessionId);
    if (session) {
      debateStorage.setCurrentSession(sessionId);
      agentTeamRef.current?.loadSession(session);
      setCurrentSession(session);
      setMode(session.mode || 'double');
      setGentleStream(null);
      setAngryStream(null);
      setError(null);
    }
  }, []);

  const createNewSession = useCallback(() => {
    agentTeamRef.current?.reset();
    setCurrentSession(null);
    setGentleStream(null);
    setAngryStream(null);
    setError(null);
    debateStorage.setCurrentSession('');
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    debateStorage.deleteSession(sessionId);
    refreshSessions();
    if (currentSession?.id === sessionId) {
      createNewSession();
    }
  }, [currentSession, createNewSession, refreshSessions]);

  const stopDebate = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    agentTeamRef.current?.reset();
    setGentleStream(null);
    setAngryStream(null);
    setError(null);
    setIsRunning(false);
  }, []);

  return {
    isRunning,
    error,
    gentleStream,
    angryStream,
    currentSession,
    sessions,
    mode,
    setMode,
    runDebate,
    loadSession,
    createNewSession,
    deleteSession,
    stopDebate,
    reset,
  };
}
