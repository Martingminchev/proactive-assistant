// =============================================================================
// NEXUS - Context Summarizer
// Compresses conversation context for fresh starts
// =============================================================================

import log from 'electron-log';
import { Conversation, Message } from '../../shared/types';
import { KimiClient } from './kimi-client';

export interface ConversationSummary {
  summary: string;
  keyDecisions: string[];
  currentTask: string | null;
  unresolvedQuestions: string[];
  userPreferences: string[];
}

const MAX_MESSAGES_TO_SUMMARIZE = 30;

export class ContextSummarizer {
  private kimiClient: KimiClient | null = null;

  setKimiClient(client: KimiClient | null): void {
    this.kimiClient = client;
  }

  /**
   * Summarize a conversation for carrying forward to a new thread.
   */
  async summarize(conversation: Conversation): Promise<ConversationSummary> {
    if (!this.kimiClient) {
      return this.fallbackSummary(conversation);
    }

    const messagesToSummarize = conversation.messages.slice(-MAX_MESSAGES_TO_SUMMARIZE);
    const contextText = messagesToSummarize
      .map((m) => `${m.role}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
      .join('\n\n');

    const prompt = `Summarize this conversation for carrying context to a fresh chat. Extract:
1. A 2-3 sentence summary of what was discussed
2. Key decisions made (bullet points)
3. Current task being worked on (or null)
4. Unresolved questions (bullet points)
5. User preferences learned (e.g. "prefers concise answers")

Conversation:
${contextText}

Respond in JSON:
{
  "summary": "...",
  "keyDecisions": ["...", "..."],
  "currentTask": "..." or null,
  "unresolvedQuestions": ["...", "..."],
  "userPreferences": ["...", "..."]
}`;

    try {
      const response = await this.kimiClient.chat(
        [
          { role: 'system', content: 'You extract structured summaries. Output valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        { model: 'kimi-k2-turbo-preview', max_tokens: 800, temperature: 0.3 }
      );

      const jsonMatch = response?.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as ConversationSummary;
        return {
          summary: parsed.summary || '',
          keyDecisions: Array.isArray(parsed.keyDecisions) ? parsed.keyDecisions : [],
          currentTask: parsed.currentTask || null,
          unresolvedQuestions: Array.isArray(parsed.unresolvedQuestions) ? parsed.unresolvedQuestions : [],
          userPreferences: Array.isArray(parsed.userPreferences) ? parsed.userPreferences : [],
        };
      }
    } catch (error) {
      log.error('[ContextSummarizer] Summarization error:', error);
    }

    return this.fallbackSummary(conversation);
  }

  private fallbackSummary(conversation: Conversation): ConversationSummary {
    const userMessages = conversation.messages.filter((m) => m.role === 'user');
    const lastUser = userMessages[userMessages.length - 1];
    const lastContent = lastUser
      ? typeof lastUser.content === 'string'
        ? lastUser.content.slice(0, 200)
        : ''
      : '';

    return {
      summary: `Previous conversation had ${conversation.messages.length} messages.`,
      keyDecisions: [],
      currentTask: lastContent || null,
      unresolvedQuestions: [],
      userPreferences: [],
    };
  }

  /**
   * Format summary for injection into new conversation system message.
   */
  formatForNewConversation(summary: ConversationSummary): string {
    const parts: string[] = [];
    parts.push('## Context carried from previous conversation\n');
    parts.push(summary.summary);
    if (summary.keyDecisions.length > 0) {
      parts.push('\n### Key decisions');
      summary.keyDecisions.forEach((d) => parts.push(`- ${d}`));
    }
    if (summary.currentTask) {
      parts.push(`\n### Current task\n${summary.currentTask}`);
    }
    if (summary.unresolvedQuestions.length > 0) {
      parts.push('\n### Unresolved questions');
      summary.unresolvedQuestions.forEach((q) => parts.push(`- ${q}`));
    }
    if (summary.userPreferences.length > 0) {
      parts.push('\n### User preferences');
      summary.userPreferences.forEach((p) => parts.push(`- ${p}`));
    }
    return parts.join('\n');
  }
}
