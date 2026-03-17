name: check
description: 使用 subagent 并行对前端(React+TypeScript)和后端(Python+FastAPI)进行类型检查和冒烟测试

---

## 使用方式

直接运行 `/check` 即可，默认使用 **subagent 并行检查**：

```
/check
```

这会同时启动两个 subagent：
- **check-frontend**: 检查前端 React + TypeScript
- **check-backend**: 检查后端 Python + FastAPI

## 执行流程

```
启动 check-frontend subagent ──┐
                               ├──► 等待两个 subagent 完成
启动 check-backend subagent  ──┘
```

## Subagent 任务详情

### check-frontend (前端检查)

**类型**: general-purpose

**任务描述**:
对前端 React + TypeScript 项目进行检查：

1. **TypeScript 类型检查**: `npx tsc -b --noEmit`
2. **ESLint 代码规范**: `npm run lint`
3. **生产构建测试**: `npm run build`

**工作目录**: `/Users/xtzn/Desktop/double-agent`

**输出要求**:
- 每个步骤的执行结果（成功/失败）
- 如果有错误，显示前 10 行错误信息
- 最后给出总结：通过 ✅ 或 失败 ❌

### check-backend (后端检查)

**类型**: general-purpose

**任务描述**:
对后端 Python + FastAPI 项目进行检查：

1. **Python 语法检查**: 使用 `ast.parse` 遍历所有 `.py` 文件
2. **类型检查**: `python3 -m mypy app/ --ignore-missing-imports`（如果 mypy 已安装）
3. **代码规范**: `python3 -m ruff check app/`（如果 ruff 已安装，否则尝试 flake8）
4. **单元测试**: `python3 -m pytest tests/ -v`

**工作目录**: `/Users/xtzn/Desktop/double-agent/backend`

**输出要求**:
- 每个步骤的执行结果（成功/失败/跳过）
- 如果有错误，显示前 10 行错误信息
- 最后给出总结：通过 ✅ 或 失败 ❌

## 完整检查命令参考

### 前端

```bash
cd /Users/xtzn/Desktop/double-agent

# TypeScript 类型检查
npx tsc -b --noEmit

# ESLint 检查
npm run lint

# 生产构建测试
npm run build
```

### 后端

```bash
cd /Users/xtzn/Desktop/double-agent/backend

# Python 语法检查
python3 -c "
import ast
import sys
from pathlib import Path

errors = []
for py_file in Path('app').rglob('*.py'):
    try:
        ast.parse(py_file.read_text())
    except SyntaxError as e:
        errors.append(f'{py_file}: {e}')

if errors:
    print('语法错误:')
    for e in errors:
        print(f'  {e}')
    sys.exit(1)
else:
    print('✓ 所有 Python 文件语法正确')
"

# 类型检查 (如果安装了 mypy)
python3 -m mypy app/ --ignore-missing-imports

# 代码规范检查 (如果安装了 ruff 或 flake8)
python3 -m ruff check app/
# 或: python3 -m flake8 app/ --max-line-length=120 --extend-ignore=E203,W503

# 单元测试
python3 -m pytest tests/ -v
```

## 输出解读

| 检查项 | 失败原因 | 解决方案 |
|--------|----------|----------|
| tsc | TypeScript 类型错误 | 修复类型定义或添加类型注解 |
| lint | ESLint 规范问题 | `npm run lint -- --fix` |
| build | Vite 构建错误 | 检查导入路径和配置文件 |
| Python 语法 | 语法错误 | 检查 Python 代码语法 |
| mypy | Python 类型错误 | 添加类型注解或修复类型不匹配 |
| ruff | Python 代码规范 | `ruff check --fix app/` |
| pytest | 单元测试失败 | 检查测试用例和被测代码 |

## 安装后端检查工具

如果后端检查工具未安装：

```bash
cd /Users/xtzn/Desktop/double-agent/backend
pip install mypy ruff pytest httpx
```

## 可选配置

添加 `backend/pyproject.toml`:

```toml
[tool.mypy]
python_version = "3.10"
warn_return_any = true
warn_unused_configs = true
ignore_missing_imports = true

[tool.ruff]
line-length = 120
select = ["E", "F", "W", "I", "N", "UP", "B", "C4"]
ignore = ["D100", "D104"]

[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
```

## 检查结果处理

检查完成后：

- **如果所有检查通过** ✅ → 任务结束，代码质量良好
- **如果发现问题** ❌ → **自动启用 `/fix` skill** 进行修复

```
/check 完成
    ├─ ✅ 全部通过 → 结束
    └─ ❌ 发现问题 → 自动运行 /fix → 压缩上下文 → Agent 修复 → 验证
```

无需手动干预，`/check` 会自动判断并触发修复流程。
