import { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import { toast } from 'sonner';
import DetailsInfoModal from './DetailsInfoModal';
import EditModal from './EditModal';
import ConfirmModal from '../../components/ConfirmModal';
import { adminCache } from './adminCache';
import BanModal from './BanModal';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminMembersTab({ setParentActiveTab }) {
  const { socket } = useAuth();
  const [members, setMembers] = useState(adminCache.members || []);
  const [loading, setLoading] = useState(!adminCache.members);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [banModalConfig, setBanModalConfig] = useState({ isOpen: false, target: null, isBanning: false });
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
  const [editModalData, setEditModalData] = useState(null);

  // Menu open state
  const [openMenuId, setOpenMenuId] = useState(null);

  // Selection mode state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  
  // Tabs state
  const [activeTab, setActiveTab] = useState('students'); // 'students', 'mentors', 'admins'

  const fetchMembers = async (force = false) => {
    if (!force && adminCache.isFresh('members')) {
      setMembers(adminCache.members);
      setLoading(false);
      return;
    }
    if (!adminCache.members || force) {
      setLoading(true);
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/members`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        adminCache.set('members', data.data);
        setMembers(data.data);
      } else {
        toast.error(data.message || 'Failed to fetch members');
      }
    } catch (error) {
      console.error('Error loading members:', error);
      toast.error('Error fetching members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers(false);
  }, []);

  useEffect(() => {
    if (!socket) return;
    
    const handleStatsUpdated = () => {
      fetchMembers(true);
    };
    
    socket.on('statsUpdated', handleStatsUpdated);
    
    return () => {
      socket.off('statsUpdated', handleStatsUpdated);
    };
  }, [socket]);

  const executeBanToggleMember = async (reason) => {
    if (!banModalConfig.target) return;
    const member = banModalConfig.target;
    const nextBan = !member.is_banned;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/members/${member.id}`, {
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
        toast.success(nextBan ? 'Member has been banned' : 'Member is unbanned');
        setBanModalConfig({ isOpen: false, target: null, isBanning: false });
        adminCache.invalidate();
        fetchMembers(true);
      } else {
        toast.error(data.message || 'Failed to update ban status');
      }
    } catch (err) {
      console.error('Error ban toggle:', err);
      toast.error('Error updating ban status');
    }
  };

  const handleBanToggleMember = (member) => {
    const nextBan = !member.is_banned;
    setBanModalConfig({
      isOpen: true,
      target: member,
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
        fetchMembers(true);
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
      title: "Delete Member?",
      message: `Are you sure you want to permanently delete user "${memberEmail}"? This action cannot be undone.`,
      confirmText: "Delete Member",
      variant: "danger",
      requireInput: true,
      requireInputText: "delete",
      onConfirm: () => executeDeleteMember(memberId)
    });
  };

  const executePromoteToMentor = async (member) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/members/${member.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: 'mentor' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`${member.name || member.email} promoted to Mentor successfully`);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        adminCache.invalidate();
        fetchMembers(true);
      } else {
        toast.error(data.message || 'Failed to promote member');
      }
    } catch (err) {
      console.error('Error promoting member:', err);
      toast.error('Error promoting member');
    }
  };

  const handlePromoteToMentor = (member) => {
    setConfirmConfig({
      isOpen: true,
      title: "Promote to Mentor?",
      message: `Are you sure you want to promote "${member.email}" to the Mentor role? They will gain access to the Mentor Dashboard.`,
      confirmText: "Promote to Mentor",
      variant: "info",
      requireInput: false,
      onConfirm: () => executePromoteToMentor(member)
    });
  };

  const executePromoteToAdmin = async (member) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/members/${member.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: 'admin' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`${member.name || member.email} promoted to Admin successfully`);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        adminCache.invalidate();
        fetchMembers(true);
      } else {
        toast.error(data.message || 'Failed to promote member');
      }
    } catch (err) {
      console.error('Error promoting member:', err);
      toast.error('Error promoting member');
    }
  };

  const handlePromoteToAdmin = (member) => {
    setConfirmConfig({
      isOpen: true,
      title: "Promote to Admin?",
      message: `Are you sure you want to promote "${member.email}" to the Admin role? They will gain full administrative privileges.`,
      confirmText: "Promote to Admin",
      variant: "danger",
      requireInput: false,
      onConfirm: () => executePromoteToAdmin(member)
    });
  };

  const executeBulkDelete = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/members/bulk-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids: selectedIds })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Members deleted successfully');
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        setIsSelectionMode(false);
        setSelectedIds([]);
        adminCache.invalidate();
        fetchMembers(true);
      } else {
        toast.error(data.message || 'Failed to delete members');
      }
    } catch (err) {
      console.error('Error in bulk delete:', err);
      toast.error('Error deleting members');
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setConfirmConfig({
      isOpen: true,
      title: "Delete Selected Members?",
      message: `Are you sure you want to permanently delete ${selectedIds.length} members? This action cannot be undone.`,
      confirmText: `Delete ${selectedIds.length} Members`,
      variant: "danger",
      requireInput: true,
      requireInputText: "delete",
      onConfirm: () => executeBulkDelete()
    });
  };

  const [sortOption, setSortOption] = useState('ascending');

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.name && m.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (m.student_id && m.student_id.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesSearch;
  });

  const sortedMembers = [...filteredMembers].sort((a, b) => {
    switch (sortOption) {
      case 'ascending':
        return (a.name || a.email).localeCompare(b.name || b.email);
      case 'descending':
        return (b.name || b.email).localeCompare(a.name || a.email);
      case 'team':
        const teamA = a.team_name || '';
        const teamB = b.team_name || '';
        if (teamA && !teamB) return -1;
        if (!teamA && teamB) return 1;
        return teamA.localeCompare(teamB);
      case 'status':
        if (a.is_banned && !b.is_banned) return -1;
        if (!a.is_banned && b.is_banned) return 1;
        return 0;
      default:
        return 0;
    }
  });

  const admins = sortedMembers.filter(m => m.role === 'admin');
  const mentors = sortedMembers.filter(m => m.role === 'mentor');
  const students = sortedMembers.filter(m => m.role !== 'admin' && m.role !== 'mentor');

  const renderMemberRow = (m) => {
    const menuKey = `member-row-${m.id}`;
    const isMenuOpen = openMenuId === menuKey;

    return (
      <tr
        key={m.id}
        className="hover:bg-slate-50/70 transition-colors"
      >
        {isSelectionMode && (
          <td className="py-3 px-4 w-12 text-center" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={selectedIds.includes(m.id)}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedIds(prev => [...prev, m.id]);
                } else {
                  setSelectedIds(prev => prev.filter(id => id !== m.id));
                }
              }}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
            />
          </td>
        )}
        <td
          className="py-3 px-4 cursor-pointer"
          onClick={() => setDetailsModalData(m)}
        >
          <div className="font-bold text-slate-900">{m.name || 'Unnamed Member'}</div>
          <div className="text-xs text-slate-500">{m.email}</div>
        </td>
        <td className="py-3 px-4 font-mono text-slate-700">{m.student_id || '—'}</td>
        <td className="py-3 px-4 text-slate-700">{m.batch_session || '—'}</td>
        {activeTab !== 'admins' && (
          <td className="py-3 px-4">
          {m.role === 'mentor' && m.mentor_teams ? (
            m.mentor_teams.length === 0 ? (
              <span className="text-slate-400 text-xs italic">No Team</span>
            ) : m.mentor_teams.length === 1 ? (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (setParentActiveTab) setParentActiveTab('teams');
                  localStorage.setItem('admin_open_team_id', m.mentor_teams[0].id);
                }}
                className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-bold text-xs hover:bg-indigo-100 transition-colors"
              >
                {m.mentor_teams[0].name}
              </button>
            ) : (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(openMenuId === `team-menu-${m.id}` ? null : `team-menu-${m.id}`);
                  }}
                  className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center gap-1 hover:bg-indigo-100 transition-colors"
                >
                  {m.mentor_teams.length} Teams <span className="text-[10px]">▼</span>
                </button>
                {openMenuId === `team-menu-${m.id}` && (
                  <div className="absolute left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-30">
                    {m.mentor_teams.map(team => (
                      <button
                        key={team.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(null);
                          if (setParentActiveTab) setParentActiveTab('teams');
                          localStorage.setItem('admin_open_team_id', team.id);
                        }}
                        className="w-full text-left px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        {team.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          ) : m.team_name ? (
            <button
               onClick={(e) => {
                 e.stopPropagation();
                 if (setParentActiveTab) setParentActiveTab('teams');
                 localStorage.setItem('admin_open_team_id', m.team_id);
               }}
               className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-bold text-xs hover:bg-blue-100 transition-colors"
            >
              {m.team_name}
            </button>
          ) : (
            <span className="text-slate-400 text-xs italic">No Team</span>
          )}
        </td>
        )}
        {activeTab !== 'admins' && (
        <td className="py-3 px-4">
          {m.is_banned ? (
            <span className="text-red-600 font-bold text-xs">🚫 Banned</span>
          ) : (
            <span className="text-emerald-600 font-bold text-xs">✅ Active</span>
          )}
        </td>
        )}
        {activeTab !== 'admins' && (
        <td className="py-3 px-4 text-right relative">
          <button
            onClick={() => setOpenMenuId(isMenuOpen ? null : menuKey)}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 inline-flex items-center justify-center text-slate-500 font-bold text-lg"
          >
            ⋮
          </button>

          {isMenuOpen && (
            <div className="absolute right-4 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-20 text-left">
              <button
                onClick={() => {
                  setOpenMenuId(null);
                  setEditModalData(m);
                }}
                className="w-full text-left px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                ✏️ Edit Member
              </button>
              <button
                onClick={() => {
                  setOpenMenuId(null);
                  handleBanToggleMember(m);
                }}
                className="w-full text-left px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50 flex items-center gap-2"
              >
                {m.is_banned ? '🟢 Unban User' : '🚫 Ban User'}
              </button>
              {m.role !== 'mentor' && m.role !== 'admin' && (
                <button
                  onClick={() => {
                    setOpenMenuId(null);
                    handlePromoteToMentor(m);
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
                >
                  🎓 Promote to Mentor
                </button>
              )}
              {m.role !== 'admin' && (
                <button
                  onClick={() => {
                    setOpenMenuId(null);
                    handlePromoteToAdmin(m);
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-semibold text-purple-600 hover:bg-purple-50 flex items-center gap-2"
                >
                  ⭐ Promote to Admin
                </button>
              )}
              <button
                onClick={() => {
                  setOpenMenuId(null);
                  handleDeleteMember(m.id, m.email);
                }}
                className="w-full text-left px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                🗑️ Delete User
              </button>
            </div>
          )}
        </td>
        )}
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Registered Members ({members.length})
          </h1>
          <p className="text-slate-600 mt-1">
            Browse all user accounts, view profiles, and manage permissions.
          </p>
        </div>
        <div className="flex gap-2">
          {isSelectionMode ? (
            <>
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
                onClick={() => fetchMembers(true)}
                className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold rounded-xl text-sm transition-colors"
              >
                Refresh Members
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          placeholder="Search by name, email, or student ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 font-semibold text-sm"
        />
        <select
          value={sortOption}
          onChange={(e) => setSortOption(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 font-semibold text-sm bg-white"
        >
          <option value="ascending">Sort A-Z</option>
          <option value="descending">Sort Z-A</option>
          <option value="team">Sort by Team</option>
          <option value="status">Sort by Status (Banned)</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      ) : sortedMembers.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
          <p className="text-slate-500 font-semibold">No members found matching your search.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex space-x-2 bg-slate-100/50 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('students')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${
                activeTab === 'students' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              Regular Users ({students.length})
            </button>
            <button
              onClick={() => setActiveTab('mentors')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${
                activeTab === 'mentors' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              Mentors ({mentors.length})
            </button>
            <button
              onClick={() => setActiveTab('admins')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${
                activeTab === 'admins' ? 'bg-red-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              Admin Users ({admins.length})
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase text-[11px] font-bold tracking-wider">
                  {isSelectionMode && (
                    <th className="py-3 px-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === sortedMembers.length && sortedMembers.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(sortedMembers.map(m => m.id));
                          } else {
                            setSelectedIds([]);
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="py-3 px-4">Member Name & Email</th>
                  <th className="py-3 px-4">Student ID</th>
                  <th className="py-3 px-4">Session</th>
                  {activeTab !== 'admins' && <th className="py-3 px-4">Team</th>}
                  {activeTab !== 'admins' && <th className="py-3 px-4">Status</th>}
                  {activeTab !== 'admins' && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {activeTab === 'admins' && admins.length === 0 && (
                  <tr>
                    <td colSpan="100%" className="py-8 text-center text-slate-500">No Admin Users found.</td>
                  </tr>
                )}
                {activeTab === 'admins' && admins.map(renderMemberRow)}

                {activeTab === 'mentors' && mentors.length === 0 && (
                  <tr>
                    <td colSpan="100%" className="py-8 text-center text-slate-500">No Mentors found.</td>
                  </tr>
                )}
                {activeTab === 'mentors' && mentors.map(renderMemberRow)}

                {activeTab === 'students' && students.length === 0 && (
                  <tr>
                    <td colSpan="100%" className="py-8 text-center text-slate-500">No Regular Users found.</td>
                  </tr>
                )}
                {activeTab === 'students' && students.map(renderMemberRow)}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      )}

      {/* Details Modal */}
      <DetailsInfoModal
        isOpen={Boolean(detailsModalData)}
        onClose={() => setDetailsModalData(null)}
        data={detailsModalData}
        type="member"
      />

      {/* Edit Modal */}
      <EditModal
        isOpen={Boolean(editModalData)}
        onClose={() => setEditModalData(null)}
        data={editModalData}
        type="member"
        onSaved={fetchMembers}
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
        onConfirm={executeBanToggleMember}
        entityName={banModalConfig.target?.email || 'Member'}
        isBanning={banModalConfig.isBanning}
      />
    </div>
  );
}
