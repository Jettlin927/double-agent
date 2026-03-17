"""
AgentTeam 核心逻辑模块
对应前端: src/agents/AgentTeam.ts

提供单Agent对话和双Agent辩论的异步生成器实现
"""

import re
from typing import Optional, List, Dict, Any, AsyncGenerator
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from sqlalchemy.orm import Session

from .context_manager import ContextManager, calculate_context_stats
from .llm_adapter import AgentConfig as LLMAgentConfig, Message


class EventType(str, Enum):
    """流事件类型"""
    CHUNK = "chunk"
    ROUND_COMPLETE = "round_complete"
    ERROR = "error"
    COMPLETE = "complete"
    SHOULD_END = "should_end"


@dataclass
class StreamEvent:
    """流事件数据结构"""
    type: str
    agent_id: Optional[str] = None
    content: Optional[str] = None
    reasoning: Optional[str] = None
    round: Optional[int] = None
    should_end: Optional[bool] = None
    error: Optional[str] = None


@dataclass
class AgentConfig:
    """Agent 配置（扩展 LLM AgentConfig）"""
    id: str
    name: str
    api_type: str  # 'openai' or 'anthropic'
    base_url: str
    api_key: str
    model: str
    temperature: float = 0.7
    max_tokens: Optional[int] = None
    system_prompt: str = ""
    ending_prompt: Optional[str] = None

    def to_llm_config(self) -> LLMAgentConfig:
        """转换为 LLM 适配器配置"""
        return LLMAgentConfig(
            api_key=self.api_key,
            model=self.model,
            temperature=self.temperature,
            system_prompt=self.system_prompt,
            base_url=self.base_url,
            max_tokens=self.max_tokens
        )


@dataclass
class ChatMessage:
    """聊天消息"""
    id: str
    role: str
    content: str
    agent_id: str
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class DebateRound:
    """辩论轮次数据"""
    round: int
    gentle_response: ChatMessage
    angry_response: ChatMessage


# 结束判断提示（对应 src/prompts/roles.ts）
SINGLE_AGENT_ENDING_PROMPT = """[SYSTEM: 对话结束判断]
请严格判断当前对话是否应该结束。考虑：
1. 用户的问题是否得到了充分回答
2. 对话是否已经达到了自然的收尾点
3. 是否还有重要的信息需要补充

**重要规则**：
- 如果对话可以结束，必须只回复：[END]
- 如果对话需要继续，必须只回复：[CONTINUE]
- 不要添加任何其他文字、解释或格式
- 只能使用上述两个标记之一

你的回复（必须是 [END] 或 [CONTINUE]）："""

DEBATE_ENDING_PROMPT = """[SYSTEM: 辩论结束判断]
请严格判断当前辩论对话是否应该结束。考虑：
1. 双方的论点是否已经充分表达
2. 是否已经达到了共识或清晰的结论
3. 是否还有新的观点或反驳需要提出
4. 辩论是否已经开始重复之前的观点

**重要规则**：
- 如果辩论可以结束，必须只回复：[END]
- 如果辩论需要继续，必须只回复：[CONTINUE]
- 不要添加任何其他文字、解释或格式
- 只能使用上述两个标记之一
- 保守判断：如果仍有有价值的观点可补充，选择 [CONTINUE]

你的回复（必须是 [END] 或 [CONTINUE]）："""


