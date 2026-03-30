// =============================================================================
// NEXUS - Personality Store
// State management for personality and soul document
// =============================================================================

import { create } from 'zustand';
import { 
  PersonalitySettings, 
  SoulDocument, 
  DEFAULT_PERSONALITY_SETTINGS,
  DEFAULT_SOUL_DOCUMENT,
  FormalityLevel,
  HumorLevel,
  EmpathyLevel,
  VerbosityLevel,
} from '../../shared/types';

interface PersonalityState {
  // Personality settings
  personality: PersonalitySettings;
  isLoadingPersonality: boolean;
  
  // Soul document
  soulDocument: SoulDocument;
  isLoadingSoulDocument: boolean;
  
  error: string | null;
  
  // Personality actions
  loadPersonality: () => Promise<void>;
  updatePersonality: (updates: Partial<PersonalitySettings>) => Promise<boolean>;
  setFormality: (formality: FormalityLevel) => Promise<boolean>;
  setHumor: (humor: HumorLevel) => Promise<boolean>;
  setEmpathy: (empathy: EmpathyLevel) => Promise<boolean>;
  setVerbosity: (verbosity: VerbosityLevel) => Promise<boolean>;
  toggleBehavior: (key: keyof PersonalitySettings) => Promise<boolean>;
  
  // Soul document actions
  loadSoulDocument: () => Promise<void>;
  updateSoulDocument: (content: string) => Promise<boolean>;
  resetSoulDocument: () => Promise<boolean>;
  aiUpdateSoulDocument: (section: string, content: string) => Promise<boolean>;
}

export const usePersonalityStore = create<PersonalityState>((set, get) => ({
  personality: DEFAULT_PERSONALITY_SETTINGS,
  isLoadingPersonality: false,
  soulDocument: DEFAULT_SOUL_DOCUMENT,
  isLoadingSoulDocument: false,
  error: null,

  // ==========================================================================
  // Personality Actions
  // ==========================================================================

  loadPersonality: async () => {
    set({ isLoadingPersonality: true, error: null });
    try {
      const personality = await window.electronAPI?.getPersonality();
      if (personality) {
        set({ personality, isLoadingPersonality: false });
      } else {
        set({ personality: DEFAULT_PERSONALITY_SETTINGS, isLoadingPersonality: false });
      }
    } catch (error) {
      console.error('[PersonalityStore] Failed to load personality:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load personality',
        isLoadingPersonality: false 
      });
    }
  },

  updatePersonality: async (updates) => {
    const currentPersonality = get().personality;
    const newPersonality = { ...currentPersonality, ...updates };
    
    // Optimistic update
    set({ personality: newPersonality });
    
    try {
      const updatedPersonality = await window.electronAPI?.updatePersonality(updates);
      if (updatedPersonality) {
        set({ personality: updatedPersonality });
        return true;
      }
      // Revert on failure
      set({ personality: currentPersonality });
      return false;
    } catch (error) {
      console.error('[PersonalityStore] Failed to update personality:', error);
      set({ 
        personality: currentPersonality,
        error: error instanceof Error ? error.message : 'Failed to update personality'
      });
      return false;
    }
  },

  setFormality: async (formality) => {
    return get().updatePersonality({ formality });
  },

  setHumor: async (humor) => {
    return get().updatePersonality({ humor });
  },

  setEmpathy: async (empathy) => {
    return get().updatePersonality({ empathy });
  },

  setVerbosity: async (verbosity) => {
    return get().updatePersonality({ verbosity });
  },

  toggleBehavior: async (key) => {
    const current = get().personality[key];
    if (typeof current === 'boolean') {
      return get().updatePersonality({ [key]: !current } as Partial<PersonalitySettings>);
    }
    return false;
  },

  // ==========================================================================
  // Soul Document Actions
  // ==========================================================================

  loadSoulDocument: async () => {
    set({ isLoadingSoulDocument: true, error: null });
    try {
      const soulDocument = await window.electronAPI?.getSoulDocument();
      if (soulDocument) {
        set({ soulDocument, isLoadingSoulDocument: false });
      } else {
        set({ soulDocument: DEFAULT_SOUL_DOCUMENT, isLoadingSoulDocument: false });
      }
    } catch (error) {
      console.error('[PersonalityStore] Failed to load soul document:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load soul document',
        isLoadingSoulDocument: false 
      });
    }
  },

  updateSoulDocument: async (content) => {
    const currentDoc = get().soulDocument;
    
    try {
      const updatedDoc = await window.electronAPI?.updateSoulDocument(content);
      if (updatedDoc) {
        set({ soulDocument: updatedDoc });
        return true;
      }
      return false;
    } catch (error) {
      console.error('[PersonalityStore] Failed to update soul document:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update soul document'
      });
      return false;
    }
  },

  resetSoulDocument: async () => {
    try {
      const resetDoc = await window.electronAPI?.resetSoulDocument();
      if (resetDoc) {
        set({ soulDocument: resetDoc });
        return true;
      }
      return false;
    } catch (error) {
      console.error('[PersonalityStore] Failed to reset soul document:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to reset soul document'
      });
      return false;
    }
  },

  aiUpdateSoulDocument: async (section, content) => {
    try {
      const updatedDoc = await window.electronAPI?.aiUpdateSoulDocument(section, content);
      if (updatedDoc) {
        set({ soulDocument: updatedDoc });
        return true;
      }
      return false;
    } catch (error) {
      console.error('[PersonalityStore] Failed to AI update soul document:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update soul document'
      });
      return false;
    }
  },
}));

export default usePersonalityStore;
