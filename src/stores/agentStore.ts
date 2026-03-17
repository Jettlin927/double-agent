import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AgentConfig, AgentPersonality } from '../types';
import { createDefaultAgentConfig } from '../agents/AgentConfig';
import { mergeWithEnvConfig, hasEnvConfig } from './envConfig';

interface AgentState {
  gentleConfig: AgentConfig;
  angryConfig: AgentConfig;
  updateConfig: (personality: AgentPersonality, updates: Partial<AgentConfig>) => void;
  resetConfigs: () => void;
  isUsingEnvConfig: boolean;
}

const GENTLE_ID = 'gentle-agent';
const ANGRY_ID = 'angry-agent';

// 创建默认配置
function createDefaultGentleConfig(): AgentConfig {
  return createDefaultAgentConfig(GENTLE_ID, 'gentle');
}

function createDefaultAngryConfig(): AgentConfig {
  return createDefaultAgentConfig(ANGRY_ID, 'angry');
}

// 检查是否有 env 配置
const usingEnvConfig = hasEnvConfig();

export const useAgentStore = create<AgentState>()(
  persist(
    (set) => ({
      // 初始配置：优先从 env 加载，否则使用默认值
      gentleConfig: mergeWithEnvConfig(createDefaultGentleConfig(), 'gentle'),
      angryConfig: mergeWithEnvConfig(createDefaultAngryConfig(), 'angry'),
      isUsingEnvConfig: usingEnvConfig,

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
          gentleConfig: createDefaultGentleConfig(),
          angryConfig: createDefaultAngryConfig(),
          isUsingEnvConfig: false,
        });
      },
    }),
    {
      name: 'double-agent-config',
      partialize: (state) => ({
        // 如果使用 env 配置，不持久化到 localStorage
        gentleConfig: state.isUsingEnvConfig
          ? { ...createDefaultGentleConfig(), apiKey: '' }
          : {
              ...state.gentleConfig,
              apiKey: '', // Don't persist API key for security
            },
        angryConfig: state.isUsingEnvConfig
          ? { ...createDefaultAngryConfig(), apiKey: '' }
          : {
              ...state.angryConfig,
              apiKey: '', // Don't persist API key for security
            },
      }),
    }
  )
);
