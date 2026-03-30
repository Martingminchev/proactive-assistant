// =============================================================================
// NEXUS - Code Diff Preview
// Shows before/after or new content for file write/edit confirmation
// =============================================================================

import React from 'react';

interface CodeDiffPreviewProps {
  /** For edit_file: lines to remove (search) */
  oldText?: string;
  /** For edit_file: replacement lines, or for write_file: full new content */
  newText: string;
  /** Label for old block (e.g. "Remove") */
  oldLabel?: string;
  /** Label for new block (e.g. "Add" or "New content") */
  newLabel?: string;
  /** Max height in pixels */
  maxHeight?: number;
}

function splitLines(s: string): string[] {
  return s.split(/\r?\n/);
}

export const CodeDiffPreview: React.FC<CodeDiffPreviewProps> = ({
  oldText,
  newText,
  oldLabel = 'Before',
  newLabel = 'After',
  maxHeight = 200,
}) => {
  const hasOld = oldText !== undefined && oldText.length > 0;

  if (!hasOld) {
    const lines = splitLines(newText);
    const display = lines.length > 30 ? lines.slice(0, 30).join('\n') + '\n...' : newText;
    return (
      <div className="rounded-lg border border-white/10 overflow-hidden bg-black/30">
        <div className="px-2 py-1.5 text-xs font-medium text-slate-500 border-b border-white/10">
          {newLabel}
        </div>
        <pre
          className="p-3 text-xs font-mono text-slate-300 whitespace-pre-wrap break-words overflow-x-auto overflow-y-auto"
          style={{ maxHeight }}
        >
          {display}
        </pre>
      </div>
    );
  }

  const oldLines = splitLines(oldText);
  const newLines = splitLines(newText);

  return (
    <div className="rounded-lg border border-white/10 overflow-hidden bg-black/30 space-y-2">
      <div className="grid grid-cols-2 gap-px bg-white/10">
        <div className="min-w-0">
          <div className="px-2 py-1.5 text-xs font-medium text-red-400/90 bg-red-500/10 border-b border-red-500/20">
            {oldLabel}
          </div>
          <pre
            className="p-3 text-xs font-mono text-red-300/90 whitespace-pre-wrap break-words overflow-x-auto overflow-y-auto"
            style={{ maxHeight }}
          >
            {oldLines.length > 25 ? oldLines.slice(0, 25).join('\n') + '\n...' : oldText}
          </pre>
        </div>
        <div className="min-w-0">
          <div className="px-2 py-1.5 text-xs font-medium text-nexus-emerald/90 bg-nexus-emerald/10 border-b border-nexus-emerald/20">
            {newLabel}
          </div>
          <pre
            className="p-3 text-xs font-mono text-nexus-emerald/90 whitespace-pre-wrap break-words overflow-x-auto overflow-y-auto"
            style={{ maxHeight }}
          >
            {newLines.length > 25 ? newLines.slice(0, 25).join('\n') + '\n...' : newText}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default CodeDiffPreview;
