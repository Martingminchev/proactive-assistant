// =============================================================================
// NEXUS - Personality-Aware Prompt Builder
// Constructs system prompts infused with personality traits and user context
// =============================================================================

import * as fs from 'fs';
import * as path from 'path';
import log from 'electron-log';
import {
  PersonalityConfig,
  UserContext,
  UserPreferences,
  DEFAULT_PERSONALITY,
  DEFAULT_USER_CONTEXT,
  DEFAULT_USER_PREFERENCES,
  getTimeOfDayGreeting,
  isQuietHours,
  MoodIndicator,
} from '../../shared/personality';
import { 
  SystemContext, 
  PiecesLtmResponse, 
  PiecesLtmMemory,
  PersonalitySettings,
  DEFAULT_PERSONALITY_SETTINGS,
} from '../../shared/types';
import { SoulDocumentStore, getSoulDocumentStore } from './soul-document-store';

// =============================================================================
// Prompt Template Types
// =============================================================================

export interface PromptTemplates {
  core: string;
  soul: string;
  capabilities: string;
  proactive: string;
}

// Cache for loaded templates
let cachedTemplates: PromptTemplates | null = null;

// =============================================================================
// Prompt Builder Options
// =============================================================================

export interface PromptBuilderOptions {
  personality: PersonalityConfig;
  userContext: UserContext;
  userPreferences: UserPreferences;
  systemContext?: SystemContext;
  ltmContext?: PiecesLtmResponse | null;
  piecesAssets?: any[];
  soulDocumentContent?: string;
}

// =============================================================================
// Template Loading
// =============================================================================

/**
 * Load prompt templates from markdown files
 */
export function loadPromptTemplates(): PromptTemplates {
  if (cachedTemplates) {
    return cachedTemplates;
  }

  const templatesDir = path.join(__dirname, '../../shared/prompts');
  
  const loadTemplate = (filename: string): string => {
    try {
      const filePath = path.join(templatesDir, filename);
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf-8');
      }
      log.warn(`[PersonalityPromptBuilder] Template not found: ${filename}`);
      return '';
    } catch (error) {
      log.error(`[PersonalityPromptBuilder] Error loading template ${filename}:`, error);
      return '';
    }
  };

  cachedTemplates = {
    core: loadTemplate('CORE.md'),
    soul: loadTemplate('SOUL.md'),
    capabilities: loadTemplate('CAPABILITIES.md'),
    proactive: loadTemplate('PROACTIVE.md'),
  };

  return cachedTemplates;
}

/**
 * Clear cached templates (useful for development/hot reload)
 */
export function clearTemplateCache(): void {
  cachedTemplates = null;
}

// =============================================================================
// Main Prompt Builder Class
// =============================================================================

export class PersonalityPromptBuilder {
  private personality: PersonalityConfig;
  private userContext: UserContext;
  private userPreferences: UserPreferences;

  constructor(
    personality: PersonalityConfig = DEFAULT_PERSONALITY,
    userContext: UserContext = DEFAULT_USER_CONTEXT,
    userPreferences: UserPreferences = DEFAULT_USER_PREFERENCES
  ) {
    this.personality = personality;
    this.userContext = userContext;
    this.userPreferences = userPreferences;
  }

  // ===========================================================================
  // Configuration Updates
  // ===========================================================================

  updatePersonality(personality: Partial<PersonalityConfig>): void {
    this.personality = { ...this.personality, ...personality };
  }

  updateUserContext(context: Partial<UserContext>): void {
    this.userContext = { ...this.userContext, ...context };
  }

  updateUserPreferences(preferences: Partial<UserPreferences>): void {
    this.userPreferences = { ...this.userPreferences, ...preferences };
  }

  // ===========================================================================
  // Main Chat System Prompt
  // ===========================================================================

