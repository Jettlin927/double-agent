/**
 * AgentForm - Agent 配置表单组件
 * 用于添加或编辑 Agent 配置
 */

import { useState, useEffect, useMemo } from 'react';
import { configManager } from '../../config/ConfigManager';
import { ModelProfileSelect } from './ModelProfileSelect';
import { getRolesByPersonality } from '../../prompts/roles';
import type { AgentProfile, ModelProfile, ProviderConfig } from '../../config/types';

interface AgentFormProps {
  agent?: AgentProfile; // 编辑时传入，添加时不传
  onSave: (agent: AgentProfile) => void;
  onCancel: () => void;
}

/**
 * 将名称转换为 ID 格式（小写 + 中划线）
 * 例如: "温和助手" -> "gentle-assistant"
 */
function generateIdFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // 移除非字母数字字符
    .replace(/\s+/g, '-') // 空格替换为中划线
    .replace(/-+/g, '-') // 多个中划线合并
    .replace(/^-|-$/g, ''); // 移除首尾中划线
}

/**
 * 验证表单数据
 */
function validateForm(formData: Partial<AgentProfile>): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!formData.name?.trim()) {
    errors.name = '显示名称不能为空';
  }

  if (!formData.roleId) {
    errors.roleId = '请选择角色';
  }

  if (!formData.modelProfileId) {
    errors.modelProfileId = '请选择模型';
  }

  if (formData.maxIterations !== undefined) {
    if (formData.maxIterations < 1 || formData.maxIterations > 50) {
      errors.maxIterations = '最大轮数必须在 1-50 之间';
    }
  }

  return errors;
}

