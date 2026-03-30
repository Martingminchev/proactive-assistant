import * as vscode from 'vscode';
import { ILogger, IService, FlowState, StatusBarState, StatusBarConfig } from '../types';
import { ActivityMonitor } from './activityMonitor';

interface StateConfig {
  icon: string;
  tooltip: string;
  color?: string | vscode.ThemeColor;
  backgroundColor?: vscode.ThemeColor;
  pulse: boolean;
}

const DEFAULT_CONFIG: StatusBarConfig = {
  showInStatusBar: true,
  updateIntervalMs: 5000,
  enableAnimations: true,
  priority: 100
};

const STATE_CONFIGS: Record<StatusBarState, StateConfig> = {
  idle: {
    icon: '$(robot)',
    tooltip: 'Proactive AI - Idle',
    color: undefined,
    pulse: false
  },
  watching: {
    icon: '$(eye)',
    tooltip: 'Proactive AI - Watching your workflow',
    color: undefined,
    pulse: false
  },
  suggestion: {
    icon: '$(lightbulb)',
    tooltip: 'Proactive AI - Suggestion available!',
    color: new vscode.ThemeColor('statusBarItem.prominentForeground'),
    backgroundColor: new vscode.ThemeColor('statusBarItem.prominentBackground'),
    pulse: true
  },
  urgent: {
    icon: '$(warning)',
    tooltip: 'Proactive AI - Urgent suggestion!',
    color: new vscode.ThemeColor('statusBarItem.errorForeground'),
    backgroundColor: new vscode.ThemeColor('statusBarItem.errorBackground'),
    pulse: true
  },
  focus: {
    icon: '$(debug-pause)',
    tooltip: 'Proactive AI - Focus mode active (suggestions paused)',
    color: new vscode.ThemeColor('statusBarItem.warningForeground'),
    pulse: false
  },
  offline: {
    icon: '$(plug)',
    tooltip: 'Proactive AI - Pieces OS disconnected',
    color: new vscode.ThemeColor('disabledForeground'),
    pulse: false
  }
};

const FLOW_STATE_MAP: Record<FlowState, StatusBarState> = {
  idle: 'idle',
  working: 'watching',
  deep_flow: 'watching',
  stuck: 'suggestion',
  frustrated: 'urgent'
};

export class StatusBarManager implements IService {
  public readonly name = 'StatusBarManager';

  private config: StatusBarConfig;
  private statusBarItem: vscode.StatusBarItem;
  private disposables: vscode.Disposable[] = [];
  private currentState: StatusBarState = 'idle';
  private isPulsing: boolean = false;
  private pulseInterval?: NodeJS.Timeout;
  private updateInterval?: NodeJS.Timeout;
  private activityMonitor?: ActivityMonitor;

  constructor(
    // @ts-expect-error - Reserved for future use in configuration persistence
    private readonly context: vscode.ExtensionContext,
    private readonly logger: ILogger,
    config?: Partial<StatusBarConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      this.config.priority
    );
    
    this.statusBarItem.command = 'proactiveAssistant.openPanel';
    this.logger.info('Status bar initialized with openPanel command');
    
    // Add click handler logging via command registration check
    const originalCommand = this.statusBarItem.command;
    this.logger.info(`Status bar command set to: ${originalCommand}`);
    
