import type { ApiType } from '../types';

export interface ModelPreset {
  id: string;
  name: string;
  provider: string;
  apiType: ApiType;
  baseURL: string;
  model: string;
  description: string;
  temperature: number;
  maxTokens?: number;
}

// OpenAI 系列
export const OPENAI_PRESETS: ModelPreset[] = [
  {
    id: 'openai-gpt4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    apiType: 'openai',
    baseURL: 'https://api.openai.com',
    model: 'gpt-4o',
    description: 'OpenAI 旗舰模型，综合能力最强',
    temperature: 0.7,
    maxTokens: 4096,
  },
  {
    id: 'openai-gpt4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    apiType: 'openai',
    baseURL: 'https://api.openai.com',
    model: 'gpt-4o-mini',
    description: '轻量级模型，速度快成本低',
    temperature: 0.7,
    maxTokens: 4096,
  },
  {
    id: 'openai-gpt4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    apiType: 'openai',
    baseURL: 'https://api.openai.com',
    model: 'gpt-4-turbo',
    description: '上一代旗舰模型',
    temperature: 0.7,
    maxTokens: 4096,
  },
];

// Anthropic Claude 系列
export const ANTHROPIC_PRESETS: ModelPreset[] = [
  {
    id: 'anthropic-claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    apiType: 'anthropic',
    baseURL: 'https://api.anthropic.com',
    model: 'claude-3-5-sonnet-20241022',
    description: 'Claude 3.5 Sonnet，推理能力强',
    temperature: 0.7,
    maxTokens: 8192,
  },
  {
    id: 'anthropic-claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'Anthropic',
    apiType: 'anthropic',
    baseURL: 'https://api.anthropic.com',
    model: 'claude-3-opus-20240229',
    description: 'Claude 3 Opus，最强大模型',
    temperature: 0.7,
    maxTokens: 4096,
  },
  {
    id: 'anthropic-claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    provider: 'Anthropic',
    apiType: 'anthropic',
    baseURL: 'https://api.anthropic.com',
    model: 'claude-3-sonnet-20240229',
    description: 'Claude 3 Sonnet，平衡性能',
    temperature: 0.7,
    maxTokens: 4096,
  },
];

// DeepSeek 系列
export const DEEPSEEK_PRESETS: ModelPreset[] = [
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'DeepSeek',
    apiType: 'openai',
    baseURL: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    description: 'DeepSeek 对话模型，性价比高',
    temperature: 0.7,
    maxTokens: 4096,
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek Reasoner',
    provider: 'DeepSeek',
    apiType: 'openai',
    baseURL: 'https://api.deepseek.com',
    model: 'deepseek-reasoner',
    description: 'DeepSeek 推理模型，适合复杂任务',
    temperature: 0.7,
    maxTokens: 4096,
  },
];

// 阿里云通义千问系列
export const QWEN_PRESETS: ModelPreset[] = [
  {
    id: 'qwen-max',
    name: '通义千问 Max',
    provider: '阿里云',
    apiType: 'openai',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode',
    model: 'qwen-max',
    description: '通义千问旗舰模型',
    temperature: 0.7,
    maxTokens: 4096,
  },
  {
    id: 'qwen-plus',
    name: '通义千问 Plus',
    provider: '阿里云',
    apiType: 'openai',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode',
    model: 'qwen-plus',
    description: '通义千问增强版',
    temperature: 0.7,
    maxTokens: 4096,
  },
  {
    id: 'qwen-turbo',
    name: '通义千问 Turbo',
    provider: '阿里云',
    apiType: 'openai',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode',
    model: 'qwen-turbo',
    description: '通义千问轻量版，速度快',
    temperature: 0.7,
    maxTokens: 4096,
  },
];

// Moonshot Kimi 系列
export const KIMI_PRESETS: ModelPreset[] = [
  {
    id: 'kimi-latest',
    name: 'Kimi',
    provider: 'Moonshot',
    apiType: 'openai',
    baseURL: 'https://api.moonshot.cn',
    model: 'kimi-latest',
    description: 'Kimi 最新模型',
    temperature: 0.7,
    maxTokens: 4096,
  },
  {
    id: 'kimi-k1',
    name: 'Kimi K1',
    provider: 'Moonshot',
    apiType: 'openai',
    baseURL: 'https://api.moonshot.cn',
    model: 'kimi-k1',
    description: 'Kimi K1 推理模型',
    temperature: 0.7,
    maxTokens: 4096,
  },
];

// Zhipu GLM 系列
export const GLM_PRESETS: ModelPreset[] = [
  {
    id: 'glm-4',
    name: 'GLM-4',
    provider: '智谱AI',
    apiType: 'openai',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4',
    description: '智谱GLM-4 旗舰模型',
    temperature: 0.7,
    maxTokens: 4096,
  },
  {
    id: 'glm-4-flash',
    name: 'GLM-4 Flash',
    provider: '智谱AI',
    apiType: 'openai',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    description: '智谱GLM-4 轻量版',
    temperature: 0.7,
    maxTokens: 4096,
  },
];

// 所有预设
export const ALL_MODEL_PRESETS: ModelPreset[] = [
  ...OPENAI_PRESETS,
  ...ANTHROPIC_PRESETS,
  ...DEEPSEEK_PRESETS,
  ...QWEN_PRESETS,
  ...KIMI_PRESETS,
  ...GLM_PRESETS,
];

// 按提供商分组
export function getPresetsByProvider(): Record<string, ModelPreset[]> {
  const groups: Record<string, ModelPreset[]> = {};
  ALL_MODEL_PRESETS.forEach(preset => {
    if (!groups[preset.provider]) {
      groups[preset.provider] = [];
    }
    groups[preset.provider].push(preset);
  });
  return groups;
}

// 根据ID获取预设
export function getPresetById(id: string): ModelPreset | undefined {
  return ALL_MODEL_PRESETS.find(preset => preset.id === id);
}

// 获取所有提供商
export function getAllProviders(): string[] {
  return [...new Set(ALL_MODEL_PRESETS.map(p => p.provider))];
}
