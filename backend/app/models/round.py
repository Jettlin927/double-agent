from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import String, Integer, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.session import Session


class Round(Base):
    """对话轮次模型"""

    __tablename__ = "rounds"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(
        String, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    round_number: Mapped[int] = mapped_column(Integer, nullable=False)

    # Gentle Agent 响应
    gentle_content: Mapped[str] = mapped_column(Text, nullable=False)
    gentle_reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    gentle_agent_id: Mapped[str] = mapped_column(String, nullable=False)

    # Angry Agent 响应
    angry_content: Mapped[str] = mapped_column(Text, nullable=False)
    angry_reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    angry_agent_id: Mapped[str] = mapped_column(String, nullable=False)

    # 时间戳
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )

    # 关联关系
    session: Mapped["Session"] = relationship("Session", back_populates="rounds")

    def __repr__(self) -> str:
        return f"<Round(id={self.id}, session_id={self.session_id}, round={self.round_number})>"
