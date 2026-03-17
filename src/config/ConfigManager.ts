/**
 * 配置管理器
 * 管理 Provider → Model → Agent 三层配置的加载、保存和解析
 */

import type {
  AppConfig,
  ProviderConfig,
  ModelProfile,
  AgentProfile,
  ResolvedAgentConfig,
} from './types';
import { createDefaultAppConfig } from './presets';
import { getRoleById } from '../prompts/roles';

const STORAGE_KEY = 'double-agent-config-v1';

class ConfigManager {
  private config: AppConfig;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.config = this.loadFromStorage();
  }

  // ============================================================
  // 存储操作
  // ============================================================

  private loadFromStorage(): AppConfig {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as AppConfig;
        // 合并默认配置，确保新字段存在
        return this.mergeWithDefaults(parsed);
      }
    } catch (error) {
      console.error('[ConfigManager] Failed to load config:', error);
    }
    return createDefaultAppConfig();
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
      this.notifyListeners();
    } catch (error) {
      console.error('[ConfigManager] Failed to save config:', error);
    }
  }

  private mergeWithDefaults(stored: AppConfig): AppConfig {
    const defaults = createDefaultAppConfig();
    return {
      ...defaults,
      ...stored,
      version: defaults.version,
      // 合并 providers（保留用户自定义的）
      providers: this.mergeArrays(defaults.providers, stored.providers || [], 'id'),
      // 合并 model profiles
      modelProfiles: this.mergeArrays(defaults.modelProfiles, stored.modelProfiles || [], 'id'),
      // Agent profiles 完全以用户为准
      agentProfiles: stored.agentProfiles || defaults.agentProfiles,
    };
  }

  private mergeArrays<T extends { id: string }>(
    defaults: T[],
    stored: T[],
    key: keyof T
  ): T[] {
    const storedMap = new Map(stored.map(item => [item[key], item]));
    return defaults.map(def => ({
      ...def,
      ...(storedMap.get(def[key]) || {}),
    }));
  }

  // ============================================================
  // 订阅机制
  // ============================================================

  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(cb => cb());
  }

  // ============================================================
  // Getter 方法
  // ============================================================

  getConfig(): AppConfig {
    return { ...this.config };
  }

  getProviders(): ProviderConfig[] {
    return [...this.config.providers];
  }

  getEnabledProviders(): ProviderConfig[] {
    return this.config.providers.filter(p => p.enabled);
  }

  getProvider(id: string): ProviderConfig | undefined {
    return this.config.providers.find(p => p.id === id);
  }

  getModelProfiles(): ModelProfile[] {
    return [...this.config.modelProfiles];
  }

  getModelProfile(id: string): ModelProfile | undefined {
    return this.config.modelProfiles.find(m => m.id === id);
  }

  getModelsByProvider(providerId: string): ModelProfile[] {
    return this.config.modelProfiles.filter(m => m.providerId === providerId);
  }

  getAgentProfiles(): AgentProfile[] {
    return [...this.config.agentProfiles];
  }

  getAgentProfile(id: string): AgentProfile | undefined {
    return this.config.agentProfiles.find(a => a.id === id);
  }

  // ============================================================
  // Setter 方法
  // ============================================================

  addProvider(provider: ProviderConfig): void {
    const index = this.config.providers.findIndex(p => p.id === provider.id);
    if (index >= 0) {
      this.config.providers[index] = provider;
    } else {
      this.config.providers.push(provider);
    }
    this.saveToStorage();
  }

  removeProvider(id: string): boolean {
    // 检查是否有 model 引用此 provider
    const hasModels = this.config.modelProfiles.some(m => m.providerId === id);
    if (hasModels) {
      console.warn('[ConfigManager] Cannot remove provider with associated models');
      return false;
    }

    const index = this.config.providers.findIndex(p => p.id === id);
    if (index >= 0) {
      this.config.providers.splice(index, 1);
      this.saveToStorage();
      return true;
    }
    return false;
  }

  addModelProfile(profile: ModelProfile): void {
    const index = this.config.modelProfiles.findIndex(m => m.id === profile.id);
    if (index >= 0) {
      this.config.modelProfiles[index] = profile;
    } else {
      this.config.modelProfiles.push(profile);
    }
    this.saveToStorage();
  }

  removeModelProfile(id: string): boolean {
    // 检查是否有 agent 引用此 model
    const hasAgents = this.config.agentProfiles.some(a => a.modelProfileId === id);
    if (hasAgents) {
      console.warn('[ConfigManager] Cannot remove model with associated agents');
      return false;
    }

    const index = this.config.modelProfiles.findIndex(m => m.id === id);
    if (index >= 0) {
      this.config.modelProfiles.splice(index, 1);
      this.saveToStorage();
      return true;
    }
    return false;
  }

  addAgentProfile(profile: AgentProfile): void {
    const index = this.config.agentProfiles.findIndex(a => a.id === profile.id);
    if (index >= 0) {
      this.config.agentProfiles[index] = profile;
    } else {
      this.config.agentProfiles.push(profile);
    }
    this.saveToStorage();
  }

  removeAgentProfile(id: string): boolean {
    // 不能删除默认配置
    if (this.config.defaultSingleAgentId === id) {
      console.warn('[ConfigManager] Cannot remove default single agent');
      return false;
    }
    if (this.config.defaultDebateAgentIds?.includes(id)) {
      console.warn('[ConfigManager] Cannot remove default debate agent');
      return false;
    }

    const index = this.config.agentProfiles.findIndex(a => a.id === id);
    if (index >= 0) {
      this.config.agentProfiles.splice(index, 1);
      this.saveToStorage();
      return true;
    }
    return false;
  }

  setDefaultSingleAgent(id: string): void {
    if (this.config.agentProfiles.some(a => a.id === id)) {
      this.config.defaultSingleAgentId = id;
      this.saveToStorage();
    }
  }

  setDefaultDebateAgents(ids: [string, string]): void {
    if (ids.every(id => this.config.agentProfiles.some(a => a.id === id))) {
      this.config.defaultDebateAgentIds = ids;
      this.saveToStorage();
    }
  }

  // ============================================================
  // 核心方法：解析 Agent 配置
  // ============================================================

  resolveAgentConfig(agentProfileId: string): ResolvedAgentConfig | null {
    const agent = this.getAgentProfile(agentProfileId);
    if (!agent) {
      console.error(`[ConfigManager] Agent profile not found: ${agentProfileId}`);
      return null;
    }

    const model = this.getModelProfile(agent.modelProfileId);
    if (!model) {
      console.error(`[ConfigManager] Model profile not found: ${agent.modelProfileId}`);
      return null;
    }

    const provider = this.getProvider(model.providerId);
    if (!provider) {
      console.error(`[ConfigManager] Provider not found: ${model.providerId}`);
      return null;
    }

    const role = getRoleById(agent.roleId);
    if (!role) {
      console.error(`[ConfigManager] Role not found: ${agent.roleId}`);
      return null;
    }

    // 从环境变量获取 API Key
    const envKeyPrefix = provider.id.toUpperCase().replace(/-/g, '_');
    const apiKey =
      provider.apiKey ||
      import.meta.env[`VITE_${envKeyPrefix}_API_KEY`] ||
      import.meta.env.VITE_OPENAI_API_KEY || // fallback
      '';

    return {
      id: agent.id,
      name: agent.name,
      personality: role.personality,
      apiType: provider.apiType,
      baseURL: provider.baseURL,
      apiKey,
      model: model.modelName,
      systemPrompt: role.systemPrompt,
      temperature: agent.temperatureOverride ?? model.temperature,
      maxTokens: model.maxTokens,
      maxIterations: agent.maxIterations ?? 10,
      enableTools: agent.enableTools,
      toolWhitelist: agent.toolWhitelist,
      enableStorage: agent.enableStorage,
      _source: {
        providerId: provider.id,
        modelProfileId: model.id,
        roleId: role.id,
      },
    };
  }

  // ============================================================
  // 便捷方法
  // ============================================================

  getDefaultSingleAgent(): ResolvedAgentConfig | null {
    const id = this.config.defaultSingleAgentId;
    return id ? this.resolveAgentConfig(id) : null;
  }

  getDefaultDebateAgents(): [ResolvedAgentConfig | null, ResolvedAgentConfig | null] {
    const ids = this.config.defaultDebateAgentIds;
    if (!ids) return [null, null];
    return [this.resolveAgentConfig(ids[0]), this.resolveAgentConfig(ids[1])];
  }

  // 验证配置是否完整
  validateConfig(agentProfileId: string): string | null {
    const resolved = this.resolveAgentConfig(agentProfileId);
    if (!resolved) {
      return '配置解析失败';
    }
    if (!resolved.baseURL) {
      return 'Provider Base URL 未配置';
    }
    if (!resolved.apiKey) {
      return 'API Key 未配置';
    }
    return null;
  }

  // 导出/导入配置
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  importConfig(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as AppConfig;
      // 基础验证
      if (!parsed.providers || !parsed.modelProfiles || !parsed.agentProfiles) {
        throw new Error('Invalid config structure');
      }
      this.config = this.mergeWithDefaults(parsed);
      this.saveToStorage();
      return true;
    } catch (error) {
      console.error('[ConfigManager] Failed to import config:', error);
      return false;
    }
  }

  // 重置为默认配置
  resetToDefaults(): void {
    this.config = createDefaultAppConfig();
    this.saveToStorage();
  }
}

// 单例实例
export const configManager = new ConfigManager();

// React Hook
export function useConfigManager() {
  return configManager;
}
