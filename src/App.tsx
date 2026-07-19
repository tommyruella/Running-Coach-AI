/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Sparkles, Home, TrendingUp, Sun, Moon } from 'lucide-react';
import { Activity as ActivityType, ChatMessage, RunningStats } from './types.js';
import Dashboard from './components/Dashboard.tsx';
import Chat from './components/Chat.tsx';
import History from './components/History.tsx';
import Admin from './components/Admin.tsx';
import ActivityDetail from './components/ActivityDetail.tsx';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'chat' | 'activity_detail'>('dashboard');
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'light';
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

  const fetchData = async () => {
    try {
      const statsRes = await fetch('/api/stats');
      if (statsRes.ok) setStats(await statsRes.json());

      const actRes = await fetch('/api/activities?limit=100');
      if (actRes.ok) setActivities((await actRes.json()).activities);

      const chatRes = await fetch('/api/chat-history');
      if (chatRes.ok) setChatHistory((await chatRes.json()).history);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
        if (result.is_plan) fetchData();
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleClearChatHistory = async () => {
    try {
      const response = await fetch('/api/chat-clear', { method: 'POST' });
      if (response.ok) {
        setChatHistory([{
          id: 'chat_init', sender: 'assistant', text: `Ciao, Runner!`, timestamp: new Date().toISOString()
        }]);
      }
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  };

  const handleUploadTcx = async (files: File[]) => {
    if (files.length === 0) return;
    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    const BATCH_SIZE = 5;
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      const formData = new FormData();
      batch.forEach(f => formData.append('files', f));

      try {
        const response = await fetch('/api/upload-tcx', { method: 'POST', body: formData });
        if (response.ok) {
          const result = await response.json();
          successCount += result.successCount || 0;
          failedCount += result.failedCount || 0;
        } else {
          failedCount += batch.length;
        }
      } catch (error) {
        failedCount += batch.length;
      }
    }

    if (successCount > 0) {
      setUploadSuccess(`Sincronizzati ${successCount} allenamenti`);
      await fetchData();
      setTimeout(() => setUploadSuccess(null), 5000);
    } else {
      setUploadError(`Errore caricamento. ${failedCount} falliti.`);
    }
    setIsUploading(false);
  };

  return (
    <div className="min-h-screen bg-[var(--window-bg)] text-[var(--text-primary)] transition-colors duration-300 font-sans" id="app-root-container">

      {/* Main Content Area */}
      <main className="w-full max-w-[1200px] mx-auto min-h-screen px-4 sm:px-8 py-8 pb-32">
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
                fetchData();
              }} />
            ) : activeTab === 'dashboard' ? (
              <Dashboard
                stats={stats}
                activities={activities}
                onNavigateToHistory={() => setActiveTab('history')}
                onSecretUnlock={() => setIsAdminOpen(true)}
              />
            ) : activeTab === 'chat' ? (
              <Chat
                chatHistory={chatHistory}
                onSendMessage={handleSendMessage}
                onClearHistory={handleClearChatHistory}
                isSending={isSending}
                onClose={() => setActiveTab('dashboard')}
              />
            ) : activeTab === 'activity_detail' && selectedActivityId ? (
              <ActivityDetail
                activity={activities.find(a => a.id === selectedActivityId)!}
                onBack={() => setActiveTab('history')}
              />
            ) : (
              <History
                activities={activities}
                onUploadTcx={handleUploadTcx}
                isUploading={isUploading}
                uploadError={uploadError}
                uploadSuccess={uploadSuccess}
                onActivitySelect={(id) => {
                  setSelectedActivityId(id);
                  setActiveTab('activity_detail');
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating Bottom Navigation */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1500] w-[90%] max-w-[360px]">
        <nav 
          className="relative flex items-center justify-between mac-popover px-4 h-16 transition-all duration-300 border border-subtle shadow-[0_10px_30px_-5px_rgba(0,0,0,0.3)] dark:shadow-[0_10px_30px_-5px_rgba(0,0,0,0.8)]"
          style={{ borderRadius: '9999px' }}
        >
          {/* Left Navigation Buttons */}
          <div className="flex items-center gap-2 flex-1 justify-around">
            {[
              { id: 'chat', icon: Sparkles },
              { id: 'dashboard', icon: Home },
              { id: 'history', icon: Calendar },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = item.id === activeTab || (item.id === 'history' && activeTab === 'activity_detail');

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className="relative flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 cursor-pointer outline-none tap-highlight-transparent z-10"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="active-pill"
                      className="absolute w-14 h-14 sm:w-16 sm:h-16 bg-[#CCFF00] rounded-full shadow-[0_0_20px_rgba(204,255,0,0.6)] -translate-y-4 sm:-translate-y-5 z-0"
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 22,
                        mass: 0.8
                      }}
                    />
                  )}
                  <Icon 
                    className={`relative z-10 transition-all duration-300 ${
                      isActive 
                        ? 'text-black w-6 h-6 sm:w-7 sm:h-7 scale-110' 
                        : 'text-secondary hover:text-primary w-5 h-5 sm:w-6 sm:h-6'
                    }`} 
                    strokeWidth={isActive ? 2.5 : 2} 
                  />
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="h-8 w-[1px] bg-subtle mx-3 self-center opacity-30" />

          {/* Right Theme Button */}
          <div className="flex items-center justify-center pl-2 pr-1">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-12 h-12 flex items-center justify-center text-[#CCFF00] hover:scale-110 transition-transform cursor-pointer"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 sm:w-6 sm:h-6" /> : <Moon className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>
          </div>
        </nav>
      </div>

    </div>
  );
}
