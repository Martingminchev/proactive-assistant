// =============================================================================
// NEXUS - User Memory Store
// Persistent storage for user preferences, feedback, and learned patterns
// =============================================================================

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import log from 'electron-log';
import {
  UserPreferences,
  UserFeedback,
  UserContext,
  WorkPattern,
  DEFAULT_USER_PREFERENCES,
  DEFAULT_USER_CONTEXT,
} from '../../shared/personality';

// =============================================================================
// Store Types
// =============================================================================

interface UserMemoryData {
  version: number;
  lastUpdated: number;
  
  // User preferences (learned and configured)
  preferences: UserPreferences;
  
  // Aggregated context data
  context: StoredUserContext;
  
  // Feedback history
  feedbackHistory: UserFeedback[];
  
  // Interaction statistics
  stats: InteractionStats;
  
  // Learned patterns
  patterns: LearnedPatterns;
}

interface StoredUserContext {
  recentProjects: ProjectHistory[];
  preferredInteractionTimes: TimePreference[];
  preferredTopics: TopicPreference[];
  dislikedSuggestionTypes: string[];
  totalInteractions: number;
  lastInteractionTime: number;
  averageResponseRating: number;
}

interface ProjectHistory {
  name: string;
  lastAccessed: number;
  totalTimeMinutes: number;
  accessCount: number;
}

interface TimePreference {
  dayOfWeek: number;
  hour: number;
  interactionCount: number;
  successRate: number;
}

interface TopicPreference {
  topic: string;
  interactionCount: number;
  helpfulCount: number;
}

interface InteractionStats {
  totalSuggestions: number;
  acceptedSuggestions: number;
  dismissedSuggestions: number;
  snoozedSuggestions: number;
  totalChats: number;
  averageSessionDuration: number;
  sessionsCount: number;
}

interface LearnedPatterns {
  // Time patterns
  activeHours: { hour: number; activity: number }[];
  activeDays: { day: number; activity: number }[];
  
  // Behavior patterns
  typicalSessionLength: number;
  breakPatterns: { afterMinutes: number; duration: number }[];
  
  // Content patterns
  frequentTopics: { topic: string; count: number }[];
  preferredSuggestionTypes: { type: string; acceptRate: number }[];
}

const DEFAULT_MEMORY_DATA: UserMemoryData = {
  version: 1,
  lastUpdated: Date.now(),
  preferences: DEFAULT_USER_PREFERENCES,
  context: {
    recentProjects: [],
    preferredInteractionTimes: [],
    preferredTopics: [],
    dislikedSuggestionTypes: [],
    totalInteractions: 0,
    lastInteractionTime: 0,
    averageResponseRating: 0,
  },
  feedbackHistory: [],
  stats: {
    totalSuggestions: 0,
    acceptedSuggestions: 0,
    dismissedSuggestions: 0,
    snoozedSuggestions: 0,
    totalChats: 0,
    averageSessionDuration: 0,
    sessionsCount: 0,
  },
  patterns: {
    activeHours: [],
    activeDays: [],
    typicalSessionLength: 60,
    breakPatterns: [],
    frequentTopics: [],
    preferredSuggestionTypes: [],
  },
};

// =============================================================================
// User Memory Store Class
// =============================================================================

export class UserMemoryStore extends EventEmitter {
  private data: UserMemoryData;
  private filePath: string;
  private saveTimer: NodeJS.Timeout | null = null;
  private saveDebounceMs: number = 5000;
  private isDirty: boolean = false;

  constructor(fileName: string = 'user-memory.json') {
    super();
    
    // Store in user data directory
    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, fileName);
    
    // Initialize with defaults
    this.data = { ...DEFAULT_MEMORY_DATA };
    
