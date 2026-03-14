import { useState, KeyboardEvent } from 'react';
import { Send, Square } from 'lucide-react';

interface UserInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isRunning: boolean;
  disabled?: boolean;
}

export function UserInput({ onSend, onStop, isRunning, disabled }: UserInputProps) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white border-t border-gray-200 p-4">
      <div className="max-w-6xl mx-auto">
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
