import { API_URL } from '../config';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import JoinTeamModal from '../features/team/JoinTeamModal';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import DOMPurify from 'dompurify';

// Utility to format timestamp in GMT+6:00 directly without offset text
const formatGMT6 = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    const dateFormatted = date.toLocaleDateString('en-GB', {
      timeZone: 'Asia/Dhaka',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const timeFormatted = date.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Dhaka',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    return `${dateFormatted} at ${timeFormatted}`;
  } catch (err) {
    return new Date(dateString).toLocaleString();
  }
};

// Utility to decode HTML entities (like &nbsp;) into plain text safely
const decodeHTMLEntities = (text) => {
  try {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    return doc.documentElement.textContent;
  } catch (e) {
    return text;
  }
};

// Remove backend tags like [TeamID:...] or [ReqID:...] so display ends cleanly at the team name
const formatNotificationMessage = (msg, stripHtml = true) => {
  if (!msg) return '';
  let cleaned = msg;
  if (stripHtml) {
    // Decode HTML entities (like &lt;) first so DOMPurify can detect and strip the actual tags
    cleaned = decodeHTMLEntities(msg);
    // Strip HTML using DOMPurify
    cleaned = DOMPurify.sanitize(cleaned, { ALLOWED_TAGS: [] });
  }
  cleaned = cleaned
    .replace(/\s*\[TeamID:[a-fA-F0-9-]+\]\.?/i, '.')
    .replace(/\s*\[ReqID:[a-fA-F0-9-]+\]\.?/i, '.');
  return cleaned.replace(/\.\./g, '.').trim();
};

// Truncate notification messages to at most 3 lines, or 2 lines ending with "....." if longer
const clampNotificationMessage = (msg) => {
  const cleaned = formatNotificationMessage(msg);
  if (!cleaned) return '';
  const lines = cleaned.split(/\r?\n/);
  if (lines.length > 2 || cleaned.length > 130) {
    let twoLines = lines.slice(0, 2).join('\n');
    if (twoLines.length > 110) {
      twoLines = twoLines.substring(0, 105).trim();
    }
    return `${twoLines}.....`;
  }
  return cleaned;
};

