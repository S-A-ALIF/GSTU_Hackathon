import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_URL } from '../config';
import { useAuth, socket } from '../contexts/AuthContext';
import { toast } from 'sonner';
import NotificationDropdown from '../components/NotificationDropdown';
import FeedbackModal from '../components/FeedbackModal';
import ProfilePage from './ProfilePage';
import SettingsPage from './SettingsPage';
import MemberInfoModal from '../features/team/MemberInfoModal';
import ProblemsPage from './ProblemsPage';
import Rules from '../features/landing/Rules';

export default function MentorDashboardPage() {
  const { currentUser, logout, feedbackOpen, problemsOpen } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('hackathon_mentor_tab') || 'dashboard';
  });

  useEffect(() => {
    localStorage.setItem('hackathon_mentor_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'problems' && !problemsOpen) {
      toast.info('The admin has closed the Problem Statement.', {
        id: 'problem-closed-toast',
      });
      setActiveTab('dashboard');
    }
  }, [problemsOpen, activeTab]);

  const [invitations, setInvitations] = useState([]);
  const [teamScores, setTeamScores] = useState({});
  const [imageErrors, setImageErrors] = useState({});
  const [teams, setTeams] = useState([]);
  const [maxTeams, setMaxTeams] = useState(3);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const menuRef = useRef(null);

  // Rejection modal state
  const [rejectModalState, setRejectModalState] = useState({
    isOpen: false,
    invitationId: null,
    teamName: '',
    message: ''
  });

  // Resign modal state
  const [resignModalState, setResignModalState] = useState({
    isOpen: false,
    teamId: null,
    teamName: ''
  });

  // Member modal state
  const [selectedMember, setSelectedMember] = useState(null);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);

  useEffect(() => {
    fetchData();

    socket.on('statsUpdated', fetchData);

    return () => {
      socket.off('statsUpdated', fetchData);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const [invRes, teamsRes, settingsRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/mentors/invitations`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/v1/mentors/teams`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/v1/settings`)
      ]);
      const invData = await invRes.json();
      const teamsData = await teamsRes.json();
      const settingsData = await settingsRes.json();

      if (invData.success) setInvitations(invData.data);
      if (teamsData.success) setTeams(teamsData.data);
      if (settingsData.success && settingsData.data.max_teams_per_mentor) {
        const parsedMax = parseInt(settingsData.data.max_teams_per_mentor, 10);
        if (!isNaN(parsedMax)) setMaxTeams(parsedMax);
      }
    } catch (error) {
      console.error('Error fetching mentor data:', error);
      toast.error('Network error loading mentor dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuRef]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleRespond = async (id, accept, message = '') => {
    setProcessingId(id);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/mentors/invitations/${id}/respond`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ accept, message })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || (accept ? 'Invitation accepted' : 'Invitation rejected'));
        fetchData(); // Refresh to update teams list and remove invite
        if (!accept) {
          setRejectModalState({ isOpen: false, invitationId: null, teamName: '', message: '' });
        }
      } else {
        toast.error(data.message || 'Failed to respond to invitation');
      }
    } catch (error) {
      console.error('Error responding:', error);
      toast.error('Network error');
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectModal = (invId, teamName) => {
    setRejectModalState({
      isOpen: true,
      invitationId: invId,
      teamName: teamName,
      message: ''
    });
  };

  const handleLeaveTeam = (teamId, teamName) => {
    setResignModalState({ isOpen: true, teamId, teamName });
  };

  const handleConfirmResign = async () => {
    setProcessingId(resignModalState.teamId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/mentors/teams/${resignModalState.teamId}/resign`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Successfully resigned from the team');
        fetchData();
        setResignModalState({ isOpen: false, teamId: null, teamName: '' });
      } else {
        toast.error(data.message || 'Failed to resign from team');
      }
    } catch (error) {
      console.error('Error resigning:', error);
      toast.error('Network error while resigning');
    } finally {
      setProcessingId(null);
    }
  };

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
        </svg>
      )
    },
    {
      id: 'problems',
      label: 'Problem Statement',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      )
    },
    {
      id: 'rules',
      label: 'Rules & Regulations',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-5l-5 5v-5z" />
        </svg>
      )
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col h-screen overflow-hidden">
      {/* Feedback Modal */}
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
      
      {/* Top Navbar with Logo on Left, Notif/Profile/Hamburger on Right */}
      <nav className="bg-slate-900 text-white py-4 px-6 lg:px-12 flex justify-between items-center shadow-md relative z-50 shrink-0">
        <Link to="/" className="text-2xl font-black tracking-tighter hover:opacity-80 transition-opacity">
          GSTU<span className="text-blue-500">Hackathon</span>
        </Link>
        
        <div className="flex items-center space-x-4">
          <NotificationDropdown />
          
          <div className="relative flex items-center space-x-4" ref={menuRef}>
            <button 
              onClick={() => setActiveTab('profile')}
              className={`w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 border-2 transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                activeTab === 'profile' ? 'border-blue-500 bg-slate-700' : 'border-slate-700'
              }`}
              title="Profile"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-300">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </button>

            {/* Hamburger Menu */}
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            {isMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-56 bg-white text-slate-900 rounded-xl shadow-xl py-2 border border-slate-200 animate-in fade-in slide-in-from-top-2 z-50">
                <div className="px-4 py-2 border-b border-slate-100 mb-1">
                  <p className="text-xs text-slate-400 font-semibold">Signed in as Mentor</p>
                  <p className="text-sm font-bold text-slate-800 truncate">{currentUser?.email}</p>
                </div>
                
                <button 
                  onClick={() => { setActiveTab('settings'); setIsMenuOpen(false); }}
                  className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 font-medium mt-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                  Settings
                </button>

                {feedbackOpen && (
                  <button 
                    onClick={() => { setIsFeedbackOpen(true); setIsMenuOpen(false); }}
                    className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 font-medium"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-500">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-5l-5 5v-5z" />
                    </svg>
                    Feedback
                  </button>
                )}
                
                <div className="h-px bg-slate-100 my-2"></div>

                <button 
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 font-medium mt-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-red-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15" />
                  </svg>
                  Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Body: Left Sidebar + Right Active Tab Content */}
      <div className="flex-grow flex flex-col md:flex-row h-[calc(100vh-73px)] overflow-hidden">
        {/* Left Fixed Sidebar */}
        <aside 
          className={`bg-slate-900 text-white border-b md:border-b-0 md:border-r border-slate-800 p-2 md:p-4 flex flex-col justify-between shrink-0 relative transition-all duration-300 md:h-full w-full ${
            isSidebarOpen ? 'md:w-64' : 'md:w-20'
          }`}
        >
          {/* Toggle Button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="hidden md:flex absolute -right-3.5 top-6 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 w-7 h-7 rounded-full items-center justify-center shadow-lg transition-transform focus:outline-none z-50"
            title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-3.5 h-3.5 transition-transform duration-300 ${!isSidebarOpen ? 'rotate-180' : ''}`}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>

          <div className="space-y-4 md:space-y-6 overflow-hidden">
            <div className="hidden md:flex px-2 h-6 items-center">
              {isSidebarOpen ? (
                <span className="text-xs uppercase tracking-widest text-slate-400 font-bold block truncate">
                  Mentor Workspace
                </span>
              ) : (
                <span className="text-xs font-black text-blue-500 mx-auto">MW</span>
              )}
            </div>

            <nav className="grid grid-cols-2 gap-1 md:flex md:flex-col md:space-y-2">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    title={!isSidebarOpen ? item.label : undefined}
                    className={`flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-3 px-2 py-2 md:px-4 md:py-3 rounded-xl font-semibold text-xs md:text-sm transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    } ${!isSidebarOpen ? 'md:justify-center md:px-2' : ''} ${(item.id === 'problems' && !problemsOpen) ? 'opacity-50 line-through pointer-events-none' : ''}`}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    <span className={`truncate text-[10px] sm:text-xs md:text-sm ${!isSidebarOpen ? 'md:hidden' : ''}`}>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
          
          {isSidebarOpen && (
            <div className="hidden md:block pt-6 border-t border-slate-800 mt-6 px-2">
              <p className="text-xs text-slate-400 truncate">GSTU CSE Hackathon</p>
              <p className="text-xs font-bold text-slate-300 mt-0.5 truncate">2026 Edition</p>
            </div>
          )}
        </aside>

        {/* Right Content Area */}
        <main className="flex-grow p-4 sm:p-6 lg:p-12 overflow-y-auto w-full h-full">
          {activeTab === 'problems' && (
            problemsOpen ? <ProblemsPage inDashboard={true} /> : 
            <div className="flex flex-col items-center justify-center h-full text-slate-500 mt-20">
              <h2 className="text-xl font-bold text-slate-800">Problem Statement is Hidden</h2>
              <p className="mt-2 text-center max-w-sm">The problem statement will be revealed once the hackathon officially starts.</p>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="max-w-7xl mx-auto space-y-12">
        {/* Mentored Teams Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900">My Mentored Teams</h2>
            <span className={`font-bold px-3 py-1 rounded-full text-sm ${teams.length >= maxTeams ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {teams.length} / {maxTeams} Teams
            </span>
          </div>

          {teams.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center shadow-sm">
              <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900">No active teams</h3>
              <p className="text-slate-500">You are not mentoring any teams currently. Accept invitations to start mentoring.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {teams.map(team => (
                <div key={team.id} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900">{team.name}</h3>
                      <p className="text-sm text-slate-500 mt-1">Created on {new Date(team.created_at).toLocaleDateString()}</p>
                    </div>
                    <button onClick={() => handleLeaveTeam(team.id, team.name)} className="mt-4 sm:mt-0 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded-xl text-sm transition-colors border border-red-100">
                      Resign Mentorship
                    </button>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Team Members ({team.members?.length || 0})</h4>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {team.members?.map(member => (
                        <div 
                          key={member.id} 
                          onClick={() => {
                            setSelectedMember(member);
                            setIsMemberModalOpen(true);
                          }}
                          className="flex items-center space-x-3 p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                        >
                          {member.avatar_url && !imageErrors[member.id] ? (
                            <img 
                              src={member.avatar_url} 
                              alt="Member Avatar" 
                              className="w-10 h-10 rounded-full object-cover shrink-0" 
                              onError={() => setImageErrors(prev => ({...prev, [member.id]: true}))}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-900 truncate">
                              {member.name}
                            </p>
                            <div className="flex items-center justify-between mt-0.5">
                              <p className="text-xs text-slate-500 truncate pr-2">ID: {member.student_id !== 'N/A' ? member.student_id : member.email}</p>
                              {member.id === team.leader_id && (
                                <span className="text-[9px] font-black text-amber-600 bg-amber-100/80 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                                  Leader
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
            </div>
          )}
          {activeTab === 'rules' && <Rules inDashboard={true} />}
          {activeTab === 'profile' && <ProfilePage inDashboard={true} />}
          {activeTab === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* Reject Modal */}
      {rejectModalState.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Decline Invitation</h3>
              <button 
                onClick={() => setRejectModalState({ isOpen: false, invitationId: null, teamName: '', message: '' })}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4">
                You are declining the mentorship invitation from <span className="font-bold text-slate-900">{rejectModalState.teamName}</span>.
              </p>
              <div className="mb-4">
                <label className="block text-sm font-bold text-slate-700 mb-2">Message to team (Optional)</label>
                <textarea
                  value={rejectModalState.message}
                  onChange={(e) => setRejectModalState(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-24"
                  placeholder="Explain why you are declining this invitation..."
                ></textarea>
              </div>
              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={() => setRejectModalState({ isOpen: false, invitationId: null, teamName: '', message: '' })}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-bold rounded-xl transition-colors"
                  disabled={processingId === rejectModalState.invitationId}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRespond(rejectModalState.invitationId, false, rejectModalState.message)}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                  disabled={processingId === rejectModalState.invitationId}
                >
                  {processingId === rejectModalState.invitationId && (
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  Confirm Decline
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resign Modal */}
      {resignModalState.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-red-100 bg-red-50 flex items-center justify-between">
              <h3 className="text-lg font-bold text-red-900">Resign Mentorship</h3>
              <button 
                onClick={() => setResignModalState({ isOpen: false, teamId: null, teamName: '' })}
                className="text-red-400 hover:text-red-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4">
                Are you sure you want to resign as the mentor for <span className="font-bold text-slate-900">{resignModalState.teamName}</span>?
              </p>
              <p className="text-sm text-slate-500 mb-6 italic">
                This action cannot be undone. The team will be notified, and they will need to invite a new mentor.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setResignModalState({ isOpen: false, teamId: null, teamName: '' })}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-bold rounded-xl transition-colors"
                  disabled={processingId === resignModalState.teamId}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmResign}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                  disabled={processingId === resignModalState.teamId}
                >
                  {processingId === resignModalState.teamId && (
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  Confirm Resignation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Member Info Modal */}
      <MemberInfoModal
        isOpen={isMemberModalOpen}
        onClose={() => {
          setIsMemberModalOpen(false);
          setSelectedMember(null);
        }}
        member={selectedMember}
      />
    </div>
  );
}
