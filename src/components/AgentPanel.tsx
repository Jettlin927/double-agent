import { useEffect, useRef } from 'react';
import { User, Bot, Sparkles } from 'lucide-react';
import type { AgentConfig, StreamChunk } from '../types';

interface AgentPanelProps {
  config: AgentConfig;
  stream: StreamChunk | null;
  isRunning: boolean;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  side: 'left' | 'right';
}

export function AgentPanel({ config, stream, isRunning, messages, side }: AgentPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isGentle = config.personality === 'gentle';

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [stream?.content, messages.length]);

  const bgGradient = isGentle
    ? 'from-amber-50/80 to-orange-50/50'
    : 'from-rose-50/80 to-red-50/50';

  const headerBg = isGentle
    ? 'bg-gradient-to-r from-amber-100/80 to-orange-100/60'
    : 'bg-gradient-to-r from-rose-100/80 to-red-100/60';

  const accentColor = isGentle ? 'text-amber-600' : 'text-rose-600';
  const borderColor = isGentle ? 'border-amber-200' : 'border-rose-200';
  const bubbleBg = isGentle ? 'bg-amber-100/70' : 'bg-rose-100/70';

  return (
    <div className={`flex flex-col h-full bg-gradient-to-br ${bgGradient} relative overflow-hidden`}>
      {/* Header */}
      <div className={`${headerBg} border-b ${borderColor} px-4 py-3 flex items-center gap-3`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${bubbleBg}`}>
          {isGentle ? (
            <Sparkles className={`w-5 h-5 ${accentColor}`} />
          ) : (
            <Bot className={`w-5 h-5 ${accentColor}`} />
          )}
        </div>
        <div>
          <h3 className={`font-semibold ${accentColor}`}>{config.name}</h3>
          <p className="text-xs text-gray-500">
            {isRunning ? '思考中...' : stream?.done ? '完成' : '等待中'}
          </p>
        </div>
        {isRunning && (
          <div className={`ml-auto flex gap-1 ${accentColor}`}>
            <span className="animate-pulse">●</span>
            <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>●</span>
            <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>●</span>
          </div>
        )}
      </div>

      {/* Chat Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !stream && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Bot className="w-12 h-12 mb-2 opacity-30" />
            <p className="text-sm">等待对话开始...</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''} animate-fade-in`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.role === 'user' ? 'bg-gray-200' : bubbleBg
              }`}
            >
              {message.role === 'user' ? (
                <User className="w-4 h-4 text-gray-600" />
              ) : (
                <Bot className={`w-4 h-4 ${accentColor}`} />
              )}
            </div>
            <div
              className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed ${
                message.role === 'user'
                  ? 'bg-gray-800 text-white rounded-tr-sm'
                  : `${bubbleBg} text-gray-800 rounded-tl-sm`
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}

        {/* Streaming content */}
        {stream && stream.content && (
          <div className="flex gap-3 animate-fade-in">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${bubbleBg}`}
            >
              <Bot className={`w-4 h-4 ${accentColor}`} />
            </div>
            <div
              className={`max-w-[80%] p-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed ${bubbleBg} text-gray-800`}
            >
              {stream.content}
              {isRunning && (
                <span className="inline-block w-1.5 h-4 ml-0.5 bg-current animate-pulse" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Decorative side indicator */}
      <div
        className={`absolute top-1/2 ${side === 'left' ? '-left-1' : '-right-1'} w-1 h-20 rounded-full opacity-50 ${
          isGentle ? 'bg-amber-400' : 'bg-rose-400'
        }`}
        style={{ transform: 'translateY(-50%)' }}
      />
    </div>
  );
}
