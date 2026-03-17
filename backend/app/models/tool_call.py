"""
工具调用记录模型 - 存储每次工具调用的详细信息
对应前端 ToolCallRecord 类型
"""

from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import String, Integer, DateTime, Text, ForeignKey, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.agent_iteration import AgentIteration


class ToolCall(Base):
    """工具调用记录模型

    记录一次完整的工具调用过程：
    - 调用请求
    - 执行结果
    - 耗时统计
    """

    __tablename__ = "tool_calls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # 外键关联
    iteration_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("agent_iterations.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # 排序字段
    sequence: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # 调用标识（对应 function_call.call_id）
    call_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    # 工具名称
    tool_name: Mapped[str] = mapped_column(String(100), nullable=False)

    # 调用参数（JSON 格式）
    arguments: Mapped[dict] = mapped_column(JSON, nullable=False)

    # 执行结果
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)

    # 返回数据（JSON 格式）
    result_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # 错误信息（如果失败）
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # 执行耗时（毫秒）
    execution_time_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # 时间戳
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # 元数据（用于扩展）
    meta_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # 关联关系
    iteration: Mapped["AgentIteration"] = relationship("AgentIteration", back_populates="tool_calls")

    def __repr__(self) -> str:
        status = "success" if self.success else "failed"
        return f"<ToolCall(id={self.id}, name={self.tool_name}, status={status})>"

    def to_dict(self) -> dict:
        """转换为字典格式"""
        return {
            "id": self.id,
            "call_id": self.call_id,
            "tool_name": self.tool_name,
            "arguments": self.arguments,
            "success": self.success,
            "result_data": self.result_data,
            "error_message": self.error_message,
            "execution_time_ms": self.execution_time_ms,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "meta_data": self.meta_data,
        }
