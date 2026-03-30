import type { ToolDefinition, ToolExecutionResult } from '../../shared/types';

export type { ToolDefinition, ToolExecutionResult };

export interface ToolExecutionContext {
  systemContext?: unknown;
  conversationId?: string;
  messageId?: string;
}

export type ToolHandler = (
  args: Record<string, unknown>,
  context: ToolExecutionContext
) => Promise<ToolExecutionResult>;

export interface ToolRegistrationOptions {
  timeoutMs?: number;
  requireConfirmation?: boolean;
}

export interface IToolRegistry {
  registerTool(
    definition: ToolDefinition,
    handler: ToolHandler,
    options?: ToolRegistrationOptions
  ): void;
}
