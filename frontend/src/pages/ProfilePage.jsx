import { API_URL } from '../config';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import NotificationDropdown from '../components/NotificationDropdown';
import ImageModal from '../components/ImageModal';

export default function ProfilePage({ inDashboard = false }) {
  const { currentUser, userProfile, setUserProfile } = useAuth();
  const navigate = useNavigate();
  
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // Data for View Mode
  const [profileData, setProfileData] = useState({
    name: '',
    student_id: '',
    batch_session: '',
    phone_number: ''
  });

  // Data for Edit Mode
  const [formData, setFormData] = useState({
    name: '',
    student_id: '',
    batch_session: '',
    phone_number: ''
  });

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
      return;
    }
  }, [currentUser, navigate]);

  // Sync with context profile data
  useEffect(() => {
    if (userProfile) {
      setProfileData(userProfile);
      setFormData(userProfile);
    }
  }, [userProfile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCancel = () => {
    // Revert form data to the saved profile data
    setFormData(profileData);
    setIsEditing(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const studentIdRegex = /^\d{2}[A-Za-z]{2,3}\d{3}$/;
    if (!studentIdRegex.test(formData.student_id?.trim())) {
      toast.error('Student ID must be 2 session digits + 2/3 department letters + 3 roll digits (e.g., 22CSE020 or 22CE005)');
      return;
    }

    setSaving(true);
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(API_URL + '/api/v1/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.name,
          student_id: formData.student_id,
          batch_session: formData.batch_session,
          phone_number: formData.phone_number
        })
      });
      
      const data = await res.json();
      
      if (res.ok && (data.status === 'success' || data.success)) {
        toast.success('Profile updated successfully!');
        setUserProfile(prev => ({ ...prev, ...formData })); // Preserve avatar_url
        setProfileData(prev => ({ ...prev, ...formData }));
        setIsEditing(false); // Switch back to view mode
      } else {
        const errMsg = data.errors ? Object.values(data.errors).flat()[0] : (data.message || 'Failed to update profile');
        toast.error(errMsg);
      }
    } catch (err) {
      toast.error('Network error occurred.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    setUploadingImage(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(API_URL + '/api/v1/users/profile/avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok && (data.status === 'success' || data.success)) {
        toast.success('Profile picture updated!');
        setUserProfile(prev => ({ ...prev, avatar_url: data.data.avatar_url }));
        setProfileData(prev => ({ ...prev, avatar_url: data.data.avatar_url }));
      } else {
        toast.error(data.message || 'Failed to update picture');
      }
    } catch (err) {
      toast.error('Network error occurred during upload.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Get initials for avatar
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className={inDashboard ? '' : 'min-h-screen bg-slate-50 dark:bg-slate-900'}>
      {/* Navbar */}
      {!inDashboard && (
        <nav className="bg-slate-900 dark:bg-slate-950 text-white py-4 px-6 lg:px-20 flex justify-between items-center shadow-md relative z-50">
          <Link to="/dashboard" className="text-2xl font-black tracking-tighter hover:opacity-80 transition-opacity">
            GSTU<span className="text-blue-500">Hackathon</span>
          </Link>
          <div className="flex items-center space-x-4">
            <NotificationDropdown />
            <Link to="/dashboard" className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 border-2 border-slate-700 flex items-center justify-center transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-300">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </Link>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Profile Header Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden mb-8">
          <div className="h-32 bg-gradient-to-r from-blue-600 to-indigo-600"></div>
          <div className="px-8 pb-8 flex flex-col sm:flex-row items-center sm:items-end justify-between -mt-16 gap-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative group">
                <div 
                  className={`w-32 h-32 rounded-full border-4 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-4xl font-bold text-slate-400 dark:text-slate-500 shadow-md overflow-hidden relative ${profileData.avatar_url ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
                  onClick={() => profileData.avatar_url && setShowFullImage(true)}
                >
                  {profileData.avatar_url && !imageError ? (
                    <img 
                      src={profileData.avatar_url} 
                      alt="Profile" 
                      className="w-full h-full object-cover" 
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    profileData.name ? getInitials(profileData.name) : '👤'
                  )}
                  {uploadingImage && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  )}
                </div>
                <label className="absolute bottom-0 right-0 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full cursor-pointer shadow-lg transition-colors group-hover:scale-110 duration-200">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25v9.5A2.25 2.25 0 0 1 16.75 17H3.25A2.25 2.25 0 0 1 1 14.75v-9.5Zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75v-2.69l-2.22-2.219a2.25 2.25 0 0 0-3.182 0l-1.44 1.439a2.25 2.25 0 0 1-3.182 0L5.682 8.36a2.25 2.25 0 0 0-3.182 0l-1.44 1.44Z" clipRule="evenodd" />
                  </svg>
                  <input type="file" className="hidden" accept="image/png, image/jpeg, image/jpg, image/webp" onChange={handleImageUpload} disabled={uploadingImage} />
                </label>
              </div>
              <div className="text-center sm:text-left mb-2 min-w-0 pr-4">
                <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white break-words">{profileData.name || 'Hacker'}</h1>
                <p className="text-slate-500 dark:text-slate-400 font-medium">{profileData.student_id ? `ID: ${profileData.student_id}` : 'Update your profile to add details'}</p>
              </div>
            </div>
            
            {!isEditing && (
              <button 
                onClick={() => setIsEditing(true)}
                className="shrink-0 flex items-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                </svg>
                Edit Profile
              </button>
            )}
          </div>
        </div>

        {/* Details Section */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-8">
          {isEditing ? (
            /* Edit Mode Form */
            <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in duration-300">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">Edit Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 min-w-0">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Full Name</label>
                  <input 
                    type="text" 
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500" 
                    placeholder="John Doe" 
                  />
                </div>

                <div className="md:col-span-2 min-w-0">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Email Address</label>
                  <input 
                    type="email" 
                    value={currentUser?.email || ''}
                    disabled
                    className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed outline-none font-medium" 
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 ml-1">Email address cannot be changed.</p>
                </div>
                
                <div className="min-w-0">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Student ID</label>
                  <input 
                    type="text" 
                    name="student_id"
                    value={formData.student_id}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500" 
                    placeholder="e.g. 1902043" 
                  />
                </div>

                <div className="min-w-0">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Batch / Session</label>
                  <input 
                    type="text" 
                    name="batch_session"
                    value={formData.batch_session}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500" 
                    placeholder="e.g. 19th Batch, 2019-20" 
                  />
                </div>

                <div className="md:col-span-2 min-w-0">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Phone Number (Optional)</label>
                  <input 
                    type="tel" 
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500" 
                    placeholder="+8801..." 
                  />
                </div>
              </div>

              <div className="pt-6 flex gap-4 justify-end border-t border-slate-100 dark:border-slate-800">
                <button 
                  type="button" 
                  onClick={handleCancel}
                  className="px-6 py-3 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className={`bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2 ${
                    saving ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Saving...</span>
                    </>
                  ) : 'Save Changes'}
                </button>
              </div>
            </form>
          ) : (
            /* View Mode */
            <div className="animate-in fade-in duration-300">
              <div className="flex items-center justify-between mb-8 border-b border-slate-100 dark:border-slate-800 pb-4">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Personal Details</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                
                {/* Full Name */}
                <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group border border-transparent hover:border-slate-100 dark:hover:border-slate-700/50">
                  <div className="w-12 h-12 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-orange-100 dark:group-hover:bg-orange-900/40 transition-all">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                  </div>
                  <div className="flex flex-col min-w-0 justify-center h-12">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-0.5 uppercase tracking-wider">Full Name</span>
                    <span className="text-lg font-semibold text-slate-800 dark:text-slate-200 break-words leading-tight">{profileData.name || <span className="text-slate-400 italic font-normal">Not set</span>}</span>
                  </div>
                </div>

                {/* Email Address */}
                <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group border border-transparent hover:border-slate-100 dark:hover:border-slate-700/50">
                  <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition-all">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                  </div>
                  <div className="flex flex-col min-w-0 justify-center h-12">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-0.5 uppercase tracking-wider">Email Address</span>
                    <span className="text-lg font-semibold text-slate-800 dark:text-slate-200 break-words leading-tight">{currentUser?.email || <span className="text-slate-400 italic font-normal">Not set</span>}</span>
                  </div>
                </div>

                {/* Student ID */}
                <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group border border-transparent hover:border-slate-100 dark:hover:border-slate-700/50">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40 transition-all">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" /></svg>
                  </div>
                  <div className="flex flex-col min-w-0 justify-center h-12">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-0.5 uppercase tracking-wider">Student ID</span>
                    <span className="text-lg font-semibold text-slate-800 dark:text-slate-200 break-words leading-tight">{profileData.student_id || <span className="text-slate-400 italic font-normal">Not set</span>}</span>
                  </div>
                </div>

                {/* Batch / Session */}
                <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group border border-transparent hover:border-slate-100 dark:hover:border-slate-700/50">
                  <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/40 transition-all">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" /></svg>
                  </div>
                  <div className="flex flex-col min-w-0 justify-center h-12">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-0.5 uppercase tracking-wider">Batch / Session</span>
                    <span className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                      {profileData.batch_session ? (
                        <span className="inline-flex items-center px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 break-words shadow-sm text-base">
                          {profileData.batch_session}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic font-normal">Not set</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Phone Number */}
                <div className="flex items-start gap-4 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group border border-transparent hover:border-slate-100 dark:hover:border-slate-700/50">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40 transition-all">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-2.896-1.596-5.48-4.08-7.076-6.975l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" /></svg>
                  </div>
                  <div className="flex flex-col min-w-0 justify-center h-12">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-0.5 uppercase tracking-wider">Phone Number</span>
                    <span className="text-lg font-semibold text-slate-800 dark:text-slate-200 break-words leading-tight">{profileData.phone_number || <span className="text-slate-400 italic font-normal">Not set</span>}</span>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </main>

      {/* Full Image Modal */}
      {showFullImage && profileData.avatar_url && (
        <ImageModal 
          imageUrl={profileData.avatar_url} 
          onClose={() => setShowFullImage(false)} 
        />
      )}
    </div>
  );
}
