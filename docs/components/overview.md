# 组件总览

Double Agent 的 UI 由 React 组件构建，采用功能组件 + Hooks 的现代 React 模式。

## 组件清单

### 核心组件 (根级)

| 组件 | 文件 | 功能 |
|------|------|------|
| AgentPanel | AgentPanel.tsx | Agent 对话面板，显示消息流 |
| Header | Header.tsx | 顶部导航栏 |
| Sidebar | Sidebar.tsx | 侧边栏，会话历史管理 |
| UserInput | UserInput.tsx | 用户输入区域 |
| ConfigModal | ConfigModal.tsx | 配置管理模态框（三层配置入口） |

### 配置组件 (config/)

| 组件 | 文件 | 功能 |
|------|------|------|
| ProviderConfigPanel | ProviderConfigPanel.tsx | Provider 列表管理 |
| ProviderForm | ProviderForm.tsx | Provider 添加/编辑表单 |
| ModelProfilePanel | ModelProfilePanel.tsx | Model 列表管理 |
| ModelForm | ModelForm.tsx | Model 添加/编辑表单 |
| ModelProfileSelect | ModelProfileSelect.tsx | 模型选择下拉框（按 Provider 分组） |
| AgentProfilePanel | AgentProfilePanel.tsx | Agent 列表管理 |
| AgentForm | AgentForm.tsx | Agent 添加/编辑表单 |

## 组件详细说明

### AgentPanel

**职责**: 展示单个 Agent 的对话界面

**Props**:
```typescript
interface AgentPanelProps {
  config: AgentConfig;              // Agent 配置
  stream: StreamChunk | null;       // 流式响应数据
  isRunning: boolean;               // 是否正在运行
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  side: 'left' | 'right';           // 面板位置
}
```

**特性**:
- 根据 `personality`（gentle/angry）动态切换配色方案
  - 温和派：amber（琥珀色）系
  - 暴躁派：rose（玫瑰色）系
- 自动滚动到底部（`useRef` + `useEffect`）
- 区分用户消息（深色气泡）和 Agent 消息（浅色气泡）

### Header

**职责**: 顶部导航栏

**Props**:
```typescript
interface HeaderProps {
  onOpenConfig: () => void;      // 打开配置
  onToggleSidebar: () => void;   // 切换侧边栏（移动端）
}
```

**特性**:
- 响应式设计，移动端显示菜单按钮
- 应用 Logo 和标题

### Sidebar

**职责**: 会话历史侧边栏

**Props**:
```typescript
interface SidebarProps {
  sessions: DebateSession[];            // 会话列表
  currentSession: DebateSession | null; // 当前会话
  mode: AgentMode;                       // 当前模式
  onNewSession: () => void;              // 新建会话
  onLoadSession: (id: string) => void;   // 加载会话
  onDeleteSession: (id: string) => void; // 删除会话
  onModeChange: (mode: AgentMode) => void;
  isOpen: boolean;                       // 是否展开（移动端）
  onClose: () => void;
}
```

**功能**:
- 单/双 Agent 模式切换按钮
- 会话列表显示
- 会话导入/导出（JSONL 格式）
- 删除确认交互

### UserInput

**职责**: 用户输入组件

**Props**:
```typescript
interface UserInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  onCompact?: () => void;      // 压缩上下文
  isRunning: boolean;
  disabled?: boolean;
  contextPercent?: number;     // 上下文使用率
  isCompacted?: boolean;
}
```

**特性**:
- 支持 `/compact` 命令手动压缩上下文
- 上下文使用率可视化（进度条 + 颜色警示）
- Enter 发送，Shift+Enter 换行

### ConfigModal

**职责**: 配置管理主模态框（三层配置系统入口）

**Props**:
```typescript
interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  gentleConfig: AgentConfig;
  angryConfig: AgentConfig;
  onUpdateGentle: (updates: Partial<AgentConfig>) => void;
  onUpdateAngry: (updates: Partial<AgentConfig>) => void;
}
```

**内部状态**:
```typescript
activeTab: 'agents' | 'providers' | 'models' | 'quick'
activeQuickTab: 'gentle' | 'angry'
showProviderForm: boolean
showModelForm: boolean
showAgentForm: boolean
editingProvider?: ProviderConfig
editingModel?: ModelProfile
editingAgent?: AgentProfile
saveStatus: 'idle' | 'saving' | 'success' | 'error'
```

