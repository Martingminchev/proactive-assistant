// =============================================================================
// NEXUS - Toast Notification Component
// Displays temporary messages at the bottom of the screen
// =============================================================================

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle, 
  AlertCircle, 
  Info, 
  AlertTriangle, 
  X 
} from 'lucide-react';
import { useToastStore, Toast, ToastType } from '../stores/toastStore';

// Icon mapping for toast types
const toastIcons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-nexus-emerald" />,
  error: <AlertCircle className="w-5 h-5 text-red-400" />,
  warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
  info: <Info className="w-5 h-5 text-nexus-cyan" />,
};

// Background colors for toast types
const toastBgColors: Record<ToastType, string> = {
  success: 'bg-nexus-emerald/10 border-nexus-emerald/30',
  error: 'bg-red-500/10 border-red-500/30',
  warning: 'bg-amber-500/10 border-amber-500/30',
  info: 'bg-nexus-cyan/10 border-nexus-cyan/30',
};

// Progress bar colors for toast types
const progressColors: Record<ToastType, string> = {
  success: 'bg-nexus-emerald',
  error: 'bg-red-400',
  warning: 'bg-amber-400',
  info: 'bg-nexus-cyan',
};

interface ToastItemProps {
  toast: Toast;
  onDismiss: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const [progress, setProgress] = React.useState(100);
  const duration = toast.duration || 5000;

  useEffect(() => {
    if (duration <= 0) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onDismiss();
      }
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [duration, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={`
        relative flex items-start gap-3 min-w-[320px] max-w-md
        p-4 rounded-xl border backdrop-blur-md shadow-lg
        ${toastBgColors[toast.type]}
      `}
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        {toastIcons[toast.type]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 leading-relaxed">
          {toast.message}
        </p>
        
        {/* Action Button */}
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick();
              onDismiss();
            }}
            className="mt-2 text-xs font-medium text-nexus-cyan hover:text-nexus-cyan/80 
              transition-colors underline underline-offset-2"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Dismiss Button */}
      <button
        onClick={onDismiss}
        className="flex-shrink-0 p-1 rounded-lg text-slate-500 hover:text-slate-300 
          hover:bg-white/5 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Progress Bar */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5 rounded-b-xl overflow-hidden">
          <motion.div
            className={`h-full ${progressColors[toast.type]}`}
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.016, ease: 'linear' }}
          />
        </div>
      )}
    </motion.div>
  );
};

// =============================================================================
// Toast Container
// =============================================================================

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useToastStore();

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem 
              toast={toast} 
              onDismiss={() => dismissToast(toast.id)} 
            />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ToastContainer;
