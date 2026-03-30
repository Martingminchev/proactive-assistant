// =============================================================================
// NEXUS - Tool Execution Block
// Displays tool inputs and outputs during assistant activity
// =============================================================================

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Terminal, Loader2, Check, X, Square } from 'lucide-react';

export interface ToolCallDisplay {
  toolCallId: string;
  toolName: string;
  args?: string;
  status: 'running' | 'complete' | 'error';
  result?: unknown;
  error?: string;
  statusMessage?: string;
}

const TOOLS_REQUIRING_CONFIRMATION = new Set([
  'run_command', 'open_file', 'write_file', 'edit_file', 'fetch_url', 'open_browser_tab', 'copy_to_clipboard',
]);

interface ToolExecutionBlockProps {
  tool: ToolCallDisplay;
  onCancel?: () => void;
}

function getShortSummary(toolName: string, args?: string): string {
  if (!args) return '';
  try {
    const parsed = JSON.parse(args);
    if (toolName === 'run_command' && parsed.command) {
      return parsed.command;
    }
    if (toolName === 'open_file' && parsed.filePath) {
      return parsed.filePath;
    }
    if (toolName === 'search_files' && parsed.pattern) {
      return parsed.pattern;
    }
    return JSON.stringify(parsed).slice(0, 60) + (JSON.stringify(parsed).length > 60 ? '...' : '');
  } catch {
    return args.slice(0, 60) + (args.length > 60 ? '...' : '');
  }
}

function formatResult(result: unknown): string {
  if (result === undefined || result === null) return '';
  if (typeof result === 'string') return result;
  if (typeof result === 'object' && result !== null) {
    const obj = result as Record<string, unknown>;
    if (obj.stdout !== undefined) {
      const lines: string[] = [];
      if (obj.stdout) lines.push(`stdout:\n${obj.stdout}`);
      if (obj.stderr) lines.push(`stderr:\n${obj.stderr}`);
      if (obj.exitCode !== undefined) lines.push(`exit code: ${obj.exitCode}`);
      return lines.join('\n');
    }
    return JSON.stringify(result, null, 2);
  }
  return String(result);
}

function getErrorSuggestion(error: string): string | null {
  if (/permission|denied|EACCES|access/i.test(error)) return 'Check file/folder permissions or run with appropriate access.';
  if (/not found|ENOENT/i.test(error)) return 'Verify the path or file exists.';
  if (/timeout|timed out/i.test(error)) return 'The operation took too long. You can try again.';
  if (/User denied/i.test(error)) return 'You declined the action. Send the message again to retry.';
  if (/network|ECONNREFUSED|fetch/i.test(error)) return 'Check your network connection and try again.';
  return null;
}

export const ToolExecutionBlock: React.FC<ToolExecutionBlockProps> = ({ tool, onCancel }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const shortSummary = getShortSummary(tool.toolName, tool.args);

  const StatusIcon = () => {
    if (tool.status === 'running') {
      return <Loader2 className="w-4 h-4 text-nexus-cyan animate-spin" />;
    }
    if (tool.status === 'error') {
      return <X className="w-4 h-4 text-red-400" />;
    }
    return <Check className="w-4 h-4 text-nexus-emerald" />;
  };

  const borderColor =
    tool.status === 'error'
      ? 'border-red-500/30'
      : tool.status === 'complete'
        ? 'border-nexus-emerald/30'
        : 'border-nexus-cyan/30';

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border bg-white/5 overflow-hidden ${borderColor}`}
    >
      <div className="w-full flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setIsExpanded((e) => !e)}
          className="flex-1 flex items-center gap-3 text-left hover:bg-white/5 transition-colors min-w-0"
        >
          <StatusIcon />
          <Terminal className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-medium text-slate-200">
              {tool.toolName === 'request_extra_context' && tool.statusMessage
                ? tool.statusMessage
                : tool.toolName}
            </span>
            {shortSummary && !(tool.toolName === 'request_extra_context' && tool.statusMessage) && (
              <span className="text-slate-500 font-mono text-sm ml-2 truncate block sm:inline">
                — {shortSummary}
              </span>
            )}
            {tool.status === 'running' && TOOLS_REQUIRING_CONFIRMATION.has(tool.toolName) && (
              <span className="text-slate-500 text-xs ml-2 block sm:inline">(approval may be required)</span>
            )}
          </div>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
          )}
        </button>
        {tool.status === 'running' && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            title="Cancel execution"
            className="flex-shrink-0 p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Square className="w-4 h-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-white/10 overflow-hidden"
          >
            <div className="px-4 py-3 space-y-3 font-mono text-xs">
              {tool.args && (
                <div>
                  <div className="text-slate-500 mb-1">Input</div>
                  <pre className="p-2 rounded-lg bg-black/20 text-slate-300 overflow-x-auto whitespace-pre-wrap break-all">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(tool.args), null, 2);
                      } catch {
                        return tool.args;
                      }
                    })()}
                  </pre>
                </div>
              )}
              {tool.status === 'complete' && tool.result !== undefined && (
                <div>
                  <div className="text-slate-500 mb-1">Output</div>
                  <pre className="p-2 rounded-lg bg-black/20 text-slate-300 overflow-x-auto whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                    {formatResult(tool.result)}
                  </pre>
                </div>
              )}
              {tool.status === 'error' && tool.error && (
                <div>
                  <div className="text-red-400 mb-1">Error</div>
                  <pre className="p-2 rounded-lg bg-red-500/10 text-red-300 overflow-x-auto whitespace-pre-wrap break-all">
                    {tool.error}
                  </pre>
                  {getErrorSuggestion(tool.error) && (
                    <p className="text-slate-400 text-xs mt-2">{getErrorSuggestion(tool.error)}</p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ToolExecutionBlock;
