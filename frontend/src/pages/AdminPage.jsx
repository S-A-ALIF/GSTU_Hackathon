import { useState, useEffect, useRef } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getActiveTab, setActiveTab as setStorageTab } from '../utils/tabStorage';
import AdminSidebar from '../features/admin/AdminSidebar';
import AdminDashboardTab from '../features/admin/AdminDashboardTab';
import AdminTeamsTab from '../features/admin/AdminTeamsTab';
import AdminMembersTab from '../features/admin/AdminMembersTab';
import AdminControlTab from '../features/admin/AdminControlTab';
import AdminSettingsTab from '../features/admin/AdminSettingsTab';
import AdminProblemsTab from '../features/admin/AdminProblemsTab';
import AdminRulesTab from '../features/admin/AdminRulesTab';
import AdminSubmissionsTab from '../features/admin/AdminSubmissionsTab';
import AdminMessagesTab from '../features/admin/AdminMessagesTab';
import AdminFeedbackTab from '../features/admin/AdminFeedbackTab';
import NotificationDropdown from '../components/NotificationDropdown';
import ProfilePage from './ProfilePage';
import CommitteeChatPage from './CommitteeChatPage';

export default function AdminPage() {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => {
    return getActiveTab('hackathon_admin_tab', 'dashboard');
  });

  useEffect(() => {
    setStorageTab('hackathon_admin_tab', activeTab);
  }, [activeTab]);

  const [visitedTabs, setVisitedTabs] = useState({ dashboard: true });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    setVisitedTabs(prev => ({ ...prev, [activeTab]: true }));
  }, [activeTab]);

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
  }, []);

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl font-bold">
            !
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-600 mb-6">
            You do not have permission to view the Admin Dashboard.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              to="/dashboard"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-colors"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col h-[100dvh] overflow-hidden">
      {/* Topbar: Only Notification and Profile */}
      <nav className="bg-slate-900 text-white py-3 sm:py-4 px-3 sm:px-6 lg:px-12 flex justify-between items-center shadow-md relative z-50 shrink-0">
        <Link to="/" className="text-xl sm:text-2xl font-black tracking-tighter hover:opacity-80 transition-opacity truncate mr-2">
          Hackathon<span className="text-blue-500">Admin</span>
        </Link>
        
        <div className="flex items-center space-x-2 sm:space-x-4 shrink-0">
          {/* Notification Bell */}
          <NotificationDropdown />

          <div className="relative flex items-center space-x-2 sm:space-x-4" ref={menuRef}>
            {/* Profile Icon */}
            <button 
              onClick={() => setActiveTab('profile')}
              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-800 hover:bg-slate-700 border-2 transition-colors flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                activeTab === 'profile' ? 'border-blue-500 bg-slate-700' : 'border-slate-700'
              }`}
              title="Profile"
            >
              {userProfile?.avatar_url ? (
                <img 
                  src={userProfile.avatar_url} 
                  alt="Profile" 
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-300">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              )}
            </button>

            {/* Hamburger Menu */}
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-1 sm:p-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-56 bg-white text-slate-900 rounded-xl shadow-xl py-2 border border-slate-200 animate-in fade-in slide-in-from-top-2 z-50">
                <div className="px-4 py-2 border-b border-slate-100 mb-1">
                  <p className="text-xs text-slate-400 font-semibold">Signed in as Admin</p>
                  <p className="text-sm font-bold text-slate-800 truncate">{currentUser.email}</p>
                </div>
                <button 
                  onClick={() => { setActiveTab('settings'); setIsMenuOpen(false); }}
                  className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 font-medium"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                  Settings
                </button>

                <div className="border-t border-slate-100 my-1"></div>

                <button 
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                  className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 font-medium"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                  </svg>
                  Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Body: Sidebar + Content */}
      <div className="flex-grow flex flex-col xs:flex-row h-[calc(100vh-73px)] overflow-hidden">
        <AdminSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        <main className={`flex-1 overflow-x-auto h-full ${activeTab === 'committee_chat' ? 'p-2 sm:p-4 lg:p-8 min-h-0 overflow-hidden flex flex-col' : 'p-6 sm:p-10 overflow-y-auto'}`}>
          <div className={`mx-auto ${activeTab === 'committee_chat' ? 'h-full w-full' : 'max-w-7xl'}`}>
            {visitedTabs.dashboard && (
              <div className={activeTab === 'dashboard' ? 'block' : 'hidden'}>
                <AdminDashboardTab setActiveTab={setActiveTab} />
              </div>
            )}
            {visitedTabs.teams && (
              <div className={activeTab === 'teams' ? 'block' : 'hidden'}>
                <AdminTeamsTab activeTab={activeTab} />
              </div>
            )}
            {visitedTabs.members && (
              <div className={activeTab === 'members' ? 'block' : 'hidden'}>
                <AdminMembersTab setParentActiveTab={setActiveTab} />
              </div>
            )}
            {visitedTabs.control && (
              <div className={activeTab === 'control' ? 'block' : 'hidden'}>
                <AdminControlTab />
              </div>
            )}
            {visitedTabs.problemsets && (
              <div className={activeTab === 'problemsets' ? 'block' : 'hidden'}>
                <AdminProblemsTab />
              </div>
            )}
            {visitedTabs.rules && (
              <div className={activeTab === 'rules' ? 'block' : 'hidden'}>
                <AdminRulesTab />
              </div>
            )}
            {visitedTabs.submissions && (
              <div className={activeTab === 'submissions' ? 'block' : 'hidden'}>
                <AdminSubmissionsTab />
              </div>
            )}
            {visitedTabs.messages && (
              <div className={activeTab === 'messages' ? 'block' : 'hidden'}>
                <AdminMessagesTab />
              </div>
            )}
            {visitedTabs.feedback && (
              <div className={activeTab === 'feedback' ? 'block' : 'hidden'}>
                <AdminFeedbackTab />
              </div>
            )}
            {visitedTabs.committee_chat && (
              <div className={activeTab === 'committee_chat' ? 'block h-full' : 'hidden'}>
                <CommitteeChatPage inDashboard={true} onBack={() => setActiveTab('dashboard')} />
              </div>
            )}
            {visitedTabs.settings && (
              <div className={activeTab === 'settings' ? 'block' : 'hidden'}>
                <AdminSettingsTab />
              </div>
            )}
            {visitedTabs.profile && (
              <div className={activeTab === 'profile' ? 'block' : 'hidden'}>
                <ProfilePage inDashboard={true} />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
