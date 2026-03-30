// =============================================================================
// NEXUS - Renderer Type Declarations
// =============================================================================

import { ElectronAPI } from '../main/preload';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// Ensure this file is treated as a module
export {};
