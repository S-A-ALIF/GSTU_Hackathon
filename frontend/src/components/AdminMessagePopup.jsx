import { useState, useEffect } from 'react';
import { API_URL } from '../config';
import { useAuth, socket } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import DOMPurify from 'dompurify';

export default function AdminMessagePopup() {
  const { currentUser } = useAuth();
  const [activePopup, setActivePopup] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const location = useLocation();

  // Close popup on route change
  useEffect(() => {
    setIsOpen(false);
    setActivePopup(null);
    setIsFullScreen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!currentUser || !currentUser.email) return;

    // Check immediately on mount/login
    checkAdminNotifications();

    // Listen for new admin messages
    socket.on('newAdminMessage', checkAdminNotifications);

    return () => {
      socket.off('newAdminMessage', checkAdminNotifications);
    };
  }, [currentUser]);

  const checkAdminNotifications = async () => {
    if (!currentUser || !currentUser.email) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/notifications?email=${encodeURIComponent(currentUser.email)}&skipUpdate=true`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.data)) {
        const notifs = data.data;

        // Filter unread admin broadcast messages
        const adminNotifs = notifs.filter(n => {
          if (n.is_read) return false;
          const msg = String(n.message || '');
          return (
            msg.includes('📢') ||
            msg.includes('⚠️') ||
            msg.includes('🚨') ||
            msg.includes('[Admin Message]') ||
            msg.includes('[Important Notice]') ||
            msg.includes('[URGENT Broadcast]')
          );
        });

        // Check local storage for already dismissed popup notifications
        const dismissedIds = JSON.parse(localStorage.getItem('dismissedAdminNotifs') || '[]');
        const unreadUndismissed = adminNotifs.filter(n => !dismissedIds.includes(n.id));

        if (unreadUndismissed.length > 0) {
          setActivePopup(unreadUndismissed[0]);
          setIsOpen(true);
        }
      }
    } catch (err) {
      // Silently ignore 'Failed to fetch' which happens normally during dev server restarts
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') return;
      console.error('Error checking admin notifications for popup:', err);
    }
  };

  const handleDismiss = () => {
    if (!activePopup) return;
    const dismissedIds = JSON.parse(localStorage.getItem('dismissedAdminNotifs') || '[]');
    localStorage.setItem(
      'dismissedAdminNotifs',
      JSON.stringify([...new Set([...dismissedIds, activePopup.id])])
    );
    setIsOpen(false);
    setActivePopup(null);
    setIsFullScreen(false);
  };

  if (!isOpen || !activePopup) return null;

  // Extract badge / severity info
  const rawMsg = String(activePopup.message || '');
  let badgeColor = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
  let badgeText = 'ADMIN MESSAGE';
  let dotColor = 'bg-blue-500';

  if (rawMsg.includes('🚨') || rawMsg.includes('URGENT')) {
    badgeColor = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
    badgeText = 'URGENT BROADCAST';
    dotColor = 'bg-rose-500';
  } else if (rawMsg.includes('⚠️') || rawMsg.includes('Important Notice')) {
    badgeColor = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    badgeText = 'IMPORTANT NOTICE';
    dotColor = 'bg-amber-500';
  }

  // Clean raw message slightly for nice preview
  const cleanMsg = rawMsg
    .replace('📢 [Admin Message]', '')
    .replace('🚨 [URGENT Broadcast]', '')
    .replace('⚠️ [Important Notice]', '')
    .trim();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden transform transition-all duration-300 ${isFullScreen ? 'fixed inset-0 w-full h-full rounded-none m-0 max-w-none' : 'max-w-md w-full max-h-[70vh] rounded-3xl scale-100'}`}>
        {/* Top Header Bar with Close text button at Top Right instead of Cross */}
        <div className="p-6 pb-4 flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl shrink-0 shadow-sm">
              📢
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white text-base leading-tight">
                You received a message from the admin
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                New platform announcement
              </p>
            </div>
          </div>

          {/* Buttons on Top Right */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="px-3.5 py-1.5 bg-blue-50/80 hover:bg-blue-100/80 dark:bg-blue-900/30 dark:hover:bg-blue-800/40 text-blue-600 dark:text-blue-400 font-bold text-xs rounded-xl transition-all shadow-sm shrink-0 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
              {isFullScreen ? 'Exit Fullscreen' : 'Expand'}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3.5 py-1.5 bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all shadow-sm shrink-0"
            >
              Close
            </button>
          </div>
        </div>

        {/* Message Content Body */}
        <div className="p-6 flex-1 min-h-0 flex flex-col space-y-4 relative">
          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badgeColor}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
              {badgeText}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Check Notification Bell for details
            </span>
          </div>

          <div className={`bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/60 w-full flex-1 min-h-0 relative overflow-y-auto`}>
            <div 
              className={`text-sm text-slate-700 dark:text-slate-200 font-medium whitespace-pre-line leading-relaxed prose prose-sm dark:prose-invert max-w-none [overflow-wrap:anywhere]`}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(cleanMsg || rawMsg) }}
            >
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 text-center shrink-0">
            You can view this message anytime in your Notifications menu (bell icon at top right).
          </p>
        </div>
      </div>
    </div>
  );
}
