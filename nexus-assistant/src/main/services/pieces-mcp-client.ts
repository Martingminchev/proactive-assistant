// =============================================================================
// NEXUS - Pieces MCP Client
// Integration with Pieces Long-Term Memory (LTM) via Model Context Protocol
// =============================================================================

import { EventEmitter } from 'events';
import log from 'electron-log';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { 
  PiecesLtmQueryOptions, 
  PiecesLtmResponse, 
  PiecesLtmMemory,
  WorkPatternAnalysis,
  StuckPatternAnalysis,
  ForgottenTaskAnalysis,
  ProjectContextAnalysis,
  TechnologyPreferences,
  RecentIssuesAnalysis,
} from '../../shared/types';

interface PiecesMcpClientOptions {
  port?: number;
  host?: string;
}

export class PiecesMcpClient extends EventEmitter {
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  private port: number;
  private host: string;
  private connected: boolean = false;
  private connecting: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private reconnectDelay: number = 5000;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(options: PiecesMcpClientOptions = {}) {
    super();
    this.port = options.port || 39300;
    this.host = options.host || '127.0.0.1';
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================

  updateConfig(options: PiecesMcpClientOptions): void {
    const portChanged = options.port !== undefined && options.port !== this.port;
    const hostChanged = options.host !== undefined && options.host !== this.host;

    if (options.port !== undefined) {
      this.port = options.port;
    }
    if (options.host !== undefined) {
      this.host = options.host;
    }

    // Reconnect if config changed
    if ((portChanged || hostChanged) && this.connected) {
      this.disconnect();
      this.connect();
    }
  }

  // ===========================================================================
  // Connection Management
  // ===========================================================================

  async connect(): Promise<boolean> {
    if (this.connected || this.connecting) {
      return this.connected;
    }

    this.connecting = true;

    try {
      const mcpUrl = new URL(
        `/model_context_protocol/2025-03-26/mcp`,
        `http://${this.host}:${this.port}`
      );

      this.transport = new StreamableHTTPClientTransport(mcpUrl);
      
      this.client = new Client(
        { name: 'nexus-assistant', version: '1.0.0' },
        { capabilities: {} }
      );

      await this.client.connect(this.transport);
      
      this.connected = true;
      this.connecting = false;
      this.reconnectAttempts = 0;

      this.emit('connected');
      log.info('[PiecesMcpClient] Connected to Pieces LTM via MCP');

      return true;
    } catch (error) {
      this.connected = false;
      this.connecting = false;
      this.client = null;
      this.transport = null;

      log.error('[PiecesMcpClient] Failed to connect:', error);
      this.emit('error', error);

      // Schedule reconnect
      this.scheduleReconnect();

      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        log.error('[PiecesMcpClient] Error closing client:', error);
      }
    }

    this.client = null;
    this.transport = null;
    this.connected = false;
    this.connecting = false;

    this.emit('disconnected');
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      log.debug('[PiecesMcpClient] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    log.debug(`[PiecesMcpClient] Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ===========================================================================
  // LTM Query Methods
  // ===========================================================================

  async askPiecesLtm(
    question: string,
    options?: PiecesLtmQueryOptions
  ): Promise<PiecesLtmResponse> {
    if (!this.connected || !this.client) {
      return {
        memories: [],
        query: question,
        success: false,
        error: 'Not connected to Pieces MCP server'
      };
    }

    try {
      const args: Record<string, unknown> = {
        question
      };

      if (options?.timeRanges && options.timeRanges.length > 0) {
        args.time_ranges = options.timeRanges;
      }

      if (options?.applicationSources && options.applicationSources.length > 0) {
        args.application_sources = options.applicationSources;
      }

      const result = await this.client.callTool({
        name: 'ask_pieces_ltm',
        arguments: args
      });

      // Parse the response content
      const memories = this.parseMemoriesFromResult(result);

      return {
        memories,
        query: question,
        success: true
      };
    } catch (error) {
      log.error('[PiecesMcpClient] LTM query error:', error);
      return {
        memories: [],
        query: question,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getRelevantContext(userQuery: string): Promise<PiecesLtmResponse> {
    // Create a contextual question for Pieces LTM
    const contextQuestion = `What context from my recent work is relevant to: "${userQuery}"`;
    
    return this.askPiecesLtm(contextQuestion);
  }

  async getRecentWorkContext(hoursBack: number = 24): Promise<PiecesLtmResponse> {
    const now = new Date();
    const past = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);
    
    const timeRange = {
      from: past.toISOString(),
      to: now.toISOString(),
      phrase: hoursBack <= 24 ? 'today' : `last ${hoursBack} hours`
    };

    return this.askPiecesLtm('What have I been working on?', {
      timeRanges: [timeRange]
    });
  }

  // ===========================================================================
  // Targeted Query Methods
  // ===========================================================================

  async askAboutTopic(topic: string): Promise<PiecesLtmResponse> {
    return this.askPiecesLtm(`Tell me about my recent work on: ${topic}`);
  }

  async getRecentCodingActivity(hoursBack: number = 24): Promise<PiecesLtmResponse> {
    const now = new Date();
    const past = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);
    
    const timeRange = {
      from: past.toISOString(),
      to: now.toISOString(),
      phrase: `last ${hoursBack} hours`
    };

    return this.askPiecesLtm(`What coding work have I done in the last ${hoursBack} hours?`, {
      timeRanges: [timeRange],
      applicationSources: ['Code.exe', 'Cursor.exe', 'vim', 'neovim', 'WindowsTerminal.exe', 'iTerm2', 'Terminal']
    });
  }

  async getRecentBrowsingContext(): Promise<PiecesLtmResponse> {
    return this.askPiecesLtm('What have I been researching or reading in my browser?', {
      applicationSources: ['chrome.exe', 'firefox.exe', 'msedge.exe', 'safari', 'Chrome', 'Firefox', 'Safari', 'Edge']
    });
  }

  async searchMemories(keywords: string[]): Promise<PiecesLtmResponse> {
    const query = `Find memories related to: ${keywords.join(', ')}`;
    return this.askPiecesLtm(query);
  }

  async getDebugContext(): Promise<PiecesLtmResponse> {
    return this.askPiecesLtm('What errors, bugs, or debugging sessions have I been working on recently?');
  }

  async getMeetingContext(): Promise<PiecesLtmResponse> {
    return this.askPiecesLtm('What meetings, discussions, or conversations have I been part of?', {
      applicationSources: ['Slack.exe', 'zoom.exe', 'Teams.exe', 'Discord', 'Slack', 'Zoom', 'Microsoft Teams']
    });
  }

  // ===========================================================================
  // Enhanced Query Methods (for Proactive Personality)
  // ===========================================================================

  /**
   * Analyze user's work patterns over a time period
   */
  async getUserWorkPatterns(daysBack: number = 7): Promise<WorkPatternAnalysis> {
    const now = new Date();
    const past = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    
    const timeRange = {
      from: past.toISOString(),
      to: now.toISOString(),
      phrase: `last ${daysBack} days`
    };

    const response = await this.askPiecesLtm(
      `What are my work patterns? What projects have I been working on? What times am I most active? What applications do I use most?`,
      { timeRanges: [timeRange] }
    );

    return this.parseWorkPatternAnalysis(response);
  }

  /**
   * Detect patterns that suggest the user might be stuck
   */
  async getStuckPatterns(hoursBack: number = 4): Promise<StuckPatternAnalysis> {
    const now = new Date();
    const past = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);
    
    const timeRange = {
      from: past.toISOString(),
      to: now.toISOString(),
      phrase: `last ${hoursBack} hours`
    };

    const response = await this.askPiecesLtm(
      `Have I been working on the same thing for a long time? Am I repeatedly visiting the same files or pages? Are there signs I might be stuck on something?`,
      { timeRanges: [timeRange] }
    );

    return this.parseStuckPatternAnalysis(response, hoursBack);
  }

  /**
   * Find tasks that seem to have been forgotten or abandoned
   */
  async getForgottenTasks(daysBack: number = 3): Promise<ForgottenTaskAnalysis> {
    const now = new Date();
    const past = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    
    const timeRange = {
      from: past.toISOString(),
      to: now.toISOString(),
      phrase: `last ${daysBack} days`
    };

    const response = await this.askPiecesLtm(
      `What tasks or projects did I start but haven't returned to? Are there any incomplete items or things I mentioned wanting to do but didn't finish?`,
      { timeRanges: [timeRange] }
    );

    return this.parseForgottenTaskAnalysis(response);
  }

  /**
   * Get context for a specific project
   */
  async getProjectContext(projectName: string, daysBack: number = 7): Promise<ProjectContextAnalysis> {
    const now = new Date();
    const past = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    
    const timeRange = {
      from: past.toISOString(),
      to: now.toISOString(),
      phrase: `last ${daysBack} days`
    };

    const response = await this.askPiecesLtm(
      `What have I been doing on the project "${projectName}"? What files have I worked on? What problems have I encountered? What progress have I made?`,
      { timeRanges: [timeRange] }
    );

    return this.parseProjectContextAnalysis(response, projectName);
  }

  /**
   * Get user's technology preferences based on usage
   */
  async getTechnologyPreferences(): Promise<TechnologyPreferences> {
    const response = await this.askPiecesLtm(
      `What programming languages, frameworks, and tools do I use most frequently? What are my coding preferences?`,
      {
        applicationSources: ['Code.exe', 'Cursor.exe', 'vim', 'neovim', 'WindowsTerminal.exe', 'iTerm2', 'Terminal']
      }
    );

    return this.parseTechnologyPreferences(response);
  }

  /**
   * Get recent errors and issues the user has encountered
   */
  async getRecentIssues(hoursBack: number = 24): Promise<RecentIssuesAnalysis> {
    const now = new Date();
    const past = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);
    
    const timeRange = {
      from: past.toISOString(),
      to: now.toISOString(),
      phrase: `last ${hoursBack} hours`
    };

    const response = await this.askPiecesLtm(
      `What errors, exceptions, bugs, or issues have I encountered recently? What problems am I trying to solve?`,
      { timeRanges: [timeRange] }
    );

    return this.parseRecentIssuesAnalysis(response);
  }

  // ===========================================================================
  // Analysis Parsers
  // ===========================================================================

  private parseWorkPatternAnalysis(response: PiecesLtmResponse): WorkPatternAnalysis {
    const analysis: WorkPatternAnalysis = {
      success: response.success,
      recentProjects: [],
      frequentApplications: [],
      activeHours: [],
      rawMemories: response.memories
    };

    if (!response.success || !response.memories.length) {
      return analysis;
    }

    // Extract projects from memories
    const projectMentions = new Map<string, number>();
    const appMentions = new Map<string, number>();

    for (const memory of response.memories) {
      // Track applications
      if (memory.application) {
        const count = appMentions.get(memory.application) || 0;
        appMentions.set(memory.application, count + 1);
      }

      // Try to extract project names from content
      const content = memory.content || memory.summary || '';
      const projectPatterns = [
        /project[:\s]+["']?([^"'\n,]+)["']?/gi,
        /working on[:\s]+["']?([^"'\n,]+)["']?/gi,
        /repository[:\s]+["']?([^"'\n,]+)["']?/gi,
      ];

      for (const pattern of projectPatterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          if (match[1]) {
            const project = match[1].trim();
            const count = projectMentions.get(project) || 0;
            projectMentions.set(project, count + 1);
          }
        }
      }
    }

    // Sort by frequency
    analysis.recentProjects = Array.from(projectMentions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    analysis.frequentApplications = Array.from(appMentions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    return analysis;
  }

  private parseStuckPatternAnalysis(response: PiecesLtmResponse, hoursBack: number): StuckPatternAnalysis {
    const analysis: StuckPatternAnalysis = {
      success: response.success,
      isLikelyStuck: false,
      stuckIndicators: [],
      repeatedFiles: [],
      repeatedSearches: [],
      timeInSameContext: 0,
      rawMemories: response.memories
    };

    if (!response.success || !response.memories.length) {
      return analysis;
    }

    // Analyze for stuck patterns
    const fileAccesses = new Map<string, number>();
    const searches = new Map<string, number>();

    for (const memory of response.memories) {
      const content = memory.content || memory.summary || '';
      
      // Look for repeated file access
      const filePatterns = [
        /(?:opened?|edited?|viewed?)[:\s]+["']?([^"'\n]+\.[a-z]{2,4})["']?/gi,
        /file[:\s]+["']?([^"'\n]+\.[a-z]{2,4})["']?/gi,
      ];

      for (const pattern of filePatterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          if (match[1]) {
            const file = match[1].trim();
            const count = fileAccesses.get(file) || 0;
            fileAccesses.set(file, count + 1);
          }
        }
      }

      // Look for repeated searches
      const searchPatterns = [
        /search(?:ed|ing)?[:\s]+["']?([^"'\n]+)["']?/gi,
        /google[:\s]+["']?([^"'\n]+)["']?/gi,
        /stackoverflow[:\s]+["']?([^"'\n]+)["']?/gi,
      ];

      for (const pattern of searchPatterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          if (match[1]) {
            const search = match[1].trim();
            const count = searches.get(search) || 0;
            searches.set(search, count + 1);
          }
        }
      }
    }

    // Detect stuck patterns
    analysis.repeatedFiles = Array.from(fileAccesses.entries())
      .filter(([_, count]) => count >= 3)
      .map(([file, count]) => ({ file, accessCount: count }));

    analysis.repeatedSearches = Array.from(searches.entries())
      .filter(([_, count]) => count >= 2)
      .map(([query, count]) => ({ query, count }));

    // Determine if likely stuck
    if (analysis.repeatedFiles.length > 0) {
      analysis.stuckIndicators.push('Repeatedly accessing same files');
      analysis.isLikelyStuck = true;
    }

    if (analysis.repeatedSearches.length > 0) {
      analysis.stuckIndicators.push('Searching for similar things multiple times');
      analysis.isLikelyStuck = true;
    }

    // Check for error-related content
    const errorPatterns = /error|exception|failed|bug|issue|problem|stuck|doesn't work/i;
    const errorMemories = response.memories.filter(m => 
      errorPatterns.test(m.content || '') || errorPatterns.test(m.summary || '')
    );

    if (errorMemories.length >= 2) {
      analysis.stuckIndicators.push('Multiple error-related activities detected');
      analysis.isLikelyStuck = true;
    }

    return analysis;
  }