    // Load existing data
    this.load();
  }

  // ===========================================================================
  // Persistence
  // ===========================================================================

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        const loaded = JSON.parse(content) as UserMemoryData;
        
        // Merge with defaults to handle new fields
        this.data = this.mergeWithDefaults(loaded);
        
        log.debug('[UserMemoryStore] Loaded user memory data');
      } else {
        log.debug('[UserMemoryStore] No existing data, using defaults');
      }
    } catch (error) {
      log.error('[UserMemoryStore] Error loading data:', error);
      this.data = { ...DEFAULT_MEMORY_DATA };
    }
  }

  private mergeWithDefaults(loaded: Partial<UserMemoryData>): UserMemoryData {
    return {
      version: loaded.version || DEFAULT_MEMORY_DATA.version,
      lastUpdated: loaded.lastUpdated || Date.now(),
      preferences: { ...DEFAULT_MEMORY_DATA.preferences, ...loaded.preferences },
      context: { ...DEFAULT_MEMORY_DATA.context, ...loaded.context },
      feedbackHistory: loaded.feedbackHistory || [],
      stats: { ...DEFAULT_MEMORY_DATA.stats, ...loaded.stats },
      patterns: { ...DEFAULT_MEMORY_DATA.patterns, ...loaded.patterns },
    };
  }

  private scheduleSave(): void {
    this.isDirty = true;
    
    if (this.saveTimer) {
      return; // Already scheduled
    }

    this.saveTimer = setTimeout(() => {
      this.save();
      this.saveTimer = null;
    }, this.saveDebounceMs);
  }

  private save(): void {
    if (!this.isDirty) {
      return;
    }

    try {
      this.data.lastUpdated = Date.now();
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
      this.isDirty = false;
      log.debug('[UserMemoryStore] Saved user memory data');
    } catch (error) {
      log.error('[UserMemoryStore] Error saving data:', error);
    }
  }

  // Force immediate save
  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.save();
  }

  // ===========================================================================
  // Preferences Management
  // ===========================================================================

  getPreferences(): UserPreferences {
    return { ...this.data.preferences };
  }

  updatePreferences(updates: Partial<UserPreferences>): void {
    this.data.preferences = { ...this.data.preferences, ...updates };
    this.scheduleSave();
    this.emit('preferences-updated', this.data.preferences);
  }

  // ===========================================================================
  // Feedback Management
  // ===========================================================================

  recordFeedback(feedback: UserFeedback): void {
    // Add to history (keep last 100)
    this.data.feedbackHistory.push(feedback);
    if (this.data.feedbackHistory.length > 100) {
      this.data.feedbackHistory = this.data.feedbackHistory.slice(-100);
    }

    // Update stats based on feedback
    if (feedback.type === 'helpful') {
      this.data.stats.acceptedSuggestions++;
    } else if (feedback.type === 'not_helpful') {
      this.data.stats.dismissedSuggestions++;
    }

    // Learn from feedback
    this.learnFromFeedback(feedback);

    this.scheduleSave();
    this.emit('feedback-recorded', feedback);
  }

  private learnFromFeedback(feedback: UserFeedback): void {
    // Learn time preferences
    if (feedback.context?.timeOfDay) {
      this.updateTimePreference(feedback);
    }

    // Learn topic preferences
    if (feedback.suggestionId) {
      this.updateTopicPreferences(feedback);
    }

    // Update disliked suggestion types
    if (feedback.type === 'not_helpful' || feedback.type === 'too_frequent') {
      // Could extract suggestion type and add to disliked list
    }
  }

  private updateTimePreference(feedback: UserFeedback): void {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();

    let timePrefs = this.data.context.preferredInteractionTimes;
    let existing = timePrefs.find(t => t.dayOfWeek === dayOfWeek && t.hour === hour);

    if (existing) {
      existing.interactionCount++;
      if (feedback.type === 'helpful') {
        existing.successRate = (existing.successRate * (existing.interactionCount - 1) + 1) / existing.interactionCount;
      } else {
        existing.successRate = (existing.successRate * (existing.interactionCount - 1)) / existing.interactionCount;
      }
    } else {
      timePrefs.push({
        dayOfWeek,
        hour,
        interactionCount: 1,
        successRate: feedback.type === 'helpful' ? 1 : 0,
      });
    }

    // Keep only top time preferences
    this.data.context.preferredInteractionTimes = timePrefs
      .sort((a, b) => b.successRate * b.interactionCount - a.successRate * a.interactionCount)
      .slice(0, 24);
  }

  private updateTopicPreferences(feedback: UserFeedback): void {
    // This would require knowing the topic of the suggestion
    // For now, we can infer from the application context
    if (feedback.context?.application) {
      const topic = this.inferTopicFromApp(feedback.context.application);
      if (topic) {
        let topicPref = this.data.context.preferredTopics.find(t => t.topic === topic);
        if (topicPref) {
          topicPref.interactionCount++;
          if (feedback.type === 'helpful') {
            topicPref.helpfulCount++;
          }
        } else {
          this.data.context.preferredTopics.push({
            topic,
            interactionCount: 1,
            helpfulCount: feedback.type === 'helpful' ? 1 : 0,
          });
        }
      }
    }
  }

  private inferTopicFromApp(app: string): string | null {
    const appLower = app.toLowerCase();
    if (appLower.includes('code') || appLower.includes('cursor') || appLower.includes('vim')) {
      return 'coding';
    }
    if (appLower.includes('chrome') || appLower.includes('firefox') || appLower.includes('edge')) {
      return 'browsing';
    }
    if (appLower.includes('slack') || appLower.includes('teams') || appLower.includes('discord')) {
      return 'communication';
    }
    if (appLower.includes('terminal') || appLower.includes('iterm')) {
      return 'terminal';
    }
    return null;
  }

  getFeedbackHistory(limit: number = 20): UserFeedback[] {
    return this.data.feedbackHistory.slice(-limit);
  }

  // ===========================================================================
  // Context Management
  // ===========================================================================

  getUserContext(): UserContext {
    const ctx = this.data.context;
    const now = new Date();

    return {
      recentProjects: ctx.recentProjects.slice(0, 5).map(p => p.name),
      sessionDuration: 0, // This should come from the current session
      isLateNight: now.getHours() >= 22 || now.getHours() < 6,
      isWeekend: now.getDay() === 0 || now.getDay() === 6,
      moodIndicators: [],
      preferredInteractionTimes: ctx.preferredInteractionTimes
        .sort((a, b) => b.successRate - a.successRate)
        .slice(0, 5)
        .map(t => `${t.dayOfWeek}:${t.hour}`),
      preferredTopics: ctx.preferredTopics
        .sort((a, b) => b.helpfulCount - a.helpfulCount)
        .slice(0, 5)
        .map(t => t.topic),
      dislikedSuggestionTypes: ctx.dislikedSuggestionTypes,
      totalInteractions: ctx.totalInteractions,
      lastInteractionTime: ctx.lastInteractionTime,
      averageResponseRating: ctx.averageResponseRating,
    };
  }

  recordInteraction(): void {
    this.data.context.totalInteractions++;
    this.data.context.lastInteractionTime = Date.now();
    this.scheduleSave();
  }

  recordProjectAccess(projectName: string, durationMinutes: number = 0): void {
    let project = this.data.context.recentProjects.find(p => p.name === projectName);
    
    if (project) {
      project.lastAccessed = Date.now();
      project.totalTimeMinutes += durationMinutes;
      project.accessCount++;
    } else {
      this.data.context.recentProjects.push({
        name: projectName,
        lastAccessed: Date.now(),
        totalTimeMinutes: durationMinutes,
        accessCount: 1,
      });
    }

    // Keep only recent projects (last 20)
    this.data.context.recentProjects = this.data.context.recentProjects
      .sort((a, b) => b.lastAccessed - a.lastAccessed)
      .slice(0, 20);

    this.scheduleSave();
  }

  // ===========================================================================
  // Stats Management
  // ===========================================================================

  getStats(): InteractionStats {
    return { ...this.data.stats };
  }

  recordSuggestion(action: 'accepted' | 'dismissed' | 'snoozed'): void {
    this.data.stats.totalSuggestions++;
    
    switch (action) {
      case 'accepted':
        this.data.stats.acceptedSuggestions++;
        break;
      case 'dismissed':
        this.data.stats.dismissedSuggestions++;
        break;
      case 'snoozed':
        this.data.stats.snoozedSuggestions++;
        break;
    }

    this.scheduleSave();
  }

  recordChatSession(): void {
    this.data.stats.totalChats++;
    this.scheduleSave();
  }

  recordSessionEnd(durationMinutes: number): void {
    const { sessionsCount, averageSessionDuration } = this.data.stats;
    
    // Update rolling average
    this.data.stats.averageSessionDuration = 
      (averageSessionDuration * sessionsCount + durationMinutes) / (sessionsCount + 1);
    this.data.stats.sessionsCount++;

    // Update patterns
    this.data.patterns.typicalSessionLength = this.data.stats.averageSessionDuration;

    this.scheduleSave();
  }

  // ===========================================================================
  // Pattern Learning
  // ===========================================================================

  getLearnedPatterns(): LearnedPatterns {
    return { ...this.data.patterns };
  }

  recordActivity(hour: number, dayOfWeek: number): void {
    // Update hourly activity
    let hourEntry = this.data.patterns.activeHours.find(h => h.hour === hour);
    if (hourEntry) {
      hourEntry.activity++;
    } else {
      this.data.patterns.activeHours.push({ hour, activity: 1 });
    }

    // Update daily activity
    let dayEntry = this.data.patterns.activeDays.find(d => d.day === dayOfWeek);
    if (dayEntry) {
      dayEntry.activity++;
    } else {
      this.data.patterns.activeDays.push({ day: dayOfWeek, activity: 1 });
    }

    this.scheduleSave();
  }

  recordBreak(afterMinutes: number, durationMinutes: number): void {
    this.data.patterns.breakPatterns.push({
      afterMinutes,
      duration: durationMinutes,
    });

    // Keep only last 50 break patterns
    if (this.data.patterns.breakPatterns.length > 50) {
      this.data.patterns.breakPatterns = this.data.patterns.breakPatterns.slice(-50);
    }

    this.scheduleSave();
  }

  // ===========================================================================
  // Suggestion Type Learning
  // ===========================================================================

  recordSuggestionTypeOutcome(suggestionType: string, accepted: boolean): void {
    let typeEntry = this.data.patterns.preferredSuggestionTypes.find(t => t.type === suggestionType);
    
    if (typeEntry) {
      const total = 1 / typeEntry.acceptRate; // Estimate total from rate
      typeEntry.acceptRate = (typeEntry.acceptRate * total + (accepted ? 1 : 0)) / (total + 1);
    } else {
      this.data.patterns.preferredSuggestionTypes.push({
        type: suggestionType,
        acceptRate: accepted ? 1 : 0,
      });
    }

    // Update disliked types
    if (!accepted) {
      const failedTypes = this.data.patterns.preferredSuggestionTypes
        .filter(t => t.acceptRate < 0.3)
        .map(t => t.type);
      
      for (const failedType of failedTypes) {
        if (!this.data.context.dislikedSuggestionTypes.includes(failedType)) {
          this.data.context.dislikedSuggestionTypes.push(failedType);
        }
      }
    }

    this.scheduleSave();
  }

  getSuggestionTypePreference(suggestionType: string): number {
    const entry = this.data.patterns.preferredSuggestionTypes.find(t => t.type === suggestionType);
    return entry?.acceptRate ?? 0.5; // Default to 50% if unknown
  }

  // ===========================================================================
  // Query Methods
  // ===========================================================================

  isGoodTimeForSuggestion(): boolean {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    // Check quiet hours
    const { quietHoursStart, quietHoursEnd } = this.data.preferences;
    if (quietHoursStart && quietHoursEnd) {
      const currentTime = `${hour.toString().padStart(2, '0')}:00`;
      if (quietHoursStart > quietHoursEnd) {
        // Overnight quiet hours
        if (currentTime >= quietHoursStart || currentTime < quietHoursEnd) {
          return false;
        }
      } else if (currentTime >= quietHoursStart && currentTime < quietHoursEnd) {
        return false;
      }
    }

    // Check historical success at this time
    const timePref = this.data.context.preferredInteractionTimes.find(
      t => t.dayOfWeek === dayOfWeek && t.hour === hour
    );

    if (timePref && timePref.successRate < 0.3 && timePref.interactionCount > 3) {
      return false; // Bad time based on history
    }

    return true;
  }

  getActiveHours(): number[] {
    return this.data.patterns.activeHours
      .sort((a, b) => b.activity - a.activity)
      .slice(0, 8)
      .map(h => h.hour);
  }

  getAcceptanceRate(): number {
    const { acceptedSuggestions, totalSuggestions } = this.data.stats;
    if (totalSuggestions === 0) return 0.5;
    return acceptedSuggestions / totalSuggestions;
  }

  // ===========================================================================
  // Reset
  // ===========================================================================

  reset(): void {
    this.data = { ...DEFAULT_MEMORY_DATA };
    this.save();
    this.emit('reset');
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let memoryStoreInstance: UserMemoryStore | null = null;

export function getUserMemoryStore(): UserMemoryStore {
  if (!memoryStoreInstance) {
    memoryStoreInstance = new UserMemoryStore();
  }
  return memoryStoreInstance;
}

export default UserMemoryStore;
