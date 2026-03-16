# 上下文管理与配置持久化系统

本文档介绍 Double Agent 项目的两个核心子系统：上下文管理系统和 .env 配置持久化系统。

## 目录

- [上下文管理系统](#上下文管理系统)
- [.env 配置持久化系统](#env-配置持久化系统)
- [动态结束判断机制](#动态结束判断机制)

---

## 上下文管理系统

上下文管理系统负责监控和优化对话的 token 使用量，防止超出模型的上下文限制。

### 核心组件

#### 1. Token 计数器 (`src/utils/tokenCounter.ts`)

提供简化的 token 估算功能：

```typescript
// 估算单条文本的 token 数
export function estimateTokens(text: string): number {
  // 中文字符：每个约 1.5 tokens
  // 英文单词：每个约 1.3 tokens
  // 其他字符：每个约 0.5 tokens
}

// 估算消息列表的 token 数（包含每条消息的额外开销）
export function estimateMessagesTokens(messages: Array<{ role: string; content: string }>): number
```

**支持的模型上下文限制：**

| 提供商 | 模型 | 上下文限制 |
|--------|------|-----------|
| OpenAI | gpt-4o, gpt-4o-mini, gpt-4-turbo | 128K |
| OpenAI | gpt-4 | 8K |
| OpenAI | gpt-3.5-turbo | 16K |
| Anthropic | claude-3 系列 | 200K |
| DeepSeek | deepseek-chat, deepseek-reasoner | 64K |
| 阿里云 | qwen-max, qwen-plus | 32K |
| Moonshot | kimi-latest, kimi-k1 | 200K |
| 智谱 | glm-4, glm-4-flash | 128K |

#### 2. 上下文压缩机制

当上下文使用量达到 **80% 阈值**时，系统自动触发压缩：

```typescript
// 检查是否需要压缩
export function shouldCompact(stats: ContextStats, threshold: number = 80): boolean {
  return stats.usagePercent >= threshold;
}

// 压缩策略：保留系统消息 + 最近 N 条消息，中间内容生成摘要
export function compactMessages(
  messages: Array<{ role: string; content: string }>,
  keepRecent: number = 4  // 默认保留最近 4 条
): Array<{ role: string; content: string }>
```

**压缩流程：**
1. 保留所有系统消息（`role: 'system'`）
2. 保留最近 N 条消息（默认 4 条）
3. 中间的消息生成摘要，格式为：
   ```
   [之前对话的摘要]
   用户: {内容前100字符}...
   助手: {内容前100字符}...
   ...
   ```

#### 3. 用户命令 `/compact`

用户可以在输入框中输入 `/compact` 手动触发上下文压缩：

```typescript
// src/components/UserInput.tsx
if (trimmed === '/compact') {
  onCompact?.();
  return;
}
```

#### 4. AgentTeam 中的 compactContext() 实现

```typescript
// src/agents/AgentTeam.ts
export class AgentTeam {
  // 手动压缩上下文
  compactContext(): boolean {
    const originalLength = this.fullMessageHistory.length;
    this.fullMessageHistory = compactMessages(this.fullMessageHistory, 4);
    const wasCompacted = this.fullMessageHistory.length < originalLength;

    this.updateContextStats();
    return wasCompacted;
  }

  // 自动压缩检查（在每次对话轮次时调用）
  private checkAndAutoCompact(): boolean {
    const stats = this.getContextStats();
    if (shouldCompact(stats.stats, 80)) {
      return this.compactContext();
    }
    return false;
  }
}
```

**自动压缩触发时机：**
- 在 `runSingle()` 和 `runDebate()` 的每轮对话开始时检查
- 当 token 使用量超过 80% 时自动压缩
- 压缩后会在控制台输出日志：`[Context] 已自动压缩上下文，当前轮数: X`

---

## .env 配置持久化系统

.env 配置系统允许用户将 Agent 配置保存到 `.env.local` 文件，实现配置的持久化。

### 核心组件

#### 1. envConfig.ts (`src/stores/envConfig.ts`)

##### loadConfigFromEnv(personality)

从 Vite 环境变量加载指定人格的配置：

```typescript
function loadConfigFromEnv(personality: AgentPersonality): Partial<AgentConfig> {
  const prefix = personality === 'gentle' ? 'VITE_GENTLE' : 'VITE_ANGRY';

  // 读取环境变量（Vite 要求以 VITE_ 开头）
  const apiType = import.meta.env[`${prefix}_API_TYPE`];
  const baseURL = import.meta.env[`${prefix}_BASE_URL`];
  const apiKey = import.meta.env[`${prefix}_API_KEY`];
  const model = import.meta.env[`${prefix}_MODEL`];
  const temperature = import.meta.env[`${prefix}_TEMPERATURE`];
  const maxRounds = import.meta.env[`${prefix}_MAX_ROUNDS`];
  const roleId = import.meta.env[`${prefix}_ROLE_ID`];

  // 如果指定了 roleId，自动加载对应的 systemPrompt
  if (roleId) {
    const role = getRoleById(roleId);
    if (role) {
      config.systemPrompt = role.systemPrompt;
    }
  }
}
```

##### exportToEnv(gentleConfig, angryConfig)

将配置导出为 `.env` 格式字符串：

```typescript
export function exportToEnv(
  gentleConfig: AgentConfig,
  angryConfig: AgentConfig
): string {
  // 尝试匹配当前配置到角色ID
  const gentleRole = allRoles.find(r =>
    r.personality === 'gentle' &&
    r.systemPrompt === gentleConfig.systemPrompt
  );

  return `# Double Agent 配置文件
VITE_GENTLE_API_TYPE=${gentleConfig.apiType}
VITE_GENTLE_BASE_URL=${gentleConfig.baseURL}
...`;
}
```

##### saveEnvToServer(gentleConfig, angryConfig)

通过 API 将配置保存到服务器的 `.env.local` 文件：

```typescript
export async function saveEnvToServer(
  gentleConfig: AgentConfig,
  angryConfig: AgentConfig
): Promise<{ success: boolean; message?: string; error?: string }> {
  const envContent = exportToEnv(gentleConfig, angryConfig);

  const response = await fetch('/api/save-env', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: envContent }),
  });

  return result;
}
```

##### hasEnvConfig() / mergeWithEnvConfig()

```typescript
// 检查是否存在任何 env 配置
export function hasEnvConfig(): boolean {
  const gentleConfig = loadConfigFromEnv('gentle');
  const angryConfig = loadConfigFromEnv('angry');
  return Object.keys(gentleConfig).length > 0 ||
         Object.keys(angryConfig).length > 0;
}

// 合并配置（env 配置优先级高于 baseConfig）
export function mergeWithEnvConfig(
  baseConfig: AgentConfig,
  personality: AgentPersonality
): AgentConfig {
  const envConfig = loadConfigFromEnv(personality);
  return {
    ...baseConfig,
    ...envConfig,
    // 确保这些字段始终存在
    id: baseConfig.id,
    name: baseConfig.name,
    personality: baseConfig.personality,
  };
}
```

#### 2. vite-env-save-plugin.ts

Vite 开发服务器插件，提供 `/api/save-env` 端点：

```typescript
export function envSavePlugin(options: EnvSavePluginOptions = {}): Plugin {
  const envFile = options.envFile || '.env.local';

  return {
    name: 'vite-plugin-env-save',
    configureServer(server) {
      server.middlewares.use('/api/save-env', async (req, res, _next) => {
        // 只处理 POST 请求
        if (req.method !== 'POST') {
          res.statusCode = 405;
          return;
        }

        // 解析请求体
        const { content } = JSON.parse(body);

        // 写入 .env.local 文件
        const envPath = path.resolve(process.cwd(), envFile);
        await fs.writeFile(envPath, content, 'utf-8');

        res.end(JSON.stringify({
          success: true,
          message: `Configuration saved to ${envFile}`,
          path: envPath
        }));
      });
    },
  };
}
```

### 配置优先级

配置加载遵循以下优先级（从高到低）：

```
.env.local > localStorage > 默认值
```

**具体流程：**
1. **`.env.local`**：如果存在环境变量配置，优先级最高
2. **`localStorage`**：用户通过 UI 保存的配置
3. **默认值**：代码中的默认配置

在 `src/stores/index.ts` 中：

```typescript
// 1. 从 localStorage 加载基础配置
const stored = localStorage.getItem(STORAGE_KEY);
const baseConfig = stored ? JSON.parse(stored) : defaultConfig;

// 2. 如果有 .env 配置，合并（env 优先级更高）
if (hasEnvConfig()) {
  return mergeWithEnvConfig(baseConfig, personality);
}

return baseConfig;
```

### 环境变量命名规范

| 配置项 | Gentle Agent | Angry Agent |
|--------|-------------|-------------|
| API 类型 | `VITE_GENTLE_API_TYPE` | `VITE_ANGRY_API_TYPE` |
| Base URL | `VITE_GENTLE_BASE_URL` | `VITE_ANGRY_BASE_URL` |
| API Key | `VITE_GENTLE_API_KEY` | `VITE_ANGRY_API_KEY` |
| 模型 | `VITE_GENTLE_MODEL` | `VITE_ANGRY_MODEL` |
| 温度 | `VITE_GENTLE_TEMPERATURE` | `VITE_ANGRY_TEMPERATURE` |
| 最大轮数 | `VITE_GENTLE_MAX_ROUNDS` | `VITE_ANGRY_MAX_ROUNDS` |
| 角色 ID | `VITE_GENTLE_ROLE_ID` | `VITE_ANGRY_ROLE_ID` |

---

## 动态结束判断机制

动态结束判断机制让 AI 自主决定对话何时应该结束，而不是固定轮数。

### 实现原理

#### 1. 角色专属的结束判断提示

每个角色在 `src/prompts/roles.ts` 中定义了 `endingPrompt`：

```typescript
export interface RoleDefinition {
  id: string;
  name: string;
  personality: AgentPersonality;
  systemPrompt: string;
  endingPrompt?: string;  // 用于判断对话是否应该结束
}

// 示例：温和助手的结束判断提示
{
  endingPrompt: `请判断当前对话是否已经可以结束。考虑以下因素：
1. 问题是否得到了充分的回答
2. 双方是否达成了共识或找到了解决方案
3. 是否还有新的观点需要补充

如果认为对话可以结束，请回复："[END]"
如果认为还需要继续讨论，请回复："[CONTINUE]"

只回复上述标记之一，不要添加其他内容。`,
}
```

#### 2. AgentTeam 中的结束判断

```typescript
// src/agents/AgentTeam.ts
private async checkShouldEnd(
  config: AgentConfig,
  conversationHistory: Message[],
  isSingleMode: boolean,
  signal?: AbortSignal
): Promise<EndingCheckResult> {
  // 获取角色的结束判断提示
  const endingPrompt = getEndingPrompt(config.systemPrompt, isSingleMode);

  const checkMessages: Message[] = [
    ...conversationHistory,
    { role: 'user', content: endingPrompt },
  ];

  // 发送非流式请求给 AI
  const response = await this.request(config, checkMessages, signal);
  const content = response.trim();

  // 解析结果
  if (content.includes('[END]')) {
    return { shouldEnd: true, reason: content };
  }
  return { shouldEnd: false, reason: content };
}
```

#### 3. 结束判断触发时机

**单 Agent 模式 (`runSingle`)：**
- 从第 1 轮开始检查（至少完成一轮回复）
- 每轮回复后调用 `checkShouldEnd()`

**双 Agent 辩论模式 (`runDebate`)：**
- 从第 2 轮开始检查（让双方都有发言机会）
- 使用温和 Agent 来判断是否结束（更保守）

```typescript
// 双 Agent 模式中的结束判断
if (this.currentRound >= 2) {
  // 使用温和Agent来判断是否结束（更保守）
  const { shouldEnd } = await this.checkShouldEnd(
    this.gentleConfig,  // 使用温和 Agent 的判断
    this.fullMessageHistory,
    false,
    signal
  );

  onRoundComplete?.(this.currentRound, shouldEnd);

  if (shouldEnd || this.checkShouldStop()) {
    break;
  }
}
```

#### 4. 安全上限

防止无限循环：

```typescript
private maxAutoRounds = 10;  // 最大自动轮数

while (this.currentRound < this.maxAutoRounds) {
  // 对话循环...
}

// 如果达到最大轮数，强制结束
if (this.currentRound >= this.maxAutoRounds) {
  onRoundComplete?.(this.currentRound, true);
}
```

### 结束判断流程图

```
用户输入问题
    ↓
开始对话循环
    ↓
检查是否达到最大轮数 ──是──→ 强制结束
    ↓ 否
检查上下文是否需要压缩
    ↓
Agent 生成回复
    ↓
更新上下文统计
    ↓
保存对话轮次
    ↓
检查是否满足结束条件？
    ↓
  是 ──→ 触发结束判断 AI ──→ 返回 [END]? ──是──→ 结束对话
    ↓ 否                              ↓ 否
  继续下一轮 ←────────────────────────┘
```

---

## 相关文件

| 文件 | 说明 |
|------|------|
| `src/utils/tokenCounter.ts` | Token 估算和上下文压缩 |
| `src/agents/AgentTeam.ts` | 上下文管理和结束判断实现 |
| `src/hooks/useAgentTeam.ts` | React Hook 封装 |
| `src/stores/envConfig.ts` | .env 配置加载和保存 |
| `src/stores/index.ts` | 配置优先级处理 |
| `vite-env-save-plugin.ts` | Vite 插件实现 |
| `src/prompts/roles.ts` | 角色定义和结束判断提示 |
| `src/components/UserInput.tsx` | `/compact` 命令处理 |
