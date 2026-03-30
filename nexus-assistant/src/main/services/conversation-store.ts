// =============================================================================
// NEXUS - Conversation Store
// Persistent storage for chat conversations
// =============================================================================

import { app } from 'electron';
import log from 'electron-log';
import path from 'path';
import fs from 'fs/promises';
import { 
  Conversation, 
  ConversationSummary, 
  Message, 
  SearchOptions, 
  ConversationSearchResult, 
  SearchMatch,
  MessageMatch 
} from '../../shared/types';

interface StoreData {
  conversations: Conversation[];
  version: number;
}

const STORE_VERSION = 1;
const MAX_CONVERSATIONS = 100;

export class ConversationStore {
  private data: StoreData;
  private filePath: string;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.data = {
      conversations: [],
      version: STORE_VERSION,
    };
    
    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, 'conversations.json');
    
    this.load();
  }

  // ===========================================================================
  // Persistence
  // ===========================================================================
  
  private async load(): Promise<void> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(data) as StoreData;
      
      // Validate version
      if (parsed.version !== STORE_VERSION) {
        log.warn(`Conversation store version mismatch: ${parsed.version} vs ${STORE_VERSION}`);
        // Handle migration if needed
      }
      
      this.data = parsed;
      
      // Validate conversations
      this.data.conversations = this.data.conversations.filter(c => 
        c && c.id && Array.isArray(c.messages)
      );
      
      log.debug(`Loaded ${this.data.conversations.length} conversations`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        log.error('Failed to load conversations:', error);
      }
      // Use empty store if file doesn't exist or is corrupt
    }
  }

  private scheduleSave(): void {
    // Debounce saves
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    
    this.saveTimeout = setTimeout(() => {
      this.save();
    }, 500);
  }

  private async save(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      log.error('Failed to save conversations:', error);
    }
  }

  // ===========================================================================
  // CRUD Operations
  // ===========================================================================
  
  create(): Conversation {
    const conversation: Conversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: 'New Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: 'kimi-k2.5',
      isStreaming: false,
    };

    this.data.conversations.unshift(conversation);
    this.enforceLimit();
    this.scheduleSave();
    
    return conversation;
  }

  get(id: string): Conversation | null {
    const conversation = this.data.conversations.find(c => c.id === id);
    return conversation ? { ...conversation } : null;
  }

  getAll(): Conversation[] {
    return [...this.data.conversations];
  }

  getSummaries(): ConversationSummary[] {
    return this.data.conversations.map(c => ({
      id: c.id,
      title: c.title,
      messageCount: c.messages.length,
      lastMessage: this.getLastMessagePreview(c),
      updatedAt: c.updatedAt,
    }));
  }

  update(conversation: Conversation): Conversation {
    const index = this.data.conversations.findIndex(c => c.id === conversation.id);
    
    if (index === -1) {
      throw new Error(`Conversation not found: ${conversation.id}`);
    }

    // Update title based on first message if still default
    if (conversation.title === 'New Conversation' && conversation.messages.length > 0) {
      const firstUserMessage = conversation.messages.find(m => m.role === 'user');
      if (firstUserMessage) {
        conversation.title = this.generateTitle(firstUserMessage.content as string);
      }
    }

    conversation.updatedAt = Date.now();
    this.data.conversations[index] = conversation;
    
    // Move to top
    this.data.conversations.splice(index, 1);
    this.data.conversations.unshift(conversation);
    
    this.scheduleSave();
    
    return { ...conversation };
  }

  delete(id: string): boolean {
    const index = this.data.conversations.findIndex(c => c.id === id);
    
    if (index === -1) {
      return false;
    }

    this.data.conversations.splice(index, 1);
    this.scheduleSave();
    
    return true;
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================
  
  private enforceLimit(): void {
    if (this.data.conversations.length > MAX_CONVERSATIONS) {
      // Remove oldest conversations
      this.data.conversations = this.data.conversations.slice(0, MAX_CONVERSATIONS);
    }
  }

  private generateTitle(content: string): string {
    if (!content) return 'New Conversation';
    
    // Remove markdown and extra whitespace
    const clean = content
      .replace(/[#*`\[\]()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Get first few words
    const words = clean.split(' ').slice(0, 5).join(' ');
    
    // Truncate if too long
    if (words.length > 40) {
      return words.slice(0, 40) + '...';
    }
    
    return words || 'New Conversation';
  }

  private getLastMessagePreview(conversation: Conversation): string {
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    if (!lastMessage) return '';
    
    const content = typeof lastMessage.content === 'string' 
      ? lastMessage.content 
      : 'Media content';
    
    const clean = content
      .replace(/[#*`\[\]()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (clean.length > 60) {
      return clean.slice(0, 60) + '...';
    }
    
    return clean;
  }

  // ===========================================================================
  // Import/Export
  // ===========================================================================
  
  async exportToFile(filePath: string): Promise<void> {
    await fs.writeFile(filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  async importFromFile(filePath: string): Promise<void> {
    const data = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(data) as StoreData;
    
    // Merge conversations, avoiding duplicates
    const existingIds = new Set(this.data.conversations.map(c => c.id));
    const newConversations = parsed.conversations.filter(c => !existingIds.has(c.id));
    
    this.data.conversations.push(...newConversations);
    this.enforceLimit();
    this.scheduleSave();
  }

  clearAll(): void {
    this.data.conversations = [];
    this.scheduleSave();
  }

  // ===========================================================================
  // Search
  // ===========================================================================
  
  search(options: SearchOptions): ConversationSearchResult[] {
    const { query, limit = 20, dateFrom, dateTo } = options;
    
    if (!query || query.trim().length === 0) {
      return [];
    }
    
    const normalizedQuery = query.toLowerCase().trim();
    const terms = normalizedQuery.split(/\s+/).filter(t => t.length > 0);
    const phrase = normalizedQuery;
    
    const results: ConversationSearchResult[] = [];
    
    for (const conversation of this.data.conversations) {
      // Date range filtering
      if (dateFrom && conversation.updatedAt < dateFrom) continue;
      if (dateTo && conversation.updatedAt > dateTo) continue;
      
      const titleMatches = this.findMatches(conversation.title, terms, phrase);
      const messageMatches: MessageMatch[] = [];
      
      // Search in messages
      for (let i = 0; i < conversation.messages.length; i++) {
        const message = conversation.messages[i];
        const content = this.extractMessageContent(message);
        
        if (!content) continue;
        
        const matches = this.findMatches(content, terms, phrase);
        
        if (matches.length > 0) {
          messageMatches.push({
            messageId: message.id,
            messageIndex: i,
            role: message.role,
            content: content,
            context: this.extractContext(content, matches),
            matches: matches,
          });
        }
      }
      
      // Only include if there are any matches
      if (titleMatches.length > 0 || messageMatches.length > 0) {
        const result: ConversationSearchResult = {
          conversationId: conversation.id,
          title: conversation.title,
          titleMatches,
          messageMatches,
          messageCount: conversation.messages.length,
          updatedAt: conversation.updatedAt,
          score: this.calculateSearchScore(conversation, titleMatches, messageMatches, normalizedQuery),
        };
        
        results.push(result);
      }
    }
    
    // Sort by score (descending) and limit results
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }
  
  private extractMessageContent(message: Message): string {
    if (typeof message.content === 'string') {
      return message.content;
    }
    
    if (Array.isArray(message.content)) {
      return message.content
        .map(part => {
          if (part.type === 'text' && part.text) {
            return part.text;
          }
          return '';
        })
        .join(' ');
    }
    
    return '';
  }
  
  private findMatches(text: string, terms: string[], phrase: string): SearchMatch[] {
    const matches: SearchMatch[] = [];
    const normalizedText = text.toLowerCase();
    
    // Try phrase matching first
    let index = normalizedText.indexOf(phrase);
    while (index !== -1) {
      const length = phrase.length;
      matches.push({ 
        start: index, 
        end: index + length,
        text: text.substring(index, index + length),
        index: matches.length,
        length
      });
      index = normalizedText.indexOf(phrase, index + 1);
    }
    
    // If no phrase matches, try individual terms
    if (matches.length === 0) {
      for (const term of terms) {
        index = normalizedText.indexOf(term);
        while (index !== -1) {
          const length = term.length;
          matches.push({ 
            start: index, 
            end: index + length,
            text: text.substring(index, index + length),
            index: matches.length,
            length
          });
          index = normalizedText.indexOf(term, index + 1);
        }
      }
    }
    
    // Remove overlapping matches
    return this.mergeOverlappingMatches(matches);
  }
  
  private mergeOverlappingMatches(matches: SearchMatch[]): SearchMatch[] {
    if (matches.length <= 1) return matches;
    
    // Sort by start position
    matches.sort((a, b) => a.start - b.start);
    
    const merged: SearchMatch[] = [matches[0]];
    
    for (let i = 1; i < matches.length; i++) {
      const last = merged[merged.length - 1];
      const current = matches[i];
      
      if (current.start <= last.end) {
        // Overlapping - extend the last match if needed
        last.end = Math.max(last.end, current.end);
      } else {
        merged.push(current);
      }
    }
    
    return merged;
  }
  
  private extractContext(content: string, matches: SearchMatch[]): string {
    if (matches.length === 0) return content.slice(0, 120);
    
    const contextChars = 60;
    const firstMatch = matches[0];
    
    let start = Math.max(0, firstMatch.start - contextChars);
    let end = Math.min(content.length, firstMatch.end + contextChars);
    
    // Extend to word boundaries
    while (start > 0 && content[start - 1] !== ' ' && content[start - 1] !== '\n') {
      start--;
    }
    while (end < content.length && content[end] !== ' ' && content[end] !== '\n') {
      end++;
    }
    
    let context = content.slice(start, end);
    
    // Add ellipsis if truncated
    if (start > 0) context = '...' + context;
    if (end < content.length) context = context + '...';
    
    return context;
  }
  
  private calculateSearchScore(
    conversation: Conversation,
    titleMatches: SearchMatch[],
    messageMatches: MessageMatch[],
    query: string
  ): number {
    let score = 0;
    
    // Title match scoring
    if (titleMatches.length > 0) {
      const titleLower = conversation.title.toLowerCase();
      const queryLower = query.toLowerCase();
      
      // Exact title match
      if (titleLower === queryLower) {
        score += 150;
      } else if (titleLower.startsWith(queryLower)) {
        score += 120;
      } else {
        score += 100;
      }
    }
    
    // Content match scoring
    score += messageMatches.length * 10;
    
    // Bonus for multiple matches in same message
    for (const match of messageMatches) {
      if (match.matches.length > 1) {
        score += (match.matches.length - 1) * 5;
      }
    }
    
    // Recency scoring (max +30, decays over 30 days)
    const daysSinceUpdate = (Date.now() - conversation.updatedAt) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 30 - daysSinceUpdate);
    score += recencyScore;
    
    return score;
  }
}

export default ConversationStore;