  buildChatSystemPrompt(options: {
    systemContext?: SystemContext;
    ltmContext?: PiecesLtmResponse | null;
    piecesAssets?: any[];
    soulDocumentContent?: string;
  }): string {
    const { systemContext, ltmContext, piecesAssets, soulDocumentContent } = options;
    const p = this.personality;

    // Build prompt from templates and dynamic content
    let prompt = '';

    // 1. Core Identity (from template or fallback)
    const templates = loadPromptTemplates();
    if (templates.core) {
      prompt += templates.core + '\n\n';
    } else {
      prompt += this.buildIdentitySection();
    }

    // 2. Soul Document (user-customizable personality, capped for context limits)
    if (soulDocumentContent) {
      const maxSoulChars = 8000;
      const content = soulDocumentContent.length > maxSoulChars
        ? soulDocumentContent.substring(0, maxSoulChars) + '\n\n[Document truncated for context limits]'
        : soulDocumentContent;
      prompt += `---\n\n# Your Soul Document\n\n${content}\n\n---\n\n`;
    }

    // 3. Anti-Sycophancy Rules (always included, critical for personality)
    prompt += this.buildAntiSycophancySection();

    // 4. System Context (dynamic)
    if (systemContext) {
      prompt += this.buildSystemContextSection(systemContext);
    }

    // 5. Workflow Memory (dynamic, from Pieces LTM)
    if (ltmContext?.success && ltmContext.memories?.length > 0) {
      prompt += this.buildLtmContextSection(ltmContext);
    }

    // 6. Saved Assets (dynamic)
    if (piecesAssets && piecesAssets.length > 0) {
      prompt += this.buildPiecesAssetsSection(piecesAssets);
    }

    // 7. Session Awareness (dynamic)
    prompt += this.buildSessionAwarenessSection();

    // 8. Final Behavioral Reminders
    prompt += this.buildBehaviorReminders();

    return prompt;
  }

  // ===========================================================================
  // Anti-Sycophancy Section (Critical for Personality)
  // ===========================================================================

  private buildAntiSycophancySection(): string {
    const p = this.personality;
    
    return `## Critical Behavior Rules

**Do NOT:**
${p.avoidances.map(a => `- ${a}`).join('\n')}

**Do:**
- Be direct. Say what you mean.
- Be concise by default. Expand only when the topic warrants it.
- Use what you know from context. Don't ask for information you already have.
- When uncertain, say so directly — "I'm not sure" is better than hedging everything.
- Match the user's energy and communication style.

`;
  }

  // ===========================================================================
  // Session Awareness Section
  // ===========================================================================

  private buildSessionAwarenessSection(): string {
    const ctx = this.userContext;
    let section = '';

    // Only include if there's meaningful session context
    const hasSessionContext = 
      ctx.sessionDuration > 30 || 
      ctx.isLateNight || 
      ctx.isWeekend || 
      ctx.moodIndicators.length > 0;

    if (!hasSessionContext) {
      return '';
    }

    section = `## Session Context\n`;

    if (ctx.sessionDuration > 60) {
      section += `- Session duration: ${Math.round(ctx.sessionDuration)} minutes\n`;
    }

    if (ctx.isLateNight) {
      section += `- Late night session\n`;
    }

    if (ctx.isWeekend) {
      section += `- Weekend\n`;
    }

    if (ctx.moodIndicators.length > 0) {
      section += `- Apparent state: ${ctx.moodIndicators.join(', ')}\n`;
    }

    if (isQuietHours(this.userPreferences)) {
      section += `- Quiet hours — minimize proactive suggestions\n`;
    }

    return section + '\n';
  }

  // ===========================================================================
  // Behavior Reminders
  // ===========================================================================

  private buildBehaviorReminders(): string {
    return `## Remember

- You have context about their work. Use it when relevant, skip it when it's not.
- Technical questions get technical answers. Simple questions get simple answers.
- If you don't know something, say so. Don't make things up.
- Help, don't perform helpfulness.
`;
  }

  // ===========================================================================
  // Proactive Analysis System Prompt
  // ===========================================================================

