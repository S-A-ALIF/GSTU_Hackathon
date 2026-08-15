import React, { useState, useEffect, useRef } from 'react';
import { useAuth, socket } from '../contexts/AuthContext';
import { toast } from 'sonner';
import ImageModal from '../components/ImageModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function CommitteeChatPage({ inDashboard = false, onBack }) {
  const { currentUser, setUnreadCounts } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [modalImage, setModalImage] = useState(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // No teams to fetch, just one room

  // Handle chat load
  useEffect(() => {
    if (!socket || (currentUser?.role !== 'admin' && currentUser?.role !== 'mentor')) return;

    setOffset(0);
    setHasMore(true);

    const fetchMessages = async () => {
      setLoadingMessages(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/v1/chat/committee?limit=50&offset=0`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) {
          setMessages(json.data);
          setHasMore(json.data.length === 50);
          setTimeout(scrollToBottom, 100);
        }
      } catch (error) {
        console.error('Error fetching committee messages:', error);
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();
    
    // Mark committee chat as read
    const markAsRead = async () => {
        try {
            const token = localStorage.getItem('token');
            await fetch(`${API_URL}/api/v1/chat/committee/read`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setUnreadCounts(prev => ({ ...prev, committee: 0 }));
        } catch (error) {
            console.error('Error marking committee as read:', error);
        }
    };
    markAsRead();

    const handleNewMessage = (msg) => {
      setMessages((prev) => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setTimeout(scrollToBottom, 100);
      
      // Mark it as read immediately since we are in the chat
      markAsRead();
    };

    socket.on('newCommitteeMessage', handleNewMessage);

    return () => {
      socket.off('newCommitteeMessage', handleNewMessage);
    };
  }, [currentUser?.role, socket]);

  const scrollToBottom = (behavior = 'auto') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const loadMoreMessages = async () => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    const nextOffset = offset + 50;
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/chat/committee?limit=50&offset=${nextOffset}`, {
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
    if ((!newMessage.trim() && !imageFile) || isSending) return;

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

      const res = await fetch(`${API_URL}/api/v1/chat/committee`, {
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

  return (
    <div className={containerClass}>
      <div className={wrapperClass}>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
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
                  <div 
                    className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-xl flex items-center justify-center shadow-sm overflow-hidden p-1 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                    onClick={() => setModalImage('/image.png')}
                  >
                    <img src="/image.png" alt="Committee" className="w-full h-full object-contain" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white leading-tight truncate">
                      Event Committee
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-500">
                      Admins & Mentors Only
                    </p>
                  </div>
                </div>
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
                              {msg.sender_role === 'admin' && (
                                <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">
                                  Admin
                                </span>
                              )}
                            </div>
                          )}
                          
                          <div className={`rounded-2xl shadow-sm text-[15px] leading-relaxed break-words whitespace-pre-wrap ${
                            !msg.message && msg.image_url 
                              ? 'p-1 bg-transparent border-none shadow-none'
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
                                className={`max-w-full rounded-xl max-h-60 object-contain bg-black/10 cursor-pointer hover:opacity-90 transition-opacity ${msg.message ? 'mb-2' : ''}`} 
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
                    onChange={handleImageChange}
                    disabled={isSending}
                    className="hidden"
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
        </div>
        
      </div>
      <ImageModal imageUrl={modalImage} onClose={() => setModalImage(null)} />
    </div>
  );
}
