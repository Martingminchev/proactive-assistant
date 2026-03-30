// =============================================================================
// NEXUS - Proactive Store
// State management for proactive agent settings
// =============================================================================

import { create } from 'zustand';
import { ProactiveAgentConfig, DEFAULT_PROACTIVE_CONFIG } from '../../shared/types';

interface ProactiveState {
  config: ProactiveAgentConfig;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadConfig: () => Promise<void>;
  updateConfig: (config: Partial<ProactiveAgentConfig>) => Promise<boolean>;
  setEnabled: (enabled: boolean) => Promise<boolean>;
  setInterval: (minutes: number) => Promise<boolean>;
  setMaxSuggestions: (max: number) => Promise<boolean>;
}

export const useProactiveStore = create<ProactiveState>((set, get) => ({
  config: DEFAULT_PROACTIVE_CONFIG,
  isLoading: false,
  error: null,

  loadConfig: async () => {
    set({ isLoading: true, error: null });
    try {
      const config = await window.electronAPI?.getProactiveConfig();
      if (config) {
        set({ config, isLoading: false });
      } else {
        set({ config: DEFAULT_PROACTIVE_CONFIG, isLoading: false });
      }
    } catch (error) {
      console.error('[ProactiveStore] Failed to load config:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load config',
        isLoading: false 
      });
    }
  },

  updateConfig: async (updates) => {
    const currentConfig = get().config;
    const newConfig = { ...currentConfig, ...updates };
    
    // Optimistic update
    set({ config: newConfig });
    
    try {
      const updatedConfig = await window.electronAPI?.updateProactiveConfig(updates);
      if (updatedConfig) {
        set({ config: updatedConfig });
        return true;
      }
      // Revert on failure
      set({ config: currentConfig });
      return false;
    } catch (error) {
      console.error('[ProactiveStore] Failed to update config:', error);
      set({ 
        config: currentConfig,
        error: error instanceof Error ? error.message : 'Failed to update config'
      });
      return false;
    }
  },

  setEnabled: async (enabled) => {
    return get().updateConfig({ enabled });
  },

  setInterval: async (intervalMinutes) => {
    return get().updateConfig({ intervalMinutes });
  },

  setMaxSuggestions: async (maxSuggestionsPerHour) => {
    return get().updateConfig({ maxSuggestionsPerHour });
  },
}));

export default useProactiveStore;
