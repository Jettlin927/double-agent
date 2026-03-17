"""
LLM API 适配器模块
将 Double Agent 项目的 LLM API 适配器从 TypeScript 移植到 Python
支持 OpenAI 和 Anthropic API 的异步流式调用
"""

from abc import ABC, abstractmethod
from typing import AsyncGenerator, Dict, List, Optional, Any
import json
import httpx
from pydantic import BaseModel, Field


class Message(BaseModel):
    """消息模型"""
    role: str = Field(..., description="消息角色: system, user, assistant")
    content: str = Field(..., description="消息内容")


class AgentConfig(BaseModel):
    """代理配置模型"""
    api_key: str = Field(..., description="API 密钥")
    model: str = Field(..., description="模型名称")
    temperature: float = Field(0.7, description="温度参数")
    system_prompt: str = Field("", description="系统提示词")
    base_url: Optional[str] = Field(None, description="API 基础 URL")
    max_tokens: Optional[int] = Field(4096, description="最大生成 token 数")


class StreamChunk(BaseModel):
    """流式响应块模型"""
    content: Optional[str] = Field(None, description="生成的内容")
    reasoning: Optional[str] = Field(None, description="推理过程内容")
    done: bool = Field(False, description="是否完成")


class LLMAdapter(ABC):
    """
    LLM 适配器抽象基类
    定义所有 LLM 适配器必须实现的接口
    """

    @abstractmethod
    def get_endpoint(self) -> str:
        """返回 API 端点路径"""
        pass

    @abstractmethod
    def build_headers(self, config: AgentConfig) -> Dict[str, str]:
        """构建请求头"""
        pass

    @abstractmethod
    def build_payload(self, messages: List[Message], config: AgentConfig) -> Dict[str, Any]:
        """构建请求体"""
        pass

    @abstractmethod
    def parse_stream(self, chunk: str) -> Optional[StreamChunk]:
        """
        解析流式响应块
        返回 StreamChunk 或 None（如果块无效）
        """
        pass

    async def stream_chat(
        self,
        messages: List[Message],
        config: AgentConfig
    ) -> AsyncGenerator[StreamChunk, None]:
        """
        异步流式聊天

        Args:
            messages: 消息列表
            config: 代理配置

        Yields:
            StreamChunk: 流式响应块
        """
        base_url = config.base_url or "https://api.openai.com"
        url = f"{base_url.rstrip('/')}{self.get_endpoint()}"
        headers = self.build_headers(config)
        payload = self.build_payload(messages, config)

        try:
            async with httpx.AsyncClient() as client:
                async with client.stream(
                    "POST",
                    url,
                    headers=headers,
                    json=payload,
                    timeout=60.0
                ) as response:
                    response.raise_for_status()

                    async for line in response.aiter_lines():
                        if not line:
                            continue

                        chunk = self.parse_stream(line)
                        if chunk:
                            yield chunk
                            if chunk.done:
                                break

        except httpx.HTTPStatusError as e:
            raise LLMAPIError(f"HTTP error {e.response.status_code}: {e.response.text}") from e
        except httpx.RequestError as e:
            raise LLMAPIError(f"Request error: {str(e)}") from e
        except Exception as e:
            raise LLMAPIError(f"Unexpected error: {str(e)}") from e


class OpenAIAdapter(LLMAdapter):
    """
    OpenAI 格式 API 适配器
    支持 OpenAI、DeepSeek、Qwen、Kimi、GLM 等兼容 OpenAI 格式的 API
    """

    def get_endpoint(self) -> str:
        """返回 OpenAI API 端点"""
        return "/v1/chat/completions"

    def build_headers(self, config: AgentConfig) -> Dict[str, str]:
        """构建 OpenAI 请求头"""
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config.api_key}",
        }

    def build_payload(self, messages: List[Message], config: AgentConfig) -> Dict[str, Any]:
        """构建 OpenAI 请求体"""
        # 构建消息列表，包含系统提示词
        formatted_messages = [{"role": "system", "content": config.system_prompt}]

        for msg in messages:
            formatted_messages.append({
                "role": msg.role,
                "content": msg.content
            })

        payload = {
            "model": config.model,
            "messages": formatted_messages,
            "temperature": config.temperature,
            "stream": True,
            "stream_options": {"include_usage": True},
        }

        if config.max_tokens:
            payload["max_tokens"] = config.max_tokens

        return payload

    def parse_stream(self, chunk: str) -> Optional[StreamChunk]:
        """
        解析 OpenAI 格式的流式响应

        OpenAI SSE 格式:
        data: {"choices": [{"delta": {"content": "..."}}]}
        data: [DONE]
        """
        content = ""
        reasoning = ""
        done = False

        lines = chunk.split('\n')

        for line in lines:
            trimmed = line.strip()
            if not trimmed:
                continue

            # 检查结束标记
            if trimmed == "data: [DONE]":
                done = True
                continue

            # 解析 data: 行
            if trimmed.startswith("data: "):
                try:
                    data = json.loads(trimmed[6:])

                    # 检查 choices
                    if data.get("choices") and len(data["choices"]) > 0:
                        choice = data["choices"][0]
                        delta = choice.get("delta", {})

                        # 提取内容
                        if delta.get("content"):
                            content += delta["content"]

                        # 提取推理内容（某些模型如 DeepSeek 支持）
                        if delta.get("reasoning_content"):
                            reasoning += delta["reasoning_content"]

                    # 如果有 usage 信息，表示流结束
                    if data.get("usage"):
                        done = True

                except json.JSONDecodeError:
                    # 忽略解析错误
                    pass

        if content or reasoning or done:
            return StreamChunk(content=content or None, reasoning=reasoning or None, done=done)

        return None


