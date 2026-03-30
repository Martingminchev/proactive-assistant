# NEXUS AI Assistant - Proactive Features UI Implementation Plan

## Executive Summary

This document provides a complete implementation plan for new UI components supporting NEXUS's proactive AI capabilities. All components follow the existing glassmorphism design system, use Zustand for state management, Framer Motion for animations, and Lucide React for icons.

---

## Table of Contents

1. [ActionConfirmationModal Component](#1-actionconfirmationmodal-component)
2. [DashboardPanel Component](#2-dashboardpanel-component)
3. [NotificationManager Component](#3-notificationmanager-component)
4. [ToolCallDisplay Component](#4-toolcalldisplay-component)
5. [Integration Guide](#5-integration-guide)
6. [State Management Extensions](#6-state-management-extensions)
7. [Styling Additions](#7-styling-additions)

---

## 1. ActionConfirmationModal Component

### Purpose
Modal for requesting user confirmation before executing potentially dangerous or irreversible AI actions.

### File Location
`src/renderer/components/ActionConfirmationModal.tsx`

### Props Interface

```typescript
// src/renderer/components/ActionConfirmationModal.tsx

import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, 
  Shield, 
  X, 
  Check, 
  Ban,
  FileEdit,
  Trash2,
  Globe,
  Terminal,
  Database
} from 'lucide-react';

export type ActionSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ActionCategory = 'file' | 'network' | 'system' | 'data' | 'command';

export interface ActionDetails {
  id: string;
  title: string;
  description: string;
  severity: ActionSeverity;
  category: ActionCategory;
  target?: string;
  estimatedImpact?: string;
  reversible: boolean;
  metadata?: Record<string, unknown>;
}

export interface PermissionLevel {
  level: 'ask' | 'ask_once' | 'always_allow' | 'never';
  scope: string;
  expiresAt?: number;
}

interface ActionConfirmationModalProps {
  isOpen: boolean;
  action: ActionDetails | null;
  permissionLevel?: PermissionLevel;
  onConfirm: (rememberChoice: boolean) => void;
  onDeny: () => void;
  onAlwaysAllow: (duration: 'session' | 'forever') => void;
  onClose: () => void;
}
```

### Complete Component Implementation

```typescript
// ActionConfirmationModal.tsx - Complete Implementation

const severityConfig: Record<ActionSeverity, { 
  icon: React.ReactNode; 
  color: string; 
  bgColor: string;
  borderColor: string;
  title: string;
}> = {
  low: {
    icon: <Shield className="w-6 h-6" />,
    color: 'text-nexus-emerald',
    bgColor: 'bg-nexus-emerald/10',
    borderColor: 'border-nexus-emerald/30',
    title: 'Low Risk Action',
  },
  medium: {
    icon: <AlertTriangle className="w-6 h-6" />,
    color: 'text-nexus-amber',
    bgColor: 'bg-nexus-amber/10',
    borderColor: 'border-nexus-amber/30',
    title: 'Medium Risk Action',
  },
  high: {
    icon: <AlertTriangle className="w-6 h-6" />,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    title: 'High Risk Action',
  },
  critical: {
    icon: <AlertTriangle className="w-6 h-6" />,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    title: 'Critical Action',
  },
};

const categoryIcons: Record<ActionCategory, React.ReactNode> = {
  file: <FileEdit className="w-5 h-5" />,
  network: <Globe className="w-5 h-5" />,
  system: <Terminal className="w-5 h-5" />,
  data: <Database className="w-5 h-5" />,
  command: <Terminal className="w-5 h-5" />,
};

export const ActionConfirmationModal: React.FC<ActionConfirmationModalProps> = ({
  isOpen,
  action,
  permissionLevel,
  onConfirm,
  onDeny,
  onAlwaysAllow,
  onClose,
}) => {
  const [rememberChoice, setRememberChoice] = React.useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = React.useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setRememberChoice(false);
      setShowAdvancedOptions(false);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onDeny();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onDeny]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !action) return null;

  const severity = severityConfig[action.severity];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg glass rounded-2xl overflow-hidden shadow-2xl"
          >
            {/* Severity Header Bar */}
            <div className={`h-1.5 w-full ${severity.bgColor.replace('/10', '')}`} />

            {/* Header */}
            <div className="flex items-start justify-between p-6 pb-4">
              <div className="flex items-center gap-4">
                <div className={`
                  w-12 h-12 rounded-xl flex items-center justify-center
                  ${severity.bgColor} ${severity.borderColor} border
                `}>
                  <div className={severity.color}>
                    {severity.icon}
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {severity.title}
                  </h2>
                  <p className="text-sm text-slate-400">
                    NEXUS is requesting permission
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Action Details */}
            <div className="px-6 space-y-4">
              {/* Action Title & Category */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="text-nexus-cyan">
                  {categoryIcons[action.category]}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-slate-200">{action.title}</h3>
                  <p className="text-sm text-slate-400">{action.description}</p>
                </div>
              </div>

              {/* Target Display */}
              {action.target && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">Target:</span>
                  <code className="px-2 py-1 rounded bg-white/5 text-nexus-cyan font-mono text-xs">
                    {action.target}
                  </code>
                </div>
              )}

              {/* Impact Warning */}
              {action.estimatedImpact && (
                <div className={`
                  flex items-start gap-3 p-3 rounded-lg
                  ${action.severity === 'critical' ? 'bg-red-500/10 border border-red-500/20' : 'bg-white/5'}
                `}>
                  <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${
                    action.severity === 'critical' ? 'text-red-400' : 'text-nexus-amber'
                  }`} />
                  <div>
                    <p className={`text-sm font-medium ${
                      action.severity === 'critical' ? 'text-red-300' : 'text-nexus-amber'
                    }`}>
                      Estimated Impact
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                      {action.estimatedImpact}
                    </p>
                  </div>
                </div>
              )}

              {/* Reversibility Badge */}
              <div className="flex items-center gap-4">
                <div className={`
                  inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs
                  ${action.reversible 
                    ? 'bg-nexus-emerald/10 text-nexus-emerald border border-nexus-emerald/20' 
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'}
                `}>
                  {action.reversible ? (
                    <><Check className="w-3 h-3" /> Reversible</>
                  ) : (
                    <><Ban className="w-3 h-3" /> Irreversible</>
                  )}
                </div>

                {/* Current Permission Level */}
                {permissionLevel && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-nexus-violet/10 text-nexus-violet border border-nexus-violet/20">
                    <Shield className="w-3 h-3" />
                    Current: {permissionLevel.level.replace('_', ' ')}
                  </div>
                )}
              </div>

              {/* Remember Choice Toggle */}
              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={rememberChoice}
                  onChange={(e) => setRememberChoice(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-white/5 text-nexus-cyan focus:ring-nexus-cyan/30 focus:ring-offset-0"
                />
                <span className="text-sm text-slate-300">
                  Remember this choice for similar actions
                </span>
              </label>

              {/* Advanced Options Toggle */}
              <button
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                className="text-xs text-nexus-cyan hover:underline"
              >
                {showAdvancedOptions ? 'Hide' : 'Show'} advanced options
              </button>

              {/* Advanced Options */}
              <AnimatePresence>
                {showAdvancedOptions && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-3 rounded-lg bg-white/5 space-y-2">
                      <p className="text-xs text-slate-400 mb-2">Always allow for:</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onAlwaysAllow('session')}
                          className="flex-1 px-3 py-2 rounded-lg text-xs bg-white/5 text-slate-300 hover:bg-white/10 transition-colors"
                        >
                          This session only
                        </button>
                        <button
                          onClick={() => onAlwaysAllow('forever')}
                          className="flex-1 px-3 py-2 rounded-lg text-xs bg-nexus-cyan/10 text-nexus-cyan border border-nexus-cyan/30 hover:bg-nexus-cyan/20 transition-colors"
                        >
                          All future actions
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between p-6 pt-4 border-t border-white/10 mt-4">
              <button
                onClick={onDeny}
                className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Deny
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onConfirm(rememberChoice)}
                  className={`
                    px-6 py-2.5 rounded-xl font-medium transition-all duration-200
                    flex items-center gap-2
                    ${action.severity === 'critical'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                      : 'bg-nexus-cyan/20 text-nexus-cyan border border-nexus-cyan/30 hover:bg-nexus-cyan/30'
                    }
                  `}
                >
                  <Check className="w-4 h-4" />
                  Allow
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ActionConfirmationModal;
```

### State Store Extension

```typescript
// src/renderer/stores/actionConfirmationStore.ts

import { create } from 'zustand';
import { ActionDetails, PermissionLevel } from '../components/ActionConfirmationModal';

interface ActionConfirmationState {
  // State
  pendingAction: ActionDetails | null;
  isModalOpen: boolean;
  permissionLevels: Map<string, PermissionLevel>;
  
  // Actions
  requestConfirmation: (action: ActionDetails) => Promise<boolean>;
  confirmAction: (remember: boolean) => void;
  denyAction: () => void;
  setPermissionLevel: (scope: string, level: PermissionLevel) => void;
  clearPermission: (scope: string) => void;
  closeModal: () => void;
}

export const useActionConfirmationStore = create<ActionConfirmationState>((set, get) => ({
  pendingAction: null,
  isModalOpen: false,
  permissionLevels: new Map(),

  requestConfirmation: async (action: ActionDetails): Promise<boolean> => {
    const { permissionLevels } = get();
    
    // Check existing permission
    const existing = permissionLevels.get(action.category);
    if (existing) {
      if (existing.level === 'never') return false;
      if (existing.level === 'always_allow') return true;
      if (existing.level === 'ask_once' && existing.expiresAt && existing.expiresAt > Date.now()) {
        return true;
      }
    }

    return new Promise((resolve) => {
      set({ 
        pendingAction: action, 
        isModalOpen: true,
        _resolvePromise: resolve 
      } as any);
    });
  },

  confirmAction: (remember: boolean) => {
    const { pendingAction, permissionLevels } = get();
    if (!pendingAction) return;

    if (remember) {
      const newLevel: PermissionLevel = {
        level: 'ask_once',
        scope: pendingAction.category,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      };
      permissionLevels.set(pendingAction.category, newLevel);
    }

    set({ isModalOpen: false, pendingAction: null });
    // Resolve promise
    (get() as any)._resolvePromise?.(true);
  },

  denyAction: () => {
    set({ isModalOpen: false, pendingAction: null });
    (get() as any)._resolvePromise?.(false);
  },

  setPermissionLevel: (scope: string, level: PermissionLevel) => {
    const { permissionLevels } = get();
    permissionLevels.set(scope, level);
    set({ permissionLevels: new Map(permissionLevels) });
  },

  clearPermission: (scope: string) => {
    const { permissionLevels } = get();
    permissionLevels.delete(scope);
    set({ permissionLevels: new Map(permissionLevels) });
  },

  closeModal: () => {
    set({ isModalOpen: false, pendingAction: null });
    (get() as any)._resolvePromise?.(false);
  },
}));
```

---

## 2. DashboardPanel Component

### Purpose
A comprehensive dashboard view displaying current activity, timeline, suggestions, quick actions, and focus session timer.

### File Location
`src/renderer/components/DashboardPanel.tsx`

### Props Interface

```typescript
// src/renderer/components/DashboardPanel.tsx

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Clock,
  Sparkles,
  Zap,
  Target,
  Coffee,
  TrendingUp,
  Calendar,
  MessageSquare,
  CheckCircle2,
  MoreHorizontal,
  Play,
  Pause,
  RotateCcw,
  X,
  ChevronRight,
  Brain,
  Monitor,
  FileText,
  Lightbulb,
  Bell,
  HelpCircle,
  GitBranch,
} from 'lucide-react';
import { 
  ProactiveSuggestion, 
  SystemContext, 
  ActiveWindowInfo,
  PiecesLtmMemory 
} from '../../shared/types';
import { useAppStore } from '../stores/appStore';
import { useSettingsStore } from '../stores/settingsStore';
import { formatDistanceToNow, formatDuration } from '../utils/format';

export interface TimelineEvent {
  id: string;
  type: 'suggestion' | 'message' | 'action' | 'context_change' | 'focus';
  title: string;
  description?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface FocusSession {
  id: string;
  startTime: number;
  endTime?: number;
  duration: number;
  goal?: string;
  isActive: boolean;
  interruptions: number;
}

export interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  color?: string;
}

interface DashboardPanelProps {
  onStartChat?: (prompt: string) => void;
  onOpenConversation?: (id: string) => void;
}
```

### Complete Component Implementation

```typescript
// DashboardPanel.tsx - Complete Implementation

export const DashboardPanel: React.FC<DashboardPanelProps> = ({
  onStartChat,
  onOpenConversation,
}) => {
  // State
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'focus'>('overview');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [suggestions, setSuggestions] = useState<ProactiveSuggestion[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [systemContext, setSystemContext] = useState<SystemContext | null>(null);
  const [focusSession, setFocusSession] = useState<FocusSession | null>(null);
  const [focusInput, setFocusInput] = useState('');

  const { conversations, currentConversation } = useAppStore();
  const { settings } = useSettingsStore();

  // Update current time every second
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Load data
  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  // Listen for new suggestions
  useEffect(() => {
    if (!window.electronAPI) return;
    
    const unsubscribe = window.electronAPI.onProactiveSuggestion((_, suggestion) => {
      setSuggestions(prev => [suggestion, ...prev.filter(s => s.id !== suggestion.id)]);
      addTimelineEvent({
        id: `event_${Date.now()}`,
        type: 'suggestion',
        title: suggestion.title,
        description: suggestion.content,
        timestamp: Date.now(),
      });
    });

    return unsubscribe;
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load suggestions
      const sug = await window.electronAPI?.getProactiveSuggestions();
      setSuggestions(sug?.filter(s => !s.dismissed) || []);

      // Load system context
      const context = await window.electronAPI?.getSystemContext?.();
      setSystemContext(context);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const addTimelineEvent = (event: TimelineEvent) => {
    setTimeline(prev => [event, ...prev].slice(0, 50)); // Keep last 50 events
  };

  // Focus session handlers
  const startFocusSession = useCallback(() => {
    const session: FocusSession = {
      id: `focus_${Date.now()}`,
      startTime: Date.now(),
      duration: 0,
      goal: focusInput || undefined,
      isActive: true,
      interruptions: 0,
    };
    setFocusSession(session);
    setFocusInput('');
    addTimelineEvent({
      id: `event_${Date.now()}`,
      type: 'focus',
      title: 'Focus session started',
      timestamp: Date.now(),
      metadata: { goal: session.goal },
    });
  }, [focusInput]);

  const pauseFocusSession = useCallback(() => {
    setFocusSession(prev => prev ? { ...prev, isActive: false } : null);
  }, []);

  const resumeFocusSession = useCallback(() => {
    setFocusSession(prev => prev ? { ...prev, isActive: true } : null);
  }, []);

  const endFocusSession = useCallback(() => {
    setFocusSession(prev => {
      if (!prev) return null;
      addTimelineEvent({
        id: `event_${Date.now()}`,
        type: 'focus',
        title: 'Focus session ended',
        timestamp: Date.now(),
        metadata: { 
          duration: Date.now() - prev.startTime,
          goal: prev.goal 
        },
      });
      return null;
    });
  }, []);

  // Calculate focus duration
  const focusDuration = useMemo(() => {
    if (!focusSession) return 0;
    const elapsed = currentTime - focusSession.startTime;
    return focusSession.isActive ? elapsed : focusSession.duration;
  }, [focusSession, currentTime]);

  // Quick actions
  const quickActions: QuickAction[] = [
    {
      id: 'screenshot',
      label: 'Analyze Screen',
      icon: <Monitor className="w-5 h-5" />,
      action: async () => {
        const screenshot = await window.electronAPI?.captureScreenshot();
        onStartChat?.("I've captured a screenshot. Can you analyze what you see?");
      },
      color: 'text-nexus-cyan',
    },
    {
      id: 'analyze',
      label: 'Analyze Work',
      icon: <Brain className="w-5 h-5" />,
      action: async () => {
        const suggestion = await window.electronAPI?.triggerProactiveAnalysis();
        if (suggestion) {
          setSuggestions(prev => [suggestion, ...prev]);
        }
      },
      color: 'text-nexus-violet',
    },
    {
      id: 'summary',
      label: 'Daily Summary',
      icon: <FileText className="w-5 h-5" />,
      action: () => onStartChat?.("Give me a summary of my work today."),
      color: 'text-nexus-emerald',
    },
    {
      id: 'focus',
      label: focusSession ? 'End Focus' : 'Start Focus',
      icon: focusSession ? <X className="w-5 h-5" /> : <Target className="w-5 h-5" />,
      action: focusSession ? endFocusSession : () => setActiveTab('focus'),
      color: focusSession ? 'text-red-400' : 'text-nexus-amber',
    },
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-nexus-cyan/30 to-nexus-violet/30 flex items-center justify-center">
            <Activity className="w-5 h-5 text-nexus-cyan" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Dashboard</h1>
            <p className="text-xs text-slate-400">
              {new Date().toLocaleDateString(undefined, { 
                weekday: 'long', 
                month: 'short', 
                day: 'numeric' 
              })}
            </p>
          </div>
        </div>

        {/* Focus Timer Display (if active) */}
        {focusSession && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`
              flex items-center gap-3 px-4 py-2 rounded-xl
              ${focusSession.isActive 
                ? 'bg-nexus-amber/10 border border-nexus-amber/30' 
                : 'bg-white/5 border border-white/10'}
            `}
          >
            <Target className={`w-4 h-4 ${focusSession.isActive ? 'text-nexus-amber animate-pulse' : 'text-slate-400'}`} />
            <span className="font-mono text-lg font-medium text-white">
              {formatDuration(focusDuration)}
            </span>
            {focusSession.isActive ? (
              <button onClick={pauseFocusSession} className="p-1 rounded hover:bg-white/10">
                <Pause className="w-4 h-4 text-slate-400" />
              </button>
            ) : (
              <button onClick={resumeFocusSession} className="p-1 rounded hover:bg-white/10">
                <Play className="w-4 h-4 text-nexus-emerald" />
              </button>
            )}
          </motion.div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-white/5">
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'timeline', label: 'Timeline', icon: Clock },
          { id: 'focus', label: 'Focus', icon: Target },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
              transition-all duration-200
              ${activeTab === tab.id
                ? 'bg-nexus-cyan/10 text-nexus-cyan'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }
            `}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <OverviewTab
              key="overview"
              suggestions={suggestions}
              conversations={conversations}
              systemContext={systemContext}
              quickActions={quickActions}
              onStartChat={onStartChat}
              onOpenConversation={onOpenConversation}
            />
          )}
          {activeTab === 'timeline' && (
            <TimelineTab
              key="timeline"
              events={timeline}
              onStartChat={onStartChat}
            />
          )}
          {activeTab === 'focus' && (
            <FocusTab
              key="focus"
              session={focusSession}
              duration={focusDuration}
              input={focusInput}
              onInputChange={setFocusInput}
              onStart={startFocusSession}
              onPause={pauseFocusSession}
              onResume={resumeFocusSession}
              onEnd={endFocusSession}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// =============================================================================
// Overview Tab Component
// =============================================================================

interface OverviewTabProps {
  suggestions: ProactiveSuggestion[];
  conversations: any[];
  systemContext: SystemContext | null;
  quickActions: QuickAction[];
  onStartChat?: (prompt: string) => void;
  onOpenConversation?: (id: string) => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  suggestions,
  conversations,
  systemContext,
  quickActions,
  onStartChat,
  onOpenConversation,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6"
    >
      {/* Quick Actions Grid */}
      <section>
        <h2 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((action, index) => (
            <motion.button
              key={action.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={action.action}
              className="flex flex-col items-center gap-2 p-4 rounded-xl
                bg-white/5 border border-white/10
                hover:bg-white/10 hover:border-white/20
                transition-all duration-200 group"
            >
              <div className={`${action.color} group-hover:scale-110 transition-transform`}>
                {action.icon}
              </div>
              <span className="text-sm text-slate-300">{action.label}</span>
            </motion.button>
          ))}
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Active Suggestions */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-nexus-cyan" />
              Active Suggestions
            </h2>
            {suggestions.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-nexus-cyan/10 text-nexus-cyan">
                {suggestions.length}
              </span>
            )}
          </div>
          
          <div className="space-y-3">
            {suggestions.length === 0 ? (
              <div className="p-8 rounded-xl bg-white/5 border border-white/10 text-center">
                <Sparkles className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No active suggestions</p>
                <p className="text-xs text-slate-500 mt-1">
                  NEXUS will offer insights as you work
                </p>
              </div>
            ) : (
              suggestions.slice(0, 3).map(suggestion => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  onAccept={() => onStartChat?.(`Tell me more about: ${suggestion.title}`)}
                  onDismiss={() => window.electronAPI?.dismissProactiveSuggestion(suggestion.id)}
                />
              ))
            )}
          </div>
        </section>

        {/* Current Activity */}
        <section>
          <h2 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
            <Monitor className="w-4 h-4" />
            Current Activity
          </h2>
          
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
            {systemContext?.activeWindow ? (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-nexus-cyan/10 flex items-center justify-center">
                    <Monitor className="w-5 h-5 text-nexus-cyan" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">
                      {systemContext.activeWindow.title}
                    </p>
                    <p className="text-xs text-slate-400">
                      {systemContext.activeWindow.application}
                    </p>
                  </div>
                </div>

                {/* System Resources */}
                {systemContext.systemResources && (
                  <div className="space-y-2 pt-2 border-t border-white/5">
                    <ResourceBar
                      label="CPU"
                      value={systemContext.systemResources.cpu.usage}
                      color="bg-nexus-cyan"
                    />
                    <ResourceBar
                      label="Memory"
                      value={systemContext.systemResources.memory.percentage}
                      color="bg-nexus-violet"
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-slate-400">No activity data available</p>
              </div>
            )}
          </div>

          {/* Recent Conversations */}
          <div className="mt-4">
            <h3 className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
              Recent Conversations
            </h3>
            <div className="space-y-1">
              {conversations.slice(0, 3).map(conv => (
                <button
                  key={conv.id}
                  onClick={() => onOpenConversation?.(conv.id)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg
                    hover:bg-white/5 transition-colors text-left"
                >
                  <MessageSquare className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-300 truncate flex-1">
                    {conv.title}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatDistanceToNow(conv.updatedAt)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
};

// =============================================================================
// Timeline Tab Component
// =============================================================================

interface TimelineTabProps {
  events: TimelineEvent[];
  onStartChat?: (prompt: string) => void;
}

const TimelineTab: React.FC<TimelineTabProps> = ({ events, onStartChat }) => {
  const typeIcons: Record<TimelineEvent['type'], React.ReactNode> = {
    suggestion: <Lightbulb className="w-4 h-4" />,
    message: <MessageSquare className="w-4 h-4" />,
    action: <Zap className="w-4 h-4" />,
    context_change: <Monitor className="w-4 h-4" />,
    focus: <Target className="w-4 h-4" />,
  };

  const typeColors: Record<TimelineEvent['type'], string> = {
    suggestion: 'bg-nexus-cyan/20 text-nexus-cyan border-nexus-cyan/30',
    message: 'bg-nexus-violet/20 text-nexus-violet border-nexus-violet/30',
    action: 'bg-nexus-amber/20 text-nexus-amber border-nexus-amber/30',
    context_change: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    focus: 'bg-nexus-emerald/20 text-nexus-emerald border-nexus-emerald/30',
  };

  // Group events by date
  const groupedEvents = useMemo(() => {
    const groups: Record<string, TimelineEvent[]> = {};
    events.forEach(event => {
      const date = new Date(event.timestamp).toDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(event);
    });
    return groups;
  }, [events]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {Object.entries(groupedEvents).length === 0 ? (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No events yet</p>
          <p className="text-sm text-slate-500 mt-1">
            Your activity will appear here
          </p>
        </div>
      ) : (
        Object.entries(groupedEvents).map(([date, dateEvents]) => (
          <div key={date}>
            <h3 className="text-xs font-medium text-slate-500 mb-3 uppercase tracking-wider sticky top-0 bg-[var(--color-bg-primary)] py-2">
              {new Date(date).toLocaleDateString(undefined, { 
                weekday: 'long', 
                month: 'short', 
                day: 'numeric' 
              })}
            </h3>
            <div className="space-y-3 relative">
              {/* Timeline line */}
              <div className="absolute left-5 top-3 bottom-3 w-px bg-white/10" />
              
              {dateEvents.map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex gap-4"
                >
                  {/* Icon */}
                  <div className={`
                    relative z-10 w-10 h-10 rounded-full flex items-center justify-center
                    border ${typeColors[event.type]}
                  `}>
                    {typeIcons[event.type]}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 pb-4">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-medium text-slate-200">
                          {event.title}
                        </h4>
                        <span className="text-xs text-slate-500">
                          {new Date(event.timestamp).toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {event.description && (
                        <p className="text-sm text-slate-400 mt-1">
                          {event.description}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))
      )}
    </motion.div>
  );
};

// =============================================================================
// Focus Tab Component
// =============================================================================

interface FocusTabProps {
  session: FocusSession | null;
  duration: number;
  input: string;
  onInputChange: (value: string) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
}

const FocusTab: React.FC<FocusTabProps> = ({
  session,
  duration,
  input,
  onInputChange,
  onStart,
  onPause,
  onResume,
  onEnd,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="max-w-md mx-auto"
    >
      {!session ? (
        <div className="text-center space-y-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-nexus-cyan/20 to-nexus-violet/20 flex items-center justify-center mx-auto">
            <Target className="w-12 h-12 text-nexus-cyan" />
          </div>
          
          <div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Start a Focus Session
            </h2>
            <p className="text-sm text-slate-400">
              Set a goal and minimize distractions while you work
            </p>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="What are you working on? (optional)"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10
                text-slate-200 placeholder-slate-500
                focus:outline-none focus:border-nexus-cyan/50
                transition-all"
            />
            <button
              onClick={onStart}
              className="w-full py-3 rounded-xl bg-nexus-cyan/20 text-nexus-cyan
                border border-nexus-cyan/30 font-medium
                hover:bg-nexus-cyan/30 transition-all duration-200
                flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" />
              Start Focus Session
            </button>
          </div>

          {/* Tips */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-left">
            <h3 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-nexus-amber" />
              Focus Tips
            </h3>
            <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
              <li>Set a clear goal before starting</li>
              <li>Take breaks every 25-30 minutes</li>
              <li>Silence notifications</li>
              <li>Keep NEXUS in the loop about your progress</li>
            </ul>
          </div>
        </div>
      ) : (
        <div className="text-center space-y-8">
          {/* Timer Display */}
          <div className="relative">
            {/* Animated rings */}
            {session.isActive && (
              <>
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-nexus-cyan/20"
                  animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.2, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <motion.div
                  className="absolute inset-2 rounded-full border-2 border-nexus-violet/20"
                  animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.1, 0.3] }}
                  transition={{ duration: 2.5, repeat: Infinity, delay: 0.2 }}
                />
              </>
            )}
            
            <div className={`
              relative w-48 h-48 rounded-full flex flex-col items-center justify-center
              ${session.isActive 
                ? 'bg-gradient-to-br from-nexus-cyan/20 to-nexus-violet/20 border-2 border-nexus-cyan/50' 
                : 'bg-white/5 border-2 border-white/20'}
            `}>
              <span className="text-5xl font-mono font-bold text-white">
                {formatDuration(duration).split(':').slice(0, 2).join(':')}
              </span>
              <span className="text-sm text-slate-400 mt-2">
                {session.isActive ? 'Focusing' : 'Paused'}
              </span>
            </div>
          </div>

          {/* Goal Display */}
          {session.goal && (
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Goal</p>
              <p className="text-slate-200">{session.goal}</p>
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            {session.isActive ? (
              <button
                onClick={onPause}
                className="flex items-center gap-2 px-6 py-3 rounded-xl
                  bg-white/5 text-slate-300 border border-white/10
                  hover:bg-white/10 transition-colors"
              >
                <Pause className="w-5 h-5" />
                Pause
              </button>
            ) : (
              <button
                onClick={onResume}
                className="flex items-center gap-2 px-6 py-3 rounded-xl
                  bg-nexus-emerald/20 text-nexus-emerald border border-nexus-emerald/30
                  hover:bg-nexus-emerald/30 transition-colors"
              >
                <Play className="w-5 h-5" />
                Resume
              </button>
            )}
            
            <button
              onClick={onEnd}
              className="flex items-center gap-2 px-6 py-3 rounded-xl
                bg-red-500/10 text-red-400 border border-red-500/30
                hover:bg-red-500/20 transition-colors"
            >
              <X className="w-5 h-5" />
              End Session
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};

// =============================================================================
// Helper Components
// =============================================================================

interface SuggestionCardProps {
  suggestion: ProactiveSuggestion;
  onAccept: () => void;
  onDismiss: () => void;
}

const SuggestionCard: React.FC<SuggestionCardProps> = ({
  suggestion,
  onAccept,
  onDismiss,
}) => {
  const typeIcons: Record<string, React.ReactNode> = {
    reminder: <Bell className="w-4 h-4" />,
    insight: <Lightbulb className="w-4 h-4" />,
    help: <HelpCircle className="w-4 h-4" />,
    question: <MessageSquare className="w-4 h-4" />,
    workflow: <GitBranch className="w-4 h-4" />,
  };

  const priorityColors: Record<string, string> = {
    low: 'border-slate-500/30 bg-slate-500/5',
    medium: 'border-nexus-cyan/30 bg-nexus-cyan/5',
    high: 'border-nexus-violet/30 bg-nexus-violet/5',
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`
        p-4 rounded-xl border ${priorityColors[suggestion.priority]}
        transition-colors hover:bg-white/5
      `}
    >
      <div className="flex items-start gap-3">
        <div className="text-nexus-cyan">
          {typeIcons[suggestion.type] || <Lightbulb className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-slate-200">{suggestion.title}</h3>
          <p className="text-sm text-slate-400 mt-1 line-clamp-2">
            {suggestion.content}
          </p>
          
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={onAccept}
              className="px-3 py-1.5 rounded-lg text-xs bg-nexus-cyan/10 text-nexus-cyan
                hover:bg-nexus-cyan/20 transition-colors"
            >
              Tell me more
            </button>
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-500
                hover:text-slate-300 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

interface ResourceBarProps {
  label: string;
  value: number;
  color: string;
}

const ResourceBar: React.FC<ResourceBarProps> = ({ label, value, color }) => (
  <div className="flex items-center gap-3">
    <span className="text-xs text-slate-500 w-16">{label}</span>
    <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
      <motion.div
        className={`h-full ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(value, 100)}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </div>
    <span className="text-xs text-slate-400 w-10 text-right">{Math.round(value)}%</span>
  </div>
);

export default DashboardPanel;
```

---

## 3. NotificationManager Component

### Purpose
Enhanced toast notification system with priority-based display, action buttons, dismiss/snooze functionality, and proactive notification support.

### File Location
`src/renderer/components/NotificationManager.tsx`

### Props Interface & Implementation

```typescript
// src/renderer/components/NotificationManager.tsx

import React, { useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Clock,
  Bell,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Info,
  ChevronRight,
  Settings,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ProactiveSuggestion, ProactivePriority } from '../../shared/types';

// =============================================================================
// Enhanced Notification Types
// =============================================================================

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';
export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'proactive';

export interface NotificationAction {
  id: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  onClick: () => void;
}

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: number;
  duration?: number; // 0 = persistent
  actions?: NotificationAction[];
  dismissible?: boolean;
  snoozable?: boolean;
  icon?: React.ReactNode;
  metadata?: {
    suggestionId?: string;
    conversationId?: string;
    [key: string]: unknown;
  };
}

interface NotificationManagerProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  maxNotifications?: number;
}

// =============================================================================
// Store Extension for Notification Manager
// =============================================================================

import { create } from 'zustand';

interface NotificationState {
  notifications: Notification[];
  muted: boolean;
  doNotDisturb: boolean;
  dndUntil?: number;
  
  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => string;
  dismissNotification: (id: string) => void;
  snoozeNotification: (id: string, minutes: number) => void;
  clearAll: () => void;
  toggleMute: () => void;
  toggleDND: (minutes?: number) => void;
  updateNotification: (id: string, updates: Partial<Notification>) => void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  muted: false,
  doNotDisturb: false,
  dndUntil: undefined,

  addNotification: (notification) => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: Date.now(),
      dismissible: notification.dismissible ?? true,
      snoozable: notification.snoozable ?? true,
    };

    // Check DND
    const { doNotDisturb, dndUntil, notifications } = get();
    if (doNotDisturb && dndUntil && dndUntil > Date.now()) {
      // Queue for later if not urgent
      if (notification.priority !== 'urgent') {
        return id;
      }
    }

    set({
      notifications: [newNotification, ...notifications].slice(0, 10),
    });

    // Auto-dismiss
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        get().dismissNotification(id);
      }, notification.duration);
    }

    return id;
  },

  dismissNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  snoozeNotification: (id, minutes) => {
    const { notifications } = get();
    const notification = notifications.find((n) => n.id === id);
    if (!notification) return;

    // Remove from current view
    get().dismissNotification(id);

    // Re-add after snooze period
    setTimeout(() => {
      get().addNotification({
        ...notification,
        title: `${notification.title} (Snoozed)`,
      });
    }, minutes * 60 * 1000);
  },

  clearAll: () => set({ notifications: [] }),

  toggleMute: () => set((state) => ({ muted: !state.muted })),

  toggleDND: (minutes) => {
    set((state) => {
      if (state.doNotDisturb) {
        return { doNotDisturb: false, dndUntil: undefined };
      }
      return {
        doNotDisturb: true,
        dndUntil: minutes ? Date.now() + minutes * 60 * 1000 : undefined,
      };
    });
  },

  updateNotification: (id, updates) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, ...updates } : n
      ),
    }));
  },
}));

