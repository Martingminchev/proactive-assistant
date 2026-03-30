import * as vscode from 'vscode';
import * as http from 'http';
import { ILogger, IPiecesClient, ConnectionStatus, Result, ok, err, ActivityContext, Suggestion, VisionEvent } from '../types';
import { PIECES_OS_CONFIG } from '../config/settings';

// Pieces OS API response types
export interface PiecesHealthResponse {
  status: string;
  version?: string;
  name?: string;
}

interface WorkstreamSummary {
  id: string;
  summary: string;
  timestamp: string;
  source?: string;
}

interface Conversation {
  id: string;
  name?: string;
  messages: ConversationMessage[];
  updated: string;
}

interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface CopilotResponse {
  answer: string;
  confidence?: number;
  suggestions?: string[];
}

interface AnalysisResult {
  analyzed: boolean;
  suggestions: Suggestion[];
  context: ActivityContext;
}

interface QGPTQuestionResponse {
  answers?: {
    iterable?: Array<{
      text?: string;
      string?: string;
    }>;
  };
}

interface PiecesClientConfig {
  ports: number[];
  host: string;
  retryAttempts: number;
  baseDelay: number;
  maxDelay: number;
  requestTimeout: number;
}

const DEFAULT_CONFIG: PiecesClientConfig = {
  ports: [...PIECES_OS_CONFIG.PORTS], // Standard Pieces OS ports to try
  host: PIECES_OS_CONFIG.HOST,
  retryAttempts: PIECES_OS_CONFIG.RETRY_ATTEMPTS,
  baseDelay: PIECES_OS_CONFIG.BASE_DELAY_MS,
  maxDelay: PIECES_OS_CONFIG.MAX_DELAY_MS,
  requestTimeout: PIECES_OS_CONFIG.REQUEST_TIMEOUT_MS,
};

export class PiecesOSClient implements IPiecesClient {
  public readonly name = 'PiecesOSClient';
  
  private readonly _onStatusChanged = new vscode.EventEmitter<ConnectionStatus>();
  public readonly onStatusChanged = this._onStatusChanged.event;

  private config: PiecesClientConfig;
  private currentPort: number | null = null;
  private _status: ConnectionStatus = 'disconnected';
  private disposables: vscode.Disposable[] = [];
  private healthCheckInterval: NodeJS.Timeout | null = null;
  // discoveredPort tracks the working port but currently only used internally
  // @ts-expect-error - Reserved for future use in connection optimization
  private _discoveredPort: number | null = null;

  constructor(
    private readonly logger: ILogger,
    config?: Partial<PiecesClientConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger.info('PiecesOSClient initialized');
  }

  get status(): ConnectionStatus {
    return this._status;
  }
  
  async analyzeContext(context: ActivityContext): Promise<Result<AnalysisResult>> {
    // Check if Pieces OS is connected
    if (!this.isAvailable()) {
      return err(new Error('Pieces OS not available'));
    }
    
    this.logger.info('Analyzing context with Pieces OS', { 
      file: context.file,
      language: context.language 
    });
    
    // Build analysis prompt from context
    const prompt = this.buildAnalysisPrompt(context);
    
    try {
      // Call Pieces OS QGPT API using makeRequest
      const payload = {
        query: prompt,
        relevant: { iterable: [] }
      };
      
      const result = await this.withRetry(async () => {
        return this.makeRequest<QGPTQuestionResponse>('POST', '/qgpt/question', payload);
      });
      
      if (!result.success) {
        this.logger.error('Failed to analyze context with Pieces OS', result.error);
        return err(result.error);
      }
      
      // Parse the response and extract suggestions
      const answer = result.value.answers?.iterable?.[0]?.text || 
                     result.value.answers?.iterable?.[0]?.string || '';
      
      if (!answer) {
        this.logger.warn('Empty response from Pieces OS QGPT API');
        return ok({
          analyzed: true,
          suggestions: [],
          context
        });
      }
      
      // Parse suggestions from the answer
      const suggestions = this.parseSuggestionsFromAnswer(answer, context);
      
      this.logger.info(`Context analysis complete: ${suggestions.length} suggestions`);
      
      return ok({
        analyzed: true,
        suggestions,
        context
      });
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Error analyzing context:', error instanceof Error ? error : new Error(errorMessage));
      return err(new Error(`Context analysis failed: ${errorMessage}`));
    }
  }
  
