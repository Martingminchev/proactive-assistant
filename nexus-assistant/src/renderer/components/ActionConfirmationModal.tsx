// =============================================================================
// NEXUS - Action Confirmation Modal
// Glassmorphism modal for action confirmations with risk-based styling
// =============================================================================

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  FileText,
  FileEdit,
  Trash2,
  Play,
  Terminal,
  Globe,
  Bell,
  ClipboardCopy,
  AppWindow,
  Settings,
  ExternalLink,
  Clock,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import {
  ActionConfirmationRequest,
  ConfirmableActionType,
  ActionRiskLevel,
} from '../../shared/types';
import { CodeDiffPreview } from './CodeDiffPreview';

// =============================================================================
// Risk Level Configurations
// =============================================================================

interface RiskConfig {
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ElementType;
  glowColor: string;
  label: string;
  description: string;
}

const RISK_CONFIGS: Record<ActionRiskLevel, RiskConfig> = {
  low: {
    color: 'text-nexus-emerald',
    bgColor: 'bg-nexus-emerald/10',
    borderColor: 'border-nexus-emerald/30',
    glowColor: 'shadow-[0_0_30px_rgba(0,255,157,0.2)]',
    icon: ShieldCheck,
    label: 'Low Risk',
    description: 'This action is safe to perform.',
  },
  medium: {
    color: 'text-nexus-cyan',
    bgColor: 'bg-nexus-cyan/10',
    borderColor: 'border-nexus-cyan/30',
    glowColor: 'shadow-[0_0_30px_rgba(0,240,255,0.2)]',
    icon: Shield,
    label: 'Medium Risk',
    description: 'Review the action details before confirming.',
  },
  high: {
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    glowColor: 'shadow-[0_0_30px_rgba(251,191,36,0.2)]',
    icon: ShieldAlert,
    label: 'High Risk',
    description: 'This action may have significant effects.',
  },
  critical: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    glowColor: 'shadow-[0_0_30px_rgba(248,113,113,0.3)]',
    icon: ShieldX,
    label: 'Critical Risk',
    description: 'This action could cause data loss or system changes.',
  },
};

// =============================================================================
// Action Type Configurations
// =============================================================================

interface ActionTypeConfig {
  icon: React.ElementType;
  label: string;
  category: string;
}

const ACTION_TYPE_CONFIGS: Record<ConfirmableActionType, ActionTypeConfig> = {
  'file:read': { icon: FileText, label: 'Read File', category: 'File System' },
  'file:write': { icon: FileEdit, label: 'Write File', category: 'File System' },
  'file:delete': { icon: Trash2, label: 'Delete File', category: 'File System' },
  'file:execute': { icon: Play, label: 'Execute File', category: 'File System' },
  'command:execute': { icon: Terminal, label: 'Run Command', category: 'System' },
  'browser:open': { icon: Globe, label: 'Open Browser', category: 'System' },
  'system:notification': { icon: Bell, label: 'Send Notification', category: 'System' },
  'clipboard:write': { icon: ClipboardCopy, label: 'Copy to Clipboard', category: 'System' },
  'app:launch': { icon: AppWindow, label: 'Launch Application', category: 'System' },
  'settings:modify': { icon: Settings, label: 'Modify Settings', category: 'System' },
  'api:external': { icon: ExternalLink, label: 'External API Call', category: 'Network' },
};

// =============================================================================
// Props Interface
// =============================================================================

interface ActionConfirmationModalProps {
  request: ActionConfirmationRequest | null;
  onConfirm: (requestId: string, rememberChoice: boolean) => void;
  onDeny: (requestId: string) => void;
  onClose: () => void;
}

// =============================================================================
// Main Component
// =============================================================================

