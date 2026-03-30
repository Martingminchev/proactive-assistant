import { useEffect, useState } from 'react';

/**
 * VS Code theme kinds
 */
export type ThemeKind = 'vs-dark' | 'vs-light' | 'hc-dark' | 'hc-light';

/**
 * Theme configuration
 */
interface ThemeConfig {
  kind: ThemeKind;
  isDark: boolean;
  isHighContrast: boolean;
}

/**
 * Hook for VS Code theme integration
 */
export function useTheme() {
  const [theme, setTheme] = useState<ThemeKind>('vs-dark');
  const [config, setConfig] = useState<ThemeConfig>({
    kind: 'vs-dark',
    isDark: true,
    isHighContrast: false,
  });

  useEffect(() => {
    // Check for theme attribute on body (set by extension)
    const updateThemeFromBody = () => {
      const bodyTheme = document.body.getAttribute('data-theme') as ThemeKind;
      if (bodyTheme) {
        setTheme(bodyTheme);
        setConfig({
          kind: bodyTheme,
          isDark: bodyTheme === 'vs-dark' || bodyTheme === 'hc-dark',
          isHighContrast: bodyTheme === 'hc-dark' || bodyTheme === 'hc-light',
        });
      }
    };

    // Initial check
    updateThemeFromBody();

    // Watch for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          updateThemeFromBody();
        }
      });
    });

    observer.observe(document.body, { attributes: true });

    // Listen for theme change messages from extension
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'themeChanged') {
        const newTheme = event.data.payload?.theme as ThemeKind;
        if (newTheme) {
          document.body.setAttribute('data-theme', newTheme);
          updateThemeFromBody();
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      observer.disconnect();
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  /**
   * Get CSS variable value
   */
  const getCssVariable = (name: string): string => {
    return getComputedStyle(document.body).getPropertyValue(name).trim();
  };

  /**
   * Get color with fallback
   */
  const getColor = (vscodeColor: string, fallback: string): string => {
    const value = getCssVariable(vscodeColor);
    return value || fallback;
  };

  return {
    theme,
    ...config,
    getCssVariable,
    getColor,
  };
}

/**
 * Common VS Code CSS variables for reference
 */
export const vscodeCssVariables = {
  // Background colors
  editorBackground: '--vscode-editor-background',
  editorForeground: '--vscode-editor-foreground',
  sideBarBackground: '--vscode-sideBar-background',
  sideBarForeground: '--vscode-sideBar-foreground',
  activityBarBackground: '--vscode-activityBar-background',
  statusBarBackground: '--vscode-statusBar-background',
  panelBackground: '--vscode-panel-background',
  
  // Border colors
  borderColor: '--vscode-panel-border',
  inputBorder: '--vscode-input-border',
  buttonBorder: '--vscode-button-border',
  
  // Button colors
  buttonBackground: '--vscode-button-background',
  buttonForeground: '--vscode-button-foreground',
  buttonHoverBackground: '--vscode-button-hoverBackground',
  buttonSecondaryBackground: '--vscode-button-secondaryBackground',
  buttonSecondaryForeground: '--vscode-button-secondaryForeground',
  buttonSecondaryHoverBackground: '--vscode-button-secondaryHoverBackground',
  
  // Input colors
  inputBackground: '--vscode-input-background',
  inputForeground: '--vscode-input-foreground',
  inputPlaceholderForeground: '--vscode-input-placeholderForeground',
  
  // Accent colors
  focusBorder: '--vscode-focusBorder',
  listActiveSelectionBackground: '--vscode-list-activeSelectionBackground',
  listActiveSelectionForeground: '--vscode-list-activeSelectionForeground',
  listHoverBackground: '--vscode-list-hoverBackground',
  
  // Badge colors
  badgeBackground: '--vscode-badge-background',
  badgeForeground: '--vscode-badge-foreground',
  
  // Error/Warning colors
  errorForeground: '--vscode-errorForeground',
  warningForeground: '--vscode-editorWarning-foreground',
  infoForeground: '--vscode-editorInfo-foreground',
};

export default useTheme;
