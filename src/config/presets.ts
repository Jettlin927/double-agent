/**
 * 默认预设配置
 * 包含常见 Provider 和 Model 配置
 */

import type { ProviderConfig, ModelProfile, AppConfig } from './types';

// ============================================================
// Provider 预设
// ============================================================

export const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    apiType: 'openai',
    baseURL: 'https://api.openai.com',
    supportedModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    enabled: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    apiType: 'anthropic',
    baseURL: 'https://api.anthropic.com',
    supportedModels: [
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ],
    enabled: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    apiType: 'openai',
    baseURL: 'https://api.deepseek.com',
    supportedModels: ['deepseek-chat', 'deepseek-reasoner'],
    enabled: true,
  },
  {
    id: 'qwen',
    name: '阿里云通义千问',
    apiType: 'openai',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode',
    supportedModels: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-coder-plus'],
    enabled: true,
  },
  {
    id: 'kimi',
    name: 'Moonshot Kimi',
    apiType: 'openai',
    baseURL: 'https://api.moonshot.cn',
    supportedModels: ['kimi-latest', 'kimi-k1', 'moonshot-v1-8k'],
    enabled: true,
  },
  {
    id: 'glm',
    name: '智谱 GLM',
    apiType: 'openai',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    supportedModels: ['glm-4', 'glm-4-flash', 'glm-4v'],
    enabled: true,
  },
];

// ============================================================
// Model Profile 预设
// ============================================================

export const DEFAULT_MODEL_PROFILES: ModelProfile[] = [
  // OpenAI 模型
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    providerId: 'openai',
    modelName: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 4096,
    contextWindow: 128000,
    supportsTools: true,
    supportsReasoning: false,
    costPer1KTokens: { input: 0.005, output: 0.015 },
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    providerId: 'openai',
    modelName: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 4096,
    contextWindow: 128000,
    supportsTools: true,
    supportsReasoning: false,
    costPer1KTokens: { input: 0.00015, output: 0.0006 },
  },

  // Anthropic 模型
  {
    id: 'claude-sonnet',
    name: 'Claude 3.5 Sonnet',
    providerId: 'anthropic',
    modelName: 'claude-3-5-sonnet-20241022',
    temperature: 0.7,
    maxTokens: 8192,
    contextWindow: 200000,
    supportsTools: true,
    supportsReasoning: true,
    costPer1KTokens: { input: 0.003, output: 0.015 },
  },
  {
    id: 'claude-opus',
    name: 'Claude 3 Opus',
    providerId: 'anthropic',
    modelName: 'claude-3-opus-20240229',
    temperature: 0.7,
    maxTokens: 4096,
    contextWindow: 200000,
    supportsTools: true,
    supportsReasoning: true,
    costPer1KTokens: { input: 0.015, output: 0.075 },
  },

  // DeepSeek 模型
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    providerId: 'deepseek',
    modelName: 'deepseek-chat',
    temperature: 0.7,
    maxTokens: 4096,
    contextWindow: 64000,
    supportsTools: true,
    supportsReasoning: false,
    costPer1KTokens: { input: 0.00014, output: 0.00028 },
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek Reasoner',
    providerId: 'deepseek',
    modelName: 'deepseek-reasoner',
    temperature: 0.7,
    maxTokens: 4096,
    contextWindow: 64000,
    supportsTools: true,
    supportsReasoning: true,
    customParams: { include_reasoning: true },
  },

  // 通义千问模型
  {
    id: 'qwen-max',
    name: '通义千问 Max',
    providerId: 'qwen',
    modelName: 'qwen-max',
    temperature: 0.7,
    maxTokens: 4096,
    contextWindow: 32000,
    supportsTools: true,
    supportsReasoning: false,
  },
  {
    id: 'qwen-coder',
    name: '通义千问 Coder',
    providerId: 'qwen',
    modelName: 'qwen-coder-plus',
    temperature: 0.3,
    maxTokens: 4096,
    contextWindow: 32000,
    supportsTools: true,
    supportsReasoning: false,
  },

  // Kimi 模型
  {
    id: 'kimi-latest',
    name: 'Kimi',
    providerId: 'kimi',
    modelName: 'kimi-latest',
    temperature: 0.7,
    maxTokens: 4096,
    contextWindow: 256000,
    supportsTools: true,
    supportsReasoning: false,
  },

  // GLM 模型
  {
    id: 'glm-4',
    name: 'GLM-4',
    providerId: 'glm',
    modelName: 'glm-4',
    temperature: 0.7,
    maxTokens: 4096,
    contextWindow: 128000,
    supportsTools: true,
    supportsReasoning: false,
  },
];

// ============================================================
// 默认完整配置
// ============================================================

export function createDefaultAppConfig(): AppConfig {
  return {
    version: 1,
    providers: DEFAULT_PROVIDERS,
    modelProfiles: DEFAULT_MODEL_PROFILES,
    agentProfiles: [
      {
        id: 'gentle-gpt4o',
        name: '温和助手 (GPT-4o)',
        modelProfileId: 'gpt-4o',
        roleId: 'gentle-default',
        enableTools: true,
        toolWhitelist: [],
        enableStorage: true,
        maxIterations: 10,
      },
      {
        id: 'angry-claude',
        name: '暴躁评论家 (Claude)',
        modelProfileId: 'claude-sonnet',
        roleId: 'angry-default',
        enableTools: true,
        toolWhitelist: [],
        enableStorage: true,
        maxIterations: 10,
      },
      {
        id: 'gentle-deepseek',
        name: '温和助手 (DeepSeek)',
        modelProfileId: 'deepseek-chat',
        roleId: 'gentle-default',
        enableTools: true,
        toolWhitelist: [],
        enableStorage: true,
        maxIterations: 10,
      },
      {
        id: 'coding-assistant',
        name: '编程助手',
        modelProfileId: 'claude-opus',
        roleId: 'gentle-teacher',
        temperatureOverride: 0.3,
        enableTools: true,
        toolWhitelist: ['execute_code', 'file_read', 'file_write'],
        enableStorage: true,
        maxIterations: 15,
      },
    ],
    defaultSingleAgentId: 'gentle-gpt4o',
    defaultDebateAgentIds: ['gentle-gpt4o', 'angry-claude'],
  };
}
