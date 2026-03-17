import { useState } from 'react';
import { X, Settings, AlertCircle, ChevronDown, User, Bot, Sparkles, Zap, Download, FileCode, Save, Check, AlertTriangle } from 'lucide-react';
import type { AgentConfig, ApiType } from '../types';
import { GENTLE_SYSTEM_PROMPT, ANGRY_SYSTEM_PROMPT, validateConfig } from '../agents/AgentConfig';
import {
  getRolesByPersonality,
  getPresetsByProvider,
  type RoleDefinition,
  type ModelPreset,
} from '../prompts';
import { exportToEnv, downloadEnvFile, hasEnvConfig, saveEnvToServer } from '../stores';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  gentleConfig: AgentConfig;
  angryConfig: AgentConfig;
  onUpdateGentle: (updates: Partial<AgentConfig>) => void;
  onUpdateAngry: (updates: Partial<AgentConfig>) => void;
}

type TabType = 'gentle' | 'angry';

// Role Card Component
function RoleCard({
  role,
  isSelected,
  onClick,
}: {
  role: RoleDefinition;
  isSelected: boolean;
  onClick: () => void;
}) {
  const isGentle = role.personality === 'gentle';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
        isSelected
          ? isGentle
            ? 'border-amber-400 bg-amber-50'
            : 'border-rose-400 bg-rose-50'
          : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        {isGentle ? (
          <Sparkles className={`w-4 h-4 ${isSelected ? 'text-amber-500' : 'text-gray-400'}`} />
        ) : (
          <Zap className={`w-4 h-4 ${isSelected ? 'text-rose-500' : 'text-gray-400'}`} />
        )}
        <span className={`font-medium ${isSelected ? (isGentle ? 'text-amber-700' : 'text-rose-700') : 'text-gray-700'}`}>
          {role.name}
        </span>
      </div>
      <p className="text-xs text-gray-500 line-clamp-2">{role.description}</p>
    </button>
  );
}