export default function NotificationDropdown() {
  const { currentUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedNotificationModal, setSelectedNotificationModal] = useState(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const dropdownRef = useRef(null);
  const location = useLocation();

  // Close modal on route change
  useEffect(() => {
    setSelectedNotificationModal(null);
    setIsFullScreen(false);
  }, [location.pathname]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);

  // Fetch notifications
  const fetchNotifications = async (showLoading = true) => {
    const token = localStorage.getItem('token');
    if (!currentUser || !token) return;
    try {
      if (showLoading) setLoading(true);
      const res = await fetch(`${API_URL}/api/v1/notifications?email=${encodeURIComponent(currentUser.email)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setNotifications(data.data || []);
      }
    } catch (err) {
      // Silently ignore 'Failed to fetch' which happens normally during dev server restarts
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') return;
      console.error('Error fetching notifications:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(true);
    // In a real app, you might want to set up an interval to poll, or use WebSockets.
  }, [currentUser]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleMarkAsRead = async (id) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/notifications/${id}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        // Update local state smoothly
        setNotifications(prev => 
          prev.map(n => String(n.id) === String(id) ? { ...n, is_read: true } : n)
        );
        await fetchNotifications(false);
      } else {
        toast.error("Failed to mark notification as read");
      }
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (isMarkingAll) return;
    const token = localStorage.getItem('token');
    if (!token || !currentUser) return;
    
    setIsMarkingAll(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/notifications/read-all?email=${encodeURIComponent(currentUser.email)}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        toast.success("All notifications marked as read");
        await fetchNotifications(false);
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.message || "Failed to mark all as read");
      }
    } catch (err) {
      console.error("Error marking all as read:", err);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleDeleteNotification = async (e, id) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/v1/notifications/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setNotifications(prev => prev.filter(n => String(n.id) !== String(id)));
        toast.success("Notification deleted");
        fetchNotifications(false);
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error(errData.message || "Failed to delete notification");
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Network error deleting notification');
    }
  };

  const handleAcceptInvite = async (notification) => {
    const token = localStorage.getItem('token');
    if (!token || !currentUser || actionLoading[notification.id]) return;
    try {
      setActionLoading(prev => ({ ...prev, [notification.id]: 'accept' }));
      const res = await fetch(`${API_URL}/api/v1/notifications/${notification.id}/accept-invite?email=${encodeURIComponent(currentUser.email)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Accepted successfully!');
        await fetchNotifications(false);
      } else {
        toast.error(data.message || 'Failed to accept');
      }
    } catch (error) {
      console.error('Error accepting invite/request:', error);
      toast.error('Network error accepting request');
    } finally {
      setActionLoading(prev => {
        const next = { ...prev };
        delete next[notification.id];
        return next;
      });
    }
  };

  const handleRejectInvite = async (notification) => {
    const token = localStorage.getItem('token');
    if (!token || !currentUser || actionLoading[notification.id]) return;
    try {
      setActionLoading(prev => ({ ...prev, [notification.id]: 'reject' }));
      const res = await fetch(`${API_URL}/api/v1/notifications/${notification.id}/reject-invite?email=${encodeURIComponent(currentUser.email)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Invitation rejected');
        await fetchNotifications(false);
      } else {
        toast.error(data.message || 'Failed to reject invitation');
      }
    } catch (error) {
      console.error('Error rejecting invite:', error);
      toast.error('Network error rejecting invitation');
    } finally {
      setActionLoading(prev => {
        const next = { ...prev };
        delete next[notification.id];
        return next;
      });
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="relative p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
        aria-label="Notifications"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-16 sm:top-auto sm:mt-2 w-auto sm:w-80 md:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200 overflow-hidden max-h-[85vh] sm:max-h-none">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-xs bg-blue-500/10 text-blue-400 font-bold px-2.5 py-0.5 rounded-full">
                {unreadCount} New
              </span>
            )}
          </div>

          <div className="max-h-72 sm:max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <div className="p-4 text-center text-sm text-slate-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center">
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-slate-400 dark:text-slate-600 mb-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">No Notifications</p>
                <p className="text-xs text-slate-500 mt-1">You're all caught up!</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {notifications.map((notification) => (
                  <div 
                    key={notification.id} 
                    onClick={() => {
                        const isInviteOrRequest = notification.message.includes('You received a team invitation') || notification.message.includes('requested to join your team') || notification.message.includes('invited to mentor the team');
                        const isPendingAction = !notification.action_status || notification.action_status === 'pending';
                        if (!notification.is_read && !(isInviteOrRequest && isPendingAction)) {
                          handleMarkAsRead(notification.id);
                        }
                        setSelectedNotificationModal(notification);
                    }}
                    className={`p-4 border-b border-slate-100 dark:border-slate-800 cursor-pointer transition-all duration-200 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between group ${
                      notification.is_read ? 'opacity-60' : 'bg-blue-50 dark:bg-blue-500/5'
                    }`}
                  >
                    <div className="flex flex-1 min-w-0 gap-3 pr-2">
                      {!notification.is_read && (
                        <div className="mt-1.5 flex-shrink-0">
                          <div className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-500"></div>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm line-clamp-3 whitespace-pre-line break-words leading-snug ${notification.is_read ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-slate-200 font-medium'}`}>
                          {clampNotificationMessage(notification.message)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {formatGMT6(notification.created_at)}
                        </p>
                        {(notification.message.includes('You received a team invitation') || notification.message.includes('requested to join your team') || notification.message.includes('invited to mentor the team')) && (
                          <div className="mt-2.5" onClick={(e) => e.stopPropagation()}>
                            {(!notification.action_status || notification.action_status === 'pending') ? (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={!!actionLoading[notification.id]}
                                  onClick={() => handleAcceptInvite(notification)}
                                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                                >
                                  {actionLoading[notification.id] === 'accept' && (
                                    <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                  )}
                                  {actionLoading[notification.id] === 'accept' ? 'Accepting...' : 'Accept'}
                                </button>
                                <button
                                  type="button"
                                  disabled={!!actionLoading[notification.id]}
                                  onClick={() => handleRejectInvite(notification)}
                                  className="px-3 py-1 bg-slate-200 hover:bg-rose-500 hover:text-white text-slate-700 text-xs font-bold rounded-lg transition-all disabled:opacity-50 flex items-center gap-1.5"
                                >
                                  {actionLoading[notification.id] === 'reject' && (
                                    <svg className="animate-spin h-3 w-3 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                  )}
                                  {actionLoading[notification.id] === 'reject' ? 'Rejecting...' : 'Reject'}
                                </button>
                              </div>
                            ) : notification.action_status === 'accepted' ? (
                              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-md w-fit border border-emerald-300">
                                ✓ Accepted
                              </div>
                            ) : notification.action_status === 'rejected' ? (
                              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-100/80 px-2.5 py-1 rounded-md w-fit border border-rose-300">
                                ✕ Rejected
                              </div>
                            ) : notification.action_status === 'expired' ? (
                              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100/80 px-2.5 py-1 rounded-md w-fit border border-amber-300">
                                ⌛ Expired
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDeleteNotification(e, notification.id)}
                      className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg transition-colors flex-shrink-0 hover:bg-red-500/10"
                      title="Delete notification"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 px-4 py-3 flex justify-between items-center">
            <button
              onClick={handleMarkAllAsRead}
              disabled={isMarkingAll}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMarkingAll ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Marking...
                </>
              ) : (
                'Mark all as read'
              )}
            </button>
            <button 
              onClick={() => {
                fetchNotifications(false);
              }}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      )}

      {/* Join Team PIN Modal triggered from Accept button, rendered via Portal so it is identical to TeamPage -> Join with code */}
      {showJoinModal && createPortal(
        <JoinTeamModal 
          isOpen={showJoinModal} 
          onClose={() => {
            setShowJoinModal(false);
            fetchNotifications(false);
          }} 
        />,
        document.body
      )}

      {/* Full Message Reader Popup Modal */}
      {selectedNotificationModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden transform transition-all duration-300 ${isFullScreen ? 'fixed inset-0 w-full h-full rounded-none m-0' : 'max-w-lg w-full max-h-[70vh] rounded-3xl scale-100'}`}>
            {/* Header with Close button at Top Right */}
            <div className="p-4 sm:p-6 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl shrink-0">
                  🔔
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-slate-900 dark:text-white text-base leading-tight truncate">
                    Notification Details
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {formatGMT6(selectedNotificationModal.created_at)}
                  </p>
                </div>
              </div>

              {/* Buttons on Top Right */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
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
                  onClick={() => {
                    setSelectedNotificationModal(null);
                    setIsFullScreen(false);
                  }}
                  className="px-3.5 py-1.5 bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all shadow-sm shrink-0"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Message Body */}
            <div className={`p-4 sm:p-6 flex-1 min-h-0 space-y-4 relative overflow-y-auto overflow-x-hidden`}>
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/60 w-full h-full relative">
                <div className={`text-sm md:text-base text-slate-700 dark:text-slate-200 font-medium whitespace-pre-wrap break-words leading-relaxed prose prose-sm dark:prose-invert max-w-none w-full prose-pre:whitespace-pre-wrap prose-pre:break-words prose-p:break-words`} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatNotificationMessage(selectedNotificationModal.message, false)) }}>
                </div>
              </div>

              {/* If there are invite action buttons or status badges, render them inside the modal too */}
              {(selectedNotificationModal.message.includes('You received a team invitation') || selectedNotificationModal.message.includes('requested to join your team') || selectedNotificationModal.message.includes('invited to mentor the team')) && (
                <div className="pt-2">
                  {(!selectedNotificationModal.action_status || selectedNotificationModal.action_status === 'pending') ? (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={!!actionLoading[selectedNotificationModal.id]}
                        onClick={() => {
                          handleAcceptInvite(selectedNotificationModal);
                          setSelectedNotificationModal(null);
                          setIsFullScreen(false);
                        }}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {actionLoading[selectedNotificationModal.id] === 'accept' && (
                          <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        )}
                        {actionLoading[selectedNotificationModal.id] === 'accept' ? 'Accepting...' : 'Accept Invitation'}
                      </button>
                      <button
                        type="button"
                        disabled={!!actionLoading[selectedNotificationModal.id]}
                        onClick={() => {
                          handleRejectInvite(selectedNotificationModal);
                          setSelectedNotificationModal(null);
                          setIsFullScreen(false);
                        }}
                        className="px-4 py-2 bg-slate-200 hover:bg-rose-500 hover:text-white text-slate-700 text-xs font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {actionLoading[selectedNotificationModal.id] === 'reject' && (
                          <svg className="animate-spin h-3.5 w-3.5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        )}
                        {actionLoading[selectedNotificationModal.id] === 'reject' ? 'Rejecting...' : 'Reject Invitation'}
                      </button>
                    </div>
                  ) : selectedNotificationModal.action_status === 'accepted' ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100/80 dark:bg-emerald-950/60 dark:text-emerald-300 px-3 py-1.5 rounded-xl w-fit border border-emerald-300 dark:border-emerald-700">
                      ✓ Accepted
                    </div>
                  ) : selectedNotificationModal.action_status === 'rejected' ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-100/80 dark:bg-rose-950/60 dark:text-rose-300 px-3 py-1.5 rounded-xl w-fit border border-rose-300 dark:border-rose-700">
                      ✕ Rejected
                    </div>
                  ) : selectedNotificationModal.action_status === 'expired' ? (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100/80 dark:bg-amber-950/60 dark:text-amber-300 px-3 py-1.5 rounded-xl w-fit border border-amber-300 dark:border-amber-700">
                      ⌛ Expired
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
