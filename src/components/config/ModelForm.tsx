/**
 * ModelForm - Model 添加/编辑表单组件
 * 用于创建或修改 ModelProfile 配置
 */

import { useState, useCallback, useRef, useSyncExternalStore } from 'react';
import type { ModelProfile } from '../../config/types';
import { configManager } from '../../config/ConfigManager';

interface ModelFormProps {
  model?: ModelProfile; // 编辑时传入，添加时不传
  onSave: (model: ModelProfile) => void;
  onCancel: () => void;
}

interface FormErrors {
  id?: string;
  name?: string;
  providerId?: string;
  modelName?: string;
  temperature?: string;
  maxTokens?: string;
  contextWindow?: string;
  supportsTools?: string;
  supportsReasoning?: string;
  customParams?: string;
  costPer1KTokens?: string;
}

// 使用 useSyncExternalStore 获取 providers
function useProviders() {
  return useSyncExternalStore(
    (callback) => configManager.subscribe(callback),
    () => configManager.getProviders()
  );
}

// 创建默认表单数据
function createDefaultFormData(): ModelProfile {
  return {
    id: '',
    name: '',
    providerId: '',
    modelName: '',
    temperature: 0.7,
    maxTokens: undefined,
    contextWindow: undefined,
    supportsTools: false,
    supportsReasoning: false,
  };
}

