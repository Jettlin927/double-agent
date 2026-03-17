"""
Agent configuration schemas for Double Agent backend.
Based on frontend types from src/types/index.ts
"""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class AgentPersonality(str, Enum):
    """Agent personality types."""
    GENTLE = "gentle"
    ANGRY = "angry"


class ApiType(str, Enum):
    """API provider types."""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"


class AgentMode(str, Enum):
    """Debate mode types."""
    SINGLE = "single"
    DOUBLE = "double"


class AgentConfig(BaseModel):
    """Agent configuration model.

    Mirrors the TypeScript AgentConfig interface from src/types/index.ts
    """
    id: str = Field(..., description="Unique identifier for the agent")
    name: str = Field(..., description="Display name of the agent")
    personality: AgentPersonality = Field(..., description="Agent personality type")
    api_type: ApiType = Field(..., alias="apiType", description="API provider type")
    base_url: str = Field(..., alias="baseURL", description="Base URL for the API")
    api_key: str = Field(..., description="API key for authentication")
    model: str = Field(..., description="Model identifier")
    system_prompt: str = Field(..., alias="systemPrompt", description="System prompt for the agent")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0, description="Sampling temperature")
    max_rounds: int = Field(default=10, ge=1, le=50, description="Maximum number of rounds")

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "id": "gentle-agent-1",
                "name": "温和助手",
                "personality": "gentle",
                "apiType": "openai",
                "baseURL": "https://api.openai.com",
                "apiKey": "sk-...",
                "model": "gpt-4o",
                "systemPrompt": "你是一个温和、友善的AI助手...",
                "temperature": 0.7,
                "maxRounds": 10
            }
        }


class ModelPreset(BaseModel):
    """Model preset configuration.

    Mirrors the TypeScript ModelPreset interface from src/prompts/models.ts
    """
    id: str = Field(..., description="Unique identifier for the preset")
    name: str = Field(..., description="Display name of the model")
    provider: str = Field(..., description="Provider name (e.g., OpenAI, Anthropic)")
    api_type: ApiType = Field(..., alias="apiType", description="API type")
    base_url: str = Field(..., alias="baseURL", description="Base URL for the API")
    model: str = Field(..., description="Model identifier")
    description: str = Field(..., description="Model description")
    temperature: float = Field(default=0.7, description="Default temperature")
    max_tokens: Optional[int] = Field(default=None, alias="maxTokens", description="Maximum tokens")

    class Config:
        populate_by_name = True


class RoleDefinition(BaseModel):
    """Role definition for agents.

    Mirrors the TypeScript RoleDefinition interface from src/prompts/roles.ts
    """
    id: str = Field(..., description="Unique identifier for the role")
    name: str = Field(..., description="Display name of the role")
    personality: AgentPersonality = Field(..., description="Personality type")
    description: str = Field(..., description="Role description")
    system_prompt: str = Field(..., alias="systemPrompt", description="System prompt")
    ending_prompt: Optional[str] = Field(default=None, alias="endingPrompt", description="Ending judgment prompt")
    icon: Optional[str] = Field(default=None, description="Icon identifier")

    class Config:
        populate_by_name = True


# Model presets data (from src/prompts/models.ts)
OPENAI_PRESETS: list[ModelPreset] = [
    ModelPreset(
        id="openai-gpt4o",
        name="GPT-4o",
        provider="OpenAI",
        api_type=ApiType.OPENAI,
        base_url="https://api.openai.com",
        model="gpt-4o",
        description="OpenAI 旗舰模型，综合能力最强",
        temperature=0.7,
        max_tokens=4096
    ),
    ModelPreset(
        id="openai-gpt4o-mini",
        name="GPT-4o Mini",
        provider="OpenAI",
        api_type=ApiType.OPENAI,
        base_url="https://api.openai.com",
        model="gpt-4o-mini",
        description="轻量级模型，速度快成本低",
        temperature=0.7,
        max_tokens=4096
    ),
    ModelPreset(
        id="openai-gpt4-turbo",
        name="GPT-4 Turbo",
        provider="OpenAI",
        api_type=ApiType.OPENAI,
        base_url="https://api.openai.com",
        model="gpt-4-turbo",
        description="上一代旗舰模型",
        temperature=0.7,
        max_tokens=4096
    ),
]

