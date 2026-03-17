"""
Agent Iteration 模型 - 存储 Agent Loop 的每次迭代
对应前端 AgentLoopIteration 类型
"""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import String, Integer, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.session import Session
    from app.models.message import Message
    from app.models.tool_call import ToolCall


class AgentIteration(Base):
    """Agent Loop 迭代模型

    记录 Agent Loop 的一次完整迭代：
    - 输入（input）
    - 模型输出（output，包含 reasoning、function_call 等）
    - 工具调用执行
    - 耗时统计
    """

    __tablename__ = "agent_iterations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # 外键关联
    session_id: Mapped[str] = mapped_column(
        String, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # 迭代序号（在同一会话中的顺序）
    iteration_number: Mapped[int] = mapped_column(Integer, nullable=False)

    # 关联的轮次（用于双 Agent 模式）
    round_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # Agent 标识
    agent_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    agent_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # 状态
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="completed",
        comment="状态: idle, thinking, calling_tool, executing_tool, responding, completed, error"
    )

    # 时间统计（毫秒）
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    thinking_duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tool_execution_duration_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # 工具调用统计
    tool_calls_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # 是否经过上下文压缩
    was_compacted: Mapped[bool] = mapped_column(
        default=False, nullable=False
    )

    # 压缩前的消息数量
    pre_compaction_message_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # 错误信息（如果有）
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # 元数据（用于扩展）
    meta_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # 数据库时间戳
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )

    # 关联关系
    session: Mapped["Session"] = relationship("Session", back_populates="iterations")
    messages: Mapped[list["Message"]] = relationship(
        "Message",
        back_populates="iteration",
        cascade="all, delete-orphan",
        order_by="Message.sequence",
    )
    tool_calls: Mapped[list["ToolCall"]] = relationship(
        "ToolCall",
        back_populates="iteration",
        cascade="all, delete-orphan",
        order_by="ToolCall.sequence",
    )

    def __repr__(self) -> str:
        return f"<AgentIteration(id={self.id}, session={self.session_id}, iter={self.iteration_number})>"

    def to_dict(self, include_messages: bool = False, include_tool_calls: bool = False) -> dict:
        """转换为字典格式"""
        result = {
            "id": self.id,
            "iteration_number": self.iteration_number,
            "round_number": self.round_number,
            "agent_id": self.agent_id,
            "agent_name": self.agent_name,
            "status": self.status,
            "duration_ms": self.duration_ms,
            "thinking_duration_ms": self.thinking_duration_ms,
            "tool_execution_duration_ms": self.tool_execution_duration_ms,
            "tool_calls_count": self.tool_calls_count,
            "was_compacted": self.was_compacted,
            "pre_compaction_message_count": self.pre_compaction_message_count,
            "error_message": self.error_message,
            "meta_data": self.meta_data,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

        if include_messages:
            result["messages"] = [m.to_dict() for m in self.messages]

        if include_tool_calls:
            result["tool_calls"] = [t.to_dict() for t in self.tool_calls]

        return result
