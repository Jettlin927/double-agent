# 三层配置系统设计

## 架构概览

```
ProviderConfig (提供商配置)
    ├── id: 唯一标识
    ├── apiType: 'openai' | 'anthropic'
    ├── baseURL: API 基础地址
    └── supportedModels: 支持的模型列表

ModelProfile (模型配置)
    ├── id: 唯一标识
    ├── providerId: 关联的 Provider
    ├── modelName: 实际模型名称
    ├── temperature: 默认温度
    ├── maxTokens: 最大 token
    └── supportsTools: 是否支持工具

AgentProfile (Agent 配置)
    ├── id: 唯一标识
    ├── modelProfileId: 关联的 Model
    ├── roleId: 关联的角色
    ├── enableTools: 是否启用工具
    └── toolWhitelist: 工具白名单
```

## 使用方式

### 1. 基本使用（获取默认配置）

```typescript
import { configManager } from '../config';

// 获取默认单 Agent 配置
const singleConfig = configManager.getDefaultSingleAgent();

// 获取默认辩论配置
const [gentleConfig, angryConfig] = configManager.getDefaultDebateAgents();
```

### 2. 使用 ResolvedAgentConfig 创建 AgentLoop

```typescript
import { configManager } from '../config';
import { AgentLoop } from '../agents/AgentLoop';

const resolvedConfig = configManager.resolveAgentConfig('gentle-gpt4o');
if (!resolvedConfig) {
  throw new Error('配置解析失败');
}

const agentLoop = new AgentLoop({
  config: resolvedConfig,
  sessionId: 'session-123',
  iterationNumber: 1,
});
```

### 3. 动态切换配置

```typescript
// 获取所有可用的 Agent 配置
const agents = configManager.getAgentProfiles();

// 用户选择后解析
const selectedConfig = configManager.resolveAgentConfig(selectedId);
```

### 4. 管理 Provider

```typescript
// 添加自定义 Provider
configManager.addProvider({
  id: 'my-openai-proxy',
  name: '我的 OpenAI 代理',
  apiType: 'openai',
  baseURL: 'https://my-proxy.example.com',
  supportedModels: ['gpt-4o', 'gpt-4o-mini'],
  enabled: true,
});

// 获取所有启用的 Provider
const providers = configManager.getEnabledProviders();
```

### 5. 管理 Model Profile

```typescript
// 添加自定义 Model
configManager.addModelProfile({
  id: 'gpt-4o-custom',
  name: 'GPT-4o (Custom)',
  providerId: 'my-openai-proxy',
  modelName: 'gpt-4o',
  temperature: 0.5,
  supportsTools: true,
  supportsReasoning: false,
});

// 获取某 Provider 下的所有 Models
const models = configManager.getModelsByProvider('openai');
```

### 6. 管理 Agent Profile

```typescript
// 添加自定义 Agent
configManager.addAgentProfile({
  id: 'creative-writer',
  name: '创意写手',
  modelProfileId: 'claude-sonnet',
  roleId: 'gentle-friend',
  temperatureOverride: 0.9,  // 更有创意
  enableTools: true,
  toolWhitelist: ['web_search', 'file_write'],
  enableStorage: true,
  maxIterations: 5,
});

// 设置为默认单 Agent
configManager.setDefaultSingleAgent('creative-writer');
```

## 向后兼容

现有的 `agentStore` 仍然可用，用于简单的双 Agent 场景：

```typescript
import { useAgentStore } from '../stores/agentStore';

// 旧方式仍然工作
const { gentleConfig, angryConfig, updateConfig } = useAgentStore();
```

新的配置系统适用于更复杂的场景（多 Agent、动态切换、Provider 管理等）。

## 配置持久化

- Provider 和 Model Profile：自动合并默认配置和用户修改
- Agent Profile：完全由用户定义
- 所有配置保存在 localStorage 的 `double-agent-config-v1` 键中

## 导入/导出

```typescript
// 导出配置（备份或分享）
const configJson = configManager.exportConfig();
downloadJson(configJson, 'my-config.json');

// 导入配置
const success = configManager.importConfig(configJson);
if (success) {
  alert('配置导入成功');
}
```
