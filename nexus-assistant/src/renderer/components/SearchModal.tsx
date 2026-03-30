// =============================================================================
// NEXUS - Search Modal
// Global conversation search with highlighting and keyboard navigation
// =============================================================================

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  X, 
  Clock, 
  MessageSquare, 
  Command,
  ArrowDown,
  ArrowUp,
  CornerDownLeft,
  Trash2,
  Loader2,
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { ConversationSearchResult, SearchMatch, MessageMatch } from '../../shared/types';
import { useEscapeKey, useArrowNavigation } from '../hooks/useKeyboardShortcut';

// =============================================================================
// Constants
// =============================================================================

const RECENT_SEARCHES_KEY = 'nexus:recent-searches';
const DEBOUNCE_MS = 200;
const MAX_RECENT_SEARCHES = 10;

// =============================================================================
// Helper: Highlight Text Component
// =============================================================================

interface HighlightTextProps {
  text: string;
  matches: SearchMatch[];
  className?: string;
}

const HighlightText: React.FC<HighlightTextProps> = ({ text, matches, className = '' }) => {
  if (!matches || matches.length === 0) {
    return <span className={className}>{text}</span>;
  }
  
  const parts: React.ReactNode[] = [];
  let lastEnd = 0;
  
  for (const match of matches) {
    // Add text before match
    if (match.start > lastEnd) {
      parts.push(
        <span key={`text-${lastEnd}`}>
          {text.slice(lastEnd, match.start)}
        </span>
      );
    }
    
    // Add highlighted match
    parts.push(
      <mark 
        key={`highlight-${match.start}`}
        className="bg-nexus-cyan/30 text-nexus-cyan rounded px-0.5 font-medium"
      >
        {text.slice(match.start, match.end)}
      </mark>
    );
    
    lastEnd = match.end;
  }
  
  // Add remaining text
  if (lastEnd < text.length) {
    parts.push(
      <span key={`text-${lastEnd}`}>
        {text.slice(lastEnd)}
      </span>
    );
  }
  
  return <span className={className}>{parts}</span>;
};

// =============================================================================
// Helper: Format Relative Time
// =============================================================================