**子组件**:
- `RoleCard` - 角色选择卡片
- `ModelPresetCard` - 模型预设卡片
- `ConfigForm` - 快速配置表单（兼容旧版）

## 组件层次结构

```
App
├── Header
│   └── [按钮] 打开 ConfigModal
├── Sidebar
│   ├── 新对话按钮
│   ├── 模式切换按钮
│   └── 会话列表项
├── Main Content
│   ├── AgentPanel (left)  - 温和 Agent
│   └── AgentPanel (right) - 暴躁 Agent (双 Agent 模式)
└── UserInput

ConfigModal (模态框)
├── Tab 导航: agents | providers | models | quick
├── agents Tab
│   └── AgentProfilePanel
│       ├── Agent 卡片网格
│       └── 右键菜单 (设置默认)
├── providers Tab
│   └── ProviderConfigPanel
│       └── Provider 卡片列表
├── models Tab
│   └── ModelProfilePanel
│       └── Model 卡片列表
└── quick Tab
    ├── 子 Tab: gentle | angry
    └── ConfigForm (旧版兼容)

表单组件（由 Panel 触发）:
├── ProviderForm
├── ModelForm
└── AgentForm
    └── ModelProfileSelect
```

## 配置状态管理

组件通过 `ConfigManager` 单例管理配置状态：

```typescript
import { configManager, useConfigManager } from '@/config/ConfigManager';

// 方式 1: 直接读取
const providers = configManager.getProviders();

// 方式 2: 使用订阅（React 组件中）
function MyComponent() {
  useEffect(() => {
    const unsubscribe = configManager.subscribe(() => {
      // 配置变化时重新渲染
      setProviders(configManager.getProviders());
    });
    return unsubscribe;
  }, []);
}

// 方式 3: useSyncExternalStore
const config = useSyncExternalStore(
  (callback) => configManager.subscribe(callback),
  () => configManager.getConfig()
);
```

## 表单验证模式

所有表单组件遵循统一的验证模式：

### 字段级验证
```typescript
const handleChange = (field: string, value: string) => {
  setForm(prev => ({ ...prev, [field]: value }));

  // 实时验证
  const error = validateField(field, value);
  setErrors(prev => ({ ...prev, [field]: error }));
};
```

### 表单级验证
```typescript
const handleSave = () => {
  // 全量验证
  const newErrors: Record<string, string> = {};
  Object.keys(form).forEach(key => {
    const error = validateField(key, form[key]);
    if (error) newErrors[key] = error;
  });

  if (Object.keys(newErrors).length > 0) {
    setErrors(newErrors);
    return;
  }

  // 保存
  onSave(form);
};
```

### 视觉反馈
- 错误字段：红色边框
- 错误文本：红色提示
- 成功状态：绿色提示

## 样式系统

### 配色方案

| 场景 | 颜色 |
|------|------|
| 温和 Agent | amber（琥珀色）系 |
| 暴躁 Agent | rose（玫瑰色）系 |
| 单 Agent 模式 | blue（蓝色）系 |
| 辩论模式 | purple（紫色）系 |

### Tailwind 类名示例

```tsx
// 温和 Agent 面板
<div className="bg-amber-50 border-amber-200">
  <h3 className="text-amber-600">温和助手</h3>
</div>

// 暴躁 Agent 面板
<div className="bg-rose-50 border-rose-200">
  <h3 className="text-rose-600">暴躁评论家</h3>
</div>
```

### 响应式断点

- 移动端：`lg:hidden`, 侧边栏可折叠
- 桌面端：`lg:static`, 侧边栏常驻

### 动画

- `animate-fade-in` - 消息淡入
- `animate-pulse` - 打字指示器
- `transition-all` - 状态变化过渡

## 相关文件

| 文件 | 说明 |
|------|------|
| `App.tsx` | 根组件 |
| `components/AgentPanel.tsx` | Agent 对话面板 |
| `components/Sidebar.tsx` | 侧边栏 |
| `components/UserInput.tsx` | 用户输入 |
| `components/ConfigModal.tsx` | 配置模态框 |
| `config/ConfigManager.ts` | 配置状态管理 |
