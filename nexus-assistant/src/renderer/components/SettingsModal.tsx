// =============================================================================
// NEXUS - Settings Modal
// Configuration interface for API keys and preferences
// =============================================================================

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Key, 
  Palette, 
  Settings as SettingsIcon,
  Cpu,
  Globe,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Info,
  Puzzle,
  Plug,
  Sparkles,
  Brain,
  FileText,
  Clock,
  Bell,
  Zap,
  Shield,
  Users,
  PanelLeftClose,
} from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';
import { useSidebarStore } from '../stores/sidebarStore';
import { DEFAULT_SETTINGS, DEFAULT_PERSONALITY_SETTINGS, ProactivePriority, AssistantMode } from '../../shared/types';

interface SettingsModalProps {
  onClose: () => void;
  onOpenLogs?: () => void;
}

type Tab = 'api' | 'integrations' | 'appearance' | 'behavior' | 'context' | 'proactive' | 'personality';

// Provider configuration
const PROVIDERS = {
  moonshotChina: {
    id: 'moonshotChina',
    name: 'Moonshot AI - China',
    baseUrl: 'https://api.moonshot.cn/v1',
    keyPrefix: 'sk-',
    keyPlaceholder: 'sk-...',
    models: [
      { value: 'kimi-k2.5', label: 'kimi-k2.5 (Recommended)' },
      { value: 'kimi-k2-0905-preview', label: 'kimi-k2-0905-preview' },
      { value: 'kimi-k2-turbo-preview', label: 'kimi-k2-turbo-preview' },
    ],
    defaultModel: 'kimi-k2.5',
  },
  moonshotGlobal: {
    id: 'moonshotGlobal',
    name: 'Moonshot AI - Global',
    baseUrl: 'https://api.moonshot.ai/v1',
    keyPrefix: 'sk-',
    keyPlaceholder: 'sk-...',
    models: [
      { value: 'kimi-k2.5', label: 'kimi-k2.5 (Recommended)' },
      { value: 'kimi-k2-0905-preview', label: 'kimi-k2-0905-preview' },
      { value: 'kimi-k2-turbo-preview', label: 'kimi-k2-turbo-preview' },
    ],
    defaultModel: 'kimi-k2.5',
  },
  synthetic: {
    id: 'synthetic',
    name: 'Synthetic (Multi-Provider)',
    baseUrl: 'https://api.synthetic.new/v1',
    keyPrefix: 'syn_',
    keyPlaceholder: 'syn_...',
    defaultModel: 'hf:moonshotai/Kimi-K2.5',
  },
} as const;

// Synthetic provider models
const SYNTHETIC_MODELS = [
  {
    label: 'Kimi (Moonshot)',
    options: [
      { value: 'hf:moonshotai/Kimi-K2.5', label: 'Kimi K2.5 (256k)' },
      { value: 'hf:moonshotai/Kimi-K2-Thinking', label: 'Kimi K2 Thinking (256k)' },
      { value: 'hf:moonshotai/Kimi-K2-Instruct-0905', label: 'Kimi K2 Instruct (256k)' },
    ],
  },
  {
    label: 'DeepSeek (Fireworks)',
    options: [
      { value: 'hf:deepseek-ai/DeepSeek-V3.2', label: 'DeepSeek V3.2 (159k)' },
      { value: 'hf:deepseek-ai/DeepSeek-V3.1', label: 'DeepSeek V3.1 (128k)' },
      { value: 'hf:deepseek-ai/DeepSeek-V3.1-Terminus', label: 'DeepSeek V3.1 Terminus (128k)' },
      { value: 'hf:deepseek-ai/DeepSeek-V3-0324', label: 'DeepSeek V3-0324 (128k)' },
      { value: 'hf:deepseek-ai/DeepSeek-R1-0528', label: 'DeepSeek R1-0528 (128k)' },
      { value: 'hf:deepseek-ai/DeepSeek-V3', label: 'DeepSeek V3 (128k) - Together AI' },
    ],
  },
  {
    label: 'Qwen (Fireworks/Together)',
    options: [
      { value: 'hf:Qwen/Qwen3-235B-A22B-Instruct-2507', label: 'Qwen3 235B Instruct (256k)' },
      { value: 'hf:Qwen/Qwen3-235B-A22B-Thinking-2507', label: 'Qwen3 235B Thinking (256k)' },
      { value: 'hf:Qwen/Qwen3-Coder-480B-A35B-Instruct', label: 'Qwen3 Coder 480B (256k)' },
      { value: 'hf:Qwen/Qwen3-VL-235B-A22B-Instruct', label: 'Qwen3 VL 235B (250k)' },
    ],
  },
  {
    label: 'Other Models',
    options: [
      { value: 'hf:meta-llama/Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B (128k)' },
      { value: 'hf:MiniMaxAI/MiniMax-M2.1', label: 'MiniMax M2.1 (192k)' },
      { value: 'hf:MiniMaxAI/MiniMax-M2', label: 'MiniMax M2 (192k)' },
      { value: 'hf:zai-org/GLM-4.7', label: 'GLM 4.7 (198k)' },
      { value: 'hf:zai-org/GLM-4.6', label: 'GLM 4.6 (198k)' },
      { value: 'hf:openai/gpt-oss-120b', label: 'GPT-OSS 120B (128k)' },
    ],
  },
];

