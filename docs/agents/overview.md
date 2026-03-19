# Agent 系统概述

Agent 系统是 Double Agent 的核心，负责与 LLM API 交互、管理对话流程、处理工具调用。

## 架构

```
┌─────────────────────────────────────────┐
│           AgentTeam (协调层)             │
│    - 管理单/双 Agent 对话模式            │
│    - 处理回合逻辑和动态结束判断            │
│    - 管理对话历史和上下文压缩              │
└─────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌──────────────┐        ┌──────────────┐
│  AgentLoop   │        │  AgentLoop   │
│  (Gentle)    │        │  (Angry)     │
└──────────────┘        └──────────────┘
        │                       │
        └───────────┬───────────┘
                    ▼
        ┌───────────────────────┐
        │     API Adapter       │
        │  (OpenAI/Anthropic)   │
        └───────────────────────┘
```

## 核心类

### AgentTeam

协调类，管理对话流程：

- `runSingle()` - 单 Agent 对话模式
- `runDebate()` - 双 Agent 辩论模式
- `loadSession()` - 加载历史会话
- `compactContext()` - 手动压缩上下文

### AgentLoop

核心 Agent 循环（参考 Codex CLI）：

- 统一消息类型系统
- 多轮工具调用支持
- 流式响应处理
- 上下文自动压缩

### API Adapters

适配不同 LLM API 格式：

- `OpenAIAdapter` - OpenAI 兼容格式
- `AnthropicAdapter` - Claude 原生格式

## 对话模式

### 单 Agent 模式

```
用户输入
    ↓
Agent 生成回复
    ↓
检查是否结束（从第1轮开始）
    ↓
继续或停止
```

**动态结束判断**：
- 使用 `temperature=0` 调用结束判断提示
- 解析 `[END]` / `[CONTINUE]` 标记
- 最大 10 轮安全限制

### 双 Agent 模式

```
用户输入
    ↓
Gentle Agent 发言
    ↓
Angry Agent 回应
    ↓
保存回合
    ↓
检查是否结束（从第2轮开始）
    ↓
继续或停止
```

**角色引导**：
- 第二轮开始添加辩论引导语
- Angry Agent 会被告知对方观点并要求反驳

## 上下文管理

### Token 估算

```typescript
// 中文字符：约 1.5 tokens/字
// 英文单词：约 1.3 tokens/词
export function estimateTokens(text: string): number
```

### 上下文压缩

当使用量超过 80% 阈值时自动触发：

```typescript
export function compactMessages(
  messages: Message[],
  keepRecent: number = 4
): Message[]
```

压缩策略：
1. 保留系统消息
2. 保留最近 N 条消息
3. 压缩早期消息为摘要

## 文件列表

| 文件 | 说明 |
|------|------|
| `AgentTeam.ts` | 主协调类 |
| `AgentLoop.ts` | 核心 Agent 循环 |
| `OpenAIAdapter.ts` | OpenAI 适配器 |
| `AnthropicAdapter.ts` | Anthropic 适配器 |
| `AgentConfig.ts` | Agent 配置类型 |
| `index.ts` | 导出 |