  private buildAnalysisPrompt(context: ActivityContext): string {
    const parts: string[] = [
      'Analyze the following VS Code activity context and provide actionable suggestions:',
      '',
      '## Context:'
    ];
    
    if (context.file) {
      parts.push(`- File: ${context.file}`);
    }
    
    if (context.language) {
      parts.push(`- Language: ${context.language}`);
    }
    
    if (context.line !== undefined && context.column !== undefined) {
      parts.push(`- Cursor: Line ${context.line}, Column ${context.column}`);
    }
    
    if (context.content && context.content.trim()) {
      const contentPreview = context.content.substring(0, 500);
      parts.push(`- Content Preview:\n\`\`\`${context.language || ''}\n${contentPreview}\n\`\`\``);
    }
    
    if (context.errors && context.errors.length > 0) {
      parts.push('- Errors:');
      context.errors.forEach(e => {
        parts.push(`  - Line ${e.line}: ${e.message}`);
      });
    }
    
    if (context.warnings && context.warnings.length > 0) {
      parts.push('- Warnings:');
      context.warnings.forEach(w => {
        parts.push(`  - Line ${w.line}: ${w.message}`);
      });
    }
    
    if (context.duration) {
      parts.push(`- Session Duration: ${Math.round(context.duration / 60000)} minutes`);
    }
    
    parts.push('');
    parts.push('## Instructions:');
    parts.push('Provide 1-3 concise, actionable suggestions based on the context. Each suggestion should include:');
    parts.push('- A clear title');
    parts.push('- A brief description explaining why this suggestion is relevant');
    parts.push('- The priority level (low, medium, high, or urgent)');
    parts.push('');
    parts.push('Format your response as follows for each suggestion:');
    parts.push('SUGGESTION 1:');
    parts.push('Title: <suggestion title>');
    parts.push('Description: <explanation>');
    parts.push('Priority: <low/medium/high/urgent>');
    parts.push('');
    parts.push('If there are errors in the code, prioritize suggestions to fix them.');
    
    return parts.join('\n');
  }
  
  private parseSuggestionsFromAnswer(answer: string, context: ActivityContext): Suggestion[] {
    const suggestions: Suggestion[] = [];
    
    // Split by SUGGESTION markers
    const suggestionBlocks = answer.split(/SUGGESTION\s*\d+:/i).filter(block => block.trim());
    
    for (const block of suggestionBlocks) {
      const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
      
      let title = '';
      let description = '';
      let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
      
      for (const line of lines) {
        const lowerLine = line.toLowerCase();
        
        if (lowerLine.startsWith('title:')) {
          title = line.substring(6).trim();
        } else if (lowerLine.startsWith('description:')) {
          description = line.substring(12).trim();
        } else if (lowerLine.startsWith('priority:')) {
          const p = line.substring(9).trim().toLowerCase();
          if (['low', 'medium', 'high', 'urgent'].includes(p)) {
            priority = p as typeof priority;
          }
        } else if (!title && !description && line.length > 0) {
          // First non-labeled line might be the title
          title = line;
        } else if (title && !description && line.length > 0) {
          // Subsequent lines might be description
          description += (description ? ' ' : '') + line;
        }
      }
      
      // Only add if we have at least a title
      if (title) {
        suggestions.push({
          id: `pieces-${Date.now()}-${suggestions.length}`,
          title,
          description: description || 'No additional details provided.',
          priority,
          timestamp: new Date(),
          context,
          actions: [
            {
              id: 'dismiss',
              label: 'Dismiss',
              type: 'dismiss',
              isPrimary: false
            }
          ],
          category: 'ai-suggestion',
          confidence: 0.8,
          seen: false
        });
      }
    }
    
    return suggestions;
  }