const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 30) {
    return `${Math.floor(days / 30)}mo ago`;
  }
  if (days > 0) {
    return `${days}d ago`;
  }
  if (hours > 0) {
    return `${hours}h ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  return 'just now';
};

// =============================================================================
// Main SearchModal Component
// =============================================================================

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const { 
    searchQuery, 
    searchResults, 
    isSearching, 
    recentSearches,
    setSearchQuery, 
    searchConversations,
    clearSearch,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
    selectConversation,
  } = useAppStore();
  
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen]);
  
  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    if (searchQuery.trim()) {
      debounceRef.current = setTimeout(() => {
        searchConversations(searchQuery);
      }, DEBOUNCE_MS);
    } else {
      clearSearch();
    }
    
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery, searchConversations, clearSearch]);
  
  // Handle escape key
  useEscapeKey(onClose, isOpen);
  
  // Flatten results for keyboard navigation
  const flatResults = useMemo(() => {
    const items: Array<
      | { type: 'conversation'; result: ConversationSearchResult; index: number }
      | { type: 'message'; result: ConversationSearchResult; message: MessageMatch; index: number }
    > = [];
    
    let index = 0;
    for (const result of searchResults) {
      items.push({ type: 'conversation', result, index: index++ });
      const matches = result.messageMatches || [];
      for (const message of matches.slice(0, 2)) {
        items.push({ type: 'message', result, message, index: index++ });
      }
    }
    
    return items;
  }, [searchResults]);
  
  // Keyboard navigation
  const { selectedIndex, setSelectedIndex } = useArrowNavigation({
    itemCount: flatResults.length,
    onSelect: (index) => {
      const item = flatResults[index];
      if (item) {
        handleSelect(item.result.conversationId);
      }
    },
    enabled: isOpen && searchResults.length > 0,
  });
  
  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultsContainerRef.current) {
      const selectedElement = resultsContainerRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      );
      selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);
  
  // Handle selection
  const handleSelect = useCallback((conversationId: string) => {
    if (searchQuery.trim()) {
      addRecentSearch(searchQuery.trim());
    }
    selectConversation(conversationId);
    onClose();
  }, [searchQuery, addRecentSearch, selectConversation, onClose]);
  
  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }, [onClose]);
  
  // Handle recent search click
  const handleRecentSearchClick = (query: string) => {
    setSearchQuery(query);
    searchConversations(query);
  };
  
  // Clear search when closing
  const handleClose = () => {
    clearSearch();
    onClose();
  };
  
  const hasResults = searchResults.length > 0;
  const hasQuery = searchQuery.trim().length > 0;
  const showRecentSearches = !hasQuery && recentSearches.length > 0;
  const showEmptyState = hasQuery && !isSearching && !hasResults;
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] p-4 
            bg-black/50 backdrop-blur-sm"
          onClick={handleBackdropClick}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: -10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full max-w-2xl bg-[var(--color-bg-primary)]/95 backdrop-blur-xl
              rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input Header */}
            <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations..."
                  className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl
                    text-slate-200 placeholder-slate-500 text-sm
                    focus:outline-none focus:border-nexus-cyan/50 focus:bg-white/10
                    transition-all duration-200"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      inputRef.current?.focus();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg
                      text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              {/* Keyboard Hint */}
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
                  <Command className="w-3 h-3 inline" />
                </kbd>
                <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10">K</kbd>
              </div>
            </div>
            
            {/* Results Container */}
            <div 
              ref={resultsContainerRef}
              className="max-h-[50vh] overflow-y-auto"
            >
              {/* Loading State */}
              {isSearching && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-nexus-cyan animate-spin" />
                  <span className="ml-3 text-sm text-slate-400">Searching...</span>
                </div>
              )}
              
              {/* Recent Searches */}
              {showRecentSearches && !isSearching && (
                <div className="p-2">
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Recent Searches
                    </span>
                    <button
                      onClick={clearRecentSearches}
                      className="flex items-center gap-1.5 text-xs text-slate-500 
                        hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear
                    </button>
                  </div>
                  <div className="space-y-0.5">
                    {recentSearches.map((query, index) => (
                      <motion.button
                        key={`${query}-${index}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => handleRecentSearchClick(query)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                          text-left text-sm text-slate-300
                          hover:bg-white/5 transition-colors group"
                      >
                        <Clock className="w-4 h-4 text-slate-500 group-hover:text-nexus-cyan transition-colors" />
                        <span className="flex-1 truncate">{query}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRecentSearch(query);
                          }}
                          className="p-1 rounded opacity-0 group-hover:opacity-100
                            text-slate-500 hover:text-red-400 hover:bg-red-500/10
                            transition-all"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Search Results */}
              {hasResults && !isSearching && (
                <div className="p-2">
                  {searchResults.map((result, resultIndex) => (
                    <div key={result.conversationId} className="mb-2 last:mb-0">
                      {/* Conversation Header */}
                      <button
                        data-index={flatResults.findIndex(
                          (i): i is { type: 'conversation'; result: ConversationSearchResult; index: number } => 
                            i.type === 'conversation' && i.result.conversationId === result.conversationId
                        )}
                        onClick={() => handleSelect(result.conversationId)}
                        onMouseEnter={() => setSelectedIndex(
                          flatResults.findIndex(
                            i => i.type === 'conversation' && i.result.conversationId === result.conversationId
                          )
                        )}
                        className={`
                          w-full flex items-center gap-3 px-3 py-3 rounded-xl
                          text-left transition-all duration-150
                          ${selectedIndex === flatResults.findIndex(
                            i => i.type === 'conversation' && i.result.conversationId === result.conversationId
                          ) 
                            ? 'bg-white/10 border border-white/10' 
                            : 'hover:bg-white/5 border border-transparent'
                          }
                        `}
                      >
                        <div className={`
                          w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                          ${selectedIndex === flatResults.findIndex(
                            i => i.type === 'conversation' && i.result.conversationId === result.conversationId
                          )
                            ? 'bg-gradient-to-br from-nexus-cyan/30 to-nexus-violet/30'
                            : 'bg-white/5'
                          }
                        `}>
                          <MessageSquare className={`
                            w-4 h-4 
                            ${selectedIndex === flatResults.findIndex(
                              i => i.type === 'conversation' && i.result.conversationId === result.conversationId
                            )
                              ? 'text-nexus-cyan'
                              : 'text-slate-400'
                            }
                          `} />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            <HighlightText 
                              text={result.title || 'Untitled'} 
                              matches={result.titleMatches || []}
                              className="text-slate-200"
                            />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>{result.messageCount} messages</span>
                            <span>•</span>
                            <span>{result.updatedAt ? formatRelativeTime(result.updatedAt) : 'Unknown date'}</span>
                            {(result.messageMatches || []).length > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-nexus-cyan/70">
                                  {(result.messageMatches || []).length} match{(result.messageMatches || []).length !== 1 ? 'es' : ''}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                      
                      {/* Message Matches */}
                      {(result.messageMatches || []).slice(0, 2).map((messageMatch, msgIndex) => (
                        <button
                          key={messageMatch.messageId}
                          data-index={flatResults.findIndex(
                            i => i.type === 'message' && 
                              i.message?.messageId === messageMatch.messageId
                          )}
                          onClick={() => handleSelect(result.conversationId)}
                          onMouseEnter={() => setSelectedIndex(
                            flatResults.findIndex(
                              i => i.type === 'message' && 
                                i.message?.messageId === messageMatch.messageId
                            )
                          )}
                          className={`
                            w-full flex items-start gap-3 px-3 py-2.5 ml-4 mt-0.5 rounded-lg
                            text-left transition-all duration-150 border-l-2
                            ${selectedIndex === flatResults.findIndex(
                              i => i.type === 'message' && 
                                i.message?.messageId === messageMatch.messageId
                            )
                              ? 'bg-white/10 border-nexus-cyan' 
                              : 'hover:bg-white/5 border-white/10'
                            }
                          `}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-slate-500 mb-1">
                              {messageMatch.role === 'user' ? 'You' : 'Assistant'}
                            </div>
                            <div className="text-sm text-slate-300 line-clamp-2">
                              <HighlightText 
                                text={messageMatch.context || ''} 
                                matches={messageMatch.matches || []}
                              />
                            </div>
                          </div>
                        </button>
                      ))}
                      
                      {/* Show more indicator */}
                      {(result.messageMatches || []).length > 2 && (
                        <div className="px-3 py-1.5 ml-4 text-xs text-slate-500">
                          +{(result.messageMatches || []).length - 2} more match{(result.messageMatches || []).length - 2 !== 1 ? 'es' : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Empty State */}
              {showEmptyState && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <Search className="w-7 h-7 text-slate-500" />
                  </div>
                  <p className="text-slate-300 font-medium mb-1">No results found</p>
                  <p className="text-slate-500 text-sm max-w-xs">
                    Try different keywords or check your spelling
                  </p>
                </div>
              )}
              
              {/* Initial State - No query */}
              {!hasQuery && recentSearches.length === 0 && !isSearching && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <Search className="w-7 h-7 text-nexus-cyan/50" />
                  </div>
                  <p className="text-slate-300 font-medium mb-1">Search conversations</p>
                  <p className="text-slate-500 text-sm max-w-xs">
                    Search for keywords in your conversation titles and messages
                  </p>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 
              border-t border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <CornerDownLeft className="w-3 h-3" />
                  to select
                </span>
                <span className="flex items-center gap-1">
                  <ArrowUp className="w-3 h-3" />
                  <ArrowDown className="w-3 h-3" />
                  to navigate
                </span>
              </div>
              
              {hasResults && (
                <span className="text-xs text-slate-500">
                  {searchResults.reduce((acc, r) => acc + (r.messageMatches || []).length, 0)} matches in {searchResults.length} conversations
                </span>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SearchModal;
