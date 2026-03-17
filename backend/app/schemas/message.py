"""
消息相关 Pydantic Schemas
对应前端 InputItem/OutputItem 类型
"""

from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, field_serializer, field_validator
from datetime import datetime


def serialize_datetime(dt: Optional[datetime]) -> Optional[str]:
    """将 datetime 序列化为 ISO 格式字符串"""
    return dt.isoformat() if dt else None


# ============================================================
# ContentPart Schemas
# ============================================================

class InputTextPart(BaseModel):
    type: Literal["input_text"] = "input_text"
    text: str


class OutputTextPart(BaseModel):
    type: Literal["output_text"] = "output_text"
    text: str


class InputImagePart(BaseModel):
    type: Literal["input_image"] = "input_image"
    image_url: str


class InputFilePart(BaseModel):
    type: Literal["input_file"] = "input_file"
    file_name: str
    file_content: str


ContentPartSchema = InputTextPart | OutputTextPart | InputImagePart | InputFilePart


# ============================================================
# SummaryPart Schemas
# ============================================================

class SummaryTextPart(BaseModel):
    type: Literal["summary_text"] = "summary_text"
    text: str


class SummaryImagePart(BaseModel):
    type: Literal["summary_image"] = "summary_image"
    image_url: str


SummaryPartSchema = SummaryTextPart | SummaryImagePart


# ============================================================
# Message Schemas
# ============================================================

class MessageCreate(BaseModel):
    """创建消息的 Schema"""
    item_type: Literal["message", "reasoning", "function_call", "function_call_output", "compaction"]
    sequence: int

    # message 类型字段
    role: Optional[str] = None  # system, developer, user, assistant
    content: Optional[List[Dict[str, Any]]] = None  # ContentPart[]

    # reasoning 类型字段
    summary: Optional[List[Dict[str, Any]]] = None  # SummaryPart[]
    encrypted_content: Optional[str] = None

    # function_call 类型字段
    name: Optional[str] = None
    arguments: Optional[str] = None  # JSON 字符串
    call_id: Optional[str] = None

    # function_call_output 类型字段
    output: Optional[str] = None

    # compaction 类型字段
    original_message_count: Optional[int] = None

    # 元数据
    client_id: Optional[str] = None
    agent_id: Optional[str] = None
    timestamp: Optional[int] = None
    meta_data: Optional[Dict[str, Any]] = Field(default=None, alias="metadata")


class MessageResponse(BaseModel):
    """消息响应 Schema"""
    id: int
    type: str = Field(validation_alias="item_type")
    sequence: int
    created_at: Optional[datetime] = None

    # 根据类型的动态字段
    role: Optional[str] = None
    content: Optional[List[Dict[str, Any]]] = None
    summary: Optional[List[Dict[str, Any]]] = None
    encrypted_content: Optional[str] = None
    name: Optional[str] = None
    arguments: Optional[str] = None
    call_id: Optional[str] = None
    output: Optional[str] = None
    original_message_count: Optional[int] = None
    client_id: Optional[str] = None
    agent_id: Optional[str] = None
    timestamp: Optional[int] = None
    meta_data: Optional[Dict[str, Any]] = Field(default=None, alias="metadata")

    @field_serializer('created_at')
    def serialize_created_at(self, dt: Optional[datetime]) -> Optional[str]:
        return serialize_datetime(dt)

    @field_validator('meta_data', mode='before')
    @classmethod
    def validate_metadata(cls, v):
        if v is None or isinstance(v, dict):
            return v
        # 处理 SQLAlchemy MetaData 对象或其他非字典类型
        return None

    class Config:
        from_attributes = True
        populate_by_name = True


# ============================================================
# ToolCall Schemas
# ============================================================

class ToolCallCreate(BaseModel):
    """创建工具调用记录的 Schema"""
    call_id: str
    tool_name: str
    arguments: Dict[str, Any]
    sequence: int = 0


class ToolCallComplete(BaseModel):
    """完成工具调用记录的 Schema"""
    success: bool
    result_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    execution_time_ms: int = 0


class ToolCallResponse(BaseModel):
    """工具调用响应 Schema"""
    id: int
    call_id: str
    tool_name: str
    arguments: Dict[str, Any]
    success: bool
    result_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    execution_time_ms: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    meta_data: Optional[Dict[str, Any]] = Field(default=None, alias="metadata")

    @field_serializer('started_at', 'completed_at')
    def serialize_datetime_fields(self, dt: Optional[datetime]) -> Optional[str]:
        return serialize_datetime(dt)

    class Config:
        from_attributes = True


# ============================================================
# Iteration Schemas
# ============================================================

class IterationCreate(BaseModel):
    """创建 Agent Iteration 的 Schema"""
    session_id: str
    agent_id: str
    agent_name: Optional[str] = None
    round_number: int = 1
    iteration_number: Optional[int] = None


class IterationResponse(BaseModel):
    """Agent Iteration 响应 Schema"""
    id: int
    session_id: str
    agent_id: str
    agent_name: Optional[str] = None
    iteration_number: int
    round_number: int
    status: str
    duration_ms: int
    was_compacted: bool
    pre_compaction_message_count: Optional[int] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    message_count: int = 0
    tool_call_count: int = 0

    @field_serializer('created_at')
    def serialize_created_at(self, dt: Optional[datetime]) -> Optional[str]:
        return serialize_datetime(dt)

    class Config:
        from_attributes = True


class IterationDetailResponse(IterationResponse):
    """包含详细信息的 Agent Iteration 响应 Schema"""
    messages: List[MessageResponse] = []
    tool_calls: List[ToolCallResponse] = []


class IterationStatusUpdate(BaseModel):
    """更新 Iteration 状态的 Schema"""
    status: str
    duration_ms: Optional[int] = None
    error_message: Optional[str] = None


class CompactionUpdate(BaseModel):
    """更新压缩信息的 Schema"""
    was_compacted: bool
    pre_compaction_message_count: Optional[int] = None


# ============================================================
# Session History Schema
# ============================================================

class SessionHistoryResponse(BaseModel):
    """会话完整历史响应 Schema"""
    session_id: str
    iterations: List[Dict[str, Any]]


class CompactionHistoryItem(BaseModel):
    """压缩历史项 Schema"""
    iteration_number: int
    agent_id: str
    timestamp: Optional[str] = None
    original_message_count: Optional[int] = None
    summary: Optional[List[Dict[str, Any]]] = None


class CompactionHistoryResponse(BaseModel):
    """压缩历史响应 Schema"""
    session_id: str
    compactions: List[CompactionHistoryItem]


# ============================================================
# 批量操作 Schemas
# ============================================================

class BatchMessagesCreate(BaseModel):
    """批量创建消息的请求 Schema"""
    items: List[MessageCreate]


class BatchMessagesResponse(BaseModel):
    """批量创建消息的响应 Schema"""
    messages: List[MessageResponse]
