import * as vscode from 'vscode';
import { ActivityMonitor } from './activityMonitor';
import { SuggestionEngine } from './suggestionEngine';
import { InterruptionManager } from './interruptionManager';
import { PanelProvider } from '../ui/panelProvider';
import { PiecesOSClient } from './piecesClient';
import { FlowState, Suggestion, SuggestionContext, ActivityContext } from '../types';
import { setActiveSuggestion } from '../commands';

export class SuggestionOrchestrator implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  // lastSuggestionTime tracks when we last showed a suggestion for rate limiting
  // @ts-expect-error - Reserved for future use in rate limiting
  private lastSuggestionTime: number = 0;
  private currentSuggestion: Suggestion | undefined;

  constructor(
    private activityMonitor: ActivityMonitor,
    private suggestionEngine: SuggestionEngine,
    private interruptionManager: InterruptionManager,
    private panelProvider: PanelProvider,
    private piecesClient?: PiecesOSClient
  ) {}

  start(): void {
    this.activityMonitor.onFlowStateChanged(
      state => this.onFlowStateChanged(state),
      null,
      this.disposables
    );

    this.activityMonitor.onContextChanged(
      context => this.panelProvider.updateContext(context),
      null,
      this.disposables
    );
  }

  private async onFlowStateChanged(state: FlowState): Promise<void> {
    // Only suggest when user might need help
    if (state === 'stuck' || state === 'frustrated') {
      await this.tryGenerateSuggestion(state);
    }
  }

  private async tryGenerateSuggestion(flowState: FlowState): Promise<void> {
    const activityContext = this.activityMonitor.getCurrentContext();
    console.log(`[ProactiveAssistant] Trying to generate suggestion for flowState: ${flowState}`);
    
    const decision = this.interruptionManager.shouldInterrupt(activityContext, flowState);
    console.log(`[ProactiveAssistant] Interruption decision:`, decision);

    if (!decision.shouldInterrupt) {
      console.log(`[ProactiveAssistant] Not showing suggestion: ${decision.reason}`);
      return;
    }

    let suggestion: Suggestion | undefined;

    // Try AI-powered suggestions from Pieces OS first
    if (this.piecesClient?.isAvailable()) {
      console.log('[ProactiveAssistant] Using Pieces OS AI for suggestion generation...');
      const aiResult = await this.piecesClient.analyzeContext(activityContext);
      
      if (aiResult.success && aiResult.value.suggestions.length > 0) {
        // Use the first AI suggestion
        suggestion = aiResult.value.suggestions[0];
        console.log(`[ProactiveAssistant] Pieces AI generated suggestion: ${suggestion?.title ?? 'unknown'}`);
      } else {
        console.log('[ProactiveAssistant] Pieces AI returned no suggestions, falling back to templates');
      }
    }

    // Fall back to template-based suggestions if AI didn't produce results
    if (!suggestion) {
      const context = this.buildContext(flowState, activityContext);
      const result = this.suggestionEngine.generateForFlowState(context);

      if (!result.success) {
        return;
      }
      suggestion = result.value;
    }

    if (!suggestion) {
      console.log('[ProactiveAssistant] No suggestion generated (null)');
      return;
    }

    console.log(`[ProactiveAssistant] Generated suggestion: ${suggestion.title} (priority: ${suggestion.priority})`);
    await this.showSuggestion(suggestion);
    this.lastSuggestionTime = Date.now();
    await this.interruptionManager.recordInterruption(suggestion.id);
    
    // Track that suggestion was shown
    this.activityMonitor.recordSuggestionShown();
  }

  private buildContext(flowState: FlowState, activityContext: ActivityContext): SuggestionContext {
    return {
      flowState,
      activityContext,
      recentSuggestions: this.currentSuggestion ? [this.currentSuggestion.id] : []
    };
  }

  private async showSuggestion(suggestion: Suggestion): Promise<void> {
    console.log(`[ProactiveAssistant] Showing suggestion: ${suggestion.title} (priority: ${suggestion.priority})`);
    this.currentSuggestion = suggestion;

    // Set as active so commands can reference it
    setActiveSuggestion(suggestion);

    if (suggestion.priority === 'high' || suggestion.priority === 'urgent') {
      const action = await vscode.window.showInformationMessage(
        suggestion.title,
        'Show Fix',
        'Dismiss'
      );
      if (action === 'Show Fix') {
        this.panelProvider.showSuggestion(suggestion);
        // Track that user accepted/engaged with the suggestion
        this.activityMonitor.recordSuggestionAccepted();
      } else if (action === 'Dismiss') {
        // User dismissed from notification - clear active suggestion
        setActiveSuggestion(null);
        // Track that user dismissed the suggestion
        this.activityMonitor.recordSuggestionDismissed();
      }
    } else {
      await this.panelProvider.updateSuggestion(suggestion);
    }
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
