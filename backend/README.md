# Double Agent Backend

FastAPI-based backend for the Double Agent dual-agent conversation/debate system.

## Features

- **FastAPI** - Modern, fast web framework for building APIs
- **SQLAlchemy 2.0** - Async ORM for database operations
- **SQLite** - Simple file-based database (can be upgraded to PostgreSQL)
- **SSE Streaming** - Server-Sent Events for real-time agent responses
- **Multi-Provider LLM Support** - OpenAI, Anthropic, DeepSeek, Qwen, Kimi, GLM

## Quick Start

### 1. Install Dependencies

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
# Edit .env and add your API keys
```

Required environment variables:
- `OPENAI_API_KEY` - For OpenAI and OpenAI-compatible providers
- `ANTHROPIC_API_KEY` - For Claude models

### 3. Run the Server

```bash
uvicorn app.main:app --reload --port 8000
```

The API will be available at:
- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

## API Endpoints

### Sessions
- `GET /api/sessions` - List all sessions
- `POST /api/sessions` - Create new session
- `GET /api/sessions/{id}` - Get session details
- `DELETE /api/sessions/{id}` - Delete session
- `POST /api/sessions/{id}/export` - Export session as JSONL
- `POST /api/sessions/import` - Import session from JSONL

### Debate/Conversation
- `POST /api/debate/stream` - SSE stream for debate/conversation

### Configuration
- `GET /api/config/models` - Get available model presets
- `GET /api/config/roles` - Get available role presets

## Architecture

```
backend/
├── app/
│   ├── main.py              # FastAPI entry point
│   ├── config.py            # Settings management
│   ├── core/
│   │   └── database.py      # SQLAlchemy setup
│   ├── models/
│   │   ├── session.py       # Session model
│   │   └── round.py         # Round model
│   ├── schemas/
│   │   ├── agent.py         # Pydantic models for agents
│   │   └── session.py       # Pydantic models for sessions
│   ├── routers/
│   │   ├── sessions.py      # Session API routes
│   │   ├── debate.py        # Debate streaming routes
│   │   └── config.py        # Config routes
│   └── services/
│       ├── agent_team.py    # Core debate logic
│       ├── llm_adapter.py   # LLM API adapters
│       └── context_manager.py  # Context compression
├── requirements.txt
└── .env
```

## SSE Event Format

The `/api/debate/stream` endpoint returns Server-Sent Events:

```
data: {"type": "chunk", "agentId": "gentle", "content": "Hello..."}

data: {"type": "chunk", "agentId": "angry", "content": "Actually..."}

data: {"type": "round_complete", "round": 1, "shouldEnd": false}

data: {"type": "complete", "sessionId": "sess_xxx", "totalRounds": 3}
```

Event types:
- `chunk` - Streaming content from an agent
- `round_complete` - A round has finished
- `error` - An error occurred
- `complete` - The debate has ended