export function ModelForm({ model, onSave, onCancel }: ModelFormProps) {
  const isEditing = !!model;
  const providers = useProviders();
  const initializedRef = useRef(false);

  // 初始化表单状态
  const [formData, setFormData] = useState<ModelProfile>(() => {
    if (model) {
      return { ...model };
    }
    return createDefaultFormData();
  });

  // 上下文窗口输入值（以 K 为单位显示）
  const [contextWindowInput, setContextWindowInput] = useState<string>(() => {
    if (model?.contextWindow) {
      return (model.contextWindow / 1000).toString();
    }
    return '';
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // 验证单个字段
  const validateField = useCallback(
    (field: keyof ModelProfile, value: unknown): string | undefined => {
      switch (field) {
        case 'id':
          if (!value || (typeof value === 'string' && value.trim() === '')) {
            return 'ID 不能为空';
          }
          if (!isEditing && !initializedRef.current) {
            // 只在非初始化时检查 ID 是否已存在
            const existing = configManager.getModelProfile(value as string);
            if (existing) {
              return '该 ID 已存在';
            }
          }
          break;
        case 'name':
          if (!value || (typeof value === 'string' && value.trim() === '')) {
            return '显示名称不能为空';
          }
          break;
        case 'providerId':
          if (!value || (typeof value === 'string' && value.trim() === '')) {
            return '请选择 Provider';
          }
          break;
        case 'modelName':
          if (!value || (typeof value === 'string' && value.trim() === '')) {
            return '实际模型名称不能为空';
          }
          break;
        case 'temperature':
          if (typeof value !== 'number' || value < 0 || value > 2) {
            return '温度必须在 0-2 之间';
          }
          break;
        case 'maxTokens':
          if (value !== undefined && value !== null) {
            const num = Number(value);
            if (isNaN(num) || num < 1 || num > 32768) {
              return 'Max Tokens 必须在 1-32768 之间';
            }
          }
          break;
      }
      return undefined;
    },
    [isEditing]
  );

  // 验证整个表单
  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    // 验证必填字段
    const fields: (keyof ModelProfile)[] = [
      'id',
      'name',
      'providerId',
      'modelName',
      'temperature',
    ];

    fields.forEach((field) => {
      const error = validateField(field, formData[field]);
      if (error) {
        newErrors[field] = error;
      }
    });

    // 验证 maxTokens
    const maxTokensError = validateField('maxTokens', formData.maxTokens);
    if (maxTokensError) {
      newErrors.maxTokens = maxTokensError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, validateField]);

  // 处理字段变化
  const handleChange = useCallback(
    (field: keyof ModelProfile, value: unknown) => {
      setFormData((prev) => ({ ...prev, [field]: value }));

      // 实时验证
      const error = validateField(field, value);
      setErrors((prev) => ({ ...prev, [field]: error }));
    },
    [validateField]
  );

  // 处理上下文窗口输入变化
  const handleContextWindowChange = useCallback((value: string) => {
    setContextWindowInput(value);

    if (value === '') {
      setFormData((prev) => ({ ...prev, contextWindow: undefined }));
      return;
    }

    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
      setFormData((prev) => ({ ...prev, contextWindow: Math.round(num * 1000) }));
    }
  }, []);

  // 处理字段失焦
  const handleBlur = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  // 处理保存
  const handleSave = useCallback(() => {
    // 标记所有字段为已触碰
    setTouched({
      id: true,
      name: true,
      providerId: true,
      modelName: true,
      temperature: true,
      maxTokens: true,
      contextWindow: true,
    });

    if (validateForm()) {
      onSave(formData);
    }
  }, [formData, validateForm, onSave]);

  // 输入框样式
  const inputClassName =
    'w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors';
  const errorInputClassName =
    'w-full px-3 py-2 border border-red-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors';

  // 标签样式
  const labelClassName = 'block text-sm font-medium text-gray-700 mb-1';

  // 错误文本样式
  const errorClassName = 'mt-1 text-sm text-red-600';

  return (
    <div className="space-y-6">
      {/* ID 字段 */}
      <div>
        <label htmlFor="model-id" className={labelClassName}>
          ID <span className="text-red-500">*</span>
        </label>
        <input
          id="model-id"
          type="text"
          value={formData.id}
          onChange={(e) => handleChange('id', e.target.value)}
          onBlur={() => handleBlur('id')}
          disabled={isEditing}
          placeholder="如: gpt-4o, deepseek-chat"
          className={errors.id && touched.id ? errorInputClassName : inputClassName}
        />
        {errors.id && touched.id && <p className={errorClassName}>{errors.id}</p>}
        {isEditing && (
          <p className="mt-1 text-xs text-gray-500">ID 不可修改</p>
        )}
      </div>

      {/* 显示名称 */}
      <div>
        <label htmlFor="model-name" className={labelClassName}>
          显示名称 <span className="text-red-500">*</span>
        </label>
        <input
          id="model-name"
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          onBlur={() => handleBlur('name')}
          placeholder="如: GPT-4o"
          className={errors.name && touched.name ? errorInputClassName : inputClassName}
        />
        {errors.name && touched.name && <p className={errorClassName}>{errors.name}</p>}
      </div>

      {/* Provider 选择 */}
      <div>
        <label htmlFor="model-provider" className={labelClassName}>
          Provider <span className="text-red-500">*</span>
        </label>
        <select
          id="model-provider"
          value={formData.providerId}
          onChange={(e) => handleChange('providerId', e.target.value)}
          onBlur={() => handleBlur('providerId')}
          className={
            errors.providerId && touched.providerId ? errorInputClassName : inputClassName
          }
        >
          <option value="">请选择 Provider</option>
          {providers.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.name}
            </option>
          ))}
        </select>
        {errors.providerId && touched.providerId && (
          <p className={errorClassName}>{errors.providerId}</p>
        )}
      </div>

      {/* 实际模型名称 */}
      <div>
        <label htmlFor="model-modelName" className={labelClassName}>
          实际模型名称 <span className="text-red-500">*</span>
        </label>
        <input
          id="model-modelName"
          type="text"
          value={formData.modelName}
          onChange={(e) => handleChange('modelName', e.target.value)}
          onBlur={() => handleBlur('modelName')}
          placeholder="传给 API 的值，如: gpt-4o"
          className={
            errors.modelName && touched.modelName ? errorInputClassName : inputClassName
          }
        />
        <p className="mt-1 text-xs text-gray-500">
          这是实际传给 API 的 model 参数
        </p>
        {errors.modelName && touched.modelName && (
          <p className={errorClassName}>{errors.modelName}</p>
        )}
      </div>

      {/* 默认温度 */}
      <div>
        <label htmlFor="model-temperature" className={labelClassName}>
          默认温度 <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-4">
          <input
            id="model-temperature"
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={formData.temperature}
            onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
            onBlur={() => handleBlur('temperature')}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <span className="text-sm font-medium text-gray-700 w-12 text-right">
            {formData.temperature.toFixed(1)}
          </span>
        </div>
        {errors.temperature && touched.temperature && (
          <p className={errorClassName}>{errors.temperature}</p>
        )}
      </div>

      {/* 最大 Tokens 和 上下文窗口 - 同一行 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 最大 Tokens */}
        <div>
          <label htmlFor="model-maxTokens" className={labelClassName}>
            最大 Tokens
          </label>
          <input
            id="model-maxTokens"
            type="number"
            min={1}
            max={32768}
            value={formData.maxTokens ?? ''}
            onChange={(e) =>
              handleChange(
                'maxTokens',
                e.target.value === '' ? undefined : parseInt(e.target.value, 10)
              )
            }
            onBlur={() => handleBlur('maxTokens')}
            placeholder="可选"
            className={
              errors.maxTokens && touched.maxTokens ? errorInputClassName : inputClassName
            }
          />
          {errors.maxTokens && touched.maxTokens && (
            <p className={errorClassName}>{errors.maxTokens}</p>
          )}
        </div>

        {/* 上下文窗口 */}
        <div>
          <label htmlFor="model-contextWindow" className={labelClassName}>
            上下文窗口 (K)
          </label>
          <div className="relative">
            <input
              id="model-contextWindow"
              type="number"
              min={0}
              value={contextWindowInput}
              onChange={(e) => handleContextWindowChange(e.target.value)}
              onBlur={() => handleBlur('contextWindow')}
              placeholder="128"
              className={inputClassName}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
              K
            </span>
          </div>
          {formData.contextWindow && (
            <p className="mt-1 text-xs text-gray-500">
              实际值: {formData.contextWindow.toLocaleString()} tokens
            </p>
          )}
        </div>
      </div>

      {/* 功能开关 */}
      <div className="space-y-3">
        <span className={labelClassName}>功能支持</span>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.supportsTools}
            onChange={(e) => handleChange('supportsTools', e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">支持 Function Calling/Tools</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.supportsReasoning}
            onChange={(e) => handleChange('supportsReasoning', e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">支持 Reasoning</span>
        </label>
      </div>

      {/* 底部按钮 */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        >
          保存
        </button>
      </div>
    </div>
  );
}
