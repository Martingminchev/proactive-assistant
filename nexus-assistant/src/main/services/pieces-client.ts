// =============================================================================
// NEXUS - Pieces OS Client
// Integration with Pieces for Developers API
// =============================================================================

import { EventEmitter } from 'events';
import log from 'electron-log';
import http from 'http';
import { PiecesAsset, PiecesAssetAnchor } from '../../shared/types';

/** Maps raw Pieces API asset response to PiecesAsset, extracting enrichment fields when present */
function mapRawAsset(asset: any): PiecesAsset {
  const base = {
    id: asset.id ?? '',
    name: asset.name || 'Untitled',
    content: asset.original?.string?.raw ?? asset.content ?? '',
    created: new Date(asset.created || Date.now()).getTime(),
    modified: new Date(asset.updated || asset.modified || Date.now()).getTime(),
    tags: asset.tags || [],
    language: asset.format?.classification?.generic ?? asset.language ?? undefined,
  };
  const anchors: PiecesAssetAnchor[] = [];
  if (asset.anchors?.iterable) {
    for (const a of asset.anchors.iterable) {
      anchors.push({
        type: a.type,
        value: a.value ?? a.fullPath ?? a.path,
        path: a.fullPath ?? a.path,
        url: a.url,
      });
    }
  } else if (asset.anchors && Array.isArray(asset.anchors)) {
    for (const a of asset.anchors) {
      anchors.push({
        type: typeof a === 'string' ? undefined : a.type,
        value: typeof a === 'string' ? a : (a.value ?? a.fullPath ?? a.path),
        path: typeof a === 'string' ? a : (a.fullPath ?? a.path),
        url: typeof a === 'string' ? undefined : a.url,
      });
    }
  }
  const annotations: string[] = [];
  if (asset.annotations?.iterable) {
    for (const a of asset.annotations.iterable) {
      const text = typeof a === 'string' ? a : (a.text ?? a.content ?? a.description);
      if (text) annotations.push(text);
    }
  } else if (asset.annotations && Array.isArray(asset.annotations)) {
    for (const a of asset.annotations) {
      const text = typeof a === 'string' ? a : (a.text ?? a.content ?? a.description);
      if (text) annotations.push(text);
    }
  }
  const relatedLinks: string[] = [];
  if (asset.websites?.iterable) {
    for (const w of asset.websites.iterable) {
      const url = typeof w === 'string' ? w : (w.url ?? w.value);
      if (url) relatedLinks.push(url);
    }
  } else if (asset.websites && Array.isArray(asset.websites)) {
    for (const w of asset.websites) {
      const url = typeof w === 'string' ? w : (w.url ?? w.value);
      if (url) relatedLinks.push(url);
    }
  }
  return {
    ...base,
    ...(anchors.length > 0 && { anchors }),
    ...(annotations.length > 0 && { annotations }),
    ...(relatedLinks.length > 0 && { relatedLinks }),
  };
}

interface PiecesClientOptions {
  port?: number;
  host?: string;
}

interface PiecesHealthResponse {
  ok: boolean;
  version?: string;
}

interface PiecesAssetsResponse {
  iterable: Array<{
    id: string;
    name?: string;
    original: {
      string: {
        raw: string;
      };
    };
    created?: string;
    updated?: string;
    tags?: string[];
  }>;
}

export class PiecesClient extends EventEmitter {
  private port: number;
  private host: string;
  private available: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private version: string = '';

  constructor(options: PiecesClientOptions = {}) {
    super();
    this.port = options.port || 39300;
    this.host = options.host || 'localhost';
    this.startHealthCheck();
  }

  // ===========================================================================
  // Configuration
  // ===========================================================================
  
  updateConfig(options: PiecesClientOptions): void {
    if (options.port !== undefined) {
      this.port = options.port;
    }
    if (options.host !== undefined) {
      this.host = options.host;
    }
    // Trigger immediate status check with new config
    this.checkStatus();
  }

  // ===========================================================================
  // Health Check & Availability
  // ===========================================================================
  
  private startHealthCheck(): void {
    // Check immediately
    this.checkStatus();
    
    // Then check every 30 seconds
    this.checkInterval = setInterval(() => {
      this.checkStatus();
    }, 30000);
  }

