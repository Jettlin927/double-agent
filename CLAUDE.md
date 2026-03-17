# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Double Agent is a dual-agent conversation/debate web application built with React 19 + TypeScript + Vite. It supports two modes:
- **Single-agent mode**: One "gentle" agent for normal conversation
- **Double-agent debate mode**: Two agents ("gentle" vs "angry") engage in multi-round debates

## Build Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Preview production build
npm run preview
```

## Architecture

### Tech Stack
- React 19 + TypeScript
- Vite 8 (with custom proxy for OpenAI/Anthropic APIs)
- TailwindCSS v4 + PostCSS
- Zustand for state management (persisted to localStorage)
- lucide-react for icons

### Project Structure

```
src/
├── agents/               # Core agent logic
│   ├── AgentTeam.ts      # Main coordinator class (runDebate/runSingle)
│   ├── OpenAIAdapter.ts  # OpenAI-format API adapter
│   └── AnthropicAdapter.ts # Claude native API adapter
├── components/           # React UI components
├── hooks/
│   └── useAgentTeam.ts   # React integration hook for AgentTeam
├── prompts/
│   ├── roles.ts          # Role definitions (gentle/angry personas)
│   └── models.ts         # Model presets (OpenAI/Anthropic/DeepSeek/etc)
├── stores/
│   ├── agentStore.ts     # Agent config persistence (Zustand)
│   └── debateStorage.ts  # Session history (localStorage + JSONL)
├── tools/                # Tool system for agents
├── utils/
│   └── tokenCounter.ts   # Token estimation & context compression
└── types/index.ts        # Core TypeScript types
```

### Key Concepts

**AgentTeam Class** (`src/agents/AgentTeam.ts`):
- Core orchestrator for agent conversations
- `runSingle()`: Single-agent mode with dynamic ending
- `runDebate()`: Dual-agent debate with round-robin turns
- Dynamic ending: Agents output `[END]` or `[CONTINUE]` to decide when to stop
- `maxAutoRounds = 10`: Safety limit to prevent infinite loops

**API Adapters**:
- OpenAIAdapter: For GPT, DeepSeek, Qwen, Kimi, GLM (OpenAI-compatible)
- AnthropicAdapter: For Claude native API
- Proxy configured in `vite.config.ts` to route `/api/openai` and `/api/anthropic`

**Context Management** (`src/utils/tokenCounter.ts`):
- Token estimation based on character count
- `compactMessages()`: Compresses context by summarizing older messages
- Auto-compression when usage exceeds 80% of model's context limit
- Model context limits defined in `CONTEXT_LIMITS` constant

**State Flow**:
```
User Input → useAgentTeam.runDebate() → AgentTeam → API Adapter
                                              ↓
                                        Stream Response → UI Update
                                              ↓
                                        debateStorage (localStorage)
```

### Configuration

**Environment Variables** (`.env.local`):
```bash
VITE_GENTLE_API_TYPE=openai|anthropic
VITE_GENTLE_BASE_URL=https://api.openai.com
VITE_GENTLE_API_KEY=...
VITE_GENTLE_MODEL=gpt-4o
VITE_GENTLE_TEMPERATURE=0.7
VITE_GENTLE_ROLE_ID=gentle-default

VITE_ANGRY_API_TYPE=openai
VITE_ANGRY_BASE_URL=https://api.openai.com
VITE_ANGRY_API_KEY=...
VITE_ANGRY_MODEL=gpt-4o
VITE_ANGRY_TEMPERATURE=0.8
VITE_ANGRY_ROLE_ID=angry-default
```

**Role System** (`src/prompts/roles.ts`):
- Each role has `systemPrompt` and optional `endingPrompt`
- Gentle roles: gentle-default, gentle-therapist, gentle-teacher, gentle-friend
- Angry roles: angry-default, angry-critic, angry-debate, angry-mentor

**Model Presets** (`src/prompts/models.ts`):
- Pre-configured for OpenAI, Anthropic, DeepSeek, Alibaba Qwen, Moonshot Kimi, Zhipu GLM
- Includes baseURL, model name, temperature, maxTokens

### Session Storage

Sessions stored in localStorage as JSONL format:
- Line 1: Metadata (sessionId, title, userQuestion, createdAt, mode)
- Subsequent lines: Round data (gentleResponse, angryResponse)

Use `debateStorage` methods: `createSession`, `addRound`, `exportToJSONL`, `importFromJSONL`

### Tool System

Extensible tool framework in `src/tools/`:
- Tools defined with JSON schema parameters
- Parser extracts tool calls from agent responses
- Built-in tools: web_search, execute_code, ask_other_agent, summarize, fact_check, calculate, memory

### Custom Vite Plugin

`vite-env-save-plugin.ts` provides `/api/save-env` endpoint for saving configuration to `.env.local` during development.
