export default function DetailsInfoModal({ isOpen, onClose, data, type }) {
  if (!isOpen || !data) return null;

  const isTeam = type === 'team';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-8 shadow-2xl border border-slate-200 dark:border-slate-800 relative animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold"
        >
          ✕
        </button>

        <div className="flex items-center gap-3 mb-6">
          <span className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl font-bold shrink-0">
            {isTeam ? '👥' : '👤'}
          </span>
          <div className="min-w-0">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white break-words leading-tight">
              {isTeam ? data.name : data.name || data.email}
            </h2>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              {isTeam ? 'Team Information & Members' : 'Member Profile & Identity'}
            </p>
          </div>
        </div>

        {isTeam ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50">
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-400 uppercase">Team ID</span>
                <p className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5 break-all">{data.id}</p>
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-400 uppercase">Created On</span>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5 break-words">
                  {new Date(data.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-400 uppercase">Team Leader</span>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5 break-words">
                  {data.leader_name || data.leader_email || 'N/A'}
                </p>
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-400 uppercase">Status</span>
                <p className="text-sm font-bold mt-0.5 break-words">
                  {data.is_banned ? (
                    <span className="text-red-600 dark:text-red-400">🚫 Banned ({data.ban_reason || 'No reason'})</span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">✅ Active</span>
                  )}
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                Team Members ({data.members?.length || 0})
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                {data.members && data.members.length > 0 ? (
                  data.members.map((m, idx) => (
                    <div
                      key={m.id || idx}
                      className="p-3 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-slate-900 dark:text-white text-sm truncate">
                          {m.name || 'Unnamed Member'} {data.leader_id === m.id && '👑'}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{m.email}</div>
                      </div>
                      <div className="text-right shrink-0">
                        {m.batch_session && (
                          <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 text-xs font-bold">
                            {m.batch_session}
                          </span>
                        )}
                        {m.student_id && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">ID: {m.student_id}</div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400 italic">No members found.</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50">
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-400 uppercase">Full Name</span>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5 break-words">{data.name || 'Not Provided'}</p>
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-400 uppercase">Email Address</span>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5 break-all">{data.email}</p>
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-400 uppercase">Student ID</span>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5 break-words">{data.student_id || 'N/A'}</p>
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-400 uppercase">Batch & Session</span>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5 break-words">{data.batch_session || 'N/A'}</p>
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-400 uppercase">Phone Number</span>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5 break-words">{data.phone_number || 'N/A'}</p>
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-400 uppercase">Team Affiliation</span>
                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mt-0.5 break-words">{data.team_name || 'No Team'}</p>
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-400 uppercase">System Role</span>
                <p className="text-sm font-bold uppercase mt-0.5 text-slate-800 dark:text-slate-200 break-words">{data.role}</p>
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-400 uppercase">Account Status</span>
                <p className="text-sm font-bold mt-0.5 break-words">
                  {data.is_banned ? (
                    <span className="text-red-600 dark:text-red-400">🚫 Banned ({data.ban_reason || 'No reason'})</span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">✅ Active</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-sm transition-colors"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