  buildProactiveSystemPrompt(): string {
    const p = this.personality;
    const templates = loadPromptTemplates();

    // Start with proactive template if available
    let prompt = '';
    
    if (templates.proactive) {
      prompt = templates.proactive + '\n\n';
    }

    // Add context-specific information
    prompt += `## Current Session Context\n`;
    
    if (this.userContext.sessionDuration > 0) {
      prompt += `- Session duration: ${Math.round(this.userContext.sessionDuration)} minutes\n`;
    }

    if (this.userContext.moodIndicators.length > 0) {
      prompt += `- User appears: ${this.userContext.moodIndicators.join(', ')}\n`;
    }

    if (this.userContext.isLateNight) {
      prompt += `- Late night session\n`;
    }

    // Add enabled behaviors
    prompt += `\n## Enabled Behaviors\n`;
    
    if (p.proactiveBehavior.suggestBreaks) {
      prompt += `- Break suggestions: enabled\n`;
    }
    if (p.proactiveBehavior.detectStuckPatterns) {
      prompt += `- Stuck pattern detection: enabled\n`;
    }
    if (p.proactiveBehavior.remindForgottenTasks) {
      prompt += `- Forgotten task reminders: enabled\n`;
    }

    // Response format
    prompt += `
## Response Format

If you have a genuinely valuable suggestion:
\`\`\`json
{
  "type": "help|reminder|insight|workflow",
  "priority": "low|medium|high",
  "title": "Brief title (max 50 chars)",
  "content": "What to say (max 200 chars, be direct)"
}
\`\`\`

If nothing valuable to suggest:
NO_SUGGESTION

Remember: The bar is high. Only surface if you'd genuinely want to be interrupted for this.`;

    return prompt;
  }

  // ===========================================================================
  // Screenshot Analysis Prompt
  // ===========================================================================

  buildScreenshotAnalysisPrompt(): string {
    const p = this.personality;

    return `You are ${p.name}, analyzing a screenshot of the user's screen.

## Your Approach

- Focus on what's relevant and actionable
- If you see errors, issues, or something that needs attention — mention it directly
- Adapt to context: code editor = technical help, browser = research context, document = writing help
- Be ${p.communicationStyle.verbosity === 'concise' ? 'brief and focused' : p.communicationStyle.verbosity === 'detailed' ? 'thorough' : 'appropriately detailed'}

## What to Do

- Describe what you see that's relevant to helping them
- If there's an obvious issue or error, point it out
- Offer specific, actionable help based on the context

## What NOT to Do

- Don't start with "I can see that..." — just describe what's relevant
- Don't narrate everything on screen — focus on what matters
- Don't be vague — if you see something specific, be specific

Describe what you see and offer relevant assistance.`;
  }

  // ===========================================================================
  // Private Section Builders
  // ===========================================================================

  private buildIdentitySection(): string {
    const p = this.personality;
    
    return `# ${p.name}

You are ${p.name} — ${p.tagline || 'a desktop companion'} with access to the user's system context and workflow memory.

You help by being useful, not by performing helpfulness. Skip the filler phrases. Use what you know. Be direct.

## Your Traits
${p.traits.map(t => `- ${t}`).join('\n')}

`;
  }

  private buildSystemContextSection(systemContext: SystemContext): string {
    let section = `CURRENT SYSTEM CONTEXT:\n`;

    if (systemContext.activeWindow) {
      section += `- Active window: ${systemContext.activeWindow.application} - "${systemContext.activeWindow.title}"\n`;
    }

    if (systemContext.systemResources) {
      const { cpu, memory, battery } = systemContext.systemResources;
      section += `- CPU: ${cpu.usage}% (${cpu.cores} cores)\n`;
      section += `- Memory: ${memory.percentage}% used\n`;
      if (battery?.hasBattery) {
        section += `- Battery: ${battery.percent}%${battery.isCharging ? ' (charging)' : ''}\n`;
      }
    }

    const latestClip = systemContext.clipboardHistory?.[0];
    if (latestClip && latestClip.type === 'text' && typeof latestClip.content === 'string') {
      const preview = latestClip.content.length > 200 ? latestClip.content.slice(0, 200) + '...' : latestClip.content;
      section += `- Clipboard (latest): ${preview}\n`;
    }

    if (systemContext.recentFiles?.length) {
      const paths = systemContext.recentFiles.slice(0, 5).map((f) => f.path);
      section += `- Recent file changes: ${paths.join(', ')}\n`;
    }

    section += `- Limits: You do not have browser tab/URL or page content (only active window title). take_screenshot returns dimensions only — image content is not sent to you unless the user pastes it.\n`;

    return section + '\n';
  }

