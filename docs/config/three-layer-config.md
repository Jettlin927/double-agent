# 三层配置系统

Double Agent 采用 Provider → Model → Agent 三层配置架构，实现灵活、可复用的配置管理。

## 架构图

```
┌─────────────────────────────────────────┐
│            Provider (基础连接)           │
│  - id, name, apiType, baseURL, apiKey   │
│  - supportedModels, headers             │
└─────────────────┬───────────────────────┘
                  │ 引用
                  ▼
┌─────────────────────────────────────────┐
│            Model (模型参数)              │
│  - id, name, providerId                 │
│  - modelName, temperature, maxTokens    │
│  - contextWindow, supportsTools         │
└─────────────────┬───────────────────────┘
                  │ 引用
                  ▼
┌─────────────────────────────────────────┐
│             Agent (运行时)               │
│  - id, name, modelProfileId             │
│  - roleId, temperatureOverride          │
│  - enableTools, maxIterations           │
└─────────────────────────────────────────┘
```

## 层级说明

### 第一层：Provider

**职责**: 定义 API 提供商的连接信息

**关键字段**:
```typescript
interface ProviderConfig {
  id: string;              // 唯一标识，如 "openai", "deepseek-custom"
  name: string;            // 显示名称
  apiType: ApiType;        // 'openai' | 'anthropic'
  baseURL: string;         // API 基础 URL
  apiKey?: string;         // API Key（可选，从环境变量读取）
  supportedModels: string[];  // 支持的模型列表
  enabled: boolean;        // 是否启用
  headers?: Record<string, string>;  // 额外请求头
}
```

**示例**:
```typescript
const openaiProvider: ProviderConfig = {
  id: 'openai',
  name: 'OpenAI',
  apiType: 'openai',
  baseURL: 'https://api.openai.com',
  supportedModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  enabled: true,
};

const deepseekProvider: ProviderConfig = {
  id: 'deepseek',
  name: 'DeepSeek',
  apiType: 'openai',  // OpenAI 兼容格式
  baseURL: 'https://api.deepseek.com',
  supportedModels: ['deepseek-chat', 'deepseek-reasoner'],
  enabled: true,
};
```

### 第二层：Model

**职责**: 定义模型参数和行为特性

**关键字段**:
```typescript
interface ModelProfile {
  id: string;              // 唯一标识，如 "gpt-4o", "deepseek-chat-prod"
  name: string;            // 显示名称
  providerId: string;      // 引用的 Provider ID
  modelName: string;       // 实际的模型名称（传给 API 的值）
  temperature: number;     // 默认温度 (0-2)
  maxTokens?: number;      // 最大生成 token
  contextWindow?: number;  // 上下文窗口大小
  supportsTools: boolean;  // 是否支持 function calling
  supportsReasoning: boolean;  // 是否支持推理
  costPer1KTokens?: {      // 成本估算
    input: number;
    output: number;
  };
  customParams?: Record<string, unknown>;  // 自定义参数
}
```

**示例**:
```typescript
const gpt4oModel: ModelProfile = {
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
};

const deepseekChatModel: ModelProfile = {
  id: 'deepseek-chat',
  name: 'DeepSeek Chat',
  providerId: 'deepseek',
  modelName: 'deepseek-chat',
  temperature: 0.7,
  maxTokens: 8192,
  contextWindow: 64000,
  supportsTools: true,
  supportsReasoning: true,  // 支持推理
};
```

### 第三层：Agent

**职责**: 定义运行时配置和行为

**关键字段**:
```typescript
interface AgentProfile {
  id: string;              // 唯一标识
  name: string;            // 显示名称
  modelProfileId: string;  // 引用的 Model ID
  roleId: string;          // 引用的角色 ID
  temperatureOverride?: number;  // 覆盖温度（可选）
  maxIterations?: number;  // 最大迭代次数（AgentLoop）
  enableTools: boolean;    // 是否启用工具
  toolWhitelist: string[]; // 工具白名单（空数组=全部）
  enableStorage: boolean;  // 是否启用后端存储
}
```

**示例**:
```typescript
const gentleAgent: AgentProfile = {
  id: 'gentle-gpt4o',
  name: '温和助手',
  modelProfileId: 'gpt-4o',
  roleId: 'gentle-default',
  temperatureOverride: 0.6,  // 使用更低的温度
  maxIterations: 10,
  enableTools: true,
  toolWhitelist: [],  // 所有工具
  enableStorage: true,
};

const angryAgent: AgentProfile = {
  id: 'angry-claude',
  name: '暴躁评论家',
  modelProfileId: 'claude-sonnet',
  roleId: 'angry-default',
  temperatureOverride: 0.9,  // 使用更高的温度
  maxIterations: 15,
  enableTools: false,  // 禁用工具
  toolWhitelist: [],
  enableStorage: true,
};
```

## 配置解析流程

```
Agent Profile
     │
     ▼
get modelProfileId
     │
     ▼
Model Profile ──► get providerId
     │                │
     ▼                ▼
Provider ◄───────────┘
     │
     ▼
Role (roleId)
     │
     ▼
ResolvedAgentConfig
```

