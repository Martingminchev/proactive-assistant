// =============================================================================
// NEXUS - Welcome Screen
// Beautiful intro screen with quick actions
// =============================================================================

import React from 'react';
import { motion } from 'framer-motion';
import { 
  MessageSquare, 
  Code, 
  Lightbulb, 
  FileText,
  Sparkles,
  Zap,
  Terminal,
  Cpu
} from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';

interface WelcomeScreenProps {
  onStartChat: (prompt?: string) => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStartChat }) => {
  const { settings } = useSettingsStore();

  const quickActions = [
    { icon: Code, label: 'Write Code', prompt: 'Help me write a function to...' },
    { icon: Lightbulb, label: 'Explain', prompt: 'Explain how this works...' },
    { icon: FileText, label: 'Summarize', prompt: 'Summarize this text for me...' },
    { icon: Terminal, label: 'Debug', prompt: 'Debug this error: ...' },
  ];

  const features = [
    { icon: Cpu, label: 'Kimi K2.5', desc: 'Powered by Moonshot AI' },
    { icon: Zap, label: 'Real-time', desc: 'Streaming responses' },
    { icon: Sparkles, label: 'Context-aware', desc: 'Knows your workflow' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col items-center justify-center p-12"
    >
      {/* Logo Animation */}
      <div className="relative mb-8">
        <motion.div
          className="w-24 h-24 rounded-2xl bg-gradient-to-br from-nexus-cyan/20 to-nexus-violet/20
            border border-nexus-cyan/30 flex items-center justify-center"
          animate={{ 
            boxShadow: [
              '0 0 30px rgba(0, 240, 255, 0.1)',
              '0 0 60px rgba(0, 240, 255, 0.2)',
              '0 0 30px rgba(0, 240, 255, 0.1)',
            ]
          }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <Sparkles className="w-12 h-12 text-nexus-cyan" />
        </motion.div>
        
        {/* Orbiting dots */}
        <motion.div
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        >
          <div className="absolute -top-1 left-1/2 w-2 h-2 rounded-full bg-nexus-cyan" />
        </motion.div>
        <motion.div
          className="absolute inset-0"
          animate={{ rotate: -360 }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        >
          <div className="absolute top-1/2 -right-1 w-1.5 h-1.5 rounded-full bg-nexus-violet" />
        </motion.div>
      </div>

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-4xl font-display font-bold mb-2"
      >
        <span className="text-white">Welcome to </span>
        <span className="text-gradient">NEXUS</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-slate-400 text-center max-w-md mb-12"
      >
        Your intelligent desktop companion powered by Kimi K2.5. 
        Ready to assist with coding, writing, analysis, and more.
      </motion.p>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-2 gap-4 mb-12"
      >
        {quickActions.map((action, index) => (
          <motion.button
            key={action.label}
            onClick={() => onStartChat(action.prompt)}
            className="flex items-center gap-3 px-6 py-4 rounded-xl
              bg-white/5 border border-white/10
              hover:bg-white/10 hover:border-nexus-cyan/30
              transition-all duration-200 group"
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + index * 0.1 }}
          >
            <div className="w-10 h-10 rounded-lg bg-nexus-cyan/10 flex items-center justify-center
              group-hover:bg-nexus-cyan/20 transition-colors">
              <action.icon className="w-5 h-5 text-nexus-cyan" />
            </div>
            <div className="text-left">
              <div className="font-medium text-slate-200">{action.label}</div>
              <div className="text-xs text-slate-500">{action.prompt.slice(0, 25)}...</div>
            </div>
          </motion.button>
        ))}
      </motion.div>

      {/* Start Button */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        onClick={() => onStartChat()}
        className="group relative px-8 py-4 rounded-xl font-medium text-lg
          bg-gradient-to-r from-nexus-cyan/20 to-nexus-violet/20
          border border-nexus-cyan/40 text-nexus-cyan
          hover:from-nexus-cyan/30 hover:to-nexus-violet/30
          transition-all duration-300"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <span className="relative z-10 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Start New Conversation
        </span>
        <motion.div
          className="absolute inset-0 rounded-xl bg-nexus-cyan/10 blur-xl"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.button>

      {/* Features */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="flex items-center gap-8 mt-12"
      >
        {features.map((feature) => (
          <div key={feature.label} className="flex items-center gap-2 text-slate-500">
            <feature.icon className="w-4 h-4 text-nexus-violet" />
            <span className="text-sm">{feature.label}</span>
          </div>
        ))}
      </motion.div>

      {/* API Key Warning */}
      {!settings.kimiApiKey && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-8 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30
            text-amber-400 text-sm flex items-center gap-2"
        >
          <Zap className="w-4 h-4" />
          Add your Kimi API key in settings to start chatting
        </motion.div>
      )}
    </motion.div>
  );
};

export default WelcomeScreen;
