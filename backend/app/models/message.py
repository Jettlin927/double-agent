"""
消息模型 - 支持统一消息类型系统 (InputItem/OutputItem)
对应前端 src/types/index.ts 中的类型定义
"""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import String, Integer, DateTime, Text, ForeignKey, JSON, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.agent_iteration import AgentIteration


class Message(Base):
    """消息项模型 - 存储 InputItem/OutputItem

    支持的消息类型:
    - message: 标准消息 (user/assistant/system/developer)
    - reasoning: 推理过程
    - function_call: 函数调用请求
    - function_call_output: 函数调用结果
    - compaction: 上下文压缩项
    """

    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # 外键关联
    iteration_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("agent_iterations.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # 消息类型
    item_type: Mapped[str] = mapped_column(
        String(20), nullable=False,
        comment="消息类型: message, reasoning, function_call, function_call_output, compaction"
    )

    # 排序字段（在同一次迭代中的顺序）
    sequence: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # ========== message 类型字段 ==========
    role: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True,
        comment="角色: system, developer, user, assistant"
    )
    # content 存储为 JSON 数组 (ContentPart[])
    content_parts: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # ========== reasoning 类型字段 ==========
    # summary 存储为 JSON 数组 (SummaryPart[])
    reasoning_summary: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    reasoning_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ========== function_call 类型字段 ==========
    function_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    function_arguments: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON 字符串
    call_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)

    # ========== function_call_output 类型字段 ==========
    output_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ========== compaction 类型字段 ==========
    compaction_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    compaction_summary: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    original_message_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # ========== 元数据字段 ==========
    # 用于向前兼容和存储额外信息
    meta_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # 前端使用的 ID（如 ChatMessage.id）
    client_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # 关联的 Agent ID
    agent_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # 时间戳（前端生成）
    client_timestamp: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # 数据库时间戳
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )

    # 关联关系
    iteration: Mapped["AgentIteration"] = relationship("AgentIteration", back_populates="messages")

    def __repr__(self) -> str:
        return f"<Message(id={self.id}, type={self.item_type}, iteration={self.iteration_id})>"

    def to_dict(self) -> dict:
        """转换为字典格式（用于 API 响应）"""
        base = {
            "id": self.id,
            "type": self.item_type,
            "sequence": self.sequence,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

        if self.item_type == "message":
            base.update({
                "role": self.role,
                "content": self.content_parts,
                "client_id": self.client_id,
                "agent_id": self.agent_id,
                "timestamp": self.client_timestamp,
            })
        elif self.item_type == "reasoning":
            base.update({
                "summary": self.reasoning_summary,
                "encrypted_content": self.reasoning_encrypted,
            })
        elif self.item_type == "function_call":
            base.update({
                "name": self.function_name,
                "arguments": self.function_arguments,
                "call_id": self.call_id,
            })
        elif self.item_type == "function_call_output":
            base.update({
                "call_id": self.call_id,
                "output": self.output_content,
            })
        elif self.item_type == "compaction":
            base.update({
                "encrypted_content": self.compaction_encrypted,
                "summary": self.compaction_summary,
                "original_message_count": self.original_message_count,
            })

        if self.meta_data:
            base["meta_data"] = self.meta_data

        return base
