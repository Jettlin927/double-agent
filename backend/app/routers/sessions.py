"""
Session management API routes for Double Agent backend.

Provides CRUD operations for debate sessions including:
- List all sessions
- Create new session
- Get session details
- Delete session
- Export/Import sessions in JSONL format
"""

import json
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.session import Session as SessionModel
from app.models.round import Round as RoundModel
from app.schemas.session import (
    DebateSession,
    DebateRound,
    ChatMessage,
    SessionCreateRequest,
    SessionUpdateRequest,
    SessionDetailResponse,
    ImportResponse,
)
from app.schemas.agent import AgentMode, get_default_role, AgentPersonality, AgentConfig, ApiType

router = APIRouter()


def generate_session_id() -> str:
    """Generate a unique session ID."""
    return f"sess_{uuid.uuid4().hex[:16]}"


def truncate_title(question: str, max_length: int = 50) -> str:
    """Generate a title from the user question."""
    if len(question) <= max_length:
        return question
    return question[:max_length - 3] + "..."


def session_model_to_schema(db_session: SessionModel) -> DebateSession:
    """Convert database Session model to Pydantic DebateSession schema."""
    rounds = []
    for db_round in db_session.rounds:
        rounds.append(DebateRound(
            round=db_round.round_number,
            gentle_response=ChatMessage(
                id=f"gentle-{db_round.round_number}",
                role="assistant",
                content=db_round.gentle_content,
                reasoning=db_round.gentle_reasoning,
                agent_id=db_round.gentle_agent_id,
                timestamp=int(db_round.created_at.timestamp() * 1000),
            ),
            angry_response=ChatMessage(
                id=f"angry-{db_round.round_number}",
                role="assistant",
                content=db_round.angry_content,
                reasoning=db_round.angry_reasoning,
                agent_id=db_round.angry_agent_id,
                timestamp=int(db_round.created_at.timestamp() * 1000),
            ),
        ))

    return DebateSession(
        id=db_session.id,
        title=db_session.title,
        user_question=db_session.user_question,
        created_at=int(db_session.created_at.timestamp() * 1000),
        updated_at=int(db_session.updated_at.timestamp() * 1000),
        rounds=rounds,
        max_rounds=db_session.max_rounds,
        gentle_config=AgentConfig(**db_session.gentle_config),
        angry_config=AgentConfig(**db_session.angry_config),
        mode=AgentMode(db_session.mode),
    )


@router.get("", response_model=list[DebateSession])
async def list_sessions(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
) -> list[DebateSession]:
    """
    Get all sessions with pagination.

    Args:
        skip: Number of sessions to skip
        limit: Maximum number of sessions to return

    Returns:
        List of debate sessions
    """
    try:
        result = await db.execute(
            select(SessionModel)
            .options(selectinload(SessionModel.rounds))
            .order_by(desc(SessionModel.updated_at))
            .offset(skip)
            .limit(limit)
        )
        db_sessions = result.scalars().all()

        return [session_model_to_schema(s) for s in db_sessions]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list sessions: {str(e)}"
        )


@router.post("", response_model=SessionDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    request: SessionCreateRequest,
    db: AsyncSession = Depends(get_db),
) -> SessionDetailResponse:
    """
    Create a new debate session.

    Args:
        request: Session creation parameters

    Returns:
        Created session details
    """
    try:
        session_id = generate_session_id()
        now = datetime.utcnow()

        # Generate title if not provided
        title = request.title or truncate_title(request.user_question)

        db_session = SessionModel(
            id=session_id,
            title=title,
            user_question=request.user_question,
            mode=request.mode.value,
            max_rounds=request.max_rounds,
            gentle_config=request.gentle_config.model_dump(),
            angry_config=request.angry_config.model_dump(),
            created_at=now,
            updated_at=now,
        )

        db.add(db_session)
        await db.commit()
        await db.refresh(db_session)

        # Re-query with rounds loaded
        result = await db.execute(
            select(SessionModel)
            .options(selectinload(SessionModel.rounds))
            .where(SessionModel.id == session_id)
        )
        db_session = result.scalar_one()

        return SessionDetailResponse(session=session_model_to_schema(db_session))

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create session: {str(e)}"
        )


