import { useEffect, useState, useCallback } from 'react';
import type { VSCodeThemeColors } from '../types';

export type ThemeKind = 'dark' | 'light' | 'high-contrast' | 'high-contrast-light';

// Default theme colors as fallback
const defaultDarkColors: VSCodeThemeColors = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  editorBackground: '#1e1e1e',
  editorForeground: '#d4d4d4',
  sidebarBackground: '#252526',
  sidebarForeground: '#cccccc',
  border: '#454545',
  buttonBackground: '#0e639c',
  buttonForeground: '#ffffff',
  buttonHoverBackground: '#1177bb',
  inputBackground: '#3c3c3c',
  inputForeground: '#cccccc',
  inputBorder: '#3c3c3c',
  focusBorder: '#007fd4',
  errorForeground: '#f48771',
  warningForeground: '#cca700',
  infoForeground: '#75beff',
  successForeground: '#89d185'
};

const defaultLightColors: VSCodeThemeColors = {
  background: '#ffffff',
  foreground: '#333333',
  editorBackground: '#ffffff',
  editorForeground: '#333333',
  sidebarBackground: '#f3f3f3',
  sidebarForeground: '#333333',
  border: '#e5e5e5',
  buttonBackground: '#007acc',
  buttonForeground: '#ffffff',
  buttonHoverBackground: '#0062a3',
  inputBackground: '#ffffff',
  inputForeground: '#333333',
  inputBorder: '#cecece',
  focusBorder: '#0090f1',
  errorForeground: '#a1260d',
  warningForeground: '#bf8803',
  infoForeground: '#1a85ff',
  successForeground: '#388a34'
};

function getVSCodeCSSVariable(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.body).getPropertyValue(name).trim();
  return value || fallback;
}

export function getThemeColors(): VSCodeThemeColors {
  const isDark = document.body.classList.contains('vscode-dark') || 
                 document.documentElement.classList.contains('vscode-dark');
  const defaults = isDark ? defaultDarkColors : defaultLightColors;

  return {
    background: getVSCodeCSSVariable('--vscode-editor-background', defaults.background),
    foreground: getVSCodeCSSVariable('--vscode-editor-foreground', defaults.foreground),
    editorBackground: getVSCodeCSSVariable('--vscode-editor-background', defaults.editorBackground),
    editorForeground: getVSCodeCSSVariable('--vscode-editor-foreground', defaults.editorForeground),
    sidebarBackground: getVSCodeCSSVariable('--vscode-sideBar-background', defaults.sidebarBackground),
    sidebarForeground: getVSCodeCSSVariable('--vscode-sideBar-foreground', defaults.sidebarForeground),
    border: getVSCodeCSSVariable('--vscode-panel-border', defaults.border),
    buttonBackground: getVSCodeCSSVariable('--vscode-button-background', defaults.buttonBackground),
    buttonForeground: getVSCodeCSSVariable('--vscode-button-foreground', defaults.buttonForeground),
    buttonHoverBackground: getVSCodeCSSVariable('--vscode-button-hoverBackground', defaults.buttonHoverBackground),
    inputBackground: getVSCodeCSSVariable('--vscode-input-background', defaults.inputBackground),
    inputForeground: getVSCodeCSSVariable('--vscode-input-foreground', defaults.inputForeground),
    inputBorder: getVSCodeCSSVariable('--vscode-input-border', defaults.inputBorder),
    focusBorder: getVSCodeCSSVariable('--vscode-focusBorder', defaults.focusBorder),
    errorForeground: getVSCodeCSSVariable('--vscode-errorForeground', defaults.errorForeground),
    warningForeground: getVSCodeCSSVariable('--vscode-editorWarning-foreground', defaults.warningForeground),
    infoForeground: getVSCodeCSSVariable('--vscode-editorInfo-foreground', defaults.infoForeground),
    successForeground: getVSCodeCSSVariable('--vscode-testing-iconPassed', defaults.successForeground)
  };
}

export function useTheme() {
  const [themeKind, setThemeKind] = useState<ThemeKind>('dark');
  const [colors, setColors] = useState<VSCodeThemeColors>(defaultDarkColors);

  const detectTheme = useCallback(() => {
    const body = document.body;
    const html = document.documentElement;

    if (body.classList.contains('vscode-high-contrast') || html.classList.contains('vscode-high-contrast')) {
      setThemeKind('high-contrast');
    } else if (body.classList.contains('vscode-high-contrast-light') || html.classList.contains('vscode-high-contrast-light')) {
      setThemeKind('high-contrast-light');
    } else if (body.classList.contains('vscode-dark') || html.classList.contains('vscode-dark')) {
      setThemeKind('dark');
    } else {
      setThemeKind('light');
    }

    setColors(getThemeColors());
  }, []);

  useEffect(() => {
    // Initial detection
    detectTheme();

    // Watch for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          detectTheme();
        }
      });
    });

    observer.observe(document.body, { attributes: true });
    observer.observe(document.documentElement, { attributes: true });

    return () => observer.disconnect();
  }, [detectTheme]);

  // Listen for theme change messages from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'theme-changed') {
        detectTheme();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [detectTheme]);

  const isDark = themeKind === 'dark' || themeKind === 'high-contrast';
  const isHighContrast = themeKind === 'high-contrast' || themeKind === 'high-contrast-light';

  return {
    themeKind,
    colors,
    isDark,
    isHighContrast,
    isLight: !isDark,
    refresh: detectTheme
  };
}

// Hook for reduced motion preference
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return reducedMotion;
}
