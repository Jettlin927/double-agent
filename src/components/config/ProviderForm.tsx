import { useState, useCallback } from 'react';
import type { ProviderConfig } from '../../config/types';

interface ProviderFormProps {
  provider?: ProviderConfig;
  onSave: (provider: ProviderConfig) => void;
  onCancel: () => void;
}

interface FormErrors {
  id?: string;
  name?: string;
  apiType?: string;
  baseURL?: string;
  apiKey?: string;
  supportedModels?: string;
}

const API_TYPES = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
] as const;

export function ProviderForm({ provider, onSave, onCancel }: ProviderFormProps) {
  const isEditing = !!provider;

  const [formData, setFormData] = useState<ProviderConfig>({
    id: provider?.id ?? '',
    name: provider?.name ?? '',
    apiType: provider?.apiType ?? 'openai',
    baseURL: provider?.baseURL ?? '',
    apiKey: provider?.apiKey ?? '',
    supportedModels: provider?.supportedModels ?? [],
    enabled: provider?.enabled ?? true,
  });

  const [modelsInput, setModelsInput] = useState<string>(
    provider?.supportedModels?.join(', ') ?? ''
  );

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateId = useCallback((id: string): string | undefined => {
    if (!id.trim()) {
      return 'ID 不能为空';
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      return 'ID 只能包含字母、数字、下划线和连字符';
    }
    return undefined;
  }, []);

  const validateName = useCallback((name: string): string | undefined => {
    if (!name.trim()) {
      return '显示名称不能为空';
    }
    return undefined;
  }, []);

  const validateBaseURL = useCallback((url: string): string | undefined => {
    if (!url.trim()) {
      return 'Base URL 不能为空';
    }
    if (!/^https?:\/\//.test(url)) {
      return 'Base URL 必须以 http:// 或 https:// 开头';
    }
    return undefined;
  }, []);

  const validateSupportedModels = useCallback((models: string): string | undefined => {
    const modelList = models
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (modelList.length === 0) {
      return '请至少输入一个支持的模型';
    }
    return undefined;
  }, []);

  const validateField = useCallback(
    (field: keyof FormErrors, value: string): string | undefined => {
      switch (field) {
        case 'id':
          return validateId(value);
        case 'name':
          return validateName(value);
        case 'baseURL':
          return validateBaseURL(value);
        case 'supportedModels':
          return validateSupportedModels(value);
        default:
          return undefined;
      }
    },
    [validateId, validateName, validateBaseURL, validateSupportedModels]
  );

  const handleChange = useCallback(
    (field: keyof ProviderConfig, value: string | boolean) => {
      setFormData((prev) => ({ ...prev, [field]: value }));

      if (typeof value === 'string') {
        const error = validateField(field as keyof FormErrors, value);
        setErrors((prev) => ({ ...prev, [field]: error }));
      }
    },
    [validateField]
  );

  const handleModelsChange = useCallback(
    (value: string) => {
      setModelsInput(value);
      const error = validateSupportedModels(value);
      setErrors((prev) => ({ ...prev, supportedModels: error }));
    },
    [validateSupportedModels]
  );

  const handleBlur = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {
      id: isEditing ? undefined : validateId(formData.id),
      name: validateName(formData.name),
      baseURL: validateBaseURL(formData.baseURL),
      supportedModels: validateSupportedModels(modelsInput),
    };

    setErrors(newErrors);
    setTouched({
      id: true,
      name: true,
      baseURL: true,
      supportedModels: true,
    });

    return !Object.values(newErrors).some(Boolean);
  }, [
    formData.id,
    formData.name,
    formData.baseURL,
    modelsInput,
    isEditing,
    validateId,
    validateName,
    validateBaseURL,
    validateSupportedModels,
  ]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (!validateForm()) {
        return;
      }

      const supportedModels = modelsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      onSave({
        ...formData,
        supportedModels,
      });
    },
    [formData, modelsInput, onSave, validateForm]
  );

  const inputClassName =
    'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors';
  const errorInputClassName =
    'w-full px-3 py-2 border border-red-500 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-colors';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* ID */}
      <div>
        <label htmlFor="provider-id" className="block text-sm font-medium text-gray-700 mb-1">
          ID
        </label>
        <input
          id="provider-id"
          type="text"
          value={formData.id}
          onChange={(e) => handleChange('id', e.target.value)}
          onBlur={() => handleBlur('id')}
          disabled={isEditing}
          placeholder="如: openai, deepseek-custom"
          className={isEditing ? `${inputClassName} bg-gray-100` : errors.id && touched.id ? errorInputClassName : inputClassName}
        />
        {errors.id && touched.id && <p className="mt-1 text-sm text-red-600">{errors.id}</p>}
      </div>

      {/* 显示名称 */}
      <div>
        <label htmlFor="provider-name" className="block text-sm font-medium text-gray-700 mb-1">
          显示名称
        </label>
        <input
          id="provider-name"
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          onBlur={() => handleBlur('name')}
          placeholder="如: OpenAI"
          className={errors.name && touched.name ? errorInputClassName : inputClassName}
        />
        {errors.name && touched.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
      </div>

      {/* API 类型 */}
      <div>
        <label htmlFor="provider-api-type" className="block text-sm font-medium text-gray-700 mb-1">
          API 类型
        </label>
        <select
          id="provider-api-type"
          value={formData.apiType}
          onChange={(e) => handleChange('apiType', e.target.value)}
          className={inputClassName}
        >
          {API_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Base URL */}
      <div>
        <label htmlFor="provider-base-url" className="block text-sm font-medium text-gray-700 mb-1">
          Base URL
        </label>
        <input
          id="provider-base-url"
          type="text"
          value={formData.baseURL}
          onChange={(e) => handleChange('baseURL', e.target.value)}
          onBlur={() => handleBlur('baseURL')}
          placeholder="https://api.openai.com"
          className={errors.baseURL && touched.baseURL ? errorInputClassName : inputClassName}
        />
        {errors.baseURL && touched.baseURL && (
          <p className="mt-1 text-sm text-red-600">{errors.baseURL}</p>
        )}
      </div>

      {/* API Key */}
      <div>
        <label htmlFor="provider-api-key" className="block text-sm font-medium text-gray-700 mb-1">
          API Key
        </label>
        <input
          id="provider-api-key"
          type="password"
          value={formData.apiKey}
          onChange={(e) => handleChange('apiKey', e.target.value)}
          placeholder="可选"
          className={inputClassName}
        />
        <p className="mt-1 text-sm text-gray-500">
          如为空，将从环境变量 VITE_{formData.id.toUpperCase()}_API_KEY 读取
        </p>
      </div>

      {/* 支持模型列表 */}
      <div>
        <label
          htmlFor="provider-supported-models"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          支持模型列表
        </label>
        <input
          id="provider-supported-models"
          type="text"
          value={modelsInput}
          onChange={(e) => handleModelsChange(e.target.value)}
          onBlur={() => handleBlur('supportedModels')}
          placeholder="gpt-4o, gpt-4o-mini"
          className={
            errors.supportedModels && touched.supportedModels ? errorInputClassName : inputClassName
          }
        />
        {errors.supportedModels && touched.supportedModels && (
          <p className="mt-1 text-sm text-red-600">{errors.supportedModels}</p>
        )}
      </div>

      {/* 启用状态 */}
      <div className="flex items-center">
        <input
          id="provider-enabled"
          type="checkbox"
          checked={formData.enabled}
          onChange={(e) => handleChange('enabled', e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="provider-enabled" className="ml-2 text-sm font-medium text-gray-700">
          启用此 Provider
        </label>
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
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          保存
        </button>
      </div>
    </form>
  );
}

export default ProviderForm;
