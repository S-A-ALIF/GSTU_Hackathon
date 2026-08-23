import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotificationDropdown from '../components/NotificationDropdown';
import FeedbackModal from '../components/FeedbackModal';
import TeamPage from './TeamPage';
import ProjectPage from './ProjectPage';
import ProblemsPage from './ProblemsPage';
import RulesPage from './RulesPage';
import ProfilePage from './ProfilePage';
import { toast } from 'sonner';
import SettingsPage from './SettingsPage';
import QnAPage from './QnAPage';
import ChatPage from './ChatPage';
import BanBanner from '../components/BanBanner';
import { getActiveTab, setActiveTab as setStorageTab } from '../utils/tabStorage';

export default function DashboardPage() {
  const { currentUser, userProfile, logout, workspaceOpen, problemsOpen, feedbackOpen, fetchPlatformSettings, unreadCounts } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => {
    return getActiveTab('hackathon_active_tab', 'team');
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    setStorageTab('hackathon_active_tab', activeTab);
  }, [activeTab]);


  // Force redirect to team tab if the current active tab gets closed by admin or user is banned
  useEffect(() => {
    if (userProfile?.isBanned) {
      if (['project', 'problems'].includes(activeTab)) {
        setActiveTab('team');
      }
    } else {
      if (activeTab === 'project' && !workspaceOpen) {
        toast.info('The admin has closed the Project Workspace.', {
          description: 'You have been redirected to your team dashboard.'
        });
        setActiveTab('team');
      }
      if (activeTab === 'problems' && !problemsOpen) {
        toast.info('The admin has closed the Problem Statement.', {
          description: 'You have been redirected to your team dashboard.'
        });
        setActiveTab('team');
      }
    }
  }, [workspaceOpen, problemsOpen, activeTab, userProfile?.isBanned]);

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
    } else if (currentUser.role === 'admin') {
      navigate('/admin', { replace: true });
    } else if (currentUser.role === 'mentor') {
      navigate('/mentor', { replace: true });
    }
  }, [currentUser, navigate]);

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

  if (!currentUser) return null;
  if (currentUser.role === 'admin' || currentUser.role === 'mentor') return null;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = [
    {
      id: 'team',
      label: 'My Team',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
        </svg>
      )
    },
    {
      id: 'chat',
      label: 'Team Chat',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
        </svg>
      )
    },
    {
      id: 'project',
      label: 'Project Workspace',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
        </svg>
      )
    },
    {
      id: 'problems',
      label: 'Problem Statement',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
        </svg>
      )
    },
    {
      id: 'rules',
      label: 'Rules & Regulations',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
        </svg>
      )
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      )
    }
  ];

  return (
    <div className="min-h-[100dvh] bg-slate-50 flex flex-col h-[100dvh] overflow-hidden">
      <nav className="bg-slate-900 text-white py-4 px-6 lg:px-12 flex justify-between items-center shadow-md relative z-50 shrink-0">
        <Link to="/" className="text-2xl font-black tracking-tighter hover:opacity-80 transition-opacity">
          GSTU<span className="text-blue-500">Hackathon</span>
        </Link>
        
        <div className="flex items-center space-x-4">
          <NotificationDropdown />
          
          <div className="relative flex items-center space-x-4" ref={menuRef}>
            <button 
              onClick={() => setActiveTab('profile')}
              className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 border-2 border-slate-700 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Profile"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-300">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </button>

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
                  <p className="text-xs text-slate-400 font-semibold">Signed in as</p>
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

                <button 
                  onClick={() => { setActiveTab('qna'); setIsMenuOpen(false); }}
                  className="w-full text-left px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 font-medium"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-500">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
                  </svg>
                  QnA's
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
                  className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 font-medium"
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

      <div className="flex-grow flex flex-col xs:flex-row h-[calc(100vh-73px)] overflow-hidden">
        <aside 
          className={`bg-slate-900 text-white border-b xs:border-b-0 xs:border-r border-slate-800 p-2 xs:p-4 flex flex-col justify-between shrink-0 relative transition-all duration-300 xs:h-full w-full ${
            isSidebarOpen ? 'xs:w-64' : 'xs:w-20'
          }`}
        >
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="hidden xs:flex absolute -right-3.5 top-6 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 w-7 h-7 rounded-full items-center justify-center shadow-lg transition-transform focus:outline-none z-50"
            title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              strokeWidth={2} 
              stroke="currentColor" 
              className={`w-3.5 h-3.5 transition-transform duration-300 ${!isSidebarOpen ? 'rotate-180' : ''}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>

          <div className="space-y-4 xs:space-y-6 overflow-hidden">
            <div className="hidden xs:flex px-2 h-6 items-center">
              {isSidebarOpen ? (
                <span className="text-xs uppercase tracking-widest text-slate-400 font-bold block truncate">
                  Hacker Workspace
                </span>
              ) : (
                <span className="text-xs font-black text-blue-500 mx-auto">HW</span>
              )}
            </div>

            <div className={`xs:block transition-all duration-300 overflow-hidden ${isMobileExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 xs:max-h-none xs:opacity-100'}`}>
              <nav className="grid grid-cols-2 gap-1 xs:flex xs:flex-col xs:space-y-2 pb-2 xs:pb-0 hide-scrollbar w-full">
                {navItems.map((item) => {
                  const isActive = activeTab === item.id;
                  
                  const isBannedLock = userProfile?.isBanned && ['project', 'problems'].includes(item.id);
                  const isDisabled = isBannedLock ||
                                     (item.id === 'project' && !workspaceOpen) || 
                                     (item.id === 'problems' && !problemsOpen);

                  return (
                    <button
                      key={item.id}
                      onClick={() => !isDisabled && setActiveTab(item.id)}
                      disabled={isDisabled}
                      title={!isSidebarOpen ? item.label : undefined}
                      className={`shrink-0 flex flex-col xs:flex-row items-center justify-center xs:justify-start gap-1 xs:gap-3 px-3 py-2 xs:px-4 xs:py-3 rounded-xl font-semibold text-xs xs:text-sm transition-all relative ${
                        isDisabled 
                          ? 'text-slate-600 cursor-not-allowed opacity-50 bg-transparent'
                          : isActive
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                      } ${!isSidebarOpen ? 'xs:justify-center xs:px-2' : ''}`}
                    >
                      <span className="shrink-0">{item.icon}</span>
                      <span className={`truncate text-[10px] sm:text-xs xs:text-sm ${!isSidebarOpen ? 'xs:hidden' : ''}`}>{item.label}</span>
                      
                      {/* Unread Message Badge */}
                      {item.id === 'chat' && unreadCounts?.total > 0 && isSidebarOpen && (
                        <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-in zoom-in">
                          {unreadCounts.total > 99 ? '99+' : unreadCounts.total}
                        </span>
                      )}
                      {!isSidebarOpen && item.id === 'chat' && unreadCounts?.total > 0 && (
                        <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border border-slate-900 shadow-sm animate-pulse"></span>
                      )}

                      {/* Lock Icon */}
                      {isDisabled && (
                        <span className={`absolute ${!isSidebarOpen ? 'top-1 right-1' : 'right-4'}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-slate-500">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                          </svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
          
          {isSidebarOpen && (
            <div className="hidden xs:block pt-6 border-t border-slate-800 mt-6 px-2">
              <p className="text-xs text-slate-400 truncate">GSTU CSE Hackathon</p>
              <p className="text-xs font-bold text-slate-300 mt-0.5 truncate">2026 Edition</p>
            </div>
          )}

          {/* Mobile Sidebar Toggle Button */}
          <div className="xs:hidden absolute -bottom-3 left-1/2 -translate-x-1/2 z-20">
            <button
              onClick={() => setIsMobileExpanded(!isMobileExpanded)}
              className="w-12 h-6 bg-slate-900 border-b border-l border-r border-slate-700 rounded-b-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 shadow-md transition-colors"
              title={isMobileExpanded ? 'Retract Menu' : 'Expand Menu'}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className={`w-4 h-4 transition-transform duration-300 ${isMobileExpanded ? 'rotate-180' : ''}`}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          </div>
        </aside>

        <main className="flex-grow overflow-y-auto w-full h-full flex flex-col bg-slate-50">
          <BanBanner />
          <div className={`flex-grow relative ${activeTab === 'chat' ? 'flex flex-col min-h-0 p-2 sm:p-4 lg:p-8' : 'p-4 sm:p-6 lg:p-12'}`}>
            {activeTab === 'team' && <TeamPage inDashboard={true} readOnly={userProfile?.isBanned} />}
            {activeTab === 'chat' && (
              <div className="flex-1 w-full min-h-0">
                <ChatPage inDashboard={true} onBack={() => setActiveTab('team')} />
              </div>
            )}
          
            {activeTab === 'project' && (
              workspaceOpen ? <ProjectPage inDashboard={true} /> : 
              <div className="flex flex-col items-center justify-center h-full text-slate-500 animate-in fade-in">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">🔒</div>
                <h2 className="text-xl font-bold text-slate-800">Workspace is Closed</h2>
                <p className="mt-2 text-center max-w-sm">The project workspace is currently locked by the administrators.</p>
              </div>
            )}
            
            {activeTab === 'problems' && (
              problemsOpen ? <ProblemsPage inDashboard={true} /> :
              <div className="flex flex-col items-center justify-center h-full text-slate-500 animate-in fade-in">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">🔒</div>
                <h2 className="text-xl font-bold text-slate-800">Problem Statement is Hidden</h2>
                <p className="mt-2 text-center max-w-sm">The problem statement will be revealed once the hackathon officially starts.</p>
              </div>
            )}
            {activeTab === 'rules' && <RulesPage inDashboard={true} />}
            {activeTab === 'profile' && <ProfilePage inDashboard={true} readOnly={userProfile?.isBanned} />}
            {activeTab === 'settings' && <SettingsPage inDashboard={true} readOnly={userProfile?.isBanned} />}
            {activeTab === 'qna' && <QnAPage inDashboard={true} />}
          </div>
        </main>
      </div>

      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
    </div>
  );
}
