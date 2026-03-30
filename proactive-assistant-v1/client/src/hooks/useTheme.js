import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'proactive-assistant-theme';

/**
 * Hook for theme management (dark/light mode)
 */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    // Check localStorage first, then system preference
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved;
    
    return window.matchMedia('(prefers-color-scheme: dark)').matches 
      ? 'dark' 
      : 'light';
  });

  useEffect(() => {
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  const set = useCallback((newTheme) => {
    if (['dark', 'light'].includes(newTheme)) {
      setTheme(newTheme);
    }
  }, []);

  return {
    theme,
    isDark: theme === 'dark',
    isLight: theme === 'light',
    toggle,
    set,
  };
}

export default useTheme;