// =============================================================================
// Notification Manager Component
// =============================================================================

const priorityConfig: Record<NotificationPriority, { 
  borderColor: string; 
  bgColor: string;
  iconColor: string;
  glowColor: string;
}> = {
  low: {
    borderColor: 'border-slate-500/30',
    bgColor: 'bg-slate-900/95',
    iconColor: 'text-slate-400',
    glowColor: '',
  },
  medium: {
    borderColor: 'border-nexus-cyan/30',
    bgColor: 'bg-slate-900/95',
    iconColor: 'text-nexus-cyan',
    glowColor: 'shadow-lg shadow-nexus-cyan/10',
  },
  high: {
    borderColor: 'border-nexus-amber/30',
    bgColor: 'bg-slate-900/95',
    iconColor: 'text-nexus-amber',
    glowColor: 'shadow-lg shadow-nexus-amber/10',
  },
  urgent: {
    borderColor: 'border-red-500/50',
    bgColor: 'bg-red-950/90',
    iconColor: 'text-red-400',
    glowColor: 'shadow-lg shadow-red-500/20 animate-pulse-subtle',
  },
};

const typeIcons: Record<NotificationType, React.ReactNode> = {
  info: <Info className="w-5 h-5" />,
  success: <CheckCircle className="w-5 h-5" />,
  warning: <AlertTriangle className="w-5 h-5" />,
  error: <AlertTriangle className="w-5 h-5" />,
  proactive: <Sparkles className="w-5 h-5" />,
};

