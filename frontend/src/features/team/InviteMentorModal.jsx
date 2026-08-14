import { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import { toast } from 'sonner';
import ImageModal from '../../components/ImageModal';

export default function InviteMentorModal({ isOpen, onClose, teamId }) {
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invitingId, setInvitingId] = useState(null);
  const [mentorLimit, setMentorLimit] = useState(3);
  const [fullImageUrl, setFullImageUrl] = useState(null);
  const [imageErrors, setImageErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      fetchMentors();
      fetchSettings();
    }
  }, [isOpen]);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/settings`);
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        const limitStr = data.data.max_teams_per_mentor;
        const limitNum = limitStr && limitStr !== 'none' && !isNaN(parseInt(limitStr, 10)) ? parseInt(limitStr, 10) : 3;
        setMentorLimit(limitNum);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const fetchMentors = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/mentors/list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMentors(data.data);
      } else {
        toast.error(data.message || 'Failed to load mentors');
      }
    } catch (error) {
      console.error('Error fetching mentors:', error);
      toast.error('Network error loading mentors');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (mentorId) => {
    setInvitingId(mentorId);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/mentors/invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ teamId, mentorId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || 'Mentor invited successfully');
        onClose();
      } else {
        toast.error(data.message || 'Failed to invite mentor');
      }
    } catch (error) {
      console.error('Error inviting mentor:', error);
      toast.error('Network error inviting mentor');
    } finally {
      setInvitingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-xl font-bold text-slate-900">Invite a Mentor</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : mentors.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No mentors found on the platform.
            </div>
          ) : (
            <div className="space-y-4">
              {mentors.map(mentor => {
                const isFull = mentor.team_count >= mentorLimit;
                const isThisInviting = invitingId === mentor.id;
                return (
                  <div key={mentor.id} className={`flex items-center justify-between p-4 rounded-xl border ${isFull ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200 hover:border-blue-300 shadow-sm'}`}>
                    <div className="flex items-center space-x-3">
                      {mentor.avatar_url && !imageErrors[mentor.id] ? (
                        <img 
                          src={mentor.avatar_url} 
                          alt="Mentor Avatar" 
                          className="w-10 h-10 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity" 
                          onClick={() => setFullImageUrl(mentor.avatar_url)} 
                          onError={() => setImageErrors(prev => ({...prev, [mentor.id]: true}))}
                        />
                      ) : (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${isFull ? 'bg-slate-400' : 'bg-gradient-to-br from-blue-600 to-indigo-700'}`}>
                          {mentor.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className={`font-bold ${isFull ? 'text-slate-600' : 'text-slate-900'}`}>{mentor.name}</p>
                        <p className="text-xs text-slate-500">Mentoring {mentor.team_count}/{mentorLimit} teams</p>
                      </div>
                    </div>
                    <button
                      disabled={isFull || isThisInviting}
                      onClick={() => handleInvite(mentor.id)}
                      className={`px-4 py-2 rounded-lg font-bold text-sm transition-all flex items-center justify-center min-w-[80px] ${
                        isFull 
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed' 
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      }`}
                    >
                      {isThisInviting ? (
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : isFull ? 'Full' : 'Invite'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {fullImageUrl && (
        <ImageModal 
          imageUrl={fullImageUrl} 
          onClose={() => setFullImageUrl(null)} 
        />
      )}
    </div>
  );
}