  private parseForgottenTaskAnalysis(response: PiecesLtmResponse): ForgottenTaskAnalysis {
    const analysis: ForgottenTaskAnalysis = {
      success: response.success,
      forgottenTasks: [],
      abandonedProjects: [],
      rawMemories: response.memories
    };

    if (!response.success || !response.memories.length) {
      return analysis;
    }

    // Look for TODO patterns, unfinished work, etc.
    for (const memory of response.memories) {
      const content = memory.content || memory.summary || '';
      
      // Look for TODO/FIXME patterns
      const todoPatterns = [
        /TODO[:\s]+([^\n]+)/gi,
        /FIXME[:\s]+([^\n]+)/gi,
        /need to[:\s]+([^\n]+)/gi,
        /should[:\s]+([^\n]+)/gi,
        /want to[:\s]+([^\n]+)/gi,
      ];

      for (const pattern of todoPatterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          if (match[1] && match[1].length > 10) {
            analysis.forgottenTasks.push({
              description: match[1].trim().substring(0, 200),
              source: memory.application,
              timestamp: memory.timestamp,
            });
          }
        }
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    analysis.forgottenTasks = analysis.forgottenTasks.filter(task => {
      const key = task.description.toLowerCase().substring(0, 50);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 10);

    return analysis;
  }

  private parseProjectContextAnalysis(response: PiecesLtmResponse, projectName: string): ProjectContextAnalysis {
    return {
      success: response.success,
      projectName,
      recentFiles: [],
      recentIssues: [],
      progressSummary: response.memories.length > 0 
        ? response.memories[0].summary || response.memories[0].content || ''
        : '',
      rawMemories: response.memories
    };
  }

  private parseTechnologyPreferences(response: PiecesLtmResponse): TechnologyPreferences {
    const prefs: TechnologyPreferences = {
      success: response.success,
      languages: [],
      frameworks: [],
      tools: [],
      rawMemories: response.memories
    };

    if (!response.success || !response.memories.length) {
      return prefs;
    }

    const langMentions = new Map<string, number>();
    const frameworkMentions = new Map<string, number>();
    const toolMentions = new Map<string, number>();

    const knownLanguages = ['javascript', 'typescript', 'python', 'java', 'c#', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin'];
    const knownFrameworks = ['react', 'vue', 'angular', 'next.js', 'express', 'django', 'flask', 'spring', 'rails', 'laravel'];
    const knownTools = ['git', 'docker', 'kubernetes', 'aws', 'vscode', 'cursor', 'npm', 'yarn', 'webpack', 'vite'];

    for (const memory of response.memories) {
      const content = (memory.content || memory.summary || '').toLowerCase();
      
      for (const lang of knownLanguages) {
        if (content.includes(lang)) {
          langMentions.set(lang, (langMentions.get(lang) || 0) + 1);
        }
      }

      for (const fw of knownFrameworks) {
        if (content.includes(fw)) {
          frameworkMentions.set(fw, (frameworkMentions.get(fw) || 0) + 1);
        }
      }

      for (const tool of knownTools) {
        if (content.includes(tool)) {
          toolMentions.set(tool, (toolMentions.get(tool) || 0) + 1);
        }
      }
    }

    prefs.languages = Array.from(langMentions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    prefs.frameworks = Array.from(frameworkMentions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    prefs.tools = Array.from(toolMentions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    return prefs;
  }

  private parseRecentIssuesAnalysis(response: PiecesLtmResponse): RecentIssuesAnalysis {
    const analysis: RecentIssuesAnalysis = {
      success: response.success,
      issues: [],
      rawMemories: response.memories
    };

    if (!response.success || !response.memories.length) {
      return analysis;
    }

    const errorPatterns = /error|exception|failed|bug|issue|problem|crash|undefined|null pointer/i;

    for (const memory of response.memories) {
      const content = memory.content || memory.summary || '';
      
      if (errorPatterns.test(content)) {
        analysis.issues.push({
          description: content.substring(0, 300),
          application: memory.application,
          timestamp: memory.timestamp,
        });
      }
    }

    return analysis;
  }

  // ===========================================================================
  // Tool Discovery
  // ===========================================================================

  async listTools(): Promise<string[]> {
    if (!this.connected || !this.client) {
      return [];
    }

    try {
      const result = await this.client.listTools();
      return result.tools.map(tool => tool.name);
    } catch (error) {
      log.error('[PiecesMcpClient] Failed to list tools:', error);
      return [];
    }
  }

  // ===========================================================================
  // Response Parsing
  // ===========================================================================

  private parseMemoriesFromResult(result: unknown): PiecesLtmMemory[] {
    if (!result || typeof result !== 'object') {
      log.debug('[PiecesMcpClient] Result is null or not an object');
      return [];
    }

    const toolResult = result as { content?: unknown[]; isError?: boolean };
    
    // Check for errors
    if (toolResult.isError) {
      log.warn('[PiecesMcpClient] Tool returned an error');
      return [];
    }
    
    if (!toolResult.content || !Array.isArray(toolResult.content)) {
      log.debug('[PiecesMcpClient] No content array in result');
      return [];
    }

    const memories: PiecesLtmMemory[] = [];

    for (const item of toolResult.content) {
      if (typeof item === 'object' && item !== null) {
        const contentItem = item as { type?: string; text?: string };
        
        if (contentItem.type === 'text' && contentItem.text) {
          // Try to parse as Pieces LTM JSON response
          try {
            const parsed = JSON.parse(contentItem.text);
            
            // Handle Pieces LTM format with summaries and events
            // Increased limits for richer context
            if (parsed.summaries && Array.isArray(parsed.summaries)) {
              log.debug('[PiecesMcpClient] Found', parsed.summaries.length, 'summaries');
              for (const summary of parsed.summaries.slice(0, 12)) {
                if (summary.combined_string) {
                  const raw = summary.combined_string;
                  memories.push({
                    content: raw,
                    summary: raw.length > 350 ? raw.substring(0, 350) + '...' : raw,
                    timestamp: summary.created,
                    score: summary.score
                  });
                }
              }
            }
            
            // Also include relevant events (screen captures, app activity)
            if (parsed.events && Array.isArray(parsed.events)) {
              log.debug('[PiecesMcpClient] Found', parsed.events.length, 'events');
              const topEvents = parsed.events.slice(0, 10);
              for (const event of topEvents) {
                const text = event.combined_string || event.extracted_text;
                if (text && text.length > 50) {
                  memories.push({
                    content: text,
                    summary: text.length > 250 ? text.substring(0, 250) + '...' : text,
                    application: event.app_title,
                    timestamp: event.created,
                    score: event.score,
                    url: event.browser_url
                  });
                }
              }
            }
            
            // If we got memories from JSON, we're done with this content item
            if (memories.length > 0) {
              log.debug('[PiecesMcpClient] Parsed', memories.length, 'memories from Pieces LTM JSON');
              continue;
            }
          } catch {
            // Not valid JSON - fall through to treat as plain text
          }
          
          // Fallback: treat as plain text memory
          memories.push({
            content: contentItem.text,
            summary: contentItem.text.length > 350 ? contentItem.text.substring(0, 350) + '...' : contentItem.text
          });
        }
      }
    }

    log.debug('[PiecesMcpClient] Total parsed memories:', memories.length);
    return memories;
  }

  private normalizeMemory(raw: unknown): PiecesLtmMemory {
    if (typeof raw !== 'object' || raw === null) {
      return { content: String(raw) };
    }

    const obj = raw as Record<string, unknown>;
    
    return {
      id: typeof obj.id === 'string' ? obj.id : undefined,
      summary: typeof obj.summary === 'string' ? obj.summary : undefined,
      content: typeof obj.content === 'string' ? obj.content : 
               typeof obj.text === 'string' ? obj.text : undefined,
      source: typeof obj.source === 'string' ? obj.source : undefined,
      timestamp: typeof obj.timestamp === 'string' ? obj.timestamp : undefined,
      application: typeof obj.application === 'string' ? obj.application : 
                   typeof obj.app === 'string' ? obj.app : undefined
    };
  }

  // ===========================================================================
  // Status
  // ===========================================================================

  async checkStatus(): Promise<{ 
    connected: boolean; 
    tools?: string[];
    error?: string 
  }> {
    if (!this.connected) {
      // Try to connect if not connected
      const success = await this.connect();
      if (!success) {
        return { 
          connected: false, 
          error: 'Failed to connect to Pieces MCP server' 
        };
      }
    }

    try {
      const tools = await this.listTools();
      return { 
        connected: true, 
        tools 
      };
    } catch (error) {
      return { 
        connected: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  stop(): void {
    this.disconnect();
  }
}

export default PiecesMcpClient;