class AnthropicAdapter(LLMAdapter):
    """
    Anthropic 原生 API 适配器
    支持 Claude 系列模型
    """

    def get_endpoint(self) -> str:
        """返回 Anthropic API 端点"""
        return "/v1/messages"

    def build_headers(self, config: AgentConfig) -> Dict[str, str]:
        """构建 Anthropic 请求头"""
        return {
            "Content-Type": "application/json",
            "x-api-key": config.api_key,
            "anthropic-version": "2023-06-01",
        }

    def build_payload(self, messages: List[Message], config: AgentConfig) -> Dict[str, Any]:
        """构建 Anthropic 请求体"""
        # 提取系统消息
        system_content = config.system_prompt
        other_messages = []

        for msg in messages:
            if msg.role == "system":
                system_content = msg.content
            else:
                other_messages.append({
                    "role": msg.role,
                    "content": msg.content
                })

        payload = {
            "model": config.model,
            "max_tokens": config.max_tokens or 4096,
            "temperature": config.temperature,
            "system": system_content,
            "messages": other_messages,
            "stream": True,
        }

        return payload

    def parse_stream(self, chunk: str) -> Optional[StreamChunk]:
        """
        解析 Anthropic 格式的流式响应

        Anthropic SSE 格式:
        event: content_block_delta
        data: {"type": "content_block_delta", "delta": {"text": "..."}}

        event: message_stop
        data: {"type": "message_stop"}
        """
        content = ""
        reasoning = ""
        done = False

        lines = chunk.split('\n')
        current_event = None

        for line in lines:
            trimmed = line.strip()
            if not trimmed:
                continue

            # 解析事件类型
            if trimmed.startswith("event: "):
                current_event = trimmed[7:]
                if current_event == "message_stop":
                    done = True
                continue

            # 解析 data: 行
            if trimmed.startswith("data: "):
                try:
                    data = json.loads(trimmed[6:])
                    data_type = data.get("type")

                    # 内容块增量
                    if data_type == "content_block_delta":
                        delta = data.get("delta", {})

                        # 提取文本内容
                        if delta.get("text"):
                            content += delta["text"]

                        # 提取思考内容（Claude 3.7+ 支持）
                        if delta.get("thinking"):
                            reasoning += delta["thinking"]

                    # 内容块开始（可能包含初始思考内容）
                    elif data_type == "content_block_start":
                        content_block = data.get("content_block", {})
                        block_type = content_block.get("type")

                        if block_type == "thinking":
                            thinking_content = content_block.get("thinking", "")
                            if thinking_content:
                                reasoning += thinking_content

                except json.JSONDecodeError:
                    # 忽略解析错误
                    pass

        if content or reasoning or done:
            return StreamChunk(content=content or None, reasoning=reasoning or None, done=done)

        return None


class LLMAPIError(Exception):
    """LLM API 错误"""
    pass


def create_adapter(adapter_type: str) -> LLMAdapter:
    """
    工厂函数：创建适配器实例

    Args:
        adapter_type: 适配器类型，"openai" 或 "anthropic"

    Returns:
        LLMAdapter: 适配器实例

    Raises:
        ValueError: 如果适配器类型不支持
    """
    adapter_type = adapter_type.lower()

    if adapter_type == "openai":
        return OpenAIAdapter()
    elif adapter_type == "anthropic":
        return AnthropicAdapter()
    else:
        raise ValueError(f"Unsupported adapter type: {adapter_type}. "
                        f"Supported types: openai, anthropic")


# 导出所有公共类和函数
__all__ = [
    "Message",
    "AgentConfig",
    "StreamChunk",
    "LLMAdapter",
    "OpenAIAdapter",
    "AnthropicAdapter",
    "LLMAPIError",
    "create_adapter",
]