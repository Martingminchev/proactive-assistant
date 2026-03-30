// =============================================================================
// NEXUS - Kimi API Client
// Full streaming support for Moonshot AI (Kimi K2.5)
// =============================================================================

import { EventEmitter } from 'events';
import log from 'electron-log';
import {
  KimiChatRequest,
  KimiStreamChunk,
  KimiModel,
  Message,
  MessageRole,
  MessageContent,
  ToolDefinition,
} from '../../shared/types';

// Use global fetch (available in Node.js 18+ and Electron)
declare const globalThis: {
  fetch: typeof fetch;
};

interface KimiClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  initialRetryDelayMs?: number;
}

interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  retryableStatusCodes: number[];
}

// API Response types
interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      reasoning_content?: string;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface ApiErrorResponse {
  error?: {
    message: string;
    type?: string;
    code?: string;
  };
}

interface ModelsResponse {
  data: KimiModel[];
  object: string;
}

export class KimiClient extends EventEmitter {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private retryConfig: RetryConfig;

  constructor(options: KimiClientOptions) {
    super();
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || 'https://api.moonshot.cn/v1';
    this.timeout = options.timeout || 60000;
    this.retryConfig = {
      maxRetries: options.maxRetries ?? 3,
      initialDelayMs: options.initialRetryDelayMs ?? 1000,
      maxDelayMs: 30000,
      retryableStatusCodes: [429, 500, 502, 503, 504],
    };
  }

  // ===========================================================================
  // Retry Logic with Exponential Backoff
  // ===========================================================================

  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;
    let delay = this.retryConfig.initialDelayMs;

    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if we should retry
        const shouldRetry = this.isRetryableError(lastError, attempt);
        
        if (!shouldRetry || attempt >= this.retryConfig.maxRetries) {
          log.error(`[KimiClient] ${operationName} failed after ${attempt + 1} attempts:`, lastError.message);
          throw lastError;
        }

        // Calculate delay with jitter
        const jitter = Math.random() * 0.3 * delay; // 0-30% jitter
        const actualDelay = Math.min(delay + jitter, this.retryConfig.maxDelayMs);
        
        log.debug(`[KimiClient] ${operationName} attempt ${attempt + 1} failed, retrying in ${Math.round(actualDelay)}ms...`);
        
        await this.sleep(actualDelay);
        
