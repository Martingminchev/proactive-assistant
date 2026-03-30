// =============================================================================
// NEXUS - Toast Notification Store
// Manages toast notifications for user feedback
// =============================================================================

import { create } from 'zustand';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastState {
  toasts: Toast[];
  
  // Actions
  showToast: (message: string, type: ToastType, duration?: number, action?: Toast['action']) => void;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
}

// Generate unique ID for toasts
const generateId = () => `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  showToast: (message: string, type: ToastType = 'info', duration = 5000, action?: Toast['action']) => {
    const id = generateId();
    const toast: Toast = { id, message, type, duration, action };
    
    set((state) => ({
      toasts: [...state.toasts, toast],
    }));

    // Auto-dismiss after duration (unless it's an error with action)
    if (duration > 0) {
      setTimeout(() => {
        get().dismissToast(id);
      }, duration);
    }
  },

  dismissToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  clearAllToasts: () => {
    set({ toasts: [] });
  },
}));

// Convenience helpers for different toast types
export const showSuccess = (message: string, duration?: number) => {
  useToastStore.getState().showToast(message, 'success', duration);
};

export const showError = (message: string, duration?: number, action?: Toast['action']) => {
  useToastStore.getState().showToast(message, 'error', duration === undefined ? 8000 : duration, action);
};

export const showWarning = (message: string, duration?: number) => {
  useToastStore.getState().showToast(message, 'warning', duration);
};

export const showInfo = (message: string, duration?: number) => {
  useToastStore.getState().showToast(message, 'info', duration);
};
