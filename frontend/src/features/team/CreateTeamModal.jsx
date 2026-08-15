import { API_URL } from '../../config';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

export default function CreateTeamModal({ isOpen, onClose, mode = 'create', onSuccess }) {
  const [teamName, setTeamName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchRef]);

  useEffect(() => {
    if (mode !== 'invite') return;
    if (!searchQuery.trim() || selectedUser) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/v1/users/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setSearchResults(data.data || []);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, mode, selectedUser]);

  if (!isOpen) return null;

  const handleClose = () => {
    setTeamName('');
    setSearchQuery('');
    setSearchResults([]);
    setSelectedUser(null);
    setShowDropdown(false);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      if (mode === 'create') {
        if (!teamName.trim()) {
          toast.error('Please enter a team name');
          setLoading(false);
          return;
        }

        const res = await fetch(API_URL + '/api/v1/teams/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ name: teamName.trim() })
        });
        const data = await res.json();

        if (res.ok && (data.success || res.status === 201)) {
          toast.success('Team created successfully!');
          onSuccess?.();
          handleClose();
        } else {
          toast.error(data.message || 'Failed to create team');
        }
      } else {
        if (!selectedUser) {
          toast.error('Please select a user to invite');
          setLoading(false);
          return;
        }

        const res = await fetch(API_URL + '/api/v1/teams/invite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ emailToInvite: selectedUser.email })
        });
        const data = await res.json();

        if (res.ok && (data.success || res.status === 200)) {
          toast.success(`Invitation sent to ${selectedUser.email}!`);
          onSuccess?.();
          handleClose();
        } else {
          toast.error(data.message || 'Failed to send invitation');
        }
      }
    } catch (error) {
      console.error('Error in modal submit:', error);
      toast.error('A network error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const title = mode === 'invite' ? 'Invite Member' : 'Create a Team';
  const subtitle = mode === 'invite' 
    ? 'Send an in-app invitation to add someone to your team.' 
    : 'Enter a name for your team. You will be the team leader.';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={handleClose}
      ></div>
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-8">
            <>
              <h2 className="text-3xl font-black text-slate-900 mb-2">{title}</h2>
              <p className="text-slate-500 mb-8">{subtitle}</p>
              
              <form onSubmit={handleSubmit} className="space-y-6">
                {mode === 'create' ? (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Team Name</label>
                    <input 
                      type="text" 
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      required
                      disabled={loading}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50" 
                      placeholder="e.g. Code Wizards" 
                    />
                  </div>
                ) : (
                  <div className="relative" ref={searchRef}>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Search Teammate (Name, ID, Email)</label>
                    
                    {selectedUser ? (
                      <div className="flex items-center justify-between p-3 border border-blue-200 bg-blue-50 rounded-xl">
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{selectedUser.name || selectedUser.email}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{selectedUser.email} • ID: {selectedUser.student_id || 'N/A'}</p>
                        </div>
                        <button type="button" onClick={() => { setSelectedUser(null); setSearchQuery(''); setShowDropdown(false); }} className="text-slate-400 hover:text-red-500 p-1">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ) : (
                      <>
                        <input 
                          type="text" 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onFocus={() => { if(searchResults.length > 0) setShowDropdown(true); }}
                          disabled={loading}
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50" 
                          placeholder="Search by name, student ID, or email..." 
                        />
                        {isSearching && (
                          <div className="absolute right-4 top-11">
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        )}
                        {showDropdown && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                            {searchResults.length > 0 ? (
                              searchResults.map(user => (
                                <div 
                                  key={user.user_id} 
                                  onClick={() => { setSelectedUser(user); setShowDropdown(false); }}
                                  className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                                >
                                  <p className="font-bold text-slate-800 text-sm">{user.name || user.email}</p>
                                  <p className="text-xs text-slate-500 mt-0.5">{user.email} • {user.student_id ? `ID: ${user.student_id}` : 'No Student ID'}</p>
                                </div>
                              ))
                            ) : (
                              searchQuery.trim().length > 0 && !isSearching && (
                                <div className="p-4 text-center text-sm text-slate-500">
                                  No users found matching "{searchQuery}"
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/30 transition-all text-lg flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>{mode === 'create' ? 'Creating...' : 'Sending...'}</span>
                    </>
                  ) : (
                    <span>{mode === 'create' ? 'Create Team' : 'Send Invitation'}</span>
                  )}
                </button>
                <button 
                  type="button"
                  disabled={loading}
                  onClick={handleClose}
                  className="w-full text-slate-500 hover:text-slate-700 font-semibold py-2 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </form>
            </>
        </div>
      </div>
    </div>
  );
}
