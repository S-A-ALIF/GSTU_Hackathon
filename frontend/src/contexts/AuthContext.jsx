import { API_URL } from '../config';
import { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { adminCache } from '../features/admin/adminCache';
import { userCache } from '../utils/userCache';
import { clearAllTabs } from '../utils/tabStorage';
import { io } from 'socket.io-client';

export const socket = io(API_URL, {
  withCredentials: true
});

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({ total: 0, teams: {}, committee: 0 });
  const [loading, setLoading] = useState(true);
  const [rawRegistrationOpen, setRawRegistrationOpen] = useState(false);
  const [regOverride, setRegOverride] = useState(false);
  const [rawWorkspaceOpen, setRawWorkspaceOpen] = useState(false);
  const [hackOverride, setHackOverride] = useState(false);
  const [rawProblemsOpen, setRawProblemsOpen] = useState(false);
  const [probOverride, setProbOverride] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [problemsOpen, setProblemsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(true);
  const [regStartTime, setRegStartTime] = useState('');
  const [regEndTime, setRegEndTime] = useState('');
  const [hackStartTime, setHackStartTime] = useState('');
  const [hackEndTime, setHackEndTime] = useState('');
  const [isSubmissionOpen, setIsSubmissionOpen] = useState(false);

  const fetchPlatformSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/settings?t=${Date.now()}`);
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        const isRegOpen = data.data.registration_open !== 'false' && data.data.registration_open !== false;
        const isWorkOpen = data.data.workspace_open === 'true' || data.data.workspace_open === true;
        const isProbOpen = data.data.problems_open === 'true' || data.data.problems_open === true;
        const isFeedOpen = data.data.feedback_open !== 'false' && data.data.feedback_open !== false; // Default to true

        setRawRegistrationOpen(isRegOpen);
        setRegOverride(data.data.reg_override === 'true');
        setRawWorkspaceOpen(isWorkOpen);
        setHackOverride(data.data.hack_override === 'true');
        setRawProblemsOpen(isProbOpen);
        setProbOverride(data.data.prob_override === 'true');
        setFeedbackOpen(isFeedOpen);
        setRegStartTime(data.data.reg_start_time || '');
        setRegEndTime(data.data.reg_end_time || '');
        setHackStartTime(data.data.hack_start_time || '');
        setHackEndTime(data.data.hack_end_time || '');
      }
    } catch (err) {
      console.error('Error fetching platform settings:', err);
    }
  };

  // Re-evaluate registration open and submission open every second in real-time
  useEffect(() => {
    const tick = () => {
      const now = new Date();

      // Registration open/close
      let isRegOpen = rawRegistrationOpen;
      if (regOverride) {
        isRegOpen = rawRegistrationOpen;
      } else if (regStartTime && regEndTime) {
        isRegOpen = now >= new Date(regStartTime) && now <= new Date(regEndTime);
      } else if (regStartTime) {
        isRegOpen = now >= new Date(regStartTime);
      } else if (regEndTime) {
        isRegOpen = now <= new Date(regEndTime);
      }
      setRegistrationOpen(isRegOpen);

      // Hackathon submission and workspace open/close
      let isSubOpen = true;
      let isWorkOpen = rawWorkspaceOpen;
      let isProbOpen = rawProblemsOpen;
      
      if (hackOverride) {
        // If manually overridden, strictly use manual toggles
        isWorkOpen = rawWorkspaceOpen;
        isSubOpen = rawWorkspaceOpen; // Submission follows workspace if manually toggled
      } else if (hackStartTime && hackEndTime) {
        const inWindow = now >= new Date(hackStartTime) && now <= new Date(hackEndTime);
        isSubOpen = inWindow;
        
        if (hackStartTime) {
          // Workspace unlocks at start and LOCKS when hackathon ends
          isWorkOpen = inWindow; 
        }
      } else if (hackStartTime) {
        isSubOpen = now >= new Date(hackStartTime);
        isWorkOpen = now >= new Date(hackStartTime);
      } else if (hackEndTime) {
        isSubOpen = now <= new Date(hackEndTime);
        isWorkOpen = now <= new Date(hackEndTime);
      }

      if (probOverride) {
        isProbOpen = rawProblemsOpen;
      } else if (hackStartTime) {
        // Problem set unlocks at start and stays unlocked forever
        isProbOpen = now >= new Date(hackStartTime);
      }
      
      setIsSubmissionOpen(isSubOpen);
      setWorkspaceOpen(isWorkOpen);
      setProblemsOpen(isProbOpen);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [rawRegistrationOpen, regOverride, rawWorkspaceOpen, hackOverride, rawProblemsOpen, probOverride, regStartTime, regEndTime, hackStartTime, hackEndTime]);

  useEffect(() => {
    fetchPlatformSettings();

    // Listen for realtime settings updates
    socket.on('settingsUpdated', fetchPlatformSettings);
    
    return () => {
      socket.off('settingsUpdated', fetchPlatformSettings);
    };
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;

    const handleBanUpdated = (data) => {
      console.log('Received usersBanUpdated:', data, 'Current user ID:', currentUser.id);
      if (data.userIds && data.userIds.includes(currentUser.id)) {
        setUserProfile(prev => prev ? {
          ...prev,
          isBanned: data.isBanned,
          banReason: data.banReason
        } : null);
        
        if (data.isBanned) {
           toast.error(data.banReason || "Your account has been banned.");
        } else {
           toast.success("Your account has been unbanned. Welcome back!");
        }
      }
    };

    const handleAvatarUpdated = (data) => {
      if (data.userId === currentUser.id) {
        setUserProfile(prev => prev ? {
          ...prev,
          avatar_url: data.avatarUrl
        } : null);
      }
      
      const cached = userCache.get(data.userId);
      if (cached) {
        userCache.set(data.userId, { ...cached, avatar_url: data.avatarUrl });
      }
      
      window.dispatchEvent(new CustomEvent('user_avatar_updated_global', { detail: data }));
    };

    socket.on('usersBanUpdated', handleBanUpdated);
    socket.on('user_avatar_updated', handleAvatarUpdated);
    
    return () => {
      socket.off('usersBanUpdated', handleBanUpdated);
      socket.off('user_avatar_updated', handleAvatarUpdated);
    };
  }, [currentUser?.id]);

  // Unread chat messages management
  const fetchUnreadCounts = async () => {
    if (!currentUser?.id) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(API_URL + '/api/v1/chat/unread', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUnreadCounts(data.data);
      }
    } catch (err) {
      console.error('Error fetching unread counts:', err);
    }
  };

  const markTeamAsRead = async (teamId) => {
    if (!currentUser?.id || !teamId) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/chat/read/${teamId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        setUnreadCounts(prev => {
          const newTeams = { ...prev.teams };
          const teamUnread = newTeams[teamId] || 0;
          delete newTeams[teamId];
          return {
            total: Math.max(0, prev.total - teamUnread),
            teams: newTeams
          };
        });
      }
    } catch (err) {
      console.error('Error marking team as read:', err);
    }
  };

  useEffect(() => {
    if (currentUser?.id) {
      // Authenticate socket for targeted notifications
      socket.emit('authenticate', currentUser.id);
      
      // Fetch initial unread counts
      fetchUnreadCounts();

      // If user is admin or mentor, fetch committee unread counts and join room
      if (currentUser.role === 'admin' || currentUser.role === 'mentor') {
        socket.emit('joinCommitteeChat');
        
        const fetchCommitteeUnread = async () => {
          try {
            const token = localStorage.getItem('token');
            const res = await fetch(API_URL + '/api/v1/chat/committee/unread', {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok && data.success) {
              setUnreadCounts(prev => ({ ...prev, committee: data.data.unread }));
            }
          } catch (err) {
            console.error('Error fetching committee unread:', err);
          }
        };
        fetchCommitteeUnread();
      }

      // Handle socket reconnection
      const handleConnect = () => {
        socket.emit('authenticate', currentUser.id);
        if (currentUser.role === 'admin' || currentUser.role === 'mentor') {
          socket.emit('joinCommitteeChat');
        }
      };
      
      socket.on('connect', handleConnect);

      // Listen for unread message updates globally
      const handleUnreadUpdate = ({ team_id }) => {
        setUnreadCounts(prev => {
          const currentCount = prev.teams[team_id] || 0;
          return {
            ...prev,
            total: prev.total + 1,
            teams: {
              ...prev.teams,
              [team_id]: currentCount + 1
            }
          };
        });
      };

      const handleCommitteeUnreadUpdate = () => {
        setUnreadCounts(prev => ({
          ...prev,
          committee: (prev.committee || 0) + 1
        }));
      };

      const handleRoleUpdated = (data) => {
        setCurrentUser(prev => prev ? { ...prev, role: data.role } : null);
        if (data.role === 'admin' || data.role === 'mentor') {
          socket.emit('joinCommitteeChat');
        } else {
          socket.emit('leaveCommitteeChat');
          setUnreadCounts(prev => ({ ...prev, committee: 0 }));
        }
      };

      socket.on('unreadMessageUpdate', handleUnreadUpdate);
      socket.on('unreadCommitteeMessageUpdate', handleCommitteeUnreadUpdate);
      socket.on('roleUpdated', handleRoleUpdated);

      return () => {
        socket.off('connect', handleConnect);
        socket.off('unreadMessageUpdate', handleUnreadUpdate);
        socket.off('unreadCommitteeMessageUpdate', handleCommitteeUnreadUpdate);
        socket.off('roleUpdated', handleRoleUpdated);
      };
    }
  }, [currentUser?.id]);

  useEffect(() => {
    // Check for existing token and verify with server on load
    const verifyUser = async () => {
      try {
        const storedUser = localStorage.getItem('currentUser');
        const token = localStorage.getItem('token');
        if (storedUser && token) {
          // Immediately set stored user for optimistic render
          setCurrentUser(JSON.parse(storedUser));
          
          // Verify token validity with server and get user profile
          const res = await fetch(API_URL + '/api/v1/auth/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          const data = await res.json();
          if (res.ok && data.data) {
            const freshUser = {
              id: data.data.id,
              email: data.data.email,
              role: data.data.role
            };
            setCurrentUser(freshUser);
            setUserProfile({
              name: data.data.name || '',
              student_id: data.data.student_id || '',
              batch_session: data.data.batch_session || '',
              phone_number: data.data.phone_number || '',
              avatar_url: data.data.avatar_url || '',
              isBanned: data.data.is_banned || false,
              banReason: data.data.ban_reason || ''
            });
            localStorage.setItem('currentUser', JSON.stringify(freshUser));
          } else if (res.status === 401) {
            // Token invalid or expired
            localStorage.removeItem('currentUser');
            localStorage.removeItem('token');
            setCurrentUser(null);
            setUserProfile(null);
          }
        }
      } catch (err) {
        console.error('Error verifying user:', err);
      } finally {
        setLoading(false);
      }
    };

    verifyUser();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await fetch(API_URL + '/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, message: data.message || 'Invalid email or password' };
      }

      // Save token and user
      clearAllTabs();
      localStorage.setItem('token', data.token);
      localStorage.setItem('currentUser', JSON.stringify(data.data));
      setCurrentUser(data.data);
      if (data.data.profile) {
        setUserProfile({
          ...data.data.profile,
          isBanned: data.data.is_banned || false,
          banReason: data.data.ban_reason || ''
        });
      }
      return { success: true, user: data.data };
    } catch (err) {
      console.error("Login error:", err);
      return { success: false, message: 'Network error. Please try again later.' };
    }
  };

  const register = async (userData) => {
    try {
      const response = await fetch(API_URL + '/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, message: data.message || 'Registration failed' };
      }

      // Automatically log them in after registration
      const loginResult = await login(userData.email, userData.password);
      if (loginResult.success) {
         return { success: true };
      } else {
         return { success: false, message: 'Registered successfully, but failed to log in automatically.' };
      }

    } catch (err) {
      console.error("Registration error:", err);
      return { success: false, message: 'Network error. Please try again later.' };
    }
  };

  const logout = () => {
    adminCache.clear();
    userCache.clear();
    clearAllTabs();
    setCurrentUser(null);
    setUserProfile(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
  };

  if (loading) {
    return null; // Or a loading spinner
  }

  return (
    <AuthContext.Provider value={{ 
      currentUser, userProfile, setUserProfile, login, register, logout, 
      registrationOpen, workspaceOpen, problemsOpen, feedbackOpen, 
      regStartTime, regEndTime, hackStartTime, hackEndTime, isSubmissionOpen, 
      fetchPlatformSettings,
      unreadCounts, setUnreadCounts, fetchUnreadCounts, markTeamAsRead
    }}>
      {children}
    </AuthContext.Provider>
  );
}