// Model Preset Card Component
function ModelPresetCard({
  preset,
  isSelected,
  onClick,
}: {
  preset: ModelPreset;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
        isSelected
          ? 'border-blue-400 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300 bg-white'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className={`font-medium ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
          {preset.name}
        </span>
        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
          {preset.provider}
        </span>
      </div>
      <p className="text-xs text-gray-500">{preset.description}</p>
      <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
        <span className="font-mono">{preset.model}</span>
        <span>·</span>
        <span>Temp: {preset.temperature}</span>
      </div>
    </button>
  );
}

function ConfigForm({
  config,
  onUpdate,
}: {
  config: AgentConfig;
  onUpdate: (updates: Partial<AgentConfig>) => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const error = validateConfig(config);
  const isGentle = config.personality === 'gentle';

  // Get available roles and presets
  const roles = getRolesByPersonality(config.personality);
  const presetsByProvider = getPresetsByProvider();

  // Find current role and preset
  const currentRole = roles.find(r => config.systemPrompt === r.systemPrompt) || roles[0];
  const currentPreset = Object.values(presetsByProvider)
    .flat()
    .find(p => p.baseURL === config.baseURL && p.model === config.model && p.apiType === config.apiType);

  const handleRoleSelect = (role: RoleDefinition) => {
    onUpdate({ systemPrompt: role.systemPrompt });
  };

  const handlePresetSelect = (preset: ModelPreset) => {
    onUpdate({
      apiType: preset.apiType,
      baseURL: preset.baseURL,
      model: preset.model,
      temperature: preset.temperature,
    });
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Role Selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
          {isGentle ? <Sparkles className="w-4 h-4 text-amber-500" /> : <Zap className="w-4 h-4 text-rose-500" />}
          选择角色
        </label>
        <div className="grid grid-cols-2 gap-3">
          {roles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              isSelected={currentRole?.id === role.id}
              onClick={() => handleRoleSelect(role)}
            />
          ))}
        </div>
      </div>

      {/* Model Preset Selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Bot className="w-4 h-4 text-blue-500" />
          选择模型
        </label>
        <div className="space-y-4 max-h-48 overflow-y-auto pr-1">
          {Object.entries(presetsByProvider).map(([provider, presets]) => (
            <div key={provider}>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 px-1">
                {provider}
              </div>
              <div className="grid grid-cols-1 gap-2">
                {presets.map((preset) => (
                  <ModelPresetCard
                    key={preset.id}
                    preset={preset}
                    isSelected={
                      currentPreset?.id === preset.id ||
                      (preset.baseURL === config.baseURL && preset.model === config.model)
                    }
                    onClick={() => handlePresetSelect(preset)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* API Key Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <User className="w-4 h-4 text-gray-400" />
          API Key
        </label>
        <input
          type="password"
          value={config.apiKey}
          onChange={(e) => onUpdate({ apiKey: e.target.value })}
          placeholder="sk-..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Advanced Settings Toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
      >
        <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        高级设置
      </button>

      {/* Advanced Settings */}
      {showAdvanced && (
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">API 类型</label>
              <select
                value={config.apiType}
                onChange={(e) => onUpdate({ apiType: e.target.value as ApiType })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="openai">OpenAI 格式</option>
                <option value="anthropic">Anthropic 原生</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Base URL</label>
              <input
                type="text"
                value={config.baseURL}
                onChange={(e) => onUpdate({ baseURL: e.target.value })}
                placeholder="https://api.openai.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">模型名称</label>
            <input
              type="text"
              value={config.model}
              onChange={(e) => onUpdate({ model: e.target.value })}
              placeholder="gpt-4o / claude-3-sonnet-20240229"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Temperature: {config.temperature}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={config.temperature}
                onChange={(e) => onUpdate({ temperature: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                最大轮数: {config.maxRounds}
              </label>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={config.maxRounds}
                onChange={(e) => onUpdate({ maxRounds: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">系统提示词</label>
            <textarea
              value={config.systemPrompt}
              onChange={(e) => onUpdate({ systemPrompt: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            />
            <button
              onClick={() =>
                onUpdate({
                  systemPrompt:
                    config.personality === 'gentle'
                      ? GENTLE_SYSTEM_PROMPT
                      : ANGRY_SYSTEM_PROMPT,
                })
              }
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              恢复默认提示词
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ConfigModal({
  isOpen,
  onClose,
  gentleConfig,
  angryConfig,
  onUpdateGentle,
  onUpdateAngry,
}: ConfigModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('gentle');
  const usingEnvConfig = hasEnvConfig();

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  const handleExportEnv = () => {
    const envContent = exportToEnv(gentleConfig, angryConfig);
    downloadEnvFile(envContent, '.env.local');
  };

  const handleSaveEnv = async () => {
    setSaveStatus('saving');
    const result = await saveEnvToServer(gentleConfig, angryConfig);

    if (result.success) {
      setSaveStatus('success');
      setSaveMessage(result.message || '配置已保存到 .env.local');
    } else {
      setSaveStatus('error');
      setSaveMessage(result.error || '保存失败');
    }

    // 3秒后重置状态
    setTimeout(() => {
      setSaveStatus('idle');
      setSaveMessage('');
    }, 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Agent 配置</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('gentle')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'gentle'
                ? 'text-amber-600 border-b-2 border-amber-500 bg-amber-50/50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              温和 Agent
            </span>
          </button>
          <button
            onClick={() => setActiveTab('angry')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'angry'
                ? 'text-rose-600 border-b-2 border-rose-500 bg-rose-50/50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              暴躁 Agent
            </span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'gentle' ? (
            <ConfigForm config={gentleConfig} onUpdate={onUpdateGentle} />
          ) : (
            <ConfigForm config={angryConfig} onUpdate={onUpdateAngry} />
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          {/* Left side: Env config indicator, save and export buttons */}
          <div className="flex items-center gap-3">
            {usingEnvConfig && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm">
                <FileCode className="w-4 h-4" />
                已加载 .env.local 配置
              </div>
            )}
            <button
              onClick={handleSaveEnv}
              disabled={saveStatus === 'saving'}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                saveStatus === 'success'
                  ? 'bg-green-100 text-green-700'
                  : saveStatus === 'error'
                    ? 'bg-red-100 text-red-700'
                    : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
              }`}
            >
              {saveStatus === 'saving' ? (
                <>
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  保存中...
                </>
              ) : saveStatus === 'success' ? (
                <>
                  <Check className="w-4 h-4" />
                  已保存
                </>
              ) : saveStatus === 'error' ? (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  失败
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  保存到 .env
                </>
              )}
            </button>
            <button
              onClick={handleExportEnv}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              导出
            </button>
            {saveMessage && saveStatus !== 'idle' && saveStatus !== 'saving' && (
              <span className={`text-xs ${saveStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {saveMessage}
              </span>
            )}
          </div>

          {/* Right side: Close button */}
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
