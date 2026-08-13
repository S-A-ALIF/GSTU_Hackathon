import { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminFeedbackTab() {
  const { socket } = useAuth();
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, open, resolved
  const [resolvingId, setResolvingId] = useState(null);

  useEffect(() => {
    fetchFeedbacks();
  }, []);

  useEffect(() => {
    if (!socket) return;
    
    const handleStatsUpdated = () => {
      fetchFeedbacks();
    };
    
    socket.on('statsUpdated', handleStatsUpdated);
    
    return () => {
      socket.off('statsUpdated', handleStatsUpdated);
    };
  }, [socket]);

  const fetchFeedbacks = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/feedback/admin`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedbacks(data.data);
      } else {
        toast.error(data.message || 'Failed to load feedbacks');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error loading feedbacks');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (id) => {
    setResolvingId(id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/feedback/admin/${id}/resolve`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Feedback marked as resolved');
        setFeedbacks(feedbacks.map(f => f.id === id ? { ...f, status: 'resolved', resolved_at: data.data.resolved_at } : f));
        window.dispatchEvent(new Event('feedbackChanged'));
      } else {
        toast.error(data.message || 'Failed to resolve feedback');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error resolving feedback');
    } finally {
      setResolvingId(null);
    }
  };

  const filteredFeedbacks = feedbacks.filter(f => {
    if (filter === 'all') return true;
    return f.status === filter;
  });

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
        <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
        Loading feedback...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">User Feedback</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Review bug reports and questions from users.</p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${filter === 'all' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('open')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${filter === 'open' ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            Open
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${filter === 'resolved' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
          >
            Resolved
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        {filteredFeedbacks.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            No feedback found matching the current filter.
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredFeedbacks.map((f) => (
              <div key={f.id} className="p-5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold uppercase tracking-wider">
                      {f.type}
                    </span>
                    {f.status === 'open' ? (
                      <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-bold">Open</span>
                    ) : (
                      <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-bold">Resolved</span>
                    )}
                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto sm:ml-2">
                      {(() => {
                        try {
                          const date = new Date(f.created_at);
                          const dateFormatted = date.toLocaleDateString('en-GB', { timeZone: 'Asia/Dhaka', day: '2-digit', month: 'short', year: 'numeric' });
                          const timeFormatted = date.toLocaleTimeString('en-US', { timeZone: 'Asia/Dhaka', hour: '2-digit', minute: '2-digit', hour12: true });
                          return `${dateFormatted} at ${timeFormatted}`;
                        } catch (err) {
                          return new Date(f.created_at).toLocaleString();
                        }
                      })()}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{f.subject}</h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm whitespace-pre-wrap bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800/50 mb-4">{f.description}</p>
                  
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{f.user_name}</span>
                    <span>({f.email})</span>
                    <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded text-[10px] uppercase font-bold">{f.role}</span>
                  </div>
                </div>
                
                <div className="sm:pl-4 sm:border-l border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0">
                  {f.status === 'open' ? (
                    <button
                      onClick={() => handleResolve(f.id)}
                      disabled={resolvingId === f.id}
                      className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors text-sm flex items-center justify-center min-w-[120px]"
                    >
                      {resolvingId === f.id ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      ) : (
                        'Mark Resolved'
                      )}
                    </button>
                  ) : (
                    <div className="w-full sm:w-auto px-6 py-2.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold rounded-xl text-sm flex items-center justify-center gap-2 border border-emerald-200 dark:border-emerald-800/30 min-w-[120px]">
                      <span>✓</span> Resolved
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
