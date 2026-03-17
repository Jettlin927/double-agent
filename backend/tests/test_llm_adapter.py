"""
LLM Adapter 单元测试

运行测试:
    cd backend
    python -m pytest tests/test_llm_adapter.py -v
    或
    python -m unittest tests.test_llm_adapter -v
"""

import unittest
import sys
import os
import json

# 添加项目路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.services.llm_adapter import (
    Message,
    AgentConfig,
    StreamChunk,
    OpenAIAdapter,
    AnthropicAdapter,
    create_adapter,
    LLMAPIError,
)


class TestOpenAIAdapter(unittest.TestCase):
    """测试 OpenAI 适配器"""

    def setUp(self):
        self.adapter = OpenAIAdapter()
        self.config = AgentConfig(
            api_key="test-key",
            model="gpt-4o",
            temperature=0.7,
            system_prompt="你是一个助手。",
        )

    def test_get_endpoint(self):
        """测试端点路径"""
        self.assertEqual(self.adapter.get_endpoint(), "/v1/chat/completions")

    def test_build_headers(self):
        """测试请求头构建"""
        headers = self.adapter.build_headers(self.config)
        self.assertEqual(headers["Content-Type"], "application/json")
        self.assertEqual(headers["Authorization"], "Bearer test-key")

    def test_build_payload(self):
        """测试请求体构建"""
        messages = [Message(role="user", content="你好")]
        payload = self.adapter.build_payload(messages, self.config)

        self.assertEqual(payload["model"], "gpt-4o")
        self.assertEqual(payload["temperature"], 0.7)
        self.assertTrue(payload["stream"])
        self.assertEqual(payload["stream_options"], {"include_usage": True})

        # 检查消息列表包含系统提示词
        self.assertEqual(payload["messages"][0]["role"], "system")
        self.assertEqual(payload["messages"][0]["content"], "你是一个助手。")
        self.assertEqual(payload["messages"][1]["role"], "user")
        self.assertEqual(payload["messages"][1]["content"], "你好")

    def test_parse_stream_content(self):
        """测试解析内容"""
        chunk = 'data: {"choices": [{"delta": {"content": "Hello"}}]}'
        result = self.adapter.parse_stream(chunk)

        self.assertIsNotNone(result)
        self.assertEqual(result.content, "Hello")
        self.assertIsNone(result.reasoning)
        self.assertFalse(result.done)

    def test_parse_stream_reasoning(self):
        """测试解析推理内容"""
        chunk = 'data: {"choices": [{"delta": {"reasoning_content": "Let me think"}}]}'
        result = self.adapter.parse_stream(chunk)

        self.assertIsNotNone(result)
        self.assertIsNone(result.content)
        self.assertEqual(result.reasoning, "Let me think")
        self.assertFalse(result.done)

    def test_parse_stream_done(self):
        """测试解析完成标记"""
        chunk = "data: [DONE]"
        result = self.adapter.parse_stream(chunk)

        self.assertIsNotNone(result)
        self.assertTrue(result.done)

    def test_parse_stream_usage_done(self):
        """测试通过 usage 标记完成"""
        chunk = 'data: {"usage": {"total_tokens": 100}}'
        result = self.adapter.parse_stream(chunk)

        self.assertIsNotNone(result)
        self.assertTrue(result.done)

    def test_parse_stream_empty(self):
        """测试空块解析"""
        result = self.adapter.parse_stream("")
        self.assertIsNone(result)

        result = self.adapter.parse_stream("\n\n")
        self.assertIsNone(result)


