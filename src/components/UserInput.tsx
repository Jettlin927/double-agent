import { useState, type KeyboardEvent } from 'react';
import { Send, Square, Zap } from 'lucide-react';

interface UserInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  onCompact?: () => void;
  isRunning: boolean;
  disabled?: boolean;
  contextPercent?: number;
  isCompacted?: boolean;
}

export function UserInput({
  onSend,
  onStop,
  onCompact,
  isRunning,
  disabled,
  contextPercent = 0,
  isCompacted = false,
}: UserInputProps) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;

    // 检查 /compact 命令
    if (trimmed === '/compact') {
      onCompact?.();
      setInput('');
      return;
    }

    onSend(trimmed);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 上下文使用情况颜色
  const getContextColor = () => {
    if (contextPercent >= 90) return 'text-red-500';
    if (contextPercent >= 70) return 'text-yellow-500';
    return 'text-gray-400';
  };

  return (
    <div className="bg-white border-t border-gray-200 p-4">
      <div className="max-w-6xl mx-auto">
        {/* 上下文使用指示器 - 仅在前端管理上下文时显示 */}
        {contextPercent > 0 && (
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400">上下文使用:</span>
              <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    contextPercent >= 90 ? 'bg-red-500' :
                    contextPercent >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(contextPercent, 100)}%` }}
                />
              </div>
              <span className={getContextColor()}>{contextPercent.toFixed(1)}%</span>
              {isCompacted && (
                <span className="text-blue-500 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  已压缩
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400">
              输入 /compact 手动压缩上下文
            </span>
          </div>
        )}

        <div className="relative flex items-end gap-2 bg-gray-50 border border-gray-300 rounded-2xl p-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? '请先配置Agent...' : '输入你的问题，两个Agent会开始辩论...'}
            disabled={disabled || isRunning}
            rows={1}
            className="flex-1 bg-transparent border-none resize-none px-3 py-2.5 text-gray-800 placeholder-gray-400 focus:outline-none min-h-[44px] max-h-[120px]"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
            }}
          />

          {isRunning ? (
            <button
              onClick={onStop}
              className="flex items-center justify-center w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors"
              title="停止"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || disabled}
              className="flex items-center justify-center w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
              title="发送"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-2 text-center">
          {isRunning
            ? 'Agent正在辩论中...'
            : disabled
            ? '点击右上角设置按钮配置Agent'
            : '按 Enter 发送，Shift + Enter 换行'}
        </p>
      </div>
    </div>
  );
}
