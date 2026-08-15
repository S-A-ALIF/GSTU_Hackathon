import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { io } from 'socket.io-client';
import { toast } from 'sonner';
import ImageModal from '../components/ImageModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function ChatPage({ inDashboard = false, onBack }) {
  const { currentUser, unreadCounts, markTeamAsRead } = useAuth();
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [modalImage, setModalImage] = useState(null);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [socket, setSocket] = useState(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Initialize socket
  useEffect(() => {
    const newSocket = io(API_URL, {
      withCredentials: true,
    });
    setSocket(newSocket);

    return () => newSocket.close();
  }, []);

  // Fetch teams (mentors can have multiple, students have 1)
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        let data;
        if (currentUser?.role === 'mentor') {
          const res = await fetch(`${API_URL}/api/v1/mentors/teams`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const json = await res.json();
          if (json.success) data = json.data;
        } else {
          const res = await fetch(`${API_URL}/api/v1/teams/my-team`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const json = await res.json();
          if (json.success && json.data) data = [json.data];
          else data = [];
        }

        setTeams(data || []);
        if (data && data.length > 0) {
          setSelectedTeam(data[0]);
        }
      } catch (error) {
        console.error('Error fetching teams:', error);
      } finally {
        setLoadingTeams(false);
      }
    };
    if (currentUser) fetchTeams();
  }, [currentUser]);

  // Handle selected team changes
  useEffect(() => {
    if (!selectedTeam || !socket) return;

    setOffset(0);
    setHasMore(true);

    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/v1/chat/${selectedTeam.id}?limit=50&offset=0`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
          setMessages(json.data);
          setHasMore(json.data.length === 50);
          setTimeout(scrollToBottom, 100);
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();
    socket.emit('joinTeamChat', selectedTeam.id);
    
    // Mark this team as read immediately upon selection
    markTeamAsRead(selectedTeam.id);

    const handleNewMessage = (msg) => {
      setMessages((prev) => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setTimeout(scrollToBottom, 100);
      
      // If we are currently in this chat, mark it as read again
      if (msg.team_id === selectedTeam.id) {
         markTeamAsRead(selectedTeam.id);
      }
    };

    socket.on('newChatMessage', handleNewMessage);

    return () => {
      socket.emit('leaveTeamChat', selectedTeam.id);
      socket.off('newChatMessage', handleNewMessage);
    };
  }, [selectedTeam, socket]);

  const scrollToBottom = (behavior = 'auto') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const loadMoreMessages = async () => {
    if (!selectedTeam || isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    const nextOffset = offset + 50;
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/chat/${selectedTeam.id}?limit=50&offset=${nextOffset}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        if (json.data.length > 0) {
          const container = scrollContainerRef.current;
          const oldScrollHeight = container ? container.scrollHeight : 0;
          
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newMessages = json.data.filter(m => !existingIds.has(m.id));
            return [...newMessages, ...prev];
          });
          setOffset(nextOffset);
          setHasMore(json.data.length === 50);
          
          // Restore scroll position
          setTimeout(() => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight - oldScrollHeight;
            }
          }, 0);
        } else {
          setHasMore(false);
        }
      }
    } catch (error) {
      console.error('Error fetching more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    
    // Check if scrolled to the top to load more
    if (scrollTop === 0 && hasMore && !isLoadingMore) {
      loadMoreMessages();
    }
    
    if (scrollHeight - scrollTop - clientHeight > 100) {
      setShowScrollButton(true);
    } else {
      setShowScrollButton(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !imageFile) || !selectedTeam || isSending) return;

    const msgContent = newMessage.trim();
    const currentImage = imageFile;
    setNewMessage('');
    setImageFile(null);
    setIsSending(true);

    try {
      const token = localStorage.getItem('token');
      
      const formData = new FormData();
      if (msgContent) formData.append('message', msgContent);
      if (currentImage) formData.append('image', currentImage);

      const res = await fetch(`${API_URL}/api/v1/chat/${selectedTeam.id}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });
      
      const json = await res.json();
      if (!json.success) {
        toast.error(json.message || 'Failed to send message');
        setNewMessage(msgContent); // restore input
        if (currentImage) setImageFile(currentImage);
      } else {
        // Optimistically add to messages
        setMessages(prev => {
          if (prev.some(m => m.id === json.data.id)) return prev;
          return [...prev, json.data];
        });
        setTimeout(scrollToBottom, 100);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Network error while sending message');
      setNewMessage(msgContent); // restore input
      if (currentImage) setImageFile(currentImage);
    } finally {
      setIsSending(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      setImageFile(file);
    }
  };

  const containerClass = inDashboard 
    ? "flex h-full w-full bg-slate-50 dark:bg-slate-900 overflow-hidden" 
    : "flex h-[calc(100vh-64px)] bg-slate-50 dark:bg-slate-900 overflow-hidden pt-4 pb-4 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto";

  const wrapperClass = inDashboard
    ? "flex w-full h-full bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden border border-slate-200 dark:border-slate-700"
    : "flex w-full bg-white dark:bg-slate-800 rounded-3xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700";

  if (loadingTeams) {
    return (
      <div className={containerClass}>
        <div className="m-auto animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className={`${containerClass} flex-col items-center justify-center px-4`}>
        <div className="text-6xl mb-4">💬</div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 text-center">No Chat Available</h2>
        <p className="text-slate-500 text-center max-w-md">
          {currentUser?.role === 'mentor' 
            ? "You haven't been assigned to any teams yet. Check your mentor dashboard for invitations."
            : "You need to join or create a team to unlock the chat feature."}
        </p>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <div className={wrapperClass}>
        
        {/* Sidebar */}
        <div className={`w-80 border-r border-slate-200 dark:border-slate-700 flex flex-col ${currentUser?.role !== 'mentor' ? 'hidden' : 'hidden sm:flex'}`}>
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Messages</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {teams.map((team) => {
              const unread = unreadCounts?.teams?.[team.id] || 0;
              return (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  className={`w-full text-left p-3 sm:p-4 rounded-xl sm:rounded-2xl transition-all flex items-center justify-between group ${
                    selectedTeam?.id === team.id 
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 shadow-sm' 
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                  } border`}
                >
                  <div className="flex items-center gap-3 truncate min-w-0">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 font-bold text-base sm:text-lg transition-colors ${
                      selectedTeam?.id === team.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                    }`}>
                      {team.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate min-w-0 pr-2">
                      <h3 className={`font-bold truncate text-sm sm:text-base ${
                        selectedTeam?.id === team.id 
                          ? 'text-blue-900 dark:text-blue-100' 
                          : 'text-slate-700 dark:text-slate-300'
                      }`}>
                        {team.name}
                      </h3>
                      <p className="text-[10px] sm:text-xs text-slate-500 truncate mt-0.5">
                        Created {new Date(team.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {unread > 0 && (
                    <div className="bg-red-500 text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full shrink-0">
                      {unread > 99 ? '99+' : unread}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {selectedTeam ? (
            <>
              {/* Chat Header */}
              <div className="p-3 sm:p-6 border-b border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  {onBack && (
                    <button 
                      onClick={onBack}
                      className="sm:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                      </svg>
                    </button>
                  )}
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm shrink-0">
                    {selectedTeam.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white leading-tight truncate">
                      {selectedTeam.name}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      Team Chat Room
                    </p>
                  </div>
                </div>
                
                {/* Mobile Team Switcher (only if multiple teams) */}
                {(teams.length > 1 || currentUser?.role === 'mentor') && (
                  <select 
                    className="sm:hidden bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs sm:text-sm px-2 py-1.5 outline-none max-w-[140px] truncate"
                    value={selectedTeam.id}
                    onChange={(e) => setSelectedTeam(teams.find(t => t.id === e.target.value))}
                  >
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Chat Messages Wrapper */}
              <div className="flex-1 relative overflow-hidden flex flex-col">
                <div 
                  ref={scrollContainerRef}
                  className="flex-1 overflow-y-auto chat-scrollbar p-3 sm:p-6 space-y-4 sm:space-y-6 bg-slate-50 dark:bg-slate-900/50"
                  onScroll={handleScroll}
                >
                {isLoadingMore && (
                  <div className="flex justify-center py-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                )}
                {loadingMessages ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500">
                    <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                      <span className="text-2xl">👋</span>
                    </div>
                    <p>No messages yet.</p>
                    <p className="text-sm">Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isMe = msg.sender_id === currentUser?.id;
                    const isMentor = msg.sender_role === 'mentor';
                    
                    return (
                      <div key={msg.id} className={`flex gap-3 sm:gap-4 max-w-[85%] sm:max-w-[75%] ${isMe ? 'ml-auto flex-row-reverse' : ''}`}>
                        {/* Avatar */}
                        {!isMe && (
                          <div className="flex-shrink-0">
                            {msg.sender_avatar ? (
                              <img 
                                src={msg.sender_avatar} 
                                alt={msg.sender_name} 
                                loading="lazy"
                                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover shadow-sm ring-2 ring-white dark:ring-slate-800 cursor-pointer hover:opacity-80 transition-opacity" 
                                onClick={() => setModalImage(msg.sender_avatar)}
                              />
                            ) : (
                              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold shadow-sm ring-2 ring-white dark:ring-slate-800 ${isMentor ? 'bg-purple-600' : 'bg-slate-400 dark:bg-slate-600'}`}>
                                {msg.sender_name ? msg.sender_name.charAt(0).toUpperCase() : '?'}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Message Bubble */}
                        <div className={`flex flex-col max-w-full ${isMe ? 'items-end' : 'items-start'}`}>
                          {!isMe && (
                            <div className="flex items-center gap-1.5 mb-1 pl-1">
                              <span className="text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[120px] sm:max-w-[200px]">
                                {msg.sender_name}
                              </span>
                              {isMentor && (
                                <span className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">
                                  Mentor
                                </span>
                              )}
                            </div>
                          )}
                          
                          <div className={`rounded-2xl shadow-sm text-[15px] leading-relaxed break-words whitespace-pre-wrap ${
                            !msg.message && msg.image_url 
                              ? 'p-0 bg-transparent border-none shadow-none'
                              : `px-4 sm:px-5 py-2.5 sm:py-3 ${
                                  isMe 
                                    ? 'bg-blue-600 text-white rounded-tr-sm' 
                                    : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-sm border border-slate-100 dark:border-slate-600'
                                }`
                          }`}>
                            {msg.image_url && (
                              <img 
                                src={msg.image_url} 
                                alt="Uploaded" 
                                loading="lazy"
                                className={`max-w-full rounded-xl max-h-60 object-contain cursor-pointer hover:opacity-90 transition-opacity ${msg.message ? 'mb-2' : ''}`} 
                                onClick={() => setModalImage(msg.image_url)}
                              />
                            )}
                            {msg.message}
                          </div>
                          
                          <span className="text-[11px] text-slate-400 mt-1 px-1">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
                </div>
                
                {/* Scroll to bottom button */}
                {showScrollButton && (
                  <button 
                    onClick={() => scrollToBottom('smooth')}
                    className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 bg-slate-800/80 dark:bg-slate-700/80 hover:bg-slate-900 dark:hover:bg-slate-600 text-white w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 z-10 backdrop-blur-sm border border-slate-600 dark:border-slate-500"
                    title="Scroll to latest message"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Chat Input */}
              <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
                {imageFile && (
                  <div className="max-w-4xl mx-auto mb-2 relative inline-block">
                    <img src={URL.createObjectURL(imageFile)} alt="Preview" className="h-20 rounded-xl border-2 border-blue-500 shadow-sm" />
                    <button 
                      onClick={() => setImageFile(null)}
                      className="absolute -top-2 -right-2 bg-slate-800 hover:bg-slate-900 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                )}
                <form onSubmit={handleSendMessage} className="flex gap-2 max-w-4xl mx-auto relative">
                  <input
                    type="file"
                    id="image-upload"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                    disabled={isSending}
                  />
                  <label 
                    htmlFor="image-upload"
                    className="shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-pointer transition-colors shadow-sm self-end"
                    title="Upload Image"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </label>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={isSending}
                    placeholder="Type a message..."
                    className="flex-1 bg-slate-100 dark:bg-slate-900 border-0 rounded-3xl px-6 py-3.5 sm:py-4 text-sm sm:text-base text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/50 pr-16 outline-none transition-all self-end"
                  />
                  <button
                    type="submit"
                    disabled={(!newMessage.trim() && !imageFile) || isSending}
                    className="absolute right-1.5 top-1/2 -translate-y-[50%] bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-full w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center transition-colors shadow-sm"
                  >
                    {isSending ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 sm:w-6 sm:h-6 translate-x-[-1px]">
                        <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
                      </svg>
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 bg-slate-50 dark:bg-slate-900/50">
              <span className="text-5xl mb-4">💬</span>
              <p className="text-lg font-medium">Select a team to start chatting</p>
            </div>
          )}
        </div>
        
      </div>
      <ImageModal imageUrl={modalImage} onClose={() => setModalImage(null)} />
    </div>
  );
}