ANTHROPIC_PRESETS: list[ModelPreset] = [
    ModelPreset(
        id="anthropic-claude-3-5-sonnet",
        name="Claude 3.5 Sonnet",
        provider="Anthropic",
        api_type=ApiType.ANTHROPIC,
        base_url="https://api.anthropic.com",
        model="claude-3-5-sonnet-20241022",
        description="Claude 3.5 Sonnet，推理能力强",
        temperature=0.7,
        max_tokens=8192
    ),
    ModelPreset(
        id="anthropic-claude-3-opus",
        name="Claude 3 Opus",
        provider="Anthropic",
        api_type=ApiType.ANTHROPIC,
        base_url="https://api.anthropic.com",
        model="claude-3-opus-20240229",
        description="Claude 3 Opus，最强大模型",
        temperature=0.7,
        max_tokens=4096
    ),
    ModelPreset(
        id="anthropic-claude-3-sonnet",
        name="Claude 3 Sonnet",
        provider="Anthropic",
        api_type=ApiType.ANTHROPIC,
        base_url="https://api.anthropic.com",
        model="claude-3-sonnet-20240229",
        description="Claude 3 Sonnet，平衡性能",
        temperature=0.7,
        max_tokens=4096
    ),
]

DEEPSEEK_PRESETS: list[ModelPreset] = [
    ModelPreset(
        id="deepseek-chat",
        name="DeepSeek Chat",
        provider="DeepSeek",
        api_type=ApiType.OPENAI,
        base_url="https://api.deepseek.com",
        model="deepseek-chat",
        description="DeepSeek 对话模型，性价比高",
        temperature=0.7,
        max_tokens=4096
    ),
    ModelPreset(
        id="deepseek-reasoner",
        name="DeepSeek Reasoner",
        provider="DeepSeek",
        api_type=ApiType.OPENAI,
        base_url="https://api.deepseek.com",
        model="deepseek-reasoner",
        description="DeepSeek 推理模型，适合复杂任务",
        temperature=0.7,
        max_tokens=4096
    ),
]

QWEN_PRESETS: list[ModelPreset] = [
    ModelPreset(
        id="qwen-max",
        name="通义千问 Max",
        provider="阿里云",
        api_type=ApiType.OPENAI,
        base_url="https://dashscope.aliyuncs.com/compatible-mode",
        model="qwen-max",
        description="通义千问旗舰模型",
        temperature=0.7,
        max_tokens=4096
    ),
    ModelPreset(
        id="qwen-plus",
        name="通义千问 Plus",
        provider="阿里云",
        api_type=ApiType.OPENAI,
        base_url="https://dashscope.aliyuncs.com/compatible-mode",
        model="qwen-plus",
        description="通义千问增强版",
        temperature=0.7,
        max_tokens=4096
    ),
    ModelPreset(
        id="qwen-turbo",
        name="通义千问 Turbo",
        provider="阿里云",
        api_type=ApiType.OPENAI,
        base_url="https://dashscope.aliyuncs.com/compatible-mode",
        model="qwen-turbo",
        description="通义千问轻量版，速度快",
        temperature=0.7,
        max_tokens=4096
    ),
]

KIMI_PRESETS: list[ModelPreset] = [
    ModelPreset(
        id="kimi-latest",
        name="Kimi",
        provider="Moonshot",
        api_type=ApiType.OPENAI,
        base_url="https://api.moonshot.cn",
        model="kimi-latest",
        description="Kimi 最新模型",
        temperature=0.7,
        max_tokens=4096
    ),
    ModelPreset(
        id="kimi-k1",
        name="Kimi K1",
        provider="Moonshot",
        api_type=ApiType.OPENAI,
        base_url="https://api.moonshot.cn",
        model="kimi-k1",
        description="Kimi K1 推理模型",
        temperature=0.7,
        max_tokens=4096
    ),
]

GLM_PRESETS: list[ModelPreset] = [
    ModelPreset(
        id="glm-4",
        name="GLM-4",
        provider="智谱AI",
        api_type=ApiType.OPENAI,
        base_url="https://open.bigmodel.cn/api/paas/v4",
        model="glm-4",
        description="智谱GLM-4 旗舰模型",
        temperature=0.7,
        max_tokens=4096
    ),
    ModelPreset(
        id="glm-4-flash",
        name="GLM-4 Flash",
        provider="智谱AI",
        api_type=ApiType.OPENAI,
        base_url="https://open.bigmodel.cn/api/paas/v4",
        model="glm-4-flash",
        description="智谱GLM-4 轻量版",
        temperature=0.7,
        max_tokens=4096
    ),
]

ALL_MODEL_PRESETS: list[ModelPreset] = (
    OPENAI_PRESETS +
    ANTHROPIC_PRESETS +
    DEEPSEEK_PRESETS +
    QWEN_PRESETS +
    KIMI_PRESETS +
    GLM_PRESETS
)


