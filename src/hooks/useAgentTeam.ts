import { useCallback, useRef, useState, useEffect } from 'react';
import { AgentTeam } from '../agents/AgentTeam';
import type { StreamCallback, ContextManagerState } from '../agents/AgentTeam';
import type { AgentConfig, StreamChunk, DebateSession, AgentMode } from '../types';
import { debateStorage } from '../stores/debateStorage';
import type { ContextStats } from '../utils/tokenCounter';

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
  contextStats: ContextManagerState | null;
  currentSession: DebateSession | null;
  sessions: DebateSession[];
  mode: AgentMode;
  setMode: (mode: AgentMode) => void;
  runDebate: (question: string) => Promise<void>;
  compactContext: () => boolean;
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
  const [contextStats, setContextStats] = useState<ContextManagerState | null>(null);

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
      setTotalRounds(current.rounds.length);
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

  const handleRoundComplete = useCallback((round: number, shouldEnd: boolean) => {
    setCurrentRound(round);
    setIsEnding(shouldEnd);
  }, []);

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
      if (mode === 'single') {
        await agentTeamRef.current?.runSingle(
          question,
          handleChunk,
          handleRoundComplete,
          abortControllerRef.current.signal
        );
      } else {
        await agentTeamRef.current?.runDebate(
          question,
          handleChunk,
          handleRoundComplete,
          abortControllerRef.current.signal
        );
      }
      const session = debateStorage.getCurrentSession();
      if (session) {
        setCurrentSession(session);
        setTotalRounds(session.rounds.length);
      }
      refreshSessions();
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setIsRunning(false);
      setIsEnding(false);
    }
  }, [handleChunk, handleRoundComplete, mode, refreshSessions]);

  const loadSession = useCallback((sessionId: string) => {
    const session = debateStorage.getSession(sessionId);
    if (session) {
      debateStorage.setCurrentSession(sessionId);
      agentTeamRef.current?.loadSession(session);
      setCurrentSession(session);
      setMode(session.mode || 'double');
      setTotalRounds(session.rounds.length);
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
    setCurrentRound(0);
    setTotalRounds(0);
    setIsEnding(false);
    debateStorage.setCurrentSession('');
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    debateStorage.deleteSession(sessionId);
    refreshSessions();
    if (currentSession?.id === sessionId) {
      createNewSession();
    }
  }, [currentSession, createNewSession, refreshSessions]);

  const compactContext = useCallback(() => {
    const wasCompacted = agentTeamRef.current?.compactContext() || false;
    if (wasCompacted) {
      const stats = agentTeamRef.current?.getContextStats() || null;
      setContextStats(stats);
    }
    return wasCompacted;
  }, []);

  const stopDebate = useCallback(() => {
    abortControllerRef.current?.abort();
    agentTeamRef.current?.stop();
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    agentTeamRef.current?.reset();
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
    contextStats,
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
