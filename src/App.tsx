/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, TrendingUp, Home, Calendar, Zap, Sparkles, Sun, Moon } from 'lucide-react';
import { Activity as ActivityType, ChatMessage, RunningStats } from './types.js';
import Dashboard from './components/Dashboard.tsx';
import Chat from './components/Chat.tsx';
import History from './components/History.tsx';
import Admin from './components/Admin.tsx';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history'>('dashboard');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [stats, setStats] = useState<RunningStats>({
    totalActivities: 0,
    totalKm: 0,
    totalDurationHours: 0,
    avgPace: '--:--',
    avgHr: 0
  });

  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Fetch all initial data
  const fetchData = async () => {
    try {
      // 1. Stats
      const statsRes = await fetch('/api/stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // 2. Activities
      const actRes = await fetch('/api/activities?limit=100');
      if (actRes.ok) {
        const actData = await actRes.json();
        setActivities(actData.activities);
      }

      // 3. Chat History
      const chatRes = await fetch('/api/chat-history');
      if (chatRes.ok) {
        const chatData = await chatRes.json();
        setChatHistory(chatData.history);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Send message
  const handleSendMessage = async (message: string, forcePremium: boolean) => {
    setIsSending(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, forcePremium })
      });

      if (response.ok) {
        const result = await response.json();
        setChatHistory(prev => [...prev, result.user_message, result.assistant_response]);

        // Refresh data if a training plan was added/saved
        if (result.is_plan) {
          fetchData();
        }
      }
    } catch (error) {
      console.error('Network error during chat:', error);
    } finally {
      setIsSending(false);
    }
  };

  // Clear chat
  const handleClearChatHistory = async () => {
    try {
      const response = await fetch('/api/chat-clear', { method: 'POST' });
      if (response.ok) {
        setChatHistory([
          {
            id: 'chat_init',
            sender: 'assistant',
            text: `Ciao, Runner! 🏃\n\nBenvenuto su **tommytegamino_run**.\n\nSono qui per aiutarti a ottimizzare le tue sessioni di corsa e strutturare i tuoi allenamenti.\n\n- **Consigli e Piani**: Chiedimi pareri sulle tue statistiche o domandami di creare piani completi (es. *"crea una tabella di 4 settimane per preparare una maratona"*).\n- **Sincronizzazione file TCX**: Puoi caricare i file delle tue corse (.tcx) direttamente nella scheda **Attività** per aggiornare le statistiche e visualizzare il grafico dei tuoi progressi.`,
            timestamp: new Date().toISOString()
          }
        ]);
      }
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  };

  // Upload TCX
  const handleUploadTcx = async (files: File[]) => {
    if (files.length === 0) return;
    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    // Chunk files into batches of 5 to avoid Vercel 4.5MB payload limit on Serverless Functions
    const BATCH_SIZE = 5;
    let successCount = 0;
    let failedCount = 0;
    let lastActivityName = '';
    let detailedError = '';

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const formData = new FormData();
      batch.forEach(f => formData.append('files', f));

      try {
        const response = await fetch('/api/upload-tcx', {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const result = await response.json();
          successCount += result.successCount || 0;
          failedCount += result.failedCount || 0;
          if (result.activity) lastActivityName = result.activity.name;
        } else {
          const text = await response.text();
          console.error('Batch error:', text);
          try {
            const errObj = JSON.parse(text);
            if (errObj.errors && errObj.errors.length > 0) {
              detailedError = errObj.errors.join(' | ');
            } else if (errObj.error) {
              detailedError = errObj.error;
            }
          } catch (e) {
            // plain text
          }
          failedCount += batch.length;
        }
      } catch (error: any) {
        console.error('Network error during upload:', error);
        failedCount += batch.length;
      }
    }

    if (successCount > 0) {
      if (files.length === 1) {
        setUploadSuccess(`Sincronizzata corsa: "${lastActivityName || 'Nuova attività'}"`);
      } else {
        setUploadSuccess(`Sincronizzati con successo ${successCount} allenamenti! ${failedCount > 0 ? `(${failedCount} falliti)` : ''}`);
      }
      if (detailedError) setUploadError(detailedError);
      await fetchData();
      setTimeout(() => setUploadSuccess(null), 5000);
    } else {
      setUploadError(detailedError || `Errore: impossibile caricare i file. ${failedCount} falliti.`);
    }
    
    setIsUploading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 flex flex-col font-sans" id="app-root-container">

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 pb-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={isAdminOpen ? 'admin' : activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {isAdminOpen ? (
              <Admin onClose={() => {
                setIsAdminOpen(false);
                fetchData(); // refresh in case activities were deleted/renamed
              }} />
            ) : activeTab === 'dashboard' ? (
              <Dashboard
                stats={stats}
                activities={activities}
                onNavigateToHistory={() => setActiveTab('history')}
                onSecretUnlock={() => setIsAdminOpen(true)}
              />
            ) : (
              <History
                activities={activities}
                onUploadTcx={handleUploadTcx}
                isUploading={isUploading}
                uploadError={uploadError}
                uploadSuccess={uploadSuccess}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating Chat Widget Overlay */}
      <div className="fixed bottom-24 right-6 z-[2000]">
        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <Chat
                chatHistory={chatHistory}
                onSendMessage={handleSendMessage}
                onClearHistory={handleClearChatHistory}
                isSending={isSending}
                onClose={() => setIsChatOpen(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Dynamic Island Navigation (Unified Bottom Fixed Nav) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1500] w-[90%] max-w-[320px] sm:max-w-[350px]">
        <nav className="relative flex items-center justify-between bg-zinc-900/90 border border-zinc-800/80 rounded-full backdrop-blur-lg shadow-2xl shadow-black/50 px-2 h-16 transition-all duration-300">

          <div className="flex items-center gap-2">
            {[,
              { id: 'coach', icon: Sparkles, label: 'Coach' },
              { id: 'dashboard', icon: Home, label: 'Home' }, // We'll keep TrendingUp or replace with Home if imported
              { id: 'history', icon: Calendar, label: 'Storico' }
            ].map((item) => {
              const Icon = item.icon;
              const isActive = (item.id === 'coach' && isChatOpen) || (item.id === activeTab && !isChatOpen);

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'coach') {
                      setIsChatOpen(!isChatOpen);
                    } else {
                      setActiveTab(item.id as 'history' | 'dashboard');
                      setIsChatOpen(false);
                    }
                  }}
                  className="relative flex items-center justify-center w-14 h-14 cursor-pointer outline-none tap-highlight-transparent"
                  title={item.label}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  {/* Floating Bubble Background - Liquid Glass effect */}
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute -top-4 w-16 h-16 bg-lime-400 rounded-full shadow-lg shadow-lime-400/40"
                      transition={{
                        type: "spring",
                        stiffness: 220,
                        damping: 18,
                        mass: 1.1
                      }}
                    />
                  )}

                  {/* Icon that grows and moves into the popped bubble */}
                  <motion.div
                    className={`relative z-10 transition-colors duration-300 ${isActive ? 'text-black' : 'text-zinc-500 hover:text-zinc-300'}`}
                    initial={false}
                    animate={{
                      y: isActive ? -12 : 0,
                      scale: isActive ? 1.3 : 1
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 250,
                      damping: 20
                    }}
                  >
                    <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                  </motion.div>
                </button>
              );
            })}
          </div>

          <div className="h-8 w-px bg-zinc-800/60 mx-1"></div>

          {/* Theme Toggle (Stays as is) */}
          <button
            onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            className="flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 cursor-pointer text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30 mr-1"
            title="Cambia tema"
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5 text-lime-400" />
            ) : (
              <Moon className="h-5 w-5 text-lime-600" />
            )}
          </button>

        </nav>
      </div>

    </div>
  );
}
