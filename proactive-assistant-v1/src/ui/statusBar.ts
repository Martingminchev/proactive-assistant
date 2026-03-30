import * as vscode from 'vscode';
import { 
  FlowState, 
  Suggestion, 
  ILogger, 
  IActivityTracker,
  IService 
} from '../types';

/**
 * Status bar display configuration
 */
interface DisplayConfig {
  text: string;
  tooltip: string;
  color: string;
  backgroundColor?: vscode.ThemeColor;
  pulse?: boolean;
}

/**
 * Status bar states that can be displayed
 */
export type StatusBarState = 
  | 'idle' 
  | 'working' 
  | 'deep_flow'
  | 'stuck'
  | 'frustrated'
  | 'suggestion' 
  | 'focus';

/**
 * Configuration options for StatusBarManager
 */
export interface StatusBarConfig {
  /** Priority in the status bar (higher = more left) */
  priority: number;
  /** Alignment in the status bar */
  alignment: vscode.StatusBarAlignment;
  /** Enable pulsing animation */
  enableAnimations: boolean;
  /** Pulse interval in milliseconds */
  pulseIntervalMs: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: StatusBarConfig = {
  priority: 100,
  alignment: vscode.StatusBarAlignment.Right,
  enableAnimations: true,
  pulseIntervalMs: 1000
};

/**
 * Manages the VS Code status bar item with visual states
 * Integrates with ActivityMonitor to show flow state and suggestions
 */
export class StatusBarManager implements IService, vscode.Disposable {
  public readonly name = 'StatusBarManager';
  
  private statusBarItem: vscode.StatusBarItem;
  private currentState: StatusBarState = 'idle';
  private currentFlowState: FlowState = 'idle';
  private hasSuggestion = false;
  private isFocusMode = false;
  private focusModeTimeout: NodeJS.Timeout | undefined;
  private pulseInterval: NodeJS.Timeout | undefined;
  private currentSuggestion: Suggestion | undefined;
  private config: StatusBarConfig;
  private disposables: vscode.Disposable[] = [];

  /**
   * Creates a new StatusBarManager
   * @param activityMonitor The activity monitor to listen for flow state changes
   * @param logger Logger for debugging
   * @param config Optional configuration overrides
   */
  constructor(
    private readonly activityMonitor: IActivityTracker,
    private readonly logger: ILogger,
    config?: Partial<StatusBarConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    this.statusBarItem = vscode.window.createStatusBarItem(
      this.config.alignment,
      this.config.priority
    );
    
    this.statusBarItem.command = 'proactiveAssistant.openPanel';
    this.logger.info('StatusBarManager created');
  }

  /**
   * Initialize the status bar manager
   */
  public async initialize(): Promise<void> {
    this.logger.info('Initializing StatusBarManager...');
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Initial display update
    this.updateDisplay();
    
    // Show the status bar item
    this.statusBarItem.show();
    
    this.logger.info('StatusBarManager initialized');
  }

  /**
   * Setup event listeners for flow state changes and commands
   */
  private setupEventListeners(): void {
    // Listen to flow state changes from ActivityMonitor
    const flowStateDisposable = this.activityMonitor.onFlowStateChanged((state) => {
      this.logger.debug(`Flow state changed: ${state}`);
      this.currentFlowState = state;
      
      // Only update if not in focus mode and no active suggestion
      if (!this.isFocusMode && !this.hasSuggestion) {
        this.currentState = this.mapFlowStateToStatusState(state);
        this.updateDisplay();
      }
    });
    
    this.disposables.push(flowStateDisposable);

    // Register toggle focus mode command
    const focusCommand = vscode.commands.registerCommand(
      'proactiveAssistant.statusBar.toggleFocus',
      () => this.toggleFocusMode()
    );
    this.disposables.push(focusCommand);

    // Register show suggestion command
    const showSuggestionCommand = vscode.commands.registerCommand(
      'proactiveAssistant.statusBar.showSuggestion',
      (suggestion: Suggestion) => this.showSuggestion(suggestion)
    );
    this.disposables.push(showSuggestionCommand);

    // Register clear suggestion command
    const clearSuggestionCommand = vscode.commands.registerCommand(
      'proactiveAssistant.statusBar.clearSuggestion',
      () => this.clearSuggestion()
    );
    this.disposables.push(clearSuggestionCommand);
  }

