// =============================================================================
// NEXUS - Soul Document Modal
// Markdown editor for the AI's personality document
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Save,
  RefreshCw,
  FileText,
  Eye,
  Edit3,
  RotateCcw,
  Clock,
  User,
  Sparkles,
  Check,
} from 'lucide-react';
import { SoulDocument, DEFAULT_SOUL_DOCUMENT } from '../../shared/types';

interface SoulDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SoulDocumentModal: React.FC<SoulDocumentModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [document, setDocument] = useState<SoulDocument>(DEFAULT_SOUL_DOCUMENT);
  const [editedContent, setEditedContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load document on mount
  useEffect(() => {
    if (isOpen) {
      loadDocument();
    }
  }, [isOpen]);

  // Track changes
  useEffect(() => {
    setHasChanges(editedContent !== document.content);
  }, [editedContent, document.content]);

  const loadDocument = async () => {
    setIsLoading(true);
    try {
      const doc = await window.electronAPI?.getSoulDocument();
      if (doc) {
        setDocument(doc);
        setEditedContent(doc.content);
      }
    } catch (error) {
      console.error('Failed to load soul document:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedDoc = await window.electronAPI?.updateSoulDocument(editedContent);
      if (updatedDoc) {
        setDocument(updatedDoc);
        setHasChanges(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (error) {
      console.error('Failed to save soul document:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (confirm('Reset the Soul Document to its default content? This cannot be undone.')) {
      setIsSaving(true);
      try {
        const resetDoc = await window.electronAPI?.resetSoulDocument();
        if (resetDoc) {
          setDocument(resetDoc);
          setEditedContent(resetDoc.content);
          setHasChanges(false);
        }
      } catch (error) {
        console.error('Failed to reset soul document:', error);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleClose = useCallback(() => {
    if (hasChanges) {
      if (confirm('You have unsaved changes. Close without saving?')) {
        onClose();
      }
    } else {
      onClose();
    }
  }, [hasChanges, onClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleClose]);

  // Keyboard shortcut for save
  useEffect(() => {
    const handleSaveShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's' && isOpen && hasChanges) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
  }, [isOpen, hasChanges]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  // Simple markdown preview renderer
  const renderMarkdown = (content: string) => {
    return content
      .split('\n')
      .map((line, i) => {
        // Headers
        if (line.startsWith('# ')) {
          return <h1 key={i} className="text-2xl font-bold text-white mb-4">{line.slice(2)}</h1>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={i} className="text-xl font-semibold text-white mt-6 mb-3">{line.slice(3)}</h2>;
        }
        if (line.startsWith('### ')) {
          return <h3 key={i} className="text-lg font-medium text-white mt-4 mb-2">{line.slice(4)}</h3>;
        }
        // List items
        if (line.startsWith('- ')) {
          const text = line.slice(2);
          // Handle bold
          const parts = text.split(/(\*\*[^*]+\*\*)/g);
          return (
            <li key={i} className="text-slate-300 ml-4 mb-1">
              {parts.map((part, j) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return <strong key={j} className="text-white">{part.slice(2, -2)}</strong>;
                }
                return part;
              })}
            </li>
          );
        }
        // Italic text (for learning placeholders)
        if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
          return <p key={i} className="text-slate-500 italic mb-2">{line.slice(1, -1)}</p>;
        }
        // Empty lines
        if (line.trim() === '') {
          return <br key={i} />;
        }
        // Regular paragraphs
        return <p key={i} className="text-slate-300 mb-2">{line}</p>;
      });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && handleClose()}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="glass w-full max-w-4xl h-[85vh] rounded-2xl overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-r from-nexus-violet/20 to-nexus-cyan/20">
                <FileText className="w-5 h-5 text-nexus-violet" />
              </div>
              <div>
                <h2 className="text-lg font-display font-semibold text-white">Soul Document</h2>
                <p className="text-xs text-slate-400">
                  Define {document.content.match(/^# (.+)/)?.[1] || 'NEXUS'}'s personality
                </p>
              </div>
              {hasChanges && (
                <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded-full">
                  Unsaved
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Mode Toggle */}
              <div className="flex rounded-lg border border-white/10 overflow-hidden">
                <button
                  onClick={() => setMode('edit')}
                  className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${
                    mode === 'edit' 
                      ? 'bg-nexus-cyan/20 text-nexus-cyan' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </button>
                <button
                  onClick={() => setMode('preview')}
                  className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${
                    mode === 'preview' 
                      ? 'bg-nexus-cyan/20 text-nexus-cyan' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  Preview
                </button>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="w-6 h-6 text-nexus-cyan animate-spin" />
              </div>
            ) : mode === 'edit' ? (
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full h-full p-6 bg-transparent text-slate-200 font-mono text-sm
                  resize-none focus:outline-none placeholder-slate-500"
                placeholder="Write your soul document in markdown..."
                spellCheck={false}
              />
            ) : (
              <div className="h-full overflow-y-auto p-6">
                {renderMarkdown(editedContent)}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/10">
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Updated: {formatDate(document.lastUpdated)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {document.lastUpdatedBy === 'user' ? (
                  <User className="w-3.5 h-3.5" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>By: {document.lastUpdatedBy === 'user' ? 'You' : 'NEXUS'}</span>
              </div>
              <div className="text-slate-500">v{document.version}</div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                disabled={isSaving}
                className="px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 
                  hover:bg-white/5 transition-colors flex items-center gap-1.5
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !hasChanges}
                className={`px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${saveSuccess 
                    ? 'bg-nexus-emerald/20 text-nexus-emerald border border-nexus-emerald/30'
                    : 'bg-nexus-violet/20 text-nexus-violet border border-nexus-violet/30 hover:bg-nexus-violet/30'
                  }`}
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : saveSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    Saved
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SoulDocumentModal;