export const ActionConfirmationModal: React.FC<ActionConfirmationModalProps> = ({
  request,
  onConfirm,
  onDeny,
  onClose,
}) => {
  const [rememberChoice, setRememberChoice] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate initial time left
  const calculateTimeLeft = useCallback(() => {
    if (!request) return 0;
    const elapsed = Date.now() - request.timestamp;
    const remaining = Math.max(0, request.timeoutMs - elapsed);
    return remaining;
  }, [request]);

  // Set up countdown timer
  useEffect(() => {
    if (!request) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      return;
    }

    setTimeLeft(calculateTimeLeft());
    setRememberChoice(false);
    setIsProcessing(false);

    progressIntervalRef.current = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining <= 0) {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
        handleDeny();
      }
    }, 100);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [request]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!request || isProcessing) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        handleDeny();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [request, isProcessing, rememberChoice]);

  const handleConfirm = () => {
    if (!request || isProcessing) return;
    setIsProcessing(true);
    onConfirm(request.id, rememberChoice);
  };

  const handleDeny = () => {
    if (!request || isProcessing) return;
    setIsProcessing(true);
    onDeny(request.id);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleDeny();
    }
  };

  if (!request) return null;

  const riskConfig = RISK_CONFIGS[request.riskLevel];
  const actionConfig = ACTION_TYPE_CONFIGS[request.actionType];
  const RiskIcon = riskConfig.icon;
  const ActionIcon = actionConfig.icon;

  // Calculate progress percentage
  const progressPercent = Math.max(0, Math.min(100, (timeLeft / request.timeoutMs) * 100));
  const secondsLeft = Math.ceil(timeLeft / 1000);

  // Format payload for display
  const formattedPayload = request.payload
    ? Object.entries(request.payload).map(([key, value]) => ({
        key,
        value: typeof value === 'string' ? value : JSON.stringify(value),
      }))
    : [];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={handleBackdropClick}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`
            relative w-full max-w-lg rounded-2xl overflow-hidden
            bg-[var(--color-bg-secondary)]/90 backdrop-blur-xl
            border ${riskConfig.borderColor}
            ${riskConfig.glowColor}
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress Bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-white/5">
            <motion.div
              className={`h-full ${riskConfig.bgColor.replace('/10', '/60')}`}
              initial={{ width: '100%' }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.1, ease: 'linear' }}
            />
          </div>

          {/* Header */}
          <div className={`px-6 pt-6 pb-4 ${riskConfig.bgColor} border-b ${riskConfig.borderColor}`}>
            <div className="flex items-start gap-4">
              {/* Risk Icon */}
              <div className={`
                flex-shrink-0 w-14 h-14 rounded-xl
                flex items-center justify-center
                ${riskConfig.bgColor} ${riskConfig.color}
                border ${riskConfig.borderColor}
              `}>
                <RiskIcon className="w-7 h-7" />
              </div>

              {/* Title & Description */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`
                    px-2 py-0.5 text-xs font-medium rounded-full
                    ${riskConfig.bgColor} ${riskConfig.color}
                    border ${riskConfig.borderColor}
                  `}>
                    {riskConfig.label}
                  </span>
                  <span className="text-xs text-slate-500">
                    {actionConfig.category}
                  </span>
                </div>
                <h2 className="text-lg font-semibold text-white leading-tight">
                  {request.title}
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  {request.description}
                </p>
              </div>

              {/* Close Button */}
              <button
                onClick={handleDeny}
                disabled={isProcessing}
                className="flex-shrink-0 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-4">
            {/* Action Details */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-nexus-cyan/10 flex items-center justify-center text-nexus-cyan">
                <ActionIcon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{actionConfig.label}</p>
                <p className="text-xs text-slate-500">{request.actionType}</p>
              </div>
              <div className="flex items-center gap-1.5 text-amber-400">
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">{secondsLeft}s</span>
              </div>
            </div>

            {/* Code diff preview for file write/edit */}
            {request.actionType === 'file:write' && request.payload && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Content preview
                </p>
                {request.payload.tool === 'edit_file' && request.payload.search != null && request.payload.replace != null ? (
                  <CodeDiffPreview
                    oldText={String(request.payload.search)}
                    newText={String(request.payload.replace)}
                    oldLabel="Remove"
                    newLabel="Add"
                    maxHeight={180}
                  />
                ) : (request.payload.contentPreview != null || request.payload.content != null) ? (
                  <CodeDiffPreview
                    newText={String(request.payload.contentPreview ?? request.payload.content ?? '')}
                    newLabel="New content"
                    maxHeight={180}
                  />
                ) : null}
              </div>
            )}

            {/* Payload Details */}
            {formattedPayload.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Action Details
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                  {formattedPayload.map(({ key, value }) => (
                    <div
                      key={key}
                      className="flex items-start gap-2 p-2 rounded-lg bg-white/5 text-sm"
                    >
                      <span className="text-slate-500 font-medium min-w-[80px]">
                        {key}:
                      </span>
                      <span className="text-slate-300 break-all font-mono text-xs">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risk Warning */}
            {request.riskLevel === 'high' || request.riskLevel === 'critical' ? (
              <div className={`
                flex items-start gap-3 p-3 rounded-xl
                ${riskConfig.bgColor} border ${riskConfig.borderColor}
              `}>
                <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${riskConfig.color}`} />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${riskConfig.color}`}>
                    {riskConfig.label}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {riskConfig.description}
                  </p>
                </div>
              </div>
            ) : null}

            {/* Remember Choice */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={rememberChoice}
                  onChange={(e) => setRememberChoice(e.target.checked)}
                  disabled={isProcessing}
                  className="sr-only"
                />
                <div className={`
                  w-5 h-5 rounded border transition-all
                  ${rememberChoice
                    ? 'bg-nexus-cyan border-nexus-cyan'
                    : 'bg-white/5 border-white/20 group-hover:border-white/40'
                  }
                `}>
                  {rememberChoice && (
                    <svg className="w-5 h-5 text-black" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5 13l4 4L19 7"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                Always allow this action
              </span>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 bg-white/5 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              onClick={handleDeny}
              disabled={isProcessing}
              className="
                px-5 py-2.5 rounded-xl text-sm font-medium
                text-slate-300 hover:text-white
                bg-white/5 hover:bg-white/10
                border border-white/10 hover:border-white/20
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              Cancel
              <span className="ml-2 text-xs text-slate-500">(Esc)</span>
            </button>
            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              className={`
                px-5 py-2.5 rounded-xl text-sm font-medium
                flex items-center gap-2
                transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
                ${request.riskLevel === 'critical'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                  : request.riskLevel === 'high'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30'
                  : 'bg-nexus-cyan/20 text-nexus-cyan border border-nexus-cyan/30 hover:bg-nexus-cyan/30'
                }
              `}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Confirm
                  <span className="text-xs opacity-60">(Enter)</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ActionConfirmationModal;
