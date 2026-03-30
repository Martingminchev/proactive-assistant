// =============================================================================
// NEXUS - Pattern Recognition Service
// Identifies recurring patterns in user behavior
// =============================================================================

import { EventEmitter } from 'events';
import log from 'electron-log';
import { MemoryStore, WorkContext, TaskPattern } from './memory-store';
import { DetectedIntent, IntentType } from './intent-engine';

// =============================================================================
// Pattern Types
// =============================================================================

export interface WorkSessionPattern {
  id: string;
  dayOfWeek: number;        // 0-6
  startHour: number;        // 0-23
  durationMinutes: number;
  primaryIntent: IntentType;
  applications: string[];
  confidence: number;
}

export interface ErrorRecurrencePattern {
  errorSignature: string;
  frequencyPerWeek: number;
  lastOccurredAt: number;
  technologies: string[];
  typicalResolutionTimeMinutes: number;
}

export interface ApplicationUsagePattern {
  application: string;
  totalUsageMinutes: number;
  averageSessionMinutes: number;
  mostActiveHours: number[];
  commonPrecedingApps: string[];
  commonFollowingApps: string[];
}

export interface TimeBasedPattern {
  patternType: 'morning_routine' | 'afternoon_focus' | 'evening_wrapup' | 'late_night';
  timeRange: { start: number; end: number }; // Hours (0-24)
  typicalActivities: IntentType[];
  productivityScore: number;
}

export interface DetectedPattern {
  type: 'session' | 'error' | 'usage' | 'time';
  data: WorkSessionPattern | ErrorRecurrencePattern | ApplicationUsagePattern | TimeBasedPattern;
  confidence: number;
  detectedAt: number;
}

// =============================================================================
// Pattern Recognition Configuration
// =============================================================================

export interface PatternRecognitionConfig {
  minDataPoints: number;        // Minimum data points to form a pattern
  confidenceThreshold: number;  // Minimum confidence to report pattern
  analysisWindowDays: number;   // How many days of history to analyze
  updateIntervalHours: number;  // How often to re-analyze
}

const DEFAULT_PATTERN_CONFIG: PatternRecognitionConfig = {
  minDataPoints: 3,
  confidenceThreshold: 0.6,
  analysisWindowDays: 30,
  updateIntervalHours: 24,
};

// =============================================================================
// Pattern Recognition Service
// =============================================================================

export class PatternRecognition extends EventEmitter {
  private memoryStore: MemoryStore;
  private config: PatternRecognitionConfig;
  private analysisInterval: NodeJS.Timeout | null = null;
  private detectedPatterns: DetectedPattern[] = [];

  constructor(memoryStore: MemoryStore, config?: Partial<PatternRecognitionConfig>) {
    super();
    this.memoryStore = memoryStore;
    this.config = { ...DEFAULT_PATTERN_CONFIG, ...config };
  }

  start(): void {
    // Run initial analysis
    this.runAnalysis();

    // Schedule periodic analysis
    const intervalMs = this.config.updateIntervalHours * 60 * 60 * 1000;
    this.analysisInterval = setInterval(() => {
      this.runAnalysis();
    }, intervalMs);

    log.info('[PatternRecognition] Started');
  }

