"""
上下文管理和压缩模块
对应前端: src/utils/tokenCounter.ts
"""

import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class ContextStats:
    """上下文统计信息"""
    total_tokens: int
    max_tokens: int
    usage_percent: float
    message_count: int


# 不同模型的上下文限制
CONTEXT_LIMITS: Dict[str, int] = {
    # OpenAI
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'gpt-4-turbo': 128000,
    'gpt-4': 8192,
    'gpt-3.5-turbo': 16385,

    # Anthropic
    'claude-3-5-sonnet': 200000,
    'claude-3-opus': 200000,
    'claude-3-sonnet': 200000,
    'claude-3-haiku': 200000,

    # DeepSeek
    'deepseek-chat': 64000,
    'deepseek-reasoner': 64000,

    # 阿里云
    'qwen-max': 32000,
    'qwen-plus': 32000,
    'qwen-turbo': 8000,

    # Moonshot
    'kimi-latest': 200000,
    'kimi-k1': 200000,

    # 智谱
    'glm-4': 128000,
    'glm-4-flash': 128000,
}


def estimate_tokens(text: str) -> int:
    """
    估算文本的 token 数量
    中文：每个字符约 1.5 tokens
    英文：每个单词约 1.3 tokens
    其他：每个字符约 0.5 tokens
    """
    chinese_chars = len(re.findall(r'[\u4e00-\u9fa5]', text))
    english_words = len(re.findall(r'[a-zA-Z]+', text))
    other_chars = len(text) - chinese_chars - english_words

    return int(chinese_chars * 1.5 + english_words * 1.3 + other_chars * 0.5)


def estimate_messages_tokens(messages: List[Dict[str, str]]) -> int:
    """
    估算消息列表的总 token 数
    每条消息有额外的开销（role 标记等）
    """
    overhead_per_message = 4

    total = 0
    for msg in messages:
        content = msg.get('content', '')
        total += estimate_tokens(content) + overhead_per_message

    return total


def get_context_limit(model: str) -> int:
    """
    获取模型的上下文限制
    先尝试精确匹配，然后部分匹配，最后返回默认值 8k
    """
    # 精确匹配
    if model in CONTEXT_LIMITS:
        return CONTEXT_LIMITS[model]

    # 部分匹配
    for key, value in CONTEXT_LIMITS.items():
        if key in model or model in key:
            return value

    # 默认 8k
    return 8192


def calculate_context_stats(
    messages: List[Dict[str, str]],
    model: str
) -> ContextStats:
    """
    计算上下文统计信息
    """
    total_tokens = estimate_messages_tokens(messages)
    max_tokens = get_context_limit(model)
    usage_percent = (total_tokens / max_tokens) * 100 if max_tokens > 0 else 0

    return ContextStats(
        total_tokens=total_tokens,
        max_tokens=max_tokens,
        usage_percent=usage_percent,
        message_count=len(messages)
    )


def compact_messages(
    messages: List[Dict[str, str]],
    keep_recent: int = 4
) -> List[Dict[str, str]]:
    """
    压缩消息列表
    保留系统消息和最近的消息，中间的消息压缩为摘要
    """
    if len(messages) <= keep_recent + 1:
        return messages

    # 保留系统消息
    system_messages = [m for m in messages if m.get('role') == 'system']

    # 保留最近的消息
    recent_messages = messages[-keep_recent:]

    # 中间的消息需要压缩
    middle_start = len(system_messages)
    middle_end = len(messages) - keep_recent
    middle_messages = messages[middle_start:middle_end]

    if not middle_messages:
        return system_messages + recent_messages

    # 创建摘要
    summary_parts = []
    for m in middle_messages:
        role = m.get('role', '')
        content = m.get('content', '')
        if role == 'user':
            summary_parts.append(f"用户: {content[:100]}...")
        else:
            summary_parts.append(f"助手: {content[:100]}...")

    summary_content = "[之前对话的摘要]\n" + "\n".join(summary_parts)

    summary_message = {
        'role': 'user',
        'content': summary_content
    }

    return system_messages + [summary_message] + recent_messages


def should_compact(stats: ContextStats, threshold: float = 80.0) -> bool:
    """
    检查是否需要压缩上下文
    当使用率超过阈值时返回 True
    """
    return stats.usage_percent >= threshold


class ContextManager:
    """
    上下文管理器类
    用于管理对话上下文，包括 token 估算和自动压缩
    """

    def __init__(self, model: str = 'gpt-4o', threshold: float = 80.0):
        self.model = model
        self.threshold = threshold
        self.messages: List[Dict[str, str]] = []

    def add_message(self, role: str, content: str) -> None:
        """添加消息到上下文"""
        self.messages.append({'role': role, 'content': content})

    def get_stats(self) -> ContextStats:
        """获取当前上下文统计"""
        return calculate_context_stats(self.messages, self.model)

    def should_compact(self) -> bool:
        """检查是否需要压缩"""
        stats = self.get_stats()
        return should_compact(stats, self.threshold)

    def compact(self, keep_recent: int = 4) -> bool:
        """
        压缩上下文
        返回是否实际进行了压缩
        """
        original_length = len(self.messages)
        self.messages = compact_messages(self.messages, keep_recent)
        return len(self.messages) < original_length

    def check_and_auto_compact(self, keep_recent: int = 4) -> bool:
        """
        检查并自动压缩上下文
        返回是否进行了压缩
        """
        if self.should_compact():
            return self.compact(keep_recent)
        return False

    def clear(self) -> None:
        """清空上下文"""
        self.messages = []

    def set_model(self, model: str) -> None:
        """设置模型"""
        self.model = model

    def get_messages(self) -> List[Dict[str, str]]:
        """获取当前消息列表"""
        return self.messages.copy()

    def set_messages(self, messages: List[Dict[str, str]]) -> None:
        """设置消息列表"""
        self.messages = messages.copy()
