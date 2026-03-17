from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import String, Integer, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.round import Round
    from app.models.agent_iteration import AgentIteration


class Session(Base):
    """对话会话模型"""

    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    user_question: Mapped[str] = mapped_column(String, nullable=False)
    mode: Mapped[str] = mapped_column(String, nullable=False, default="double")
    max_rounds: Mapped[int] = mapped_column(Integer, nullable=False, default=3)

    # Agent 配置 (存储为 JSON)
    gentle_config: Mapped[dict] = mapped_column(JSON, nullable=False)
    angry_config: Mapped[dict] = mapped_column(JSON, nullable=False)

    # 时间戳
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    # 关联关系 - 传统轮次（向后兼容）
    rounds: Mapped[list["Round"]] = relationship(
        "Round",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="Round.round_number",
    )

    # 关联关系 - 新的 Agent Iteration（支持统一消息系统）
    iterations: Mapped[list["AgentIteration"]] = relationship(
        "AgentIteration",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="AgentIteration.iteration_number",
    )

    def __repr__(self) -> str:
        return f"<Session(id={self.id}, title={self.title}, mode={self.mode})>"
