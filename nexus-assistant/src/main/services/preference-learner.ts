// =============================================================================
// NEXUS - Preference Learner Service
// Automatically learns user preferences from interactions and updates the
// Soul Document's "What I've Learned About You" section
// =============================================================================

import { EventEmitter } from 'events';
import log from 'electron-log';
import { getSoulDocumentStore, SoulDocumentStore } from './soul-document-store';
import { getUserMemoryStore, default as UserMemoryStore } from './user-memory-store';

// =============================================================================
// Types
// =============================================================================

interface InteractionSignal {
  type: 'response_feedback' | 'response_length' | 'code_preference' | 'explanation_preference' | 'tool_usage';
  value: string | number | boolean;
  timestamp: number;
  context?: string;
}

interface LearnedPreferences {
  responseStyle: 'concise' | 'detailed' | 'balanced';
  codeVsExplanation: 'code_first' | 'explanation_first' | 'balanced';
  communicationTone: 'casual' | 'professional' | 'adaptive';
  proactiveLevel: 'minimal' | 'moderate' | 'active';
  technicalDepth: 'beginner' | 'intermediate' | 'expert';
  toolUsageStyle: 'ask_first' | 'just_do_it' | 'explain_after';
}

interface PreferenceLearnerConfig {
  enabled: boolean;
  minSignalsBeforeLearning: number;  // Minimum signals before updating preferences
  updateIntervalMs: number;           // How often to analyze and update
  maxLearnedItems: number;            // Max items in "What I've Learned" section
}

const DEFAULT_CONFIG: PreferenceLearnerConfig = {
  enabled: true,
  minSignalsBeforeLearning: 5,
  updateIntervalMs: 30 * 60 * 1000, // 30 minutes
  maxLearnedItems: 10,
};

// =============================================================================
// Preference Learner Class
// =============================================================================

export class PreferenceLearner extends EventEmitter {
  private config: PreferenceLearnerConfig;
  private soulStore: SoulDocumentStore;
  private memoryStore: typeof UserMemoryStore.prototype;
  private signals: InteractionSignal[] = [];
  private updateTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  // Tracked metrics
  private responseLengthHistory: number[] = [];
  private codeRequestCount: number = 0;
  private explanationRequestCount: number = 0;
  private positiveToolFeedback: number = 0;
  private negativeToolFeedback: number = 0;
  private directActionPreference: number = 0;
  private askFirstPreference: number = 0;

  constructor(config?: Partial<PreferenceLearnerConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.soulStore = getSoulDocumentStore();
    this.memoryStore = getUserMemoryStore();
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  start(): void {
    if (this.isRunning || !this.config.enabled) return;

    this.isRunning = true;

    // Set up periodic analysis
    this.updateTimer = setInterval(() => {
      this.analyzeAndUpdate();
    }, this.config.updateIntervalMs);

    log.info('[PreferenceLearner] Started');
    this.emit('started');
  }

  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    // Final analysis before stopping
    this.analyzeAndUpdate();

    log.info('[PreferenceLearner] Stopped');
    this.emit('stopped');
  }

  // ===========================================================================
  // Signal Recording
  // ===========================================================================

  /**
   * Record when user gives feedback on a response
   */
  recordResponseFeedback(helpful: boolean, context?: string): void {
    this.signals.push({
      type: 'response_feedback',
      value: helpful,
      timestamp: Date.now(),
      context,
    });

    // Track tool usage feedback specifically
    if (context?.includes('tool')) {
      if (helpful) {
        this.positiveToolFeedback++;
      } else {
        this.negativeToolFeedback++;
      }
    }
  }

  /**
   * Record the length of assistant responses that user seemed satisfied with
   */
  recordResponseLength(characterCount: number, userSatisfied: boolean): void {
    if (userSatisfied) {
      this.responseLengthHistory.push(characterCount);
      // Keep only last 50
      if (this.responseLengthHistory.length > 50) {
        this.responseLengthHistory = this.responseLengthHistory.slice(-50);
      }
    }

    this.signals.push({
      type: 'response_length',
      value: characterCount,
      timestamp: Date.now(),
    });
  }

