#!/usr/bin/env python3
"""
Double Agent 启动入口

一键启动前后端服务：
    python main.py

只启动后端：
    python main.py --backend-only

只启动前端：
    python main.py --frontend-only

指定后端端口：
    python main.py --port 8080

开发模式（热重载）：
    python main.py --reload
"""

import sys
import argparse
import subprocess
import os
import signal
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

# 项目根目录
PROJECT_ROOT = Path(__file__).parent
BACKEND_PATH = PROJECT_ROOT / "backend"
FRONTEND_PATH = PROJECT_ROOT


def check_backend_deps():
    """检查后端依赖是否已安装"""
    try:
        import uvicorn
        import fastapi
        import sqlalchemy
        return True
    except ImportError:
        return False


def check_frontend_deps():
    """检查前端依赖是否已安装"""
    return (PROJECT_ROOT / "node_modules").exists()


def run_backend(host: str, port: int, reload: bool = False):
    """运行后端服务器"""
    # 将 backend 目录添加到 Python 路径
    sys.path.insert(0, str(BACKEND_PATH))

    if not check_backend_deps():
        print("❌ 后端依赖未安装")
        print("   请先运行: cd backend && pip install -r requirements.txt")
        return 1

    try:
        import uvicorn
        from app.main import app

        print(f"🚀 启动后端服务器")
        print(f"   URL: http://{host}:{port}")
        print(f"   Docs: http://{host}:{port}/docs")
        print(f"   Reload: {'enabled' if reload else 'disabled'}")
        print()

        uvicorn.run(
            "app.main:app",
            host=host,
            port=port,
            reload=reload,
            log_level="info",
        )
        return 0
    except Exception as e:
        print(f"❌ 后端启动失败: {e}")
        return 1


def run_frontend():
    """运行前端开发服务器"""
    if not check_frontend_deps():
        print("❌ 前端依赖未安装")
        print("   请先运行: npm install")
        return 1

    try:
        print(f"🎨 启动前端开发服务器")
        print(f"   等待 Vite 启动...")
        print()

        # 使用 npm run dev 启动前端
        process = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=str(FRONTEND_PATH),
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            universal_newlines=True
        )

        # 实时输出前端日志
        for line in process.stdout:
            print(f"[Frontend] {line}", end='')

        process.wait()
        return process.returncode

    except FileNotFoundError:
        print("❌ 未找到 npm，请确保 Node.js 已安装")
        return 1
    except Exception as e:
        print(f"❌ 前端启动失败: {e}")
        return 1


def run_both(backend_host: str, backend_port: int, reload: bool = False):
    """同时启动前后端"""
    processes = []

    def signal_handler(signum, frame):
        print("\n\n🛑 正在关闭服务...")
        for p in processes:
            try:
                p.terminate()
                p.wait(timeout=5)
            except:
                try:
                    p.kill()
                except:
                    pass
        sys.exit(0)

    # 注册信号处理器
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    print("=" * 60)
    print("🚀 Double Agent 全栈启动")
    print("=" * 60)
    print()

    # 检查依赖
    backend_ready = check_backend_deps()
    frontend_ready = check_frontend_deps()

    if not backend_ready:
        print("⚠️  后端依赖未安装")
        print("   运行: cd backend && pip install -r requirements.txt")
        print()

    if not frontend_ready:
        print("⚠️  前端依赖未安装")
        print("   运行: npm install")
        print()

    if not backend_ready or not frontend_ready:
        return 1

    # 使用线程池同时启动
    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = {}

        # 启动后端
        backend_future = executor.submit(run_backend, backend_host, backend_port, reload)
        futures[backend_future] = "backend"

        # 等待几秒让后端先启动
        time.sleep(2)

        # 启动前端
        frontend_future = executor.submit(run_frontend)
        futures[frontend_future] = "frontend"

        print()
        print("=" * 60)
        print(f"✅ 服务启动完成!")
        print(f"   前端: http://localhost:5173")
        print(f"   后端: http://{backend_host}:{backend_port}")
        print(f"   API文档: http://{backend_host}:{backend_port}/docs")
        print("=" * 60)
        print()
        print("按 Ctrl+C 停止所有服务")
        print()

        # 等待任一服务结束
        for future in as_completed(futures):
            service = futures[future]
            try:
                result = future.result()
                if result != 0:
                    print(f"❌ {service} 异常退出")
                    return result
            except Exception as e:
                print(f"❌ {service} 发生错误: {e}")
                return 1

    return 0


def main():
    parser = argparse.ArgumentParser(
        description="Double Agent 启动工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python main.py                    # 启动前后端
  python main.py --backend-only     # 只启动后端
  python main.py --frontend-only    # 只启动前端
  python main.py --port 8080        # 指定后端端口
  python main.py --reload           # 开发模式（热重载）
        """
    )

    parser.add_argument("--host", default="0.0.0.0", help="后端绑定地址 (默认: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="后端端口 (默认: 8000)")
    parser.add_argument("--reload", action="store_true", help="启用热重载（开发模式）")
    parser.add_argument("--backend-only", action="store_true", help="只启动后端")
    parser.add_argument("--frontend-only", action="store_true", help="只启动前端")

    args = parser.parse_args()

    # 如果只启动前端
    if args.frontend_only:
        return run_frontend()

    # 如果只启动后端
    if args.backend_only:
        return run_backend(args.host, args.port, args.reload)

    # 同时启动前后端
    return run_both(args.host, args.port, args.reload)


if __name__ == "__main__":
    sys.exit(main())
