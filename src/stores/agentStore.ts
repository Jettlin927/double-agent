import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AgentConfig, AgentPersonality } from '../types';
import { createDefaultAgentConfig } from '../agents/AgentConfig';

interface AgentState {
  gentleConfig: AgentConfig;
  angryConfig: AgentConfig;
  updateConfig: (personality: AgentPersonality, updates: Partial<AgentConfig>) => void;
  resetConfigs: () => void;
}

const GENTLE_ID = 'gentle-agent';
const ANGRY_ID = 'angry-agent';

export const useAgentStore = create<AgentState>()(
  persist(
    (set) => ({
      gentleConfig: createDefaultAgentConfig(GENTLE_ID, 'gentle'),
      angryConfig: createDefaultAgentConfig(ANGRY_ID, 'angry'),

      updateConfig: (personality, updates) => {
        set((state) => ({
          [personality === 'gentle' ? 'gentleConfig' : 'angryConfig']: {
            ...(personality === 'gentle' ? state.gentleConfig : state.angryConfig),
            ...updates,
          },
        }));
      },

      resetConfigs: () => {
        set({
          gentleConfig: createDefaultAgentConfig(GENTLE_ID, 'gentle'),
          angryConfig: createDefaultAgentConfig(ANGRY_ID, 'angry'),
        });
      },
    }),
    {
      name: 'double-agent-config',
      partialize: (state) => ({
        gentleConfig: {
          ...state.gentleConfig,
          apiKey: '', // Don't persist API key for security
        },
        angryConfig: {
          ...state.angryConfig,
          apiKey: '', // Don't persist API key for security
        },
      }),
    }
  )
);