@router.get("/{session_id}", response_model=SessionDetailResponse)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
) -> SessionDetailResponse:
    """
    Get session details by ID.

    Args:
        session_id: Session identifier

    Returns:
        Session details
    """
    try:
        result = await db.execute(
            select(SessionModel)
            .options(selectinload(SessionModel.rounds))
            .where(SessionModel.id == session_id)
        )
        db_session = result.scalar_one_or_none()

        if not db_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session not found: {session_id}"
            )

        return SessionDetailResponse(session=session_model_to_schema(db_session))

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get session: {str(e)}"
        )


@router.patch("/{session_id}", response_model=SessionDetailResponse)
async def update_session(
    session_id: str,
    request: SessionUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> SessionDetailResponse:
    """
    Update session metadata.

    Args:
        session_id: Session identifier
        request: Update parameters

    Returns:
        Updated session details
    """
    try:
        result = await db.execute(
            select(SessionModel)
            .options(selectinload(SessionModel.rounds))
            .where(SessionModel.id == session_id)
        )
        db_session = result.scalar_one_or_none()

        if not db_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session not found: {session_id}"
            )

        # Update fields if provided
        if request.title is not None:
            db_session.title = request.title
        if request.max_rounds is not None:
            db_session.max_rounds = request.max_rounds

        # Update timestamp
        db_session.updated_at = datetime.utcnow()

        await db.commit()

        # Re-query with rounds loaded
        result = await db.execute(
            select(SessionModel)
            .options(selectinload(SessionModel.rounds))
            .where(SessionModel.id == session_id)
        )
        db_session = result.scalar_one()

        return SessionDetailResponse(session=session_model_to_schema(db_session))

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update session: {str(e)}"
        )


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Delete a session by ID.

    Args:
        session_id: Session identifier
    """
    try:
        result = await db.execute(
            select(SessionModel).where(SessionModel.id == session_id)
        )
        db_session = result.scalar_one_or_none()

        if not db_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session not found: {session_id}"
            )

        await db.delete(db_session)
        await db.commit()

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete session: {str(e)}"
        )


@router.post("/{session_id}/export")
async def export_session(
    session_id: str,
    format: str = "jsonl",
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Export a session in JSONL or JSON format.

    JSONL format (line 1 = metadata, subsequent lines = rounds):
    ```
    {"id": "...", "title": "...", "userQuestion": "...", "createdAt": ..., "mode": "..."}
    {"round": 1, "gentleResponse": {...}, "angryResponse": {...}}
    ...
    ```

    Args:
        session_id: Session identifier
        format: Export format (jsonl or json)

    Returns:
        Exported data and content type information
    """
    try:
        result = await db.execute(
            select(SessionModel)
            .options(selectinload(SessionModel.rounds))
            .where(SessionModel.id == session_id)
        )
        db_session = result.scalar_one_or_none()

        if not db_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session not found: {session_id}"
            )

        schema_session = session_model_to_schema(db_session)

        if format == "jsonl":
            # JSONL format: metadata on first line, rounds on subsequent lines
            lines = []

            # Metadata line
            metadata = {
                "id": schema_session.id,
                "title": schema_session.title,
                "userQuestion": schema_session.user_question,
                "createdAt": schema_session.created_at,
                "mode": schema_session.mode.value,
                "maxRounds": schema_session.max_rounds
            }
            lines.append(json.dumps(metadata, ensure_ascii=False))

            # Round lines
            for round_data in schema_session.rounds:
                round_dict = {
                    "round": round_data.round,
                    "gentleResponse": round_data.gentle_response.model_dump(by_alias=True),
                    "angryResponse": round_data.angry_response.model_dump(by_alias=True)
                }
                lines.append(json.dumps(round_dict, ensure_ascii=False))

            content = "\n".join(lines)

        else:  # json format
            content = json.dumps(
                schema_session.model_dump(by_alias=True),
                ensure_ascii=False,
                indent=2
            )

        return {
            "session_id": session_id,
            "format": format,
            "content": content,
            "filename": f"session_{session_id}.{format}"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export session: {str(e)}"
        )