**解析结果**:

```typescript
interface ResolvedAgentConfig {
  id: string;
  name: string;
  personality: 'gentle' | 'angry' | 'neutral';
  apiType: ApiType;
  baseURL: string;
  apiKey: string;          // 从 Provider 或环境变量获取
  model: string;           // 实际的模型名称
  systemPrompt: string;    // 从 Role 获取
  temperature: number;     // 使用 override 或 Model 默认值
  maxTokens?: number;
  maxIterations: number;
  enableTools: boolean;
  toolWhitelist: string[];
  enableStorage: boolean;
  _source: {               // 来源追踪
    providerId: string;
    modelProfileId: string;
    roleId: string;
  };
}
```

## 配置管理

### ConfigManager

单例模式管理配置：

```typescript
import { configManager } from '@/config/ConfigManager';

// 获取所有配置
const config = configManager.getConfig();

// 获取特定层
const providers = configManager.getProviders();
const models = configManager.getModelProfiles();
const agents = configManager.getAgentProfiles();

// 解析 Agent 配置
const resolved = configManager.resolveAgentConfig('gentle-gpt4o');
// 返回 ResolvedAgentConfig 或 null

// 验证配置
const error = configManager.validateConfig('gentle-gpt4o');
// 返回错误信息或 null
```

### 配置修改

```typescript
// 添加/更新 Provider
configManager.addProvider(newProvider);

// 删除 Provider（有 Model 引用时无法删除）
const success = configManager.removeProvider('openai');

// 添加/更新 Model
configManager.addModelProfile(newModel);

// 删除 Model（有 Agent 引用时无法删除）
const success = configManager.removeModelProfile('gpt-4o');

// 添加/更新 Agent
configManager.addAgentProfile(newAgent);

// 删除 Agent（默认 Agent 无法删除）
const success = configManager.removeAgentProfile('gentle-gpt4o');
```

### 默认配置

```typescript
// 设置默认单 Agent
configManager.setDefaultSingleAgent('gentle-gpt4o');

// 设置默认辩论 Agent
configManager.setDefaultDebateAgents(['gentle-gpt4o', 'angry-claude']);

// 获取默认配置
const single = configManager.getDefaultSingleAgent();
const debate = configManager.getDefaultDebateAgents();
```

## 持久化

配置存储在 localStorage：

```typescript
const STORAGE_KEY = 'double-agent-config-v1';
```

**存储结构**:
```typescript
interface AppConfig {
  version: number;                    // 配置版本
  providers: ProviderConfig[];
  modelProfiles: ModelProfile[];
  agentProfiles: AgentProfile[];
  defaultSingleAgentId?: string;
  defaultDebateAgentIds?: [string, string];
}
```

**版本兼容**:
- 加载时自动合并默认配置，确保新字段存在
- 保留用户自定义的配置项
- Provider/Model 使用合并策略（默认 + 用户覆盖）

## API Key 安全

**读取优先级**:
1. Provider 配置中的 `apiKey` 字段
2. 环境变量 `VITE_{PROVIDER_ID}_API_KEY`
3. 环境变量 `VITE_OPENAI_API_KEY`（fallback）

**安全注意**:
- API Key 不会被持久化到 localStorage
- 每次加载时从环境变量重新获取
- 生产环境应仅使用环境变量

## 使用示例

### 创建完整配置

```typescript
import { configManager } from '@/config/ConfigManager';

// 1. 创建 Provider
configManager.addProvider({
  id: 'my-openai',
  name: 'My OpenAI',
  apiType: 'openai',
  baseURL: 'https://api.openai.com',
  supportedModels: ['gpt-4o'],
  enabled: true,
});

// 2. 创建 Model
configManager.addModelProfile({
  id: 'my-gpt4o',
  name: 'GPT-4o',
  providerId: 'my-openai',
  modelName: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 4096,
  supportsTools: true,
  supportsReasoning: false,
});

// 3. 创建 Agent
configManager.addAgentProfile({
  id: 'my-assistant',
  name: 'My Assistant',
  modelProfileId: 'my-gpt4o',
  roleId: 'gentle-default',
  enableTools: true,
  toolWhitelist: [],
  enableStorage: true,
});

// 4. 使用
const config = configManager.resolveAgentConfig('my-assistant');
console.log(config.baseURL);  // https://api.openai.com
console.log(config.model);    // gpt-4o
```

### 导出/导入配置

```typescript
// 导出（备份）
const json = configManager.exportConfig();
// 保存到文件...

// 导入（恢复）
const success = configManager.importConfig(jsonString);
```

### 重置配置

```typescript
// 重置为默认配置
configManager.resetToDefaults();
```

## 相关文件

| 文件 | 说明 |
|------|------|
| `ConfigManager.ts` | 配置管理器实现 |
| `types.ts` | 配置类型定义 |
| `presets.ts` | 默认预设配置 |
