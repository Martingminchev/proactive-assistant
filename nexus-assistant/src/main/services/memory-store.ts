// =============================================================================
// NEXUS - Memory Store Service
// Persistent storage for user preferences, patterns, and learned knowledge
// =============================================================================

import { app } from 'electron';
import log from 'electron-log';
import path from 'path';
import fs from 'fs/promises';
import { EventEmitter } from 'events';
import { DetectedIntent, IntentType } from './intent-engine';

// =============================================================================
// Memory Data Types
// =============================================================================

export interface UserPreference {
  id: string;
  category: 'communication' | 'workflow' | 'technical' | 'privacy';
  key: string;
  value: any;
  confidence: number;      // How certain we are of this preference (0-1)
  source: 'explicit' | 'inferred' | 'learned'; // How we learned it
  timestamp: number;
  lastAccessed: number;
  accessCount: number;
}

export interface TaskPattern {
  id: string;
  name: string;
  intentType: IntentType;
  technologies: string[];
  applications: string[];
  steps: TaskStep[];
  averageDurationMinutes: number;
  completionRate: number;  // 0-1
  createdAt: number;
  lastExecutedAt: number;
  executionCount: number;
}

export interface TaskStep {
  order: number;
  description: string;
  application?: string;
  estimatedDurationMinutes: number;
  optional: boolean;
}

export interface ErrorSolution {
  id: string;
  errorPattern: string;        // Regex pattern or keyword
  errorHash: string;           // For quick lookup
  technologies: string[];
  solution: string;
  source: 'user_provided' | 'learned' | 'external';
  successRate: number;         // 0-1 based on success reports
  usageCount: number;
  createdAt: number;
  lastUsedAt: number;
  context?: {
    windowTitle?: string;
    application?: string;
    project?: string;
  };
}

export interface WorkContext {
  id: string;
  timestamp: number;
  intent: IntentType;
  application: string;
  project?: string;
  technologies: string[];
  duration: number;
  outcome: 'completed' | 'interrupted' | 'abandoned' | 'ongoing';
  notes?: string;
}

export interface LearnedAssociation {
  id: string;
  triggerType: 'time' | 'application' | 'project' | 'intent';
  triggerValue: string;
  associatedAction: string;
  confidence: number;
  occurrenceCount: number;
  lastOccurredAt: number;
}

export interface DailySummary {
  date: string;              // YYYY-MM-DD
  intents: Record<IntentType, number>;
  applications: Record<string, number>;
  projects: Record<string, number>;
  focusScore: number;
  struggleEvents: number;
  productiveHours: number;
}

// =============================================================================
// Memory Store Data Structure
// =============================================================================

interface MemoryStoreData {
  version: number;
  preferences: UserPreference[];
  taskPatterns: TaskPattern[];
  errorSolutions: ErrorSolution[];
  workHistory: WorkContext[];
  learnedAssociations: LearnedAssociation[];
  dailySummaries: DailySummary[];
  privacySettings: PrivacySettings;
}

export interface PrivacySettings {
  retainWorkHistoryDays: number;
  retainErrorSolutions: boolean;
  allowPatternLearning: boolean;
  allowPreferenceLearning: boolean;
  sensitiveApplications: string[];
  sensitiveProjects: string[];
  dataRetentionLevel: 'minimal' | 'balanced' | 'comprehensive';
}

const MEMORY_VERSION = 1;
const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  retainWorkHistoryDays: 30,
  retainErrorSolutions: true,
  allowPatternLearning: true,
  allowPreferenceLearning: true,
  sensitiveApplications: ['1password', 'lastpass', 'keychain', 'bank', 'paypal'],
  sensitiveProjects: [],
  dataRetentionLevel: 'balanced',
};

// =============================================================================
// Memory Store Configuration
// =============================================================================

export interface MemoryStoreConfig {
  autoSaveIntervalMs: number;
  maxWorkHistorySize: number;
  maxErrorSolutions: number;
  maxTaskPatterns: number;
  patternLearningThreshold: number;
}

const DEFAULT_MEMORY_CONFIG: MemoryStoreConfig = {
  autoSaveIntervalMs: 60000,      // 1 minute
  maxWorkHistorySize: 1000,
  maxErrorSolutions: 500,
  maxTaskPatterns: 100,
  patternLearningThreshold: 3,    // Need 3 occurrences to form a pattern
};

