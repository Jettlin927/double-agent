import { useState } from 'react';
import { Plus, Trash2, MessageSquare, Clock, Download, Upload, X } from 'lucide-react';
import type { DebateSession } from '../types';
import { debateStorage } from '../stores/debateStorage';

interface SidebarProps {
  sessions: DebateSession[];
  currentSession: DebateSession | null;
  onNewSession: () => void;
  onLoadSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({
  sessions,
  currentSession,
  onNewSession,
  onLoadSession,
  onDeleteSession,
  isOpen,
  onClose,
}: SidebarProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const handleExport = (session: DebateSession) => {
    const jsonl = debateStorage.exportToJSONL(session.id);
    const blob = new Blob([jsonl], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debate-${session.title.slice(0, 30).replace(/\s+/g, '-')}.jsonl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportAll = () => {
    const jsonl = debateStorage.exportAllToJSONL();
    const blob = new Blob([jsonl], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all-debates-${new Date().toISOString().split('T')[0]}.jsonl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const session = debateStorage.importFromJSONL(content);
        if (session) {
          onLoadSession(session.id);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">对话历史</h2>
            <button
              onClick={onClose}
              className="lg:hidden p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={onNewSession}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            新对话
          </button>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">暂无历史对话</p>
              <p className="text-xs mt-1">点击"新对话"开始</p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
                  currentSession?.id === session.id
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => onLoadSession(session.id)}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      currentSession?.id === session.id
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {session.title || '未命名对话'}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      {formatDate(session.updatedAt)}
                      <span className="text-gray-300">|</span>
                      {session.rounds.length} 轮
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExport(session);
                    }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="导出 JSONL"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(session.id);
                    }}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="删除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Delete confirmation */}
                {showDeleteConfirm === session.id && (
                  <div
                    className="absolute inset-0 bg-white/95 rounded-xl flex items-center justify-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => onDeleteSession(session.id)}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg"
                    >
                      确认删除
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(null)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
                    >
                      取消
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer - Import/Export All */}
        <div className="p-4 border-t border-gray-200 space-y-2">
          <label className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors">
            <Upload className="w-4 h-4" />
            导入 JSONL
            <input
              type="file"
              accept=".jsonl,.json"
              onChange={handleImport}
              className="hidden"
            />
          </label>
          {sessions.length > 0 && (
            <button
              onClick={handleExportAll}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              导出全部
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
