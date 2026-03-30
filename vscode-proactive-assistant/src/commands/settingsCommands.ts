import * as vscode from 'vscode';
import type { Services } from '../services';
import { withErrorHandling, ExtensionError, ErrorCodes } from '../utils/errors';

// ============================================================================
// Constants and Types
// ============================================================================

const COMMAND_IDS = {
  OPEN_SETTINGS: 'proactiveAssistant.configure',
  TOGGLE_FOCUS_MODE: 'proactiveAssistant.toggleFocusMode',
  RESET_STATE: 'proactiveAssistant.resetState',
} as const;

type SettingsView = 'vscode' | 'webview' | 'json';

const SETTINGS_CATEGORIES = [
  { label: '$(settings-gear) Open All Settings', description: 'Open VS Code settings with Proactive Assistant filter', value: 'vscode' as SettingsView },
  { label: '$(window) Settings Panel', description: 'Open custom settings webview panel', value: 'webview' as SettingsView },
  { label: '$(symbol-namespace) Focus Mode & Quiet Hours', description: 'Configure when suggestions appear', value: 'focus' as const },
  { label: '$(lightbulb) Suggestion Preferences', description: 'Threshold, categories, and behavior', value: 'suggestions' as const },
  { label: '$(plug) Pieces OS Connection', description: 'Configure Pieces OS integration', value: 'pieces' as const },
  { label: '$(file-code) Advanced', description: 'Open settings.json directly', value: 'json' as SettingsView }
];

const FOCUS_DURATIONS = [
  { label: '$(clock) 15 minutes', value: 15, description: 'Quick focus session' },
  { label: '$(clock) 25 minutes', value: 25, description: 'Pomodoro session' },
  { label: '$(clock) 45 minutes', value: 45, description: 'Deep work session' },
  { label: '$(clock) 60 minutes', value: 60, description: 'Extended focus' },
  { label: '$(edit) Custom...', value: -1, description: 'Enter custom duration' }
];

interface FocusModeState {
  enabled: boolean;
  endTime: Date | null;
  timerInterval: NodeJS.Timeout | null;
  statusBarItem: vscode.StatusBarItem | null;
}

// ============================================================================
// Module-level State
// ============================================================================

// eslint-disable-next-line prefer-const
let focusState: FocusModeState = {
  enabled: false,
  endTime: null,
  timerInterval: null,
  statusBarItem: null
};

const FOCUS_MODE_CONTEXT = 'proactiveAssistant.focusModeEnabled';

// ============================================================================
// Settings Functions
// ============================================================================

async function openVSCodeSettings(): Promise<void> {
  await vscode.commands.executeCommand(
    'workbench.action.openSettings',
    'proactiveAssistant'
  );
}

async function openSettingsJson(): Promise<void> {
  await vscode.commands.executeCommand(
    'workbench.action.openSettingsJson'
  );
}

async function openSettingsCategory(category: string): Promise<void> {
  void category;
  
  switch (category) {
    case 'focus':
      await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        '@ext:proactive-assistant focus quietHours'
      );
      break;
    case 'suggestions':
      await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        '@ext:proactive-assistant interruption snooze'
      );
      break;
    case 'pieces':
      await vscode.commands.executeCommand(
        'workbench.action.openSettings',
        '@ext:proactive-assistant piecesOs'
      );
      break;
    default:
      await openVSCodeSettings();
  }
}

async function openSettingsWebview(services: Services): Promise<void> {
  const panel = vscode.window.createWebviewPanel(
    'proactiveAssistant.settings',
    'Proactive Assistant Settings',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: []
    }
  );

  const config = vscode.workspace.getConfiguration('proactiveAssistant');
  
  panel.webview.html = getSettingsHtml(config);

  panel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.command) {
        case 'updateSetting':
          try {
            const { key, value, global } = message;
            await config.update(key, value, global);
            
            panel.webview.postMessage({
              command: 'settingUpdated',
              key,
              success: true
            });
            
            services.logger.info(`Setting updated: ${key} = ${value}`);
          } catch (error) {
            panel.webview.postMessage({
              command: 'settingUpdated',
              key: message.key,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
          break;
          
        case 'openExternalSettings':
          await openVSCodeSettings();
          break;
          
        case 'resetSettings': {
          const settings = [
            'enabled',
            'focusMode',
            'quietHours.enabled',
            'interruptionThreshold',
            'snoozeDuration',
            'piecesOs.enabled',
            'activityTracking.enabled'
          ];
          
          for (const setting of settings) {
            await config.update(setting, undefined, true);
          }
          
          vscode.window.showInformationMessage('Settings reset to defaults');
          services.logger.info('Settings reset to defaults');
          break;
        }
      }
    },
    undefined,
    services.context.subscriptions
  );
}

