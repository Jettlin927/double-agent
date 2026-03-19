# 快速开始

本指南将帮助你在几分钟内启动 Double Agent 应用。

## 环境要求

- **Node.js**: 18.0 或更高版本
- **Python**: 3.11 或更高版本
- **npm** 或 **yarn**

## 安装步骤

### 1. 克隆项目

```bash
git clone <repository-url>
cd double-agent
```

### 2. 安装前端依赖

```bash
npm install
```

### 3. 安装后端依赖

```bash
cd backend
python -m venv venv

# Linux/Mac
source venv/bin/activate

# Windows
venv\Scripts\activate

pip install -r requirements.txt
cd ..
```

### 4. 配置环境变量

创建 `.env.local` 文件：

```bash
# OpenAI 配置
VITE_OPENAI_API_KEY=sk-...
VITE_OPENAI_BASE_URL=https://api.openai.com

# Anthropic 配置
VITE_ANTHROPIC_API_KEY=sk-ant-...
VITE_ANTHROPIC_BASE_URL=https://api.anthropic.com

# 其他提供商（可选）
VITE_DEEPSEEK_API_KEY=...
VITE_QWEN_API_KEY=...
VITE_KIMI_API_KEY=...
```

### 5. 启动开发服务器

**启动后端**（终端 1）：

```bash
cd backend
source venv/bin/activate  # 或 venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

**启动前端**（终端 2）：

```bash
npm run dev
```

### 6. 访问应用

打开浏览器访问：http://localhost:5173

## 基本使用

### 单 Agent 对话

1. 在侧边栏选择"单 Agent 模式"
2. 在底部输入框输入问题
3. 按 Enter 发送
4. Agent 会自动决定何时结束对话

### 双 Agent 辩论

1. 在侧边栏选择"双 Agent 辩论"
2. 输入讨论主题
3. 温和派和暴躁派 Agent 会轮流发言
4. AI 会自动判断何时结束辩论

### 配置 Agent

1. 点击顶部"配置"按钮
2. 选择配置标签：
   - **Providers**: 管理 API 提供商
   - **Models**: 管理模型配置
   - **Agents**: 管理 Agent 配置
   - **Quick**: 快速配置（兼容模式）
3. 添加或编辑配置

## 项目结构

```
double-agent/
├── backend/              # Python FastAPI 后端
│   ├── app/
│   │   ├── main.py
│   │   ├── routers/
│   │   ├── models/
│   │   └── services/
│   └── data/            # SQLite 数据库
├── src/                  # React 前端
│   ├── agents/          # Agent 核心逻辑
│   ├── components/      # UI 组件
│   ├── config/          # 三层配置系统
│   ├── tools/           # 工具系统
│   └── stores/          # 状态管理
└── docs-new/            # 文档
```

## 常用命令

### 前端

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview

# 运行 ESLint
npm run lint
```

### 后端

```bash
cd backend
source venv/bin/activate

# 启动开发服务器
uvicorn app.main:app --reload --port 8000

# 生产环境
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## 故障排除

### 后端连接失败

**问题**: 前端提示无法连接到后端

**解决**:
1. 确认后端已启动（`http://localhost:8000`）
2. 检查 `vite.config.ts` 中的代理配置
3. 确认没有防火墙阻止端口 8000

### API Key 无效

**问题**: 调用 API 时返回 401 错误

**解决**:
1. 检查 `.env.local` 中的 API Key 是否正确
2. 确认 API Key 有访问对应模型的权限
3. 检查 API Key 是否已过期

### 数据库错误

**问题**: 后端启动时数据库错误

**解决**:
1. 确保 `backend/data/` 目录存在且可写
2. 删除 `backend/data/double_agent.db` 重新初始化
3. 检查 SQLite 版本兼容性

## 下一步

- 阅读 [架构总览](/docs-new/architecture/overview.md) 了解系统设计
- 查看 [三层配置系统](/docs-new/config/three-layer-config.md) 学习如何配置
- 了解 [Agent 系统](/docs-new/agents/overview.md) 深入工作原理
