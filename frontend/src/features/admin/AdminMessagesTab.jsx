import { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import { toast } from 'sonner';
import { adminCache } from './adminCache';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import DOMPurify from 'dompurify';
import { createPortal } from 'react-dom';

const decodeHTMLEntities = (text) => {
  try {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    return doc.documentElement.textContent;
  } catch (e) {
    return text;
  }
};

const formatNotificationMessage = (msg, stripHtml = true) => {
  if (!msg) return '';
  let cleaned = msg;
  if (stripHtml) {
    cleaned = DOMPurify.sanitize(msg, { ALLOWED_TAGS: [] });
    cleaned = decodeHTMLEntities(cleaned);
  }
  return cleaned.trim();
};

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

export default function AdminMessagesTab() {
  const [targetType, setTargetType] = useState('all'); // 'all', 'team_leaders', 'mentors', 'teams', 'selected'
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState('info'); // 'info', 'warning', 'urgent'
  const [sending, setSending] = useState(false);

  // History State
  const [viewMode, setViewMode] = useState('compose'); // 'compose' | 'history'
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editMessageId, setEditMessageId] = useState(null);
  
  // History Modal State
  const [selectedHistoryModal, setSelectedHistoryModal] = useState(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(null); // holds message ID to delete
  const [isDeleting, setIsDeleting] = useState(false);

  // Data for selector lists
  const [teamsList, setTeamsList] = useState([]);
  const [membersList, setMembersList] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  // Selected items
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);
  const [selectedEmails, setSelectedEmails] = useState([]);

  // Search filter inside picker
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Load teams or members when specific target types are chosen
    if (targetType === 'teams' && teamsList.length === 0) {
      loadTeams();
    } else if (targetType === 'selected' && membersList.length === 0) {
      loadMembers();
    }
  }, [targetType]);

  useEffect(() => {
    if (viewMode === 'history') {
      loadHistory();
    }
  }, [viewMode]);

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/messages/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setHistory(data.data || []);
      }
    } catch (err) {
      console.error('Error loading history:', err);
      toast.error('Failed to load message history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadTeams = async () => {
    try {
      setLoadingData(true);
      if (adminCache.isFresh('teams') && adminCache.teams) {
        setTeamsList(adminCache.teams);
        setLoadingData(false);
        return;
      }
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/teams`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        adminCache.set('teams', data.data || []);
        setTeamsList(data.data || []);
      }
    } catch (err) {
      console.error('Error loading teams:', err);
      toast.error('Failed to load teams list');
    } finally {
      setLoadingData(false);
    }
  };

  const loadMembers = async () => {
    try {
      setLoadingData(true);
      if (adminCache.isFresh('members') && adminCache.members) {
        setMembersList(adminCache.members);
        setLoadingData(false);
        return;
      }
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/members`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        adminCache.set('members', data.data || []);
        setMembersList(data.data || []);
      }
    } catch (err) {
      console.error('Error loading members:', err);
      toast.error('Failed to load members list');
    } finally {
      setLoadingData(false);
    }
  };

  const handleToggleTeam = (teamId) => {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId)
        ? prev.filter((id) => id !== teamId)
        : [...prev, teamId]
    );
  };

  const handleToggleEmail = (email) => {
    setSelectedEmails((prev) =>
      prev.includes(email)
        ? prev.filter((e) => e !== email)
        : [...prev, email]
    );
  };

  const filteredTeams = teamsList.filter((t) => {
    const query = searchQuery.toLowerCase();
    return (
      (t.name && t.name.toLowerCase().includes(query)) ||
      (t.leader_name && t.leader_name.toLowerCase().includes(query)) ||
      (t.leader_email && t.leader_email.toLowerCase().includes(query))
    );
  });

  const filteredMembers = membersList.filter((m) => {
    const query = searchQuery.toLowerCase();
    return (
      (m.name && m.name.toLowerCase().includes(query)) ||
      (m.email && m.email.toLowerCase().includes(query)) ||
      (m.role && m.role.toLowerCase().includes(query))
    );
  });

  const handleSelectAllFilteredTeams = () => {
    const ids = filteredTeams.map((t) => t.id);
    setSelectedTeamIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const handleSelectAllFilteredMembers = () => {
    const emails = filteredMembers.map((m) => m.email).filter(Boolean);
    setSelectedEmails((prev) => Array.from(new Set([...prev, ...emails])));
  };

  const handleClearSelected = () => {
    if (targetType === 'teams') setSelectedTeamIds([]);
    if (targetType === 'selected') setSelectedEmails([]);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    if (!message.trim()) {
      toast.error('Please enter a message content');
      return;
    }

    if (!editMessageId) {
      if (targetType === 'teams' && selectedTeamIds.length === 0) {
        toast.error('Please select at least one team');
        return;
      }

      if (targetType === 'selected' && selectedEmails.length === 0) {
        toast.error('Please select at least one user');
        return;
      }
    }

    try {
      setSending(true);
      const token = localStorage.getItem('token');
      
      const url = editMessageId 
        ? `${API_URL}/api/v1/admin/messages/${editMessageId}`
        : `${API_URL}/api/v1/admin/messages/send`;
        
      const method = editMessageId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          targetType: editMessageId ? undefined : targetType,
          selectedTeamIds: (!editMessageId && targetType === 'teams') ? selectedTeamIds : undefined,
          selectedEmails: (!editMessageId && targetType === 'selected') ? selectedEmails : undefined,
          title: title.trim(),
          message: message.trim(),
          severity
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(editMessageId ? 'Message updated successfully!' : `Notification broadcast successfully to ${data.recipientsCount} recipient(s)!`);
        resetForm();
      } else {
        toast.error(data.message || 'Failed to save message');
      }
    } catch (err) {
      console.error('Error sending message:', err);
      toast.error('Error connecting to server');
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setMessage('');
    setSelectedTeamIds([]);
    setSelectedEmails([]);
    setEditMessageId(null);
    setViewMode('compose');
  };

  const handleDeleteMessage = async (id) => {
    try {
      setIsDeleting(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/messages/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Message deleted and recalled successfully!');
        setHistory(prev => prev.filter(msg => msg.id !== id));
        setDeleteModalOpen(null);
      } else {
        toast.error(data.message || 'Failed to delete message');
      }
    } catch (err) {
      console.error('Error deleting message:', err);
      toast.error('Error connecting to server');
    } finally {
      setIsDeleting(false);
    }
  };

  // Preview helper
  const getSeverityBadge = () => {
    if (severity === 'urgent') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
          URGENT
        </span>
      );
    }
    if (severity === 'warning') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          WARNING
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
        INFO
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              <span>📢</span>
              <span>{editMessageId ? 'Edit Broadcast Message' : 'Send Message (In-App Notification)'}</span>
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm sm:text-base">
              {editMessageId ? 'Update a previously sent message. This will update the notification text for all recipients.' : 'Broadcast announcements and instant notifications directly to members\' in-app notification menu.'}
            </p>
          </div>
          
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => {
                if(editMessageId) resetForm();
                else setViewMode('compose');
              }}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'compose' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
            >
              {editMessageId ? 'Cancel Edit' : 'Compose'}
            </button>
            <button
              onClick={() => setViewMode('history')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'history' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
            >
              History
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'history' ? (
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Past Broadcasts</h3>
          {loadingHistory ? (
            <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm">No past broadcasts found.</div>
          ) : (
            <div className="space-y-4">
              {history.map((msg) => (
                <div key={msg.id} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 transition-colors">
                  <div className="flex justify-between items-start gap-4 cursor-pointer" onClick={() => setSelectedHistoryModal(msg)}>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${msg.severity === 'urgent' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' : msg.severity === 'warning' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'}`}>
                          {msg.severity}
                        </span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Target: {msg.target_type}</span>
                        <span className="text-xs text-slate-400">{new Date(msg.created_at).toLocaleString()}</span>
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm [overflow-wrap:anywhere]">{msg.title || '(No Title)'}</h4>
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-line leading-snug [overflow-wrap:anywhere] line-clamp-3">
                        {clampNotificationMessage(msg.message)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditMessageId(msg.id);
                          setTitle(msg.title || '');
                          setMessage(msg.message || '');
                          setSeverity(msg.severity || 'info');
                          setViewMode('compose');
                        }}
                        className="shrink-0 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold text-xs rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteModalOpen(msg.id);
                        }}
                        className="shrink-0 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-bold text-xs rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
      <form onSubmit={handleSendMessage} className="space-y-6">
        {/* Step 1: Target Audience Selection */}
        {!editMessageId && (
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-black">
              1
            </span>
            Choose Target Audience
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              {
                id: 'all',
                label: 'All Registered Members',
                desc: 'Broadcast to everyone registered on the platform',
                icon: '🌐'
              },
              {
                id: 'team_leaders',
                label: 'All Team Leaders',
                desc: 'Only send to users who are leading a team',
                icon: '👑'
              },
              {
                id: 'mentors',
                label: 'All Mentors',
                desc: 'Send to all mentors on the platform',
                icon: '🎓'
              },
              {
                id: 'teams',
                label: 'Specific Teams',
                desc: 'Choose one or more teams (sends to members, leader & mentor)',
                icon: '👥'
              },
              {
                id: 'selected',
                label: 'Specific Users',
                desc: 'Select individual users by name or email',
                icon: '👤'
              }
            ].map((option) => (
              <div
                key={option.id}
                onClick={() => setTargetType(option.id)}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  targetType === option.id
                    ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 dark:border-blue-500'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl mt-0.5">{option.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white text-sm">
                        {option.label}
                      </span>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          targetType === option.id
                            ? 'border-blue-600 bg-blue-600'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {targetType === option.id && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {option.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Conditional Multi-Select Box for Teams */}
          {targetType === 'teams' && (
            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Select Teams ({selectedTeamIds.length} selected)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllFilteredTeams}
                    className="text-xs px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 font-bold rounded-lg transition-colors"
                  >
                    Select Filtered
                  </button>
                  <button
                    type="button"
                    onClick={handleClearSelected}
                    disabled={selectedTeamIds.length === 0}
                    className="text-xs px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-lg transition-colors disabled:opacity-50"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Search filter */}
              <input
                type="text"
                placeholder="Search team name or leader email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {loadingData ? (
                <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                  Loading teams list...
                </div>
              ) : filteredTeams.length === 0 ? (
                <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                  No matching teams found.
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredTeams.map((t) => {
                    const isSelected = selectedTeamIds.includes(t.id);
                    return (
                      <div
                        key={t.id}
                        onClick={() => handleToggleTeam(t.id)}
                        className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50/70 dark:bg-blue-950/40'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-sm">
                            {t.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Leader: {t.leader_name || 'N/A'} ({t.leader_email || 'No email'}) • Members: {Array.isArray(t.members) ? t.members.length : 0}
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-600 focus:ring-blue-500"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Conditional Multi-Select Box for Users */}
          {targetType === 'selected' && (
            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Select Users ({selectedEmails.length} selected)
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllFilteredMembers}
                    className="text-xs px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 font-bold rounded-lg transition-colors"
                  >
                    Select Filtered
                  </button>
                  <button
                    type="button"
                    onClick={handleClearSelected}
                    disabled={selectedEmails.length === 0}
                    className="text-xs px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-lg transition-colors disabled:opacity-50"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Search filter */}
              <input
                type="text"
                placeholder="Search user by name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {loadingData ? (
                <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                  Loading users list...
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                  No matching users found.
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredMembers.map((m) => {
                    const isSelected = selectedEmails.includes(m.email);
                    return (
                      <div
                        key={m.id || m.email}
                        onClick={() => handleToggleEmail(m.email)}
                        className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-blue-50/70 dark:bg-blue-950/40'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                            <span>{m.name || 'Unnamed User'}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                m.role === 'mentor'
                                  ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                                  : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                              }`}
                            >
                              {m.role || 'student'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {m.email} {m.student_id ? `• ${m.student_id}` : ''}
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 text-blue-600 rounded border-slate-300 dark:border-slate-600 focus:ring-blue-500"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {/* Step 2: Message Compose Card */}
        <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-black">
              2
            </span>
            Compose Notification Message
          </h3>

          <div className="space-y-6">
            {/* Severity Selection */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                Notification Importance Level
              </label>
              <div className="flex flex-wrap gap-3">
                {[
                  { id: 'info', label: '📢 Info (Standard)', color: 'blue' },
                  { id: 'warning', label: '⚠️ Warning (Notice)', color: 'amber' },
                  { id: 'urgent', label: '🚨 Urgent (Priority)', color: 'rose' }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSeverity(item.id)}
                    className={`px-4 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                      severity === item.id
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title (Optional) */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                Title / Subject (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Registration Deadline Reminder"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium"
              />
            </div>

            {/* Message Content */}
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                Message Content <span className="text-red-500">*</span>
              </label>
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden [&_.ql-editor]:!text-slate-900 dark:[&_.ql-editor]:!text-white dark:[&_.ql-editor_*]:!text-white [&_.ql-editor::before]:!text-slate-400 dark:[&_.ql-editor::before]:!text-slate-500 [&_.ql-toolbar]:border-b-slate-200 dark:[&_.ql-toolbar]:border-b-slate-700 dark:[&_.ql-stroke]:!stroke-slate-300 dark:[&_.ql-fill]:!fill-slate-300 dark:[&_.ql-picker]:!text-slate-300">
                <ReactQuill
                  theme="snow"
                  value={message}
                  onChange={setMessage}
                  placeholder="Write your announcement or notification text here..."
                  className="text-sm font-medium"
                />
              </div>
              <div className="flex justify-between items-center mt-1 text-xs text-slate-500 dark:text-slate-400">
                <span>The message will appear in real-time in recipient notification menus.</span>
                <span>{message.replace(/<[^>]*>?/gm, '').length} characters</span>
              </div>
            </div>

            {/* Live Notification Card Preview */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                Live Notification Card Preview (How users will see it)
              </label>
              <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 shadow-md max-w-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    {getSeverityBadge()}
                  </div>
                  <span className="text-xs text-slate-400">Just now</span>
                </div>
                <div className="text-sm text-slate-200 font-medium">
                  {severity === 'urgent' && '🚨 [URGENT Broadcast] '}
                  {severity === 'warning' && '⚠️ [Important Notice] '}
                  {severity === 'info' && '📢 [Admin Message] '}
                  {title && title.trim() ? (
                    <span className="font-bold text-white">{title.trim()} — </span>
                  ) : null}
                  {message.trim() ? (
                    <div className="prose prose-sm prose-invert max-w-none mt-2 whitespace-normal break-words [overflow-wrap:anywhere]" dangerouslySetInnerHTML={{ __html: message }} />
                  ) : (
                    <span>Your message preview will appear here...</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action button bar */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              setTitle('');
              setMessage('');
              setSelectedTeamIds([]);
              setSelectedEmails([]);
            }}
            className="px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-colors text-sm"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={sending || !message.trim()}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 dark:shadow-none transition-all flex items-center justify-center gap-2 text-sm"
          >
            {sending && (
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            <span>{editMessageId ? 'Update Message' : 'Send Notification Broadcast'}</span>
          </button>
        </div>
      </form>
      )}

      {/* Full Message Reader Popup Modal */}
      {selectedHistoryModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden transform transition-all duration-300 ${isFullScreen ? 'w-full h-full rounded-none m-0' : 'max-w-lg w-full max-h-[80vh] rounded-3xl scale-100'}`}>
            <div className="p-6 pb-4 flex items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl shrink-0">
                  📢
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base leading-tight">
                    {selectedHistoryModal.title || 'Broadcast Details'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {new Date(selectedHistoryModal.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
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
                  onClick={() => {
                    setSelectedHistoryModal(null);
                    setIsFullScreen(false);
                  }}
                  className="px-3.5 py-1.5 bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all shadow-sm shrink-0"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/60 dark:border-slate-700/60">
                <div className="text-sm md:text-base text-slate-700 dark:text-slate-200 font-medium whitespace-pre-line leading-relaxed prose prose-sm dark:prose-invert max-w-none [overflow-wrap:anywhere]" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatNotificationMessage(selectedHistoryModal.message, false)) }}>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && createPortal(
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 max-w-md w-full rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transform scale-100 transition-all duration-300">
            <div className="p-6 pb-4 flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-500 flex items-center justify-center text-3xl">
                ⚠️
              </div>
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-xl mb-2">Delete Broadcast?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Are you sure you want to delete this message? This action will immediately recall and remove the notification from all recipients' dashboards.
                </p>
              </div>
            </div>
            <div className="p-6 pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(null)}
                disabled={isDeleting}
                className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-colors text-sm w-full"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteMessage(deleteModalOpen)}
                disabled={isDeleting}
                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 dark:shadow-none transition-all flex items-center justify-center gap-2 text-sm w-full"
              >
                {isDeleting && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