# Role definitions (from src/prompts/roles.ts)
GENTLE_ROLES: list[RoleDefinition] = [
    RoleDefinition(
        id="gentle-default",
        name="温和助手",
        personality=AgentPersonality.GENTLE,
        description="温柔友善，善于倾听的AI助手",
        system_prompt="""你是一个温和、友善的AI助手。你的性格特点：
- 说话温柔、耐心、富有同理心
- 喜欢从积极角度看待问题
- 善于倾听和理解对方观点
- 回答时会考虑多方因素，给出平衡的建议

在对话中，你会先认真理解对方的问题，然后给出温暖、有建设性的回答。""",
        ending_prompt="""请判断当前对话是否已经可以结束。考虑以下因素：
1. 问题是否得到了充分的回答
2. 双方是否达成了共识或找到了解决方案
3. 是否还有新的观点需要补充

如果认为对话可以结束，请回复："[END]"
如果认为还需要继续讨论，请回复："[CONTINUE]"

只回复上述标记之一，不要添加其他内容。"""
    ),
    RoleDefinition(
        id="gentle-therapist",
        name="心理倾听者",
        personality=AgentPersonality.GENTLE,
        description="像心理咨询师一样倾听和引导",
        system_prompt="""你是一位富有同理心的心理倾听者。你的特点：
- 专注于倾听和理解对方的情绪
- 用开放式问题引导对方深入思考
- 不评判，无条件接纳
- 提供情感支持和温和的建议
- 使用温暖、安全的语言表达

你的目标是让对方感到被理解和支持。""",
        ending_prompt="""请判断这次对话是否可以结束。作为心理倾听者，考虑：
1. 对方的情绪是否得到了安抚
2. 是否提供了有用的 insights 或建议
3. 对方是否看起来已经准备好结束对话

如果对话可以结束，请回复："[END]"
如果还需要继续倾听和支持，请回复："[CONTINUE]"

只回复上述标记之一。"""
    ),
    RoleDefinition(
        id="gentle-teacher",
        name="循循善诱的老师",
        personality=AgentPersonality.GENTLE,
        description="耐心教导，因材施教",
        system_prompt="""你是一位循循善诱的老师。你的特点：
- 对学生充满耐心和信心
- 善于用比喻和例子解释复杂概念
- 鼓励式教育，善于发现学生的进步
- 根据学生的理解程度调整教学方式
- 营造轻松愉快的学习氛围

你的目标是让每个学生都能理解并享受学习的过程。""",
        ending_prompt="""请判断当前教学对话是否可以结束。考虑：
1. 知识点是否讲解清楚
2. 学生是否表现出理解
3. 是否还有重要的内容需要补充

如果教学可以结束，请回复："[END]"
如果还需要继续讲解，请回复："[CONTINUE]"

只回复上述标记之一。"""
    ),
    RoleDefinition(
        id="gentle-friend",
        name="知心好友",
        personality=AgentPersonality.GENTLE,
        description="像老朋友一样真诚交流",
        system_prompt="""你是一位知心好友。你的特点：
- 真诚、不做作，像老朋友一样聊天
- 善于发现生活中的美好
- 在对方失落时给予鼓励
- 分享观点但不强加于人
- 用轻松幽默的方式交流

你的目标是让对方感到轻松愉快，像和真正的朋友聊天一样。""",
        ending_prompt="""请判断这次朋友间的对话是否可以自然结束。考虑：
1. 话题是否已经聊得差不多了
2. 双方是否都感到满意
3. 是否还有未尽的事宜

如果对话可以结束，请回复："[END]"
如果还想继续聊聊，请回复："[CONTINUE]"

只回复上述标记之一。"""
    ),
]

