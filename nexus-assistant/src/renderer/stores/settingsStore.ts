// =============================================================================
// NEXUS - Settings Store
// Manages application settings and API configuration with validation
// =============================================================================

import { create } from 'zustand';
import { AppSettings, DEFAULT_SETTINGS } from '../../shared/types';
import { showSuccess, showError, showInfo } from './toastStore';
import { logger, logIpcCall, logIpcError, logIpcResponse } from '../utils/logger';

interface ValidationResult {
  valid: boolean;
  error?: string;
}

interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  validationErrors: Partial<Record<keyof AppSettings, string>>;
  
  // Connection status
  apiKeyStatus: 'unknown' | 'valid' | 'invalid';
  piecesStatus: 'unknown' | 'connected' | 'disconnected';
  
  // Actions
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<boolean>;
  testApiKey: (apiKey: string, baseUrl?: string) => Promise<boolean>;
  resetSettings: () => Promise<void>;
  validateSettings: (settings: Partial<AppSettings>) => ValidationResult;
  checkApiKeyStatus: () => Promise<void>;
  checkPiecesStatus: () => Promise<void>;
  clearValidationErrors: () => void;
}

// Validation helpers
const validateApiKey = (apiKey: string, baseUrl?: string): ValidationResult => {
  if (!apiKey || apiKey.trim() === '') {
    return { valid: false, error: 'API key is required' };
  }
  
  // Check key prefix based on provider
  if (baseUrl?.includes('synthetic')) {
    // Synthetic keys start with "syn_"
    if (!apiKey.startsWith('syn_')) {
      return { valid: false, error: 'Synthetic API key must start with "syn_"' };
    }
  } else {
    // Moonshot keys start with "sk-"
    if (!apiKey.startsWith('sk-')) {
      return { valid: false, error: 'API key must start with "sk-"' };
    }
  }
  
  if (apiKey.length < 20) {
    return { valid: false, error: 'API key appears to be too short' };
  }
  
  return { valid: true };
};

