import { Settings, MessageSquare } from 'lucide-react';

interface HeaderProps {
  onOpenConfig: () => void;
}

export function Header({ onOpenConfig }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">双Agent对话系统</h1>
            <p className="text-xs text-gray-500">温和 vs 暴躁 · 辩论协作</p>
          </div>
        </div>

        <button
          onClick={onOpenConfig}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <Settings className="w-4 h-4" />
          配置
        </button>
      </div>
    </header>
  );
}
