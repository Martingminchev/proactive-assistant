// =============================================================================
// NEXUS - Keyboard Shortcut Hooks
// Reusable hooks for keyboard shortcuts with proper input detection
// =============================================================================

import React, { useEffect, useCallback, useRef } from 'react';

// =============================================================================
// Input Detection Helper
// =============================================================================

const isInputElement = (element: EventTarget | null): boolean => {
  if (!(element instanceof HTMLElement)) return false;
  
  const tagName = element.tagName.toLowerCase();
  const isContentEditable = element.isContentEditable;
  const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select';
  
  return isInput || isContentEditable;
};

// =============================================================================
// useKeyboardShortcut Hook
// =============================================================================

interface ShortcutOptions {
  key: string;
  modifier?: 'ctrl' | 'meta' | 'alt' | 'shift' | null;
  preventDefault?: boolean;
  allowInInputs?: boolean;
}

export const useKeyboardShortcut = (
  options: ShortcutOptions,
  callback: () => void
): void => {
  const { key, modifier, preventDefault = true, allowInInputs = false } = options;
  const callbackRef = useRef(callback);
  
  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if key matches
      if (event.key.toLowerCase() !== key.toLowerCase()) return;
      
      // Check modifier
      const ctrlPressed = event.ctrlKey;
      const metaPressed = event.metaKey;
      const altPressed = event.altKey;
      const shiftPressed = event.shiftKey;
      
      let modifierPressed = false;
      
      switch (modifier) {
        case 'ctrl':
          modifierPressed = ctrlPressed && !metaPressed && !altPressed;
          break;
        case 'meta':
          modifierPressed = metaPressed && !ctrlPressed && !altPressed;
          break;
        case 'alt':
          modifierPressed = altPressed && !ctrlPressed && !metaPressed;
          break;
        case 'shift':
          modifierPressed = shiftPressed && !ctrlPressed && !metaPressed && !altPressed;
          break;
        case null:
        case undefined:
          modifierPressed = !ctrlPressed && !metaPressed && !altPressed && !shiftPressed;
          break;
        default:
          modifierPressed = false;
      }
      
      if (!modifierPressed) return;
      
      // Check if we're in an input element
      if (!allowInInputs && isInputElement(event.target)) {
        return;
      }
      
      // Execute callback
      if (preventDefault) {
        event.preventDefault();
      }
      
      callbackRef.current();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key, modifier, preventDefault, allowInInputs]);
};

// =============================================================================
// useSearchShortcut Hook
// =============================================================================

export const useSearchShortcut = (onSearch: () => void): void => {
  // Use Cmd+K on Mac, Ctrl+K on Windows/Linux
  const modifier = navigator.platform.includes('Mac') ? 'meta' : 'ctrl';
  
  useKeyboardShortcut(
    { key: 'k', modifier, preventDefault: true, allowInInputs: false },
    onSearch
  );
};

// =============================================================================
// useEscapeKey Hook
// =============================================================================

export const useEscapeKey = (onEscape: () => void, enabled: boolean = true): void => {
  const callbackRef = useRef(onEscape);
  
  useEffect(() => {
    callbackRef.current = onEscape;
  }, [onEscape]);
  
  useEffect(() => {
    if (!enabled) return;
    
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        callbackRef.current();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
};

// =============================================================================
// useArrowNavigation Hook
// =============================================================================

interface ArrowNavigationOptions {
  itemCount: number;
  onSelect: (index: number) => void;
  enabled: boolean;
}

export const useArrowNavigation = (
  options: ArrowNavigationOptions
): { selectedIndex: number; setSelectedIndex: (index: number) => void } => {
  const { itemCount, onSelect, enabled } = options;
  const [selectedIndex, setSelectedIndex] = React.useState(-1);
  
  useEffect(() => {
    if (!enabled) {
      setSelectedIndex(-1);
      return;
    }
    
    const handleKeyDown = (event: KeyboardEvent) => {
      if (itemCount === 0) return;
      
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex(prev => {
            const newIndex = prev < itemCount - 1 ? prev + 1 : 0;
            return newIndex;
          });
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex(prev => {
            const newIndex = prev > 0 ? prev - 1 : itemCount - 1;
            return newIndex;
          });
          break;
        case 'Enter':
          if (selectedIndex >= 0 && selectedIndex < itemCount) {
            event.preventDefault();
            onSelect(selectedIndex);
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [itemCount, onSelect, enabled, selectedIndex]);
  
  // Reset selection when item count changes
  useEffect(() => {
    if (selectedIndex >= itemCount) {
      setSelectedIndex(-1);
    }
  }, [itemCount, selectedIndex]);
  
  return { selectedIndex, setSelectedIndex };
};

export default useKeyboardShortcut;