@router.post("/import", response_model=ImportResponse)
async def import_session(
    request: dict,  # Use dict to accept raw JSON
    db: AsyncSession = Depends(get_db),
) -> ImportResponse:
    """
    Import a session from JSONL or JSON data.

    Args:
        request: Import data containing 'data' and 'format' fields

    Returns:
        Import result with new session ID
    """
    try:
        data = request.get("data", "")
        format = request.get("format", "jsonl")

        if format == "jsonl":
            # Parse JSONL format
            lines = data.strip().split("\n")
            if not lines:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Empty import data"
                )

            # Parse metadata (first line)
            metadata = json.loads(lines[0])

            # Parse rounds (subsequent lines)
            rounds = []
            for line in lines[1:]:
                if line.strip():
                    round_dict = json.loads(line)
                    rounds.append(round_dict)

            # Create new session with imported data
            session_id = generate_session_id()
            now = datetime.utcnow()

            # Use default configs for imported sessions
            gentle_role = get_default_role(AgentPersonality.GENTLE)
            angry_role = get_default_role(AgentPersonality.ANGRY)

            gentle_config = AgentConfig(
                id="gentle-imported",
                name=gentle_role.name,
                personality=AgentPersonality.GENTLE,
                api_type=ApiType.OPENAI,
                base_url="https://api.openai.com",
                api_key="",
                model="gpt-4o",
                system_prompt=gentle_role.system_prompt,
                temperature=0.7,
                max_rounds=10
            )

            angry_config = AgentConfig(
                id="angry-imported",
                name=angry_role.name,
                personality=AgentPersonality.ANGRY,
                api_type=ApiType.OPENAI,
                base_url="https://api.openai.com",
                api_key="",
                model="gpt-4o",
                system_prompt=angry_role.system_prompt,
                temperature=0.8,
                max_rounds=10
            )

            db_session = SessionModel(
                id=session_id,
                title=metadata.get("title", "Imported Session"),
                user_question=metadata.get("userQuestion", ""),
                mode=metadata.get("mode", "double"),
                max_rounds=metadata.get("maxRounds", 10),
                gentle_config=gentle_config.model_dump(),
                angry_config=angry_config.model_dump(),
                created_at=now,
                updated_at=now,
            )

            db.add(db_session)

            # Add rounds
            for round_dict in rounds:
                db_round = RoundModel(
                    session_id=session_id,
                    round_number=round_dict["round"],
                    gentle_content=round_dict["gentleResponse"]["content"],
                    gentle_reasoning=round_dict["gentleResponse"].get("reasoning"),
                    gentle_agent_id=round_dict["gentleResponse"].get("agentId", "gentle"),
                    angry_content=round_dict["angryResponse"]["content"],
                    angry_reasoning=round_dict["angryResponse"].get("reasoning"),
                    angry_agent_id=round_dict["angryResponse"].get("agentId", "angry"),
                    created_at=now,
                )
                db.add(db_round)

            await db.commit()

            return ImportResponse(
                session_id=session_id,
                success=True,
                message=f"Successfully imported session with {len(rounds)} rounds"
            )

        else:  # json format
            data_dict = json.loads(data)
            session_id = generate_session_id()
            now = datetime.utcnow()

            # Update ID and timestamps
            data_dict["id"] = session_id

            db_session = SessionModel(
                id=session_id,
                title=data_dict.get("title", "Imported Session"),
                user_question=data_dict.get("userQuestion", data_dict.get("user_question", "")),
                mode=data_dict.get("mode", "double"),
                max_rounds=data_dict.get("maxRounds", data_dict.get("max_rounds", 10)),
                gentle_config=data_dict.get("gentleConfig", data_dict.get("gentle_config", {})),
                angry_config=data_dict.get("angryConfig", data_dict.get("angry_config", {})),
                created_at=now,
                updated_at=now,
            )

            db.add(db_session)

            # Add rounds if present
            rounds = data_dict.get("rounds", [])
            for round_dict in rounds:
                db_round = RoundModel(
                    session_id=session_id,
                    round_number=round_dict["round"],
                    gentle_content=round_dict["gentleResponse"]["content"],
                    gentle_reasoning=round_dict["gentleResponse"].get("reasoning"),
                    gentle_agent_id=round_dict["gentleResponse"].get("agentId", "gentle"),
                    angry_content=round_dict["angryResponse"]["content"],
                    angry_reasoning=round_dict["angryResponse"].get("reasoning"),
                    angry_agent_id=round_dict["angryResponse"].get("agentId", "angry"),
                    created_at=now,
                )
                db.add(db_round)

            await db.commit()

            return ImportResponse(
                session_id=session_id,
                success=True,
                message=f"Successfully imported session with {len(rounds)} rounds"
            )

    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid JSON data: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import session: {str(e)}"
        )
