/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { Send, Trash2, Sparkles, Activity, RefreshCw, X } from 'lucide-react';
import { ChatMessage } from '../types.js';

interface ChatProps {
  chatHistory: ChatMessage[];
  onSendMessage: (message: string, forcePremium: boolean) => Promise<void>;
  onClearHistory: () => Promise<void>;
  isSending: boolean;
  onClose: () => void;
}

export default function Chat({ chatHistory, onSendMessage, onClearHistory, isSending, onClose }: ChatProps) {
  const [input, setInput] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isSending]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;

    // Send with default auto settings
    onSendMessage(input, false);
    setInput('');
  };

  return (
    <div className="flex flex-col w-full h-[calc(100vh-160px)] clean-panel overflow-hidden" id="chat-container">
      
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-[var(--app-bg)]" id="chat-messages-container">
        {chatHistory.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {/* Coach Avatar */}
              {!isUser && (
                <div className="h-8 w-8 rounded-full clean-panel flex items-center justify-center text-accent-lime shrink-0 shadow-sm">
                  <Activity className="h-4 w-4" />
                </div>
              )}

              <div className={`flex flex-col max-w-[85%] md:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
                {/* Message Bubble */}
                <div className={`px-4 py-3 text-sm rounded-2xl leading-relaxed shadow-sm ${
                  isUser
                    ? 'bg-primary text-[var(--app-bg)] dark:bg-white dark:text-black rounded-br-sm'
                    : 'clean-panel rounded-bl-sm border border-subtle'
                }`}>
                  {isUser ? (
                    <p className="whitespace-pre-wrap font-medium">{msg.text}</p>
                  ) : (
                    <div className="markdown-body prose prose-sm max-w-none text-primary">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  )}
                </div>

                {/* Saved Plan Subtitle */}
                {!isUser && msg.isPlan && (
                  <span className="mt-1.5 text-[9px] text-accent-lime font-bold uppercase tracking-wider px-1">
                    ✓ Programma di allenamento memorizzato
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading State */}
        {isSending && (
          <div className="flex gap-3 justify-start">
            <div className="h-8 w-8 rounded-full clean-panel flex items-center justify-center text-accent-lime shrink-0 animate-pulse shadow-sm">
              <Activity className="h-4 w-4" />
            </div>
            <div className="flex flex-col items-start max-w-[75%]">
              <div className="px-4 py-3 clean-panel rounded-2xl rounded-bl-sm border border-subtle flex items-center gap-2 shadow-sm">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-accent-lime" />
                <span className="text-xs font-medium text-secondary">Il Coach sta elaborando...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="clean-panel border-t-0 rounded-none rounded-b-[16px] sm:rounded-b-[24px] p-4 flex flex-col gap-3 z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.2)]">
        <form onSubmit={handleSend} className="flex gap-3 relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isSending}
            placeholder="Chiedi un consiglio o crea un piano..."
            className="flex-1 bg-surface-inset border border-subtle focus:border-default rounded-full px-5 py-3.5 text-sm text-primary placeholder:text-muted outline-none transition-colors"
            id="chat-input-field"
          />
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            className="bg-accent-lime hover:opacity-90 disabled:bg-surface-inset disabled:border disabled:border-subtle text-black disabled:text-muted rounded-full h-[52px] w-[52px] flex items-center justify-center font-bold transition-all cursor-pointer shrink-0 shadow-sm active:scale-95"
            id="chat-submit-btn"
          >
            <Send className="h-4 w-4 ml-0.5" />
          </button>
        </form>
        <div className="flex justify-between items-center px-2">
          <span className="text-[10px] text-muted uppercase tracking-wider font-bold flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-accent-lime" />
            Coach AI
          </span>
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            className="text-[10px] text-muted hover:text-accent-rose uppercase tracking-wider font-bold transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="h-3 w-3" />
            Svuota Chat
          </button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="clean-panel p-6 max-w-sm w-full shadow-2xl text-center space-y-4"
            >
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-primary">Svuotare la chat?</h4>
                <p className="text-xs text-secondary leading-relaxed">
                  L'intera cronologia dei consigli e dei programmi di allenamento generati in questa conversazione verrà cancellata.
                </p>
              </div>
              <div className="flex gap-3 pt-2 text-xs font-bold">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 bg-surface-inset border border-subtle hover:border-default text-primary py-2.5 rounded-lg transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={async () => {
                    await onClearHistory();
                    setShowClearConfirm(false);
                  }}
                  className="flex-1 bg-accent-rose text-white py-2.5 rounded-lg transition-colors hover:opacity-90 shadow-sm"
                >
                  Svuota
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
