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
      <div className="clean-panel border border-accent-rose/20 p-6 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 text-accent-rose">
            <ShieldAlert className="w-8 h-8" />
            <h1 className="text-2xl font-black uppercase tracking-widest text-primary">Admin Panel</h1>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full surface-inset flex items-center justify-center hover:bg-surface-card transition-colors"
          >
            <X className="w-5 h-5 text-secondary" />
          </button>
        </div>
        
        {error && (
          <div className="bg-red-500/10 text-accent-rose p-3 rounded-lg mb-4 text-sm font-medium border border-accent-rose/20">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {loading ? (
            <div className="flex justify-center p-8">
              <div className="w-8 h-8 border-4 border-accent-rose border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center text-muted p-8 font-medium">Nessuna attività trovata.</div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div key={activity.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-surface-inset border border-subtle rounded-xl gap-4 hover:shadow-sm transition-shadow">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-secondary mb-1 font-medium">
                      {new Date(activity.date).toLocaleDateString('it-IT', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {editingId === activity.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="bg-surface-card border border-accent-rose/50 rounded-lg px-3 py-1.5 text-sm text-primary focus:outline-none focus:border-accent-rose w-full shadow-sm"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleRename(activity.id)}
                        />
                        <button onClick={() => handleRename(activity.id)} className="p-1.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-500/20">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 bg-surface-card border border-subtle text-secondary rounded-lg hover:bg-surface-inset">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="font-bold text-primary truncate">{activity.name}</div>
                    )}
                    <div className="text-sm text-secondary flex gap-3 mt-1 font-mono">
                      <span>{activity.distanceKm} km</span>
                      <span>{activity.durationMin} min</span>
                    </div>
                  </div>
                  
                  {editingId !== activity.id && (
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button 
                        onClick={() => startEditing(activity)}
                        className="p-2 surface-inset border border-subtle rounded-lg text-secondary hover:text-primary transition-colors shadow-sm"
                        title="Rinomina"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(activity.id)}
                        className="p-2 surface-inset border border-subtle rounded-lg text-secondary hover:text-accent-rose hover:border-accent-rose/30 transition-colors shadow-sm"
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
