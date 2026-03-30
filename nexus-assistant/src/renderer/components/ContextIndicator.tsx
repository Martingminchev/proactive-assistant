// =============================================================================
// NEXUS - Context Indicator
// Visual indicator showing context state and freshness
// =============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Monitor, 
  Cpu, 
  Battery, 
  Clipboard, 
  FileText, 
  Wifi, 
  WifiOff,
  Clock,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  X
} from 'lucide-react';
import type { AppContext } from '../hooks/useContextBridge';

interface ContextIndicatorProps {
  context: AppContext;
  isExpanded?: boolean;
  onRefresh?: () => void;
  onToggleExpand?: () => void;
}

type ContextStatus = 'fresh' | 'stale' | 'disconnected';

interface ContextItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: ContextStatus;
  value?: string;
  ageMs?: number;
  tooltip: string;
}

const STALE_THRESHOLD_MS = 30000; // 30 seconds
const DISCONNECTED_THRESHOLD_MS = 120000; // 2 minutes

export const ContextIndicator: React.FC<ContextIndicatorProps> = ({
  context,
  isExpanded = false,
  onRefresh,
  onToggleExpand,
}) => {
  const [now, setNow] = useState(Date.now());
  const [showDetails, setShowDetails] = useState(false);

  // Update "now" every second for freshness calculation
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const contextAge = useMemo(() => {
    if (!context.timestamp) return null;
    return now - context.timestamp;
  }, [context.timestamp, now]);

  const contextItems = useMemo<ContextItem[]>(() => {
    const items: ContextItem[] = [];
    const age = contextAge || 0;

    // Active Window
    if (context.activeWindow) {
      const windowAge = now - context.timestamp;
      items.push({
        id: 'window',
        label: 'Window',
        icon: <Monitor className="w-3.5 h-3.5" />,
        status: windowAge > STALE_THRESHOLD_MS ? 'stale' : 'fresh',
        value: context.activeWindow.application?.split('.').pop() || context.activeWindow.title?.slice(0, 20),
        ageMs: windowAge,
        tooltip: `${context.activeWindow.title}\n${context.activeWindow.application}`,
      });
    }

    // System Resources
    if (context.systemResources) {
      items.push({
        id: 'resources',
        label: 'Resources',
        icon: <Cpu className="w-3.5 h-3.5" />,
        status: age > STALE_THRESHOLD_MS ? 'stale' : 'fresh',
        value: `${Math.round(context.systemResources.cpu.usage)}% CPU`,
        ageMs: age,
        tooltip: `CPU: ${Math.round(context.systemResources.cpu.usage)}%\n` +
                 `Memory: ${Math.round(context.systemResources.memory.percentage)}%\n` +
                 `Uptime: ${formatDuration(context.systemResources.uptime * 1000)}`,
      });
    }

    // Battery
    if (context.systemResources?.battery) {
      const battery = context.systemResources.battery;
      items.push({
        id: 'battery',
        label: 'Battery',
        icon: <Battery className="w-3.5 h-3.5" />,
        status: age > STALE_THRESHOLD_MS ? 'stale' : 'fresh',
        value: `${battery.percent}%${battery.isCharging ? '⚡' : ''}`,
        ageMs: age,
        tooltip: `Battery: ${battery.percent}%\n${battery.isCharging ? 'Charging' : 'On battery'}`,
      });
    }

    // Clipboard
    if (context.clipboardPreview) {
      items.push({
        id: 'clipboard',
        label: 'Clipboard',
        icon: <Clipboard className="w-3.5 h-3.5" />,
        status: age > STALE_THRESHOLD_MS ? 'stale' : 'fresh',
        value: context.clipboardPreview.length > 15 
          ? context.clipboardPreview.slice(0, 15) + '...' 
          : context.clipboardPreview,
        ageMs: age,
        tooltip: `Clipboard: ${context.clipboardPreview.slice(0, 100)}`,
      });
    }

    // Recent Files
    if (context.recentFiles && context.recentFiles.length > 0) {
      items.push({
        id: 'files',
        label: 'Files',
        icon: <FileText className="w-3.5 h-3.5" />,
        status: 'fresh',
        value: `${context.recentFiles.length} recent`,
        tooltip: context.recentFiles.map(f => f.path).join('\n'),
      });
    }

    return items;
  }, [context, contextAge, now]);

  const overallStatus = useMemo((): ContextStatus => {
    if (!context.timestamp) return 'disconnected';
    const age = now - context.timestamp;
    if (age > DISCONNECTED_THRESHOLD_MS) return 'disconnected';
    if (age > STALE_THRESHOLD_MS) return 'stale';
    return 'fresh';
  }, [context.timestamp, now]);

  const statusColors = {
    fresh: 'bg-emerald-500',
    stale: 'bg-amber-500',
    disconnected: 'bg-red-500',
  };

  const statusIcons = {
    fresh: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
    stale: <Clock className="w-3.5 h-3.5 text-amber-500" />,
    disconnected: <AlertCircle className="w-3.5 h-3.5 text-red-500" />,
  };

  if (!isExpanded) {
    // Compact view - just the status dot
    return (
      <div className="relative group">
        <motion.button
          onClick={onToggleExpand}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-2 hover:bg-surface-3 transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <motion.div
            className={`w-2 h-2 rounded-full ${statusColors[overallStatus]}`}
            animate={{ 
              opacity: overallStatus === 'fresh' ? [1, 0.5, 1] : 1,
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-xs text-text-secondary capitalize">{overallStatus}</span>
        </motion.button>
      </div>
    );
  }

  return (
    <div className="bg-surface-1 border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-2">
        <div className="flex items-center gap-2">
          {statusIcons[overallStatus]}
          <span className="text-sm font-medium text-text-primary">
            Context {overallStatus}
          </span>
          {contextAge && (
            <span className="text-xs text-text-secondary">
              {formatDuration(contextAge)} ago
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onRefresh}
            className="p-1.5 rounded-md hover:bg-surface-3 text-text-secondary hover:text-text-primary transition-colors"
            title="Refresh context"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onToggleExpand}
            className="p-1.5 rounded-md hover:bg-surface-3 text-text-secondary hover:text-text-primary transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Context Items */}
      <div className="p-2 space-y-1">
        {contextItems.length === 0 ? (
          <div className="text-center py-4 text-text-secondary text-sm">
            <WifiOff className="w-5 h-5 mx-auto mb-1 opacity-50" />
            No context available
          </div>
        ) : (
          contextItems.map((item) => (
            <div
              key={item.id}
              className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-2 transition-colors cursor-help"
              title={item.tooltip}
            >
              <div className={`text-text-secondary group-hover:text-text-primary transition-colors`}>
                {item.icon}
              </div>
              <span className="text-xs text-text-secondary w-16">{item.label}</span>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <div 
                  className={`w-1.5 h-1.5 rounded-full ${statusColors[item.status]} flex-shrink-0`}
                />
                {item.value && (
                  <span className="text-xs text-text-primary truncate">
                    {item.value}
                  </span>
                )}
              </div>
              {item.ageMs && item.ageMs > 5000 && (
                <span className="text-xs text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity">
                  {formatDuration(item.ageMs)}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export default ContextIndicator;
