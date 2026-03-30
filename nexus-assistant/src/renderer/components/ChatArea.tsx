// =============================================================================
// NEXUS - Chat Area
// Main chat interface with message display and input
// =============================================================================

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Square, 
  Paperclip,
  Sparkles,
  MoreHorizontal,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  X,
  Puzzle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Terminal,
  Image as ImageIcon,
  Plus,
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { useSettingsStore } from '../stores/settingsStore';
import { Message, Conversation, PiecesAsset } from '../../shared/types';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import PiecesSearchModal from './PiecesSearchModal';
import { ToolExecutionBlock } from './ToolExecutionBlock';

interface ChatAreaProps {
  conversationId: string;
}

// Helper to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Attachment type for images
interface FileAttachment {
  type: 'image';
  base64: string;
  name: string;
  preview: string;
}

const ChatArea: React.FC<ChatAreaProps> = ({ conversationId }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showValidationError, setShowValidationError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPiecesSearchOpen, setIsPiecesSearchOpen] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [toolActionsExpanded, setToolActionsExpanded] = useState(true);

  const { 
    currentConversationData,
    loadConversation,
    sendMessage,
    regenerateLastResponse,
    cancelStream,
    isStreaming,
    streamingContent,
    streamingMessageId,
    streamingThinking,
    activeToolCalls,
    agentDisplayMessages,
    error,
    clearError,
    pendingPrompt,
    clearPendingPrompt,
    createConversation,
    contextResetProposal,
    respondToContextReset,
  } = useAppStore();

  const { settings, piecesStatus } = useSettingsStore();

  // Load conversation data when conversationId changes
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await loadConversation(conversationId);
      setIsLoading(false);
    };
    load();
  }, [conversationId, loadConversation]);

  // Auto-scroll to bottom with user scroll detection
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isUserScrolling && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentConversationData?.messages, streamingContent, activeToolCalls, agentDisplayMessages, isUserScrolling]);

  // Handle scroll events to detect user scrolling
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    
    // If user scrolls up, mark as user scrolling
    if (!isAtBottom) {
      setIsUserScrolling(true);
    } else {
      setIsUserScrolling(false);
    }

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Reset user scrolling after a delay if at bottom
    scrollTimeoutRef.current = setTimeout(() => {
      if (scrollContainerRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        const isStillAtBottom = scrollHeight - scrollTop - clientHeight < 50;
        if (isStillAtBottom) {
          setIsUserScrolling(false);
        }
      }
    }, 1000);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Auto-focus input when conversation changes
  useEffect(() => {
    if (!isLoading && !isStreaming) {
      inputRef.current?.focus();
    }
  }, [conversationId, isLoading, isStreaming]);

  // Check for pending prompt from quick actions
  useEffect(() => {
    if (pendingPrompt) {
      setInputValue(pendingPrompt);
      clearPendingPrompt();
      // Auto-focus after setting value
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [conversationId, pendingPrompt, clearPendingPrompt]);

  // Auto-send pending message from proactive suggestion "Tell me more"
  useEffect(() => {
    if (
      isLoading ||
      isStreaming ||
      !currentConversationData ||
      currentConversationData.id !== conversationId ||
      currentConversationData.messages.length > 0
    ) {
      return;
    }
    const content = sessionStorage.getItem('pendingProactiveMessage');
    if (content) {
      sessionStorage.removeItem('pendingProactiveMessage');
      sendMessage(conversationId, content, settings.defaultModel);
    }
  }, [conversationId, isLoading, isStreaming, currentConversationData, sendMessage, settings.defaultModel]);

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || isStreaming) return;
    
    clearError();
    
    // Send with attachments if any
    const attachmentData = attachments.length > 0 
      ? attachments.map(a => ({ type: a.type, base64: a.base64, name: a.name }))
      : undefined;
    
    sendMessage(conversationId, inputValue.trim(), settings.defaultModel, attachmentData);
    setInputValue('');
    setAttachments([]);
    
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  }, [inputValue, isStreaming, conversationId, settings.defaultModel, sendMessage, clearError, attachments]);

  // Handle file selection for attachments
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const newAttachments: FileAttachment[] = [];
    
    for (const file of Array.from(files)) {
      // Only accept images
      if (!file.type.startsWith('image/')) {
        continue;
      }
      
      // Limit file size to 10MB
      if (file.size > 10 * 1024 * 1024) {
        continue;
      }
      
      try {
        const base64 = await fileToBase64(file);
        const preview = URL.createObjectURL(file);
        
        newAttachments.push({
          type: 'image',
          base64,
          name: file.name,
          preview,
        });
      } catch (err) {
        console.error('Failed to read file:', err);
      }
    }
    
    setAttachments(prev => [...prev, ...newAttachments].slice(0, 4)); // Max 4 attachments
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => {
      const updated = [...prev];
      // Revoke object URL to prevent memory leak
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  }, []);

  const handleRegenerate = useCallback(() => {
    regenerateLastResponse();
  }, [regenerateLastResponse]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    // Clear validation error when user types
    if (showValidationError && value.trim()) {
      setShowValidationError(false);
    }
    
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInsertAsset = (asset: PiecesAsset) => {
    const assetText = `\n\n[From Pieces: ${asset.name}]\n\`\`\`\n${asset.content}\n\`\`\`\n`;
    setInputValue((prev) => prev + assetText);
    // Focus input after insertion
    inputRef.current?.focus();
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 border-2 border-nexus-cyan/30 border-t-nexus-cyan rounded-full"
          />
          <div className="text-slate-400">Loading conversation...</div>
        </div>
      </div>
    );
  }

  // Show not found state
  if (!currentConversationData || currentConversationData.id !== conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-slate-500" />
          </div>
          <div>
            <div className="text-slate-400 font-medium">Conversation not found</div>
            <div className="text-slate-500 text-sm mt-1">The conversation may have been deleted</div>
          </div>
        </div>
      </div>
    );
  }

  const conversation = currentConversationData;

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Chat Header */}
      <div className="h-14 flex items-center justify-between px-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-nexus-cyan" />
          <span className="font-medium text-slate-200">{conversation.title}</span>
          <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-slate-400">
            {settings.defaultModel}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => createConversation()}
            disabled={isStreaming}
            className="p-2 rounded-lg text-slate-400 hover:text-nexus-cyan hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="New chat"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button className="p-2 rounded-lg text-slate-400 hover:text-slate-300 hover:bg-white/5">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mx-6 mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-red-400 font-medium">Error</div>
              <div className="text-red-300/80 text-sm mt-1">{error}</div>
            </div>
            <button
              onClick={clearError}
              className="p-1 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Context Reset Proposal */}
      <AnimatePresence>
        {contextResetProposal && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-6 mt-4 p-4 rounded-xl glass border border-white/10"
          >
            <div className="text-slate-200 text-sm mb-3">{contextResetProposal.message}</div>
            <div className="flex gap-2">
              <button
                onClick={() => respondToContextReset(contextResetProposal.id, true)}
                className="btn-primary px-3 py-1.5 text-sm"
              >
                Yes, summarize and start fresh
              </button>
              <button
                onClick={() => respondToContextReset(contextResetProposal.id, false)}
                className="btn-secondary px-3 py-1.5 text-sm"
              >
                No, keep going
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Area */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-6 py-6 space-y-6"
      >
        <AnimatePresence initial={false}>
          {conversation.messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              isStreaming={false}
              onCopy={(content) => handleCopy(content, message.id)}
              onRegenerate={message.role === 'assistant' ? handleRegenerate : undefined}
              copiedId={copiedId}
            />
          ))}
          
          {/* Agent display messages (from display_message tool) */}
          {agentDisplayMessages
            .filter((d) => d.conversationId === conversationId)
            .map((d) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`
                  rounded-xl border p-4 text-sm
                  ${d.messageType === 'success' ? 'bg-nexus-emerald/10 border-nexus-emerald/30 text-nexus-emerald' : ''}
                  ${d.messageType === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : ''}
                  ${d.messageType === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-300' : ''}
                  ${d.messageType === 'info' || !d.messageType ? 'bg-nexus-cyan/10 border-nexus-cyan/30 text-slate-200' : ''}
                `}
              >
                {d.title && (
                  <div className="font-medium mb-2 text-slate-100">{d.title}</div>
                )}
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown
                    components={{
                      code: ({ inline, className, children, ...props }: { inline?: boolean; className?: string; children?: React.ReactNode }) => {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                          <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div" className="rounded-lg text-xs">
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className="bg-black/20 px-1 rounded" {...props}>{children}</code>
                        );
                      },
                    }}
                  >
                    {d.message}
                  </ReactMarkdown>
                </div>
              </motion.div>
            ))}

          {/* Streaming Message */}
          {isStreaming && streamingMessageId && (
            <MessageBubble
              key={streamingMessageId}
              message={{
                id: streamingMessageId,
                role: 'assistant',
                content: streamingContent,
                timestamp: Date.now(),
                model: settings.defaultModel,
                metadata: streamingThinking ? { thinking: streamingThinking } : undefined,
              }}
              isStreaming={true}
              onCopy={(content) => handleCopy(content, streamingMessageId)}
              onRegenerate={undefined}
              copiedId={copiedId}
            />
          )}
          
          {/* Tool Execution Blocks: summary (collapsed) or full list (expanded) */}
          {activeToolCalls.length > 0 && (
            <div className="space-y-2">
              {!toolActionsExpanded ? (
                <button
                  type="button"
                  onClick={() => setToolActionsExpanded(true)}
                  className="w-full rounded-xl border border-nexus-cyan/30 bg-white/5 px-4 py-3 flex items-center gap-3 text-left hover:bg-white/8 transition-colors"
                >
                  <Terminal className="w-4 h-4 text-nexus-cyan flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-slate-200">
                      {activeToolCalls.length} action{activeToolCalls.length !== 1 ? 's' : ''}
                    </span>
                    {(() => {
                      const running = activeToolCalls.filter((t) => t.status === 'running').length;
                      const complete = activeToolCalls.filter((t) => t.status === 'complete').length;
                      const failed = activeToolCalls.filter((t) => t.status === 'error').length;
                      const parts: string[] = [];
                      if (running) parts.push(`${running} running`);
                      if (complete) parts.push(`${complete} complete`);
                      if (failed) parts.push(`${failed} failed`);
                      return parts.length > 0 ? (
                        <span className="text-slate-500 text-sm ml-2">({parts.join(', ')})</span>
                      ) : null;
                    })()}
                    <div className="text-slate-500 font-mono text-xs mt-1 truncate">
                      {(() => {
                        const names = activeToolCalls.map((t) => t.toolName).join(', ');
                        return names.length > 70 ? `${names.slice(0, 70)}...` : names;
                      })()}
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0" />
                </button>
              ) : (
                <>
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => setToolActionsExpanded(false)}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 text-xs transition-colors"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                      Show summary
                    </button>
                  </div>
                  {activeToolCalls.map((tool) => (
                    <ToolExecutionBlock
                      key={tool.toolCallId}
                      tool={tool}
                      onCancel={cancelStream}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </AnimatePresence>
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          {/* Attachment Preview */}
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {attachments.map((attachment, index) => (
                <div 
                  key={index}
                  className="relative group w-16 h-16 rounded-lg overflow-hidden bg-white/5 border border-white/10"
                >
                  <img 
                    src={attachment.preview} 
                    alt={attachment.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removeAttachment(index)}
                    className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white 
                      opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className="glass rounded-2xl p-2">
            <div className="flex items-end gap-2">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-3 rounded-xl text-slate-400 hover:text-slate-300 hover:bg-white/5 transition-colors"
                title="Attach images"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              
              {piecesStatus === 'connected' && (
                <button 
                  onClick={() => setIsPiecesSearchOpen(true)}
                  className="p-3 rounded-xl text-slate-400 hover:text-nexus-cyan hover:bg-nexus-cyan/10 transition-colors"
                  title="Search Pieces OS"
                >
                  <Puzzle className="w-5 h-5" />
                </button>
              )}
              
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={isStreaming ? "AI is responding..." : "Message NEXUS..."}
                disabled={isStreaming}
                className="flex-1 bg-transparent text-slate-200 placeholder-slate-400 resize-none py-3 px-2 outline-none max-h-[200px] min-h-[44px]"
                rows={1}
              />
              
              {isStreaming ? (
                <button
                  onClick={cancelStream}
                  className="p-3 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                  title="Stop generating"
                >
                  <Square className="w-5 h-5" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                  className="p-3 rounded-xl bg-nexus-cyan/20 text-nexus-cyan 
                    hover:bg-nexus-cyan/30 disabled:opacity-30 disabled:cursor-not-allowed
                    transition-all duration-200"
                >
                  <Send className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          
          <div className="text-center mt-2 text-xs text-slate-500">
            NEXUS can make mistakes. Consider checking important information.
          </div>
        </div>
      </div>

      {/* Pieces Search Modal */}
      <PiecesSearchModal
        isOpen={isPiecesSearchOpen}
        onClose={() => setIsPiecesSearchOpen(false)}
        onInsertAsset={handleInsertAsset}
      />
    </div>
  );
};

// =============================================================================
// Message Bubble
// =============================================================================

interface MessageBubbleProps {
  message: Message;
  isStreaming: boolean;
  onCopy: (content: string) => void;
  onRegenerate?: () => void;
  copiedId: string | null;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isStreaming,
  onCopy,
  onRegenerate,
  copiedId,
}) => {
  const isUser = message.role === 'user';
  const isCopied = copiedId === message.id;
  const content = typeof message.content === 'string' ? message.content : 
    (Array.isArray(message.content) ? message.content.find(c => c.type === 'text')?.text || '' : '');
  const hasThinking = message.metadata?.thinking;
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);
  
  // Get any image attachments
  const imageAttachments = Array.isArray(message.content) 
    ? message.content.filter(c => c.type === 'image_url') 
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`flex gap-4 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div className={`
        w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0
        ${isUser 
          ? 'bg-slate-700' 
          : 'bg-gradient-to-br from-nexus-cyan/30 to-nexus-violet/30'
        }
      `}>
        {isUser ? (
          <span className="text-xs font-medium text-slate-300">You</span>
        ) : (
          <Sparkles className="w-4 h-4 text-nexus-cyan" />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Collapsible Thinking block */}
        {hasThinking && !isUser && (
          <div className="mb-2 rounded-lg bg-white/5 border border-white/5 text-xs text-slate-400 overflow-hidden">
            <button
              onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
              className="w-full px-4 py-2 flex items-center gap-2 hover:bg-white/5 transition-colors"
            >
              {isThinkingExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <span className="font-medium">Thinking</span>
              {!isThinkingExpanded && (
                <span className="opacity-60 truncate flex-1 text-left">
                  {message.metadata?.thinking?.slice(0, 50)}...
                </span>
              )}
            </button>
            <AnimatePresence>
              {isThinkingExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="px-4 pb-2"
                >
                  <div className="italic opacity-80 whitespace-pre-wrap">
                    {message.metadata?.thinking}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        
        {/* Image attachments for user messages */}
        {isUser && imageAttachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 justify-end">
            {imageAttachments.map((img, index) => (
              <div 
                key={index}
                className="w-20 h-20 rounded-lg overflow-hidden bg-white/5 border border-white/10"
              >
                <img 
                  src={img.image_url?.url} 
                  alt={`Attachment ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
          </div>
        )}

        <div className={`
          rounded-2xl px-5 py-4
          ${isUser 
            ? 'bg-slate-700/50 text-slate-200' 
            : 'glass border border-white/10'
          }
        `}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{content}</p>
          ) : (
            <div className="markdown-content">
              <ReactMarkdown
                components={{
                  code({ inline, className, children, ...props }: { inline?: boolean; className?: string; children?: React.ReactNode }) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={vscDarkPlus}
                        language={match[1]}
                        PreTag="div"
                        {...props}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {content + (isStreaming ? '▌' : '')}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Actions */}
        {!isUser && !isStreaming && content && (
          <div className="flex items-center gap-1 mt-2">
            <button
              onClick={() => onCopy(content)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-300 hover:bg-white/5"
              title="Copy"
            >
              {isCopied ? (
                <Check className="w-3.5 h-3.5 text-nexus-emerald" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-300 hover:bg-white/5"
                title="Regenerate response"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Thinking indicator */}
        {isStreaming && !content && (
          <div className="flex items-center gap-1 mt-2 ml-2">
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ChatArea;