  stop(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }
    log.info('[PatternRecognition] Stopped');
  }

  // ===========================================================================
  // Main Analysis
  // ===========================================================================

  async runAnalysis(): Promise<void> {
    log.debug('[PatternRecognition] Running pattern analysis...');

    const workHistory = this.memoryStore.getWorkHistory(1000);
    const cutoffDate = Date.now() - (this.config.analysisWindowDays * 24 * 60 * 60 * 1000);
    const recentWork = workHistory.filter(w => w.timestamp > cutoffDate);

    const newPatterns: DetectedPattern[] = [];

    // Run different pattern detection algorithms
    const sessionPatterns = this.detectSessionPatterns(recentWork);
    const errorPatterns = this.detectErrorPatterns(recentWork);
    const usagePatterns = this.detectUsagePatterns(recentWork);
    const timePatterns = this.detectTimePatterns(recentWork);

    newPatterns.push(...sessionPatterns, ...errorPatterns, ...usagePatterns, ...timePatterns);

    // Filter by confidence
    const validPatterns = newPatterns.filter(p => p.confidence >= this.config.confidenceThreshold);

    // Update detected patterns
    this.detectedPatterns = validPatterns;

    // Emit new patterns
    for (const pattern of validPatterns) {
      this.emit('patternDetected', pattern);
    }

    log.debug(`[PatternRecognition] Detected ${validPatterns.length} patterns`);
  }

  // ===========================================================================
  // Work Session Pattern Detection
  // ===========================================================================

  private detectSessionPatterns(workHistory: WorkContext[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    
    // Group work by day of week and hour
    const sessionsByTime: Record<string, WorkContext[]> = {};
    
    for (const work of workHistory) {
      const date = new Date(work.timestamp);
      const dayOfWeek = date.getDay();
      const hour = date.getHours();
      const key = `${dayOfWeek}-${hour}`;
      
      if (!sessionsByTime[key]) {
        sessionsByTime[key] = [];
      }
      sessionsByTime[key].push(work);
    }

    // Find recurring sessions
    for (const [key, sessions] of Object.entries(sessionsByTime)) {
      if (sessions.length >= this.config.minDataPoints) {
        const [dayOfWeek, startHour] = key.split('-').map(Number);
        
        // Calculate average duration
        const avgDuration = sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length;
        
        // Find primary intent
        const intentCounts: Record<string, number> = {};
        for (const s of sessions) {
          intentCounts[s.intent] = (intentCounts[s.intent] || 0) + 1;
        }
        const primaryIntent = Object.entries(intentCounts)
          .sort((a, b) => b[1] - a[1])[0][0] as IntentType;

        // Find common applications
        const appCounts: Record<string, number> = {};
        for (const s of sessions) {
          appCounts[s.application] = (appCounts[s.application] || 0) + 1;
        }
        const commonApps = Object.entries(appCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([app]) => app);

        const confidence = Math.min(0.95, sessions.length * 0.1 + 0.3);

        patterns.push({
          type: 'session',
          data: {
            id: `session_${key}`,
            dayOfWeek,
            startHour,
            durationMinutes: Math.round(avgDuration / 60000),
            primaryIntent,
            applications: commonApps,
            confidence,
          },
          confidence,
          detectedAt: Date.now(),
        });
      }
    }

    return patterns;
  }

  // ===========================================================================
  // Error Recurrence Pattern Detection
  // ===========================================================================

  private detectErrorPatterns(workHistory: WorkContext[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    
    // Get error solutions from memory store
    const errorSolutions = this.findErrorSolutionsFromHistory(workHistory);
    
    for (const error of errorSolutions) {
      // Count occurrences in recent history
      const occurrences = workHistory.filter(w => 
        w.intent === 'debugging' &&
        w.technologies.some(t => error.technologies.includes(t))
      ).length;

      if (occurrences >= this.config.minDataPoints) {
        const frequencyPerWeek = occurrences / (this.config.analysisWindowDays / 7);
        
        patterns.push({
          type: 'error',
          data: {
            errorSignature: error.errorPattern,
            frequencyPerWeek,
            lastOccurredAt: error.lastUsedAt,
            technologies: error.technologies,
            typicalResolutionTimeMinutes: 15, // Default estimate
          },
          confidence: Math.min(0.9, occurrences * 0.1 + 0.3),
          detectedAt: Date.now(),
        });
      }
    }

    return patterns;
  }

  private findErrorSolutionsFromHistory(workHistory: WorkContext[]): Array<{
    errorPattern: string;
    technologies: string[];
    lastUsedAt: number;
  }> {
    // Extract potential error patterns from debugging sessions
    const debuggingSessions = workHistory.filter(w => w.intent === 'debugging');
    
    const errorMap = new Map<string, { technologies: Set<string>; lastUsed: number }>();
    
    for (const session of debuggingSessions) {
      const key = `${session.application}-${session.project || 'unknown'}`;
      const existing = errorMap.get(key);
      
      if (existing) {
        session.technologies.forEach(t => existing.technologies.add(t));
        existing.lastUsed = Math.max(existing.lastUsed, session.timestamp);
      } else {
        errorMap.set(key, {
          technologies: new Set(session.technologies),
          lastUsed: session.timestamp,
        });
      }
    }

    return Array.from(errorMap.entries()).map(([pattern, data]) => ({
      errorPattern: pattern,
      technologies: Array.from(data.technologies),
      lastUsedAt: data.lastUsed,
    }));
  }

  // ===========================================================================
  // Application Usage Pattern Detection
  // ===========================================================================

  private detectUsagePatterns(workHistory: WorkContext[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    
    // Group by application
    const usageByApp: Record<string, WorkContext[]> = {};
    
    for (const work of workHistory) {
      if (!usageByApp[work.application]) {
        usageByApp[work.application] = [];
      }
      usageByApp[work.application].push(work);
    }

    for (const [app, sessions] of Object.entries(usageByApp)) {
      if (sessions.length < this.config.minDataPoints) continue;

      // Calculate metrics
      const totalMinutes = sessions.reduce((sum, s) => sum + s.duration, 0) / 60000;
      const avgSessionMinutes = totalMinutes / sessions.length;

      // Find most active hours
      const hourCounts: Record<number, number> = {};
      for (const s of sessions) {
        const hour = new Date(s.timestamp).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
      const mostActiveHours = Object.entries(hourCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([hour]) => Number(hour));

      // Find app transitions
      const appTransitions = this.findAppTransitions(app, workHistory);

      patterns.push({
        type: 'usage',
        data: {
          application: app,
          totalUsageMinutes: Math.round(totalMinutes),
          averageSessionMinutes: Math.round(avgSessionMinutes),
          mostActiveHours,
          commonPrecedingApps: appTransitions.preceding,
          commonFollowingApps: appTransitions.following,
        },
        confidence: Math.min(0.9, sessions.length * 0.05 + 0.4),
        detectedAt: Date.now(),
      });
    }

    return patterns;
  }

  private findAppTransitions(
    targetApp: string, 
    workHistory: WorkContext[]
  ): { preceding: string[]; following: string[] } {
    const sortedHistory = [...workHistory].sort((a, b) => a.timestamp - b.timestamp);
    
    const precedingCounts: Record<string, number> = {};
    const followingCounts: Record<string, number> = {};

    for (let i = 0; i < sortedHistory.length; i++) {
      if (sortedHistory[i].application === targetApp) {
        // Check preceding app
        if (i > 0 && sortedHistory[i - 1].application !== targetApp) {
          const prev = sortedHistory[i - 1].application;
          precedingCounts[prev] = (precedingCounts[prev] || 0) + 1;
        }
        // Check following app
        if (i < sortedHistory.length - 1 && sortedHistory[i + 1].application !== targetApp) {
          const next = sortedHistory[i + 1].application;
          followingCounts[next] = (followingCounts[next] || 0) + 1;
        }
      }
    }

    return {
      preceding: Object.entries(precedingCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([app]) => app),
      following: Object.entries(followingCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([app]) => app),
    };
  }

  // ===========================================================================
  // Time-Based Pattern Detection
  // ===========================================================================

  private detectTimePatterns(workHistory: WorkContext[]): DetectedPattern[] {
    const patterns: DetectedPattern[] = [];
    
    // Define time ranges
    const timeRanges = [
      { type: 'morning_routine' as const, start: 7, end: 10 },
      { type: 'afternoon_focus' as const, start: 13, end: 17 },
      { type: 'evening_wrapup' as const, start: 17, end: 20 },
      { type: 'late_night' as const, start: 22, end: 2 },
    ];

    for (const range of timeRanges) {
      const rangeWork = workHistory.filter(w => {
        const hour = new Date(w.timestamp).getHours();
        if (range.start < range.end) {
          return hour >= range.start && hour < range.end;
        } else {
          // Wraps around midnight
          return hour >= range.start || hour < range.end;
        }
      });

      if (rangeWork.length >= this.config.minDataPoints) {
        // Calculate typical activities
        const intentCounts: Record<string, number> = {};
        for (const w of rangeWork) {
          intentCounts[w.intent] = (intentCounts[w.intent] || 0) + 1;
        }
        const typicalActivities = Object.entries(intentCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([intent]) => intent as IntentType);

        // Calculate productivity score
        const productiveIntents = ['coding', 'debugging', 'reviewing', 'writing'];
        const productiveWork = rangeWork.filter(w => productiveIntents.includes(w.intent));
        const productivityScore = (productiveWork.length / rangeWork.length) * 100;

        patterns.push({
          type: 'time',
          data: {
            patternType: range.type,
            timeRange: { start: range.start, end: range.end },
            typicalActivities,
            productivityScore: Math.round(productivityScore),
          },
          confidence: Math.min(0.9, rangeWork.length * 0.05 + 0.3),
          detectedAt: Date.now(),
        });
      }
    }

    return patterns;
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  getDetectedPatterns(): DetectedPattern[] {
    return [...this.detectedPatterns];
  }

  getPatternsByType(type: DetectedPattern['type']): DetectedPattern[] {
    return this.detectedPatterns.filter(p => p.type === type);
  }

  predictNextSession(): { 
    dayOfWeek: number; 
    startHour: number; 
    confidence: number;
    suggestedPreparation: string[];
  } | null {
    const sessionPatterns = this.getPatternsByType('session');
    if (sessionPatterns.length === 0) return null;

    // Find most consistent pattern
    const bestPattern = sessionPatterns
      .sort((a, b) => b.confidence - a.confidence)[0]
      .data as WorkSessionPattern;

    return {
      dayOfWeek: bestPattern.dayOfWeek,
      startHour: bestPattern.startHour,
      confidence: bestPattern.confidence,
      suggestedPreparation: [
        `Prepare for ${bestPattern.primaryIntent} work`,
        `Open: ${bestPattern.applications.join(', ')}`,
      ],
    };
  }

  getProductiveHours(): { hour: number; productivityScore: number }[] {
    const hourlyProductivity: Record<number, { productive: number; total: number }> = {};
    const workHistory = this.memoryStore.getWorkHistory(1000);

    const productiveIntents = ['coding', 'debugging', 'reviewing', 'writing'];

    for (const work of workHistory) {
      const hour = new Date(work.timestamp).getHours();
      if (!hourlyProductivity[hour]) {
        hourlyProductivity[hour] = { productive: 0, total: 0 };
      }
      hourlyProductivity[hour].total++;
      if (productiveIntents.includes(work.intent)) {
        hourlyProductivity[hour].productive++;
      }
    }

    return Object.entries(hourlyProductivity)
      .map(([hour, data]) => ({
        hour: Number(hour),
        productivityScore: Math.round((data.productive / data.total) * 100),
      }))
      .sort((a, b) => a.hour - b.hour);
  }
}

export default PatternRecognition;
