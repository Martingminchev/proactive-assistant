// =============================================================================
// NEXUS - Pieces Context Provider
// Provides on-demand context from QGPT, LTM, and saved assets for the assistant
// =============================================================================

import { PiecesClient } from './pieces-client';
import { PiecesMcpClient } from './pieces-mcp-client';
import { PiecesLtmResponse, PiecesAsset } from '../../shared/types';

export interface PiecesContextResult {
  success: boolean;
  type: string;
  data?: unknown;
  error?: string;
}

export class PiecesContextProvider {
  constructor(
    private piecesClient: PiecesClient | null,
    private piecesMcpClient: PiecesMcpClient | null
  ) {}

  async queryQGPT(query: string, context?: string): Promise<PiecesContextResult> {
    if (!this.piecesClient?.isAvailable()) {
      return { success: false, type: 'qgpt', error: 'Pieces integration not available' };
    }
    try {
      const result = await this.piecesClient.analyzeContext(query, context);
      return {
        success: true,
        type: 'qgpt',
        data: {
          suggestions: result.suggestions,
          relevantAssets: result.relevantAssets,
        },
      };
    } catch (e) {
      return {
        success: false,
        type: 'qgpt',
        error: e instanceof Error ? e.message : 'QGPT query failed',
      };
    }
  }

  async queryLTM(question: string): Promise<PiecesContextResult> {
    if (!this.piecesMcpClient?.isConnected()) {
      return { success: false, type: 'ltm', error: 'Pieces LTM not connected' };
    }
    try {
      const result = await this.piecesMcpClient.askPiecesLtm(question);
      return {
        success: result.success,
        type: 'ltm',
        data: result.success ? { memories: result.memories, query: result.query } : undefined,
        error: result.error,
      };
    } catch (e) {
      return {
        success: false,
        type: 'ltm',
        error: e instanceof Error ? e.message : 'LTM query failed',
      };
    }
  }

  async queryLTMDebug(): Promise<PiecesContextResult> {
    if (!this.piecesMcpClient?.isConnected()) {
      return { success: false, type: 'ltm_debug', error: 'Pieces LTM not connected' };
    }
    try {
      const result = await this.piecesMcpClient.getDebugContext();
      return {
        success: result.success,
        type: 'ltm_debug',
        data: result.success ? { memories: result.memories } : undefined,
        error: result.error,
      };
    } catch (e) {
      return {
        success: false,
        type: 'ltm_debug',
        error: e instanceof Error ? e.message : 'LTM debug query failed',
      };
    }
  }

  async queryLTMBrowsing(): Promise<PiecesContextResult> {
    if (!this.piecesMcpClient?.isConnected()) {
      return { success: false, type: 'ltm_browsing', error: 'Pieces LTM not connected' };
    }
    try {
      const result = await this.piecesMcpClient.getRecentBrowsingContext();
      return {
        success: result.success,
        type: 'ltm_browsing',
        data: result.success ? { memories: result.memories } : undefined,
        error: result.error,
      };
    } catch (e) {
      return {
        success: false,
        type: 'ltm_browsing',
        error: e instanceof Error ? e.message : 'LTM browsing query failed',
      };
    }
  }

  async queryLTMTopic(topic: string): Promise<PiecesContextResult> {
    if (!this.piecesMcpClient?.isConnected()) {
      return { success: false, type: 'ltm_topic', error: 'Pieces LTM not connected' };
    }
    try {
      const result = await this.piecesMcpClient.askAboutTopic(topic);
      return {
        success: result.success,
        type: 'ltm_topic',
        data: result.success ? { memories: result.memories, topic } : undefined,
        error: result.error,
      };
    } catch (e) {
      return {
        success: false,
        type: 'ltm_topic',
        error: e instanceof Error ? e.message : 'LTM topic query failed',
      };
    }
  }

  async queryLTMCoding(hoursBack: number = 24): Promise<PiecesContextResult> {
    if (!this.piecesMcpClient?.isConnected()) {
      return { success: false, type: 'ltm_coding', error: 'Pieces LTM not connected' };
    }
    try {
      const result = await this.piecesMcpClient.getRecentCodingActivity(hoursBack);
      return {
        success: result.success,
        type: 'ltm_coding',
        data: result.success ? { memories: result.memories, hoursBack } : undefined,
        error: result.error,
      };
    } catch (e) {
      return {
        success: false,
        type: 'ltm_coding',
        error: e instanceof Error ? e.message : 'LTM coding query failed',
      };
    }
  }

  async getRelevantAssets(query: string, max: number = 5): Promise<PiecesContextResult> {
    if (!this.piecesClient?.isAvailable()) {
      return { success: false, type: 'pieces_assets', error: 'Pieces integration not available' };
    }
    try {
      const assets = await this.piecesClient.getRelevantAssetsForQuery(query, max);
      return {
        success: true,
        type: 'pieces_assets',
        data: { assets },
      };
    } catch (e) {
      return {
        success: false,
        type: 'pieces_assets',
        error: e instanceof Error ? e.message : 'Pieces assets query failed',
      };
    }
  }
}