  private buildLtmContextSection(ltmContext: PiecesLtmResponse): string {
    const ltmCap = 1000;
    let section = `RELEVANT CONTEXT FROM USER'S WORKFLOW (via Pieces Long-Term Memory):\n`;

    ltmContext.memories.slice(0, 15).forEach((memory, index) => {
      const raw = memory.content || memory.summary || '';
      const content = raw.length > ltmCap ? raw.substring(0, ltmCap) + '...' : raw;
      const source = memory.application ? ` [from ${memory.application}]` : '';
      const timestamp = memory.timestamp ? ` (${memory.timestamp})` : '';
      section += `\n[Memory ${index + 1}${source}${timestamp}]: ${content}\n`;
    });

    return section + '\n';
  }

  private buildPiecesAssetsSection(piecesAssets: any[]): string {
    let section = `RELEVANT SAVED CODE SNIPPETS:\n`;

    piecesAssets.slice(0, 3).forEach((asset, index) => {
      const meta: string[] = [];
      if (asset.language) meta.push(`lang: ${asset.language}`);
      if (asset.anchors?.length) {
        const anchorVal = asset.anchors[0].value ?? asset.anchors[0].path ?? asset.anchors[0].url;
        if (anchorVal) meta.push(`from: ${anchorVal}`);
      }
      const metaStr = meta.length > 0 ? ` (${meta.join(', ')})` : '';
      section += `\n[Snippet ${index + 1}: ${asset.name}${metaStr}]\n`;
      if (asset.annotations?.length) {
        section += `Annotation: ${asset.annotations[0]}\n`;
      }
      section += `${(asset.content || '').substring(0, 500)}${(asset.content || '').length > 500 ? '...' : ''}\n`;
    });

    return section + '\n';
  }

  private buildUserAwarenessSection(): string {
    const ctx = this.userContext;
    const prefs = this.userPreferences;
    let section = `USER AWARENESS:\n`;

    // Current work context
    if (ctx.currentProject) {
      section += `- Currently working on: ${ctx.currentProject}\n`;
    }

    if (ctx.recentProjects.length > 0) {
      section += `- Recent projects: ${ctx.recentProjects.slice(0, 3).join(', ')}\n`;
    }

    // Session awareness
    if (ctx.sessionDuration > 60) {
      section += `- Working for ${Math.round(ctx.sessionDuration)} minutes this session\n`;
    }

    // Time awareness
    if (ctx.isLateNight) {
      section += `- It's late at night\n`;
    }

    if (ctx.isWeekend) {
      section += `- It's the weekend\n`;
    }

    // Mood indicators
    if (ctx.moodIndicators.length > 0) {
      section += `- User appears: ${ctx.moodIndicators.join(', ')}\n`;
    }

    // Quiet hours
    if (isQuietHours(prefs)) {
      section += `- User is in quiet hours - be minimal with proactive suggestions\n`;
    }

    return section + '\n';
  }

  private buildBehaviorGuidelinesSection(): string {
    const p = this.personality;
    
    let section = `BEHAVIOR GUIDELINES:\n`;
    section += `- Adapt to the user's current activity (coding = technical help, writing = writing help, etc.)\n`;
    section += `- Use system context when relevant, but don't force references to it\n`;
    section += `- Be helpful and context-aware\n`;

    // Add avoidances
    if (p.avoidances.length > 0) {
      section += `\nTHINGS TO AVOID:\n`;
      p.avoidances.forEach(a => {
        section += `- ${a}\n`;
      });
    }

    return section;
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  getGreeting(): string {
    return getTimeOfDayGreeting(this.personality);
  }

  getRandomCatchphrase(): string | undefined {
    const phrases = this.personality.catchphrases;
    if (!phrases || phrases.length === 0) return undefined;
    return phrases[Math.floor(Math.random() * phrases.length)];
  }

  getRandomFarewell(): string | undefined {
    const farewells = this.personality.farewells;
    if (!farewells || farewells.length === 0) return undefined;
    return farewells[Math.floor(Math.random() * farewells.length)];
  }

  shouldSuggestBreak(): boolean {
    return (
      this.personality.proactiveBehavior.suggestBreaks &&
      this.userContext.sessionDuration > 90 && // 90+ minutes
      this.userPreferences.preferredBreakReminders
    );
  }

  isInQuietHours(): boolean {
    return isQuietHours(this.userPreferences);
  }

  getCurrentMoodIndicators(): MoodIndicator[] {
    return this.userContext.moodIndicators;
  }
}

// =============================================================================
// Settings Conversion Helper
// =============================================================================

/**
 * Convert UI PersonalitySettings to internal PersonalityConfig
 */
export function convertSettingsToConfig(settings: PersonalitySettings): PersonalityConfig {
  return {
    name: settings.name,
    tagline: settings.tagline,
    traits: [
      'capable and direct',
      'genuinely helpful without performing helpfulness',
      'context-aware — uses what it knows',
      'honest about uncertainty',
      settings.verbosity === 'concise' ? 'concise by default' : 
        settings.verbosity === 'detailed' ? 'thorough when needed' : 'balanced in detail',
      'technically skilled',
    ],
    communicationStyle: {
      formality: settings.formality,
      humor: settings.humor,
      empathy: settings.empathy,
      verbosity: settings.verbosity,
    },
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
    ],
    contextAwareness: {
      rememberUserPreferences: true,
      adaptToWorkStyle: true,
      learnFromInteractions: true,
      trackMoodIndicators: true,
    },
    proactiveBehavior: {
      suggestBreaks: settings.suggestBreaks,
      detectStuckPatterns: settings.detectStuckPatterns,
      offerWorkflowTips: settings.offerWorkflowTips,
      remindForgottenTasks: settings.remindForgottenTasks,
      celebrateAchievements: false,
    },
    timeAwareness: {
      lateNightConcern: settings.lateNightConcern,
      weekendMode: settings.weekendMode,
    },
  };
}