  async initialize(): Promise<void> {
    this.logger.info('[PiecesOSClient] Initializing...');
    this.logger.info(`[PiecesOSClient] Will try ports: ${this.config.ports.join(', ')}`);
    
    // Try to auto-discover Pieces OS
    const discovered = await this.discoverPort();
    
    if (!discovered) {
      this.logger.warn('[PiecesOSClient] Initial discovery failed - will retry on next health check');
      this.logger.info('[PiecesOSClient] Make sure Pieces OS is running. Download: https://pieces.app/');
    }
    
    // Start health check interval
    this.startHealthCheck();
  }

  private async discoverPort(): Promise<boolean> {
    this.logger.info('[PiecesOSClient] Discovering Pieces OS port...');
    this.setStatus('connecting');

    for (const port of this.config.ports) {
      try {
        this.logger.info(`[PiecesOSClient] Trying port ${port}...`);
        const health = await this.checkHealthOnPort(port);
        if (health.success) {
          this._discoveredPort = port;
          this.currentPort = port;
          this.setStatus('connected');
          this.logger.info(`[PiecesOSClient] ✅ Connected to Pieces OS on port ${port}`, health.value);
          return true;
        } else {
          this.logger.debug(`[PiecesOSClient] Port ${port} health check failed: ${health.error.message}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.logger.info(`[PiecesOSClient] Port ${port} not responding: ${errorMsg}`);
      }
    }

    this.setStatus('disconnected');
    this.logger.warn(`[PiecesOSClient] ❌ Pieces OS not found on any port. Tried: ${this.config.ports.join(', ')}`);
    this.logger.info('[PiecesOSClient] Make sure Pieces OS is running. Download: https://pieces.app/');
    return false;
  }

  private async checkHealthOnPort(port: number): Promise<Result<PiecesHealthResponse>> {
    return this.makeRequest<PiecesHealthResponse>('GET', '/.well-known/health', undefined, port, 2000);
  }

  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Check health every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      await this.getHealth();
    }, PIECES_OS_CONFIG.HEALTH_CHECK_INTERVAL_MS);

    this.disposables.push({
      dispose: () => {
        if (this.healthCheckInterval) {
          clearInterval(this.healthCheckInterval);
        }
      }
    });
  }

  private setStatus(status: ConnectionStatus): void {
    if (this._status !== status) {
      this._status = status;
      this._onStatusChanged.fire(status);
    }
  }

  async getHealth(): Promise<Result<PiecesHealthResponse>> {
    // If not discovered yet, try discovery first
    if (!this.currentPort) {
      const discovered = await this.discoverPort();
      if (!discovered) {
        return err(new Error('Pieces OS not available'));
      }
    }

    const result = await this.checkHealthOnPort(this.currentPort!);
    
    if (result.success) {
      this.setStatus('connected');
    } else {
      this.setStatus('error');
      // Try rediscovery on next call
      this.currentPort = null;
    }

    return result;
  }

  async getWorkstreamSummaries(): Promise<Result<WorkstreamSummary[]>> {
    return this.withRetry(async () => {
      return this.makeRequest<WorkstreamSummary[]>('GET', '/workstream/summaries');
    });
  }

  async getVisionEvents(): Promise<Result<VisionEvent[]>> {
    return this.withRetry(async () => {
      return this.makeRequest<VisionEvent[]>('GET', '/workstream/vision_events?transferables=true');
    });
  }

  async getConversations(): Promise<Result<Conversation[]>> {
    return this.withRetry(async () => {
      return this.makeRequest<Conversation[]>('GET', '/conversations');
    });
  }

  async askCopilot(
    question: string, 
    context?: string
  ): Promise<Result<CopilotResponse>> {
    return this.withRetry(async () => {
      const payload = {
        question,
        context: context || '',
        options: {
          include_relevant: true,
          max_tokens: 1000
        }
      };
      return this.makeRequest<CopilotResponse>('POST', '/copilot/ask', payload);
    });
  }

  private makeRequest<T>(
    method: string,
    path: string,
    body?: unknown,
    port?: number,
    timeout?: number
  ): Promise<Result<T>> {
    return new Promise((resolve) => {
      const targetPort = port || this.currentPort;
      
      if (!targetPort) {
        resolve(err(new Error('Pieces OS port not discovered')));
        return;
      }

      const options: http.RequestOptions = {
        hostname: this.config.host,
        port: targetPort,
        path: path,
        method: method,
        timeout: timeout || this.config.requestTimeout,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };

      const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              // Handle empty responses
              if (!data || data.trim() === '') {
                resolve(ok({} as T));
                return;
              }
              
              // Try to parse as JSON, but handle plain text responses (like health endpoint)
              let parsed: T;
              const trimmed = data.trim();
              
              // Check if it looks like JSON
              if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
                  (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
                  trimmed.startsWith('"') ||
                  trimmed === 'true' ||
                  trimmed === 'false' ||
                  !isNaN(Number(trimmed))) {
                try {
                  parsed = JSON.parse(data) as T;
                } catch {
                  // If JSON parsing fails, treat as plain text
                  parsed = trimmed as unknown as T;
                }
              } else {
                // Plain text response (e.g., health endpoint returns "ok")
                parsed = trimmed as unknown as T;
              }
              
              resolve(ok(parsed));
            } else {
              resolve(err(new Error(`HTTP ${res.statusCode}: ${data}`)));
            }
          } catch (error) {
            resolve(err(new Error(`Failed to parse response: ${error}`)));
          }
        });
      });

      req.on('error', (error) => {
        this.logger.debug(`[PiecesOSClient] Request error on port ${targetPort}: ${error.message}`);
        resolve(err(error));
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(err(new Error('Request timeout')));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  private async withRetry<T>(
    operation: () => Promise<Result<T>>
  ): Promise<Result<T>> {
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt < this.config.retryAttempts; attempt++) {
      // Check if we need to rediscover
      if (!this.currentPort || this._status === 'disconnected') {
        const discovered = await this.discoverPort();
        if (!discovered) {
          return err(new Error('Pieces OS not available'));
        }
      }

      const result = await operation();

      if (result.success) {
        return result;
      }

      lastError = result.error;

      if (attempt < this.config.retryAttempts - 1) {
        const delay = Math.min(
          this.config.baseDelay * Math.pow(2, attempt),
          this.config.maxDelay
        );
        this.logger.debug(`Retry attempt ${attempt + 1}, waiting ${delay}ms`);
        await this.sleep(delay);
      }
    }

    return err(lastError);
  }

  isAvailable(): boolean {
    return this._status === 'connected' && this.currentPort !== null;
  }

  getCurrentPort(): number | null {
    return this.currentPort;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  dispose(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this._onStatusChanged.dispose();
    this.disposables.forEach(d => d.dispose());
  }

  async diagnoseConnection(): Promise<string[]> {
    const results: string[] = [];
    this.logger.info('[PiecesOSClient] Starting connection diagnostics...');
    
    for (const port of this.config.ports) {
      try {
        this.logger.info(`[PiecesOSClient] Testing port ${port}...`);
        const result = await this.checkHealthOnPort(port);
        if (result.success) {
          results.push(`✅ Port ${port}: Connected`);
          this.logger.info(`[PiecesOSClient] Port ${port}: Connected`);
        } else {
          results.push(`❌ Port ${port}: ${result.error.message}`);
          this.logger.info(`[PiecesOSClient] Port ${port}: ${result.error.message}`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        results.push(`❌ Port ${port}: ${msg}`);
        this.logger.info(`[PiecesOSClient] Port ${port}: ${msg}`);
      }
    }
    
    return results;
  }
}

export default PiecesOSClient;
