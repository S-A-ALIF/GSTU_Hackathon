import { API_URL } from '../config';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import CreateTeamModal from '../features/team/CreateTeamModal';
import JoinTeamModal from '../features/team/JoinTeamModal';
import ConfirmModal from '../components/ConfirmModal';
import MemberInfoModal from '../features/team/MemberInfoModal';
import InviteMentorModal from '../features/team/InviteMentorModal';
import TeamManagementModal from '../features/team/TeamManagementModal';
import { userCache } from '../utils/userCache';

export default function TeamPage({ inDashboard = false, readOnly = false }) {
  const { currentUser } = useAuth();
  const [team, setTeam] = useState(userCache.team || null);
  const [loading, setLoading] = useState(!userCache.lastFetched.team);
  const [invitations, setInvitations] = useState(userCache.invitations || []);
  const [invLoading, setInvLoading] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isInviteMentorOpen, setIsInviteMentorOpen] = useState(false);
  const [isConfirmLeaveOpen, setIsConfirmLeaveOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    variant: 'danger',
    onConfirm: () => {}
  });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchActiveInvitations = async (force = false) => {
    if (!force && userCache.isFresh('invitations')) {
      setInvitations(userCache.invitations || []);
      setInvLoading(false);
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      if (!userCache.lastFetched.invitations || force) {
        setInvLoading(true);
      }
      const res = await fetch(`${API_URL}/api/v1/teams/invitations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        userCache.set('invitations', data.data || []);
        setInvitations(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching active invitations:', err);
    } finally {
      setInvLoading(false);
    }
  };

  const fetchTeam = async (force = false) => {
    if (!force && userCache.isFresh('team')) {
      setTeam(userCache.team);
      setLoading(false);
      return;
    }
    if (!userCache.lastFetched.team || force) {
      setLoading(true);
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(API_URL + '/api/v1/teams/my-team', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        userCache.set('team', data.data);
        setTeam(data.data);
      } else {
        userCache.set('team', null);
        setTeam(null);
      }
    } catch (error) {
      console.error('Error fetching team:', error);
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const executeLeaveTeam = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/teams/leave`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Left team successfully');
        setIsConfirmLeaveOpen(false);
        userCache.invalidate();
        fetchTeam(true);
      } else {
        toast.error(data.message || 'Failed to leave team');
      }
    } catch (error) {
      console.error('Error leaving team:', error);
      toast.error('Network error leaving team');
    }
  };

  const executeTransferLeadership = async (memberId) => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/teams/transfer-leadership`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newLeaderId: memberId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Leadership transferred successfully');
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        userCache.invalidate();
        fetchTeam(true);
      } else {
        toast.error(data.message || 'Failed to transfer leadership');
      }
    } catch (error) {
      console.error('Error transferring leadership:', error);
      toast.error('Network error transferring leadership');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransferLeadership = (e, memberId, memberEmail) => {
    e.stopPropagation();
    setActiveDropdownId(null);
    setConfirmConfig({
      isOpen: true,
      title: "Transfer Leadership?",
      message: `Are you sure you want to transfer leadership to ${memberEmail}? You will become a regular member.`,
      confirmText: "Transfer Leadership",
      variant: "warning",
      onConfirm: () => executeTransferLeadership(memberId)
    });
  };

  const executeRemoveMember = async (memberId) => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/teams/members/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Member removed');
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        userCache.invalidate();
        fetchTeam(true);
      } else {
        toast.error(data.message || 'Failed to remove member');
      }
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Network error removing member');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = (e, memberId, memberEmail) => {
    e.stopPropagation();
    setActiveDropdownId(null);
    setConfirmConfig({
      isOpen: true,
      title: "Remove Member?",
      message: `Are you sure you want to remove ${memberEmail} from the team?`,
      confirmText: "Remove",
      variant: "danger",
      onConfirm: () => executeRemoveMember(memberId)
    });
  };

  const handleLeaveTeam = () => {
    setIsConfirmLeaveOpen(true);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.dropdown-menu-container') && activeDropdownId) {
        setActiveDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeDropdownId]);

  useEffect(() => {
    fetchTeam();
  }, []);

  // Fetch invitations once when team loads and user is leader — cached in parent
  useEffect(() => {
    if (team && currentUser && team.leader_id === currentUser.id) {
      fetchActiveInvitations();
    }
  }, [team?.id]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className={inDashboard ? 'py-2' : 'min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8'}>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">My Team</h1>
          <p className="mt-2 text-lg text-slate-600">Collaborate and manage your hackathon squad.</p>
        </div>

        {/* Content */}
        {!team ? (
          // Empty State
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm max-w-lg mx-auto">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">You haven't joined a team yet</h3>
            <p className="text-slate-500 mb-8">Create your own hackathon team or join an existing one using an invite code.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {!readOnly && (
                <>
                  <button
                    onClick={() => setIsJoinModalOpen(true)}
                    className="px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl transition-all"
                  >
                    Join with Code
                  </button>
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all"
                  >
                    Create a New Team
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          // Populated State
          <div className="space-y-8">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-4 sm:p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 flex-wrap gap-4">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900">{team.name}</h2>
                  <p className="text-slate-500 font-medium mt-1 text-sm sm:text-base">Created on {new Date(team.created_at).toLocaleDateString()}</p>
                  {team.mentor_id && (
                    <p className="text-blue-600 font-bold mt-1 text-sm sm:text-base flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                      Mentored by: {team.mentor_name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full sm:w-auto">
                  {team.team_code && (
                    <div className="flex flex-col gap-1 items-end mr-2">
                      <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl font-mono text-xs sm:text-sm font-bold text-slate-800">
                        <span>Code:</span>
                        <span className="text-blue-600">{team.team_code}</span>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(team.team_code);
                            toast.success('Team Code copied to clipboard!');
                          }}
                          className="text-slate-400 hover:text-slate-600 ml-1"
                          title="Copy Code"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">Give this code to your team mate to join your team</span>
                    </div>
                  )}
                  <div className="relative group cursor-pointer inline-flex items-center">
                    {team.minMembers !== null && team.minMembers !== undefined && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg shadow-lg whitespace-nowrap z-30 pointer-events-none border border-slate-700">
                        min team size {team.minMembers ?? 3}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900" />
                      </div>
                    )}
                    <span 
                      onClick={() => {
                        if (!team.is_full && team.members.length < (team.minMembers ?? 3)) {
                          toast.info(`min team size ${team.minMembers ?? 3}`);
                        }
                      }}
                      className={`px-4 py-2 font-bold rounded-full text-xs sm:text-sm flex items-center gap-1.5 transition-colors ${
                      team.is_full
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : team.members.length < (team.minMembers ?? 3)
                        ? 'bg-red-100 text-red-700 border border-red-300 shadow-sm cursor-pointer'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {team.is_full && <span>🔒 Declared Full</span>}
                      <span>({team.members.length} / {team.maxMembers || 5} Members)</span>
                      {!team.is_full && team.members.length < (team.minMembers ?? 3) && (
                        <svg className="w-4 h-4 text-red-600 flex-shrink-0 ml-0.5 animate-pulse" fill="currentColor" viewBox="0 0 20 20" title={`min team size ${team.minMembers ?? 3}`}>
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      )}
                    </span>
                  </div>
                  {!readOnly && (
                    team.leader_id !== currentUser?.id ? (
                      <button
                        onClick={handleLeaveTeam}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-colors shadow-sm"
                      >
                        Leave Team
                      </button>
                    ) : (
                      <button
                        onClick={() => setIsManageModalOpen(true)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs sm:text-sm transition-colors shadow-sm flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Manage Team
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2 gap-1">
                  <h3 className="text-lg font-bold text-slate-900">Team Members</h3>
                  <span className="text-xs font-semibold text-slate-400">Click any member to view full details</span>
                </div>
                <div className="grid gap-4">
                  {team.members.map((member) => (
                    <div 
                      key={member.id} 
                      onClick={() => setSelectedMember(member)}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 p-4 bg-slate-50 rounded-2xl border border-slate-100 transition-all hover:bg-white hover:border-blue-300 hover:shadow-md cursor-pointer group"
                    >
                      <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 w-full">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-base sm:text-lg shadow-sm shrink-0">
                          {(member.name || member.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors break-words whitespace-normal">
                            {member.name || member.email}
                          </p>
                          <p className="text-xs sm:text-sm font-semibold text-slate-500 break-words whitespace-normal">
                            Student ID: <span className="text-slate-700 font-bold">{member.student_id && member.student_id !== 'N/A' ? member.student_id : 'Not provided'}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto shrink-0 mt-2 sm:mt-0">
                        {member.id === team.leader_id && (
                          <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full uppercase tracking-wide">
                            Leader
                          </span>
                        )}
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-all flex items-center gap-1">
                          <span>View Info</span>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                        </span>
                        
                        {!readOnly && team.leader_id === currentUser?.id && member.id !== team.leader_id && (
                          <div className="relative inline-block text-left dropdown-menu-container">
                            <button 
                              onClick={() => {
                                setActiveDropdownId(activeDropdownId === member.id ? null : member.id);
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                              </svg>
                            </button>
                            {activeDropdownId === member.id && (
                              <div className="origin-top-right absolute right-0 mt-2 w-40 rounded-xl shadow-lg bg-white dark:bg-slate-800 ring-1 ring-black ring-opacity-5 divide-y divide-slate-100 dark:divide-slate-700 z-10 animate-in fade-in slide-in-from-top-2 border border-slate-200 dark:border-slate-700">
                                <div className="py-1">
                                  <button
                                    onClick={(e) => handleTransferLeadership(e, member.id, member.email)}
                                    className="group flex w-full items-center px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                  >
                                    Make Leader
                                  </button>
                                  <button
                                    onClick={(e) => handleRemoveMember(e, member.id, member.email)}
                                    className="group flex w-full items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* If user is leader, they might want to invite more people */}
            {!readOnly && team.leader_id === currentUser?.id && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
                {(team.maxMembers === null || team.members.length < (team.maxMembers || 5)) && !team.is_full ? (
                  <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-6 py-3 bg-white text-blue-600 font-bold rounded-xl border border-blue-200 hover:bg-blue-50 transition-all shadow-sm inline-flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <span>Add member ({team.maxMembers ? `${team.members.length}/${team.maxMembers}` : team.members.length})</span>
                  </button>
                ) : (
                  <div className="inline-flex items-center space-x-2 px-6 py-3 bg-slate-100 text-slate-500 font-bold rounded-xl border border-slate-200">
                    <span>{team.is_full ? 'Team Declared Full' : 'Team Maximum Limit Reached'} ({team.maxMembers ? `${team.members.length}/${team.maxMembers}` : team.members.length})</span>
                  </div>
                )}
                
                {!team.mentor_id && (
                  <button
                    onClick={() => setIsInviteMentorOpen(true)}
                    className="px-6 py-3 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 font-bold rounded-xl transition-colors shadow-sm inline-flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span>Invite Mentor</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <CreateTeamModal 
        isOpen={isCreateModalOpen} 
        mode={team ? 'invite' : 'create'}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => { userCache.invalidate(); fetchTeam(true); if (team) fetchActiveInvitations(true); }}
      />
      {team && (
        <TeamManagementModal
          isOpen={isManageModalOpen}
          onClose={() => setIsManageModalOpen(false)}
          team={team}
          currentUser={currentUser}
          onTeamUpdated={() => { userCache.invalidate(); fetchTeam(true); }}
          invitations={invitations}
          invLoading={invLoading}
          onFetchInvitations={fetchActiveInvitations}
          onInvitationCancelled={(invId) => setInvitations(prev => prev.filter(i => i.id !== invId))}
        />
      )}
      <JoinTeamModal 
        isOpen={isJoinModalOpen} 
        onClose={() => setIsJoinModalOpen(false)}
        onSuccess={() => { userCache.invalidate(); fetchTeam(true); }}
      />
      <InviteMentorModal
        isOpen={isInviteMentorOpen}
        onClose={() => setIsInviteMentorOpen(false)}
        teamId={team?.id}
      />
      <ConfirmModal
        isOpen={isConfirmLeaveOpen || confirmConfig.isOpen}
        onClose={() => {
          setIsConfirmLeaveOpen(false);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }}
        onConfirm={() => {
          if (confirmConfig.isOpen) {
            confirmConfig.onConfirm();
          } else {
            executeLeaveTeam();
          }
        }}
        title={confirmConfig.isOpen ? confirmConfig.title : "Leave Team?"}
        message={confirmConfig.isOpen ? confirmConfig.message : "Are you sure you want to leave this team? You will lose access to the team and its resources."}
        confirmText={confirmConfig.isOpen ? confirmConfig.confirmText : "Leave Team"}
        variant={confirmConfig.isOpen ? confirmConfig.variant : "danger"}
        loading={actionLoading}
      />
      <MemberInfoModal
        isOpen={!!selectedMember}
        onClose={() => setSelectedMember(null)}
        member={selectedMember}
        isLeader={team?.leader_id === selectedMember?.id}
      />
    </div>
  );
}
