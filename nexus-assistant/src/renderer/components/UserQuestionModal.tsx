// =============================================================================
// NEXUS - User Question Modal
// Modal for agent ask_user tool: question, text input, choice, or confirm
// =============================================================================

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X } from 'lucide-react';

export interface AskUserRequest {
  requestId: string;
  question: string;
  options: string[];
  inputType: 'text' | 'choice' | 'confirm';
  conversationId: string;
}

interface UserQuestionModalProps {
  request: AskUserRequest | null;
  onSubmit: (requestId: string, answer: string) => void;
  onCancel: (requestId: string) => void;
}

export const UserQuestionModal: React.FC<UserQuestionModalProps> = ({
  request,
  onSubmit,
  onCancel,
}) => {
  const [textValue, setTextValue] = useState('');

  useEffect(() => {
    if (request) setTextValue('');
  }, [request?.requestId]);

  if (!request) return null;

  const handleSubmit = (answer: string) => {
    if (!answer.trim() && request.inputType === 'text') return;
    onSubmit(request.requestId, answer.trim() || answer);
  };

  const handleKeyDown = (e: React.KeyboardEvent, answer?: string) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel(request.requestId);
    }
    if (e.key === 'Enter' && !e.shiftKey && request.inputType === 'text' && textValue.trim()) {
      e.preventDefault();
      handleSubmit(textValue.trim());
    }
    if (e.key === 'Enter' && answer !== undefined) {
      e.preventDefault();
      handleSubmit(answer);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={() => onCancel(request.requestId)}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-md rounded-2xl overflow-hidden bg-[var(--color-bg-secondary)]/95 backdrop-blur-xl border border-nexus-cyan/30 shadow-[0_0_30px_rgba(0,240,255,0.15)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 pt-6 pb-4 border-b border-white/10 flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-nexus-cyan/20 flex items-center justify-center text-nexus-cyan">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Agent is asking</p>
              <p className="text-slate-200 leading-snug">{request.question}</p>
            </div>
            <button
              type="button"
              onClick={() => onCancel(request.requestId)}
              className="flex-shrink-0 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-4 space-y-4">
            {request.inputType === 'text' && (
              <div>
                <label className="block text-xs text-slate-500 mb-2">Your response</label>
                <textarea
                  autoFocus
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your answer..."
                  className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-slate-200 placeholder-slate-500 focus:border-nexus-cyan/50 focus:ring-1 focus:ring-nexus-cyan/30 outline-none resize-none"
                  rows={3}
                />
              </div>
            )}

            {request.inputType === 'choice' && request.options.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs text-slate-500">Choose one</label>
                <div className="flex flex-col gap-2">
                  {request.options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => handleSubmit(opt)}
                      onKeyDown={(e) => handleKeyDown(e, opt)}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-left text-slate-200 hover:bg-nexus-cyan/10 hover:border-nexus-cyan/30 transition-colors"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {request.inputType === 'confirm' && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleSubmit('yes')}
                  onKeyDown={(e) => handleKeyDown(e, 'yes')}
                  className="flex-1 px-4 py-3 rounded-xl bg-nexus-emerald/20 border border-nexus-emerald/30 text-nexus-emerald hover:bg-nexus-emerald/30 transition-colors"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit('no')}
                  onKeyDown={(e) => handleKeyDown(e, 'no')}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors"
                >
                  No
                </button>
              </div>
            )}

            {request.inputType === 'text' && (
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onCancel(request.requestId)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleSubmit(textValue.trim())}
                  disabled={!textValue.trim()}
                  className="px-4 py-2 rounded-xl bg-nexus-cyan/20 text-nexus-cyan border border-nexus-cyan/30 hover:bg-nexus-cyan/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default UserQuestionModal;