  /**
   * Map FlowState to StatusBarState
   */
  private mapFlowStateToStatusState(flowState: FlowState): StatusBarState {
    switch (flowState) {
      case 'idle':
        return 'idle';
      case 'working':
        return 'working';
      case 'deep_flow':
        return 'deep_flow';
      case 'stuck':
        return 'stuck';
      case 'frustrated':
        return 'frustrated';
      default:
        return 'idle';
    }
  }

  /**
   * Update the status bar state
   * @param state The new state to display
   */
  public updateState(state: FlowState): void {
    this.currentFlowState = state;
    
    if (!this.isFocusMode && !this.hasSuggestion) {
      this.currentState = this.mapFlowStateToStatusState(state);
      this.updateDisplay();
    }
  }

  /**
   * Show a suggestion in the status bar
   * @param suggestion The suggestion to display
   */
  public showSuggestion(suggestion: Suggestion): void {
    this.logger.info(`Showing suggestion: ${suggestion.title}`);
    this.hasSuggestion = true;
    this.currentSuggestion = suggestion;
    this.currentState = 'suggestion';
    
    // Start pulsing to get attention
    if (this.config.enableAnimations) {
      this.startPulsing();
    }
    
    this.updateDisplay();
  }

  /**
   * Clear the current suggestion display
   */
  public clearSuggestion(): void {
    if (this.hasSuggestion) {
      this.logger.info('Clearing suggestion from status bar');
      this.hasSuggestion = false;
      this.currentSuggestion = undefined;
      this.stopPulsing();
      
      // Revert to flow-based state
      this.currentState = this.mapFlowStateToStatusState(this.currentFlowState);
      this.updateDisplay();
    }
  }

  /**
   * Enable focus mode
   * @param duration Optional duration in minutes (if not provided, focus mode stays on indefinitely)
   */
  public enableFocusMode(duration?: number): void {
    this.logger.info(`Enabling focus mode${duration ? ` for ${duration} minutes` : ''}`);
    this.isFocusMode = true;
    this.currentState = 'focus';
    
    // Clear any existing timeout
    if (this.focusModeTimeout) {
      clearTimeout(this.focusModeTimeout);
      this.focusModeTimeout = undefined;
    }
    
    // Set timeout if duration provided
    if (duration && duration > 0) {
      this.focusModeTimeout = setTimeout(() => {
        this.disableFocusMode();
        
        // Show notification that focus mode ended
        vscode.window.showInformationMessage(
          'Focus mode ended. Proactive AI Assistant is active again.'
        );
      }, duration * 60 * 1000);
    }
    
    this.stopPulsing();
    this.updateDisplay();
  }

  /**
   * Disable focus mode
   */
  public disableFocusMode(): void {
    if (this.isFocusMode) {
      this.logger.info('Disabling focus mode');
      this.isFocusMode = false;
      
      if (this.focusModeTimeout) {
        clearTimeout(this.focusModeTimeout);
        this.focusModeTimeout = undefined;
      }
      
      // Revert to appropriate state
      if (this.hasSuggestion) {
        this.currentState = 'suggestion';
      } else {
        this.currentState = this.mapFlowStateToStatusState(this.currentFlowState);
      }
      
      this.updateDisplay();
    }
  }

