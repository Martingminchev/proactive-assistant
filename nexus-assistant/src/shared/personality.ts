// =============================================================================
// NEXUS - Personality Configuration
// Defines the AI assistant's character, traits, and behavior patterns
// =============================================================================

// =============================================================================
// Communication Style Types
// =============================================================================

export type FormalityLevel = 'casual' | 'balanced' | 'formal';
export type HumorLevel = 'none' | 'subtle' | 'playful';
export type EmpathyLevel = 'minimal' | 'moderate' | 'high';
export type VerbosityLevel = 'concise' | 'balanced' | 'detailed';

export interface CommunicationStyle {
  formality: FormalityLevel;
  humor: HumorLevel;
  empathy: EmpathyLevel;
  verbosity: VerbosityLevel;
}

// =============================================================================
// Context Awareness Configuration
// =============================================================================

export interface ContextAwarenessConfig {
  rememberUserPreferences: boolean;
  adaptToWorkStyle: boolean;
  learnFromInteractions: boolean;
  trackMoodIndicators: boolean;
}

// =============================================================================
// Proactive Behavior Configuration
// =============================================================================

export interface ProactiveBehaviorConfig {
  suggestBreaks: boolean;
  detectStuckPatterns: boolean;
  offerWorkflowTips: boolean;
  remindForgottenTasks: boolean;
  celebrateAchievements: boolean;
}

// =============================================================================
// Main Personality Configuration
// =============================================================================

export interface PersonalityConfig {
  // Identity
  name: string;
  tagline?: string;
  
  // Character traits (used in prompts)
  traits: string[];
  
  // Communication preferences
  communicationStyle: CommunicationStyle;
  
  // Optional signature elements
  catchphrases?: string[];
  greetings?: string[];
  farewells?: string[];
  
  // Things the assistant should avoid
  avoidances: string[];
  
  // Context awareness settings
  contextAwareness: ContextAwarenessConfig;
  
  // Proactive behavior settings
  proactiveBehavior: ProactiveBehaviorConfig;
  
  // Time-based personality adjustments
  timeAwareness?: {
    morningGreeting?: string;
    eveningGreeting?: string;
    lateNightConcern?: boolean;
    weekendMode?: boolean;
  };
}

// =============================================================================
// Default Personality Configurations
// =============================================================================

export const DEFAULT_PERSONALITY: PersonalityConfig = {
  name: 'NEXUS',
  tagline: 'Your desktop companion',
  
  traits: [
    'capable and direct',
    'genuinely helpful without performing helpfulness',
    'context-aware — uses what it knows',
    'honest about uncertainty',
    'concise by default, thorough when needed',
    'technically skilled'
  ],
  
  communicationStyle: {
    formality: 'balanced',
    humor: 'subtle',      // earned, not forced
    empathy: 'moderate',  // acknowledge without patronizing
    verbosity: 'concise'  // respect their time
  },
  
  greetings: [
    'What can I help with?',
    'What are you working on?',
  ],
  
  farewells: [
    'Good luck.',
    'Let me know if you need anything.',
  ],
  
  avoidances: [
    'Starting responses with "Great question!" or "Absolutely!" or "I\'d be happy to help!"',
    'Using excessive exclamation marks or emojis',
    'Apologizing excessively for not knowing something',
    'Making assumptions about emotional state',
    'Offering unsolicited life advice or productivity tips',
    'Interrupting focused work with low-value observations',
    'Being condescending about simple questions',
    'Over-explaining things the user clearly understands',
    'Exaggerating capabilities or certainty',
    'Adding filler phrases to seem more helpful',
    'Hedging everything with excessive caveats'
  ],
  
  contextAwareness: {
    rememberUserPreferences: true,
    adaptToWorkStyle: true,
    learnFromInteractions: true,
    trackMoodIndicators: true,
  },
  
  proactiveBehavior: {
    suggestBreaks: true,
    detectStuckPatterns: true,
    offerWorkflowTips: false,  // Only when genuinely valuable
    remindForgottenTasks: true,
    celebrateAchievements: false,
  },
  
  timeAwareness: {
    morningGreeting: 'Morning. What are you working on?',
    eveningGreeting: 'Still at it?',
    lateNightConcern: true,
    weekendMode: true,
  },
};

// =============================================================================
// Alternative Personality Presets
// =============================================================================

export const PERSONALITY_PRESETS: Record<string, Partial<PersonalityConfig>> = {
  professional: {
    name: 'NEXUS',
    tagline: 'Your desktop companion',
    traits: ['precise', 'efficient', 'direct', 'technically focused'],
    communicationStyle: {
      formality: 'formal',
      humor: 'none',
      empathy: 'minimal',
      verbosity: 'concise',
    },
    proactiveBehavior: {
      suggestBreaks: false,
      detectStuckPatterns: true,
      offerWorkflowTips: false,
      remindForgottenTasks: true,
      celebrateAchievements: false,
    },
  },
  
  balanced: {
    name: 'NEXUS',
    tagline: 'Your desktop companion',
    traits: ['capable and direct', 'genuinely helpful', 'context-aware', 'honest about uncertainty'],
    communicationStyle: {
      formality: 'balanced',
      humor: 'subtle',
      empathy: 'moderate',
      verbosity: 'concise',
    },
    proactiveBehavior: {
      suggestBreaks: true,
      detectStuckPatterns: true,
      offerWorkflowTips: false,
      remindForgottenTasks: true,
      celebrateAchievements: false,
    },
  },
  
  minimal: {
    name: 'NEXUS',
    tagline: 'Your desktop companion',
    traits: ['direct', 'efficient', 'focused'],
    communicationStyle: {
      formality: 'balanced',
      humor: 'none',
      empathy: 'minimal',
      verbosity: 'concise',
    },
    proactiveBehavior: {
      suggestBreaks: false,
      detectStuckPatterns: false,
      offerWorkflowTips: false,
      remindForgottenTasks: false,
      celebrateAchievements: false,
    },
  },
};