  /**
   * Record when user asks for code
   */
  recordCodeRequest(): void {
    this.codeRequestCount++;
    this.signals.push({
      type: 'code_preference',
      value: 'code',
      timestamp: Date.now(),
    });
  }

  /**
   * Record when user asks for explanation
   */
  recordExplanationRequest(): void {
    this.explanationRequestCount++;
    this.signals.push({
      type: 'explanation_preference',
      value: 'explanation',
      timestamp: Date.now(),
    });
  }

  /**
   * Record user's preference for tool execution style
   */
  recordToolPreference(style: 'direct_action' | 'ask_first'): void {
    if (style === 'direct_action') {
      this.directActionPreference++;
    } else {
      this.askFirstPreference++;
    }

    this.signals.push({
      type: 'tool_usage',
      value: style,
      timestamp: Date.now(),
    });
  }

  /**
   * Analyze message content for implicit preferences
   */
  analyzeUserMessage(message: string): void {
    const lowerMessage = message.toLowerCase();

    // Detect preference signals from message content
    if (lowerMessage.includes('just do it') || lowerMessage.includes('go ahead') || lowerMessage.includes('run it')) {
      this.directActionPreference++;
    }

    if (lowerMessage.includes('wait') || lowerMessage.includes('before') || lowerMessage.includes('first let me')) {
      this.askFirstPreference++;
    }

    if (lowerMessage.includes('show me the code') || lowerMessage.includes('give me code') || lowerMessage.includes('write code')) {
      this.codeRequestCount++;
    }

    if (lowerMessage.includes('explain') || lowerMessage.includes('why') || lowerMessage.includes('how does')) {
      this.explanationRequestCount++;
    }

    // Detect tone preferences
    if (lowerMessage.includes('thanks') || lowerMessage.includes('lol') || lowerMessage.includes('haha')) {
      // Casual tone is okay
    }
  }

  // ===========================================================================
  // Analysis & Learning
  // ===========================================================================

  private analyzeAndUpdate(): void {
    if (this.signals.length < this.config.minSignalsBeforeLearning) {
      log.debug('[PreferenceLearner] Not enough signals yet:', this.signals.length);
      return;
    }

    const learned: Partial<Record<string, string>> = {};

    // Analyze response length preference
    if (this.responseLengthHistory.length >= 5) {
      const avgLength = this.responseLengthHistory.reduce((a, b) => a + b, 0) / this.responseLengthHistory.length;
      if (avgLength < 500) {
        learned['Response style'] = 'Prefers concise, to-the-point responses';
      } else if (avgLength > 1500) {
        learned['Response style'] = 'Appreciates detailed, thorough explanations';
      }
    }

    // Analyze code vs explanation preference
    const totalRequests = this.codeRequestCount + this.explanationRequestCount;
    if (totalRequests >= 5) {
      const codeRatio = this.codeRequestCount / totalRequests;
      if (codeRatio > 0.7) {
        learned['Content preference'] = '"Show me the code" - prefers code examples over lengthy explanations';
      } else if (codeRatio < 0.3) {
        learned['Content preference'] = 'Values understanding "why" - prefers explanations before code';
      } else {
        learned['Content preference'] = 'Balanced - appreciates both code and explanations';
      }
    }

    // Analyze tool usage preference
    const totalToolSignals = this.directActionPreference + this.askFirstPreference;
    if (totalToolSignals >= 3) {
      const directRatio = this.directActionPreference / totalToolSignals;
      if (directRatio > 0.7) {
        learned['Tool usage'] = '"Just do it" - prefers direct action over asking permission';
      } else if (directRatio < 0.3) {
        learned['Tool usage'] = 'Prefers being asked before executing commands or tools';
      }
    }

    // Analyze tool feedback
    const totalToolFeedback = this.positiveToolFeedback + this.negativeToolFeedback;
    if (totalToolFeedback >= 3) {
      const positiveRatio = this.positiveToolFeedback / totalToolFeedback;
      if (positiveRatio > 0.8) {
        learned['Tool appreciation'] = 'Appreciates proactive tool usage - keep using tools!';
      } else if (positiveRatio < 0.3) {
        learned['Tool caution'] = 'Be more conservative with automatic tool execution';
      }
    }

    // Update Soul Document with learned preferences
    if (Object.keys(learned).length > 0) {
      this.updateSoulDocument(learned);
    }

    // Clear old signals (keep last 24 hours)
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.signals = this.signals.filter(s => s.timestamp > dayAgo);

    this.emit('analyzed', learned);
  }

