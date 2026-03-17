/**
 * 三层配置系统类型定义
 * Provider -> Model -> Agent
 */

import type { ApiType } from '../types';

// ============================================================
// Provider 配置（基础连接信息）
// ============================================================

export interface ProviderConfig {
  /** 唯一标识，如 "openai", "deepseek-custom" */
  id: string;
  /** 显示名称 */
  name: string;
  /** API 类型 */
  apiType: ApiType;
  /** Base URL */
  baseURL: string;
  /** API Key（可空，从环境变量读取） */
  apiKey?: string;
  /** 该 provider 支持的模型列表 */
  supportedModels: string[];
  /** 是否默认启用 */
  enabled: boolean;
  /** 额外 headers */
  headers?: Record<string, string>;
}

// ============================================================
// Model 配置（模型参数）
// ============================================================

export interface ModelProfile {
  /** 唯一标识，如 "gpt-4o", "deepseek-chat-prod" */
  id: string;
  /** 显示名称 */
  name: string;
  /** 引用的 provider ID */
  providerId: string;
  /** 实际的模型名称（传给 API 的值） */
  modelName: string;
  /** 默认温度 */
  temperature: number;
  /** 最大 token */
  maxTokens?: number;
  /** 上下文窗口大小 */
  contextWindow?: number;
  /** 是否支持 function calling */
  supportsTools: boolean;
  /** 是否支持 reasoning */
  supportsReasoning: boolean;
  /** 成本估算（每 1K tokens） */
  costPer1KTokens?: {
    input: number;
    output: number;
  };
  /** 自定义参数 */
  customParams?: Record<string, unknown>;
}

// ============================================================
// Agent 配置（运行时配置）
// ============================================================

export interface AgentProfile {
  /** 唯一标识 */
  id: string;
  /** 显示名称 */
  name: string;
  /** 引用的模型配置 ID */
  modelProfileId: string;
  /** 引用的角色 ID */
  roleId: string;
  /** 覆盖温度（可选） */
  temperatureOverride?: number;
  /** 最大迭代次数 */
  maxIterations?: number;
  /** 是否启用工具 */
  enableTools: boolean;
  /** 特定于此 agent 的工具白名单（空数组表示全部） */
  toolWhitelist: string[];
  /** 是否启用存储 */
  enableStorage: boolean;
}

// ============================================================
// 完整配置集合
// ============================================================

export interface AppConfig {
  version: number;
  providers: ProviderConfig[];
  modelProfiles: ModelProfile[];
  agentProfiles: AgentProfile[];
  /** 默认单 agent 配置 */
  defaultSingleAgentId?: string;
  /** 默认双 agent 配置 */
  defaultDebateAgentIds?: [string, string];
}

// ============================================================
// 运行时解析后的配置（用于 AgentLoop）
// ============================================================

export interface ResolvedAgentConfig {
  id: string;
  name: string;
  personality: 'gentle' | 'angry' | 'neutral';
  apiType: ApiType;
  baseURL: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens?: number;
  maxIterations: number;
  enableTools: boolean;
  toolWhitelist: string[];
  enableStorage: boolean;
  // 来源追踪
  _source: {
    providerId: string;
    modelProfileId: string;
    roleId: string;
  };
}
