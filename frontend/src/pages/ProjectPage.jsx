import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config';
import { toast } from 'sonner';
import ConfirmModal from '../components/ConfirmModal';
import { getActiveTab, setActiveTab as setStorageTab } from '../utils/tabStorage';

export default function ProjectPage({ inDashboard = false }) {
  const { currentUser, hackStartTime, hackEndTime, isSubmissionOpen } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => {
    return getActiveTab('hackathon_project_tab', 'overview');
  });

  useEffect(() => {
    setStorageTab('hackathon_project_tab', activeTab);
  }, [activeTab]);

  const [team, setTeam] = useState(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isEditingLinks, setIsEditingLinks] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const fetchMyTeam = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/teams/my-team`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (data.success && data.data) {
          setTeam(data.data);
          setRepoUrl(data.data.repo_url || '');
          setLiveUrl(data.data.live_url || '');
          setVideoUrl(data.data.video_url || '');
        }
      } catch (err) {
        console.error('Failed to fetch team details:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMyTeam();
  }, []);

  const isLeader = Boolean(currentUser && team && currentUser.id === team.leader_id);

  const memberCount = Array.isArray(team?.members) ? team.members.length : (team?.member_count || 1);
  const minRequired = team?.minMembers || 3;
  const isTeamFormed = memberCount >= minRequired;
  const isSubmitted = Boolean(team?.is_submitted);
  const isHackNotStarted = Boolean(hackStartTime && new Date() < new Date(hackStartTime));
  const isDeadlineEnded = Boolean(
    team?.deadline_ended ||
    (team?.submission_deadline && new Date() > new Date(team.submission_deadline)) ||
    (hackEndTime && new Date() > new Date(hackEndTime))
  );

  const isM1Red = !isTeamFormed;
  const isM2Red = !team?.mentor_id;
  const isM3Red = !isSubmitted && (!team?.repo_url || !team?.live_url || !team?.video_url || isDeadlineEnded);
  const isAnyMilestoneRed = !isSubmitted && (isM1Red || isM2Red || isM3Red);
  const progressCount = (!isM1Red ? 1 : 0) + (!isM2Red ? 1 : 0) + (!isM3Red ? 1 : 0);

  const handleSaveLinks = async (e) => {
    e.preventDefault();
    if (!isLeader) {
      toast.error('Only the team leader can update the submission links.');
      return;
    }
    if (!repoUrl.trim() || !liveUrl.trim() || !videoUrl.trim()) {
      toast.error('Please enter all three submission links (Live Site, Video, GitHub).');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/v1/teams/repo`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          repo_url: repoUrl.trim(),
          live_url: liveUrl.trim(),
          video_url: videoUrl.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setTeam(prev => ({ 
          ...prev, 
          repo_url: repoUrl.trim(),
          live_url: liveUrl.trim(),
          video_url: videoUrl.trim()
        }));
        setIsEditingLinks(false);
        toast.success('Submission links saved successfully!');
      } else {
        toast.error(data.message || 'Failed to update submission links');
      }
    } catch (err) {
      toast.error('Error connecting to server.');
    }
  };

  const handleSubmitProject = () => {
    if (!isLeader) {
      const err = 'Only the team leader can submit the project.';
      setSubmitError(err);
      toast.error(err);
      return;
    }
    if (isHackNotStarted) {
      const err = 'Submission Failed: Hackathon submission has not started yet.';
      setSubmitError(err);
      toast.error(err);
      return;
    }
    if (isM1Red) {
      const err = `Submission Failed: Your team must have at least ${minRequired} members to submit.`;
      setSubmitError(err);
      toast.error(err);
      return;
    }
    if (isM2Red) {
      const err = 'Submission Failed: Your team must have a mentor to submit.';
      setSubmitError(err);
      toast.error(err);
      return;
    }
    if (isM3Red) {
      const err = 'Submission Failed: Please provide all three links (Live Site, Video, GitHub Repo) in the "Submission Links" tab.';
      setSubmitError(err);
      toast.error(err);
      return;
    }
    if (isAnyMilestoneRed) {
      const err = 'Submission Failed: Please complete all milestones before submitting.';
      setSubmitError(err);
      toast.error(err);
      return;
    }
    setSubmitError('');
    setShowSubmitModal(true);
  };

  const executeSubmitProject = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/teams/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setTeam(prev => ({ ...prev, is_submitted: true, submitted_at: new Date().toISOString() }));
        toast.success('Project permanently submitted & locked!');
        setShowSubmitModal(false);
      } else {
        toast.error(data.message || 'Failed to submit project');
      }
    } catch (err) {
      toast.error('Error connecting to server.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className={inDashboard ? 'py-2' : 'min-h-screen bg-slate-50 dark:bg-slate-900 py-8 sm:py-12 px-3 sm:px-6 lg:px-8'}>
      <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="min-w-0">
            {!inDashboard && (
              <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-blue-600 mb-1">
                <Link to="/dashboard" className="hover:underline">Dashboard</Link>
                <span>/</span>
                <span>Project Workspace</span>
              </div>
            )}
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white break-words">Project Workspace</h1>
            <p className="mt-1.5 sm:mt-2 text-sm sm:text-lg text-slate-600 dark:text-slate-400">Submit and manage your team's hackathon project.</p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-center">
            {team?.is_submitted ? (
              <span className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-emerald-100 text-emerald-800 font-bold rounded-full text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                <span>🔒</span>
                <span>Submitted & Locked</span>
              </span>
            ) : isDeadlineEnded ? (
              <span className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-rose-100 text-rose-800 font-bold rounded-full text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 border border-rose-200">
                <span>❌</span>
                <span>Submission Closed</span>
              </span>
            ) : isHackNotStarted ? (
              <span className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-amber-100 text-amber-800 font-bold rounded-full text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 border border-amber-200">
                <span>⏳</span>
                <span>Submission Starts Soon</span>
              </span>
            ) : (
              <span className="px-3.5 sm:px-4 py-1.5 sm:py-2 bg-blue-100 text-blue-700 font-bold rounded-full text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                <span>Submission Open</span>
              </span>
            )}
          </div>
        </div>

        {/* Tabs - Keep only Overview and Repository & Git */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4 sm:gap-6 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'repository', label: 'Submission Links' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 sm:pb-4 font-bold text-xs sm:text-sm transition-colors border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* 1. Key Milestones Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">Key Milestones</h2>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Roadmap
                  </span>
                </div>

                <div className="space-y-3">
                  {/* Milestone 1: Team Formation & Track */}
                  {isTeamFormed ? (
                    <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-sm">✓</span>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">1. Team Formation & Track</h4>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">Team formed ({memberCount}/{minRequired} min members met) ✓</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-sm">!</span>
                      <div>
                        <h4 className="font-bold text-rose-700 dark:text-rose-300 text-xs sm:text-sm">1. Team Formation & Track (Incomplete)</h4>
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold mt-0.5">Needs minimum {minRequired} members ({memberCount}/{minRequired} currently)</p>
                      </div>
                    </div>
                  )}

                  {/* Milestone 2: Select Mentor */}
                  {!isM2Red ? (
                    <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-sm">✓</span>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">2. Select Mentor</h4>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">Mentor assigned ✓</p>
                      </div>
                    </div>
                  ) : isDeadlineEnded ? (
                    <div className="p-3.5 rounded-2xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-sm">✕</span>
                      <div>
                        <h4 className="font-bold text-rose-700 dark:text-rose-300 text-xs sm:text-sm">2. Select Mentor (Overdue)</h4>
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold mt-0.5">Submission deadline passed without a mentor ❌</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-sm">✕</span>
                      <div>
                        <h4 className="font-bold text-rose-700 dark:text-rose-300 text-xs sm:text-sm">2. Select Mentor</h4>
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold mt-0.5">Invite a mentor to your team to work under ❌</p>
                      </div>
                    </div>
                  )}

                  {/* Milestone 3: Pitch Deck & Submission */}
                  {isSubmitted ? (
                    <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-sm">✓</span>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">3. Pitch Deck & Submission</h4>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">Project officially submitted & locked ✓</p>
                      </div>
                    </div>
                  ) : isDeadlineEnded ? (
                    <div className="p-3.5 rounded-2xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-sm">✕</span>
                      <div>
                        <h4 className="font-bold text-rose-700 dark:text-rose-300 text-xs sm:text-sm">3. Pitch Deck & Submission (Missed)</h4>
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold mt-0.5">Project unsubmitted — Deadline Ended ❌</p>
                      </div>
                    </div>
                  ) : (team?.repo_url && team?.live_url && team?.video_url) ? (
                    <div className="p-3.5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-sm">3</span>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm">3. Pitch Deck & Submission</h4>
                        <p className="text-[11px] text-blue-700 dark:text-blue-400 font-semibold mt-0.5">All 3 submission links added — Ready to submit! (Active ⚡)</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-sm">!</span>
                      <div>
                        <h4 className="font-bold text-rose-700 dark:text-rose-300 text-xs sm:text-sm">3. Pitch Deck & Submission (Incomplete)</h4>
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 font-bold mt-0.5">Please provide Live URL, Video URL, and GitHub Repo in the "Submission Links" tab ❌</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 mt-auto border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span>Overall Progress</span>
                {isSubmitted ? (
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Stage 3 of 3 (Completed 🎉)</span>
                ) : isDeadlineEnded ? (
                  <span className="font-bold text-rose-600 dark:text-rose-400">Deadline Ended (Unsubmitted)</span>
                ) : (
                  <span className="font-bold text-blue-600 dark:text-blue-400">Stage {progressCount} of 3 ({progressCount === 3 ? 'Ready to Submit ⚡' : 'Active'})</span>
                )}
              </div>
            </div>

            {/* 2. Submission Status Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">Submission Status</h2>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    {team?.is_submitted ? 'Locked' : 'Active'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Deadline: {hackEndTime ? new Date(hackEndTime).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Sunday at 11:59 PM'}
                </p>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Links Required</span>
                    {(team?.repo_url && team?.live_url && team?.video_url) ? (
                      <span className="font-bold text-blue-600 dark:text-blue-400">All 3 Links Provided</span>
                    ) : (
                      <span className="font-bold text-slate-400">Not Completed</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center text-xs sm:text-sm">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Status</span>
                    {team?.is_submitted ? (
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">✅ Submitted</span>
                    ) : (
                      <span className="font-bold text-amber-600 dark:text-amber-400">Pending</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-auto">
                {team?.is_submitted ? (
                  <button
                    disabled
                    className="w-full py-3 sm:py-3.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold rounded-xl shadow-sm flex items-center justify-center gap-2 cursor-not-allowed text-xs sm:text-sm"
                  >
                    <span>✓</span>
                    <span>Project Officially Submitted & Locked</span>
                  </button>
                ) : !isLeader ? (
                  <button
                    onClick={() => toast.info('Only the team leader can officially submit the project.')}
                    className="w-full py-3 sm:py-3.5 bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold rounded-xl cursor-not-allowed text-xs sm:text-sm"
                  >
                    Only Team Leader Can Submit
                  </button>
                ) : (
                  <button
                    onClick={handleSubmitProject}
                    disabled={submitting}
                    className="w-full py-3 sm:py-3.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-95"
                  >
                    {submitting ? 'Submitting...' : 'Submit Project Repository'}
                  </button>
                )}

                {submitError && (
                  <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/80 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-bold flex items-start gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <span className="shrink-0">❌</span>
                    <span className="leading-relaxed">{submitError}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'repository' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">Submission Links</h2>
                <p className="text-xs sm:text-base text-slate-600 dark:text-slate-400 mt-1">Provide the final URLs required for your project submission.</p>
              </div>
              {team?.is_submitted && (
                <span className="px-3.5 sm:px-4 py-1.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold rounded-full text-xs flex items-center gap-1.5 self-start">
                  <span>🔒</span>
                  <span>Submitted & Locked</span>
                </span>
              )}
            </div>

            {team?.is_submitted ? (
              <div className="space-y-3 p-4 sm:p-5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm text-emerald-800 dark:text-emerald-300 w-24">Live Site:</span>
                    <a href={team.live_url} target="_blank" rel="noreferrer" className="font-mono text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:underline truncate min-w-0">
                      {team.live_url}
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm text-emerald-800 dark:text-emerald-300 w-24">Video:</span>
                    <a href={team.video_url} target="_blank" rel="noreferrer" className="font-mono text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:underline truncate min-w-0">
                      {team.video_url}
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm text-emerald-800 dark:text-emerald-300 w-24">Repository:</span>
                    <a href={team.repo_url} target="_blank" rel="noreferrer" className="font-mono text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:underline truncate min-w-0">
                      {team.repo_url}
                    </a>
                  </div>
                </div>
              </div>
            ) : isEditingLinks ? (
              <form onSubmit={handleSaveLinks} className="flex flex-col gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Live Website URL</label>
                  <input
                    type="url"
                    required
                    placeholder="https://your-deployed-site.com"
                    value={liveUrl}
                    onChange={(e) => setLiveUrl(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Video Walkthrough URL</label>
                  <input
                    type="url"
                    required
                    placeholder="https://youtube.com/watch?v=..."
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">GitHub Repository URL</label>
                  <input
                    type="url"
                    required
                    placeholder="https://github.com/username/repository-name"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-xs sm:text-sm"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors text-xs sm:text-sm"
                  >
                    Save Links
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingLinks(false)}
                    className="flex-1 px-6 py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors text-xs sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-4 p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <span className="font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-300 w-24 shrink-0">Live Site:</span>
                    {team?.live_url ? (
                      <a href={team.live_url} target="_blank" rel="noreferrer" className="font-mono text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:underline truncate">
                        {team.live_url}
                      </a>
                    ) : (
                      <span className="font-mono text-xs sm:text-sm text-slate-400 italic">Not provided</span>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <span className="font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-300 w-24 shrink-0">Video:</span>
                    {team?.video_url ? (
                      <a href={team.video_url} target="_blank" rel="noreferrer" className="font-mono text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:underline truncate">
                        {team.video_url}
                      </a>
                    ) : (
                      <span className="font-mono text-xs sm:text-sm text-slate-400 italic">Not provided</span>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <span className="font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-300 w-24 shrink-0">Repository:</span>
                    {team?.repo_url ? (
                      <a href={team.repo_url} target="_blank" rel="noreferrer" className="font-mono text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:underline truncate">
                        {team.repo_url}
                      </a>
                    ) : (
                      <span className="font-mono text-xs sm:text-sm text-slate-400 italic">Not provided</span>
                    )}
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
                  {isLeader ? (
                    <button
                      onClick={() => setIsEditingLinks(true)}
                      className="px-5 py-2.5 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      {(team?.repo_url || team?.live_url || team?.video_url) ? 'Edit Links' : 'Add Links'}
                    </button>
                  ) : (
                    <span className="text-xs font-semibold text-slate-400">Leader Only</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom Confirmation Modal for Project Submission */}
      <ConfirmModal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onConfirm={executeSubmitProject}
        title="Confirm Official Submission"
        message="Are you sure you want to permanently submit your project repository? You can only submit once — after submitting, your GitHub repository link and project status will be permanently locked for judging."
        confirmText="Yes, Submit Project"
        cancelText="Keep Editing"
        variant="warning"
        loading={submitting}
      />
    </div>
  );
}
