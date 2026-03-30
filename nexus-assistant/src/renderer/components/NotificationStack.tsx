// =============================================================================
// NEXUS - NotificationStack
// Stack of proactive suggestions/notifications in sidebar
// =============================================================================

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lightbulb,
  Bell,
  HelpCircle,
  MessageCircle,
  GitBranch,
  Clock,
  Play,
} from 'lucide-react';
import type { ProactiveSuggestion } from '../../shared/types';

const typeIcons: Record<string, React.ReactNode> = {
  reminder: <Bell className="w-4 h-4" />,
  insight: <Lightbulb className="w-4 h-4" />,
  help: <HelpCircle className="w-4 h-4" />,
  question: <MessageCircle className="w-4 h-4" />,
  workflow: <GitBranch className="w-4 h-4" />,
};

const priorityColors: Record<string, string> = {
  low: 'border-slate-500/30 bg-slate-500/5',
  medium: 'border-nexus-cyan/30 bg-nexus-cyan/5',
  high: 'border-nexus-violet/30 bg-nexus-violet/5',
};

interface NotificationStackProps {
  suggestions: ProactiveSuggestion[];
  onExecute: (s: ProactiveSuggestion) => void;
  onChat: (s: ProactiveSuggestion) => void;
  onSnooze: (id: string) => void;
  onDismiss: (id: string) => void;
}

export const NotificationStack: React.FC<NotificationStackProps> = ({
  suggestions,
  onExecute,
  onChat,
  onSnooze,
  onDismiss,
}) => {
  const active = suggestions.filter((s) => !s.dismissed && (!s.snoozedUntil || s.snoozedUntil < Date.now()));

  if (active.length === 0) return null;

  return (
    <div className="space-y-2 px-3 pb-2">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-400 uppercase tracking-wider">
        <Lightbulb className="w-3 h-3" />
        Suggestions
      </div>
      <AnimatePresence mode="popLayout">
        {active.slice(0, 5).map((suggestion) => (
          <motion.div
            key={suggestion.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className={`p-3 rounded-lg border ${priorityColors[suggestion.priority]} transition-colors`}
          >
            <div className="flex items-start gap-2 mb-2">
              <div className="text-nexus-cyan shrink-0">
                {typeIcons[suggestion.type] || <Lightbulb className="w-4 h-4" />}
              </div>
              <span className="text-sm font-medium text-slate-200 line-clamp-1">{suggestion.title}</span>
            </div>
            <p className="text-xs text-slate-400 mb-3 line-clamp-3">{suggestion.content}</p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onExecute(suggestion)}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-nexus-cyan/10 text-nexus-cyan text-xs hover:bg-nexus-cyan/20 transition-colors"
              >
                <Play className="w-3 h-3" />
                <span>Do it</span>
              </button>
              <button
                onClick={() => onChat(suggestion)}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md bg-nexus-cyan/10 text-nexus-cyan text-xs hover:bg-nexus-cyan/20 transition-colors"
              >
                <MessageCircle className="w-3 h-3" />
                <span>Discuss</span>
              </button>
              <button
                onClick={() => onSnooze(suggestion.id)}
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
                title="Snooze 30 min"
              >
                <Clock className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDismiss(suggestion.id)}
                className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="Dismiss"
              >
                <span className="text-xs">×</span>
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