function getSettingsHtml(config: vscode.WorkspaceConfiguration): string {
  const enabled = config.get<boolean>('enabled', true);
  void config.get<boolean>('focusMode', false);
  const quietHoursEnabled = config.get<boolean>('quietHours.enabled', false);
  const quietHoursStart = config.get<string>('quietHours.start', '22:00');
  const quietHoursEnd = config.get<string>('quietHours.end', '08:00');
  const threshold = config.get<number>('interruptionThreshold', 0.7);
  const snoozeDuration = config.get<number>('snoozeDuration', 30);
  const piecesEnabled = config.get<boolean>('piecesOs.enabled', true);
  const loggingLevel = config.get<string>('logging.level', 'info');
  const trackingEnabled = config.get<boolean>('activityTracking.enabled', true);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Proactive Assistant Settings</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }
    h1 {
      font-size: 24px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    h2 {
      font-size: 18px;
      margin-top: 30px;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .setting {
      margin-bottom: 20px;
      padding: 15px;
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 6px;
    }
    .setting-label {
      font-weight: 600;
      margin-bottom: 5px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .setting-description {
      font-size: 13px;
      opacity: 0.8;
      margin-bottom: 10px;
    }
    input[type="checkbox"] {
      width: 20px;
      height: 20px;
      cursor: pointer;
    }
    input[type="range"] {
      width: 100%;
      margin: 10px 0;
    }
    input[type="text"], input[type="number"], select {
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      padding: 6px 10px;
      border-radius: 4px;
      font-family: inherit;
      font-size: inherit;
    }
    .range-value {
      text-align: center;
      font-weight: 600;
      color: var(--vscode-textLink-foreground);
    }
    .actions {
      margin-top: 30px;
      display: flex;
      gap: 10px;
    }
    button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-family: inherit;
      font-size: inherit;
    }
    button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    button.secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .success {
      color: var(--vscode-testing-iconPassed);
    }
    .error {
      color: var(--vscode-testing-iconFailed);
    }
  </style>
</head>
<body>
  <h1>⚙️ Proactive Assistant Settings</h1>
  
  <h2>General</h2>
  <div class="setting">
    <div class="setting-label">
      <input type="checkbox" id="enabled" ${enabled ? 'checked' : ''}>
      Enable Proactive Assistant
    </div>
    <div class="setting-description">
      Turn the extension on or off completely
    </div>
  </div>

  <h2>Focus Mode & Quiet Hours</h2>
  <div class="setting">
    <div class="setting-label">
      <input type="checkbox" id="quietHoursEnabled" ${quietHoursEnabled ? 'checked' : ''}>
      Enable Quiet Hours
    </div>
    <div class="setting-description">
      Suppress suggestions during specific times
    </div>
    <div style="display: flex; gap: 15px; margin-top: 10px;">
      <div>
        <label>Start: </label>
        <input type="text" id="quietHoursStart" value="${quietHoursStart}" placeholder="22:00" pattern="([0-1]?[0-9]|2[0-3]):[0-5][0-9]">
      </div>
      <div>
        <label>End: </label>
        <input type="text" id="quietHoursEnd" value="${quietHoursEnd}" placeholder="08:00" pattern="([0-1]?[0-9]|2[0-3]):[0-5][0-9]">
      </div>
    </div>
  </div>

  <h2>Suggestions</h2>
  <div class="setting">
    <div class="setting-label">Interruption Threshold</div>
    <div class="setting-description">
      Minimum confidence required before showing a suggestion (0-1)
    </div>
    <input type="range" id="threshold" min="0" max="1" step="0.1" value="${threshold}">
    <div class="range-value" id="thresholdValue">${threshold}</div>
  </div>
  
  <div class="setting">
    <div class="setting-label">Default Snooze Duration (minutes)</div>
    <input type="number" id="snoozeDuration" value="${snoozeDuration}" min="5" max="240">
  </div>

  <h2>Integration</h2>
  <div class="setting">
    <div class="setting-label">
      <input type="checkbox" id="piecesEnabled" ${piecesEnabled ? 'checked' : ''}>
      Enable Pieces OS Integration
    </div>
    <div class="setting-description">
      Connect to Pieces OS for enhanced AI capabilities
    </div>
  </div>

  <h2>Advanced</h2>
  <div class="setting">
    <div class="setting-label">Logging Level</div>
    <select id="loggingLevel">
      <option value="debug" ${loggingLevel === 'debug' ? 'selected' : ''}>Debug</option>
      <option value="info" ${loggingLevel === 'info' ? 'selected' : ''}>Info</option>
      <option value="warn" ${loggingLevel === 'warn' ? 'selected' : ''}>Warning</option>
      <option value="error" ${loggingLevel === 'error' ? 'selected' : ''}>Error</option>
    </select>
  </div>
  
  <div class="setting">
    <div class="setting-label">
      <input type="checkbox" id="trackingEnabled" ${trackingEnabled ? 'checked' : ''}>
      Enable Activity Tracking
    </div>
    <div class="setting-description">
      Track coding activity for better suggestions
    </div>
  </div>

  <div class="actions">
    <button onclick="saveSettings()">Save Settings</button>
    <button class="secondary" onclick="openVSCodeSettings()">Open VS Code Settings</button>
    <button class="secondary" onclick="resetSettings()">Reset to Defaults</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    document.getElementById('threshold').addEventListener('input', (e) => {
      document.getElementById('thresholdValue').textContent = e.target.value;
    });

    function saveSettings() {
      const settings = [
        { key: 'enabled', value: document.getElementById('enabled').checked },
        { key: 'quietHours.enabled', value: document.getElementById('quietHoursEnabled').checked },
        { key: 'quietHours.start', value: document.getElementById('quietHoursStart').value },
        { key: 'quietHours.end', value: document.getElementById('quietHoursEnd').value },
        { key: 'interruptionThreshold', value: parseFloat(document.getElementById('threshold').value) },
        { key: 'snoozeDuration', value: parseInt(document.getElementById('snoozeDuration').value) },
        { key: 'piecesOs.enabled', value: document.getElementById('piecesEnabled').checked },
        { key: 'logging.level', value: document.getElementById('loggingLevel').value },
        { key: 'activityTracking.enabled', value: document.getElementById('trackingEnabled').checked }
      ];

      settings.forEach(s => {
        vscode.postMessage({
          command: 'updateSetting',
          key: s.key,
          value: s.value,
          global: true
        });
      });

      showNotification('Settings saved!', 'success');
    }

    function openVSCodeSettings() {
      vscode.postMessage({ command: 'openExternalSettings' });
    }

    function resetSettings() {
      if (confirm('Reset all settings to defaults?')) {
        vscode.postMessage({ command: 'resetSettings' });
      }
    }

    function showNotification(message, type) {
      const div = document.createElement('div');
      div.className = type;
      div.textContent = message;
      div.style.cssText = 'position: fixed; top: 20px; right: 20px; padding: 10px 20px; background: var(--vscode-editor-inactiveSelectionBackground); border-radius: 4px;';
      document.body.appendChild(div);
      setTimeout(() => div.remove(), 3000);
    }
  </script>
</body>
</html>`;
}

export async function openSettings(
  services: Services,
  view?: SettingsView
): Promise<void> {
  services.logger.debug('Opening settings');

  if (view) {
    switch (view) {
      case 'vscode':
        await openVSCodeSettings();
        break;
      case 'webview':
        await openSettingsWebview(services);
        break;
      case 'json':
        await openSettingsJson();
        break;
    }
    return;
  }

  const selection = await vscode.window.showQuickPick(
    SETTINGS_CATEGORIES,
    {
      placeHolder: 'Select settings to configure',
      ignoreFocusOut: true
    }
  );

  if (!selection) {
    return;
  }

  switch (selection.value) {
    case 'vscode':
      await openVSCodeSettings();
      break;
    case 'webview':
      await openSettingsWebview(services);
      break;
    case 'json':
      await openSettingsJson();
      break;
    case 'focus':
    case 'suggestions':
    case 'pieces':
      await openSettingsCategory(selection.value);
      break;
  }
}

// ============================================================================
// Focus Mode Functions
// ============================================================================

function formatRemainingTime(endTime: Date): string {
  const now = new Date();
  const diff = endTime.getTime() - now.getTime();
  
  if (diff <= 0) {
    return 'Ending...';
  }
  
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')} remaining`;
}

function createStatusBarItem(services: Services, endTime: Date): vscode.StatusBarItem {
  if (focusState.statusBarItem) {
    focusState.statusBarItem.dispose();
  }

  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  
  item.text = '$(eye-closed) Focus';
  item.tooltip = `Focus Mode Active\nEnds at ${endTime.toLocaleTimeString()}\nClick to end early`;
  item.color = new vscode.ThemeColor('statusBarItem.prominentBackground');
  item.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
  item.command = COMMAND_IDS.TOGGLE_FOCUS_MODE;
  item.show();

  services.logger.debug('Focus mode status bar item created');
  return item;
}

function updateCountdown(services: Services): void {
  if (!focusState.enabled || !focusState.endTime || !focusState.statusBarItem) {
    return;
  }

  const remaining = formatRemainingTime(focusState.endTime);
  focusState.statusBarItem.text = `$(eye-closed) Focus (${remaining})`;
  
  if (new Date() >= focusState.endTime) {
    disableFocusMode(services);
  }
}

export async function enableFocusMode(
  services: Services,
  durationMinutes: number
): Promise<void> {
  if (focusState.enabled) {
    const choice = await vscode.window.showQuickPick(
      [
        { label: '$(add) Extend duration', value: 'extend' },
        { label: '$(circle-slash) End focus mode', value: 'end' },
        { label: '$(x) Cancel', value: 'cancel' }
      ],
      { placeHolder: 'You are already in focus mode. What would you like to do?' }
    );

    if (!choice || choice.value === 'cancel') {
      return;
    }

    if (choice.value === 'end') {
      await disableFocusMode(services);
      return;
    }
  }

  const endTime = new Date();
  endTime.setMinutes(endTime.getMinutes() + durationMinutes);

  focusState.enabled = true;
  focusState.endTime = endTime;

  await vscode.commands.executeCommand('setContext', FOCUS_MODE_CONTEXT, true);

  const config = vscode.workspace.getConfiguration('proactiveAssistant');
  await config.update('focusMode', true, true);

  focusState.statusBarItem = createStatusBarItem(services, endTime);

  focusState.timerInterval = setInterval(() => {
    updateCountdown(services);
  }, 1000);

  const endTimeStr = endTime.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  vscode.window.showInformationMessage(
    `🔒 Focus mode enabled for ${durationMinutes} minutes (until ${endTimeStr})`,
    'End Early'
  ).then(selection => {
    if (selection === 'End Early') {
      disableFocusMode(services);
    }
  });

  services.logger.info(`Focus mode enabled for ${durationMinutes} minutes`);

  const { getPanel } = await import('./panelCommands');
  getPanel(services).switchView('focus');
}

export async function disableFocusMode(services: Services): Promise<void> {
  if (!focusState.enabled) {
    throw new ExtensionError(
      'Focus mode is not enabled',
      ErrorCodes.COMMAND_FAILED,
      'Focus mode is not currently active'
    );
  }

  if (focusState.timerInterval) {
    clearInterval(focusState.timerInterval);
    focusState.timerInterval = null;
  }

  if (focusState.statusBarItem) {
    focusState.statusBarItem.dispose();
    focusState.statusBarItem = null;
  }

  focusState.enabled = false;
  focusState.endTime = null;

  await vscode.commands.executeCommand('setContext', FOCUS_MODE_CONTEXT, false);

  const config = vscode.workspace.getConfiguration('proactiveAssistant');
  await config.update('focusMode', false, true);

  vscode.window.showInformationMessage('🔓 Focus mode disabled');
  services.logger.info('Focus mode disabled');
}

export async function toggleFocusMode(services: Services): Promise<void> {
  if (focusState.enabled) {
    const choice = await vscode.window.showQuickPick(
      [
        { label: '$(circle-slash) Disable Focus Mode', value: 'disable' },
        { label: '$(x) Cancel', value: 'cancel' }
      ],
      { placeHolder: 'Focus mode is currently active' }
    );

    if (choice?.value === 'disable') {
      await disableFocusMode(services);
    }
    return;
  }

  const selection = await vscode.window.showQuickPick(
    FOCUS_DURATIONS.map(d => ({
      label: d.label,
      description: d.description,
      value: d.value
    })),
    {
      placeHolder: 'Select focus mode duration',
      ignoreFocusOut: true
    }
  );

  if (!selection) {
    return;
  }

  let duration = selection.value;

  if (duration === -1) {
    const customInput = await vscode.window.showInputBox({
      prompt: 'Enter custom duration in minutes',
      validateInput: (value) => {
        const num = parseInt(value, 10);
        if (isNaN(num) || num <= 0) {
          return 'Please enter a positive number';
        }
        if (num > 480) {
          return 'Maximum is 480 minutes (8 hours)';
        }
        return null;
      }
    });

    if (!customInput) {
      return;
    }

    duration = parseInt(customInput, 10);
  }

  await enableFocusMode(services, duration);
}

export function isFocusModeEnabled(): boolean {
  return focusState.enabled;
}

export function getRemainingFocusTime(): number {
  if (!focusState.enabled || !focusState.endTime) {
    return 0;
  }
  return Math.max(0, focusState.endTime.getTime() - Date.now());
}

export function disposeFocusMode(): void {
  if (focusState.timerInterval) {
    clearInterval(focusState.timerInterval);
  }
  if (focusState.statusBarItem) {
    focusState.statusBarItem.dispose();
  }
}

// ============================================================================
// Reset State Functions
// ============================================================================

export async function resetState(services: Services): Promise<void> {
  services.logger.info('Resetting extension state...');

  try {
    services.logger.info('Clearing suggestions state');

    if (services.interruptionManager) {
      await services.interruptionManager.disableFocusMode();
      await services.interruptionManager.clearBlacklist();
    }

    const panel = await import('./panelCommands');
    if (panel.isPanelVisible()) {
      panel.updatePanelContext(services, {
        file: undefined,
        duration: 0,
        capturedAt: new Date(),
      });
    }

    services.logger.info('Extension state reset successfully');
    vscode.window.showInformationMessage('Proactive Assistant state reset');
  } catch (error) {
    services.logger.error(
      'Failed to reset state',
      error instanceof Error ? error : new Error(String(error))
    );
    vscode.window.showErrorMessage('Couldn\'t reset the extension state. Try restarting VS Code.');
  }
}

// ============================================================================
// Command Registration
// ============================================================================

export function registerOpenSettingsCommand(services: Services): vscode.Disposable {
  const command = withErrorHandling(
    async (...args: unknown[]) => {
      const view = args[0] as SettingsView | undefined;
      return openSettings(services, view);
    },
    services.logger,
    COMMAND_IDS.OPEN_SETTINGS
  );

  return vscode.commands.registerCommand(COMMAND_IDS.OPEN_SETTINGS, command);
}

export function registerToggleFocusModeCommand(services: Services): vscode.Disposable {
  const command = withErrorHandling(
    async () => toggleFocusMode(services),
    services.logger,
    COMMAND_IDS.TOGGLE_FOCUS_MODE
  );

  return vscode.commands.registerCommand(COMMAND_IDS.TOGGLE_FOCUS_MODE, command);
}

export function registerResetStateCommand(services: Services): vscode.Disposable {
  return vscode.commands.registerCommand(COMMAND_IDS.RESET_STATE, () => resetState(services));
}

// ============================================================================
// Export Command IDs
// ============================================================================

export const COMMAND_ID_OPEN_SETTINGS = COMMAND_IDS.OPEN_SETTINGS;
export const COMMAND_ID_TOGGLE_FOCUS_MODE = COMMAND_IDS.TOGGLE_FOCUS_MODE;
export const COMMAND_ID_RESET_STATE = COMMAND_IDS.RESET_STATE;