    this.logger.info('StatusBarManager initialized');
  }

  async initialize(): Promise<void> {
    this.updateState('idle');
    if (this.config.showInStatusBar) {
      this.statusBarItem.show();
    }
    this.startUpdateInterval();
  }

  connectToActivityMonitor(monitor: ActivityMonitor): void {
    this.activityMonitor = monitor;
    this.disposables.push(
      monitor.onFlowStateChanged(flowState => {
        this.updateState(FLOW_STATE_MAP[flowState]);
      })
    );
    this.updateState(FLOW_STATE_MAP[monitor.currentFlowState]);
  }

  updateState(state: StatusBarState): void {
    if (this.currentState === state) {
      return;
    }

    this.currentState = state;
    const config = STATE_CONFIGS[state];

    this.statusBarItem.text = config.icon;
    this.updateTooltip(config.tooltip);
    this.statusBarItem.color = config.color ?? undefined;
    this.statusBarItem.backgroundColor = config.backgroundColor;

    if (config.pulse && this.config.enableAnimations) {
      this.startPulsing();
    } else {
      this.stopPulsing();
    }
  }

  private updateTooltip(baseTooltip: string): void {
    const lines: string[] = [baseTooltip];
    
    if (this.activityMonitor) {
      const flowState = this.activityMonitor.currentFlowState;
      const context = this.activityMonitor.getCurrentContext();
      lines.push('', `Flow State: ${flowState.replace('_', ' ')}`);
      
      if (context.file) {
        lines.push(`Current File: ${context.file.split(/[\\/]/).pop()}`);
      }
      if (context.language) {
        lines.push(`Language: ${context.language}`);
      }
      
      const velocity = this.activityMonitor.getTypingVelocity?.();
      if (velocity && velocity > 0) {
        lines.push(`Typing: ${Math.round(velocity)} chars/min`);
      }
    }
    
    lines.push('', 'Click to open Proactive AI Assistant panel');
    this.statusBarItem.tooltip = lines.join('\n');
  }

  private startPulsing(): void {
    if (this.isPulsing) {
      return;
    }

    this.isPulsing = true;
    let pulseState = false;

    this.pulseInterval = setInterval(() => {
      pulseState = !pulseState;
      const config = STATE_CONFIGS[this.currentState];
      
      if (pulseState) {
        // Dimmed state
        this.statusBarItem.text = config.icon;
        this.statusBarItem.color = new vscode.ThemeColor('disabledForeground');
      } else {
        // Bright state
        this.statusBarItem.text = config.icon;
        this.statusBarItem.color = config.color;
      }
    }, 800); // Pulse every 800ms

    this.disposables.push({
      dispose: () => {
        if (this.pulseInterval) {
          clearInterval(this.pulseInterval);
          this.pulseInterval = undefined;
        }
      }
    });
  }

  private stopPulsing(): void {
    if (!this.isPulsing) {
      return;
    }

    this.isPulsing = false;
    
    if (this.pulseInterval) {
      clearInterval(this.pulseInterval);
      this.pulseInterval = undefined;
    }

    // Reset to normal appearance
    const config = STATE_CONFIGS[this.currentState];
    this.statusBarItem.color = config.color;
  }

  private startUpdateInterval(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(() => {
      this.refreshTooltip();
    }, this.config.updateIntervalMs);

    this.disposables.push({
      dispose: () => {
        if (this.updateInterval) {
          clearInterval(this.updateInterval);
          this.updateInterval = undefined;
        }
      }
    });
  }

  private refreshTooltip(): void {
    const config = STATE_CONFIGS[this.currentState];
    this.updateTooltip(config.tooltip);
  }

  showMessage(message: string, durationMs: number = 3000): void {
    const originalText = this.statusBarItem.text;
    const originalTooltip = this.statusBarItem.tooltip;

    this.statusBarItem.text = `$(info) ${message}`;
    this.statusBarItem.tooltip = message;

    setTimeout(() => {
      this.statusBarItem.text = originalText;
      this.statusBarItem.tooltip = originalTooltip;
      this.refreshTooltip();
    }, durationMs);
  }

  setPulsing(enabled: boolean): void {
    if (enabled) {
      this.startPulsing();
    } else {
      this.stopPulsing();
    }
  }

  hide(): void {
    this.statusBarItem.hide();
  }

  show(): void {
    this.statusBarItem.show();
  }

  isVisible(): boolean {
    return this.config.showInStatusBar;
  }

  getCurrentState(): StatusBarState {
    return this.currentState;
  }

  updateConfig(config: Partial<StatusBarConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.showInStatusBar !== undefined) {
      config.showInStatusBar ? this.show() : this.hide();
    }
  }

  dispose(): void {
    this.stopPulsing();
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.disposables.forEach(d => d.dispose());
    this.statusBarItem.dispose();
  }
}

export default StatusBarManager;
