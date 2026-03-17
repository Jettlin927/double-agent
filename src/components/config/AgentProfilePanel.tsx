import { useState, useEffect, useSyncExternalStore } from 'react';
import { Plus, Sparkles, Zap, Trash2, User, Bot } from 'lucide-react';
import type { AgentProfile } from '../../config/types';
import { configManager } from '../../config/ConfigManager';
import { getRoleById } from '../../prompts/roles';

interface AgentProfilePanelProps {
  onEditAgent: (agent: AgentProfile) => void;
  onAddAgent: () => void;
}

// 使用 useSyncExternalStore 订阅配置变化
function useConfigData() {
  return useSyncExternalStore(
    (callback) => configManager.subscribe(callback),
    () => configManager.getConfig()
  );
}

export function AgentProfilePanel({ onEditAgent, onAddAgent }: AgentProfilePanelProps) {
  const config = useConfigData();
  const [contextMenu, setContextMenu] = useState<{
    agent: AgentProfile;
    x: number;
    y: number;
  } | null>(null);

  // 构建 model id -> name 的映射
  const models = new Map<string, string>();
  config.modelProfiles.forEach((model) => {
    models.set(model.id, model.name);
  });

  // 获取角色信息
  const getRoleInfo = (roleId: string) => {
    return getRoleById(roleId);
  };

  // 获取模型名称
  const getModelName = (modelProfileId: string) => {
    return models.get(modelProfileId) || modelProfileId;
  };

  // 判断是否为默认单 agent
  const isDefaultSingle = (agentId: string) => {
    return config.defaultSingleAgentId === agentId;
  };

  // 判断是否为辩论 agent，返回位置 (1, 2) 或 null
  const getDebatePosition = (agentId: string): number | null => {
    if (!config.defaultDebateAgentIds) return null;
    const index = config.defaultDebateAgentIds.indexOf(agentId);
    return index >= 0 ? index + 1 : null;
  };

  // 删除 agent
  const handleDelete = (agent: AgentProfile, e: React.MouseEvent) => {
    e.stopPropagation();

    const isDefault = isDefaultSingle(agent.id) || getDebatePosition(agent.id) !== null;

    if (isDefault) {
      const confirmed = window.confirm(
        `警告：${agent.name} 是默认 Agent，删除后需要重新设置默认配置。确定要删除吗？`
      );
      if (!confirmed) return;
    }

    configManager.removeAgentProfile(agent.id);
  };

  // 处理右键菜单
  const handleContextMenu = (agent: AgentProfile, e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      agent,
      x: e.clientX,
      y: e.clientY,
    });
  };

  // 关闭右键菜单
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  // 设为默认单 agent
  const handleSetDefaultSingle = (agentId: string) => {
    configManager.setDefaultSingleAgent(agentId);
    setContextMenu(null);
  };

  // 设为辩论 agent
  const handleSetDebateAgent = (agentId: string, position: 1 | 2) => {
    const currentIds = config.defaultDebateAgentIds || ['', ''];
    const newIds: [string, string] = [
      position === 1 ? agentId : currentIds[0] || agentId,
      position === 2 ? agentId : currentIds[1] || agentId,
    ];
    configManager.setDefaultDebateAgents(newIds);
    setContextMenu(null);
  };

  return (
    <div className="space-y-4">
      {/* Agent 卡片网格 */}
      <div className="grid grid-cols-2 gap-4">
        {config.agentProfiles.map((agent) => {
          const role = getRoleInfo(agent.roleId);
          const isGentle = role?.personality === 'gentle';
          const isAngry = role?.personality === 'angry';
          const defaultSingle = isDefaultSingle(agent.id);
          const debatePos = getDebatePosition(agent.id);

          return (
            <div
              key={agent.id}
              onClick={() => onEditAgent(agent)}
              onContextMenu={(e) => handleContextMenu(agent, e)}
              className={`relative group cursor-pointer rounded-xl border-2 p-4 transition-all hover:shadow-md ${
                isGentle
                  ? 'border-amber-200 bg-amber-50 hover:border-amber-300'
                  : isAngry
                    ? 'border-rose-200 bg-rose-50 hover:border-rose-300'
                    : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              {/* 删除按钮 */}
              <button
                onClick={(e) => handleDelete(agent, e)}
                className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                title="删除 Agent"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* 角色图标 */}
              <div className="flex items-center gap-2 mb-3">
                <div
                  className={`p-2 rounded-lg ${
                    isGentle
                      ? 'bg-amber-100 text-amber-600'
                      : isAngry
                        ? 'bg-rose-100 text-rose-600'
                        : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {isGentle ? <Sparkles className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{agent.name}</h3>
                </div>
              </div>

              {/* 模型和角色信息 */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Bot className="w-4 h-4 text-gray-400" />
                  <span className="truncate">{getModelName(agent.modelProfileId)}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="truncate">{role?.name || agent.roleId}</span>
                </div>
              </div>

              {/* 默认标签 */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {defaultSingle && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    默认单 Agent
                  </span>
                )}
                {debatePos && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                    辩论 Agent {debatePos}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* 新建 Agent 按钮 */}
        <button
          onClick={onAddAgent}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 hover:border-gray-400 bg-gray-50/50 hover:bg-gray-50 p-4 transition-all min-h-[140px]"
        >
          <div className="p-2 rounded-lg bg-gray-100 text-gray-400">
            <Plus className="w-6 h-6" />
          </div>
          <span className="text-sm font-medium text-gray-600">新建 Agent</span>
        </button>
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[180px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div className="px-3 py-2 border-b border-gray-100">
            <span className="text-xs font-medium text-gray-500">设为默认</span>
          </div>
          <button
            onClick={() => handleSetDefaultSingle(contextMenu.agent.id)}
            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
              isDefaultSingle(contextMenu.agent.id) ? 'text-blue-600 bg-blue-50' : 'text-gray-700'
            }`}
          >
            {isDefaultSingle(contextMenu.agent.id) && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            )}
            单 Agent 模式
          </button>
          <div className="border-t border-gray-100 my-1" />
          <button
            onClick={() => handleSetDebateAgent(contextMenu.agent.id, 1)}
            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
              getDebatePosition(contextMenu.agent.id) === 1
                ? 'text-purple-600 bg-purple-50'
                : 'text-gray-700'
            }`}
          >
            {getDebatePosition(contextMenu.agent.id) === 1 && (
              <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
            )}
            辩论 Agent 1
          </button>
          <button
            onClick={() => handleSetDebateAgent(contextMenu.agent.id, 2)}
            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${
              getDebatePosition(contextMenu.agent.id) === 2
                ? 'text-purple-600 bg-purple-50'
                : 'text-gray-700'
            }`}
          >
            {getDebatePosition(contextMenu.agent.id) === 2 && (
              <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
            )}
            辩论 Agent 2
          </button>
        </div>
      )}
    </div>
  );
}
