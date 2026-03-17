"""
Session and debate schemas for Double Agent backend.
Based on frontend types from src/types/index.ts
"""

from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, Field

from .agent import AgentConfig, AgentMode


class ChatMessage(BaseModel):
    """Chat message model.

    Mirrors the TypeScript ChatMessage interface from src/types/index.ts
    """
    id: str = Field(..., description="Unique message identifier")
    role: str = Field(..., pattern="^(user|assistant)$", description="Message role")
    content: str = Field(..., description="Message content")
    reasoning: Optional[str] = Field(default=None, description="Reasoning content (for models like DeepSeek)")
    agent_id: Optional[str] = Field(default=None, alias="agentId", description="Agent identifier (for assistant messages)")
    timestamp: int = Field(..., description="Unix timestamp in milliseconds")

    class Config:
        populate_by_name = True


class DebateRound(BaseModel):
    """Debate round model.

    Mirrors the TypeScript DebateRound interface from src/types/index.ts
    """
    round: int = Field(..., ge=1, description="Round number")
    gentle_response: ChatMessage = Field(..., alias="gentleResponse", description="Gentle agent's response")
    angry_response: ChatMessage = Field(..., alias="angryResponse", description="Angry agent's response")

    class Config:
        populate_by_name = True


class DebateSession(BaseModel):
    """Debate session model.

    Mirrors the TypeScript DebateSession interface from src/types/index.ts
    """
    id: str = Field(..., description="Unique session identifier")
    title: str = Field(..., description="Session title")
    user_question: str = Field(..., alias="userQuestion", description="Initial user question")
    created_at: int = Field(..., alias="createdAt", description="Creation timestamp (Unix ms)")
    updated_at: int = Field(..., alias="updatedAt", description="Last update timestamp (Unix ms)")
    rounds: list[DebateRound] = Field(default_factory=list, description="Debate rounds")
    max_rounds: int = Field(default=10, alias="maxRounds", ge=1, le=50, description="Maximum rounds")
    gentle_config: AgentConfig = Field(..., alias="gentleConfig", description="Gentle agent configuration")
    angry_config: AgentConfig = Field(..., alias="angryConfig", description="Angry agent configuration")
    mode: AgentMode = Field(default=AgentMode.DOUBLE, description="Session mode")

    class Config:
        populate_by_name = True


class SessionMetadata(BaseModel):
    """Session metadata for list views."""
    id: str = Field(..., description="Session identifier")
    title: str = Field(..., description="Session title")
    user_question: str = Field(..., alias="userQuestion", description="Initial question")
    created_at: int = Field(..., alias="createdAt", description="Creation timestamp")
    updated_at: int = Field(..., alias="updatedAt", description="Last update timestamp")
    mode: AgentMode = Field(..., description="Session mode")
    total_rounds: int = Field(default=0, description="Number of completed rounds")

    class Config:
        populate_by_name = True


class SessionCreateRequest(BaseModel):
    """Request model for creating a new session."""
    title: Optional[str] = Field(default=None, description="Session title (auto-generated if not provided)")
    user_question: str = Field(..., alias="userQuestion", description="Initial user question")
    mode: AgentMode = Field(default=AgentMode.DOUBLE, description="Session mode")
    gentle_config: AgentConfig = Field(..., alias="gentleConfig", description="Gentle agent configuration")
    angry_config: AgentConfig = Field(..., alias="angryConfig", description="Angry agent configuration")
    max_rounds: int = Field(default=10, alias="maxRounds", ge=1, le=50, description="Maximum rounds")

    class Config:
        populate_by_name = True


class SessionUpdateRequest(BaseModel):
    """Request model for updating a session."""
    title: Optional[str] = Field(default=None, description="Session title")
    max_rounds: Optional[int] = Field(default=None, alias="maxRounds", ge=1, le=50)

    class Config:
        populate_by_name = True


class SessionListResponse(BaseModel):
    """Response model for listing sessions."""
    sessions: list[SessionMetadata] = Field(..., description="List of session metadata")
    total: int = Field(..., description="Total number of sessions")


class SessionDetailResponse(BaseModel):
    """Response model for session details."""
    session: DebateSession = Field(..., description="Full session data")


class ExportRequest(BaseModel):
    """Request model for exporting a session."""
    format: str = Field(default="jsonl", pattern="^(jsonl|json)$", description="Export format")


class ImportRequest(BaseModel):
    """Request model for importing a session."""
    data: str = Field(..., description="JSONL or JSON data to import")
    format: str = Field(default="jsonl", pattern="^(jsonl|json)$", description="Import format")


class ImportResponse(BaseModel):
    """Response model for import operation."""
    session_id: str = Field(..., alias="sessionId", description="Imported session ID")
    success: bool = Field(..., description="Whether import was successful")
    message: str = Field(..., description="Status message")

    class Config:
        populate_by_name = True


# SSE Event Types

class SSEEventType:
    """SSE event type constants."""
    CHUNK = "chunk"
    ROUND_COMPLETE = "round_complete"
    ERROR = "error"
    COMPLETE = "complete"


class SSEChunkEvent(BaseModel):
    """SSE chunk event - streamed content from an agent."""
    type: str = Field(default=SSEEventType.CHUNK, description="Event type")
    agent_id: str = Field(..., alias="agentId", description="Agent identifier (gentle/angry)")
    content: str = Field(..., description="Content chunk")
    reasoning: Optional[str] = Field(default=None, description="Reasoning content if available")

    class Config:
        populate_by_name = True


class SSERoundCompleteEvent(BaseModel):
    """SSE round complete event."""
    type: str = Field(default=SSEEventType.ROUND_COMPLETE, description="Event type")
    round: int = Field(..., description="Completed round number")
    should_end: bool = Field(..., alias="shouldEnd", description="Whether debate should end")

    class Config:
        populate_by_name = True


class SSEErrorEvent(BaseModel):
    """SSE error event."""
    type: str = Field(default=SSEEventType.ERROR, description="Event type")
    message: str = Field(..., description="Error message")
    details: Optional[dict[str, Any]] = Field(default=None, description="Additional error details")


class SSECompleteEvent(BaseModel):
    """SSE complete event - debate finished."""
    type: str = Field(default=SSEEventType.COMPLETE, description="Event type")
    session_id: str = Field(..., alias="sessionId", description="Session identifier")
    total_rounds: int = Field(..., alias="totalRounds", description="Total rounds completed")

    class Config:
        populate_by_name = True


# Union type for all SSE events
SSEEvent = SSEChunkEvent | SSERoundCompleteEvent | SSEErrorEvent | SSECompleteEvent
