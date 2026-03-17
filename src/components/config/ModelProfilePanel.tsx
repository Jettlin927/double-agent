/**
 * ModelProfilePanel - Model 管理 UI 组件
 * 显示所有 Model Profile 的卡片列表，支持筛选、编辑和删除
 */

import { useState, useEffect, useMemo } from 'react';
import type { ModelProfile } from '../../config/types';
import { configManager } from '../../config/ConfigManager';
import { Pencil, Trash2, Plus, Wrench, Brain } from 'lucide-react';

interface ModelProfilePanelProps {
  onEditModel: (model: ModelProfile) => void;
  onAddModel: () => void;
}

export function ModelProfilePanel({ onEditModel, onAddModel }: ModelProfilePanelProps) {
  const [models, setModels] = useState<ModelProfile[]>([]);
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([]);
  const [agents, setAgents] = useState<{ modelProfileId: string }[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('all');

  // 加载数据并订阅变化
  useEffect(() => {
    const loadData = () => {
      setModels(configManager.getModelProfiles());
      setProviders(configManager.getProviders().map(p => ({ id: p.id, name: p.name })));
      setAgents(configManager.getAgentProfiles().map(a => ({ modelProfileId: a.modelProfileId })));
    };

    loadData();
    const unsubscribe = configManager.subscribe(loadData);
    return unsubscribe;
  }, []);

  // 筛选后的 models
  const filteredModels = useMemo(() => {
    if (selectedProvider === 'all') return models;
    return models.filter(m => m.providerId === selectedProvider);
  }, [models, selectedProvider]);

  // 获取 provider 名称
  const getProviderName = (providerId: string): string => {
    const provider = providers.find(p => p.id === providerId);
    return provider?.name || providerId;
  };

  // 检查 model 是否被 agent 引用
  const isModelInUse = (modelId: string): boolean => {
    return agents.some(a => a.modelProfileId === modelId);
  };

  // 格式化上下文窗口显示
  const formatContextWindow = (contextWindow?: number): string => {
    if (!contextWindow) return '-';
    if (contextWindow >= 1000) {
      return `${(contextWindow / 1000).toFixed(0)}K`;
    }
    return contextWindow.toString();
  };

  // 处理删除
  const handleDelete = (model: ModelProfile) => {
    if (isModelInUse(model.id)) return;
    if (confirm(`确定要删除 Model "${model.name}" 吗？`)) {
      configManager.removeModelProfile(model.id);
    }
  };

  return (
    <div className="space-y-4">
      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        {/* Provider 筛选 */}
        <div className="flex items-center gap-2">
          <label htmlFor="provider-filter" className="text-sm text-gray-600">
            筛选:
          </label>
          <select
            id="provider-filter"
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部 Provider</option>
            {providers.map(provider => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </div>

        {/* 添加按钮 */}
        <button
          onClick={onAddModel}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          添加 Model
        </button>
      </div>

      {/* Model 列表 */}
      <div className="space-y-3">
        {filteredModels.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {selectedProvider === 'all'
              ? '暂无 Model 配置，点击上方按钮添加'
              : '该 Provider 下暂无 Model 配置'}
          </div>
        ) : (
          filteredModels.map(model => {
            const inUse = isModelInUse(model.id);
            return (
              <div
                key={model.id}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                {/* 头部：名称 + 操作按钮 */}
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{model.name}</h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEditModel(model)}
                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="编辑"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(model)}
                      disabled={inUse}
                      className={`p-1.5 rounded-lg transition-colors ${
                        inUse
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                      }`}
                      title={inUse ? '有 Agent 在使用' : '删除'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Provider 信息 */}
                <div className="text-sm text-gray-600 mb-1">
                  Provider: {getProviderName(model.providerId)}
                </div>

                {/* 实际模型名 */}
                <div className="font-mono text-xs text-gray-400 mb-3">
                  {model.modelName}
                </div>

                {/* 参数行 */}
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                  <span>温度: {model.temperature}</span>
                  <span className="text-gray-300">|</span>
                  <span>上下文: {formatContextWindow(model.contextWindow)}</span>
                  {model.maxTokens && (
                    <>
                      <span className="text-gray-300">|</span>
                      <span>Max Tokens: {model.maxTokens}</span>
                    </>
                  )}
                </div>

                {/* 功能标签 */}
                <div className="flex items-center gap-2">
                  {model.supportsTools && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">
                      <Wrench className="w-3 h-3" />
                      支持 Tools
                    </span>
                  )}
                  {model.supportsReasoning && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                      <Brain className="w-3 h-3" />
                      支持 Reasoning
                    </span>
                  )}
                  {inUse && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs">
                      有 Agent 在使用
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
