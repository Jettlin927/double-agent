/**
 * ModelProfileSelect - 按 Provider 分组的模型选择器
 */

import { useState, useEffect, useMemo } from 'react';
import { configManager } from '../../config/ConfigManager';
import type { ModelProfile, ProviderConfig } from '../../config/types';

interface ModelProfileSelectProps {
  value: string; // 选中的 modelProfileId
  onChange: (modelProfileId: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * 格式化上下文窗口大小
 * 例如: 128000 -> "128K"
 */
function formatContext(contextWindow: number | undefined): string {
  if (!contextWindow) return '未知';
  if (contextWindow >= 1000) {
    return `${Math.round(contextWindow / 1000)}K`;
  }
  return contextWindow.toString();
}

export function ModelProfileSelect({
  value,
  onChange,
  disabled = false,
  className = '',
}: ModelProfileSelectProps) {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [models, setModels] = useState<ModelProfile[]>([]);

  // 加载配置数据
  useEffect(() => {
    const loadData = () => {
      setProviders(configManager.getProviders());
      setModels(configManager.getModelProfiles());
    };

    loadData();

    // 订阅配置变化
    const unsubscribe = configManager.subscribe(loadData);
    return unsubscribe;
  }, []);

  // 按 Provider 分组模型
  const modelsByProvider = useMemo(() => {
    const grouped: Record<string, ModelProfile[]> = {};
    models.forEach(model => {
      if (!grouped[model.providerId]) {
        grouped[model.providerId] = [];
      }
      grouped[model.providerId].push(model);
    });
    return grouped;
  }, [models]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={disabled}
      className={`
        w-full px-3 py-2
        border border-gray-300 rounded-lg
        focus:ring-2 focus:ring-blue-500 focus:border-blue-500
        disabled:bg-gray-100 disabled:text-gray-500
        ${className}
      `}
    >
      <option value="">请选择模型...</option>
      {providers.map(provider => (
        <optgroup key={provider.id} label={provider.name}>
          {modelsByProvider[provider.id]?.map(model => (
            <option key={model.id} value={model.id}>
              {model.name} (温度: {model.temperature}, 上下文: {formatContext(model.contextWindow)})
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
