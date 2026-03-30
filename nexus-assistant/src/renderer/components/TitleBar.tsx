// =============================================================================
// NEXUS - Title Bar
// Custom window controls with futuristic styling
// =============================================================================

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Minus, 
  Square, 
  Maximize2,
  X, 
  Settings, 
  Cpu,
  Activity,
  Zap,
  PanelRightOpen
} from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';

interface TitleBarProps {
  onOpenSettings: () => void;
}

const TitleBar: React.FC<TitleBarProps> = ({ onOpenSettings }) => {
  const { settings } = useSettingsStore();
  const [isMaximized, setIsMaximized] = useState(false);

  // Listen for window state changes (if available)
  useEffect(() => {
    // In Electron, we could listen for maximize/unmaximize events
    // For now, we toggle the icon based on click
  }, []);

  const handleMinimize = () => {
    if (window.electronAPI?.minimizeWindow) {
      window.electronAPI.minimizeWindow();
    } else {
      console.warn('electronAPI.minimizeWindow not available');
    }
  };

  const handleMaximize = () => {
    if (window.electronAPI?.maximizeWindow) {
      window.electronAPI.maximizeWindow();
      setIsMaximized(!isMaximized);
    } else {
      console.warn('electronAPI.maximizeWindow not available');
    }
  };

  const handleClose = () => {
    if (window.electronAPI?.closeWindow) {
      window.electronAPI.closeWindow();
    } else {
      console.warn('electronAPI.closeWindow not available');
      // Fallback: try to close window via standard API
      window.close();
    }
  };

  const handleAlwaysOn = () => {
    if (window.electronAPI?.setAppMode) {
      window.electronAPI.setAppMode('indicator');
    } else {
      console.warn('electronAPI.setAppMode not available');
    }
  };

  return (
    <div 
      className="h-12 flex items-center justify-between px-4 select-none app-drag-region"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left: Logo & Status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="relative w-8 h-8">
            <motion.div
              className="absolute inset-0 rounded-lg bg-gradient-to-br from-nexus-cyan/20 to-nexus-violet/20"
              animate={{ 
                boxShadow: [
                  '0 0 10px rgba(0, 240, 255, 0.2)',
                  '0 0 20px rgba(0, 240, 255, 0.4)',
                  '0 0 10px rgba(0, 240, 255, 0.2)',
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Zap className="w-4 h-4 text-nexus-cyan" />
            </div>
          </div>
          
          <span className="font-display font-semibold text-lg tracking-wide">
            <span className="text-white">NEX</span>
            <span className="text-nexus-cyan">US</span>
          </span>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-3 ml-4">
          <StatusIndicator 
            icon={Activity} 
            label="Kimi"
            isActive={!!settings.kimiApiKey}
            activeColor="text-nexus-cyan"
          />
          <StatusIndicator 
            icon={Cpu} 
            label="Pieces"
            isActive={settings.piecesEnabled}
            activeColor="text-nexus-violet"
          />
        </div>
      </div>

      {/* Center: Empty (for dragging) */}
      <div className="flex-1" />

      {/* Right: Controls */}
      <div 
        className="flex items-center gap-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <WindowButton 
          onClick={handleAlwaysOn} 
          tooltip="Always On (Dock to Side)"
          className="hover:bg-nexus-cyan/20 hover:text-nexus-cyan"
        >
          <PanelRightOpen className="w-4 h-4" />
        </WindowButton>

        <WindowButton onClick={onOpenSettings} tooltip="Settings">
          <Settings className="w-4 h-4" />
        </WindowButton>

        <div className="w-px h-4 bg-white/10 mx-2" />

        <WindowButton onClick={handleMinimize} tooltip="Minimize">
          <Minus className="w-4 h-4" />
        </WindowButton>

        <WindowButton onClick={handleMaximize} tooltip={isMaximized ? 'Restore' : 'Maximize'}>
          {isMaximized ? (
            <Maximize2 className="w-4 h-4" />
          ) : (
            <Square className="w-4 h-4" />
          )}
        </WindowButton>

        <WindowButton 
          onClick={handleClose} 
          tooltip="Close"
          className="hover:bg-red-500/20 hover:text-red-400"
        >
          <X className="w-4 h-4" />
        </WindowButton>
      </div>
    </div>
  );
};

// =============================================================================
// Status Indicator
// =============================================================================

interface StatusIndicatorProps {
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  activeColor: string;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  icon: Icon,
  label,
  isActive,
  activeColor,
}) => (
  <div className="flex items-center gap-1.5 text-xs">
    <div className={`relative ${isActive ? activeColor : 'text-slate-600'}`}>
      <Icon className="w-3.5 h-3.5" />
      {isActive && (
        <motion.div
          className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${activeColor.replace('text-', 'bg-')}`}
          animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </div>
    <span className={`${isActive ? 'text-slate-400' : 'text-slate-600'}`}>
      {label}
    </span>
  </div>
);

// =============================================================================
// Window Control Button
// =============================================================================

interface WindowButtonProps {
  onClick: () => void;
  tooltip?: string;
  children: React.ReactNode;
  className?: string;
}

const WindowButton: React.FC<WindowButtonProps> = ({
  onClick,
  tooltip,
  children,
  className = '',
}) => (
  <motion.button
    onClick={onClick}
    className={`
      w-8 h-8 flex items-center justify-center rounded-lg
      text-slate-400 hover:text-white
      hover:bg-white/5
      transition-colors duration-200
      ${className}
    `}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    title={tooltip}
  >
    {children}
  </motion.button>
);

export default TitleBar;
