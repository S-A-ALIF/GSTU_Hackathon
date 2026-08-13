import { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import { toast } from 'sonner';
import DetailsInfoModal from './DetailsInfoModal';
import BanModal from './BanModal';
import EditModal from './EditModal';
import ConfirmModal from '../../components/ConfirmModal';
import { adminCache } from './adminCache';

export default function AdminTeamsTab({ activeTab }) {
  const [teams, setTeams] = useState(adminCache.teams || []);
  const [loading, setLoading] = useState(!adminCache.teams);
  const [expandedTeams, setExpandedTeams] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Delete',
    variant: 'danger',
    onConfirm: () => {}
  });

  // Modals state
  const [detailsModalData, setDetailsModalData] = useState(null);
  const [detailsModalType, setDetailsModalType] = useState('team');
  const [editModalData, setEditModalData] = useState(null);
  const [banModalConfig, setBanModalConfig] = useState({ isOpen: false, target: null, isBanning: false });
  const [editModalType, setEditModalType] = useState('team');

  // Menu open state
  const [openMenuId, setOpenMenuId] = useState(null);

  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  // Sorting and filtering state
  const [sortField, setSortField] = useState('creation_date');
  const [sortOrder, setSortOrder] = useState('descending');
  const [teamFilter, setTeamFilter] = useState('all');

  const fetchTeams = async (force = false) => {
    if (!force && adminCache.isFresh('teams')) {
      setTeams(adminCache.teams);
      setLoading(false);
      return;
    }
    if (!adminCache.teams || force) {
      setLoading(true);
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/teams`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        adminCache.set('teams', data.data);
        setTeams(data.data);
      } else {
        toast.error(data.message || 'Failed to fetch teams');
      }
    } catch (error) {
      console.error('Error loading teams:', error);
      toast.error('Error fetching teams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams(false);
  }, []);

  useEffect(() => {
    if (teams.length > 0 && activeTab === 'teams') {
      const openTeamId = localStorage.getItem('admin_open_team_id');
      if (openTeamId) {
        setExpandedTeams(prev => ({ ...prev, [openTeamId]: true }));
        localStorage.removeItem('admin_open_team_id');
        setTimeout(() => {
          const el = document.getElementById(`team-row-${openTeamId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
            setTimeout(() => el.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2'), 2000);
          }
        }, 100);
      }
    }
  }, [teams, activeTab]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.dropdown-menu-container') && openMenuId) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  const toggleExpand = (teamId) => {
    setExpandedTeams((prev) => ({
      ...prev,
      [teamId]: !prev[teamId]
    }));
  };

  const toggleExpandAll = () => {
    const allExpanded = Object.keys(expandedTeams).length === teams.length;
    if (allExpanded) {
      setExpandedTeams({});
    } else {
      const next = {};
      teams.forEach((t) => {
        next[t.id] = true;
      });
      setExpandedTeams(next);
    }
  };

  const executeDeleteTeam = async (teamId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/teams/${teamId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Team deleted successfully');
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        fetchTeams();
      } else {
        toast.error(data.message || 'Failed to delete team');
      }
    } catch (err) {
      console.error('Error deleting team:', err);
      toast.error('Error deleting team');
    }
  };

  const handleDeleteTeam = (teamId, teamName) => {
    setConfirmConfig({
      isOpen: true,
      title: "Delete Team?",
      message: `Are you sure you want to permanently delete team "${teamName}"? This action cannot be undone.`,
      confirmText: "Delete Team",
      variant: "danger",
      requireInput: true,
      requireInputText: "delete",
      onConfirm: () => executeDeleteTeam(teamId)
    });
  };

  const executeBulkDelete = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/teams/bulk-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids: selectedIds })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Teams deleted successfully');
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setIsSelectionMode(false);
        setSelectedIds([]);
        adminCache.invalidate();
        fetchTeams(true);
      } else {
        toast.error(data.message || 'Failed to delete teams');
      }
    } catch (err) {
      console.error('Error in bulk delete:', err);
      toast.error('Error deleting teams');
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmConfig({
      isOpen: true,
      title: "Delete Selected Teams?",
      message: `Are you sure you want to permanently delete ${selectedIds.length} teams? This action cannot be undone.`,
      confirmText: `Delete ${selectedIds.length} Teams`,
      variant: "danger",
      requireInput: true,
      requireInputText: "delete",
      onConfirm: () => executeBulkDelete()
    });
  };

  const executeBanToggleTeam = async (reason) => {
    if (!banModalConfig.target) return;
    const team = banModalConfig.target;
    const nextBan = !team.is_banned;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/teams/${team.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          is_banned: nextBan,
          ban_reason: nextBan ? reason : null
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(nextBan ? 'Team has been banned' : 'Team is unbanned');
        setBanModalConfig({ isOpen: false, target: null, isBanning: false });
        adminCache.invalidate();
        fetchTeams(true);
      } else {
        toast.error(data.message || 'Failed to update ban status');
      }
    } catch (err) {
      console.error('Error ban toggle:', err);
      toast.error('Error updating ban status');
    }
  };

  const handleBanToggleTeam = (team) => {
    const nextBan = !team.is_banned;
    setBanModalConfig({
      isOpen: true,
      target: team,
      isBanning: nextBan
    });
  };

  const executeDeleteMember = async (memberId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/members/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Member deleted successfully');
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        adminCache.invalidate();
        fetchTeams(true);
      } else {
        toast.error(data.message || 'Failed to delete member');
      }
    } catch (err) {
      console.error('Error deleting member:', err);
      toast.error('Error deleting member');
    }
  };

  const handleDeleteMember = (memberId, memberEmail) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Member',
      message: `Are you sure you want to remove user "${memberEmail}" from their team?`,
      confirmText: 'Remove Member',
      variant: 'danger',
      requireInput: true,
      requireInputText: 'delete',
      onConfirm: () => executeDeleteMember(memberId)
    });
  };

  const handleEditTeam = (team) => {
    setEditModalData(team);
    setEditModalType('team');
  };

  const handleEditMember = (member) => {
    setEditModalData(member);
    setEditModalType('member');
  };

  const handleSaveEdit = () => {
    fetchTeams(true);
  };

  const getMinTeamSize = () => {
    if (adminCache.settings && adminCache.settings.min_team_members !== 'none' && adminCache.settings.min_team_members) {
      return parseInt(adminCache.settings.min_team_members, 10) || 3;
    }
    return 3;
  };

  const filteredTeams = teams.filter((t) => {
    const s = searchTerm.toLowerCase();
    const nameMatch = t.name && t.name.toLowerCase().includes(s);
    const leaderMatch = t.leader_email && t.leader_email.toLowerCase().includes(s);
    if (s && !nameMatch && !leaderMatch) return false;

    if (teamFilter === 'valid') {
       if (!t.mentor_id || (t.members?.length || 0) < getMinTeamSize()) return false;
    } else if (teamFilter === 'invalid') {
       if (t.mentor_id && (t.members?.length || 0) >= getMinTeamSize()) return false;
    }
    
    return true;
  });

  const sortedTeams = [...filteredTeams].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'creation_date') {
      comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    } else if (sortField === 'team_size') {
      comparison = (a.members?.length || 0) - (b.members?.length || 0);
    } else if (sortField === 'status') {
      comparison = (a.is_banned === b.is_banned) ? 0 : (a.is_banned ? 1 : -1);
    }
    
    return sortOrder === 'descending' ? -comparison : comparison;
  });

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Teams Management</h2>
          <p className="text-slate-600 text-sm mt-1">
            Total Teams: <span className="font-bold text-slate-900">{teams.length}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isSelectionMode ? (
            <>
              <button
                onClick={() => {
                  if (selectedIds.length === filteredTeams.length) {
                    setSelectedIds([]);
                  } else {
                    setSelectedIds(filteredTeams.map(t => t.id));
                  }
                }}
                className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold rounded-xl text-sm transition-colors"
              >
                {selectedIds.length === filteredTeams.length && filteredTeams.length > 0 ? 'Deselect All' : 'Select All'}
              </button>
              <button
                onClick={() => {
                  setIsSelectionMode(false);
                  setSelectedIds([]);
                }}
                className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold rounded-xl text-sm transition-colors"
              >
                Cancel Selection
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={selectedIds.length === 0}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold rounded-xl text-sm transition-colors"
              >
                Confirm Delete ({selectedIds.length})
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsSelectionMode(true)}
                className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded-xl text-sm transition-colors"
              >
                Delete Multiple
              </button>
              <button
                onClick={toggleExpandAll}
                className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold rounded-xl text-sm transition-colors"
              >
                {Object.keys(expandedTeams).length === teams.length ? 'Collapse All' : 'Expand All'}
              </button>
              <button
                onClick={() => fetchTeams(true)}
                className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold rounded-xl text-sm transition-colors"
              >
                Refresh
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
        <input
          type="text"
          placeholder="Search teams by name or leader email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 font-semibold text-sm"
        />
        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 font-semibold text-sm bg-white"
        >
          <option value="all">All Teams</option>
          <option value="valid">Valid Teams</option>
          <option value="invalid">Invalid Teams</option>
        </select>
        <select
          value={sortField}
          onChange={(e) => setSortField(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 font-semibold text-sm bg-white"
        >
          <option value="creation_date">Sort by Creation Date</option>
          <option value="team_size">Sort by Team Size</option>
          <option value="status">Sort by Status</option>
        </select>
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 font-semibold text-sm bg-white"
        >
          <option value="descending">Descending</option>
          <option value="ascending">Ascending</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      ) : sortedTeams.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
          <p className="text-slate-500 font-semibold">No teams found matching your criteria.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedTeams.map((team) => {
            const isExpanded = Boolean(expandedTeams[team.id]);
            const teamMenuKey = `team-${team.id}`;
            const isMenuOpen = openMenuId === teamMenuKey;
            const hasOpenMenu = isMenuOpen || (team.members && team.members.some(m => openMenuId === `member-${m.id}`));

            return (
              <div
                key={team.id}
                id={`team-row-${team.id}`}
                className={`bg-white rounded-2xl border border-slate-200 shadow-sm transition-all duration-500 ${hasOpenMenu ? 'relative z-30' : 'relative z-10'}`}
              >
                {/* Team Header Row */}
                <div className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors ${isExpanded ? 'rounded-t-2xl' : 'rounded-2xl'}`}>
                  <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => !isSelectionMode && toggleExpand(team.id)}>
                    {isSelectionMode ? (
                      <div className="shrink-0 pl-1 pr-2 flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(team.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            if (e.target.checked) {
                              setSelectedIds(prev => [...prev, team.id]);
                            } else {
                              setSelectedIds(prev => prev.filter(id => id !== team.id));
                            }
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-5 h-5 cursor-pointer"
                        />
                      </div>
                    ) : (
                      <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg shrink-0">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    )}
                    <div className="min-w-0" onClick={(e) => isSelectionMode && toggleExpand(team.id)}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-slate-900 text-base sm:text-lg truncate">{team.name}</h3>
                        {team.is_banned && (
                          <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-xs font-bold shrink-0">
                            BANNED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        Leader: <strong>{team.leader_name || team.leader_email}</strong> • Created{' '}
                        {new Date(team.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto">
                    <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full font-bold text-xs shrink-0">
                      {team.members?.length || 0} Members
                    </span>

                    <button
                      onClick={() => {
                        setDetailsModalData(team);
                        setDetailsModalType('team');
                      }}
                      className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors"
                    >
                      Details
                    </button>

                    {/* Three Dot Menu Button */}
                    <div className="relative dropdown-menu-container">
                      <button
                        onClick={() => setOpenMenuId(isMenuOpen ? null : teamMenuKey)}
                        className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-lg"
                      >
                        ⋮
                      </button>

                      {isMenuOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-20">
                          <button
                            onClick={() => {
                              setOpenMenuId(null);
                              setEditModalData(team);
                              setEditModalType('team');
                            }}
                            className="w-full text-left px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            ✏️ Edit Team
                          </button>
                          <button
                            onClick={() => {
                              setOpenMenuId(null);
                              handleBanToggleTeam(team);
                            }}
                            className="w-full text-left px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 flex items-center gap-2"
                          >
                            {team.is_banned ? '🟢 Unban Team' : '🚫 Ban Team'}
                          </button>
                          <button
                            onClick={() => {
                              setOpenMenuId(null);
                              handleDeleteTeam(team.id, team.name);
                            }}
                            className="w-full text-left px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            🗑️ Delete Team
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Member List */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/70 p-4 space-y-2 rounded-b-2xl">
                    {team.mentor_id && (
                      <div className="mb-5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-purple-500 mb-2 px-2">
                          Team Mentor
                        </h4>
                        <div className="p-3 bg-white rounded-xl border border-purple-100 shadow-sm flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">
                              🎓
                            </span>
                            <div>
                              <div className="font-bold text-slate-900 text-sm">
                                {team.mentor_name || 'Unnamed Mentor'}
                              </div>
                              <div className="text-xs text-slate-500">
                                {team.mentor_email}
                              </div>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 text-xs font-bold uppercase">
                            Mentor
                          </span>
                        </div>
                      </div>
                    )}

                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 px-2">
                      Registered Team Members
                    </h4>

                    {team.members && team.members.length > 0 ? (
                      team.members.map((member) => {
                        const memberMenuKey = `member-${member.id}`;
                        const isMemberMenuOpen = openMenuId === memberMenuKey;

                        return (
                          <div
                            key={member.id}
                            className={`p-3 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 sm:gap-4 ${isMemberMenuOpen ? 'relative z-30' : 'relative z-0'}`}
                          >
                            <div
                              className="flex items-center gap-3 cursor-pointer flex-1 min-w-0 order-1"
                              onClick={() => {
                                setDetailsModalData({ ...member, team_name: team.name });
                                setDetailsModalType('member');
                              }}
                            >
                              <span className="w-8 h-8 shrink-0 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
                                👤
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5 truncate">
                                  <span className="truncate">{member.name || 'Unnamed Member'}</span>
                                  {team.leader_id === member.id && (
                                    <span title="Team Leader" className="text-amber-500 shrink-0">👑</span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-500 truncate">
                                  {member.email} {member.student_id ? `• ID: ${member.student_id}` : ''}
                                </div>
                              </div>
                            </div>

                            <div className="w-full sm:w-auto order-3 sm:order-2 flex justify-start sm:justify-end pl-11 sm:pl-0 mt-0 sm:mt-0">
                              <span className="px-2 sm:px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-[10px] sm:text-xs font-bold uppercase shrink-0">
                                {member.role || 'Member'}
                              </span>
                            </div>

                            <div className="relative dropdown-menu-container order-2 sm:order-3 shrink-0">
                                <button
                                  onClick={() =>
                                    setOpenMenuId(isMemberMenuOpen ? null : memberMenuKey)
                                  }
                                  className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 font-bold"
                                >
                                  ⋮
                                </button>

                                {isMemberMenuOpen && (
                                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-20">
                                    <button
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        setEditModalData(member);
                                        setEditModalType('member');
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                    >
                                      ✏️ Edit Member
                                    </button>
                                    <button
                                      onClick={() => {
                                        setOpenMenuId(null);
                                        handleDeleteMember(member.id, member.email);
                                      }}
                                      className="w-full text-left px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                      🗑️ Delete Member
                                    </button>
                                  </div>
                                )}
                              </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-slate-500 italic px-2">No registered members in this team.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Details Modal */}
      <DetailsInfoModal
        isOpen={Boolean(detailsModalData)}
        onClose={() => setDetailsModalData(null)}
        data={detailsModalData}
        type={detailsModalType}
      />

      {/* Edit Modal */}
      <EditModal
        isOpen={Boolean(editModalData)}
        onClose={() => setEditModalData(null)}
        data={editModalData}
        type={editModalType}
        onSaved={fetchTeams}
      />

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        variant={confirmConfig.variant}
        requireInput={confirmConfig.requireInput}
        requireInputText={confirmConfig.requireInputText}
      />

      <BanModal
        isOpen={banModalConfig.isOpen}
        onClose={() => setBanModalConfig({ isOpen: false, target: null, isBanning: false })}
        onConfirm={executeBanToggleTeam}
        entityName={banModalConfig.target?.name || 'Team'}
        isBanning={banModalConfig.isBanning}
      />
    </div>
  );
}