export function AgentForm({ agent, onSave, onCancel }: AgentFormProps) {
  const isEditing = !!agent;

  // 表单状态
  const [formData, setFormData] = useState<Partial<AgentProfile>>(() => {
    // 初始化时根据 agent 设置初始值
    if (agent) {
      return {
        id: agent.id,
        name: agent.name,
        modelProfileId: agent.modelProfileId,
        roleId: agent.roleId,
        temperatureOverride: agent.temperatureOverride,
        maxIterations: agent.maxIterations ?? 10,
        enableTools: agent.enableTools,
        toolWhitelist: agent.toolWhitelist ?? [],
        enableStorage: agent.enableStorage,
      };
    }
    return {
      id: '',
      name: '',
      modelProfileId: '',
      roleId: '',
      temperatureOverride: undefined,
      maxIterations: 10,
      enableTools: true,
      toolWhitelist: [],
      enableStorage: true,
    };
  });

  // 本地状态
  const [enableTempOverride, setEnableTempOverride] = useState(() =>
    agent ? agent.temperatureOverride !== undefined : false
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [models, setModels] = useState<ModelProfile[]>(() => configManager.getModelProfiles());
  const [providers, setProviders] = useState<ProviderConfig[]>(() => configManager.getProviders());

  // 加载配置数据 - 使用 ref 避免在 effect 中直接 setState
  useEffect(() => {
    let isMounted = true;
    const unsubscribe = configManager.subscribe(() => {
      if (isMounted) {
        setModels(configManager.getModelProfiles());
        setProviders(configManager.getProviders());
      }
    });
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // 自动更新 ID（添加模式）- 使用 onChange 处理而非 effect
  const handleNameChange = (name: string) => {
    handleChange('name', name);
    if (!isEditing) {
      setFormData(prev => ({
        ...prev,
        name,
        id: generateIdFromName(name),
      }));
    }
  };

  // 获取选中的模型信息
  const selectedModel = useMemo(() => {
    return models.find(m => m.id === formData.modelProfileId);
  }, [models, formData.modelProfileId]);

  // 获取选中的 Provider 信息
  const selectedProvider = useMemo(() => {
    if (!selectedModel) return null;
    return providers.find(p => p.id === selectedModel.providerId);
  }, [providers, selectedModel]);

  // 获取角色列表
  const gentleRoles = useMemo(() => getRolesByPersonality('gentle'), []);
  const angryRoles = useMemo(() => getRolesByPersonality('angry'), []);

  // 处理字段变更
  const handleChange = <K extends keyof AgentProfile>(
    field: K,
    value: AgentProfile[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // 清除该字段的错误
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // 处理温度覆盖开关
  const handleTempOverrideToggle = (enabled: boolean) => {
    setEnableTempOverride(enabled);
    if (!enabled) {
      handleChange('temperatureOverride', undefined);
    } else {
      handleChange('temperatureOverride', selectedModel?.temperature ?? 0.7);
    }
  };

  // 处理保存
  const handleSave = () => {
    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    // 构建完整的 AgentProfile
    const agentProfile: AgentProfile = {
      id: formData.id || generateIdFromName(formData.name || ''),
      name: formData.name || '',
      modelProfileId: formData.modelProfileId || '',
      roleId: formData.roleId || '',
      temperatureOverride: formData.temperatureOverride,
      maxIterations: formData.maxIterations ?? 10,
      enableTools: formData.enableTools ?? true,
      toolWhitelist: formData.toolWhitelist ?? [],
      enableStorage: formData.enableStorage ?? true,
    };

    onSave(agentProfile);
  };

  return (
    <div className="space-y-6">
      {/* ID 字段（只读） */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          ID
        </label>
        <input
          type="text"
          value={formData.id}
          disabled
          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
          placeholder="自动生成"
        />
        <p className="mt-1 text-xs text-gray-500">
          {isEditing ? 'ID 不可修改' : '根据显示名称自动生成'}
        </p>
      </div>

      {/* 显示名称 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          显示名称 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={e => handleNameChange(e.target.value)}
          placeholder="如: 温和助手"
          className={`
            w-full px-3 py-2 border rounded-lg
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            ${errors.name ? 'border-red-500' : 'border-gray-300'}
          `}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-500">{errors.name}</p>
        )}
      </div>

      {/* 角色选择 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          角色 <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.roleId}
          onChange={e => handleChange('roleId', e.target.value)}
          className={`
            w-full px-3 py-2 border rounded-lg
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            ${errors.roleId ? 'border-red-500' : 'border-gray-300'}
          `}
        >
          <option value="">请选择角色...</option>
          <optgroup label="温和型角色">
            {gentleRoles.map(role => (
              <option key={role.id} value={role.id}>
                {role.name} - {role.description}
              </option>
            ))}
          </optgroup>
          <optgroup label="暴躁型角色">
            {angryRoles.map(role => (
              <option key={role.id} value={role.id}>
                {role.name} - {role.description}
              </option>
            ))}
          </optgroup>
        </select>
        {errors.roleId && (
          <p className="mt-1 text-sm text-red-500">{errors.roleId}</p>
        )}
      </div>

      {/* 模型选择 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          模型 <span className="text-red-500">*</span>
        </label>
        <ModelProfileSelect
          value={formData.modelProfileId || ''}
          onChange={value => handleChange('modelProfileId', value)}
          className={errors.modelProfileId ? 'border-red-500' : ''}
        />
        {errors.modelProfileId && (
          <p className="mt-1 text-sm text-red-500">{errors.modelProfileId}</p>
        )}
      </div>

      {/* Provider 信息（只读） */}
      {selectedProvider && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Provider 信息</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">名称:</span>
              <span className="ml-2 text-gray-900">{selectedProvider.name}</span>
            </div>
            <div>
              <span className="text-gray-500">API 类型:</span>
              <span className="ml-2 text-gray-900">{selectedProvider.apiType}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-500">Base URL:</span>
              <span className="ml-2 text-gray-900 break-all">{selectedProvider.baseURL}</span>
            </div>
          </div>
        </div>
      )}

      {/* 温度覆盖 */}
      <div className="space-y-3">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={enableTempOverride}
            onChange={e => handleTempOverrideToggle(e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="ml-2 text-sm font-medium text-gray-700">
            覆盖模型默认温度
          </span>
        </label>

        {enableTempOverride && (
          <div className="pl-6">
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={formData.temperatureOverride ?? 0.7}
                onChange={e => handleChange('temperatureOverride', parseFloat(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-sm text-gray-700 w-12 text-right">
                {formData.temperatureOverride?.toFixed(1) ?? '0.7'}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              较低值（0-0.5）更确定，较高值（1-2）更有创意
            </p>
          </div>
        )}
      </div>

      {/* 最大轮数 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          最大轮数
        </label>
        <input
          type="number"
          min={1}
          max={50}
          value={formData.maxIterations}
          onChange={e => handleChange('maxIterations', parseInt(e.target.value, 10) || 10)}
          className={`
            w-full px-3 py-2 border rounded-lg
            focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            ${errors.maxIterations ? 'border-red-500' : 'border-gray-300'}
          `}
        />
        {errors.maxIterations && (
          <p className="mt-1 text-sm text-red-500">{errors.maxIterations}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Agent 最多自动运行的轮数（1-50）
        </p>
      </div>

      {/* 工具开关 */}
      <div className="flex items-center justify-between">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.enableTools}
            onChange={e => handleChange('enableTools', e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="ml-2 text-sm font-medium text-gray-700">
            启用工具调用
          </span>
        </label>
        <span className="text-xs text-gray-500">
          {formData.enableTools ? '已启用' : '已禁用'}
        </span>
      </div>

      {/* 存储开关 */}
      <div className="flex items-center justify-between">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.enableStorage}
            onChange={e => handleChange('enableStorage', e.target.checked)}
            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="ml-2 text-sm font-medium text-gray-700">
            启用对话存储
          </span>
        </label>
        <span className="text-xs text-gray-500">
          {formData.enableStorage ? '已启用' : '已禁用'}
        </span>
      </div>

      {/* 底部按钮 */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {isEditing ? '保存' : '创建'}
        </button>
      </div>
    </div>
  );
}
