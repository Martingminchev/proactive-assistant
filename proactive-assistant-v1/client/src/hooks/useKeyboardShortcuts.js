import { useEffect, useCallback } from 'react';

/**
 * Hook for keyboard shortcuts
 * 
 * Usage:
 * useKeyboardShortcuts({
 *   'mod+g': () => generateBrief(),
 *   'mod+h': () => setView('history'),
 *   'escape': () => closeModal(),
 * });
 */
export function useKeyboardShortcuts(shortcuts, enabled = true) {
  const handleKeyDown = useCallback((e) => {
    if (!enabled) return;

    // Don't trigger shortcuts when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }

    const key = [];
    
    if (e.metaKey || e.ctrlKey) key.push('mod');
    if (e.altKey) key.push('alt');
    if (e.shiftKey) key.push('shift');
    
    // Map special keys
    const keyMap = {
      ' ': 'space',
      'Escape': 'escape',
      'Enter': 'enter',
      'Tab': 'tab',
      'ArrowUp': 'up',
      'ArrowDown': 'down',
      'ArrowLeft': 'left',
      'ArrowRight': 'right',
    };
    
    const keyName = keyMap[e.key] || e.key.toLowerCase();
    key.push(keyName);
    
    const shortcutKey = key.join('+');
    
    if (shortcuts[shortcutKey]) {
      e.preventDefault();
      shortcuts[shortcutKey]();
    }
  }, [shortcuts, enabled]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export default useKeyboardShortcuts;
