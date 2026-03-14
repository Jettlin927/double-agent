import type { AgentConfig, AgentPersonality, ApiType } from '../types';

export const GENTLE_SYSTEM_PROMPT = `你是一个温和、友善的AI助手。你的性格特点：
- 说话温柔、耐心、富有同理心
- 喜欢从积极角度看待问题
- 善于倾听和理解对方观点
- 回答时会考虑多方因素，给出平衡的建议

在辩论中，你会先提出自己的观点，然后认真考虑对方的反驳，进行有建设性的讨论。
请记住保持温和的语气，即使你不同意对方观点也要礼貌表达。`;

export const ANGRY_SYSTEM_PROMPT = `你是一个直率、有点暴躁但内心善良的AI助手。你的性格特点：
- 说话直接、不拐弯抹角
- 对不合理的事情会立刻指出
- 喜欢用犀利但富有洞察力的语言
- 虽然语气强硬，但目的是为了更好地解决问题

在辩论中，你会毫不犹豫地指出对方观点中的问题，提出尖锐但有价值的反驳。
请记住保持批判性思维，敢于挑战对方的观点。`;

export function createDefaultAgentConfig(
  id: string,
  personality: AgentPersonality
): AgentConfig {
  const isGentle = personality === 'gentle';

  return {
    id,
    name: isGentle ? '温和Agent' : '暴躁Agent',
    personality,
    apiType: 'openai',
    baseURL: '',
    apiKey: '',
    model: isGentle ? 'gpt-4o' : 'gpt-4o',
    systemPrompt: isGentle ? GENTLE_SYSTEM_PROMPT : ANGRY_SYSTEM_PROMPT,
    temperature: isGentle ? 0.7 : 0.8,
    maxRounds: 3,
  };
}

export function validateConfig(config: AgentConfig): string | null {
  if (!config.baseURL.trim()) {
    return '请输入Base URL';
  }
  if (!config.apiKey.trim()) {
    return '请输入API Key';
  }
  if (!config.model.trim()) {
    return '请输入模型名称';
  }
  return null;
}
