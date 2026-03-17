"""
Debate streaming API routes for Double Agent backend.

Provides SSE (Server-Sent Events) streaming for real-time debate/conversation:
- Single-agent mode: One agent responds to user input
- Double-agent mode: Two agents debate each other

All responses are streamed as SSE events for real-time UI updates.
"""

import json
import asyncio
import uuid
from datetime import datetime
from typing import AsyncGenerator, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..schemas.agent import AgentConfig, AgentMode, AgentPersonality
from ..schemas.session import (
    DebateSession,
    DebateRound,
    ChatMessage,
    SSEChunkEvent,
    SSERoundCompleteEvent,
    SSEErrorEvent,
    SSECompleteEvent,
    SSEEventType,
)
from ..services.agent_team import AgentTeam, AgentConfig as AgentTeamConfig, EventType
from ..services.llm_adapter import create_adapter
from ..config import get_settings

router = APIRouter()
settings = get_settings()


class DebateStreamRequest(BaseModel):
    """Request model for streaming debate/conversation."""
    session_id: Optional[str] = Field(
        default=None,
        alias="sessionId",
        description="Existing session ID (optional, creates new if not provided)"
    )
    question: str = Field(..., description="User question or topic")
    mode: AgentMode = Field(default=AgentMode.DOUBLE, description="Debate mode")
    gentle_config: AgentConfig = Field(..., alias="gentleConfig", description="Gentle agent configuration")
    angry_config: Optional[AgentConfig] = Field(
        default=None,
        alias="angryConfig",
        description="Angry agent configuration (required for double mode)"
    )
    max_rounds: int = Field(
        default=10,
        alias="maxRounds",
        ge=1,
        le=50,
        description="Maximum number of debate rounds"
    )

    class Config:
        populate_by_name = True


def get_api_key(api_type: str) -> str:
    """Get API key from environment variables based on api_type."""
    api_type_lower = api_type.lower()
    if api_type_lower == "anthropic":
        return settings.ANTHROPIC_API_KEY
    else:
        # Default to OpenAI API key for openai and openai-compatible providers
        return settings.OPENAI_API_KEY


def get_base_url(api_type: str, config_base_url: str) -> str:
    """Get base URL, using config value if provided, otherwise from settings."""
    if config_base_url and config_base_url.strip():
        return config_base_url

    api_type_lower = api_type.lower()
    if api_type_lower == "anthropic":
        return settings.ANTHROPIC_BASE_URL
    else:
        return settings.OPENAI_BASE_URL


def convert_config(config: AgentConfig) -> AgentTeamConfig:
    """Convert schema AgentConfig to services AgentTeamConfig."""
    api_type = config.api_type.value if isinstance(config.api_type, AgentPersonality) else str(config.api_type)

    return AgentTeamConfig(
        id=config.id,
        name=config.name,
        api_type=api_type,
        base_url=get_base_url(api_type, config.base_url),
        api_key=get_api_key(api_type),
        model=config.model,
        temperature=config.temperature,
        max_tokens=config.max_tokens,
        system_prompt=config.system_prompt,
    )


def format_sse_event(data: dict) -> str:
    """Format a dictionary as an SSE event string."""
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/stream")
async def stream_debate(
    request: DebateStreamRequest,
    db: Session = Depends(get_db)
) -> StreamingResponse:
    """
    Stream a debate or single-agent conversation using SSE.

    This endpoint returns a Server-Sent Events stream with the following event types:

    **chunk**: Streaming content from an agent
    ```json
    {
      "type": "chunk",
      "agentId": "gentle|angry",
      "content": "...",
      "reasoning": "..."
    }
    ```

    **round_complete**: A round has completed
    ```json
    {
      "type": "round_complete",
      "round": 1,
      "shouldEnd": true|false
    }
    ```

    **error**: An error occurred
    ```json
    {
      "type": "error",
      "message": "..."
    }
    ```

    **complete**: The debate/conversation has finished
    ```json
    {
      "type": "complete",
      "sessionId": "...",
      "totalRounds": 3
    }
    ```

    Args:
        request: Debate configuration and parameters

    Returns:
        StreamingResponse with SSE content type
    """

    async def event_generator() -> AsyncGenerator[str, None]:
        """Generate SSE events for the debate."""
        session_id = request.session_id or str(uuid.uuid4())

        try:
            # Validate config
            if request.mode == AgentMode.DOUBLE and not request.angry_config:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="angryConfig is required for double-agent mode"
                )

            # Convert configs
            gentle_config = convert_config(request.gentle_config)
            angry_config = convert_config(request.angry_config) if request.angry_config else None

            # Create LLM adapters
            llm_adapters = {
                "openai": create_adapter("openai"),
                "anthropic": create_adapter("anthropic"),
            }

            # Initialize agent team
            agent_team = AgentTeam(
                gentle_config=gentle_config,
                angry_config=angry_config or gentle_config,  # Fallback to gentle if no angry
                db_session=db,
                llm_adapters=llm_adapters
            )
            agent_team.max_auto_rounds = request.max_rounds

            # Run debate/conversation
            if request.mode == AgentMode.SINGLE:
                stream = agent_team.run_single(session_id, request.question)
            else:
                stream = agent_team.run_debate(session_id, request.question)

            # Stream events
            async for event in stream:
                event_data = {
                    "type": event.type,
                }

                if event.agent_id:
                    event_data["agentId"] = event.agent_id
                if event.content is not None:
                    event_data["content"] = event.content
                if event.reasoning is not None:
                    event_data["reasoning"] = event.reasoning
                if event.round is not None:
                    event_data["round"] = event.round
                if event.should_end is not None:
                    event_data["shouldEnd"] = event.should_end
                if event.error:
                    event_data["message"] = event.error

                # Add session_id to complete event
                if event.type == EventType.COMPLETE:
                    event_data["sessionId"] = session_id
                    event_data["totalRounds"] = agent_team.current_round

                yield format_sse_event(event_data)

        except HTTPException:
            raise
        except Exception as e:
            error_event = {
                "type": "error",
                "message": f"Debate error: {str(e)}"
            }
            yield format_sse_event(error_event)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )


@router.post("/stream-test")
async def stream_test() -> StreamingResponse:
    """
    Test endpoint for SSE streaming.

    Returns a simple SSE stream for testing the connection.
    """
    async def test_generator() -> AsyncGenerator[str, None]:
        for i in range(5):
            yield format_sse_event({
                "type": "chunk",
                "agentId": "gentle",
                "content": f"Test message {i + 1} ",
                "reasoning": None
            })
            await asyncio.sleep(0.5)

        yield format_sse_event({
            "type": "complete",
            "sessionId": "test-session",
            "totalRounds": 1
        })

    return StreamingResponse(
        test_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
