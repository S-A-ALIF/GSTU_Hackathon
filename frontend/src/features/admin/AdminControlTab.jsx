import { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import { toast } from 'sonner';
import { useAuth, socket } from '../../contexts/AuthContext';
import { adminCache } from './adminCache';

export default function AdminControlTab() {
  const { fetchPlatformSettings } = useAuth();
  const [settings, setSettings] = useState(adminCache.settings || {});
  const [loading, setLoading] = useState(!adminCache.settings);
  const [togglingAction, setTogglingAction] = useState(null); // Tracks 'registration', 'workspace', 'problems', 'feedback'
  const [minTeamSize, setMinTeamSize] = useState(
    adminCache.settings ? (adminCache.settings.min_team_members === 'none' ? '' : (adminCache.settings.min_team_members || '3')) : ''
  );
  const [maxTeamSize, setMaxTeamSize] = useState(
    adminCache.settings ? (adminCache.settings.max_team_members === 'none' ? '' : (adminCache.settings.max_team_members || '5')) : ''
  );
  const [maxTeamsPerMentor, setMaxTeamsPerMentor] = useState(
    adminCache.settings ? (adminCache.settings.max_teams_per_mentor === 'none' ? '' : (adminCache.settings.max_teams_per_mentor || '3')) : ''
  );
  const toLocalDatetimeString = (isoString) => {
    if (!isoString) return '';
    if (!isoString.includes('Z')) return isoString; // fallback if not ISO
    const date = new Date(isoString);
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  };

  const toUTCString = (localString) => {
    if (!localString) return '';
    return new Date(localString).toISOString();
  };

  const [regStartTime, setRegStartTime] = useState(toLocalDatetimeString(adminCache.settings?.reg_start_time) || '');
  const [regEndTime, setRegEndTime] = useState(toLocalDatetimeString(adminCache.settings?.reg_end_time) || '');
  const [hackStartTime, setHackStartTime] = useState(toLocalDatetimeString(adminCache.settings?.hack_start_time) || '');
  const [hackEndTime, setHackEndTime] = useState(toLocalDatetimeString(adminCache.settings?.hack_end_time) || '');
  const [savingLimits, setSavingLimits] = useState(false);
  const [savingTimeline, setSavingTimeline] = useState(false);
  const [savingHackTimeline, setSavingHackTimeline] = useState(false);
  const [clearModal, setClearModal] = useState({ isOpen: false, target: null });
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    fetchSettings();

    const handleSettingsUpdated = () => {
      fetchSettings(true); // force fresh fetch
    };

    socket.on('settingsUpdated', handleSettingsUpdated);

    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    
    return () => {
      clearInterval(timer);
      socket.off('settingsUpdated', handleSettingsUpdated);
    };
  }, []);

  const fetchSettings = async (force = false) => {
    if (!force && adminCache.isFresh('settings')) {
      setSettings(adminCache.settings);
      setMinTeamSize(adminCache.settings.min_team_members === 'none' ? '' : (adminCache.settings.min_team_members || '3'));
      setMaxTeamSize(adminCache.settings.max_team_members === 'none' ? '' : (adminCache.settings.max_team_members || '5'));
      setMaxTeamsPerMentor(adminCache.settings.max_teams_per_mentor === 'none' ? '' : (adminCache.settings.max_teams_per_mentor || '3'));
      setRegStartTime(adminCache.settings.reg_start_time || '');
      setRegEndTime(adminCache.settings.reg_end_time || '');
      setHackStartTime(adminCache.settings.hack_start_time || '');
      setHackEndTime(adminCache.settings.hack_end_time || '');
      setLoading(false);
      return;
    }
    if (!adminCache.settings || force) {
      setLoading(true);
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/settings`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        setSettings(data.data);
        adminCache.set('settings', data.data);
        setMinTeamSize(data.data.min_team_members === 'none' ? '' : (data.data.min_team_members || '3'));
        setMaxTeamSize(data.data.max_team_members === 'none' ? '' : (data.data.max_team_members || '5'));
        setMaxTeamsPerMentor(data.data.max_teams_per_mentor === 'none' ? '' : (data.data.max_teams_per_mentor || '3'));
        setRegStartTime(toLocalDatetimeString(data.data.reg_start_time) || '');
        setRegEndTime(toLocalDatetimeString(data.data.reg_end_time) || '');
        setHackStartTime(toLocalDatetimeString(data.data.hack_start_time) || '');
        setHackEndTime(toLocalDatetimeString(data.data.hack_end_time) || '');
      } else {
        toast.error(data.message || 'Failed to load control settings');
      }
    } catch (error) {
      console.error('Error fetching control settings:', error);
      toast.error('Error loading control settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings(false);
  }, []);

  const handleToggleRegistration = async () => {
    setTogglingAction('registration');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/settings/toggle-registration`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message);
        const updated = {
          ...settings,
          registration_open: data.data.registration_open,
          reg_override: data.data.reg_override
        };
        adminCache.set('settings', updated);
        adminCache.invalidate('stats');
        setSettings(updated);
        if (fetchPlatformSettings) fetchPlatformSettings();
      } else {
        toast.error(data.message || 'Failed to toggle registration');
      }
    } catch (error) {
      console.error('Error toggling registration:', error);
      toast.error('Error toggling registration');
    } finally {
      setTogglingAction(null);
    }
  };

  const handleToggleWorkspace = async () => {
    setTogglingAction('workspace');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/settings/toggle-workspace`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message);
        const updated = {
          ...settings,
          workspace_open: data.data.workspace_open,
          hack_override: data.data.hack_override
        };
        adminCache.set('settings', updated);
        setSettings(updated);
        if (fetchPlatformSettings) fetchPlatformSettings();
      } else {
        toast.error(data.message || 'Failed to toggle workspace');
      }
    } catch (error) {
      console.error('Error toggling workspace:', error);
      toast.error('Error toggling workspace');
    } finally {
      setTogglingAction(null);
    }
  };

  const handleToggleProblems = async () => {
    setTogglingAction('problems');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/settings/toggle-problems`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message);
        const updated = {
          ...settings,
          problems_open: data.data.problems_open,
          prob_override: data.data.prob_override
        };
        adminCache.set('settings', updated);
        setSettings(updated);
        if (fetchPlatformSettings) fetchPlatformSettings();
      } else {
        toast.error(data.message || 'Failed to toggle problems');
      }
    } catch (error) {
      console.error('Error toggling problems:', error);
      toast.error('Error toggling problems');
    } finally {
      setTogglingAction(null);
    }
  };

  const handleToggleFeedback = async () => {
    setTogglingAction('feedback');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/settings/toggle-feedback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message);
        const updated = {
          ...settings,
          feedback_open: data.data.feedback_open
        };
        adminCache.set('settings', updated);
        setSettings(updated);
        if (fetchPlatformSettings) fetchPlatformSettings();
      } else {
        toast.error(data.message || 'Failed to toggle feedback visibility');
      }
    } catch (error) {
      console.error('Error toggling feedback:', error);
      toast.error('Error toggling feedback');
    } finally {
      setTogglingAction(null);
    }
  };

  const handleSaveTeamLimits = async (e) => {
    e.preventDefault();
    setSavingLimits(true);
    try {
      const token = localStorage.getItem('token');
      const minVal = minTeamSize.trim() === '' ? 'none' : minTeamSize.trim();
      const maxVal = maxTeamSize.trim() === '' ? 'none' : maxTeamSize.trim();
      const mentorLimitVal = maxTeamsPerMentor.trim() === '' ? 'none' : maxTeamsPerMentor.trim();

      const res = await fetch(`${API_URL}/api/v1/admin/settings/team-limits`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          min_team_members: minVal,
          max_team_members: maxVal,
          max_teams_per_mentor: mentorLimitVal
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Team size limits updated successfully!');
        const updated = {
          ...settings,
          min_team_members: minVal,
          max_team_members: maxVal,
          max_teams_per_mentor: mentorLimitVal
        };
        adminCache.set('settings', updated);
        adminCache.invalidate('stats');
        setSettings(updated);
      } else {
        toast.error(data.message || 'Failed to update team size limits');
      }
    } catch (error) {
      console.error('Error updating team limits:', error);
      toast.error('Error updating team limits');
    } finally {
      setSavingLimits(false);
    }
  };

  const handleSaveRegistrationTimeline = async (e) => {
    e.preventDefault();
    setSavingTimeline(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/settings/registration-timeline`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reg_start_time: toUTCString(regStartTime),
          reg_end_time: toUTCString(regEndTime)
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Registration timeline updated successfully!');
        const updated = {
          ...settings,
          reg_start_time: data.data.reg_start_time,
          reg_end_time: data.data.reg_end_time,
          reg_override: data.data.reg_override
        };
        adminCache.set('settings', updated);
        setSettings(updated);
        if (fetchPlatformSettings) fetchPlatformSettings();
      } else {
        toast.error(data.message || 'Failed to update registration timeline');
      }
    } catch (error) {
      console.error('Error updating registration timeline:', error);
      toast.error('Error updating registration timeline');
    } finally {
      setSavingTimeline(false);
    }
  };

  const handleSaveHackathonTimeline = async (e) => {
    e.preventDefault();
    setSavingHackTimeline(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/admin/settings/hackathon-timeline`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hack_start_time: toUTCString(hackStartTime),
          hack_end_time: toUTCString(hackEndTime)
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Hackathon timeline updated successfully!');
        const updated = { 
          ...settings, 
          hack_start_time: data.data.hack_start_time, 
          hack_end_time: data.data.hack_end_time,
          hack_override: data.data.hack_override,
          prob_override: data.data.prob_override
        };
        adminCache.set('settings', updated);
        setSettings(updated);
        if (fetchPlatformSettings) fetchPlatformSettings();
      } else {
        toast.error(data.message || 'Failed to update hackathon timeline');
      }
    } catch (error) {
      console.error('Error updating hackathon timeline:', error);
      toast.error('Error updating hackathon timeline');
    } finally {
      setSavingHackTimeline(false);
    }
  };

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, actionStr: null });

  const executeToggle = () => {
    const { type } = confirmModal;
    setConfirmModal({ isOpen: false, type: null, actionStr: null });
    if (type === 'registration') handleToggleRegistration();
    else if (type === 'workspace') handleToggleWorkspace();
    else if (type === 'problems') handleToggleProblems();
    else if (type === 'feedback') handleToggleFeedback();
  };

  const requestToggle = (type, actionStr) => {
    setConfirmModal({ isOpen: true, type, actionStr });
  };

  const rawRegOpen = settings.registration_open !== 'false' && settings.registration_open !== false;
  let isRegOpen = rawRegOpen;
  if (settings.reg_override === 'true') {
    isRegOpen = rawRegOpen;
  } else if (settings.reg_start_time && settings.reg_end_time) {
    isRegOpen = now >= new Date(settings.reg_start_time) && now <= new Date(settings.reg_end_time);
  } else if (settings.reg_start_time) {
    isRegOpen = now >= new Date(settings.reg_start_time);
  } else if (settings.reg_end_time) {
    isRegOpen = now <= new Date(settings.reg_end_time);
  }

  const rawWorkOpen = settings.workspace_open === 'true' || settings.workspace_open === true;
  let isWorkOpen = rawWorkOpen;
  if (settings.hack_override === 'true') {
    isWorkOpen = rawWorkOpen;
  } else if (settings.hack_start_time && settings.hack_end_time) {
    isWorkOpen = now >= new Date(settings.hack_start_time) && now <= new Date(settings.hack_end_time);
  } else if (settings.hack_start_time) {
    isWorkOpen = now >= new Date(settings.hack_start_time);
  } else if (settings.hack_end_time) {
    isWorkOpen = now <= new Date(settings.hack_end_time);
  }

  const rawProbOpen = settings.problems_open === 'true' || settings.problems_open === true;
  let isProbOpen = rawProbOpen;
  if (settings.prob_override === 'true') {
    isProbOpen = rawProbOpen;
  } else if (settings.hack_start_time) {
    isProbOpen = now >= new Date(settings.hack_start_time);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Platform Control Center</h1>
          <p className="text-slate-600 mt-1">Manage live event rules, registration availability, and team size restrictions.</p>
        </div>
        <button
          onClick={fetchSettings}
          className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold rounded-xl text-sm transition-colors"
        >
          Refresh Controls
        </button>
      </div>

      {/* Platform Toggles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Registration Toggle */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-slate-900 dark:text-white">Account Registration</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isRegOpen ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400'}`}>
                {isRegOpen ? 'OPEN' : 'CLOSED'}
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">Allow new users to sign up for the platform.</p>
          </div>
          <button
            onClick={() => requestToggle('registration', isRegOpen ? 'Close Registration' : 'Open Registration')}
            disabled={togglingAction !== null}
            className={`w-full py-2.5 rounded-xl font-bold text-sm text-white transition-all shadow-md ${isRegOpen ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'}`}
          >
            {togglingAction === 'registration' ? 'Updating...' : isRegOpen ? 'Close Registration' : 'Open Registration'}
          </button>
        </div>

        {/* Project Workspace Toggle */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-slate-900 dark:text-white">Project Workspace</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isWorkOpen ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400'}`}>
                {isWorkOpen ? 'OPEN' : 'CLOSED'}
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">Grant access to the team Project Workspace tab.</p>
          </div>
          <button
            onClick={() => requestToggle('workspace', rawWorkOpen ? 'Close Workspace' : 'Open Workspace')}
            disabled={togglingAction !== null}
            className={`w-full py-2.5 rounded-xl font-bold text-sm text-white transition-all shadow-md ${isWorkOpen ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'}`}
          >
            {togglingAction === 'workspace' ? 'Updating...' : isWorkOpen ? 'Close Workspace' : 'Open Workspace'}
          </button>
        </div>

        {/* Problem Statements Toggle */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-slate-900 dark:text-white">Problem Statements</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isProbOpen ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400'}`}>
                {isProbOpen ? 'OPEN' : 'CLOSED'}
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">Reveal hackathon problem statements to users.</p>
          </div>
          <button
            onClick={() => requestToggle('problems', isProbOpen ? 'Close Problems' : 'Open Problems')}
            disabled={togglingAction !== null}
            className={`w-full py-2.5 rounded-xl font-bold text-sm text-white transition-all shadow-md ${isProbOpen ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'}`}
          >
            {togglingAction === 'problems' ? 'Updating...' : isProbOpen ? 'Close Problems' : 'Open Problems'}
          </button>
        </div>

        {/* Feedback Widget Toggle */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-slate-900 dark:text-white">Feedback Widget</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${(settings.feedback_open === 'true' || settings.feedback_open === true || settings.feedback_open === undefined) ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400'}`}>
                {(settings.feedback_open === 'true' || settings.feedback_open === true || settings.feedback_open === undefined) ? 'VISIBLE' : 'HIDDEN'}
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">Show the feedback form in user menus globally.</p>
          </div>
          <button
            onClick={() => requestToggle('feedback', (settings.feedback_open === 'true' || settings.feedback_open === true || settings.feedback_open === undefined) ? 'Hide Feedback' : 'Show Feedback')}
            disabled={togglingAction !== null}
            className={`w-full py-2.5 rounded-xl font-bold text-sm text-white transition-all shadow-md ${(settings.feedback_open === 'true' || settings.feedback_open === true || settings.feedback_open === undefined) ? 'bg-slate-700 hover:bg-slate-800 shadow-slate-700/20' : 'bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/20'}`}
          >
            {togglingAction === 'feedback' ? 'Updating...' : (settings.feedback_open === 'true' || settings.feedback_open === true || settings.feedback_open === undefined) ? 'Hide Widget' : 'Show Widget'}
          </button>
        </div>
      </div>

      {/* Timelines & Deadlines Section */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-xl font-black text-slate-900 dark:text-white">Timelines & Deadlines</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Configure automated start and end times for platform phases.</p>
        </div>
        
        <div className="p-6">
          {/* Registration Timeline */}
          <div className="mb-8">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              Registration Window
            </h4>
            <form onSubmit={handleSaveRegistrationTimeline} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Start Time</label>
                  <div className="relative">
                    <input type="datetime-local" value={regStartTime} onChange={(e) => setRegStartTime(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium transition-all" />
                    {regStartTime && <button type="button" onClick={() => setClearModal({ isOpen: true, target: 'start' })} className="absolute right-12 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-red-500">Clear</button>}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">End Time</label>
                  <div className="relative">
                    <input type="datetime-local" value={regEndTime} onChange={(e) => setRegEndTime(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium transition-all" />
                    {regEndTime && <button type="button" onClick={() => setClearModal({ isOpen: true, target: 'end' })} className="absolute right-12 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-red-500">Clear</button>}
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={savingTimeline} className="px-5 py-2 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white font-bold rounded-lg text-sm transition-all shadow-sm">
                  {savingTimeline ? 'Saving...' : 'Save Registration'}
                </button>
              </div>
            </form>
          </div>

          <hr className="border-slate-100 dark:border-slate-700/50 mb-8" />

          {/* Hackathon Timeline */}
          <div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              Hackathon & Submission Window
            </h4>
            <form onSubmit={handleSaveHackathonTimeline} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Start Time</label>
                  <div className="relative">
                    <input type="datetime-local" value={hackStartTime} onChange={(e) => setHackStartTime(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium transition-all" />
                    {hackStartTime && <button type="button" onClick={() => setClearModal({ isOpen: true, target: 'hack_start' })} className="absolute right-12 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-red-500">Clear</button>}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Submission Deadline</label>
                  <div className="relative">
                    <input type="datetime-local" value={hackEndTime} onChange={(e) => setHackEndTime(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium transition-all" />
                    {hackEndTime && <button type="button" onClick={() => setClearModal({ isOpen: true, target: 'hack_end' })} className="absolute right-12 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-red-500">Clear</button>}
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={savingHackTimeline} className="px-5 py-2 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 text-white font-bold rounded-lg text-sm transition-all shadow-sm">
                  {savingHackTimeline ? 'Saving...' : 'Save Hackathon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Team Size Requirements Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-xl font-black text-slate-900 dark:text-white">Team Configuration</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Set limits for team capacity and mentor workload.</p>
        </div>
        <div className="p-6">
          <form onSubmit={handleSaveTeamLimits} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Min Members</label>
                <div className="relative">
                  <input type="number" min="1" max="20" value={minTeamSize} onChange={(e) => setMinTeamSize(e.target.value)} placeholder="No limit" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium transition-all" />
                  {minTeamSize && <button type="button" onClick={() => setMinTeamSize('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-red-500">Clear</button>}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Max Members</label>
                <div className="relative">
                  <input type="number" min="1" max="20" value={maxTeamSize} onChange={(e) => setMaxTeamSize(e.target.value)} placeholder="No limit" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium transition-all" />
                  {maxTeamSize && <button type="button" onClick={() => setMaxTeamSize('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-red-500">Clear</button>}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Max Teams per Mentor</label>
                <div className="relative">
                  <input type="number" min="1" max="100" value={maxTeamsPerMentor} onChange={(e) => setMaxTeamsPerMentor(e.target.value)} placeholder="Default 3" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium transition-all" />
                  {maxTeamsPerMentor && <button type="button" onClick={() => setMaxTeamsPerMentor('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-red-500">Clear</button>}
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-100 dark:border-slate-700/50 pt-6 mt-6">
              <button type="submit" disabled={savingLimits} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-blue-500/20">
                {savingLimits ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">Confirm Action</h3>
            <p className="text-slate-300 mb-6">
              Are you sure you want to <strong>{confirmModal.actionStr}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmModal({ isOpen: false, type: null, actionStr: null })}
                className="px-4 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={executeToggle}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Time Confirmation Modal */}
      {clearModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">Confirm Clear</h3>
            <p className="text-slate-300 mb-6">
              Are you sure you want to clear the {(clearModal.target === 'start' || clearModal.target === 'end') ? 'registration' : 'hackathon'} {clearModal.target?.includes('start') ? 'start' : 'end'} time?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setClearModal({ isOpen: false, target: null })}
                className="px-4 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (clearModal.target === 'start') setRegStartTime('');
                  else if (clearModal.target === 'end') setRegEndTime('');
                  else if (clearModal.target === 'hack_start') setHackStartTime('');
                  else if (clearModal.target === 'hack_end') setHackEndTime('');
                  setClearModal({ isOpen: false, target: null });
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-lg shadow-red-600/30 transition-colors"
              >
                Clear Time
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