  private updateSoulDocument(learned: Partial<Record<string, string>>): void {
    for (const [category, value] of Object.entries(learned)) {
      if (value) {
        this.soulStore.addLearnedPreference(category, value);
        log.info(`[PreferenceLearner] Updated preference: ${category} = ${value}`);
      }
    }
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Get current learned preferences summary
   */
  getLearnedPreferences(): LearnedPreferences {
    const avgLength = this.responseLengthHistory.length > 0
      ? this.responseLengthHistory.reduce((a, b) => a + b, 0) / this.responseLengthHistory.length
      : 800;

    const codeRatio = this.codeRequestCount + this.explanationRequestCount > 0
      ? this.codeRequestCount / (this.codeRequestCount + this.explanationRequestCount)
      : 0.5;

    const directRatio = this.directActionPreference + this.askFirstPreference > 0
      ? this.directActionPreference / (this.directActionPreference + this.askFirstPreference)
      : 0.5;

    return {
      responseStyle: avgLength < 500 ? 'concise' : avgLength > 1500 ? 'detailed' : 'balanced',
      codeVsExplanation: codeRatio > 0.7 ? 'code_first' : codeRatio < 0.3 ? 'explanation_first' : 'balanced',
      communicationTone: 'adaptive',
      proactiveLevel: 'moderate',
      technicalDepth: 'intermediate',
      toolUsageStyle: directRatio > 0.7 ? 'just_do_it' : directRatio < 0.3 ? 'ask_first' : 'explain_after',
    };
  }

  /**
   * Get statistics about learning
   */
  getStats(): {
    totalSignals: number;
    codeRequests: number;
    explanationRequests: number;
    directActionSignals: number;
    askFirstSignals: number;
    avgResponseLength: number;
  } {
    return {
      totalSignals: this.signals.length,
      codeRequests: this.codeRequestCount,
      explanationRequests: this.explanationRequestCount,
      directActionSignals: this.directActionPreference,
      askFirstSignals: this.askFirstPreference,
      avgResponseLength: this.responseLengthHistory.length > 0
        ? Math.round(this.responseLengthHistory.reduce((a, b) => a + b, 0) / this.responseLengthHistory.length)
        : 0,
    };
  }

  /**
   * Force an immediate analysis
   */
  forceAnalysis(): void {
    this.analyzeAndUpdate();
  }

  /**
   * Reset all learned data
   */
  reset(): void {
    this.signals = [];
    this.responseLengthHistory = [];
    this.codeRequestCount = 0;
    this.explanationRequestCount = 0;
    this.positiveToolFeedback = 0;
    this.negativeToolFeedback = 0;
    this.directActionPreference = 0;
    this.askFirstPreference = 0;

    log.info('[PreferenceLearner] Reset all learned data');
    this.emit('reset');
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let preferenceLearnerInstance: PreferenceLearner | null = null;

export function getPreferenceLearner(): PreferenceLearner {
  if (!preferenceLearnerInstance) {
    preferenceLearnerInstance = new PreferenceLearner();
  }
  return preferenceLearnerInstance;
}

export default PreferenceLearner;