        // Exponential backoff
        delay *= 2;
      }
    }

    throw lastError || new Error(`${operationName} failed after retries`);
  }

  private isRetryableError(error: Error, attempt: number): boolean {
    const message = error.message.toLowerCase();
    
    // Check for rate limit (always retry with backoff)
    if (message.includes('429') || message.includes('rate limit')) {
      return true;
    }
    
    // Check for server errors
    for (const code of this.retryConfig.retryableStatusCodes) {
      if (message.includes(`(${code})`) || message.includes(`${code}`)) {
        return true;
      }
    }
    
    // Check for network errors
    if (
      message.includes('network') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('etimedout') ||
      message.includes('enotfound') ||
      message.includes('socket hang up') ||
      message.includes('fetch failed')
    ) {
      return true;
    }

    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===========================================================================
  // Non-Streaming Chat Completion with Tools Support
  // ===========================================================================
  
  async chatCompletion(request: KimiChatRequest): Promise<Message> {
    return this.withRetry(async () => {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          ...request,
          stream: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: response.statusText } })) as ApiErrorResponse;
        throw new Error(`Kimi API Error (${response.status}): ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json() as ChatCompletionResponse;
      
      const message: Message = {
        id: data.id,
        role: 'assistant' as MessageRole,
        content: data.choices[0]?.message?.content || '',
        timestamp: Date.now(),
        model: data.model,
        tokens: data.usage ? {
          prompt: data.usage.prompt_tokens,
          completion: data.usage.completion_tokens,
          total: data.usage.total_tokens,
        } : undefined,
        metadata: {
          thinking: data.choices[0]?.message?.reasoning_content,
        },
      };

      // Include tool calls if present
      if (data.choices[0]?.message?.tool_calls) {
        message.tool_calls = data.choices[0].message.tool_calls.map(tc => ({
          id: tc.id,
          type: tc.type as 'function',
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }));
      }

      return message;
    }, 'chatCompletion');
  }

  // ===========================================================================
  // Streaming Chat Completion with Tools Support
  // Returns an async generator for real-time token streaming
  // ===========================================================================
  
  async* streamChatCompletion(
    request: Omit<KimiChatRequest, 'stream'>
  ): AsyncGenerator<KimiStreamChunk, void, unknown> {
    log.debug(`[KimiClient] Starting stream to ${this.baseUrl}/chat/completions`);

    const requestBody: any = {
      ...request,
      stream: true,
    };

    const response = await this.withRetry(async () => {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(requestBody),
      });
      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage: string;
        try {
          const errorJson = JSON.parse(errorText) as ApiErrorResponse;
          errorMessage = errorJson.error?.message || res.statusText;
        } catch {
          errorMessage = errorText || res.statusText;
        }
        throw new Error(`Kimi API Error (${res.status}): ${errorMessage}`);
      }
      return res;
    }, 'streamChatCompletion');

    if (!response.body) {
      throw new Error('Response body is null');
    }

    // Handle streaming response
    const decoder = new TextDecoder();
    let buffer = '';

    // Use the web streams API properly
    const webStream = response.body as ReadableStream<Uint8Array>;
    const reader = webStream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        
        // Process complete SSE events
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep incomplete data in buffer

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith('data: ')) {
            continue;
          }

          const data = trimmedLine.slice(6).trim();
          
          // Stream end marker
          if (data === '[DONE]') {
            return;
          }

          try {
            const chunk: KimiStreamChunk = JSON.parse(data);
            yield chunk;
          } catch (parseError) {
            log.error('Failed to parse SSE chunk:', data, parseError);
          }
        }
      }

      // Process any remaining data
      if (buffer.trim()) {
        const lines = buffer.split('\n');
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.slice(6).trim();
            if (data && data !== '[DONE]') {
              try {
                const chunk: KimiStreamChunk = JSON.parse(data);
                yield chunk;
              } catch (parseError) {
                log.error('Failed to parse final SSE chunk:', parseError);
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ===========================================================================
  // Streaming Chat Completion with Tools (Multi-turn)
  // ===========================================================================
  
  async* streamChatCompletionWithTools(
    request: Omit<KimiChatRequest, 'stream'>,
    options?: {
      maxToolIterations?: number;
      onToolCall?: (toolCalls: any[]) => void;
    }
  ): AsyncGenerator<KimiStreamChunk | { type: 'tool_calls'; toolCalls: any[] }, void, unknown> {
    let iterations = 0;
    const maxIterations = options?.maxToolIterations ?? 10;
    let currentRequest = { ...request };

    while (iterations < maxIterations) {
      iterations++;
      
      // Stream the completion
      const stream = this.streamChatCompletion(currentRequest);
      let hasToolCalls = false;
      let accumulatedToolCalls: any[] = [];
      let currentContent = '';

      for await (const chunk of stream) {
        // Check for tool calls in the chunk
        const delta = chunk.choices[0]?.delta;
        
        if (delta?.tool_calls) {
          hasToolCalls = true;
          
          // Accumulate tool call data
          for (const tc of delta.tool_calls as any[]) {
            const toolCallIndex = tc.index as number;
            if (tc.id) {
              // New tool call
              accumulatedToolCalls.push({
                id: tc.id,
                type: tc.type || 'function',
                function: {
                  name: tc.function?.name || '',
                  arguments: tc.function?.arguments || '',
                },
                index: toolCallIndex,
              });
            } else if (toolCallIndex !== undefined && accumulatedToolCalls[toolCallIndex]) {
              // Continue existing tool call
              if (tc.function?.name) {
                accumulatedToolCalls[toolCallIndex].function.name += tc.function.name;
              }
              if (tc.function?.arguments) {
                accumulatedToolCalls[toolCallIndex].function.arguments += tc.function.arguments;
              }
            }
          }
        }
        
        if (delta?.content) {
          currentContent += delta.content;
        }

        // Yield the chunk for the caller to process
        yield chunk;

        // Check if stream is finished
        if (chunk.choices[0]?.finish_reason === 'tool_calls') {
          hasToolCalls = true;
        }
      }

      // If no tool calls, we're done
      if (!hasToolCalls || accumulatedToolCalls.length === 0) {
        return;
      }

      // Yield tool calls for the caller to execute
      yield { type: 'tool_calls' as const, toolCalls: accumulatedToolCalls };
      
      // Note: The caller is responsible for executing the tools and updating
      // the messages array with the results before calling this function again
      
      // For now, we exit after first iteration since the caller handles the loop
      return;
    }
  }

  // ===========================================================================
  // List Available Models
  // ===========================================================================
  
  async listModels(): Promise<KimiModel[]> {
    return this.withRetry(async () => {
      const url = `${this.baseUrl}/models`;
      log.debug(`[KimiClient] Fetching models from: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      log.debug(`[KimiClient] Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        log.debug(`[KimiClient] Error response body: ${errorText}`);
        
        let errorMessage: string;
        try {
          const errorData = JSON.parse(errorText) as ApiErrorResponse;
          errorMessage = errorData.error?.message || response.statusText;
        } catch {
          errorMessage = errorText || response.statusText;
        }
        throw new Error(`Kimi API Error (${response.status}): ${errorMessage}`);
      }

      const data = await response.json() as ModelsResponse;
      log.debug(`[KimiClient] Successfully fetched ${data.data?.length || 0} models`);
      return data.data || [];
    }, 'listModels');
  }

  // ===========================================================================
  // Validate API Key
  // ===========================================================================
  
  async validateApiKey(): Promise<{ valid: boolean; error?: string }> {
    try {
      log.debug(`[KimiClient] Validating API key against ${this.baseUrl}`);
      await this.listModels();
      log.debug(`[KimiClient] API key validation successful`);
      return { valid: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      log.error(`[KimiClient] API key validation failed: ${errorMessage}`);
      return { 
        valid: false, 
        error: errorMessage
      };
    }
  }

  // ===========================================================================
  // Token Count Estimation (approximate)
  // ===========================================================================
  
  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English/Chinese mixed content
    return Math.ceil(text.length / 4);
  }

  // ===========================================================================
  // Simple Chat (for non-streaming use cases like proactive agent)
  // ===========================================================================
  
  async chat(
    messages: Array<{ role: MessageRole; content: string }>,
    options?: {
      model?: string;
      temperature?: number;
      max_tokens?: number;
      tools?: ToolDefinition[];
      tool_choice?: 'auto' | 'none' | any;
    }
  ): Promise<string> {
    try {
      const request: KimiChatRequest = {
        model: options?.model || 'kimi-k2.5',
        messages: messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.max_tokens ?? 1000,
        stream: false,
        thinking: { type: 'disabled' }, // Faster for simple queries
      };

      if (options?.tools) {
        request.tools = options.tools;
      }

      if (options?.tool_choice) {
        request.tool_choice = options.tool_choice;
      }

      const response = await this.chatCompletion(request);

      return typeof response.content === 'string' 
        ? response.content 
        : '';
    } catch (error) {
      log.error('[KimiClient] Chat error:', error);
      throw error;
    }
  }

  /** Multimodal chat (text + image). Use for screenshot/vision analysis. */
  async chatWithContent(
    messages: Array<{ role: MessageRole; content: string | MessageContent[] }>,
    options?: {
      model?: string;
      max_tokens?: number;
    }
  ): Promise<string> {
    try {
      const request: KimiChatRequest = {
        model: options?.model || 'kimi-k2.5',
        messages,
        max_tokens: options?.max_tokens ?? 1000,
        stream: false,
        thinking: { type: 'disabled' },
      };
      const response = await this.chatCompletion(request);
      return typeof response.content === 'string' ? response.content : '';
    } catch (error) {
      log.error('[KimiClient] ChatWithContent error:', error);
      throw error;
    }
  }

  // ===========================================================================
  // Helper: Create conversation title from first message
  // ===========================================================================
  
  async generateTitle(firstMessage: string): Promise<string> {
    try {
      const response = await this.chatCompletion({
        model: 'kimi-k2.5',
        messages: [
          {
            role: 'system',
            content: 'Generate a short, concise title (3-5 words) for a conversation that starts with this message. Respond with ONLY the title, no quotes or explanation.',
          },
          {
            role: 'user',
            content: firstMessage.slice(0, 200), // Limit length
          },
        ],
        max_tokens: 20,
        thinking: { type: 'disabled' }, // Fast title generation
      });

      return (response.content as string).trim().replace(/["']/g, '') || 'New Conversation';
    } catch (error) {
      // Fallback: use first few words
      const words = firstMessage.split(' ').slice(0, 5).join(' ');
      return words.length > 30 ? words.slice(0, 30) + '...' : words;
    }
  }
}

export default KimiClient;