  /**
   * Toggle focus mode on/off
   */
  public toggleFocusMode(): void {
    if (this.isFocusMode) {
      this.disableFocusMode();
    } else {
      // Ask for duration
      vscode.window.showQuickPick(
        [
          { label: '25 minutes (Pomodoro)', value: 25 },
          { label: '30 minutes', value: 30 },
          { label: '1 hour', value: 60 },
          { label: '2 hours', value: 120 },
          { label: 'Indefinite', value: 0 }
        ],
        { placeHolder: 'Select focus mode duration' }
      ).then(selection => {
        if (selection) {
          const duration = selection.value > 0 ? selection.value : undefined;
          this.enableFocusMode(duration);
          
          if (duration) {
            vscode.window.showInformationMessage(
              `Focus mode enabled for ${duration} minutes. You won't be interrupted.`
            );
          } else {
            vscode.window.showInformationMessage(
              'Focus mode enabled indefinitely. Click the status bar to disable.'
            );
          }
        }
      });
    }
  }

  /**
   * Check if focus mode is currently active
   */
  public isInFocusMode(): boolean {
    return this.isFocusMode;
  }

  /**
   * Get the current display configuration based on state
   */
  private getDisplayConfig(): DisplayConfig {
    // Priority: Focus Mode > Suggestion > Flow State
    
    if (this.isFocusMode) {
      return {
        text: '$(robot) $(circle-slash)',
        color: '#A371F7', // Purple
        tooltip: '$(robot) Focus Mode Active\n\nNo interruptions will be shown.\nClick to disable focus mode.',
        backgroundColor: new vscode.ThemeColor('statusBarItem.prominentBackground')
      };
    }
    
    if (this.hasSuggestion && this.currentSuggestion) {
      const isUrgent = this.currentSuggestion.priority === 'urgent' || 
                       this.currentSuggestion.priority === 'high';
      
      return {
        text: '$(robot) $(circle-filled)',
        color: isUrgent ? '#F85149' : '#D29922', // Red for urgent, Amber for normal
        tooltip: this.buildSuggestionTooltip(this.currentSuggestion),
        backgroundColor: new vscode.ThemeColor('statusBarItem.warningBackground'),
        pulse: true
      };
    }
    
    // Flow state-based display
    const stateConfigs: Record<Exclude<StatusBarState, 'focus' | 'suggestion'>, DisplayConfig> = {
      idle: {
        text: '$(robot) $(circle-outline)',
        color: '#6E7681', // Gray
        tooltip: '$(robot) Proactive AI Assistant\n\nIdle - Waiting for activity\n\nClick to open panel'
      },
      working: {
        text: '$(robot) $(circle-filled)',
        color: '#58A6FF', // Blue
        tooltip: '$(robot) Proactive AI Assistant\n\nWatching your workflow\n\nClick to open panel'
      },
      deep_flow: {
        text: '$(robot) $(circle-filled)',
        color: '#238636', // Green
        tooltip: '$(robot) Proactive AI Assistant\n\nDeep flow detected - Minimizing interruptions\n\nClick to open panel'
      },
      stuck: {
        text: '$(robot) $(error)',
        color: '#F85149', // Red
        tooltip: '$(robot) Proactive AI Assistant\n\nYou seem stuck - Click for help',
        backgroundColor: new vscode.ThemeColor('statusBarItem.errorBackground')
      },
      frustrated: {
        text: '$(robot) $(error)',
        color: '#F85149', // Red
        tooltip: '$(robot) Proactive AI Assistant\n\nFrustration detected - Can I help?',
        backgroundColor: new vscode.ThemeColor('statusBarItem.errorBackground')
      }
    };
    
    return stateConfigs[this.currentState as Exclude<StatusBarState, 'focus' | 'suggestion'>] || stateConfigs.idle;
  }

  /**
   * Build tooltip for suggestion
   */
  private buildSuggestionTooltip(suggestion: Suggestion): string {
    const priorityEmoji = suggestion.priority === 'urgent' ? '🔴' : 
                          suggestion.priority === 'high' ? '🟠' : '🔵';
    
    let tooltip = `$(robot) ${priorityEmoji} ${suggestion.title}\n\n`;
    tooltip += `${suggestion.description.slice(0, 200)}${suggestion.description.length > 200 ? '...' : ''}\n\n`;
    tooltip += `Priority: ${suggestion.priority.toUpperCase()}\n`;
    tooltip += `Click to open panel and view details`;
    
    return tooltip;
  }

