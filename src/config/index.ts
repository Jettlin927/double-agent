// 类型定义
export type {
  ProviderConfig,
  ModelProfile,
  AgentProfile,
  AppConfig,
  ResolvedAgentConfig,
} from './types';

// 预设配置
export {
  DEFAULT_PROVIDERS,
  DEFAULT_MODEL_PROFILES,
  createDefaultAppConfig,
} from './presets';

// 配置管理器
export { configManager, useConfigManager } from './ConfigManager';
