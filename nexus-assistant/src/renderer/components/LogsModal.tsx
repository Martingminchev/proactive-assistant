// =============================================================================
// NEXUS - Logs Viewer Modal
// Displays application logs for debugging
// =============================================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  X, 
  Trash2, 
  Download, 
  RefreshCw,
  Search,
  Terminal,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle
} from 'lucide-react';
import { logger, LogEntry, LogLevel } from '../utils/logger';

interface LogsModalProps {
  onClose: () => void;
}

const levelIcons: Record<LogLevel, React.ReactNode> = {
  debug: <Terminal className="w-3.5 h-3.5 text-slate-500" />,
  info: <Info className="w-3.5 h-3.5 text-nexus-cyan" />,
  warn: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
  error: <AlertCircle className="w-3.5 h-3.5 text-red-400" />,
};

const levelColors: Record<LogLevel, string> = {
  debug: 'text-slate-500',
  info: 'text-nexus-cyan',
  warn: 'text-amber-400',
  error: 'text-red-400',
};

const LogsModal: React.FC<LogsModalProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [selectedLevels, setSelectedLevels] = useState<LogLevel[]>(['debug', 'info', 'warn', 'error']);
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Load logs
  const loadLogs = () => {
    setLogs(logger.getAllLogs());
  };

  // Initial load and periodic refresh
  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Handle scroll - disable auto-scroll if user scrolls up
  const handleScroll = () => {
    if (!logsContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isNearBottom);
  };

  // Filter logs
  const filteredLogs = logs.filter((log: LogEntry) => {
    const matchesLevel = selectedLevels.includes(log.level);
    const matchesFilter = filter === '' || 
      log.message.toLowerCase().includes(filter.toLowerCase()) ||
      log.args.some((arg: unknown) => String(arg).toLowerCase().includes(filter.toLowerCase()));
    return matchesLevel && matchesFilter;
  });

  // Clear logs
  const handleClear = () => {
    logger.clearLogs();
    loadLogs();
  };

  // Download logs
  const handleDownload = () => {
    const content = logger.exportLogs();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Toggle level filter
  const toggleLevel = (level: LogLevel) => {
    setSelectedLevels(prev => 
      prev.includes(level) 
        ? prev.filter(l => l !== level)
        : [...prev, level]
    );
  };

  // Format args for display
  const formatArgs = (args: any[]): string => {
    if (args.length === 0) return '';
    return ' ' + args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return '[Object]';
        }
      }
      return String(arg);
    }).join(' ');
  };

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="glass w-full max-w-4xl h-[80vh] rounded-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-nexus-cyan" />
            <h2 className="text-lg font-display font-semibold text-white">Application Logs</h2>
            <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-slate-500">
              {filteredLogs.length} entries
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-4 px-6 py-3 border-b border-white/10 bg-white/[0.02]">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search logs..."
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/5 border border-white/10
                text-sm text-slate-200 placeholder-slate-600
                focus:outline-none focus:border-nexus-cyan/50 transition-colors"
            />
          </div>

          {/* Level Filters */}
          <div className="flex items-center gap-1">
            {(['debug', 'info', 'warn', 'error'] as LogLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => toggleLevel(level)}
                className={`
                  px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all
                  ${selectedLevels.includes(level)
                    ? 'bg-white/10 text-white'
                    : 'text-slate-500 hover:text-slate-300'
                  }
                `}
              >
                {level}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 border-l border-white/10 pl-4">
            <button
              onClick={loadLogs}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={handleDownload}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
              title="Download Logs"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={handleClear}
              className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Clear Logs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Logs List */}
        <div 
          ref={logsContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 font-mono text-xs"
        >
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Info className="w-8 h-8 mb-2 opacity-50" />
              <p>No logs to display</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredLogs.map((log, index) => (
                <div
                  key={index}
                  className={`
                    flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors
                    ${log.level === 'error' ? 'bg-red-500/5' : ''}
                    ${log.level === 'warn' ? 'bg-amber-500/5' : ''}
                  `}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {levelIcons[log.level]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-slate-500">{log.timestamp}</span>
                      <span className={`font-semibold uppercase ${levelColors[log.level]}`}>
                        {log.level}
                      </span>
                    </div>
                    <div className="text-slate-300 whitespace-pre-wrap break-all">
                      {log.message}
                      {log.args.length > 0 && (
                        <span className="text-slate-500">
                          {formatArgs(log.args)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 bg-white/[0.02]">
          <div className="text-xs text-slate-500">
            Showing {filteredLogs.length} of {logs.length} total entries
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded border-white/20 bg-white/5"
            />
            Auto-scroll
          </label>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default LogsModal;
