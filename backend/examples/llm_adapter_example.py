"""
LLM Adapter 使用示例

运行前请确保安装了依赖:
    pip install httpx pydantic

使用示例:
    python llm_adapter_example.py
"""

import asyncio
import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.services.llm_adapter import (
    Message,
    AgentConfig,
    OpenAIAdapter,
    AnthropicAdapter,
    create_adapter,
)


async def openai_example():
    """OpenAI 适配器使用示例"""
    print("=" * 50)
    print("OpenAI Adapter Example")
    print("=" * 50)

    # 创建适配器
    adapter = OpenAIAdapter()

    # 配置
    config = AgentConfig(
        api_key="your-openai-api-key",
        model="gpt-4o",
        temperature=0.7,
        system_prompt="你是一个有帮助的助手。",
        base_url="https://api.openai.com",  # 可选，默认为 OpenAI 官方 API
    )

    # 消息列表
    messages = [
        Message(role="user", content="你好，请介绍一下自己。"),
    ]

    # 流式调用
    print("Response:")
    try:
        async for chunk in adapter.stream_chat(messages, config):
            if chunk.content:
                print(chunk.content, end="", flush=True)
            if chunk.reasoning:
                print(f"\n[Reasoning: {chunk.reasoning}]\n", end="", flush=True)
            if chunk.done:
                print("\n[Stream completed]")
    except Exception as e:
        print(f"Error: {e}")


async def anthropic_example():
    """Anthropic 适配器使用示例"""
    print("\n" + "=" * 50)
    print("Anthropic Adapter Example")
    print("=" * 50)

    # 创建适配器
    adapter = AnthropicAdapter()

    # 配置
    config = AgentConfig(
        api_key="your-anthropic-api-key",
        model="claude-3-5-sonnet-20241022",
        temperature=0.7,
        system_prompt="你是一个有帮助的助手。",
        base_url="https://api.anthropic.com",  # 可选，默认为 Anthropic 官方 API
    )

    # 消息列表
    messages = [
        Message(role="user", content="你好，请介绍一下自己。"),
    ]

    # 流式调用
    print("Response:")
    try:
        async for chunk in adapter.stream_chat(messages, config):
            if chunk.content:
                print(chunk.content, end="", flush=True)
            if chunk.reasoning:
                print(f"\n[Thinking: {chunk.reasoning}]\n", end="", flush=True)
            if chunk.done:
                print("\n[Stream completed]")
    except Exception as e:
        print(f"Error: {e}")


async def factory_example():
    """工厂函数使用示例"""
    print("\n" + "=" * 50)
    print("Factory Function Example")
    print("=" * 50)

    # 使用工厂函数创建适配器
    adapter = create_adapter("openai")
    print(f"Created adapter: {type(adapter).__name__}")

    adapter2 = create_adapter("anthropic")
    print(f"Created adapter: {type(adapter2).__name__}")


async def deepseek_example():
    """DeepSeek (OpenAI 兼容) 使用示例"""
    print("\n" + "=" * 50)
    print("DeepSeek Adapter Example (OpenAI-compatible)")
    print("=" * 50)

    # DeepSeek 使用 OpenAI 适配器
    adapter = OpenAIAdapter()

    config = AgentConfig(
        api_key="your-deepseek-api-key",
        model="deepseek-chat",
        temperature=0.7,
        system_prompt="你是一个有帮助的助手。",
        base_url="https://api.deepseek.com",
    )

    messages = [
        Message(role="user", content="解释什么是人工智能。"),
    ]

    print("Response:")
    try:
        async for chunk in adapter.stream_chat(messages, config):
            if chunk.content:
                print(chunk.content, end="", flush=True)
            if chunk.reasoning:
                print(f"\n[Reasoning: {chunk.reasoning}]\n", end="", flush=True)
            if chunk.done:
                print("\n[Stream completed]")
    except Exception as e:
        print(f"Error: {e}")


async def main():
    """主函数"""
    # 展示如何使用工厂函数
    await factory_example()

    # 注意：以下示例需要有效的 API 密钥才能运行
    # 请取消注释并替换为你的 API 密钥

    # await openai_example()
    # await anthropic_example()
    # await deepseek_example()

    print("\n" + "=" * 50)
    print("示例完成。请添加有效的 API 密钥后取消注释调用。")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
