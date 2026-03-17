from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.core.database import get_db
from app.services.message_storage import MessageStorageService
from app.schemas.message import (
    IterationCreate,
    IterationResponse,
    IterationDetailResponse,
    MessageCreate,
    MessageResponse,
    ToolCallCreate,
    ToolCallComplete,
    ToolCallResponse,
    SessionHistoryResponse,
)

router = APIRouter(prefix="/messages", tags=["messages"])


@router.post("/iterations", response_model=IterationResponse)
async def create_iteration(
    data: IterationCreate,
    db: AsyncSession = Depends(get_db),
):
    """创建新的 Agent Iteration"""
    service = MessageStorageService(db)
    iteration = await service.create_iteration(
        session_id=data.session_id,
        agent_id=data.agent_id,
        agent_name=data.agent_name,
        round_number=data.round_number,
        iteration_number=data.iteration_number,
    )
    return iteration


@router.get("/iterations/{iteration_id}", response_model=IterationDetailResponse)
async def get_iteration(
    iteration_id: int,
    db: AsyncSession = Depends(get_db),
):
    """获取 Agent Iteration 详情（包含消息）"""
    service = MessageStorageService(db)
    iteration = await service.get_iteration(
        iteration_id=iteration_id,
        include_messages=True,
        include_tool_calls=True,
    )
    if not iteration:
        raise HTTPException(status_code=404, detail="Iteration not found")
    return iteration


@router.get("/sessions/{session_id}/iterations", response_model=List[IterationResponse])
async def get_session_iterations(
    session_id: str,
    agent_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """获取会话的所有迭代"""
    service = MessageStorageService(db)
    iterations = await service.get_session_iterations(
        session_id=session_id,
        agent_id=agent_id,
    )
    return iterations


@router.patch("/iterations/{iteration_id}/status")
async def update_iteration_status(
    iteration_id: int,
    status: str,
    duration_ms: Optional[int] = None,
    error_message: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """更新迭代状态"""
    service = MessageStorageService(db)
    await service.update_iteration_status(
        iteration_id=iteration_id,
        status=status,
        duration_ms=duration_ms,
        error_message=error_message,
    )
    return {"success": True}


@router.post("/iterations/{iteration_id}/messages", response_model=MessageResponse)
async def save_message(
    iteration_id: int,
    data: MessageCreate,
    db: AsyncSession = Depends(get_db),
):
    """保存单条消息"""
    service = MessageStorageService(db)
    message = await service.save_message(
        iteration_id=iteration_id,
        item_type=data.item_type,
        sequence=data.sequence,
        **data.model_dump(exclude={"item_type", "sequence"}),
    )
    return message


@router.post("/iterations/{iteration_id}/messages/batch")
async def save_messages_batch(
    iteration_id: int,
    items: List[MessageCreate],
    db: AsyncSession = Depends(get_db),
):
    """批量保存消息"""
    service = MessageStorageService(db)
    messages = await service.save_messages_batch(
        iteration_id=iteration_id,
        items=[item.model_dump() for item in items],
    )
    return {"messages": messages}


@router.get("/iterations/{iteration_id}/messages", response_model=List[MessageResponse])
async def get_iteration_messages(
    iteration_id: int,
    item_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """获取迭代的所有消息"""
    service = MessageStorageService(db)
    messages = await service.get_iteration_messages(
        iteration_id=iteration_id,
        item_type=item_type,
    )
    return messages


@router.post("/iterations/{iteration_id}/tool-calls", response_model=ToolCallResponse)
async def record_tool_call(
    iteration_id: int,
    data: ToolCallCreate,
    db: AsyncSession = Depends(get_db),
):
    """记录工具调用"""
    service = MessageStorageService(db)
    tool_call = await service.record_tool_call(
        iteration_id=iteration_id,
        call_id=data.call_id,
        tool_name=data.tool_name,
        arguments=data.arguments,
        sequence=data.sequence,
    )
    return tool_call


@router.patch("/tool-calls/{tool_call_id}/complete")
async def complete_tool_call(
    tool_call_id: int,
    data: ToolCallComplete,
    db: AsyncSession = Depends(get_db),
):
    """完成工具调用记录"""
    service = MessageStorageService(db)
    await service.complete_tool_call(
        tool_call_id=tool_call_id,
        success=data.success,
        result_data=data.result_data,
        error_message=data.error_message,
        execution_time_ms=data.execution_time_ms,
    )
    return {"success": True}


@router.get("/sessions/{session_id}/history", response_model=SessionHistoryResponse)
async def get_session_history(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取会话的完整历史记录"""
    service = MessageStorageService(db)
    history = await service.get_full_session_history(session_id=session_id)
    return {"session_id": session_id, "iterations": history}


@router.get("/sessions/{session_id}/compactions")
async def get_compaction_history(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取会话的上下文压缩历史"""
    service = MessageStorageService(db)
    history = await service.get_compaction_history(session_id=session_id)
    return {"session_id": session_id, "compactions": history}