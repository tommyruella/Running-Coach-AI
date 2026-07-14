import React, { useState, useEffect } from 'react';
import { Trash2, Edit2, Check, X, ShieldAlert } from 'lucide-react';
import { Activity } from '../types.js';

interface AdminProps {
  onClose: () => void;
}

export default function Admin({ onClose }: AdminProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/activities?limit=1000');
      const data = await res.json();
      if (data.activities) {
        setActivities(data.activities);
      }
    } catch (err) {
      console.error('Failed to fetch activities', err);
      setError('Errore nel caricamento delle attività.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa attività? Questa azione non può essere annullata.')) return;
    
    try {
      const res = await fetch(`/api/activities/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setActivities(prev => prev.filter(a => a.id !== id));
      } else {
        throw new Error('Delete failed');
      }
    } catch (err) {
      console.error(err);
      alert('Errore durante l\'eliminazione.');
    }
  };

  const handleRename = async (id: string) => {
    if (!editName.trim()) return;
    try {
      const res = await fetch(`/api/activities/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() })
      });
      if (res.ok) {
        setActivities(prev => prev.map(a => a.id === id ? { ...a, name: editName.trim() } : a));
        setEditingId(null);
      } else {
        throw new Error('Rename failed');
      }
    } catch (err) {
      console.error(err);
      alert('Errore durante la rinominazione.');
    }
  };

  const startEditing = (activity: Activity) => {
    setEditingId(activity.id);
    setEditName(activity.name);
  };

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-8 animate-in fade-in zoom-in duration-300">
      <div className="bg-zinc-900/60 border border-red-900/50 rounded-2xl p-6 backdrop-blur-md flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 text-red-500">
            <ShieldAlert className="w-8 h-8" />
            <h1 className="text-2xl font-black uppercase tracking-widest">Admin Panel</h1>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>
        
        {error && (
          <div className="bg-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-sm font-medium">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {loading ? (
            <div className="flex justify-center p-8">
              <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center text-zinc-500 p-8">Nessuna attività trovata.</div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div key={activity.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-zinc-950/50 border border-zinc-800/50 rounded-xl gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-zinc-500 mb-1">
                      {new Date(activity.date).toLocaleDateString('it-IT', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {editingId === activity.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="bg-zinc-900 border border-red-500/50 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-red-500 w-full"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleRename(activity.id)}
                        />
                        <button onClick={() => handleRename(activity.id)} className="p-1.5 bg-green-500/20 text-green-400 rounded hover:bg-green-500/40">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="font-semibold text-zinc-200 truncate">{activity.name}</div>
                    )}
                    <div className="text-sm text-zinc-400 flex gap-3 mt-1">
                      <span>{activity.distanceKm} km</span>
                      <span>{activity.durationMin} min</span>
                    </div>
                  </div>
                  
                  {editingId !== activity.id && (
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button 
                        onClick={() => startEditing(activity)}
                        className="p-2 bg-zinc-800/50 border border-zinc-700 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                        title="Rinomina"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(activity.id)}
                        className="p-2 bg-red-950/30 border border-red-900/50 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-900/50 transition-colors"
                        title="Elimina"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