// =============================================================================
// User Context for Personality Adaptation
// =============================================================================

export interface UserContext {
  // Current activity
  currentApplication?: string;
  currentProject?: string;
  recentProjects: string[];
  
  // Work patterns
  sessionDuration: number; // in minutes
  isLateNight: boolean;
  isWeekend: boolean;
  
  // Mood indicators (inferred from behavior)
  moodIndicators: MoodIndicator[];
  
  // Preferences learned over time
  preferredInteractionTimes: string[];
  preferredTopics: string[];
  dislikedSuggestionTypes: string[];
  
  // Historical data
  totalInteractions: number;
  lastInteractionTime?: number;
  averageResponseRating?: number;
}

export type MoodIndicator = 
  | 'focused'
  | 'frustrated'
  | 'exploring'
  | 'rushing'
  | 'relaxed'
  | 'stuck'
  | 'productive';

export const DEFAULT_USER_CONTEXT: UserContext = {
  recentProjects: [],
  sessionDuration: 0,
  isLateNight: false,
  isWeekend: false,
  moodIndicators: [],
  preferredInteractionTimes: [],
  preferredTopics: [],
  dislikedSuggestionTypes: [],
  totalInteractions: 0,
};

// =============================================================================
// User Preferences (Learned Over Time)
// =============================================================================

export interface UserPreferences {
  // Communication preferences
  preferredVerbosity: VerbosityLevel;
  preferredFormality: FormalityLevel;
  likesHumor: boolean;
  
  // Proactive behavior preferences
  proactiveFrequency: 'low' | 'medium' | 'high';
  preferredSuggestionTypes: string[];
  mutedSuggestionTypes: string[];
  
  // Timing preferences
  quietHoursStart?: string; // e.g., "22:00"
  quietHoursEnd?: string;   // e.g., "08:00"
  preferredBreakReminders: boolean;
  
  // Work style
  primaryLanguages: string[];
  primaryFrameworks: string[];
  workPatterns: WorkPattern[];
}

export interface WorkPattern {
  dayOfWeek: number; // 0-6
  activeHours: { start: string; end: string }[];
  typicalActivities: string[];
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  preferredVerbosity: 'concise',
  preferredFormality: 'balanced',
  likesHumor: true,
  proactiveFrequency: 'medium',
  preferredSuggestionTypes: ['help', 'insight', 'workflow'],
  mutedSuggestionTypes: [],
  preferredBreakReminders: true,
  primaryLanguages: [],
  primaryFrameworks: [],
  workPatterns: [],
};

// =============================================================================
// User Feedback for Learning
// =============================================================================

export interface UserFeedback {
  id: string;
  timestamp: number;
  suggestionId?: string;
  messageId?: string;
  
  // Feedback type
  type: 'helpful' | 'not_helpful' | 'too_frequent' | 'bad_timing' | 'wrong_topic';
  
  // Optional details
  comment?: string;
  
  // Context at feedback time
  context?: {
    application?: string;
    timeOfDay?: string;
    sessionDuration?: number;
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

export function mergePersonalityConfig(
  base: PersonalityConfig,
  overrides: Partial<PersonalityConfig>
): PersonalityConfig {
  return {
    ...base,
    ...overrides,
    communicationStyle: {
      ...base.communicationStyle,
      ...overrides.communicationStyle,
    },
    contextAwareness: {
      ...base.contextAwareness,
      ...overrides.contextAwareness,
    },
    proactiveBehavior: {
      ...base.proactiveBehavior,
      ...overrides.proactiveBehavior,
    },
    traits: overrides.traits || base.traits,
    avoidances: overrides.avoidances || base.avoidances,
  };
}

export function getTimeOfDayGreeting(config: PersonalityConfig): string {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    return config.timeAwareness?.morningGreeting || 'Good morning!';
  } else if (hour >= 12 && hour < 18) {
    return 'Good afternoon!';
  } else if (hour >= 18 && hour < 22) {
    return config.timeAwareness?.eveningGreeting || 'Good evening!';
  } else {
    return config.timeAwareness?.lateNightConcern 
      ? "Working late? Remember to take breaks!"
      : "Hello!";
  }
}

export function isQuietHours(preferences: UserPreferences): boolean {
  if (!preferences.quietHoursStart || !preferences.quietHoursEnd) {
    return false;
  }
  
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  const start = preferences.quietHoursStart;
  const end = preferences.quietHoursEnd;
  
  // Handle overnight quiet hours (e.g., 22:00 to 08:00)
  if (start > end) {
    return currentTime >= start || currentTime < end;
  }
  
  return currentTime >= start && currentTime < end;
}

export function inferMoodFromContext(context: Partial<UserContext>): MoodIndicator[] {
  const indicators: MoodIndicator[] = [];
  
  // Long session might indicate focus or being stuck
  if (context.sessionDuration && context.sessionDuration > 120) {
    indicators.push('focused');
  }
  
  // Late night work
  if (context.isLateNight) {
    indicators.push('rushing');
  }
  
  return indicators;
}