// Get provider by base URL
const getProviderByBaseUrl = (baseUrl: string) => {
  return Object.values(PROVIDERS).find(p => p.baseUrl === baseUrl) || PROVIDERS.moonshotChina;
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onOpenLogs }) => {
  const { settings, updateSettings, isLoading, isSaving, testApiKey, validationErrors, apiKeyStatus, loadSettings } = useSettingsStore();
  
  // Local state for form
  const [localSettings, setLocalSettings] = useState(settings);
  const [showApiKey, setShowApiKey] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('api');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'valid' | 'invalid'>('idle');
  const [testError, setTestError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedSettings, setLastSavedSettings] = useState(settings);

  // Get current provider
  const currentProvider = getProviderByBaseUrl(localSettings.kimiBaseUrl);
  const isSynthetic = currentProvider.id === 'synthetic';

  // Sync with global settings when modal opens
  useEffect(() => {
    setLocalSettings(settings);
    setLastSavedSettings(settings);
    setHasUnsavedChanges(false);
    setTestStatus(apiKeyStatus === 'valid' ? 'valid' : apiKeyStatus === 'invalid' ? 'invalid' : 'idle');
  }, [settings, apiKeyStatus]);

  // Track unsaved changes
  useEffect(() => {
    const hasChanges = JSON.stringify(localSettings) !== JSON.stringify(lastSavedSettings);
    setHasUnsavedChanges(hasChanges);
  }, [localSettings, lastSavedSettings]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (hasUnsavedChanges) {
          // Confirm before closing with unsaved changes
          if (confirm('You have unsaved changes. Close without saving?')) {
            onClose();
          }
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose, hasUnsavedChanges]);

  const handleSave = async () => {
    const success = await updateSettings(localSettings);
    if (success) {
      setLastSavedSettings(localSettings);
      setHasUnsavedChanges(false);
      setTimeout(() => onClose(), 500);
    }
  };

  const handleTestApiKey = async () => {
    if (!localSettings.kimiApiKey) {
      setTestStatus('invalid');
      setTestError('Please enter an API key');
      return;
    }

    setTestStatus('testing');
    setTestError(null);
    
    // Test with the current form values (not saved settings)
    const isValid = await testApiKey(localSettings.kimiApiKey, localSettings.kimiBaseUrl);
    
    setTestStatus(isValid ? 'valid' : 'invalid');
    if (!isValid) {
      setTestError('API key validation failed. Please check your key and provider selection.');
    }
  };

  const handleProviderChange = (baseUrl: string) => {
    const provider = getProviderByBaseUrl(baseUrl);
    setLocalSettings({ 
      ...localSettings, 
      kimiBaseUrl: provider.baseUrl,
      // Reset to appropriate default model for provider
      defaultModel: provider.defaultModel,
      // Clear API key if switching between providers with different prefixes
      ...(provider.keyPrefix !== currentProvider.keyPrefix ? { kimiApiKey: '' } : {}),
    });
    setTestStatus('idle');
    setTestError(null);
  };

  const handleReset = () => {
    if (confirm('Reset all settings to defaults? This will clear your API key.')) {
      setLocalSettings(DEFAULT_SETTINGS);
      setTestStatus('idle');
      setTestError(null);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      if (hasUnsavedChanges) {
        if (confirm('You have unsaved changes. Close without saving?')) {
          onClose();
        }
      } else {
        onClose();
      }
    }
  };

  const tabs = [
    { id: 'api' as Tab, label: 'API', icon: Key },
    { id: 'integrations' as Tab, label: 'Integrations', icon: Puzzle },
    { id: 'proactive' as Tab, label: 'Proactive', icon: Sparkles },
    { id: 'personality' as Tab, label: 'Personality', icon: Brain },
    { id: 'appearance' as Tab, label: 'Appearance', icon: Palette },
    { id: 'behavior' as Tab, label: 'Behavior', icon: SettingsIcon },
    { id: 'context' as Tab, label: 'Context', icon: Cpu },
  ];

  // Get API key placeholder based on provider
  const getApiKeyPlaceholder = () => currentProvider.keyPlaceholder;

  // Get API key help text
  const getApiKeyHelpText = () => {
    if (isSynthetic) {
      return (
        <>
          Get your API key from{' '}
          <a 
            href="https://synthetic.new/user-settings/api" 
            target="_blank"
            rel="noopener noreferrer"
            className="text-nexus-cyan hover:underline"
            onClick={(e) => {
              e.preventDefault();
              window.electronAPI?.openExternal('https://synthetic.new/user-settings/api');
            }}
          >
            synthetic.new
          </a>
          . Keys start with &quot;syn_&quot;
        </>
      );
    }
    return (
      <>
        Get your API key from{' '}
        <a 
          href="https://platform.moonshot.cn/" 
          target="_blank"
          rel="noopener noreferrer"
          className="text-nexus-cyan hover:underline"
          onClick={(e) => {
            e.preventDefault();
            window.electronAPI?.openExternal('https://platform.moonshot.cn/');
          }}
        >
          platform.moonshot.cn
        </a>
      </>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="glass w-full max-w-2xl max-h-[85vh] rounded-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-display font-semibold text-white">Settings</h2>
            {hasUnsavedChanges && (
              <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded-full">
                Unsaved changes
              </span>
            )}
          </div>
          <button
            onClick={() => {
              if (hasUnsavedChanges) {
                if (confirm('You have unsaved changes. Close without saving?')) {
                  onClose();
                }
              } else {
                onClose();
              }
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-48 border-r border-white/10 p-4 space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-200
                  ${activeTab === tab.id 
                    ? 'bg-nexus-cyan/10 text-nexus-cyan' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }
                `}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            <AnimatePresence mode="wait">
              {activeTab === 'api' && (
                <motion.div
                  key="api"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {/* API Provider */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-300">
                      API Provider <span className="text-nexus-cyan">*</span>
                    </label>
                    <select
                      value={localSettings.kimiBaseUrl}
                      onChange={(e) => handleProviderChange(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                        text-slate-200
                        focus:outline-none focus:border-nexus-cyan/50 focus:ring-1 focus:ring-nexus-cyan/30
                        transition-all"
                    >
                      {Object.values(PROVIDERS).map((provider) => (
                        <option key={provider.id} value={provider.baseUrl}>
                          {provider.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-start gap-2 text-xs text-slate-400">
                      <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <p>
                        {isSynthetic 
                          ? 'Synthetic offers access to multiple providers (Fireworks, Together AI, etc.)'
                          : 'Moonshot AI is the official Kimi API provider'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Base URL Display */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-400">
                      API Endpoint
                    </label>
                    <div className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-sm font-mono">
                      {localSettings.kimiBaseUrl}
                    </div>
                  </div>

                  {/* API Key */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-300">
                      API Key
                      {validationErrors.kimiApiKey && (
                        <span className="ml-2 text-red-400 text-xs">{validationErrors.kimiApiKey}</span>
                      )}
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={localSettings.kimiApiKey}
                          onChange={(e) => {
                            setLocalSettings({ 
                              ...localSettings, 
                              kimiApiKey: e.target.value 
                            });
                            setTestStatus('idle');
                            setTestError(null);
                          }}
                          placeholder={getApiKeyPlaceholder()}
                          className={`
                            w-full px-4 py-3 rounded-xl bg-white/5 border 
                            ${validationErrors.kimiApiKey ? 'border-red-500/50' : 'border-white/10'}
                            text-slate-200 placeholder-slate-500
                            focus:outline-none focus:border-nexus-cyan/50 focus:ring-1 focus:ring-nexus-cyan/30
                            transition-all
                          `}
                        />
                        <button
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <button
                        onClick={handleTestApiKey}
                        disabled={!localSettings.kimiApiKey || testStatus === 'testing'}
                        className={`
                          px-4 py-2 rounded-xl border transition-colors flex items-center gap-2
                          ${testStatus === 'valid' 
                            ? 'bg-nexus-emerald/10 border-nexus-emerald/30 text-nexus-emerald' 
                            : testStatus === 'invalid'
                            ? 'bg-red-500/10 border-red-500/30 text-red-400'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                          }
                          disabled:opacity-50 disabled:cursor-not-allowed
                        `}
                      >
                        {testStatus === 'testing' ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : testStatus === 'valid' ? (
                          <Check className="w-4 h-4" />
                        ) : testStatus === 'invalid' ? (
                          <AlertCircle className="w-4 h-4" />
                        ) : (
                          <Globe className="w-4 h-4" />
                        )}
                        {testStatus === 'testing' ? 'Testing...' : 'Test'}
                      </button>
                    </div>
                    {testError && (
                      <p className="text-xs text-red-400">{testError}</p>
                    )}
                    <p className="text-xs text-slate-400">
                      {getApiKeyHelpText()}
                    </p>
                  </div>

                  {/* Default Model */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-300">
                      Default Model
                    </label>
                    <select
                      value={localSettings.defaultModel}
                      onChange={(e) => setLocalSettings({ 
                        ...localSettings, 
                        defaultModel: e.target.value 
                      })}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                        text-slate-200 text-sm
                        focus:outline-none focus:border-nexus-cyan/50
                        transition-all"
                    >
                      {isSynthetic ? (
                        SYNTHETIC_MODELS.map((group) => (
                          <optgroup key={group.label} label={group.label}>
                            {group.options.map((model) => (
                              <option key={model.value} value={model.value}>
                                {model.label}
                              </option>
                            ))}
                          </optgroup>
                        ))
                      ) : (
                        currentProvider.models?.map((model) => (
                          <option key={model.value} value={model.value}>
                            {model.label}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Test Result Info */}
                  {testStatus === 'valid' && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-lg bg-nexus-emerald/10 border border-nexus-emerald/30 text-nexus-emerald text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        <span>API key is valid! Click &quot;Save Changes&quot; to apply your settings.</span>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {activeTab === 'integrations' && (
                <motion.div
                  key="integrations"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-white flex items-center gap-2">
                      <Plug className="w-5 h-5 text-nexus-cyan" />
                      Pieces for Developers
                    </h3>
                    <p className="text-sm text-slate-300">
                      Connect to Pieces OS to access your saved code snippets and materials during conversations.
                    </p>
                    
                    <div className="space-y-4 pt-4">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-slate-300">
                          Enable Pieces OS Integration
                        </label>
                        <button
                          onClick={() => setLocalSettings({ 
                            ...localSettings, 
                            piecesEnabled: !localSettings.piecesEnabled 
                          })}
                          className={`
                            w-11 h-6 rounded-full transition-colors relative
                            ${localSettings.piecesEnabled ? 'bg-nexus-cyan' : 'bg-slate-700'}
                          `}
                        >
                          <motion.div
                            className="w-5 h-5 rounded-full bg-white absolute top-0.5"
                            animate={{ left: localSettings.piecesEnabled ? '22px' : '2px' }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          />
                        </button>
                      </div>
                      
                      {localSettings.piecesEnabled && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="space-y-4"
                        >
                          <div className="space-y-3">
                            <label className="block text-sm font-medium text-slate-300">
                              Pieces OS Port
                            </label>
                            <input
                              type="number"
                              value={localSettings.piecesPort}
                              onChange={(e) => setLocalSettings({ 
                                ...localSettings, 
                                piecesPort: parseInt(e.target.value) || 1000 
                              })}
                              min={1}
                              max={65535}
                              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                                text-slate-200
                                focus:outline-none focus:border-nexus-cyan/50
                                transition-all"
                            />
                            <p className="text-xs text-slate-400">
                              Default port is 1000. Change only if you&apos;ve configured Pieces OS to use a different port.
                            </p>
                          </div>
                          
                          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <p className="text-xs text-blue-400">
                              <strong>Status:</strong> NEXUS will automatically detect when Pieces OS is running 
                              and include relevant snippets in your conversations.
                            </p>
                          </div>
                        </motion.div>
                      )}
                      
                      <p className="text-xs text-slate-400">
                        Download Pieces OS from{' '}
                        <a 
                          href="https://pieces.app/" 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-nexus-cyan hover:underline"
                          onClick={(e) => {
                            e.preventDefault();
                            window.electronAPI?.openExternal('https://pieces.app/');
                          }}
                        >
                          pieces.app
                        </a>
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'appearance' && (
                <motion.div
                  key="appearance"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-300">Font Size</label>
                    <div className="flex gap-2">
                      {(['small', 'medium', 'large'] as const).map((size) => (
                        <button
                          key={size}
                          onClick={() => setLocalSettings({ ...localSettings, fontSize: size })}
                          className={`
                            flex-1 px-4 py-2 rounded-lg capitalize text-sm
                            transition-all duration-200
                            ${localSettings.fontSize === size 
                              ? 'bg-nexus-cyan/20 text-nexus-cyan border border-nexus-cyan/30' 
                              : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                            }
                          `}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-300">Transparency Effects</label>
                      <button
                        onClick={() => setLocalSettings({ 
                          ...localSettings, 
                          transparencyEnabled: !localSettings.transparencyEnabled 
                        })}
                        className={`
                          w-11 h-6 rounded-full transition-colors relative
                          ${localSettings.transparencyEnabled ? 'bg-nexus-cyan' : 'bg-slate-700'}
                        `}
                      >
                        <motion.div
                          className="w-5 h-5 rounded-full bg-white absolute top-0.5"
                          animate={{ left: localSettings.transparencyEnabled ? '22px' : '2px' }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-300">Animations</label>
                      <button
                        onClick={() => setLocalSettings({ 
                          ...localSettings, 
                          animationsEnabled: !localSettings.animationsEnabled 
                        })}
                        className={`
                          w-11 h-6 rounded-full transition-colors relative
                          ${localSettings.animationsEnabled ? 'bg-nexus-cyan' : 'bg-slate-700'}
                        `}
                      >
                        <motion.div
                          className="w-5 h-5 rounded-full bg-white absolute top-0.5"
                          animate={{ left: localSettings.animationsEnabled ? '22px' : '2px' }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'behavior' && (
                <motion.div
                  key="behavior"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-300">Launch at Startup</label>
                      <button
                        onClick={() => setLocalSettings({ 
                          ...localSettings, 
                          launchAtStartup: !localSettings.launchAtStartup 
                        })}
                        className={`
                          w-11 h-6 rounded-full transition-colors relative
                          ${localSettings.launchAtStartup ? 'bg-nexus-cyan' : 'bg-slate-700'}
                        `}
                      >
                        <motion.div
                          className="w-5 h-5 rounded-full bg-white absolute top-0.5"
                          animate={{ left: localSettings.launchAtStartup ? '22px' : '2px' }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-300">Minimize to Tray</label>
                      <button
                        onClick={() => setLocalSettings({ 
                          ...localSettings, 
                          minimizeToTray: !localSettings.minimizeToTray 
                        })}
                        className={`
                          w-11 h-6 rounded-full transition-colors relative
                          ${localSettings.minimizeToTray ? 'bg-nexus-cyan' : 'bg-slate-700'}
                        `}
                      >
                        <motion.div
                          className="w-5 h-5 rounded-full bg-white absolute top-0.5"
                          animate={{ left: localSettings.minimizeToTray ? '22px' : '2px' }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Confirmation Behavior */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-300 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-slate-400" />
                      Confirmation Behavior
                    </label>
                    <div className="flex gap-2">
                      {(['always', 'dangerous', 'trust'] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setLocalSettings({ ...localSettings, confirmationMode: mode })}
                          className={`
                            flex-1 px-3 py-2 rounded-lg text-sm capitalize
                            ${(localSettings.confirmationMode ?? 'dangerous') === mode 
                              ? 'bg-nexus-cyan/20 text-nexus-cyan border border-nexus-cyan/30' 
                              : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'}
                          `}
                        >
                          {mode === 'always' ? 'Always ask' : mode === 'dangerous' ? 'Dangerous only' : 'Trust mode'}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400">
                      When to ask before running commands or opening files
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-300">Auto-save Conversations</label>
                      <button
                        onClick={() => setLocalSettings({ 
                          ...localSettings, 
                          autoSaveConversations: !localSettings.autoSaveConversations 
                        })}
                        className={`
                          w-11 h-6 rounded-full transition-colors relative
                          ${localSettings.autoSaveConversations ? 'bg-nexus-cyan' : 'bg-slate-700'}
                        `}
                      >
                        <motion.div
                          className="w-5 h-5 rounded-full bg-white absolute top-0.5"
                          animate={{ left: localSettings.autoSaveConversations ? '22px' : '2px' }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'context' && (
                <motion.div
                  key="context"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-300">Context Gathering</label>
                      <button
                        onClick={() => setLocalSettings({ 
                          ...localSettings, 
                          contextGatheringEnabled: !localSettings.contextGatheringEnabled 
                        })}
                        className={`
                          w-11 h-6 rounded-full transition-colors relative
                          ${localSettings.contextGatheringEnabled ? 'bg-nexus-cyan' : 'bg-slate-700'}
                        `}
                      >
                        <motion.div
                          className="w-5 h-5 rounded-full bg-white absolute top-0.5"
                          animate={{ left: localSettings.contextGatheringEnabled ? '22px' : '2px' }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </div>
                    <p className="text-xs text-slate-400">
                      Allow NEXUS to gather system context for better assistance
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-300">Track Active Window</label>
                      <button
                        onClick={() => setLocalSettings({ 
                          ...localSettings, 
                          trackActiveWindow: !localSettings.trackActiveWindow 
                        })}
                        disabled={!localSettings.contextGatheringEnabled}
                        className={`
                          w-11 h-6 rounded-full transition-colors relative
                          ${localSettings.trackActiveWindow ? 'bg-nexus-cyan' : 'bg-slate-700'}
                          disabled:opacity-50
                        `}
                      >
                        <motion.div
                          className="w-5 h-5 rounded-full bg-white absolute top-0.5"
                          animate={{ left: localSettings.trackActiveWindow ? '22px' : '2px' }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-300">Track Clipboard</label>
                      <button
                        onClick={() => setLocalSettings({ 
                          ...localSettings, 
                          trackClipboard: !localSettings.trackClipboard 
                        })}
                        disabled={!localSettings.contextGatheringEnabled}
                        className={`
                          w-11 h-6 rounded-full transition-colors relative
                          ${localSettings.trackClipboard ? 'bg-nexus-cyan' : 'bg-slate-700'}
                          disabled:opacity-50
                        `}
                      >
                        <motion.div
                          className="w-5 h-5 rounded-full bg-white absolute top-0.5"
                          animate={{ left: localSettings.trackClipboard ? '22px' : '2px' }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'proactive' && (
                <motion.div
                  key="proactive"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-nexus-cyan" />
                      Proactive Assistant
                    </h3>
                    <p className="text-sm text-slate-400">
                      Configure how NEXUS proactively offers suggestions and insights.
                    </p>
                  </div>

                  {/* Enable/Disable */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-300">Enable Proactive Mode</label>
                      <button
                        onClick={() => setLocalSettings({ 
                          ...localSettings, 
                          proactiveEnabled: !localSettings.proactiveEnabled 
                        })}
                        className={`
                          w-11 h-6 rounded-full transition-colors relative
                          ${localSettings.proactiveEnabled ? 'bg-nexus-cyan' : 'bg-slate-700'}
                        `}
                      >
                        <motion.div
                          className="w-5 h-5 rounded-full bg-white absolute top-0.5"
                          animate={{ left: localSettings.proactiveEnabled ? '22px' : '2px' }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </div>
                    <p className="text-xs text-slate-400">
                      When enabled, NEXUS will analyze your work and offer helpful suggestions
                    </p>
                  </div>

                  {localSettings.proactiveEnabled && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-6 pt-2"
                    >
                      {/* Proactive Frequency */}
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-slate-300">Proactive Frequency</label>
                        <div className="flex gap-2">
                          {(['quiet', 'active', 'aggressive'] as const).map((freq) => (
                            <button
                              key={freq}
                              onClick={() => {
                                const updates: Partial<typeof localSettings> = { proactiveFrequency: freq };
                                if (freq === 'quiet') {
                                  updates.proactiveIntervalMinutes = 15;
                                  updates.proactiveMaxSuggestionsPerHour = 2;
                                } else if (freq === 'aggressive') {
                                  updates.proactiveIntervalMinutes = 2;
                                  updates.proactiveMaxSuggestionsPerHour = 8;
                                } else {
                                  updates.proactiveIntervalMinutes = 5;
                                  updates.proactiveMaxSuggestionsPerHour = 4;
                                }
                                setLocalSettings({ ...localSettings, ...updates });
                              }}
                              className={`
                                flex-1 px-3 py-2 rounded-lg text-sm capitalize
                                ${(localSettings.proactiveFrequency ?? 'active') === freq 
                                  ? 'bg-nexus-cyan/20 text-nexus-cyan border border-nexus-cyan/30' 
                                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'}
                              `}
                            >
                              {freq === 'quiet' ? 'Quiet' : freq === 'active' ? 'Active' : 'Aggressive'}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-slate-400">
                          Quiet: few suggestions per day. Active: when relevant. Aggressive: frequent check-ins
                        </p>
                      </div>

                      {/* Analysis Interval */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-400" />
                            Analysis Interval
                          </label>
                          <span className="text-sm text-nexus-cyan">
                            {localSettings.proactiveIntervalMinutes} min
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={30}
                          value={localSettings.proactiveIntervalMinutes}
                          onChange={(e) => setLocalSettings({
                            ...localSettings,
                            proactiveIntervalMinutes: parseInt(e.target.value)
                          })}
                          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-nexus-cyan"
                        />
                        <p className="text-xs text-slate-400">
                          How often NEXUS analyzes your work for insights (1-30 minutes)
                        </p>
                      </div>

                      {/* Max Suggestions Per Hour */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                            <Bell className="w-4 h-4 text-slate-400" />
                            Max Suggestions per Hour
                          </label>
                          <span className="text-sm text-nexus-cyan">
                            {localSettings.proactiveMaxSuggestionsPerHour}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={1}
                          max={10}
                          value={localSettings.proactiveMaxSuggestionsPerHour}
                          onChange={(e) => setLocalSettings({
                            ...localSettings,
                            proactiveMaxSuggestionsPerHour: parseInt(e.target.value)
                          })}
                          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-nexus-cyan"
                        />
                        <p className="text-xs text-slate-400">
                          Limit how often NEXUS can interrupt you with suggestions
                        </p>
                      </div>

                      {/* Minimum Idle Time */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                            <Zap className="w-4 h-4 text-slate-400" />
                            Minimum Idle Time
                          </label>
                          <span className="text-sm text-nexus-cyan">
                            {localSettings.proactiveMinIdleSeconds}s
                          </span>
                        </div>
                        <input
                          type="range"
                          min={10}
                          max={120}
                          step={10}
                          value={localSettings.proactiveMinIdleSeconds}
                          onChange={(e) => setLocalSettings({
                            ...localSettings,
                            proactiveMinIdleSeconds: parseInt(e.target.value)
                          })}
                          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-nexus-cyan"
                        />
                        <p className="text-xs text-slate-400">
                          Wait for this much idle time before showing suggestions (10-120 seconds)
                        </p>
                      </div>

                      {/* Priority Threshold */}
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-slate-300">
                          Priority Threshold
                        </label>
                        <div className="flex gap-2">
                          {(['low', 'medium', 'high'] as ProactivePriority[]).map((priority) => (
                            <button
                              key={priority}
                              onClick={() => setLocalSettings({ 
                                ...localSettings, 
                                proactivePriorityThreshold: priority 
                              })}
                              className={`
                                flex-1 px-4 py-2 rounded-lg capitalize text-sm
                                transition-all duration-200
                                ${localSettings.proactivePriorityThreshold === priority 
                                  ? 'bg-nexus-cyan/20 text-nexus-cyan border border-nexus-cyan/30' 
                                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                                }
                              `}
                            >
                              {priority}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-slate-400">
                          Only show suggestions at or above this priority level
                        </p>
                      </div>

                      {/* Default Assistant Mode */}
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-slate-300 flex items-center gap-2">
                          <PanelLeftClose className="w-4 h-4 text-slate-400" />
                          Default Assistant Mode
                        </label>
                        <div className="flex gap-2">
                          {(['supervise', 'suggestions', 'cowork'] as AssistantMode[]).map((m) => (
                            <button
                              key={m}
                              onClick={() => {
                                setLocalSettings({ ...localSettings, sidebarAssistantMode: m });
                                window.electronAPI?.setSidebarMode(m);
                                useSidebarStore.getState().setMode(m);
                              }}
                              className={`
                                flex-1 px-3 py-2 rounded-lg capitalize text-sm
                                transition-all duration-200 flex items-center justify-center gap-1.5
                                ${(localSettings as any).sidebarAssistantMode === m
                                  ? 'bg-nexus-cyan/20 text-nexus-cyan border border-nexus-cyan/30'
                                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'}
                              `}
                            >
                              {m === 'supervise' && <Shield className="w-3.5 h-3.5" />}
                              {m === 'suggestions' && <Sparkles className="w-3.5 h-3.5" />}
                              {m === 'cowork' && <Users className="w-3.5 h-3.5" />}
                              {m}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-slate-400">
                          Supervise: validate &amp; warn. Suggestions: passive tips. Cowork: active collaboration.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {activeTab === 'personality' && (
                <motion.div
                  key="personality"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-white flex items-center gap-2">
                      <Brain className="w-5 h-5 text-nexus-violet" />
                      Personality & Style
                    </h3>
                    <p className="text-sm text-slate-400">
                      Customize how NEXUS communicates and behaves.
                    </p>
                  </div>

                  {/* Assistant Name */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-slate-300">
                      Assistant Name
                    </label>
                    <input
                      type="text"
                      value={localSettings.personality?.name || DEFAULT_PERSONALITY_SETTINGS.name}
                      onChange={(e) => setLocalSettings({
                        ...localSettings,
                        personality: {
                          ...DEFAULT_PERSONALITY_SETTINGS,
                          ...localSettings.personality,
                          name: e.target.value
                        }
                      })}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                        text-slate-200 placeholder-slate-500
                        focus:outline-none focus:border-nexus-cyan/50 focus:ring-1 focus:ring-nexus-cyan/30
                        transition-all"
                    />
                  </div>

                  {/* Communication Style */}
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-slate-300">
                      Communication Style
                    </label>
                    
                    {/* Formality */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Formality</span>
                        <span className="capitalize">{localSettings.personality?.formality || 'balanced'}</span>
                      </div>
                      <div className="flex gap-2">
                        {(['casual', 'balanced', 'formal'] as const).map((level) => (
                          <button
                            key={level}
                            onClick={() => setLocalSettings({
                              ...localSettings,
                              personality: {
                                ...DEFAULT_PERSONALITY_SETTINGS,
                                ...localSettings.personality,
                                formality: level
                              }
                            })}
                            className={`
                              flex-1 px-3 py-1.5 rounded-lg capitalize text-xs
                              transition-all duration-200
                              ${(localSettings.personality?.formality || 'balanced') === level 
                                ? 'bg-nexus-violet/20 text-nexus-violet border border-nexus-violet/30' 
                                : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                              }
                            `}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Humor */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Humor</span>
                        <span className="capitalize">{localSettings.personality?.humor || 'subtle'}</span>
                      </div>
                      <div className="flex gap-2">
                        {(['none', 'subtle', 'playful'] as const).map((level) => (
                          <button
                            key={level}
                            onClick={() => setLocalSettings({
                              ...localSettings,
                              personality: {
                                ...DEFAULT_PERSONALITY_SETTINGS,
                                ...localSettings.personality,
                                humor: level
                              }
                            })}
                            className={`
                              flex-1 px-3 py-1.5 rounded-lg capitalize text-xs
                              transition-all duration-200
                              ${(localSettings.personality?.humor || 'subtle') === level 
                                ? 'bg-nexus-violet/20 text-nexus-violet border border-nexus-violet/30' 
                                : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                              }
                            `}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Verbosity */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Response Length</span>
                        <span className="capitalize">{localSettings.personality?.verbosity || 'concise'}</span>
                      </div>
                      <div className="flex gap-2">
                        {(['concise', 'balanced', 'detailed'] as const).map((level) => (
                          <button
                            key={level}
                            onClick={() => setLocalSettings({
                              ...localSettings,
                              personality: {
                                ...DEFAULT_PERSONALITY_SETTINGS,
                                ...localSettings.personality,
                                verbosity: level
                              }
                            })}
                            className={`
                              flex-1 px-3 py-1.5 rounded-lg capitalize text-xs
                              transition-all duration-200
                              ${(localSettings.personality?.verbosity || 'concise') === level 
                                ? 'bg-nexus-violet/20 text-nexus-violet border border-nexus-violet/30' 
                                : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
                              }
                            `}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Proactive Behaviors */}
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-slate-300">
                      Proactive Behaviors
                    </label>
                    
                    <div className="space-y-3">
                      {[
                        { key: 'suggestBreaks', label: 'Suggest breaks after long sessions' },
                        { key: 'detectStuckPatterns', label: 'Detect when you might be stuck' },
                        { key: 'offerWorkflowTips', label: 'Offer workflow improvement tips' },
                        { key: 'remindForgottenTasks', label: 'Remind about forgotten tasks' },
                        { key: 'lateNightConcern', label: 'Show concern during late night work' },
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center justify-between">
                          <label className="text-sm text-slate-300">{label}</label>
                          <button
                            onClick={() => setLocalSettings({
                              ...localSettings,
                              personality: {
                                ...DEFAULT_PERSONALITY_SETTINGS,
                                ...localSettings.personality,
                                [key]: !(localSettings.personality?.[key as keyof typeof localSettings.personality] ?? true)
                              }
                            })}
                            className={`
                              w-11 h-6 rounded-full transition-colors relative
                              ${(localSettings.personality?.[key as keyof typeof localSettings.personality] ?? true) ? 'bg-nexus-violet' : 'bg-slate-700'}
                            `}
                          >
                            <motion.div
                              className="w-5 h-5 rounded-full bg-white absolute top-0.5"
                              animate={{ left: (localSettings.personality?.[key as keyof typeof localSettings.personality] ?? true) ? '22px' : '2px' }}
                              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Soul Document Link */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-nexus-violet/10 to-nexus-cyan/10 border border-white/10">
                    <div className="flex items-start gap-3">
                      <FileText className="w-5 h-5 text-nexus-violet mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-white mb-1">Soul Document</h4>
                        <p className="text-xs text-slate-400 mb-3">
                          Define NEXUS's personality in detail using a markdown document. Both you and NEXUS can update this document as preferences are learned.
                        </p>
                        <button
                          onClick={() => {
                            // This will be handled by parent component
                            const event = new CustomEvent('open-soul-document');
                            window.dispatchEvent(event);
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs bg-nexus-violet/20 text-nexus-violet border border-nexus-violet/30 hover:bg-nexus-violet/30 transition-colors"
                        >
                          Open Soul Document
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
          <button
            onClick={handleReset}
            className="text-sm text-slate-400 hover:text-slate-300 transition-colors"
          >
            Reset to Defaults
          </button>
          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <span className="text-sm text-amber-400">
                Unsaved changes
              </span>
            )}
            <button
              onClick={() => {
                if (hasUnsavedChanges) {
                  if (confirm('You have unsaved changes. Discard changes?')) {
                    onClose();
                  }
                } else {
                  onClose();
                }
              }}
              className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              className="px-6 py-2 rounded-lg bg-nexus-cyan/20 text-nexus-cyan 
                hover:bg-nexus-cyan/30 border border-nexus-cyan/30
                transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SettingsModal;
