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
    <div className="flex flex-col fixed bottom-0 left-0 right-0 z-[3000] h-[75vh] sm:relative sm:inset-auto sm:h-[550px] sm:max-h-[80vh] w-full sm:w-[380px] glass-panel rounded-t-[24px] sm:rounded-2xl overflow-hidden shadow-2xl transition-transform" id="chat-widget">
      
      {/* Mobile Drag Indicator */}
      <div className="w-full flex justify-center pt-3 pb-1 sm:hidden bg-transparent">
        <div className="w-12 h-1.5 bg-zinc-700 rounded-full"></div>
      </div>

      {/* Clean Chat Header */}
      <div className="border-b border-white/5 px-5 py-3 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-lime-400 rounded-full flex items-center justify-center text-black shadow-neon-glow">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-display font-bold text-white tracking-tight uppercase">Coach AI Corsa</h3>
            <p className="text-[10px] text-zinc-400 font-medium tracking-wide uppercase">AI Assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowClearConfirm(true)}
            className="h-10 w-10 flex items-center justify-center text-zinc-400 hover:text-rose-400 hover:bg-white/10 rounded-full transition-colors"
            title="Cancella conversazione"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="h-10 w-10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-colors bg-white/5"
            title="Chiudi chat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-zinc-950" id="chat-messages-container">
        {chatHistory.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {/* Coach Avatar */}
              {!isUser && (
                <div className="h-8 w-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-lime-400 shrink-0">
                  <Activity className="h-4 w-4" />
                </div>
              )}

              <div className={`flex flex-col max-w-[85%] md:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
                {/* Message Bubble */}
                <div className={`px-4 py-3 text-sm rounded-lg leading-relaxed ${
                  isUser
                    ? 'bg-zinc-800 text-zinc-100 rounded-tr-none'
                    : 'bg-zinc-900 text-zinc-200 rounded-tl-none border border-zinc-800/60'
                }`}>
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  ) : (
                    <div className="markdown-body prose prose-invert max-w-none text-zinc-200">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  )}
                </div>

                {/* Saved Plan Subtitle */}
                {!isUser && msg.isPlan && (
                  <span className="mt-1 text-[9px] text-lime-400/85 font-medium uppercase tracking-wider px-1">
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
            <div className="h-8 w-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-lime-400 shrink-0 animate-pulse">
              <Activity className="h-4 w-4" />
            </div>
            <div className="flex flex-col items-start max-w-[75%]">
              <div className="px-4 py-3 bg-zinc-900 text-zinc-400 rounded-lg rounded-tl-none border border-zinc-800/60 flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-lime-400" />
                <span className="text-xs font-medium">Il Coach sta elaborando...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="bg-transparent border-t border-white/5 p-4 flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isSending}
          placeholder="Chiedi un consiglio o crea un piano..."
          className="flex-1 bg-white/5 border border-white/10 focus:border-white/20 rounded-full px-5 py-3.5 text-sm text-white placeholder-zinc-500 outline-none transition-colors"
          id="chat-input-field"
        />
        <button
          type="submit"
          disabled={!input.trim() || isSending}
          className="bg-lime-400 hover:bg-lime-300 disabled:bg-zinc-800 text-black disabled:text-zinc-600 rounded-full h-12 w-12 flex items-center justify-center font-bold transition-colors cursor-pointer shrink-0 shadow-neon-glow"
          id="chat-submit-btn"
        >
          <Send className="h-4 w-4 ml-1" />
        </button>
      </form>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 p-6 rounded-lg max-w-sm w-full shadow-2xl text-center space-y-4"
            >
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-white">Svuotare la chat?</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  L'intera cronologia dei consigli e dei programmi di allenamento generati in questa conversazione verrà cancellata.
                </p>
              </div>
              <div className="flex gap-3 pt-2 text-xs font-medium">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 py-2 rounded transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={async () => {
                    await onClearHistory();
                    setShowClearConfirm(false);
                  }}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-2 rounded transition-colors"
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
