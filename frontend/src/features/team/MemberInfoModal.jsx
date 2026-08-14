import React, { useState } from 'react';
import ImageModal from '../../components/ImageModal';

export default function MemberInfoModal({ isOpen, onClose, member, isLeader = false, isMentor = false }) {
  const [showFullImage, setShowFullImage] = useState(false);
  const [imageError, setImageError] = useState(false);
  if (!isOpen || !member) return null;

  const getInitial = (name, email) => {
    if (name && name.trim()) return name.trim().charAt(0).toUpperCase();
    if (email && email.trim()) return email.trim().charAt(0).toUpperCase();
    return '?';
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        onClick={(e) => e.stopPropagation()} 
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl p-6 sm:p-8 relative border border-slate-100 dark:border-slate-800 animate-in zoom-in-95 duration-200"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex flex-col items-center text-center mt-2">
          {member.avatar_url && !imageError ? (
            <div 
              className="w-20 h-20 rounded-3xl overflow-hidden shadow-lg shadow-blue-500/25 mb-4 border-2 border-white dark:border-slate-800 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setShowFullImage(true)}
            >
              <img src={member.avatar_url} alt={member.name || member.email} className="w-full h-full object-cover" onError={() => setImageError(true)} />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-3xl shadow-lg shadow-blue-500/25 mb-4">
              {getInitial(member.name, member.email)}
            </div>
          )}

          <h3 className="text-2xl font-black text-slate-900 dark:text-white break-words">
            {member.name || member.email}
          </h3>

          {isLeader && (
            <span className="mt-3 px-3 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 rounded-full text-xs font-black tracking-wide uppercase">
              Team Leader
            </span>
          )}
          {isMentor && (
            <span className="mt-3 px-3 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 rounded-full text-xs font-black tracking-wide uppercase">
              Mentor
            </span>
          )}
        </div>

        <div className="mt-8 space-y-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-700/50">
          <div className="flex items-center justify-between py-1.5 border-b border-slate-200/60 dark:border-slate-700/60 last:border-0">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email</span>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 break-all text-right">{member.email}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-slate-200/60 dark:border-slate-700/60 last:border-0">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Student ID</span>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 break-words text-right max-w-[60%]">{member.student_id || 'N/A'}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-slate-200/60 dark:border-slate-700/60 last:border-0">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Batch / Session</span>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 break-words text-right max-w-[60%]">{member.batch_session || 'N/A'}</span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Phone</span>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 break-words text-right max-w-[60%]">{member.phone_number || 'N/A'}</span>
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-sm rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
      {showFullImage && member.avatar_url && (
        <ImageModal 
          imageUrl={member.avatar_url} 
          onClose={() => setShowFullImage(false)} 
        />
      )}
    </div>
  );
}
