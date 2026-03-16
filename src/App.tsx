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
import { Bot, User } from 'lucide-react';

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
    mode,
    setMode,
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

  const handleModeChange = (newMode: 'single' | 'double') => {
    setMode(newMode);
    // 切换模式时重置当前会话
    createNewSession();
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          sessions={sessions}
          currentSession={currentSession}
          mode={mode}
          onNewSession={createNewSession}
          onLoadSession={loadSession}
          onDeleteSession={deleteSession}
          onModeChange={handleModeChange}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          <Header
            onOpenConfig={() => setConfigOpen(true)}
            onToggleSidebar={() => setSidebarOpen(true)}
          />

          {/* Main content - view based on mode */}
          <div className="flex-1 flex overflow-hidden">
            {mode === 'single' ? (
              // 单Agent模式 - 只显示左侧，居中
              <div className="flex-1 flex justify-center">
                <div className="w-full max-w-3xl border-x border-gray-200">
                  <AgentPanel
                    config={gentleConfig}
                    stream={gentleStream}
                    isRunning={isRunning}
                    messages={buildMessages(gentleConfig.id)}
                    side="left"
                  />
                </div>
              </div>
            ) : (
              // 双Agent模式 - 左右分栏
              <>
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
              </>
            )}
          </div>

          {/* Mode indicator */}
          <div className="bg-white border-t border-gray-200 px-4 py-2 flex items-center justify-center gap-2">
            {mode === 'single' ? (
              <>
                <User className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-blue-600 font-medium">单Agent模式</span>
                <span className="text-xs text-gray-400">- 仅使用温和Agent进行对话</span>
              </>
            ) : (
              <>
                <Bot className="w-4 h-4 text-purple-600" />
                <span className="text-sm text-purple-600 font-medium">双Agent辩论模式</span>
                <span className="text-xs text-gray-400">- 温和Agent vs 暴躁Agent</span>
              </>
            )}
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
