"""
消息存储服务 - 支持统一消息类型系统的持久化

提供高层次 API 用于：
- 保存和查询 InputItem/OutputItem
- 管理 Agent Loop 迭代
- 记录工具调用
- 支持上下文压缩历史
"""

from typing import Optional, List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, desc
from sqlalchemy.orm import selectinload

from app.models import AgentIteration, Message, ToolCall


class MessageStorageService:
    """消息存储服务

    对应前端 InputItem/OutputItem 类型的持久化存储
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    # ============================================================
    # AgentIteration 操作
    # ============================================================

    async def create_iteration(
        self,
        session_id: str,
        agent_id: str,
        agent_name: Optional[str] = None,
        round_number: int = 1,
        iteration_number: Optional[int] = None,
    ) -> AgentIteration:
        """创建新的 Agent Iteration

        Args:
            session_id: 会话 ID
            agent_id: Agent 标识 (如 "gentle-agent" 或 "angry-agent")
            agent_name: Agent 名称（可选）
            round_number: 轮次号（双 Agent 模式使用）
            iteration_number: 迭代序号（None 则自动计算）

        Returns:
            创建的 AgentIteration 对象
        """
        if iteration_number is None:
            # 自动计算下一个迭代序号
            result = await self.db.execute(
                select(AgentIteration.iteration_number)
                .where(AgentIteration.session_id == session_id)
                .order_by(desc(AgentIteration.iteration_number))
                .limit(1)
            )
            last = result.scalar_one_or_none()
            iteration_number = (last or 0) + 1

        iteration = AgentIteration(
            session_id=session_id,
            agent_id=agent_id,
            agent_name=agent_name,
            round_number=round_number,
            iteration_number=iteration_number,
            status="idle",
        )

        self.db.add(iteration)
        await self.db.flush()

        return iteration

    async def get_iteration(
        self, iteration_id: int, include_messages: bool = False, include_tool_calls: bool = False
    ) -> Optional[AgentIteration]:
        """获取指定的 Agent Iteration"""
        query = select(AgentIteration).where(AgentIteration.id == iteration_id)

        if include_messages:
            query = query.options(selectinload(AgentIteration.messages))
        if include_tool_calls:
            query = query.options(selectinload(AgentIteration.tool_calls))

        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def get_session_iterations(
        self,
        session_id: str,
        agent_id: Optional[str] = None,
        include_messages: bool = False,
    ) -> List[AgentIteration]:
        """获取会话的所有迭代"""
        query = select(AgentIteration).where(AgentIteration.session_id == session_id)

        if agent_id:
            query = query.where(AgentIteration.agent_id == agent_id)

        if include_messages:
            query = query.options(selectinload(AgentIteration.messages))

        query = query.order_by(AgentIteration.iteration_number)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update_iteration_status(
        self,
        iteration_id: int,
        status: str,
        duration_ms: Optional[int] = None,
        error_message: Optional[str] = None,
    ) -> None:
        """更新迭代状态"""
        iteration = await self.get_iteration(iteration_id)
        if iteration:
            iteration.status = status
            if duration_ms is not None:
                iteration.duration_ms = duration_ms
            if error_message is not None:
                iteration.error_message = error_message
            await self.db.flush()

    async def update_iteration_compaction(
        self,
        iteration_id: int,
        was_compacted: bool,
        pre_compaction_message_count: Optional[int] = None,
    ) -> None:
        """更新迭代的压缩信息"""
        iteration = await self.get_iteration(iteration_id)
        if iteration:
            iteration.was_compacted = was_compacted
            if pre_compaction_message_count is not None:
                iteration.pre_compaction_message_count = pre_compaction_message_count
            await self.db.flush()

    # ============================================================
    # Message 操作（InputItem/OutputItem 存储）
    # ============================================================

    async def save_message(
        self,
        iteration_id: int,
        item_type: str,
        sequence: int,
        **kwargs,
    ) -> Message:
        """保存一条消息

        根据不同的 item_type 存储相应的字段

        Args:
            iteration_id: 关联的迭代 ID
            item_type: 消息类型 (message, reasoning, function_call, function_call_output, compaction)
            sequence: 在迭代中的顺序
            **kwargs: 根据类型的额外字段

        Returns:
            创建的 Message 对象
        """
        message = Message(
            iteration_id=iteration_id,
            item_type=item_type,
            sequence=sequence,
        )

        # 根据类型设置字段
        if item_type == "message":
            message.role = kwargs.get("role")
            message.content_parts = kwargs.get("content")
            message.client_id = kwargs.get("client_id")
            message.agent_id = kwargs.get("agent_id")
            message.client_timestamp = kwargs.get("timestamp")

        elif item_type == "reasoning":
            message.reasoning_summary = kwargs.get("summary")
            message.reasoning_encrypted = kwargs.get("encrypted_content")

        elif item_type == "function_call":
            message.function_name = kwargs.get("name")
            message.function_arguments = kwargs.get("arguments")
            message.call_id = kwargs.get("call_id")

        elif item_type == "function_call_output":
            message.call_id = kwargs.get("call_id")
            message.output_content = kwargs.get("output")

        elif item_type == "compaction":
            message.compaction_encrypted = kwargs.get("encrypted_content")
            message.compaction_summary = kwargs.get("summary")
            message.original_message_count = kwargs.get("original_message_count")

        # 元数据
        if "metadata" in kwargs:
            message.metadata = kwargs["metadata"]

        self.db.add(message)
        await self.db.flush()

        return message

    async def save_messages_batch(
        self,
        iteration_id: int,
        items: List[dict],
    ) -> List[Message]:
        """批量保存消息

        Args:
            iteration_id: 关联的迭代 ID
            items: 消息列表，每个元素是一个 dict 包含 item_type 和其他字段

        Returns:
            创建的 Message 对象列表
        """
        messages = []
        for item in items:
            # 从 item 中提取 item_type 和 sequence
            item_type = item.pop('item_type')
            sequence = item.pop('sequence', 0)

            msg = await self.save_message(
                iteration_id=iteration_id,
                item_type=item_type,
                sequence=sequence,
                **item,
            )
            messages.append(msg)
        return messages

    async def get_iteration_messages(
        self,
        iteration_id: int,
        item_type: Optional[str] = None,
    ) -> List[Message]:
        """获取迭代的所有消息"""
        query = (
            select(Message)
            .where(Message.iteration_id == iteration_id)
            .order_by(Message.sequence)
        )

        if item_type:
            query = query.where(Message.item_type == item_type)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_session_messages(
        self,
        session_id: str,
        agent_id: Optional[str] = None,
    ) -> List[Message]:
        """获取会话的所有消息（跨所有迭代）"""
        query = (
            select(Message)
            .join(AgentIteration)
            .where(AgentIteration.session_id == session_id)
        )

        if agent_id:
            query = query.where(AgentIteration.agent_id == agent_id)

        query = query.order_by(
            AgentIteration.iteration_number,
            Message.sequence,
        )

        result = await self.db.execute(query)
        return list(result.scalars().all())

    # ============================================================
    # ToolCall 操作
    # ============================================================

    async def record_tool_call(
        self,
        iteration_id: int,
        call_id: str,
        tool_name: str,
        arguments: dict,
        sequence: int = 0,
    ) -> ToolCall:
        """记录工具调用（开始执行时调用）"""
        tool_call = ToolCall(
            iteration_id=iteration_id,
            call_id=call_id,
            tool_name=tool_name,
            arguments=arguments,
            sequence=sequence,
            success=False,  # 初始状态
            started_at=datetime.utcnow(),
        )

        self.db.add(tool_call)
        await self.db.flush()

        return tool_call

    async def complete_tool_call(
        self,
        tool_call_id: int,
        success: bool,
        result_data: Optional[dict] = None,
        error_message: Optional[str] = None,
        execution_time_ms: int = 0,
    ) -> None:
        """完成工具调用记录（执行完成时调用）"""
        tool_call = await self.db.get(ToolCall, tool_call_id)
        if tool_call:
            tool_call.success = success
            tool_call.result_data = result_data
            tool_call.error_message = error_message
            tool_call.execution_time_ms = execution_time_ms
            tool_call.completed_at = datetime.utcnow()
            await self.db.flush()

    async def get_iteration_tool_calls(
        self,
        iteration_id: int,
    ) -> List[ToolCall]:
        """获取迭代的所有工具调用"""
        result = await self.db.execute(
            select(ToolCall)
            .where(ToolCall.iteration_id == iteration_id)
            .order_by(ToolCall.sequence)
        )
        return list(result.scalars().all())

    # ============================================================
    # 高级查询
    # ============================================================

    async def get_full_session_history(
        self,
        session_id: str,
    ) -> List[dict]:
        """获取会话的完整历史记录

        返回结构化的数据，包含所有迭代、消息和工具调用
        """
        iterations = await self.get_session_iterations(
            session_id=session_id,
            include_messages=True,
        )

        history = []
        for iteration in iterations:
            iter_data = iteration.to_dict()
            iter_data["messages"] = [m.to_dict() for m in iteration.messages]
            iter_data["tool_calls"] = [
                t.to_dict() for t in await self.get_iteration_tool_calls(iteration.id)
            ]
            history.append(iter_data)

        return history

    async def get_compaction_history(
        self,
        session_id: str,
    ) -> List[dict]:
        """获取会话的上下文压缩历史"""
        result = await self.db.execute(
            select(Message, AgentIteration)
            .join(AgentIteration)
            .where(
                AgentIteration.session_id == session_id,
                Message.item_type == "compaction",
            )
            .order_by(AgentIteration.iteration_number)
        )

        history = []
        for message, iteration in result:
            history.append({
                "iteration_number": iteration.iteration_number,
                "agent_id": iteration.agent_id,
                "timestamp": message.created_at.isoformat() if message.created_at else None,
                "original_message_count": message.original_message_count,
                "summary": message.compaction_summary,
            })

        return history

    # ============================================================
    # 删除操作
    # ============================================================

    async def delete_iteration(self, iteration_id: int) -> None:
        """删除指定的迭代及其所有消息和工具调用"""
        await self.db.execute(
            delete(AgentIteration).where(AgentIteration.id == iteration_id)
        )
        await self.db.flush()

    async def delete_session_iterations(self, session_id: str) -> None:
        """删除会话的所有迭代数据"""
        await self.db.execute(
            delete(AgentIteration).where(AgentIteration.session_id == session_id)
        )
        await self.db.flush()
