# Double Agent 文档

Double Agent 是一个双智能体对话/辩论系统，采用前后端分离架构：

- **前端**：React 19 + TypeScript + Vite
- **后端**：Python + FastAPI + SQLite

支持两种对话模式：

- **单 Agent 模式**：单个 Agent 进行常规对话，AI 自主决定何时结束
- **双 Agent 辩论模式**：两个性格迥异的 AI Agent（温和派 vs 暴躁派）进行多轮辩论

## 文档结构

```
docs/
├── README.md                 # 本文档
├── architecture/
│   ├── overview.md          # 架构总览
│   ├── tech-stack.md        # 技术栈
│   ├── frontend-structure.md # 前端结构
│   ├── backend-structure.md # 后端结构
│   └── data-flow.md         # 数据流
├── agents/
│   ├── overview.md          # Agent 系统概述
│   ├── AgentTeam.md         # Agent 团队协调
│   ├── AgentLoop.md         # 核心 Agent 循环
│   ├── adapters.md          # API 适配器
│   └── config.md            # Agent 配置
├── config/
│   ├── overview.md          # 配置系统概述
│   ├── three-layer-config.md # 三层配置系统
│   ├── ConfigManager.md     # 配置管理器
│   └── presets.md           # 预设配置
├── components/
│   └── overview.md          # 组件总览
├── backend/
│   ├── overview.md          # 后端概述
│   ├── api.md               # API 接口
│   ├── database.md          # 数据库设计
│   └── services.md          # 服务层
├── tools/
│   ├── overview.md          # 工具系统概述
│   ├── registry.md          # 工具注册中心
│   └── builtin-tools.md     # 内置工具
├── stores/
│   └── overview.md          # 状态管理概述
├── types/
│   └── index.md             # 类型定义
└── guides/
    ├── getting-started.md   # 快速开始
    ├── development.md       # 开发指南
    └── environment.md       # 环境变量配置
