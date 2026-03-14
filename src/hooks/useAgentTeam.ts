import { useCallback, useRef, useState } from 'react';
import { AgentTeam, StreamCallback } from '../agents/AgentTeam';
import type { AgentConfig, StreamChunk } from '../types';

interface UseAgentTeamOptions {
  gentleConfig: AgentConfig;
  angryConfig: AgentConfig;
}

interface UseAgentTeamReturn {
  isRunning: boolean;
  error: string | null;
  gentleStream: StreamChunk | null;
  angryStream: StreamChunk | null;
  runDebate: (question: string) => Promise<void>;
  stopDebate: () => void;
  reset: () => void;
}

export function useAgentTeam(options: UseAgentTeamOptions): UseAgentTeamReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gentleStream, setGentleStream] = useState<StreamChunk | null>(null);
  const [angryStream, setAngryStream] = useState<StreamChunk | null>(null);

  const agentTeamRef = useRef<AgentTeam | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize or update AgentTeam when configs change
  if (!agentTeamRef.current) {
    agentTeamRef.current = new AgentTeam(options.gentleConfig, options.angryConfig);
  } else {
    agentTeamRef.current.updateConfigs(options.gentleConfig, options.angryConfig);
  }

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
      await agentTeamRef.current?.runDebate(
        question,
        handleChunk,
        abortControllerRef.current.signal
      );
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setIsRunning(false);
    }
  }, [handleChunk]);

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
    runDebate,
    stopDebate,
    reset,
  };
}