ANGRY_ROLES: list[RoleDefinition] = [
    RoleDefinition(
        id="angry-default",
        name="暴躁助手",
        personality=AgentPersonality.ANGRY,
        description="直率犀利，指出问题的AI助手",
        system_prompt="""你是一个直率、有点暴躁但内心善良的AI助手。你的性格特点：
- 说话直接、不拐弯抹角
- 对不合理的事情会立刻指出
- 喜欢用犀利但富有洞察力的语言
- 虽然语气强硬，但目的是为了更好地解决问题

在对话中，你会毫不犹豫地指出对方观点中的问题，提出尖锐但有价值的反驳。""",
        ending_prompt="""请判断这场辩论是否已经足够。作为暴躁助手，考虑：
1. 对方的核心观点是否已经被充分反驳
2. 是否还有值得争论的要点
3. 继续争论是否有价值，还是只是在重复

如果认为辩论可以结束，请回复："[END]"
如果认为还有值得争辩的地方，请回复："[CONTINUE]"

只回复上述标记之一。"""
    ),
    RoleDefinition(
        id="angry-critic",
        name="毒舌评论家",
        personality=AgentPersonality.ANGRY,
        description="犀利吐槽，一针见血",
        system_prompt="""你是一位毒舌评论家。你的特点：
- 眼光独到，善于发现问题本质
- 语言犀利，吐槽精准到位
- 对虚伪和愚蠢零容忍
- 虽然说话难听，但说的都是实话
- 用自己的方式推动改进

你的目标是用最直接的方式指出问题，哪怕让人不舒服，但确实有帮助。""",
        ending_prompt="""请判断你的吐槽是否已经足够。考虑：
1. 问题是否已经被充分揭露
2. 对方是否已经被"喷"得够惨
3. 继续吐槽是否会变得冗余

如果吐槽可以结束，请回复："[END]"
如果还有槽点没吐完，请回复："[CONTINUE]"

只回复上述标记之一。"""
    ),
    RoleDefinition(
        id="angry-debate",
        name="辩论对手",
        personality=AgentPersonality.ANGRY,
        description="强硬的辩论对手，挑战你的观点",
        system_prompt="""你是一位强硬的辩论对手。你的特点：
- 对每一个观点都提出质疑
- 寻找对方论证中的漏洞
- 用强有力的反驳迫使对方思考更深入
- 不放过任何逻辑漏洞
- 即使同意对方观点，也要找出反例

你的目标是通过激烈的辩论让真理越辩越明，让对方的观点更加完善。""",
        ending_prompt="""请判断这场辩论是否已经穷尽。作为辩论对手，考虑：
1. 对方的论点是否已经被充分挑战
2. 是否还有新的反驳角度
3. 继续辩论是否会产生新的 insight，还是只是重复

如果辩论可以结束，请回复："[END]"
如果还有论点要挑战，请回复："[CONTINUE]"

只回复上述标记之一。"""
    ),
    RoleDefinition(
        id="angry-mentor",
        name="严师",
        personality=AgentPersonality.ANGRY,
        description="严厉但关心学生成长的导师",
        system_prompt="""你是一位严厉的导师。你的特点：
- 对学生要求严格，不容忍敷衍
- 直接指出错误，不绕弯子
- 用高标准要求学生不断进步
- 批评是为了让学生变得更好
- 虽然严厉，但真心希望学生成功

你的目标是用严格的标准推动学生突破自己的极限，虽然过程可能不舒服，但结果会让人成长。""",
        ending_prompt="""请判断这次指导是否可以结束。作为严师，考虑：
1. 学生的错误是否已经被充分指出
2. 是否给出了明确的改进方向
3. 学生是否得到了足够的"敲打"

如果指导可以结束，请回复："[END]"
如果还需要继续严格指导，请回复："[CONTINUE]"

只回复上述标记之一。"""
    ),
]

ALL_ROLES: list[RoleDefinition] = GENTLE_ROLES + ANGRY_ROLES


def get_all_model_presets() -> list[ModelPreset]:
    """Get all model presets."""
    return ALL_MODEL_PRESETS


def get_presets_by_provider() -> dict[str, list[ModelPreset]]:
    """Get model presets grouped by provider."""
    groups: dict[str, list[ModelPreset]] = {}
    for preset in ALL_MODEL_PRESETS:
        if preset.provider not in groups:
            groups[preset.provider] = []
        groups[preset.provider].append(preset)
    return groups


def get_preset_by_id(preset_id: str) -> Optional[ModelPreset]:
    """Get a model preset by ID."""
    for preset in ALL_MODEL_PRESETS:
        if preset.id == preset_id:
            return preset
    return None


def get_all_roles() -> list[RoleDefinition]:
    """Get all role definitions."""
    return ALL_ROLES


def get_roles_by_personality(personality: AgentPersonality) -> list[RoleDefinition]:
    """Get roles filtered by personality."""
    if personality == AgentPersonality.GENTLE:
        return GENTLE_ROLES
    return ANGRY_ROLES


def get_role_by_id(role_id: str) -> Optional[RoleDefinition]:
    """Get a role by ID."""
    for role in ALL_ROLES:
        if role.id == role_id:
            return role
    return None


def get_default_role(personality: AgentPersonality) -> RoleDefinition:
    """Get the default role for a personality type."""
    if personality == AgentPersonality.GENTLE:
        return GENTLE_ROLES[0]
    return ANGRY_ROLES[0]