const validatePort = (port: number): ValidationResult => {
  if (port < 1 || port > 65535) {
    return { valid: false, error: 'Port must be between 1 and 65535' };
  }
  return { valid: true };
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  isLoading: false,
  isSaving: false,
  error: null,
  validationErrors: {},
  apiKeyStatus: 'unknown',
  piecesStatus: 'unknown',

  loadSettings: async () => {
    logger.info('Loading settings...');
    set({ isLoading: true, error: null });
    
    try {
      logIpcCall('getSettings');
      const startTime = Date.now();
      const settings = await window.electronAPI?.getSettings();
      logIpcResponse('getSettings', 'success', Date.now() - startTime);
      
      if (settings) {
        // Deep merge to ensure all fields exist
        const mergedSettings = { 
          ...DEFAULT_SETTINGS, 
          ...settings,
          // Ensure nested arrays/objects are properly merged
          trackedDirectories: settings.trackedDirectories || DEFAULT_SETTINGS.trackedDirectories,
        };
        
        set({ 
          settings: mergedSettings,
          isLoading: false,
        });
        logger.info('Settings loaded successfully', { 
          baseUrl: mergedSettings.kimiBaseUrl,
          hasApiKey: !!mergedSettings.kimiApiKey,
          defaultModel: mergedSettings.defaultModel,
        });
        
        // Check connection statuses
        await get().checkApiKeyStatus();
        await get().checkPiecesStatus();
      } else {
        logger.warn('No settings returned, using defaults');
        set({ 
          settings: DEFAULT_SETTINGS,
          isLoading: false,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to load settings:', error);
      logIpcError('getSettings', error);
      
      set({ 
        isLoading: false, 
        error: errorMessage,
        settings: DEFAULT_SETTINGS,
      });
      
      showError('Failed to load settings. Using defaults.', 6000);
    }
  },

  validateSettings: (newSettings: Partial<AppSettings>): ValidationResult => {
    const { settings } = get();
    const errors: Partial<Record<keyof AppSettings, string>> = {};
    
    // Determine base URL (use new value if provided, else current)
    const baseUrl = newSettings.kimiBaseUrl ?? settings.kimiBaseUrl;
    
    // Validate API key if provided
    if (newSettings.kimiApiKey !== undefined) {
      const apiKeyValidation = validateApiKey(newSettings.kimiApiKey, baseUrl);
      if (!apiKeyValidation.valid) {
        errors.kimiApiKey = apiKeyValidation.error;
      }
    }
    
    // Validate port if provided
    if (newSettings.piecesPort !== undefined) {
      const portValidation = validatePort(newSettings.piecesPort);
      if (!portValidation.valid) {
        errors.piecesPort = portValidation.error;
      }
    }
    
    set({ validationErrors: errors });
    
    if (Object.keys(errors).length > 0) {
      return { 
        valid: false, 
        error: 'Please fix the validation errors before saving' 
      };
    }
    
    return { valid: true };
  },

  updateSettings: async (newSettings: Partial<AppSettings>) => {
    const { validateSettings, settings } = get();
    
    logger.info('Updating settings...', Object.keys(newSettings));
    set({ isSaving: true, error: null });
    
    // Validate before saving
    const validation = validateSettings(newSettings);
    if (!validation.valid) {
      logger.warn('Settings validation failed:', validation.error);
      set({ isSaving: false });
      showError(validation.error || 'Validation failed', 5000);
      return false;
    }
    
    // Special handling for API key changes
    if (newSettings.kimiApiKey !== undefined && newSettings.kimiApiKey !== settings.kimiApiKey) {
      const baseUrl = newSettings.kimiBaseUrl ?? settings.kimiBaseUrl;
      const apiKeyValidation = validateApiKey(newSettings.kimiApiKey, baseUrl);
      if (!apiKeyValidation.valid) {
        logger.warn('API key validation failed:', apiKeyValidation.error);
        set({ 
          isSaving: false,
          validationErrors: { kimiApiKey: apiKeyValidation.error },
        });
        showError(apiKeyValidation.error || 'Invalid API key', 5000);
        return false;
      }
    }
    
    try {
      logIpcCall('updateSettings', Object.keys(newSettings));
      const startTime = Date.now();
      
      // Merge with current settings to ensure we send complete settings object
      const settingsToUpdate = { ...settings, ...newSettings };
      const updated = await window.electronAPI?.updateSettings(settingsToUpdate);
      
      logIpcResponse('updateSettings', 'success', Date.now() - startTime);
      
      if (updated) {
        set((state) => ({ 
          settings: { ...state.settings, ...updated },
          isSaving: false,
          validationErrors: {},
        }));
        
        logger.info('Settings saved successfully', {
          baseUrl: updated.kimiBaseUrl,
          hasApiKey: !!updated.kimiApiKey,
          defaultModel: updated.defaultModel,
        });
        
        showSuccess('Settings saved successfully', 3000);
        
        // Re-check connection statuses after settings update
        await get().checkApiKeyStatus();
        await get().checkPiecesStatus();
        
        return true;
      } else {
        throw new Error('No response from settings update');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update settings:', error);
      logIpcError('updateSettings', error);
      
      set({ 
        isSaving: false, 
        error: errorMessage,
      });
      
      showError(`Failed to save settings: ${errorMessage}`, 8000, {
        label: 'Retry',
        onClick: () => get().updateSettings(newSettings),
      });
      
      return false;
    }
  },

  testApiKey: async (apiKey: string, baseUrl?: string) => {
    if (!apiKey) {
      showError('Please enter an API key to test', 3000);
      return false;
    }
    
    // Get base URL from settings if not provided
    const url = baseUrl || get().settings.kimiBaseUrl;
    
    // Basic validation
    const validation = validateApiKey(apiKey, url);
    if (!validation.valid) {
      showError(validation.error || 'Invalid API key format', 5000);
      return false;
    }
    
    logger.info('Testing API key...', { baseUrl: url, keyPrefix: apiKey.slice(0, 5) });
    set({ isLoading: true, apiKeyStatus: 'unknown' });
    
    try {
      logIpcCall('validateApiKey');
      const startTime = Date.now();
      const result = await window.electronAPI?.validateApiKey(apiKey, url);
      logIpcResponse('validateApiKey', result?.valid ? 'valid' : 'invalid', Date.now() - startTime);
      
      set({ isLoading: false });
      
      if (result?.valid) {
        logger.info('API key is valid');
        set({ apiKeyStatus: 'valid' });
        showSuccess('API key is valid! Remember to save your changes.', 4000);
        return true;
      } else {
        logger.warn('API key is invalid:', result?.error);
        set({ apiKeyStatus: 'invalid' });
        showError(`Invalid API key: ${result?.error || 'Unknown error'}`, 6000);
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('API key test failed:', error);
      logIpcError('validateApiKey', error);
      
      set({ 
        isLoading: false,
        apiKeyStatus: 'invalid',
      });
      
      showError(`API test failed: ${errorMessage}`, 6000);
      return false;
    }
  },

  checkApiKeyStatus: async () => {
    const { settings } = get();
    
    if (!settings.kimiApiKey) {
      set({ apiKeyStatus: 'unknown' });
      return;
    }
    
    try {
      const result = await window.electronAPI?.validateApiKey(
        settings.kimiApiKey, 
        settings.kimiBaseUrl
      );
      set({ apiKeyStatus: result?.valid ? 'valid' : 'invalid' });
    } catch (error) {
      logger.warn('Failed to check API key status:', error);
      set({ apiKeyStatus: 'invalid' });
    }
  },

  checkPiecesStatus: async () => {
    const { settings } = get();
    
    if (!settings.piecesEnabled) {
      set({ piecesStatus: 'unknown' });
      return;
    }
    
    try {
      const status = await window.electronAPI?.getPiecesStatus();
      set({ piecesStatus: status?.available ? 'connected' : 'disconnected' });
    } catch (error) {
      logger.warn('Failed to check Pieces status:', error);
      set({ piecesStatus: 'disconnected' });
    }
  },

  resetSettings: async () => {
    logger.info('Resetting settings to defaults...');
    set({ isLoading: true });
    
    try {
      logIpcCall('resetSettings');
      const settings = await window.electronAPI?.resetSettings();
      
      if (settings) {
        set({ 
          settings,
          isLoading: false,
          error: null,
          validationErrors: {},
          apiKeyStatus: 'unknown',
        });
        
        logger.info('Settings reset to defaults');
        showSuccess('Settings reset to defaults', 3000);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to reset settings:', error);
      logIpcError('resetSettings', error);
      
      set({ 
        isLoading: false, 
        error: errorMessage,
      });
      
      showError(`Failed to reset settings: ${errorMessage}`, 6000);
    }
  },

  clearValidationErrors: () => {
    set({ validationErrors: {}, error: null });
  },
}));
