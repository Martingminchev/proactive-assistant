// =============================================================================
// NEXUS - Quick Actions Panel
// Context-aware action buttons for the sidebar
// =============================================================================

import React from 'react';
import { 
  Camera, Sparkles, Lightbulb, Bug, Zap, 
  Search, Play, FileSearch, GitBranch, GitCompare,
  Terminal, FileText, Link, Braces
} from 'lucide-react';
import type { QuickActionDefinition } from '../../shared/types';

const ICON_MAP: Record<string, React.ReactNode> = {
  Camera: <Camera className="w-4 h-4" />,
  Sparkles: <Sparkles className="w-4 h-4" />,
  Lightbulb: <Lightbulb className="w-4 h-4" />,
  Bug: <Bug className="w-4 h-4" />,
  Zap: <Zap className="w-4 h-4" />,
  Search: <Search className="w-4 h-4" />,
  Play: <Play className="w-4 h-4" />,
  FileSearch: <FileSearch className="w-4 h-4" />,
  GitBranch: <GitBranch className="w-4 h-4" />,
  GitCompare: <GitCompare className="w-4 h-4" />,
  Terminal: <Terminal className="w-4 h-4" />,
  FileText: <FileText className="w-4 h-4" />,
  Link: <Link className="w-4 h-4" />,
  Braces: <Braces className="w-4 h-4" />,
};

interface QuickActionsPanelProps {
  actions: QuickActionDefinition[];
  onAction: (handler: string) => void;
}

export const QuickActionsPanel: React.FC<QuickActionsPanelProps> = ({ actions, onAction }) => {
  if (actions.length === 0) return null;

  return (
    <div className="px-3 pb-2">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
        <Zap className="w-3 h-3" />
        Quick Actions
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => onAction(action.handler)}
            className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-white/5 border border-white/10
              text-slate-300 hover:bg-white/10 hover:border-nexus-cyan/30 hover:text-nexus-cyan
              transition-all duration-200 text-xs"
          >
            {ICON_MAP[action.icon] || <Zap className="w-4 h-4" />}
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
