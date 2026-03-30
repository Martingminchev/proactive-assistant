// =============================================================================
// NEXUS - Edge Indicator Component
// Slim edge-docked notification indicator that changes color based on state
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { IndicatorState, IndicatorStatus } from '../../shared/types';

// Color configurations for each state
const statusColors: Record<IndicatorStatus, { bg: string; glow: string; pulse: boolean; pulseIntensity?: 'normal' | 'strong' }> = {
  idle: {
    bg: 'rgba(0, 240, 255, 0.6)',      // Cyan
    glow: 'rgba(0, 240, 255, 0.3)',
    pulse: false,
  },
  suggestion: {
    bg: 'rgba(251, 191, 36, 0.9)',     // Amber - more visible for proactive attention
    glow: 'rgba(251, 191, 36, 0.6)',
    pulse: true,
    pulseIntensity: 'strong' as const,
  },
  message: {
    bg: 'rgba(52, 211, 153, 0.8)',     // Emerald/Green
    glow: 'rgba(52, 211, 153, 0.4)',
    pulse: true,
  },
  error: {
    bg: 'rgba(248, 113, 113, 0.8)',    // Red
    glow: 'rgba(248, 113, 113, 0.4)',
    pulse: true,
  },
};

export const Indicator: React.FC = () => {
  const [state, setState] = useState<IndicatorState>({ status: 'idle' });
  const [isHovered, setIsHovered] = useState(false);

  // Listen for state updates from main process
  useEffect(() => {
    const unsubscribe = window.electronAPI.onIndicatorStateUpdate((_, newState) => {
      setState(newState);
    });

    // Get initial state
    window.electronAPI.getIndicatorState().then((initialState) => {
      if (initialState) {
        setState(initialState);
      }
    });

    return unsubscribe;
  }, []);

  // Handle click - opens main window
  const handleClick = useCallback(() => {
    window.electronAPI.indicatorClicked();
  }, []);

  // Handle dismiss (right-click or secondary action)
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (state.status !== 'idle') {
      window.electronAPI.indicatorDismiss();
    }
  }, [state.status]);

  const colors = statusColors[state.status];

  return (
    <motion.div
      className="w-full h-full flex items-center justify-center cursor-pointer"
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        WebkitAppRegion: 'no-drag',
      } as React.CSSProperties}
    >
      {/* Main indicator strip */}
      <motion.div
        className="rounded-full"
        animate={{
          backgroundColor: colors.bg,
          boxShadow: `0 0 ${isHovered ? '20px' : '12px'} ${colors.glow}`,
          scale: isHovered ? 1.15 : 1,
          width: isHovered ? '100%' : '80%',
          height: isHovered ? '100%' : '90%',
        }}
        transition={{
          duration: 0.3,
          ease: 'easeOut',
        }}
        style={{
          minWidth: 6,
          minHeight: 40,
        }}
      >
        {/* Pulse animation overlay - stronger for suggestion state */}
        {colors.pulse && (
          <motion.div
            className="w-full h-full rounded-full"
            animate={colors.pulseIntensity === 'strong' ? {
              opacity: [0.5, 1, 0.5],
              scale: [1, 1.25, 1],
            } : {
              opacity: [0.4, 0.8, 0.4],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: colors.pulseIntensity === 'strong' ? 0.8 : 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{
              backgroundColor: colors.bg,
            }}
          />
        )}
      </motion.div>

      {/* Badge count for multiple notifications */}
      {state.count && state.count > 1 && (
        <motion.div
          className="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-red-500 
            flex items-center justify-center text-[8px] font-bold text-white"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        >
          {state.count > 9 ? '9+' : state.count}
        </motion.div>
      )}
    </motion.div>
  );
};

export default Indicator;
