// =============================================================================
// NEXUS - Main Services Exports
// Core services for the main process
// =============================================================================

// Tool System
export {
  ToolRegistry,
  getToolRegistry,
} from './tool-system';

// Tool Executor
export {
  ToolExecutor,
  createToolExecutor,
} from './tool-executor';

// Action Confirmation Service
export {
  ActionConfirmationService,
  getActionConfirmationService,
  resetActionConfirmationService,
} from './action-confirmation-service';

// Re-export other services for convenience
export { ConversationStore } from './conversation-store';
export { KimiClient } from './kimi-client';
export { ContextMonitor } from './context-monitor';
export { ContextBridge } from './context-bridge';
export { PiecesClient } from './pieces-client';
export { PiecesContextProvider } from './pieces-context-provider';
export { ProactiveAgent } from './proactive-agent';
export { IntentEngine } from './intent-engine';
export { MemoryStore } from './memory-store';
export { PatternRecognition } from './pattern-recognition';
export { SoulDocumentStore } from './soul-document-store';
export { UserMemoryStore } from './user-memory-store';
export { PersonalityPromptBuilder } from './personality-prompt-builder';
export { SmartTriggerManager } from './smart-trigger-manager';
export { PreferenceLearner, getPreferenceLearner } from './preference-learner';
export { SituationAggregator } from './situation-aggregator';
export { TaskTracker } from './task-tracker';
export { ErrorDetector } from './error-detector';
