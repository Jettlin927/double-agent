/**
 * ProviderConfigPanel - Provider 管理 UI
 * 显示所有 Provider 的卡片列表，支持添加、编辑、删除
 */

import { useState, useEffect, useMemo } from 'react';
import { Pencil, Trash2, Plus, Server } from 'lucide-react';
import type { ProviderConfig } from '../../config/types';
import { configManager } from '../../config/ConfigManager';

interface ProviderConfigPanelProps {
  onEditProvider: (provider: ProviderConfig) => void;
  onAddProvider: () => void;
}

export function ProviderConfigPanel({
  onEditProvider,
  onAddProvider,
}: ProviderConfigPanelProps) {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [modelProfiles, setModelProfiles] = useState<
    { providerId: string }[]
  >([]);

  // 加载数据并订阅变化
  useEffect(() => {
    const loadData = () => {
      setProviders(configManager.getProviders());
      setModelProfiles(configManager.getModelProfiles());
    };

    loadData();
    const unsubscribe = configManager.subscribe(loadData);
    return unsubscribe;
  }, []);

  // 检查 provider 是否被 model 引用
  const getProviderUsage = useMemo(() => {
    const usage = new Map<string, number>();
    modelProfiles.forEach(model => {
      const count = usage.get(model.providerId) || 0;
      usage.set(model.providerId, count + 1);
    });
    return usage;
  }, [modelProfiles]);

  // 删除 provider
  const handleDelete = (provider: ProviderConfig) => {
    const usageCount = getProviderUsage.get(provider.id) || 0;
    if (usageCount > 0) {
      return; // 有引用时不允许删除
    }

    if (confirm(`确定要删除 Provider "${provider.name}" 吗？`)) {
      configManager.removeProvider(provider.id);
    }
  };

  // 获取 API 类型显示标签
  const getApiTypeLabel = (apiType: string) => {
    const labels: Record<string, string> = {
      openai: 'OpenAI',
      anthropic: 'Anthropic',
    };
    return labels[apiType] || apiType;
  };

  // 获取 API 类型样式
  const getApiTypeStyle = (apiType: string) => {
    const styles: Record<string, string> = {
      openai: 'bg-green-100 text-green-700',
      anthropic: 'bg-orange-100 text-orange-700',
    };
    return (
      styles[apiType] || 'bg-gray-100 text-gray-700'
    );
  };

  return (
    <div className="space-y-4">
      {/* 头部工具栏 */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Provider 配置
        </h2>
        <button
          onClick={onAddProvider}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          添加 Provider
        </button>
      </div>

      {/* Provider 卡片网格 */}
      {providers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
          <Server className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">暂无 Provider 配置</p>
          <button
            onClick={onAddProvider}
            className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
          >
            添加第一个 Provider
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {providers.map(provider => {
            const usageCount = getProviderUsage.get(provider.id) || 0;
            const hasModels = usageCount > 0;

            return (
              <div
                key={provider.id}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* 名称和类型标签 */}
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {provider.name}
                      </h3>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${getApiTypeStyle(
                          provider.apiType
                        )}`}
                      >
                        {getApiTypeLabel(provider.apiType)}
                      </span>
                    </div>

                    {/* Base URL */}
                    <p className="text-sm text-gray-500 truncate mb-2">
                      {provider.baseURL}
                    </p>

                    {/* 模型数量 */}
                    <p className="text-sm text-gray-600">
                      模型: {provider.supportedModels.length}个
                      {hasModels && (
                        <span className="ml-2 text-amber-600">
                          (使用中: {usageCount}个)
                        </span>
                      )}
                    </p>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => onEditProvider(provider)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="编辑"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(provider)}
                      disabled={hasModels}
                      className={`p-2 rounded-lg transition-colors ${
                        hasModels
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                      }`}
                      title={
                        hasModels ? '有 Model 在使用' : '删除'
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 禁用提示 */}
                {hasModels && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs text-amber-600">
                      有 Model 在使用此 Provider，无法删除
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