  async checkStatus(): Promise<{ available: boolean; version?: string; error?: string }> {
    try {
      // Try the well-known health endpoint first
      let response: PiecesHealthResponse | null = null;
      
      try {
        response = await this.makeRequest<PiecesHealthResponse>('GET', '/.well-known/health');
      } catch (healthError) {
        // Fallback: try the root endpoint or application-specific health check
        try {
          response = await this.makeRequest<PiecesHealthResponse>('GET', '/application');
        } catch {
          // If that also fails, try to get version info
          try {
            const versionInfo = await this.makeRequest<any>('GET', '/version');
            if (versionInfo) {
              response = { ok: true, version: versionInfo.version || 'unknown' };
            }
          } catch {
            // All attempts failed
            throw healthError;
          }
        }
      }
      
      const wasAvailable = this.available;
      const isNowAvailable = !!(response && (response.ok === true || response.version !== undefined));
      this.available = isNowAvailable;
      
      if (response?.version) {
        this.version = response.version;
      }
      
      if (this.available && !wasAvailable) {
        this.emit('connected');
      } else if (!this.available && wasAvailable) {
        this.emit('disconnected');
      }
      
      return { 
        available: this.available,
        version: this.version || 'connected',
      };
    } catch (error) {
      const wasAvailable = this.available;
      this.available = false;
      
      if (wasAvailable) {
        this.emit('disconnected');
      }
      
      return { 
        available: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  getVersion(): string {
    return this.version;
  }

  // ===========================================================================
  // Asset Management
  // ===========================================================================
  
  async getAllAssets(): Promise<PiecesAsset[]> {
    if (!this.available) {
      throw new Error('Pieces OS is not available');
    }
    
    try {
      const response = await this.makeRequest<PiecesAssetsResponse>('GET', '/assets');
      
      if (!response?.iterable) {
        return [];
      }
      
      return response.iterable.map(mapRawAsset);
    } catch (error) {
      log.error('Failed to get all assets:', error);
      throw error;
    }
  }

  async searchAssets(query: string, limit: number = 10): Promise<PiecesAsset[]> {
    if (!this.available) {
      return [];
    }
    
    try {
      // Try Pieces OS native search first (if available)
      try {
        const searchResponse = await this.makeRequest<any>('POST', '/assets/search', {
          query,
          limit,
        });
        
        if (searchResponse?.iterable && Array.isArray(searchResponse.iterable)) {
          return searchResponse.iterable.map(mapRawAsset);
        }
      } catch (searchError) {
        // Native search failed, fallback to local filtering
        console.log('Native Pieces search failed, using fallback:', searchError);
      }
      
      // Fallback: Get all assets and filter locally
      const allAssets = await this.getAllAssets();
      const lowerQuery = query.toLowerCase();
      
      return allAssets
        .filter(asset => 
          asset.name.toLowerCase().includes(lowerQuery) ||
          asset.content.toLowerCase().includes(lowerQuery) ||
          asset.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
        )
        .slice(0, limit);
    } catch (error) {
      log.error('Pieces search error:', error);
      return [];
    }
  }

  async getAsset(id: string): Promise<PiecesAsset | null> {
    if (!this.available) {
      return null;
    }
    
    try {
      const response = await this.makeRequest<any>('GET', `/assets/${id}`);
      
      if (!response) return null;
      
      return mapRawAsset(response);
    } catch (error) {
      log.error('Pieces get asset error:', error);
      return null;
    }
  }

  // ===========================================================================
  // QGPT - AI-Powered Context Analysis
  // ===========================================================================
  
  async analyzeContext(query: string, context?: string): Promise<{ 
    suggestions: Array<{
      title: string;
      description: string;
      action: string;
    }>;
    relevantAssets?: PiecesAsset[];
  }> {
    if (!this.available) {
      return { suggestions: [] };
    }
    
    try {
      const response = await this.makeRequest<any>('POST', '/qgpt/question', {
        query,
        context,
      });

      // Parse the response for suggestions
      const suggestions = this.parseSuggestions(response);
      
      return { suggestions };
    } catch (error) {
      log.error('Pieces QGPT error:', error);
      return { suggestions: [] };
    }
  }

  async getRelevantAssetsForQuery(query: string, maxAssets: number = 3): Promise<PiecesAsset[]> {
    if (!this.available || !query) {
      return [];
    }
    
    try {
      // Search for relevant assets based on the query
      const assets = await this.searchAssets(query, maxAssets);
      return assets;
    } catch (error) {
      log.error('Failed to get relevant assets:', error);
      return [];
    }
  }

  private parseSuggestions(response: any): Array<{
    title: string;
    description: string;
    action: string;
  }> {
    // Handle different response formats from Pieces OS
    if (!response) return [];
    
    if (response.iterable && Array.isArray(response.iterable)) {
      return response.iterable.map((item: any) => ({
        title: item.title || item.name || 'Suggestion',
        description: item.description || item.content || '',
        action: item.action || 'review',
      }));
    }
    
    if (response.suggestions && Array.isArray(response.suggestions)) {
      return response.suggestions;
    }
    
    return [];
  }

  // ===========================================================================
  // HTTP Client
  // ===========================================================================
  
  private makeRequest<T>(
    method: string,
    endpoint: string,
    body?: any
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const options: http.RequestOptions = {
        hostname: this.host,
        port: this.port,
        path: endpoint,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 10000,
      };

      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              // Handle both JSON and plain text responses
              let parsed: T;
              try {
                parsed = JSON.parse(data) as T;
              } catch {
                // If JSON parse fails, return as string
                parsed = data as unknown as T;
              }
              resolve(parsed);
            } else if (res.statusCode === 204) {
              // No content
              resolve({} as T);
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${data}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================
  
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

export default PiecesClient;
