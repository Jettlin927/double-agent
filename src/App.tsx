import { useState, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { AgentPanel } from './components/AgentPanel';
import { UserInput } from './components/UserInput';
import { ConfigModal } from './components/ConfigModal';
import { useAgentStore } from './stores/agentStore';
import { useAgentTeam } from './hooks/useAgentTeam';
import { validateConfig } from './agents/AgentConfig';
import type { ChatMessage, AgentPersonality } from './types';

function App() {
  const [configOpen, setConfigOpen] = useState(false);
  const [userMessages, setUserMessages] = useState<ChatMessage[]>([]);
  const [agentMessages, setAgentMessages] = useState<Record<string, ChatMessage[]>>({
    'gentle-agent': [],
    'angry-agent': [],
  });

  const { gentleConfig, angryConfig, updateConfig } = useAgentStore();

  const handleChunk = useCallback((agentId: string, chunk: { content?: string; done?: boolean }) => {
    if (chunk.done) {
      // Finalize the message when done
      setAgentMessages((prev) => ({
        ...prev,
        [agentId]: [
          ...(prev[agentId] || []),
          {
            id: `${agentId}-${Date.now()}`,
            role: 'assistant',
            content: chunk.content || '',
            agentId,
            timestamp: Date.now(),
          },
        ],
      }));
    }
  }, []);

  const { isRunning, error, gentleStream, angryStream, runDebate, stopDebate } = useAgentTeam({
    gentleConfig,
    angryConfig,
  });

  const isConfigured = useMemo(() => {
    return !validateConfig(gentleConfig) && !validateConfig(angryConfig);
  }, [gentleConfig, angryConfig]);

  const handleSend = useCallback(
    async (question: string) => {
      // Add user message
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: question,
        timestamp: Date.now(),
      };
      setUserMessages((prev) => [...prev, userMessage]);

      // Clear previous agent messages
      setAgentMessages({
        'gentle-agent': [],
        'angry-agent': [],
      });

      // Start debate
      await runDebate(question);
    },
    [runDebate]
  );

  const handleUpdateConfig = (personality: AgentPersonality, updates: Parameters<typeof updateConfig>[1]) => {
    updateConfig(personality, updates);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header onOpenConfig={() => setConfigOpen(true)} />

      {/* Main content - split view */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - Gentle Agent */}
        <div className="flex-1 border-r border-gray-200">
          <AgentPanel
            config={gentleConfig}
            stream={gentleStream}
            isRunning={isRunning}
            messages={[...userMessages, ...(agentMessages['gentle-agent'] || [])]}
            side="left"
          />
        </div>

        {/* Right panel - Angry Agent */}
        <div className="flex-1">
          <AgentPanel
            config={angryConfig}
            stream={angryStream}
            isRunning={isRunning}
            messages={[...userMessages, ...(agentMessages['angry-agent'] || [])]}
            side="right"
          />
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border-t border-red-200 px-6 py-3">
          <p className="text-sm text-red-600 text-center">{error}</p>
        </div>
      )}

      {/* User input */}
      <UserInput
        onSend={handleSend}
        onStop={stopDebate}
        isRunning={isRunning}
        disabled={!isConfigured}
      />

      {/* Config modal */}
      <ConfigModal
        isOpen={configOpen}
        onClose={() => setConfigOpen(false)}
        gentleConfig={gentleConfig}
        angryConfig={angryConfig}
        onUpdateGentle={(updates) => handleUpdateConfig('gentle', updates)}
        onUpdateAngry={(updates) => handleUpdateConfig('angry', updates)}
      />
    </div>
  );
}

export default App;