// =============================================================================
// Memory Store Class
// =============================================================================

export class MemoryStore extends EventEmitter {
  private data: MemoryStoreData;
  private config: MemoryStoreConfig;
  private filePath: string;
  private saveTimeout: NodeJS.Timeout | null = null;
  private autoSaveInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<MemoryStoreConfig>) {
    super();
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    
    this.data = {
      version: MEMORY_VERSION,
      preferences: [],
      taskPatterns: [],
      errorSolutions: [],
      workHistory: [],
      learnedAssociations: [],
      dailySummaries: [],
      privacySettings: { ...DEFAULT_PRIVACY_SETTINGS },
    };

    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, 'memory-store.json');

    this.load();
    this.startAutoSave();
  }

  // ===========================================================================
  // Persistence
  // ===========================================================================

  private async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(content) as MemoryStoreData;

      if (parsed.version !== MEMORY_VERSION) {
        log.debug(`[MemoryStore] Migrating from version ${parsed.version} to ${MEMORY_VERSION}`);
        this.migrateData(parsed);
      }

      this.data = parsed;
      log.debug(`[MemoryStore] Loaded: ${this.data.preferences.length} preferences, ${this.data.taskPatterns.length} patterns`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        log.error('[MemoryStore] Load error:', error);
      }
      // Use defaults for new store
    }
  }

  private migrateData(oldData: any): void {
    // Handle future migrations here
    oldData.version = MEMORY_VERSION;
  }

  private startAutoSave(): void {
    this.autoSaveInterval = setInterval(() => {
      this.save();
    }, this.config.autoSaveIntervalMs);
  }

  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.save();
    }, 1000);
  }

  async save(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      
      // Sanitize sensitive data before saving
      const sanitized = this.sanitizeForStorage();
      
      await fs.writeFile(this.filePath, JSON.stringify(sanitized, null, 2), 'utf-8');
      this.emit('saved');
    } catch (error) {
      log.error('[MemoryStore] Save error:', error);
      this.emit('saveError', error);
    }
  }

  private sanitizeForStorage(): MemoryStoreData {
    const sensitiveApps = new Set(this.data.privacySettings.sensitiveApplications.map(a => a.toLowerCase()));
    
    // Filter out sensitive work history
    const filteredHistory = this.data.workHistory.filter(work => {
      return !sensitiveApps.has(work.application.toLowerCase());
    });

    return {
      ...this.data,
      workHistory: filteredHistory,
    };
  }

  stop(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
  }

  // ===========================================================================
  // Privacy Controls
  // ===========================================================================

  updatePrivacySettings(settings: Partial<PrivacySettings>): void {
    this.data.privacySettings = { ...this.data.privacySettings, ...settings };
    this.applyPrivacySettings();
    this.scheduleSave();
  }

  getPrivacySettings(): PrivacySettings {
    return { ...this.data.privacySettings };
  }

  private applyPrivacySettings(): void {
    const settings = this.data.privacySettings;

    // Apply retention policy
    const cutoffDate = Date.now() - (settings.retainWorkHistoryDays * 24 * 60 * 60 * 1000);
    this.data.workHistory = this.data.workHistory.filter(w => w.timestamp > cutoffDate);

    // Clear error solutions if disabled
    if (!settings.retainErrorSolutions) {
      this.data.errorSolutions = [];
    }

    // Limit based on retention level
    switch (settings.dataRetentionLevel) {
      case 'minimal':
        this.data.workHistory = this.data.workHistory.slice(-100);
        this.data.taskPatterns = this.data.taskPatterns.slice(-10);
        break;
      case 'balanced':
        this.data.workHistory = this.data.workHistory.slice(-500);
        this.data.taskPatterns = this.data.taskPatterns.slice(-50);
        break;
      case 'comprehensive':
        // Keep all within retention period
        break;
    }
  }

  addSensitiveApplication(appName: string): void {
    if (!this.data.privacySettings.sensitiveApplications.includes(appName)) {
      this.data.privacySettings.sensitiveApplications.push(appName);
      this.scheduleSave();
    }
  }

  removeSensitiveApplication(appName: string): void {
    this.data.privacySettings.sensitiveApplications = 
      this.data.privacySettings.sensitiveApplications.filter(a => a !== appName);
    this.scheduleSave();
  }

  // ===========================================================================
  // User Preferences
  // ===========================================================================

  setPreference(
    category: UserPreference['category'],
    key: string,
    value: any,
    source: UserPreference['source'] = 'inferred',
    confidence: number = 0.5
  ): UserPreference {
    const existingIndex = this.data.preferences.findIndex(
      p => p.category === category && p.key === key
    );

    const preference: UserPreference = {
      id: `pref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      category,
      key,
      value,
      confidence,
      source,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1,
    };

    if (existingIndex >= 0) {
      const existing = this.data.preferences[existingIndex];
      preference.id = existing.id;
      preference.accessCount = existing.accessCount + 1;
      // Update confidence if new info
      if (source === 'explicit') {
        preference.confidence = 1.0;
      } else {
        // Boost confidence with repeated observations
        preference.confidence = Math.min(0.95, existing.confidence + 0.1);
      }
      this.data.preferences[existingIndex] = preference;
    } else {
      this.data.preferences.push(preference);
    }

    this.scheduleSave();
    this.emit('preferenceUpdated', preference);
    return preference;
  }

  getPreference(category: string, key: string): UserPreference | null {
    const pref = this.data.preferences.find(
      p => p.category === category && p.key === key
    );
    
    if (pref) {
      pref.lastAccessed = Date.now();
      pref.accessCount++;
    }
    
    return pref || null;
  }

  getPreferencesByCategory(category: string): UserPreference[] {
    return this.data.preferences.filter(p => p.category === category);
  }

  getAllPreferences(): UserPreference[] {
    return [...this.data.preferences];
  }

  deletePreference(id: string): boolean {
    const index = this.data.preferences.findIndex(p => p.id === id);
    if (index >= 0) {
      this.data.preferences.splice(index, 1);
      this.scheduleSave();
      return true;
    }
    return false;
  }

  // ===========================================================================
  // Task Patterns
  // ===========================================================================

  recordIntent(intent: DetectedIntent): void {
    // Check if this is a sensitive context
    if (this.isSensitiveContext(intent.context)) {
      return;
    }

    // Record work context
    const workContext: WorkContext = {
      id: `work_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: intent.timestamp,
      intent: intent.type,
      application: intent.context.application,
      project: intent.context.project,
      technologies: intent.context.technologies,
      duration: intent.duration,
      outcome: 'ongoing',
    };

    // Update previous work context outcome if exists
    if (this.data.workHistory.length > 0) {
      const lastWork = this.data.workHistory[this.data.workHistory.length - 1];
      if (lastWork.outcome === 'ongoing') {
        lastWork.outcome = Date.now() - lastWork.timestamp > 300000 ? 'completed' : 'interrupted';
        lastWork.duration = Date.now() - lastWork.timestamp;
      }
    }

    this.data.workHistory.push(workContext);

    // Enforce size limit
    if (this.data.workHistory.length > this.config.maxWorkHistorySize) {
      this.data.workHistory = this.data.workHistory.slice(-this.config.maxWorkHistorySize);
    }

    // Learn patterns
    if (this.data.privacySettings.allowPatternLearning) {
      this.learnFromIntent(intent);
    }

    this.scheduleSave();
  }

  private isSensitiveContext(context: DetectedIntent['context']): boolean {
    const sensitiveApps = new Set(this.data.privacySettings.sensitiveApplications.map(a => a.toLowerCase()));
    const sensitiveProjects = new Set(this.data.privacySettings.sensitiveProjects.map(p => p.toLowerCase()));

    return sensitiveApps.has(context.application.toLowerCase()) ||
           (context.project ? sensitiveProjects.has(context.project.toLowerCase()) : false);
  }

  private learnFromIntent(intent: DetectedIntent): void {
    // Find or create pattern
    const matchingPattern = this.data.taskPatterns.find(p => 
      p.intentType === intent.type &&
      this.arraysOverlap(p.technologies, intent.context.technologies) &&
      p.applications.includes(intent.context.application)
    );

    if (matchingPattern) {
      // Update existing pattern
      matchingPattern.executionCount++;
      matchingPattern.lastExecutedAt = Date.now();
      
      // Adjust average duration
      const currentAvg = matchingPattern.averageDurationMinutes;
      const durationMinutes = intent.duration / 60000;
      matchingPattern.averageDurationMinutes = 
        (currentAvg * (matchingPattern.executionCount - 1) + durationMinutes) / matchingPattern.executionCount;
    } else if (this.data.taskPatterns.length < this.config.maxTaskPatterns) {
      // Create new pattern
      const pattern: TaskPattern = {
        id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: this.generatePatternName(intent),
        intentType: intent.type,
        technologies: intent.context.technologies,
        applications: [intent.context.application],
        steps: this.inferSteps(intent),
        averageDurationMinutes: 5,
        completionRate: 0.8,
        createdAt: Date.now(),
        lastExecutedAt: Date.now(),
        executionCount: 1,
      };
      this.data.taskPatterns.push(pattern);
    }
  }

  private generatePatternName(intent: DetectedIntent): string {
    const tech = intent.context.technologies[0] || '';
    const app = intent.context.application.split('.')[0] || '';
    return `${intent.type}${tech ? ` in ${tech}` : ''}${app ? ` (${app})` : ''}`;
  }

  private inferSteps(intent: DetectedIntent): TaskStep[] {
    // Basic step inference based on intent type
    const steps: TaskStep[] = [];
    
    switch (intent.type) {
      case 'coding':
        steps.push({ order: 1, description: 'Open/Create file', estimatedDurationMinutes: 2, optional: false });
        steps.push({ order: 2, description: 'Write code', estimatedDurationMinutes: 15, optional: false });
        steps.push({ order: 3, description: 'Test changes', estimatedDurationMinutes: 5, optional: true });
        break;
      case 'debugging':
        steps.push({ order: 1, description: 'Identify error', estimatedDurationMinutes: 5, optional: false });
        steps.push({ order: 2, description: 'Research solution', estimatedDurationMinutes: 10, optional: false });
        steps.push({ order: 3, description: 'Apply fix', estimatedDurationMinutes: 5, optional: false });
        break;
      case 'researching':
        steps.push({ order: 1, description: 'Find resources', estimatedDurationMinutes: 10, optional: false });
        steps.push({ order: 2, description: 'Read/Watch content', estimatedDurationMinutes: 15, optional: false });
        steps.push({ order: 3, description: 'Take notes', estimatedDurationMinutes: 5, optional: true });
        break;
    }

    return steps;
  }

  private arraysOverlap(a: string[], b: string[]): boolean {
    return a.some(item => b.includes(item)) || b.length === 0 || a.length === 0;
  }

  getPatternsForContext(context: {
    application?: string;
    project?: string;
    technologies?: string[];
  }): TaskPattern[] {
    return this.data.taskPatterns.filter(p => {
      if (context.application && p.applications.includes(context.application)) {
        return true;
      }
      if (context.technologies && this.arraysOverlap(p.technologies, context.technologies)) {
        return true;
      }
      return false;
    }).sort((a, b) => b.executionCount - a.executionCount);
  }

  getTaskPatterns(): TaskPattern[] {
    return [...this.data.taskPatterns];
  }

  updatePatternCompletionRate(patternId: string, completed: boolean): void {
    const pattern = this.data.taskPatterns.find(p => p.id === patternId);
    if (pattern) {
      const currentSuccess = pattern.completionRate * pattern.executionCount;
      pattern.completionRate = (currentSuccess + (completed ? 1 : 0)) / (pattern.executionCount + 1);
      this.scheduleSave();
    }
  }

  // ===========================================================================
  // Error Solutions
  // ===========================================================================

  addErrorSolution(
    errorPattern: string,
    solution: string,
    technologies: string[],
    context?: { windowTitle?: string; application?: string; project?: string }
  ): ErrorSolution {
    const hash = this.hashError(errorPattern);
    
    // Check for existing similar solution
    const existing = this.data.errorSolutions.find(es => es.errorHash === hash);
    if (existing) {
      // Update success rate and usage
      existing.usageCount++;
      existing.lastUsedAt = Date.now();
      this.scheduleSave();
      return existing;
    }

    const errorSolution: ErrorSolution = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      errorPattern,
      errorHash: hash,
      technologies,
      solution,
      source: 'user_provided',
      successRate: 1.0,
      usageCount: 1,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      context,
    };

    this.data.errorSolutions.push(errorSolution);

    // Enforce limit
    if (this.data.errorSolutions.length > this.config.maxErrorSolutions) {
      // Remove least used
      this.data.errorSolutions.sort((a, b) => a.usageCount - b.usageCount);
      this.data.errorSolutions = this.data.errorSolutions.slice(-this.config.maxErrorSolutions);
    }

    this.scheduleSave();
    this.emit('errorSolutionAdded', errorSolution);
    return errorSolution;
  }

  findErrorSolutions(errorText: string, technologies?: string[]): ErrorSolution[] {
    const hash = this.hashError(errorText);
    const lowerError = errorText.toLowerCase();

    let solutions = this.data.errorSolutions.filter(es => {
      // Match by hash (exact)
      if (es.errorHash === hash) return true;
      
      // Match by pattern
      if (new RegExp(es.errorPattern, 'i').test(errorText)) return true;
      
      // Match by keyword overlap
      const errorWords = lowerError.split(/\s+/);
      const patternWords = es.errorPattern.toLowerCase().split(/\s+/);
      const overlap = errorWords.filter(w => patternWords.includes(w)).length;
      return overlap >= 3;
    });

    // Filter by technology if provided
    if (technologies && technologies.length > 0) {
      solutions = solutions.filter(es => 
        es.technologies.some(t => technologies.includes(t))
      );
    }

    // Sort by success rate and usage
    return solutions.sort((a, b) => {
      const scoreA = a.successRate * Math.log(a.usageCount + 1);
      const scoreB = b.successRate * Math.log(b.usageCount + 1);
      return scoreB - scoreA;
    });
  }

  reportSolutionSuccess(errorSolutionId: string, success: boolean): void {
    const solution = this.data.errorSolutions.find(es => es.id === errorSolutionId);
    if (solution) {
      const currentSuccess = solution.successRate * solution.usageCount;
      solution.usageCount++;
      solution.successRate = (currentSuccess + (success ? 1 : 0)) / solution.usageCount;
      this.scheduleSave();
    }
  }

  private hashError(errorText: string): string {
    // Simple hash for quick lookup
    let hash = 0;
    const normalized = errorText.toLowerCase().replace(/\s+/g, ' ').trim();
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  // ===========================================================================
  // Work History
  // ===========================================================================

  getWorkHistory(limit: number = 100): WorkContext[] {
    return this.data.workHistory
      .slice(-limit)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getWorkHistoryForProject(project: string): WorkContext[] {
    return this.data.workHistory.filter(w => w.project === project);
  }

  getRecentIntents(minutes: number = 60): Record<IntentType, number> {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    const recent = this.data.workHistory.filter(w => w.timestamp > cutoff);
    
    const counts: Record<string, number> = {};
    for (const work of recent) {
      counts[work.intent] = (counts[work.intent] || 0) + 1;
    }
    
    return counts as Record<IntentType, number>;
  }

  // ===========================================================================
  // Learned Associations
  // ===========================================================================

  recordAssociation(
    triggerType: LearnedAssociation['triggerType'],
    triggerValue: string,
    associatedAction: string
  ): void {
    const existing = this.data.learnedAssociations.find(
      la => la.triggerType === triggerType && 
            la.triggerValue === triggerValue && 
            la.associatedAction === associatedAction
    );

    if (existing) {
      existing.occurrenceCount++;
      existing.lastOccurredAt = Date.now();
      existing.confidence = Math.min(0.95, existing.confidence + 0.05);
    } else {
      this.data.learnedAssociations.push({
        id: `assoc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        triggerType,
        triggerValue,
        associatedAction,
        confidence: 0.3,
        occurrenceCount: 1,
        lastOccurredAt: Date.now(),
      });
    }

    this.scheduleSave();
  }

  getAssociationsForTrigger(
    triggerType: LearnedAssociation['triggerType'],
    triggerValue: string
  ): LearnedAssociation[] {
    return this.data.learnedAssociations
      .filter(la => la.triggerType === triggerType && la.triggerValue === triggerValue)
      .sort((a, b) => b.confidence - a.confidence);
  }

  // ===========================================================================
  // Daily Summaries
  // ===========================================================================

  generateDailySummary(date?: string): DailySummary {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const dayStart = new Date(targetDate).getTime();
    const dayEnd = dayStart + (24 * 60 * 60 * 1000);

    const dayWork = this.data.workHistory.filter(w => 
      w.timestamp >= dayStart && w.timestamp < dayEnd
    );

    const intents: Record<string, number> = {};
    const applications: Record<string, number> = {};
    const projects: Record<string, number> = {};
    let totalDuration = 0;
    let struggleEvents = 0;

    for (const work of dayWork) {
      intents[work.intent] = (intents[work.intent] || 0) + 1;
      applications[work.application] = (applications[work.application] || 0) + 1;
      if (work.project) {
        projects[work.project] = (projects[work.project] || 0) + 1;
      }
      totalDuration += work.duration;
    }

    const productiveHours = totalDuration / (60 * 60 * 1000);
    
    // Calculate focus score
    const appSwitches = Object.keys(applications).length;
    const focusScore = Math.max(0, 100 - (appSwitches * 5));

    const summary: DailySummary = {
      date: targetDate,
      intents: intents as Record<IntentType, number>,
      applications,
      projects,
      focusScore,
      struggleEvents,
      productiveHours,
    };

    // Store or update
    const existingIndex = this.data.dailySummaries.findIndex(s => s.date === targetDate);
    if (existingIndex >= 0) {
      this.data.dailySummaries[existingIndex] = summary;
    } else {
      this.data.dailySummaries.push(summary);
    }

    // Keep only last 90 days
    this.data.dailySummaries = this.data.dailySummaries
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 90);

    this.scheduleSave();
    return summary;
  }

  getDailySummary(date?: string): DailySummary | null {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.data.dailySummaries.find(s => s.date === targetDate) || null;
  }

  getWeeklyTrends(): { date: string; focusScore: number; productiveHours: number }[] {
    return this.data.dailySummaries
      .slice(0, 7)
      .map(s => ({
        date: s.date,
        focusScore: s.focusScore,
        productiveHours: s.productiveHours,
      }));
  }

  // ===========================================================================
  // Statistics & Insights
  // ===========================================================================

  getStats(): {
    totalWorkSessions: number;
    totalPatternsLearned: number;
    totalSolutionsStored: number;
    totalPreferences: number;
    mostCommonIntent: IntentType | null;
    averageFocusScore: number;
  } {
    const intentCounts: Record<string, number> = {};
    let totalFocusScore = 0;

    for (const summary of this.data.dailySummaries) {
      totalFocusScore += summary.focusScore;
      for (const [intent, count] of Object.entries(summary.intents)) {
        intentCounts[intent] = (intentCounts[intent] || 0) + count;
      }
    }

    let mostCommonIntent: IntentType | null = null;
    let maxCount = 0;
    for (const [intent, count] of Object.entries(intentCounts)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonIntent = intent as IntentType;
      }
    }

    return {
      totalWorkSessions: this.data.workHistory.length,
      totalPatternsLearned: this.data.taskPatterns.length,
      totalSolutionsStored: this.data.errorSolutions.length,
      totalPreferences: this.data.preferences.length,
      mostCommonIntent,
      averageFocusScore: this.data.dailySummaries.length > 0 
        ? totalFocusScore / this.data.dailySummaries.length 
        : 0,
    };
  }

  // ===========================================================================
  // Export/Import
  // ===========================================================================

  async exportToFile(filePath: string): Promise<void> {
    const exportData = {
      ...this.data,
      exportedAt: Date.now(),
      version: MEMORY_VERSION,
    };
    await fs.writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf-8');
  }

  async importFromFile(filePath: string): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    
    if (parsed.version !== MEMORY_VERSION) {
      this.migrateData(parsed);
    }

    // Merge instead of replace
    this.data.preferences = [...this.data.preferences, ...parsed.preferences];
    this.data.taskPatterns = [...this.data.taskPatterns, ...parsed.taskPatterns];
    this.data.errorSolutions = [...this.data.errorSolutions, ...parsed.errorSolutions];
    
    this.applyPrivacySettings();
    this.scheduleSave();
  }

  clearAll(): void {
    this.data.preferences = [];
    this.data.taskPatterns = [];
    this.data.errorSolutions = [];
    this.data.workHistory = [];
    this.data.learnedAssociations = [];
    this.data.dailySummaries = [];
    this.scheduleSave();
  }
}

export default MemoryStore;