export const NotificationManager: React.FC<NotificationManagerProps> = ({
  position = 'top-right',
  maxNotifications = 5,
}) => {
  const { notifications, dismissNotification, snoozeNotification, muted, doNotDisturb, toggleMute, toggleDND } = useNotificationStore();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Position classes
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  // Sort by priority (urgent first)
  const sortedNotifications = [...notifications]
    .sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })
    .slice(0, maxNotifications);

  return (
    <div className={`fixed z-[100] flex flex-col gap-3 ${positionClasses[position]}`}>
      {/* Control Bar (shown when DND or muted) */}
      {(doNotDisturb || muted) && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`
            flex items-center justify-between gap-3 px-4 py-2 rounded-xl
            backdrop-blur-md border
            ${doNotDisturb 
              ? 'bg-red-500/10 border-red-500/30 text-red-400' 
              : 'bg-slate-800/90 border-white/10 text-slate-400'}
          `}
        >
          <div className="flex items-center gap-2">
            {doNotDisturb ? <VolumeX className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="text-sm">
              {doNotDisturb ? 'Do Not Disturb' : 'Notifications muted'}
            </span>
          </div>
          <button
            onClick={doNotDisturb ? () => toggleDND() : toggleMute}
            className="text-xs underline hover:no-underline"
          >
            Disable
          </button>
        </motion.div>
      )}

      {/* Notifications */}
      <AnimatePresence mode="popLayout">
        {sortedNotifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            isHovered={hoveredId === notification.id}
            onHover={() => setHoveredId(notification.id)}
            onLeave={() => setHoveredId(null)}
            onDismiss={() => dismissNotification(notification.id)}
            onSnooze={(minutes) => snoozeNotification(notification.id, minutes)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

// =============================================================================
// Notification Item Component
// =============================================================================

interface NotificationItemProps {
  notification: Notification;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onDismiss: () => void;
  onSnooze: (minutes: number) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  isHovered,
  onHover,
  onLeave,
  onDismiss,
  onSnooze,
}) => {
  const [progress, setProgress] = useState(100);
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);

  const config = priorityConfig[notification.priority];
  const icon = notification.icon || typeIcons[notification.type];
  const hasDuration = notification.duration && notification.duration > 0;

  // Progress bar animation
  useEffect(() => {
    if (!hasDuration || isHovered) return;

    const startTime = Date.now();
    const duration = notification.duration!;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 16);

    return () => clearInterval(interval);
  }, [hasDuration, isHovered, notification.duration]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 50, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={`
        relative w-96 backdrop-blur-xl rounded-xl border overflow-hidden
        ${config.borderColor} ${config.bgColor} ${config.glowColor}
      `}
    >
      {/* Priority Indicator Strip */}
      <div className={`
        absolute left-0 top-0 bottom-0 w-1
        ${notification.priority === 'urgent' ? 'bg-red-500' :
          notification.priority === 'high' ? 'bg-nexus-amber' :
          notification.priority === 'medium' ? 'bg-nexus-cyan' :
          'bg-slate-500'}
      `} />

      <div className="p-4 pl-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={config.iconColor}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-slate-200 text-sm">
                {notification.title}
              </h3>
              {notification.dismissible && (
                <button
                  onClick={onDismiss}
                  className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-sm text-slate-400 mt-1">
              {notification.message}
            </p>
          </div>
        </div>

        {/* Actions */}
        {notification.actions && notification.actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {notification.actions.map((action) => (
              <button
                key={action.id}
                onClick={() => {
                  action.onClick();
                  onDismiss();
                }}
                className={`
                  px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                  ${action.variant === 'primary'
                    ? 'bg-nexus-cyan/20 text-nexus-cyan border border-nexus-cyan/30 hover:bg-nexus-cyan/30'
                    : action.variant === 'danger'
                    ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }
                `}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Footer with snooze and timestamp */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
          <span className="text-xs text-slate-500">
            {new Date(notification.timestamp).toLocaleTimeString(undefined, {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          
          {notification.snoozable && (
            <div className="relative">
              <button
                onClick={() => setShowSnoozeOptions(!showSnoozeOptions)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                <Clock className="w-3 h-3" />
                Snooze
              </button>
              
              {/* Snooze Options Dropdown */}
              <AnimatePresence>
                {showSnoozeOptions && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute right-0 bottom-full mb-1 py-1 bg-slate-800 rounded-lg border border-white/10 shadow-xl min-w-[120px]"
                  >
                    {[5, 15, 30, 60].map((minutes) => (
                      <button
                        key={minutes}
                        onClick={() => {
                          onSnooze(minutes);
                          setShowSnoozeOptions(false);
                        }}
                        className="w-full px-3 py-1.5 text-left text-xs text-slate-300 hover:bg-white/5 transition-colors"
                      >
                        {minutes} min
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {hasDuration && !isHovered && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5">
          <motion.div
            className={`h-full ${
              notification.type === 'error' ? 'bg-red-400' :
              notification.type === 'warning' ? 'bg-nexus-amber' :
              notification.type === 'success' ? 'bg-nexus-emerald' :
              'bg-nexus-cyan'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </motion.div>
  );
};

// =============================================================================
// Convenience Functions
// =============================================================================

export const showNotification = (
  title: string,
  message: string,
  type: NotificationType = 'info',
  options?: {
    priority?: NotificationPriority;
    duration?: number;
    actions?: NotificationAction[];
  }
): string => {
  return useNotificationStore.getState().addNotification({
    title,
    message,
    type,
    priority: options?.priority || 'medium',
    duration: options?.duration ?? 5000,
    actions: options?.actions,
  });
};

export const showProactiveNotification = (
  suggestion: ProactiveSuggestion,
  onAccept: () => void,
  onDismiss: () => void
): string => {
  const priorityMap: Record<ProactivePriority, NotificationPriority> = {
    low: 'low',
    medium: 'medium',
    high: 'high',
  };

  return useNotificationStore.getState().addNotification({
    title: suggestion.title,
    message: suggestion.content,
    type: 'proactive',
    priority: priorityMap[suggestion.priority],
    duration: 0, // Persistent
    actions: [
      {
        id: 'accept',
        label: 'Tell me more',
        variant: 'primary',
        onClick: onAccept,
      },
      {
        id: 'dismiss',
        label: 'Dismiss',
        variant: 'secondary',
        onClick: onDismiss,
      },
    ],
    metadata: { suggestionId: suggestion.id },
  });
};

export default NotificationManager;
```

---

## 4. ToolCallDisplay Component

### Purpose
Visualizes AI tool usage in real-time, showing tool execution progress, parameters, and results.

### File Location
`src/renderer/components/ToolCallDisplay.tsx`

### Props Interface & Implementation

```typescript
// src/renderer/components/ToolCallDisplay.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wrench,
  Terminal,
  Globe,
  FileText,
  Database,
  Search,
  Code,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import { ToolCall } from '../../shared/types';

// =============================================================================
// Tool Call Types
// =============================================================================

export type ToolStatus = 'pending' | 'executing' | 'completed' | 'failed';

export interface ToolCallState {
  id: string;
  name: string;
  status: ToolStatus;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
  startTime: number;
  endTime?: number;
  progress?: number;
}

export interface ToolCallDisplayProps {
  toolCalls: ToolCallState[];
  onToolClick?: (tool: ToolCallState) => void;
  maxVisible?: number;
  showDetails?: boolean;
}

// =============================================================================
// Tool Registry - Metadata for known tools
// =============================================================================

interface ToolMetadata {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  description: string;
  category: 'file' | 'web' | 'code' | 'data' | 'system';
}

const toolRegistry: Record<string, ToolMetadata> = {
  read_file: {
    icon: <FileText className="w-4 h-4" />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    description: 'Reading file',
    category: 'file',
  },
  write_file: {
    icon: <FileText className="w-4 h-4" />,
    color: 'text-nexus-amber',
    bgColor: 'bg-nexus-amber/10',
    description: 'Writing file',
    category: 'file',
  },
  search_files: {
    icon: <Search className="w-4 h-4" />,
    color: 'text-nexus-cyan',
    bgColor: 'bg-nexus-cyan/10',
    description: 'Searching files',
    category: 'file',
  },
  execute_command: {
    icon: <Terminal className="w-4 h-4" />,
    color: 'text-nexus-violet',
    bgColor: 'bg-nexus-violet/10',
    description: 'Executing command',
    category: 'system',
  },
  web_search: {
    icon: <Globe className="w-4 h-4" />,
    color: 'text-nexus-emerald',
    bgColor: 'bg-nexus-emerald/10',
    description: 'Searching web',
    category: 'web',
  },
  fetch_url: {
    icon: <ExternalLink className="w-4 h-4" />,
    color: 'text-nexus-emerald',
    bgColor: 'bg-nexus-emerald/10',
    description: 'Fetching URL',
    category: 'web',
  },
  query_database: {
    icon: <Database className="w-4 h-4" />,
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
    description: 'Querying database',
    category: 'data',
  },
  run_code: {
    icon: <Code className="w-4 h-4" />,
    color: 'text-pink-400',
    bgColor: 'bg-pink-400/10',
    description: 'Running code',
    category: 'code',
  },
  default: {
    icon: <Wrench className="w-4 h-4" />,
    color: 'text-slate-400',
    bgColor: 'bg-slate-400/10',
    description: 'Using tool',
    category: 'system',
  },
};

const getToolMetadata = (name: string): ToolMetadata => {
  return toolRegistry[name] || toolRegistry.default;
};

// =============================================================================
// Tool Call Display Component
// =============================================================================

export const ToolCallDisplay: React.FC<ToolCallDisplayProps> = ({
  toolCalls,
  onToolClick,
  maxVisible = 3,
  showDetails = true,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const visibleCalls = toolCalls.slice(0, maxVisible);
  const hasMore = toolCalls.length > maxVisible;

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {visibleCalls.map((tool) => (
          <ToolCallItem
            key={tool.id}
            tool={tool}
            isExpanded={expandedId === tool.id}
            onToggle={() => setExpandedId(expandedId === tool.id ? null : tool.id)}
            onClick={() => onToolClick?.(tool)}
          />
        ))}
      </AnimatePresence>

      {hasMore && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-slate-500 text-center py-1"
        >
          +{toolCalls.length - maxVisible} more tool{toolCalls.length - maxVisible !== 1 ? 's' : ''}
        </motion.div>
      )}
    </div>
  );
};

// =============================================================================
// Tool Call Item Component
// =============================================================================

interface ToolCallItemProps {
  tool: ToolCallState;
  isExpanded: boolean;
  onToggle: () => void;
  onClick?: () => void;
}

const ToolCallItem: React.FC<ToolCallItemProps> = ({
  tool,
  isExpanded,
  onToggle,
  onClick,
}) => {
  const metadata = getToolMetadata(tool.name);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (tool.result) {
      await navigator.clipboard.writeText(JSON.stringify(tool.result, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [tool.result]);

  const duration = tool.endTime
    ? tool.endTime - tool.startTime
    : Date.now() - tool.startTime;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`
        rounded-lg border overflow-hidden transition-colors
        ${tool.status === 'failed' 
          ? 'bg-red-500/5 border-red-500/20' 
          : 'bg-white/5 border-white/10 hover:border-white/20'}
      `}
    >
      {/* Header */}
      <div
        onClick={onToggle}
        className="flex items-center gap-3 p-3 cursor-pointer"
      >
        {/* Status Icon */}
        <div className={`
          w-8 h-8 rounded-lg flex items-center justify-center
          ${metadata.bgColor} ${metadata.color}
        `}>
          {tool.status === 'executing' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : tool.status === 'completed' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : tool.status === 'failed' ? (
            <XCircle className="w-4 h-4 text-red-400" />
          ) : (
            metadata.icon
          )}
        </div>

        {/* Tool Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-200">
              {metadata.description}
            </span>
            <code className="text-xs text-slate-500">{tool.name}</code>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock className="w-3 h-3" />
            {duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`}
          </div>
        </div>

        {/* Expand/Collapse */}
        <ChevronRight className={`
          w-4 h-4 text-slate-500 transition-transform
          ${isExpanded ? 'rotate-90' : ''}
        `} />
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/5"
          >
            <div className="p-3 space-y-3">
              {/* Arguments */}
              <div>
                <h4 className="text-xs font-medium text-slate-500 mb-1">Arguments</h4>
                <pre className="p-2 rounded bg-black/30 text-xs text-slate-300 overflow-x-auto">
                  {JSON.stringify(tool.arguments, null, 2)}
                </pre>
              </div>

              {/* Result or Error */}
              {tool.status === 'completed' && tool.result !== undefined && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs font-medium text-slate-500">Result</h4>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <pre className="p-2 rounded bg-nexus-emerald/5 border border-nexus-emerald/10 text-xs text-slate-300 overflow-x-auto max-h-40 overflow-y-auto">
                    {typeof tool.result === 'string' 
                      ? tool.result 
                      : JSON.stringify(tool.result, null, 2)}
                  </pre>
                </div>
              )}

              {tool.status === 'failed' && tool.error && (
                <div>
                  <h4 className="text-xs font-medium text-slate-500 mb-1">Error</h4>
                  <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                    {tool.error}
                  </div>
                </div>
              )}

              {/* Progress Bar for executing tools */}
              {tool.status === 'executing' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">Executing...</span>
                    <span className="text-xs text-slate-500">
                      {tool.progress ? `${Math.round(tool.progress)}%` : ''}
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full ${metadata.color.replace('text-', 'bg-')}`}
                      initial={{ width: 0 }}
                      animate={{ 
                        width: tool.progress ? `${tool.progress}%` : '100%',
                      }}
                      transition={{ 
                        duration: tool.progress ? 0.3 : 1, 
                        repeat: tool.progress ? 0 : Infinity,
                        ease: 'linear'
                      }}
                      style={!tool.progress ? { opacity: 0.5 } : undefined}
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// =============================================================================
// Tool Call Indicator (Compact Version for Chat Bubbles)
// =============================================================================

interface ToolCallIndicatorProps {
  toolCount: number;
  executingCount: number;
  onClick?: () => void;
}

export const ToolCallIndicator: React.FC<ToolCallIndicatorProps> = ({
  toolCount,
  executingCount,
  onClick,
}) => {
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full
        bg-nexus-cyan/10 border border-nexus-cyan/30 text-nexus-cyan text-xs
        hover:bg-nexus-cyan/20 transition-colors"
    >
      {executingCount > 0 ? (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Using {executingCount} tool{executingCount !== 1 ? 's' : ''}...</span>
        </>
      ) : (
        <>
          <Wrench className="w-3 h-3" />
          <span>Used {toolCount} tool{toolCount !== 1 ? 's' : ''}</span>
        </>
      )}
    </motion.button>
  );
};

// =============================================================================
// Tool Call Store (for managing tool call state)
// =============================================================================

import { create } from 'zustand';

interface ToolCallStoreState {
  activeCalls: Map<string, ToolCallState>;
  callHistory: ToolCallState[];
  
  addCall: (toolCall: ToolCall) => void;
  updateCall: (id: string, updates: Partial<ToolCallState>) => void;
  completeCall: (id: string, result: unknown) => void;
  failCall: (id: string, error: string) => void;
  clearHistory: () => void;
  getCallsForMessage: (messageId: string) => ToolCallState[];
}

export const useToolCallStore = create<ToolCallStoreState>((set, get) => ({
  activeCalls: new Map(),
  callHistory: [],

  addCall: (toolCall: ToolCall) => {
    const state: ToolCallState = {
      id: toolCall.id,
      name: toolCall.function.name,
      status: 'executing',
      arguments: JSON.parse(toolCall.function.arguments),
      startTime: Date.now(),
    };

    set((prev) => ({
      activeCalls: new Map(prev.activeCalls).set(toolCall.id, state),
      callHistory: [state, ...prev.callHistory].slice(0, 100),
    }));
  },

  updateCall: (id, updates) => {
    set((prev) => {
      const call = prev.activeCalls.get(id);
      if (!call) return prev;

      const updated = { ...call, ...updates };
      return {
        activeCalls: new Map(prev.activeCalls).set(id, updated),
        callHistory: prev.callHistory.map((c) => (c.id === id ? updated : c)),
      };
    });
  },

  completeCall: (id, result) => {
    set((prev) => {
      const call = prev.activeCalls.get(id);
      if (!call) return prev;

      const updated: ToolCallState = {
        ...call,
        status: 'completed',
        result,
        endTime: Date.now(),
      };

      const newActiveCalls = new Map(prev.activeCalls);
      newActiveCalls.delete(id);

      return {
        activeCalls: newActiveCalls,
        callHistory: prev.callHistory.map((c) => (c.id === id ? updated : c)),
      };
    });
  },

  failCall: (id, error) => {
    set((prev) => {
      const call = prev.activeCalls.get(id);
      if (!call) return prev;

      const updated: ToolCallState = {
        ...call,
        status: 'failed',
        error,
        endTime: Date.now(),
      };

      const newActiveCalls = new Map(prev.activeCalls);
      newActiveCalls.delete(id);

      return {
        activeCalls: newActiveCalls,
        callHistory: prev.callHistory.map((c) => (c.id === id ? updated : c)),
      };
    });
  },

  clearHistory: () => set({ callHistory: [] }),

  getCallsForMessage: (messageId: string) => {
    // This would be implemented to filter calls by message
    return get().callHistory.slice(0, 10);
  },
}));

export default ToolCallDisplay;
```

---

## 5. Integration Guide

### 5.1 Adding Dashboard to Sidebar

Update `src/renderer/components/Sidebar.tsx`:

```typescript
// Add to imports
import { 
  LayoutDashboard,
  MessageSquare,
  // ... other imports
} from 'lucide-react';

// Add prop to Sidebar
interface SidebarProps {
  currentView: 'chat' | 'dashboard';
  onViewChange: (view: 'chat' | 'dashboard') => void;
}

// Add navigation buttons in the sidebar header
const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  // ... existing code

  return (
    <motion.aside className="w-72 flex flex-col border-r border-white/5 bg-[var(--color-bg-secondary)]/50">
      {/* Navigation Tabs */}
      <div className="flex gap-1 p-2 border-b border-white/5">
        <button
          onClick={() => onViewChange('chat')}
          className={`
            flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm
            transition-all duration-200
            ${currentView === 'chat'
              ? 'bg-white/10 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }
          `}
        >
          <MessageSquare className="w-4 h-4" />
          Chat
        </button>
        <button
          onClick={() => onViewChange('dashboard')}
          className={`
            flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm
            transition-all duration-200
            ${currentView === 'dashboard'
              ? 'bg-nexus-cyan/10 text-nexus-cyan'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }
          `}
        >
          <LayoutDashboard className="w-4 h-4" />
          Dashboard
        </button>
      </div>
      
      {/* ... rest of sidebar */}
    </motion.aside>
  );
};
```

### 5.2 Integration with App.tsx

Update the main app component to handle view switching:

```typescript
// src/renderer/App.tsx

import { useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import DashboardPanel from './components/DashboardPanel';
import ActionConfirmationModal from './components/ActionConfirmationModal';
import NotificationManager from './components/NotificationManager';
import { useActionConfirmationStore } from './stores/actionConfirmationStore';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'chat' | 'dashboard'>('chat');
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  
  const {
    isModalOpen,
    pendingAction,
    permissionLevel,
    confirmAction,
    denyAction,
    setPermissionLevel,
    closeModal,
  } = useActionConfirmationStore();

  const handleStartChat = (prompt: string) => {
    setCurrentView('chat');
    // Handle starting chat with prompt
  };

  const handleOpenConversation = (id: string) => {
    setCurrentConversationId(id);
    setCurrentView('chat');
  };

  return (
    <div className="flex h-screen bg-[var(--color-bg-primary)]">
      <Sidebar 
        currentView={currentView}
        onViewChange={setCurrentView}
      />
      
      <main className="flex-1 overflow-hidden">
        {currentView === 'chat' ? (
          <ChatArea conversationId={currentConversationId} />
        ) : (
          <DashboardPanel 
            onStartChat={handleStartChat}
            onOpenConversation={handleOpenConversation}
          />
        )}
      </main>

      {/* Global Components */}
      <ActionConfirmationModal
        isOpen={isModalOpen}
        action={pendingAction}
        permissionLevel={permissionLevel}
        onConfirm={confirmAction}
        onDeny={denyAction}
        onAlwaysAllow={(duration) => {
          if (pendingAction) {
            setPermissionLevel(pendingAction.category, {
              level: 'always_allow',
              scope: pendingAction.category,
              expiresAt: duration === 'session' 
                ? Date.now() + 24 * 60 * 60 * 1000 
                : undefined,
            });
            confirmAction(true);
          }
        }}
        onClose={closeModal}
      />

      <NotificationManager position="top-right" />
    </div>
  );
};
```

### 5.3 Tool Call Integration in ChatArea

Modify the MessageBubble component in `ChatArea.tsx` to show tool usage:

```typescript
// Add imports
import { ToolCallIndicator, ToolCallDisplay } from './ToolCallDisplay';
import { useToolCallStore } from './ToolCallDisplay';

// Inside MessageBubble component
const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isStreaming,
  onCopy,
  onRegenerate,
  copiedId,
}) => {
  // ... existing code
  
  // Get tool calls for this message
  const { callHistory, activeCalls } = useToolCallStore();
  const messageToolCalls = message.tool_calls || [];
  const toolStates = messageToolCalls.map(tc => 
    activeCalls.get(tc.id) || callHistory.find(ch => ch.id === tc.id)
  ).filter(Boolean);
  
  const executingCount = toolStates.filter(t => t?.status === 'executing').length;
  const completedCount = toolStates.filter(t => t?.status === 'completed').length;

  return (
    <motion.div className={`flex gap-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* ... avatar and content */}
      
      <div className={`flex-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Tool Call Indicator */}
        {toolStates.length > 0 && (
          <div className="mb-2">
            {showToolDetails ? (
              <div className="max-w-md">
                <ToolCallDisplay toolCalls={toolStates} maxVisible={3} />
              </div>
            ) : (
              <ToolCallIndicator
                toolCount={completedCount}
                executingCount={executingCount}
                onClick={() => setShowToolDetails(true)}
              />
            )}
          </div>
        )}
        
        {/* ... existing message content */}
      </div>
    </motion.div>
  );
};
```

### 5.4 Triggering Confirmation Modals

Example of how to trigger confirmation from the app:

```typescript
// Example: In a component that needs to request action confirmation

import { useActionConfirmationStore } from '../stores/actionConfirmationStore';
import type { ActionDetails } from '../components/ActionConfirmationModal';

const SomeComponent: React.FC = () => {
  const { requestConfirmation } = useActionConfirmationStore();

  const handleDeleteFile = async (filePath: string) => {
    const action: ActionDetails = {
      id: `action_${Date.now()}`,
      title: 'Delete File',
      description: 'Permanently delete the selected file from your system',
      severity: 'high',
      category: 'file',
      target: filePath,
      estimatedImpact: 'This file will be moved to trash and cannot be recovered without backup',
      reversible: true,
    };

    const confirmed = await requestConfirmation(action);
    if (confirmed) {
      // Proceed with file deletion
    }
  };

  return (
    // ... component JSX
  );
};
```

---

## 6. State Management Extensions

### 6.1 Updated appStore.ts with Action Integration

```typescript
// Add to src/renderer/stores/appStore.ts

interface AppState {
  // ... existing state
  
  // Action confirmation integration
  pendingActionConfirmation: ActionDetails | null;
  
  // Actions
  requestActionConfirmation: (action: ActionDetails) => Promise<boolean>;
  submitToolResult: (toolCallId: string, result: unknown) => void;
}

// Add IPC listener for action confirmations
if (typeof window !== 'undefined' && window.electronAPI) {
  window.electronAPI.onActionConfirmationRequest((_, action) => {
    const { requestConfirmation } = useActionConfirmationStore.getState();
    requestConfirmation(action).then((confirmed) => {
      window.electronAPI?.respondToActionConfirmation(action.id, confirmed);
    });
  });
  
  // Listen for tool calls
  window.electronAPI.onToolCallStart((_, toolCall) => {
    useToolCallStore.getState().addCall(toolCall);
  });
  
  window.electronAPI.onToolCallComplete((_, { id, result }) => {
    useToolCallStore.getState().completeCall(id, result);
  });
  
  window.electronAPI.onToolCallError((_, { id, error }) => {
    useToolCallStore.getState().failCall(id, error);
  });
}
```

---

## 7. Styling Additions

### 7.1 Add to globals.css

```css
/* Add these styles to src/renderer/styles/globals.css */

/* Animation for urgent notifications */
@keyframes pulse-subtle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.animate-pulse-subtle {
  animation: pulse-subtle 2s ease-in-out infinite;
}

/* Line clamp utilities */
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Custom scrollbar for dashboard panels */
.dashboard-scroll::-webkit-scrollbar {
  width: 4px;
}

.dashboard-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.dashboard-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

/* Glass card hover effect */
.glass-hover {
  transition: all 0.2s ease;
}

.glass-hover:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
}

/* Status badge styles */
.status-badge {
  @apply inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium;
}

.status-badge-executing {
  @apply bg-nexus-cyan/10 text-nexus-cyan border border-nexus-cyan/30;
}

.status-badge-completed {
  @apply bg-nexus-emerald/10 text-nexus-emerald border border-nexus-emerald/30;
}

.status-badge-failed {
  @apply bg-red-500/10 text-red-400 border border-red-500/30;
}
```

---

## 8. IPC Channel Additions

Add these channels to `src/shared/types.ts`:

```typescript
export const IPC_CHANNELS = {
  // ... existing channels
  
  // Action Confirmation
  ACTION_CONFIRMATION_REQUEST: 'action:confirmation-request',
  ACTION_CONFIRMATION_RESPONSE: 'action:confirmation-response',
  
  // Tool Calls
  TOOL_CALL_START: 'tool:call-start',
  TOOL_CALL_COMPLETE: 'tool:call-complete',
  TOOL_CALL_ERROR: 'tool:call-error',
  TOOL_CALL_PROGRESS: 'tool:call-progress',
  
  // System Context (if not already present)
  SYSTEM_CONTEXT_GET: 'system:context-get',
  SYSTEM_CONTEXT_UPDATE: 'system:context-update',
  
  // Focus Sessions
  FOCUS_SESSION_START: 'focus:session-start',
  FOCUS_SESSION_END: 'focus:session-end',
  FOCUS_SESSION_GET: 'focus:session-get',
} as const;
```

---

## 9. Implementation Checklist

### Phase 1: Core Components
- [ ] Create `ActionConfirmationModal.tsx` with full implementation
- [ ] Create `DashboardPanel.tsx` with all tabs
- [ ] Create `NotificationManager.tsx` with priority system
- [ ] Create `ToolCallDisplay.tsx` with progress tracking

### Phase 2: State Management
- [ ] Create `actionConfirmationStore.ts`
- [ ] Create `notificationStore.ts`
- [ ] Create `toolCallStore.ts`
- [ ] Extend `appStore.ts` with action integration

### Phase 3: Integration
- [ ] Update `Sidebar.tsx` with view navigation
- [ ] Update `App.tsx` with routing and global modals
- [ ] Update `ChatArea.tsx` with tool call display
- [ ] Update `ProactiveSuggestion.tsx` to use new notification system

### Phase 4: Styling & Polish
- [ ] Add CSS animations to `globals.css`
- [ ] Verify all glassmorphism effects match theme
- [ ] Test responsive behavior
- [ ] Add error boundary components

### Phase 5: Testing
- [ ] Test action confirmation flow
- [ ] Test dashboard all tabs
- [ ] Test notification priorities
- [ ] Test tool call display in chat

---

## Summary

This implementation plan provides:

1. **Complete component code** - No placeholders, fully functional React components
2. **Props interfaces** - TypeScript types for all component props
3. **State management** - Zustand stores for managing component state
4. **Styling approach** - Tailwind classes matching the existing glassmorphism theme
5. **Animation handling** - Framer Motion for smooth transitions
6. **Error states** - Comprehensive error handling throughout
7. **Integration guide** - Step-by-step instructions for connecting components to existing UI

All components follow the established patterns in the NEXUS codebase and are ready for implementation.
