import { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminSubmissionsTab() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [rejectModal, setRejectModal] = useState({ isOpen: false, teamId: null, teamName: '' });
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  
  // Modals state
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  const { currentUser } = useAuth();

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/submissions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setSubmissions(data.data);
      } else {
        setError(data.message || 'Failed to load submissions.');
      }
    } catch (err) {
      console.error('Failed to fetch submissions:', err);
      setError(err.message || 'Failed to load submissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const confirmRejectSubmission = async () => {
    try {
      setIsRejecting(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/submissions/${rejectModal.teamId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: rejectReason })
      });
      const data = await res.json();
      if (data.success) {
        fetchSubmissions();
        setRejectModal({ isOpen: false, teamId: null, teamName: '' });
        setRejectReason('');
      } else {
        setError(data.message || 'Failed to reject submission.');
        setRejectModal({ isOpen: false, teamId: null, teamName: '' });
        setRejectReason('');
      }
    } catch (err) {
      console.error('Failed to reject submission:', err);
      setError(err.message || 'Failed to reject submission.');
      setRejectModal({ isOpen: false, teamId: null, teamName: '' });
      setRejectReason('');
    } finally {
      setIsRejecting(false);
    }
  };

  const filteredSubmissions = submissions.filter((sub) =>
    sub.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sub.leader_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
            Project Submissions
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Review teams that have officially submitted their projects.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search teams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-700 dark:text-slate-200 transition-all placeholder:text-slate-400"
            />
          </div>
          <button 
            onClick={fetchSubmissions}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl transition-colors border border-slate-200 dark:border-slate-600"
            title="Refresh List"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-800 flex items-center gap-3">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 shadow-sm border border-slate-200 dark:border-slate-700 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-slate-500 dark:text-slate-400">Loading submissions...</p>
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 shadow-sm border border-slate-200 dark:border-slate-700 text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">No Submissions Found</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-sm">
            {searchTerm ? "No submitted teams match your search criteria." : "No teams have officially submitted their projects yet."}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-4 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Team</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Leader</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Links</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Submitted At</th>
                  <th className="py-4 px-6 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {filteredSubmissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors">
                    <td className="py-4 px-6">
                      <button 
                        onClick={() => setSelectedTeam(sub)}
                        className="font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-left transition-colors"
                      >
                        {sub.name}
                      </button>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-200">{sub.leader_name || 'N/A'}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{sub.leader_email}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col gap-1.5">
                        {sub.live_url && (
                          <a 
                            href={sub.live_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 text-xs font-semibold hover:underline"
                          >
                            <span className="w-16 text-slate-500 shrink-0">Live:</span>
                            <span className="truncate max-w-[150px]">{sub.live_url}</span>
                          </a>
                        )}
                        {sub.video_url && (
                          <a 
                            href={sub.video_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 text-xs font-semibold hover:underline"
                          >
                            <span className="w-16 text-slate-500 shrink-0">Video:</span>
                            <span className="truncate max-w-[150px]">{sub.video_url}</span>
                          </a>
                        )}
                        {sub.repo_url && (
                          <a 
                            href={sub.repo_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 text-xs font-semibold hover:underline"
                          >
                            <span className="w-16 text-slate-500 shrink-0">Repo:</span>
                            <span className="truncate max-w-[150px]">{sub.repo_url}</span>
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {new Date(sub.submitted_at).toLocaleDateString(undefined, {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(sub.submitted_at).toLocaleTimeString(undefined, {
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          setRejectModal({ isOpen: true, teamId: sub.id, teamName: sub.name });
                          setRejectReason('');
                        }}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-800"
                        title="Reject Submission"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reject Submission Confirmation Modal */}
      {rejectModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">Reject Submission</h3>
            <p className="text-slate-300 mb-4 text-sm leading-relaxed">
              Are you sure you want to reject the submission for <strong>{rejectModal.teamName}</strong>? They will be removed from this list and will need to submit again from their workspace. A notification will be sent to the Team Leader.
            </p>
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                Reason for Rejection (Optional)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Invalid GitHub link..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none h-20"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setRejectModal({ isOpen: false, teamId: null, teamName: '' });
                  setRejectReason('');
                }}
                disabled={isRejecting}
                className="px-4 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors font-medium text-sm disabled:opacity-50"
              >
                Go Back
              </button>
              <button
                onClick={confirmRejectSubmission}
                disabled={isRejecting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-lg shadow-red-600/30 transition-colors flex items-center gap-2"
              >
                {isRejecting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Rejecting...
                  </>
                ) : (
                  'Confirm Reject'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Info Modal */}
      {selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-start mb-6 shrink-0">
              <div>
                <h3 className="text-2xl font-black text-white">{selectedTeam.name}</h3>
                <p className="text-slate-400 text-sm mt-1">
                  Team Size: <span className="text-white font-bold">{selectedTeam.members ? selectedTeam.members.length : 0} members</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedTeam(null)}
                className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 pr-2 space-y-6 custom-scrollbar">
              {/* Mentor Info */}
              {selectedTeam.mentor_email ? (
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-emerald-500 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                    </svg>
                    Team Mentor
                  </h4>
                  <button 
                    onClick={() => setSelectedUser({ 
                      name: selectedTeam.mentor_name, 
                      email: selectedTeam.mentor_email, 
                      role: 'mentor'
                    })}
                    className="w-full text-left p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-emerald-500/30 hover:bg-slate-800 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-white font-bold group-hover:text-emerald-400 transition-colors">{selectedTeam.mentor_name || 'N/A'}</div>
                      <div className="text-slate-400 text-sm mt-0.5">{selectedTeam.mentor_email}</div>
                    </div>
                    <svg className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Team Mentor</h4>
                  <div className="p-3 rounded-xl border border-dashed border-slate-700 text-slate-500 text-sm text-center">
                    No mentor assigned
                  </div>
                </div>
              )}

              {/* Members List */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-blue-400 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Team Members
                </h4>
                <div className="space-y-2">
                  {selectedTeam.members && selectedTeam.members.length > 0 ? selectedTeam.members.map(member => (
                    <button 
                      key={member.id}
                      onClick={() => setSelectedUser(member)}
                      className="w-full text-left p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-blue-500/30 hover:bg-slate-800 transition-colors flex items-center justify-between group"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold group-hover:text-blue-400 transition-colors">
                            {member.name || member.email.split('@')[0]}
                          </span>
                          {selectedTeam.leader_id === member.id && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-500 border border-amber-500/20">
                              Leader
                            </span>
                          )}
                        </div>
                        <div className="text-slate-400 text-sm mt-0.5">{member.email}</div>
                      </div>
                      <svg className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )) : (
                    <div className="p-3 rounded-xl border border-dashed border-slate-700 text-slate-500 text-sm text-center">
                      No members found
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Info Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${
                  selectedUser.role === 'mentor' 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }`}>
                  {(selectedUser.name?.[0] || selectedUser.email?.[0] || '?').toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">{selectedUser.name || 'Unknown User'}</h3>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-0.5">
                    {selectedUser.role === 'mentor' ? 'Mentor' : 'Participant'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full transition-colors shrink-0"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Email Address</p>
                <p className="text-sm font-medium text-slate-200">{selectedUser.email}</p>
              </div>
              
              {selectedUser.role !== 'mentor' && (
                <>
                  <div className="h-px w-full bg-slate-700/50 my-2"></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Student ID</p>
                      <p className="text-sm font-medium text-slate-200">{selectedUser.student_id || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Batch / Session</p>
                      <p className="text-sm font-medium text-slate-200">{selectedUser.batch_session || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="h-px w-full bg-slate-700/50 my-2"></div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Phone Number</p>
                    <p className="text-sm font-medium text-slate-200">{selectedUser.phone_number || 'N/A'}</p>
                  </div>
                </>
              )}
            </div>
            
            <div className="mt-6">
              <button
                onClick={() => setSelectedUser(null)}
                className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-colors text-sm"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