  /**
   * Update the status bar display
   */
  private updateDisplay(): void {
    const config = this.getDisplayConfig();
    
    this.statusBarItem.text = config.text;
    this.statusBarItem.color = config.color;
    this.statusBarItem.tooltip = new vscode.MarkdownString(config.tooltip);
    this.statusBarItem.backgroundColor = config.backgroundColor;
    
    // Update command based on state
    if (this.isFocusMode) {
      this.statusBarItem.command = 'proactiveAssistant.statusBar.toggleFocus';
    } else if (this.hasSuggestion) {
      this.statusBarItem.command = 'proactiveAssistant.openPanel';
    } else {
      this.statusBarItem.command = 'proactiveAssistant.openPanel';
    }
  }

  /**
   * Start pulsing animation for new suggestions
   */
  private startPulsing(): void {
    this.stopPulsing();
    
    let pulse = false;
    this.pulseInterval = setInterval(() => {
      pulse = !pulse;
      const baseText = '$(robot)';
      this.statusBarItem.text = pulse ? `${baseText} $(circle-filled)` : `${baseText} $(circle-outline)`;
    }, this.config.pulseIntervalMs);
  }

  /**
   * Stop pulsing animation
   */
  private stopPulsing(): void {
    if (this.pulseInterval) {
      clearInterval(this.pulseInterval);
      this.pulseInterval = undefined;
    }
  }

  /**
   * Show a temporary message in the status bar
   * @param message Message to display
   * @param durationMs Duration to show message (default: 3000ms)
   */
  public showMessage(message: string, durationMs: number = 3000): void {
    const previousText = this.statusBarItem.text;
    const previousTooltip = this.statusBarItem.tooltip;
    
    this.statusBarItem.text = `$(robot) ${message}`;
    this.statusBarItem.tooltip = message;
    
    setTimeout(() => {
      this.statusBarItem.text = previousText;
      this.statusBarItem.tooltip = previousTooltip;
    }, durationMs);
  }

  /**
   * Show the status bar item
   */
  public show(): void {
    this.statusBarItem.show();
  }

  /**
   * Hide the status bar item
   */
  public hide(): void {
    this.statusBarItem.hide();
  }

  /**
   * Get current state
   */
  public getCurrentState(): StatusBarState {
    return this.currentState;
  }

  /**
   * Get current flow state
   */
  public getCurrentFlowState(): FlowState {
    return this.currentFlowState;
  }

  /**
   * Check if there's an active suggestion
   */
  public hasActiveSuggestion(): boolean {
    return this.hasSuggestion;
  }

  /**
   * Get current suggestion (if any)
   */
  public getCurrentSuggestion(): Suggestion | undefined {
    return this.currentSuggestion;
  }

  /**
   * Set pulsing animation enabled/disabled
   */
  public setPulsing(enabled: boolean): void {
    this.config.enableAnimations = enabled;
    if (!enabled) {
      this.stopPulsing();
    } else if (this.hasSuggestion) {
      this.startPulsing();
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<StatusBarConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Recreate status bar if alignment or priority changed
    if (config.alignment !== undefined || config.priority !== undefined) {
      this.statusBarItem.dispose();
      this.statusBarItem = vscode.window.createStatusBarItem(
        this.config.alignment,
        this.config.priority
      );
      this.statusBarItem.show();
      this.updateDisplay();
    }
  }

  /**
   * Dispose of all resources
   */
  public dispose(): void {
    this.logger.info('Disposing StatusBarManager');
    
    this.stopPulsing();
    
    if (this.focusModeTimeout) {
      clearTimeout(this.focusModeTimeout);
    }
    
    this.statusBarItem.dispose();
    
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    
    this.disposables = [];
  }
}

export default StatusBarManager;
