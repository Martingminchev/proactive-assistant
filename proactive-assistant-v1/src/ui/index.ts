/**
 * UI Module Exports
 * 
 * This module contains all VS Code native UI components:
 * - StatusBarManager: Status bar with state-based animations
 * - PanelProvider: Webview panel management
 * - NotificationManager: Native VS Code notifications (if implemented)
 * - InlineDecorator: Inline code decorations and code lens (if implemented)
 */

export { 
  StatusBarManager, 
  type StatusBarState,
  type StatusBarConfig 
} from './statusBar';

export { 
  PanelProvider,
  type PanelMessage,
  type ExtensionMessage
} from './panelProvider';

// Future UI components can be exported here:
// export { NotificationManager } from './notifications';
// export { InlineDecorator } from './inlineDecorations';
