// =============================================================================
// NEXUS - Conversation Manager
// Bidirectional conversation control - agent can initiate messages and manage context
// =============================================================================

import { EventEmitter } from 'events';
import log from 'electron-log';
import { v4 as uuidv4 } from 'uuid';
import { Conversation, Message } from '../../shared/types';
import { ConversationStore } from './conversation-store';

// Approximate chars per token for context size estimation
const CHARS_PER_TOKEN = 4;
const CONTEXT_CLUTTER_THRESHOLD_MESSAGES = 40;
const CONTEXT_CLUTTER_THRESHOLD_TOKENS = 12000;

export interface AgentMessageOptions {
  createNewThread?: boolean;
  threadTitle?: string;
  priority?: 'low' | 'normal' | 'high';
  conversationId?: string;
}

export interface ContextResetProposal {
  id: string;
  message: string;
  currentMessageCount: number;
  estimatedTokens: number;
}

export class ConversationManager extends EventEmitter {
  private conversationStore: ConversationStore;
  private pendingResetProposal: ContextResetProposal | null = null;

  constructor(conversationStore: ConversationStore) {
    super();
    this.conversationStore = conversationStore;
  }

  /**
   * Agent sends a message to the user. Adds to current conversation or creates new thread.
   */
  async agentMessage(
    content: string,
    options: AgentMessageOptions = {}
  ): Promise<{ conversationId: string; messageId: string } | null> {
    try {
      const message: Message = {
        id: `msg_${uuidv4()}`,
        role: 'assistant',
        content,
        timestamp: Date.now(),
        metadata: { latency: 0 },
      };

      let conversation: Conversation | null;
      let conversationId: string;

      let conv: Conversation | null;
      if (options.createNewThread && options.threadTitle) {
        conv = this.conversationStore.create();
        conv.title = options.threadTitle;
        conv.messages.push(message);
        this.conversationStore.update(conv);
        conversationId = conv.id;
        log.info('[ConversationManager] Agent started new thread:', options.threadTitle);
      } else if (options.conversationId) {
        conv = this.conversationStore.get(options.conversationId);
        if (!conv) {
          log.warn('[ConversationManager] Conversation not found:', options.conversationId);
          return null;
        }
        conv.messages.push(message);
        conv.updatedAt = Date.now();
        this.conversationStore.update(conv);
        conversationId = conv.id;
      } else {
        const all = this.conversationStore.getAll();
        conv = all[0] ?? this.conversationStore.create();
        conv.messages.push(message);
        conv.updatedAt = Date.now();
        this.conversationStore.update(conv);
        conversationId = conv.id;
      }
      conversation = conv;

      this.emit('agent-message', {
        conversationId,
        message,
        conversation,
      });

      return { conversationId, messageId: message.id };
    } catch (error) {
      log.error('[ConversationManager] agentMessage error:', error);
      return null;
    }
  }

  /**
   * Check if current conversation context is cluttered (too many messages or tokens).
   */
  isContextCluttered(conversationId?: string): boolean {
    const conv = conversationId
      ? this.conversationStore.get(conversationId)
      : this.conversationStore.getAll()[0];

    if (!conv || conv.messages.length === 0) return false;

    if (conv.messages.length >= CONTEXT_CLUTTER_THRESHOLD_MESSAGES) {
      return true;
    }

    const totalChars = conv.messages.reduce(
      (sum: number, m: Message) => sum + (typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content).length),
      0
    );
    const estimatedTokens = Math.ceil(totalChars / CHARS_PER_TOKEN);

    return estimatedTokens >= CONTEXT_CLUTTER_THRESHOLD_TOKENS;
  }

  /**
   * Propose a context reset to the user. Emits event for renderer to show confirmation.
   * Returns a promise that resolves when user responds.
   */
  proposeContextReset(conversationId?: string): Promise<boolean> {
    const conv = conversationId
      ? this.conversationStore.get(conversationId)
      : this.conversationStore.getAll()[0];

    if (!conv) {
      return Promise.resolve(false);
    }

    const totalChars = conv.messages.reduce(
      (sum: number, m: Message) => sum + (typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content).length),
      0
    );
    const estimatedTokens = Math.ceil(totalChars / CHARS_PER_TOKEN);

    const proposal: ContextResetProposal = {
      id: uuidv4(),
      message: `Context is getting long (${conv.messages.length} messages, ~${Math.round(estimatedTokens / 1000)}k tokens). Summarize and start fresh?`,
      currentMessageCount: conv.messages.length,
      estimatedTokens,
    };

    this.pendingResetProposal = proposal;
    this.emit('context-reset-proposed', proposal);

    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingResetProposal = null;
        this.removeListener(`context-reset-response-${proposal.id}`, handler);
        resolve(false);
      }, 60000);

      const handler = (accepted: boolean) => {
        clearTimeout(timeout);
        this.pendingResetProposal = null;
        this.removeListener(`context-reset-response-${proposal.id}`, handler);
        resolve(accepted);
      };

      this.once(`context-reset-response-${proposal.id}`, handler);
    });
  }

  /**
   * Handle user response to context reset proposal.
   */
  respondToContextResetProposal(proposalId: string, accepted: boolean): void {
    this.emit(`context-reset-response-${proposalId}`, accepted);
  }

  /**
   * Get current message count for a conversation.
   */
  getMessageCount(conversationId?: string): number {
    const conv = conversationId
      ? this.conversationStore.get(conversationId)
      : this.conversationStore.getAll()[0];
    return conv?.messages.length ?? 0;
  }

  /**
   * Get the conversation store for summarization integration.
   */
  getConversationStore(): ConversationStore {
    return this.conversationStore;
  }

  getPendingResetProposal(): ContextResetProposal | null {
    return this.pendingResetProposal;
  }
}
