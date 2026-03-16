import type { AgentConfig, AgentPersonality } from '../types';
import { getRoleById, getDefaultRole } from '../prompts';

// 从 Vite 环境变量加载配置
// Vite 的环境变量必须以 VITE_ 开头

interface EnvConfig {
  gentle: Partial<AgentConfig>;
  angry: Partial<AgentConfig>;
}

function loadConfigFromEnv(personality: AgentPersonality): Partial<AgentConfig> {
  const prefix = personality === 'gentle' ? 'VITE_GENTLE' : 'VITE_ANGRY';

  const apiType = import.meta.env[`${prefix}_API_TYPE`] as 'openai' | 'anthropic' | undefined;
  const baseURL = import.meta.env[`${prefix}_BASE_URL`] as string | undefined;
  const apiKey = import.meta.env[`${prefix}_API_KEY`] as string | undefined;
  const model = import.meta.env[`${prefix}_MODEL`] as string | undefined;
  const temperature = import.meta.env[`${prefix}_TEMPERATURE`] as string | undefined;
  const maxRounds = import.meta.env[`${prefix}_MAX_ROUNDS`] as string | undefined;
  const roleId = import.meta.env[`${prefix}_ROLE_ID`] as string | undefined;

  const config: Partial<AgentConfig> = {};

  if (apiType) config.apiType = apiType;
  if (baseURL) config.baseURL = baseURL;
  if (apiKey) config.apiKey = apiKey;
  if (model) config.model = model;
  if (temperature) config.temperature = parseFloat(temperature);
  if (maxRounds) config.maxRounds = parseInt(maxRounds);

  // 处理角色预设
  if (roleId) {
    const role = getRoleById(roleId);
    if (role) {
      config.systemPrompt = role.systemPrompt;
    }
  }

  return config;
}

// 检查是否有任何 env 配置
export function hasEnvConfig(): boolean {
  const gentleConfig = loadConfigFromEnv('gentle');
  const angryConfig = loadConfigFromEnv('angry');

  return Object.keys(gentleConfig).length > 0 || Object.keys(angryConfig).length > 0;
}

// 加载完整配置
export function loadEnvConfig(): EnvConfig {
  return {
    gentle: loadConfigFromEnv('gentle'),
    angry: loadConfigFromEnv('angry'),
  };
}

// 导出配置到 .env 格式
export function exportToEnv(gentleConfig: AgentConfig, angryConfig: AgentConfig): string {
  // 尝试匹配当前配置到角色ID
  const gentleRole = Object.values({
    'gentle-default': '温和助手',
    'gentle-therapist': '心理倾听者',
    'gentle-teacher': '循循善诱的老师',
    'gentle-friend': '知心好友',
  }).find(() => true); // 简化处理

  const angryRole = Object.values({
    'angry-default': '暴躁助手',
    'angry-critic': '毒舌评论家',
    'angry-debate': '辩论对手',
    'angry-mentor': '严师',
  }).find(() => true);

  return `# Double Agent 配置文件
# 保存此内容到项目根目录的 .env.local 文件
# 然后重启开发服务器使配置生效

# ============================================
# 温和 Agent (Gentle) 配置
# ============================================
VITE_GENTLE_API_TYPE=${gentleConfig.apiType}
VITE_GENTLE_BASE_URL=${gentleConfig.baseURL}
VITE_GENTLE_API_KEY=${gentleConfig.apiKey}
VITE_GENTLE_MODEL=${gentleConfig.model}
VITE_GENTLE_TEMPERATURE=${gentleConfig.temperature}
VITE_GENTLE_MAX_ROUNDS=${gentleConfig.maxRounds}
VITE_GENTLE_SYSTEM_PROMPT=${encodeURIComponent(gentleConfig.systemPrompt)}

# ============================================
# 暴躁 Agent (Angry) 配置
# ============================================
VITE_ANGRY_API_TYPE=${angryConfig.apiType}
VITE_ANGRY_BASE_URL=${angryConfig.baseURL}
VITE_ANGRY_API_KEY=${angryConfig.apiKey}
VITE_ANGRY_MODEL=${angryConfig.model}
VITE_ANGRY_TEMPERATURE=${angryConfig.temperature}
VITE_ANGRY_MAX_ROUNDS=${angryConfig.maxRounds}
VITE_ANGRY_SYSTEM_PROMPT=${encodeURIComponent(angryConfig.systemPrompt)}
`;
}

// 下载 .env 文件
export function downloadEnvFile(content: string, filename: string = '.env.local') {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 合并配置（env 配置优先级高）
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
