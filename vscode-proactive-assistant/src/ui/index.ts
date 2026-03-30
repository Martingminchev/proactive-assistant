/**
 * UI Module Exports
 * 
 * This module contains all VS Code native UI components:
 * - StatusBarManager: Status bar with state-based animations
 * - PanelProvider: Webview panel management
 * - NotificationManager: Native VS Code notifications (if implemented)
 * - InlineDecorator: Inline code decorations and code lens (if implemented)
 */

// Re-export StatusBarManager from services and types
export { StatusBarManager } from '../services/statusBarManager';
export { type StatusBarState, type StatusBarConfig } from '../types';

export { 
  PanelProvider,
  type WebviewMessage
} from './panelProvider';

// Future UI components can be exported here:
// export { NotificationManager } from './notifications';
// export { InlineDecorator } from './inlineDecorations';
