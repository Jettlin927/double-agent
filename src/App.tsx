import { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { AgentPanel } from './components/AgentPanel';
import { UserInput } from './components/UserInput';
import { ConfigModal } from './components/ConfigModal';
import { Sidebar } from './components/Sidebar';
import { useAgentStore } from './stores/agentStore';
import { useAgentTeam } from './hooks/useAgentTeam';
import { validateConfig } from './agents/AgentConfig';
import type { ChatMessage } from './types';

function App() {
  const [configOpen, setConfigOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { gentleConfig, angryConfig, updateConfig } = useAgentStore();

  const {
    isRunning,
    error,
    gentleStream,
    angryStream,
    currentSession,
    sessions,
    runDebate,
    loadSession,
    createNewSession,
    deleteSession,
    stopDebate,
  } = useAgentTeam({
    gentleConfig,
    angryConfig,
  });

  const isConfigured = !validateConfig(gentleConfig) && !validateConfig(angryConfig);

  // Build messages from current session
  const buildMessages = useCallback((agentId: string): ChatMessage[] => {
    const messages: ChatMessage[] = [];

    if (currentSession) {
      // Add user question as first message
      messages.push({
        id: `user-${currentSession.createdAt}`,
        role: 'user',
        content: currentSession.userQuestion,
        timestamp: currentSession.createdAt,
      });

      // Add all rounds
      currentSession.rounds.forEach((round) => {
        if (agentId === gentleConfig.id) {
          messages.push(round.gentleResponse);
        } else {
          messages.push(round.angryResponse);
        }
      });
    }

    return messages;
  }, [currentSession, gentleConfig.id]);

  const handleSend = useCallback(
    async (question: string) => {
      if (currentSession) {
        // If there's a current session, create a new one
        createNewSession();
      }
      await runDebate(question);
    },
    [currentSession, createNewSession, runDebate]
  );

  const handleUpdateConfig = (personality: 'gentle' | 'angry', updates: Partial<typeof gentleConfig>) => {
    updateConfig(personality, updates);
  };

  // Check if we have an active session or streaming content
  const hasActiveContent = currentSession || gentleStream || angryStream;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          sessions={sessions}
          currentSession={currentSession}
          onNewSession={createNewSession}
          onLoadSession={loadSession}
          onDeleteSession={deleteSession}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          <Header
            onOpenConfig={() => setConfigOpen(true)}
            onToggleSidebar={() => setSidebarOpen(true)}
          />

          {/* Main content - split view */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left panel - Gentle Agent */}
            <div className="flex-1 border-r border-gray-200">
              <AgentPanel
                config={gentleConfig}
                stream={gentleStream}
                isRunning={isRunning}
                messages={buildMessages(gentleConfig.id)}
                side="left"
              />
            </div>

            {/* Right panel - Angry Agent */}
            <div className="flex-1">
              <AgentPanel
                config={angryConfig}
                stream={angryStream}
                isRunning={isRunning}
                messages={buildMessages(angryConfig.id)}
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
        </div>
      </div>

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
