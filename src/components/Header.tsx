import { Settings, MessageSquare, Menu } from 'lucide-react';

interface HeaderProps {
  onOpenConfig: () => void;
  onToggleSidebar: () => void;
}

export function Header({ onOpenConfig, onToggleSidebar }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">双Agent对话系统</h1>
            <p className="text-xs text-gray-500">温和 vs 暴躁 · 辩论协作</p>
          </div>
        </div>

        <button
          onClick={onOpenConfig}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">配置</span>
        </button>
      </div>
    </header>
  );
}
