// =============================================================================
// NEXUS - Sidebar Store
// State for collapsible sidebar; mode syncs from main (electron-store)
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AssistantMode } from '../../shared/types';

interface SidebarState {
  isOpen: boolean;
  mode: AssistantMode;
  setOpen: (open: boolean) => void;
  setMode: (mode: AssistantMode) => void;
  toggle: () => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isOpen: true,
      mode: 'suggestions',
      setOpen: (open) => set({ isOpen: open }),
      setMode: (mode) => set({ mode }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
    }),
    { name: 'nexus-sidebar', partialize: (s) => ({ isOpen: s.isOpen }) }
  )
);