class AgentTeam:
    """
    AgentTeam 核心类
    协调单Agent对话和双Agent辩论
    """

    def __init__(
        self,
        gentle_config: AgentConfig,
        angry_config: AgentConfig,
        db_session: Optional[Session] = None,
        llm_adapters: Optional[Dict[str, Any]] = None
    ):
        self.gentle_config = gentle_config
        self.angry_config = angry_config
        self.db_session = db_session
        self.llm_adapters = llm_adapters or {}

        self.max_auto_rounds = 10
        self.should_stop = False

        # 状态
        self.debate_history: List[DebateRound] = []
        self.current_round = 0
        self.current_session_id: Optional[str] = None
        self.full_message_history: List[Dict[str, str]] = []
        self.mode: str = "double"  # 'single' or 'double'

        # 上下文管理器
        self.context_manager = ContextManager(model=gentle_config.model)

    def reset(self) -> None:
        """重置状态"""
        self.debate_history = []
        self.current_round = 0
        self.current_session_id = None
        self.full_message_history = []
        self.mode = "double"
        self.should_stop = False
        self.context_manager.clear()

    def stop(self) -> None:
        """停止对话"""
        self.should_stop = True

    def _check_should_stop(self) -> bool:
        """检查是否应该停止"""
        return self.should_stop

    def _get_ending_prompt(self, is_single_mode: bool) -> str:
        """获取结束判断提示"""
        return SINGLE_AGENT_ENDING_PROMPT if is_single_mode else DEBATE_ENDING_PROMPT

    def _parse_ending_response(self, content: str) -> bool:
        """
        解析结束判断响应
        返回是否应该结束
        """
        content = content.strip()

        # 严格匹配
        if re.search(r'\[END\]', content, re.IGNORECASE):
            return True

        if re.search(r'\[CONTINUE\]', content, re.IGNORECASE):
            return False

        # 如果没有明确标记，根据内容推断
        lower_content = content.lower()
        has_continue_words = bool(re.search(r'继续|还有更多|还没说完|接着|补充', lower_content))
        has_end_words = bool(re.search(r'结束|完成|够了|到此为止|over|done', lower_content))

        if has_end_words and not has_continue_words and len(content) < 100:
            return True

        # 默认继续
        return False

    def _dict_messages_to_model(self, messages: List[Dict[str, str]]) -> List[Message]:
        """将字典消息列表转换为模型消息列表"""
        return [Message(role=m["role"], content=m["content"]) for m in messages]

    async def _stream_response(
        self,
        config: AgentConfig,
        messages: List[Dict[str, str]],
        agent_id: str
    ) -> AsyncGenerator[StreamEvent, None]:
        """
        流式生成响应
        依赖 llm_adapters 中提供的适配器
        """
        adapter = self.llm_adapters.get(config.api_type)
        if not adapter:
            yield StreamEvent(
                type=EventType.ERROR,
                error=f"未找到适配器: {config.api_type}"
            )
            return

        try:
            llm_config = config.to_llm_config()
            model_messages = self._dict_messages_to_model(messages)

            async for chunk in adapter.stream_chat(model_messages, llm_config):
                if self._check_should_stop():
                    break

                if chunk.content:
                    yield StreamEvent(
                        type=EventType.CHUNK,
                        agent_id=agent_id,
                        content=chunk.content
                    )

                if chunk.reasoning:
                    yield StreamEvent(
                        type=EventType.CHUNK,
                        agent_id=agent_id,
                        reasoning=chunk.reasoning
                    )

        except Exception as e:
            yield StreamEvent(
                type=EventType.ERROR,
                agent_id=agent_id,
                error=str(e)
            )

    async def _request_non_stream(
        self,
        config: AgentConfig,
        messages: List[Dict[str, str]]
    ) -> str:
        """
        非流式请求（用于结束判断）
        """
        import httpx

        # 构建非流式请求
        llm_config = config.to_llm_config()
        llm_config.temperature = 0  # 使用 temperature=0 确保确定性输出
        model_messages = self._dict_messages_to_model(messages)

        adapter = self.llm_adapters.get(config.api_type)
        if not adapter:
            raise ValueError(f"未找到适配器: {config.api_type}")

        base_url = llm_config.base_url or "https://api.openai.com"
        url = f"{base_url.rstrip('/')}{adapter.get_endpoint()}"
        headers = adapter.build_headers(llm_config)
        payload = adapter.build_payload(model_messages, llm_config)
        payload["stream"] = False  # 关闭流式

        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=60.0)
            response.raise_for_status()
            data = response.json()

            # 解析 OpenAI 格式响应
            if data.get("choices") and len(data["choices"]) > 0:
                message = data["choices"][0].get("message", {})
                if message.get("content"):
                    return message["content"]

            # 解析 Anthropic 格式响应
            if data.get("content") and len(data["content"]) > 0:
                return data["content"][0].get("text", "")

            return ""

    async def _check_should_end(
        self,
        config: AgentConfig,
        conversation_history: List[Dict[str, str]],
        is_single_mode: bool
    ) -> bool:
        """
        检查是否应该结束对话
        返回是否应该结束
        """
        ending_prompt = self._get_ending_prompt(is_single_mode)

        check_messages = conversation_history + [
            {"role": "user", "content": ending_prompt}
        ]

        try:
            response = await self._request_non_stream(config, check_messages)
            return self._parse_ending_response(response)
        except Exception:
            # 出错时默认继续，但超过安全上限会停止
            return False

    def _save_round_to_db(self, round_data: DebateRound) -> None:
        """
        保存轮次到数据库
        这里需要根据实际的数据库模型实现
        """
        if not self.db_session:
            return

        # TODO: 实现数据库保存逻辑
        # 示例:
        # db_round = Round(
        #     session_id=self.current_session_id,
        #     round=round_data.round,
        #     gentle_content=round_data.gentle_response.content,
        #     angry_content=round_data.angry_response.content,
        # )
        # self.db_session.add(db_round)
        # self.db_session.commit()
        pass

    async def run_single(
        self,
        session_id: str,
        question: str
    ) -> AsyncGenerator[StreamEvent, None]:
        """
        单Agent对话模式（动态结束）

        事件流：
        - chunk: 文本片段
        - round_complete: 单轮完成
        - should_end: 结束判断结果
        - complete: 全部完成
        - error: 错误
        """
        self.reset()
        self.mode = "single"
        self.current_session_id = session_id

        # 初始化上下文
        self.full_message_history = [
            {"role": "system", "content": self.gentle_config.system_prompt},
            {"role": "user", "content": question}
        ]
        self.context_manager.set_messages(self.full_message_history)
        self.current_round = 0

        try:
            while self.current_round < self.max_auto_rounds:
                if self._check_should_stop():
                    break

                self.current_round += 1

                # 检查并自动压缩上下文
                was_compacted = self.context_manager.check_and_auto_compact(keep_recent=4)
                if was_compacted:
                    self.full_message_history = self.context_manager.get_messages()

                # 生成回复（流式）
                full_response = ""
                async for event in self._stream_response(
                    self.gentle_config,
                    self.full_message_history,
                    "gentle"
                ):
                    if event.type == EventType.ERROR:
                        yield event
                        return

                    if event.content:
                        full_response += event.content
                        yield event

                if self._check_should_stop():
                    break

                # 更新历史
                self.full_message_history.append(
                    {"role": "assistant", "content": full_response}
                )
                self.context_manager.set_messages(self.full_message_history)

                # 创建消息对象
                gentle_message = ChatMessage(
                    id=f"gentle-{datetime.utcnow().timestamp()}",
                    role="assistant",
                    content=full_response,
                    agent_id=self.gentle_config.id
                )

                # 创建轮次数据
                round_data = DebateRound(
                    round=self.current_round,
                    gentle_response=gentle_message,
                    angry_response=ChatMessage(
                        id="empty",
                        role="assistant",
                        content="",
                        agent_id="angry-agent"
                    )
                )

                self.debate_history.append(round_data)
                self._save_round_to_db(round_data)

                # 检查是否应该结束（第一轮不检查，至少需要一轮回复）
                should_end = False
                if self.current_round >= 1:
                    should_end = await self._check_should_end(
                        self.gentle_config,
                        self.full_message_history,
                        is_single_mode=True
                    )

                    yield StreamEvent(
                        type=EventType.SHOULD_END,
                        round=self.current_round,
                        should_end=should_end
                    )

                yield StreamEvent(
                    type=EventType.ROUND_COMPLETE,
                    round=self.current_round,
                    should_end=should_end
                )

                if should_end or self._check_should_stop():
                    break

            # 如果达到最大轮数，强制结束
            if self.current_round >= self.max_auto_rounds:
                yield StreamEvent(
                    type=EventType.SHOULD_END,
                    round=self.current_round,
                    should_end=True
                )

            yield StreamEvent(type=EventType.COMPLETE)

        except Exception as e:
            yield StreamEvent(
                type=EventType.ERROR,
                error=str(e)
            )

    async def run_debate(
        self,
        session_id: str,
        question: str
    ) -> AsyncGenerator[StreamEvent, None]:
        """
        双Agent辩论模式（动态结束）

        事件流：
        - chunk: 文本片段（gentle 或 angry）
        - round_complete: 单轮完成（两个agent都发言完毕）
        - should_end: 结束判断结果
        - complete: 全部完成
        - error: 错误
        """
        self.reset()
        self.mode = "double"
        self.current_session_id = session_id

        # 初始化上下文
        self.full_message_history = [
            {"role": "user", "content": question}
        ]
        self.context_manager.set_messages(self.full_message_history)
        self.current_round = 0

        try:
            while self.current_round < self.max_auto_rounds:
                if self._check_should_stop():
                    break

                self.current_round += 1

                # 检查并自动压缩上下文
                was_compacted = self.context_manager.check_and_auto_compact(keep_recent=4)
                if was_compacted:
                    self.full_message_history = self.context_manager.get_messages()

                # Gentle Agent 发言
                gentle_context = self.full_message_history.copy()

                if self.current_round > 1 and self.debate_history:
                    # 第二轮开始添加辩论引导
                    last_round = self.debate_history[-1]
                    gentle_context.append({
                        "role": "user",
                        "content": f'另一位助手（暴躁派）回应道："{last_round.angry_response.content}"\n\n请继续讨论，这是第{self.current_round}轮。'
                    })

                gentle_response = ""
                async for event in self._stream_response(
                    self.gentle_config,
                    gentle_context,
                    "gentle"
                ):
                    if event.type == EventType.ERROR:
                        yield event
                        return
                    if event.content or event.reasoning:
                        if event.content:
                            gentle_response += event.content
                        yield event

                if self._check_should_stop():
                    break

                # 更新历史
                self.full_message_history.append(
                    {"role": "assistant", "content": gentle_response}
                )
                self.context_manager.set_messages(self.full_message_history)

                # Angry Agent 发言
                angry_context = self.full_message_history.copy()

                if self.current_round == 1:
                    angry_context.append({
                        "role": "user",
                        "content": "另一位助手（温和派）刚刚这样回答。请给出你的观点，并指出你可能不同意的地方。"
                    })
                else:
                    angry_context.append({
                        "role": "user",
                        "content": f'另一位助手（温和派）回应道："{gentle_response}"\n\n请继续辩论，这是第{self.current_round}轮。'
                    })

                angry_response = ""
                async for event in self._stream_response(
                    self.angry_config,
                    angry_context,
                    "angry"
                ):
                    if event.type == EventType.ERROR:
                        yield event
                        return
                    if event.content or event.reasoning:
                        if event.content:
                            angry_response += event.content
                        yield event

                if self._check_should_stop():
                    break

                # 更新历史
                self.full_message_history.append(
                    {"role": "assistant", "content": angry_response}
                )
                self.context_manager.set_messages(self.full_message_history)

                # 创建消息对象
                gentle_message = ChatMessage(
                    id=f"gentle-{datetime.utcnow().timestamp()}",
                    role="assistant",
                    content=gentle_response,
                    agent_id=self.gentle_config.id
                )

                angry_message = ChatMessage(
                    id=f"angry-{datetime.utcnow().timestamp()}",
                    role="assistant",
                    content=angry_response,
                    agent_id=self.angry_config.id
                )

                # 创建轮次数据
                round_data = DebateRound(
                    round=self.current_round,
                    gentle_response=gentle_message,
                    angry_response=angry_message
                )

                self.debate_history.append(round_data)
                self._save_round_to_db(round_data)

                # 检查是否应该结束（第二轮开始检查）
                should_end = False
                if self.current_round >= 2:
                    # 使用温和Agent来判断是否结束（更保守）
                    should_end = await self._check_should_end(
                        self.gentle_config,
                        self.full_message_history,
                        is_single_mode=False
                    )

                    yield StreamEvent(
                        type=EventType.SHOULD_END,
                        round=self.current_round,
                        should_end=should_end
                    )

                yield StreamEvent(
                    type=EventType.ROUND_COMPLETE,
                    round=self.current_round,
                    should_end=should_end
                )

                if should_end or self._check_should_stop():
                    break

            # 如果达到最大轮数，强制结束
            if self.current_round >= self.max_auto_rounds:
                yield StreamEvent(
                    type=EventType.SHOULD_END,
                    round=self.current_round,
                    should_end=True
                )

            yield StreamEvent(type=EventType.COMPLETE)

        except Exception as e:
            yield StreamEvent(
                type=EventType.ERROR,
                error=str(e)
            )

    def get_debate_history(self) -> List[DebateRound]:
        """获取辩论历史"""
        return self.debate_history.copy()

    def get_current_session_id(self) -> Optional[str]:
        """获取当前会话ID"""
        return self.current_session_id

    def get_context_stats(self) -> Dict[str, Any]:
        """获取上下文统计信息"""
        gentle_stats = calculate_context_stats(
            self.full_message_history,
            self.gentle_config.model
        )
        angry_stats = calculate_context_stats(
            self.full_message_history,
            self.angry_config.model
        )

        return {
            "stats": {
                "total_tokens": gentle_stats.total_tokens,
                "max_tokens": gentle_stats.max_tokens,
                "usage_percent": gentle_stats.usage_percent,
                "message_count": gentle_stats.message_count
            },
            "gentle_stats": {
                "total_tokens": gentle_stats.total_tokens,
                "max_tokens": gentle_stats.max_tokens,
                "usage_percent": gentle_stats.usage_percent
            },
            "angry_stats": {
                "total_tokens": angry_stats.total_tokens,
                "max_tokens": angry_stats.max_tokens,
                "usage_percent": angry_stats.usage_percent
            }
        }
