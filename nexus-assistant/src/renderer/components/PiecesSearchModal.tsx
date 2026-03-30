// =============================================================================
// NEXUS - Pieces Search Modal
// Search and browse Pieces OS assets
// =============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Search, 
  Puzzle, 
  Code,
  FileText,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { PiecesAsset } from '../../shared/types';
import { logger } from '../utils/logger';

interface PiecesSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertAsset?: (asset: PiecesAsset) => void;
  initialQuery?: string;
}

export const PiecesSearchModal: React.FC<PiecesSearchModalProps> = ({ 
  isOpen, 
  onClose,
  onInsertAsset,
  initialQuery = ''
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [assets, setAssets] = useState<PiecesAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<PiecesAsset | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [piecesStatus, setPiecesStatus] = useState<{ available: boolean; version?: string; error?: string } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check Pieces status when modal opens
  useEffect(() => {
    if (isOpen) {
      checkPiecesStatus();
    }
  }, [isOpen]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Auto-search when query changes
  useEffect(() => {
    if (!piecesStatus?.available) return;
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(query);
      }, 300);
    } else {
      // Load all assets when query is empty
      loadAllAssets();
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, piecesStatus]);

  const checkPiecesStatus = async () => {
    try {
      const status = await window.electronAPI?.getPiecesStatus();
      setPiecesStatus(status);
      
      if (status?.available) {
        loadAllAssets();
      }
    } catch (error) {
      logger.error('Failed to check Pieces status:', error);
      setPiecesStatus({ available: false, error: 'Failed to check status' });
    }
  };

  const loadAllAssets = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const allAssets = await window.electronAPI?.getAllPiecesAssets();
      setAssets(allAssets || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load assets';
      logger.error('Failed to load Pieces assets:', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      loadAllAssets();
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const results = await window.electronAPI?.searchPieces(searchQuery, 20);
      setAssets(results || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed';
      logger.error('Pieces search failed:', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInsert = (asset: PiecesAsset) => {
    if (onInsertAsset) {
      onInsertAsset(asset);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (selectedAsset) {
        setSelectedAsset(null);
      } else {
        onClose();
      }
    }
  };

  const getAssetIcon = (asset: PiecesAsset) => {
    // Determine icon based on content or name
    const content = asset.content || '';
    const name = asset.name || '';
    
    if (content.includes('function') || content.includes('class') || content.includes('const') || content.includes('let')) {
      return <Code className="w-4 h-4" />;
    }
    
    return <FileText className="w-4 h-4" />;
  };

  const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (selectedAsset) {
            setSelectedAsset(null);
          } else {
            onClose();
          }
        }
      }}
      onKeyDown={handleKeyDown}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="glass w-full max-w-3xl max-h-[80vh] rounded-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-nexus-cyan/10">
              <Puzzle className="w-5 h-5 text-nexus-cyan" />
            </div>
            <div>
              <h2 className="text-lg font-display font-semibold text-white">Pieces OS</h2>
              <p className="text-xs text-slate-500">
                {piecesStatus?.available 
                  ? `Connected${piecesStatus.version ? ` • ${piecesStatus.version}` : ''}`
                  : 'Not connected'
                }
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="px-6 py-4 border-b border-white/5">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your snippets..."
              disabled={!piecesStatus?.available}
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/10
                text-slate-200 placeholder-slate-600
                focus:outline-none focus:border-nexus-cyan/50 focus:ring-1 focus:ring-nexus-cyan/30
                transition-all disabled:opacity-50"
            />
            {isLoading && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-nexus-cyan animate-spin" />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!piecesStatus?.available ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="text-slate-300 font-medium mb-2">Pieces OS Not Available</h3>
              <p className="text-sm text-slate-500 max-w-sm">
                Make sure Pieces OS is running on your system. 
                The default port is 39300.
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-slate-300 font-medium mb-2">Error</h3>
              <p className="text-sm text-slate-500">{error}</p>
              <button
                onClick={loadAllAssets}
                className="mt-4 px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-slate-600" />
              </div>
              <h3 className="text-slate-300 font-medium mb-2">
                {query ? 'No results found' : 'No snippets saved'}
              </h3>
              <p className="text-sm text-slate-500">
                {query 
                  ? 'Try a different search term'
                  : 'Save code snippets in Pieces OS to see them here'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {assets.map((asset) => (
                <motion.div
                  key={asset.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="group p-4 rounded-xl bg-white/5 border border-white/5 hover:border-nexus-cyan/30 
                    hover:bg-white/[0.07] transition-all cursor-pointer"
                  onClick={() => setSelectedAsset(asset)}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-white/5 text-slate-400">
                      {getAssetIcon(asset)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-slate-200 truncate">{asset.name}</h4>
                      <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                        {truncateContent(asset.content)}
                      </p>
                      {asset.tags && asset.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {asset.tags.slice(0, 3).map((tag, i) => (
                            <span 
                              key={i}
                              className="px-2 py-0.5 text-xs rounded-full bg-white/5 text-slate-500"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(asset.content, asset.id);
                        }}
                        className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
                        title="Copy"
                      >
                        {copiedId === asset.id ? (
                          <Check className="w-4 h-4 text-nexus-emerald" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-white/[0.02]">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {assets.length} snippet{assets.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-4">
              <span>Press <kbd className="px-1.5 py-0.5 rounded bg-white/10">ESC</kbd> to close</span>
              <span>Click to preview</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Asset Preview Modal */}
      <AnimatePresence>
        {selectedAsset && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedAsset(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass w-full max-w-2xl max-h-[70vh] rounded-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Preview Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  {getAssetIcon(selectedAsset)}
                  <h3 className="font-medium text-slate-200">{selectedAsset.name}</h3>
                </div>
                <button
                  onClick={() => setSelectedAsset(null)}
                  className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Preview Content */}
              <div className="flex-1 overflow-auto p-6">
                <pre className="p-4 rounded-xl bg-black/30 text-sm text-slate-300 overflow-x-auto">
                  <code>{selectedAsset.content}</code>
                </pre>
                
                {selectedAsset.tags && selectedAsset.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {selectedAsset.tags.map((tag, i) => (
                      <span 
                        key={i}
                        className="px-3 py-1 text-sm rounded-full bg-white/5 text-slate-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview Actions */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/[0.02]">
                <div className="text-xs text-slate-500">
                  Modified: {new Date(selectedAsset.modified).toLocaleDateString()}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleCopy(selectedAsset.content, selectedAsset.id)}
                    className="px-4 py-2 rounded-lg bg-white/5 text-slate-300 hover:bg-white/10 transition-colors flex items-center gap-2"
                  >
                    {copiedId === selectedAsset.id ? (
                      <>
                        <Check className="w-4 h-4 text-nexus-emerald" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                  {onInsertAsset && (
                    <button
                      onClick={() => handleInsert(selectedAsset)}
                      className="px-4 py-2 rounded-lg bg-nexus-cyan/20 text-nexus-cyan hover:bg-nexus-cyan/30 transition-colors flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Insert into Chat
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default PiecesSearchModal;
