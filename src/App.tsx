/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Calendar, Sparkles, Settings, X, Search, Grid } from 'lucide-react';
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
  const [showSettings, setShowSettings] = useState(false);

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

  // The title bar for the MacOS window
  const WindowTitleBar = () => (
    <div className="h-14 border-b border-subtle flex items-center justify-between px-4 shrink-0 bg-surface-card rounded-t-2xl z-20">
      {/* Traffic Lights */}
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]"></div>
        <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]"></div>
        <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]"></div>
        <div className="ml-4 flex items-center gap-1 bg-surface-inset px-2 py-1 rounded-md border border-subtle cursor-pointer hover:bg-surface-card-alt">
          <span className="text-xl leading-none font-light mb-1">+</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="hidden md:flex items-center gap-1">
        {[
          { id: 'dashboard', label: 'Overview', icon: Grid },
          { id: 'history', label: 'History', icon: Calendar },
          { id: 'chat', label: 'Coach AI', icon: Sparkles },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
              activeTab === t.id || (t.id === 'history' && activeTab === 'activity_detail')
                ? 'bg-surface-inset text-primary shadow-sm border border-subtle'
                : 'text-secondary hover:text-primary'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 relative">
        <button className="w-8 h-8 rounded-lg hover:bg-surface-inset flex items-center justify-center text-secondary transition-colors">
          <Search className="w-4 h-4" />
        </button>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
            showSettings ? 'bg-surface-inset text-primary border border-subtle' : 'hover:bg-surface-inset text-secondary'
          }`}
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Settings Popover */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute top-12 right-0 w-72 mac-popover p-4 z-50"
            >
              <div className="flex items-center justify-between mb-4 border-b border-subtle pb-3">
                <h3 className="font-medium text-sm">Settings</h3>
                <button onClick={() => setShowSettings(false)} className="text-secondary hover:text-primary">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium flex items-center gap-2">Theme</span>
                    <span className="text-[10px] text-muted border border-subtle px-1 rounded">T</span>
                  </div>
                  <div className="segmented-control w-full flex">
                    <div 
                      onClick={() => setTheme('light')}
                      className={`flex-1 text-center segmented-item ${theme === 'light' ? 'active' : ''}`}
                    >
                      Bright
                    </div>
                    <div 
                      onClick={() => setTheme('dark')}
                      className={`flex-1 text-center segmented-item ${theme === 'dark' ? 'active' : ''}`}
                    >
                      Dark
                    </div>
                  </div>
                </div>

                <div className="border-t border-subtle pt-4">
                   <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium flex items-center gap-2">Admin Tools</span>
                  </div>
                  <div className="segmented-control w-full flex">
                     <div 
                      onClick={() => { setIsAdminOpen(true); setShowSettings(false); }}
                      className="flex-1 text-center segmented-item hover:bg-surface-card"
                    >
                      Unlock Admin
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--text-primary)] flex items-center justify-center p-0 sm:p-4 md:p-8 transition-colors duration-300 font-sans" id="app-root-container">

      {/* MacOS Window Container */}
      <div className="w-full max-w-[1200px] h-[100dvh] sm:h-[90vh] mac-window flex flex-col relative rounded-none sm:rounded-2xl">
        <WindowTitleBar />

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-8">
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
      </div>

      {/* Mobile Bottom Navigation (Hidden on desktop since we have top tabs) */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[1500] w-[90%] max-w-[320px]">
        <nav className="relative flex items-center justify-around mac-popover px-2 h-16 transition-all duration-300">
          {[
            { id: 'dashboard', icon: Grid, label: 'Home' },
            { id: 'history', icon: Calendar, label: 'Storico' },
            { id: 'chat', icon: Sparkles, label: 'Coach' },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeTab || (item.id === 'history' && activeTab === 'activity_detail');

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className="relative flex items-center justify-center w-14 h-14 cursor-pointer outline-none tap-highlight-transparent"
              >
                {isActive && (
                  <motion.div
                    layoutId="mobile-nav"
                    className="absolute inset-2 bg-surface-inset border border-subtle rounded-xl"
                  />
                )}
                <Icon className={`relative z-10 w-5 h-5 ${isActive ? 'text-primary' : 'text-secondary'}`} />
              </button>
            );
          })}
        </nav>
      </div>

    </div>
  );
}