// =============================================================================
// Soul Document Integration
// =============================================================================

/**
 * Build a prompt section from the soul document
 */
export function buildSoulDocumentSection(): string {
  try {
    const store = getSoulDocumentStore();
    const content = store.getContent();
    
    if (!content) {
      return '';
    }
    
    return `
SOUL DOCUMENT (Your personality definition):
${content}

Use the soul document above as the primary guide for your personality, communication style, and behavior. Adapt your responses to match the guidelines defined there.
`;
  } catch (error) {
    log.error('[PersonalityPromptBuilder] Failed to load soul document:', error);
    return '';
  }
}

// =============================================================================
// Singleton Instance (for easy access)
// =============================================================================

let promptBuilderInstance: PersonalityPromptBuilder | null = null;

export function getPromptBuilder(): PersonalityPromptBuilder {
  if (!promptBuilderInstance) {
    promptBuilderInstance = new PersonalityPromptBuilder();
  }
  return promptBuilderInstance;
}

export function initializePromptBuilder(
  personality?: PersonalityConfig,
  userContext?: UserContext,
  userPreferences?: UserPreferences
): PersonalityPromptBuilder {
  promptBuilderInstance = new PersonalityPromptBuilder(
    personality,
    userContext,
    userPreferences
  );
  return promptBuilderInstance;
}

/**
 * Initialize prompt builder from persisted settings
 */
export function initializePromptBuilderFromSettings(settings: PersonalitySettings): PersonalityPromptBuilder {
  const config = convertSettingsToConfig(settings);
  promptBuilderInstance = new PersonalityPromptBuilder(config);
  return promptBuilderInstance;
}

/**
 * Get a complete system prompt with soul document integration
 */
export function buildCompleteSystemPrompt(options: {
  settings: PersonalitySettings;
  systemContext?: SystemContext;
  ltmContext?: PiecesLtmResponse | null;
  piecesAssets?: any[];
  includeSoulDocument?: boolean;
}): string {
  const { settings, systemContext, ltmContext, piecesAssets, includeSoulDocument = true } = options;
  
  // Convert settings to config and create builder
  const config = convertSettingsToConfig(settings);
  const builder = new PersonalityPromptBuilder(config);
  
  // Get soul document content if enabled
  let soulDocumentContent: string | undefined;
  if (includeSoulDocument) {
    try {
      const store = getSoulDocumentStore();
      soulDocumentContent = store.getContent();
    } catch (error) {
      log.error('[PersonalityPromptBuilder] Failed to load soul document:', error);
    }
  }
  
  // Build complete prompt with soul document integrated
  const prompt = builder.buildChatSystemPrompt({
    systemContext,
    ltmContext,
    piecesAssets,
    soulDocumentContent,
  });
  
  return prompt;
}

export default PersonalityPromptBuilder;