class TestAnthropicAdapter(unittest.TestCase):
    """测试 Anthropic 适配器"""

    def setUp(self):
        self.adapter = AnthropicAdapter()
        self.config = AgentConfig(
            api_key="test-key",
            model="claude-3-5-sonnet-20241022",
            temperature=0.8,
            system_prompt="你是一个助手。",
            max_tokens=2048,
        )

    def test_get_endpoint(self):
        """测试端点路径"""
        self.assertEqual(self.adapter.get_endpoint(), "/v1/messages")

    def test_build_headers(self):
        """测试请求头构建"""
        headers = self.adapter.build_headers(self.config)
        self.assertEqual(headers["Content-Type"], "application/json")
        self.assertEqual(headers["x-api-key"], "test-key")
        self.assertEqual(headers["anthropic-version"], "2023-06-01")

    def test_build_payload(self):
        """测试请求体构建"""
        messages = [
            Message(role="system", content="系统提示"),
            Message(role="user", content="你好"),
        ]
        payload = self.adapter.build_payload(messages, self.config)

        self.assertEqual(payload["model"], "claude-3-5-sonnet-20241022")
        self.assertEqual(payload["temperature"], 0.8)
        self.assertEqual(payload["max_tokens"], 2048)
        self.assertTrue(payload["stream"])
        # Anthropic 将系统提示词单独处理
        self.assertEqual(payload["system"], "系统提示")
        self.assertEqual(len(payload["messages"]), 1)
        self.assertEqual(payload["messages"][0]["role"], "user")

    def test_build_payload_without_system_message(self):
        """测试没有系统消息时的请求体构建"""
        messages = [Message(role="user", content="你好")]
        payload = self.adapter.build_payload(messages, self.config)

        self.assertEqual(payload["system"], "你是一个助手。")  # 使用 config 中的 system_prompt

    def test_parse_stream_content(self):
        """测试解析内容"""
        chunk = 'event: content_block_delta\ndata: {"type": "content_block_delta", "delta": {"text": "Hello"}}'
        result = self.adapter.parse_stream(chunk)

        self.assertIsNotNone(result)
        self.assertEqual(result.content, "Hello")
        self.assertIsNone(result.reasoning)
        self.assertFalse(result.done)

    def test_parse_stream_thinking(self):
        """测试解析思考内容"""
        chunk = 'event: content_block_delta\ndata: {"type": "content_block_delta", "delta": {"thinking": "Let me analyze"}}'
        result = self.adapter.parse_stream(chunk)

        self.assertIsNotNone(result)
        self.assertIsNone(result.content)
        self.assertEqual(result.reasoning, "Let me analyze")

    def test_parse_stream_content_block_start(self):
        """测试解析内容块开始"""
        chunk = 'event: content_block_start\ndata: {"type": "content_block_start", "content_block": {"type": "thinking", "thinking": "Initial thought"}}'
        result = self.adapter.parse_stream(chunk)

        self.assertIsNotNone(result)
        self.assertEqual(result.reasoning, "Initial thought")

    def test_parse_stream_done(self):
        """测试解析完成标记"""
        chunk = "event: message_stop\ndata: {}"
        result = self.adapter.parse_stream(chunk)

        self.assertIsNotNone(result)
        self.assertTrue(result.done)

    def test_parse_stream_empty(self):
        """测试空块解析"""
        result = self.adapter.parse_stream("")
        self.assertIsNone(result)


class TestFactory(unittest.TestCase):
    """测试工厂函数"""

    def test_create_openai_adapter(self):
        """测试创建 OpenAI 适配器"""
        adapter = create_adapter("openai")
        self.assertIsInstance(adapter, OpenAIAdapter)

        adapter = create_adapter("OPENAI")
        self.assertIsInstance(adapter, OpenAIAdapter)

    def test_create_anthropic_adapter(self):
        """测试创建 Anthropic 适配器"""
        adapter = create_adapter("anthropic")
        self.assertIsInstance(adapter, AnthropicAdapter)

        adapter = create_adapter("ANTHROPIC")
        self.assertIsInstance(adapter, AnthropicAdapter)

    def test_create_invalid_adapter(self):
        """测试创建无效适配器"""
        with self.assertRaises(ValueError):
            create_adapter("invalid")


class TestStreamChunk(unittest.TestCase):
    """测试 StreamChunk 模型"""

    def test_default_values(self):
        """测试默认值"""
        chunk = StreamChunk()
        self.assertIsNone(chunk.content)
        self.assertIsNone(chunk.reasoning)
        self.assertFalse(chunk.done)

    def test_custom_values(self):
        """测试自定义值"""
        chunk = StreamChunk(content="Hello", reasoning="Think", done=True)
        self.assertEqual(chunk.content, "Hello")
        self.assertEqual(chunk.reasoning, "Think")
        self.assertTrue(chunk.done)


class TestMessage(unittest.TestCase):
    """测试 Message 模型"""

    def test_message_creation(self):
        """测试消息创建"""
        msg = Message(role="user", content="Hello")
        self.assertEqual(msg.role, "user")
        self.assertEqual(msg.content, "Hello")


class TestAgentConfig(unittest.TestCase):
    """测试 AgentConfig 模型"""

    def test_default_values(self):
        """测试默认值"""
        config = AgentConfig(api_key="test", model="gpt-4")
        self.assertEqual(config.temperature, 0.7)
        self.assertEqual(config.system_prompt, "")
        self.assertIsNone(config.base_url)
        self.assertEqual(config.max_tokens, 4096)

    def test_custom_values(self):
        """测试自定义值"""
        config = AgentConfig(
            api_key="test",
            model="gpt-4",
            temperature=0.5,
            system_prompt="You are a helper.",
            base_url="https://api.example.com",
            max_tokens=2048,
        )
        self.assertEqual(config.temperature, 0.5)
        self.assertEqual(config.system_prompt, "You are a helper.")
        self.assertEqual(config.base_url, "https://api.example.com")
        self.assertEqual(config.max_tokens, 2048)


if __name__ == "__main__":
    unittest.main()
