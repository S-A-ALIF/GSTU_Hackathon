import React, { useState, useEffect, useRef } from 'react';
import { useAuth, socket } from '../contexts/AuthContext';
import { toast } from 'sonner';
import ImageModal from '../components/ImageModal';
import CustomScrollbar from '../components/CustomScrollbar';
import ConfirmModal from '../components/ConfirmModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const formatDateDivider = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  
  const dateMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffTime = nowMidnight.getTime() - dateMidnight.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));

  const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';

  if (diffDays < 7) {
    return dayName;
  } else {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    if (date.getFullYear() !== now.getFullYear()) {
      const yy = String(date.getFullYear()).slice(-2);
      return `${dayName}, ${dd}/${mm}/${yy}`;
    } else {
      return `${dayName}, ${dd}/${mm}`;
    }
  }
};

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
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [activeDropdownId, setActiveDropdownId] = useState(null);
  const [visibleMenuId, setVisibleMenuId] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const messagesEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const oldScrollHeightRef = useRef(0);


  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.msg-dropdown-menu') && activeDropdownId) {
        setActiveDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeDropdownId]);

  // Restore scroll position synchronously to prevent scrollbar drag jumping
  
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

    const handleMessageEdited = (editedMsg) => {
      setMessages(prev => prev.map(m => m.id === editedMsg.id ? editedMsg : m));
    };

    const handleMessageDeleted = ({ messageId }) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    };

    socket.on('newCommitteeMessage', handleNewMessage);
    socket.on('committeeMessageEdited', handleMessageEdited);
    socket.on('committeeMessageDeleted', handleMessageDeleted);

    return () => {
      socket.off('newCommitteeMessage', handleNewMessage);
      socket.off('committeeMessageEdited', handleMessageEdited);
      socket.off('committeeMessageDeleted', handleMessageDeleted);
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



  const startEditing = (msg) => {
    setEditingMessageId(msg.id);
    setNewMessage(msg.message);
    setActiveDropdownId(null);
    setImageFile(null);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setNewMessage('');
  };

  const promptDeleteMessage = (msgId) => {
    setActiveDropdownId(null);
    setMessageToDelete(msgId);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteMessage = async () => {
    if (!messageToDelete) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/v1/chat/committee/messages/${messageToDelete}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.message || 'Failed to delete message');
      } else {
        setMessages(prev => prev.filter(m => m.id !== messageToDelete));
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Network error while deleting message');
    } finally {
      setIsDeleteModalOpen(false);
      setMessageToDelete(null);
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

    if (editingMessageId) {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/v1/chat/committee/messages/${editingMessageId}`, {
          method: 'PUT',
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ message: msgContent })
        });
        const json = await res.json();
        if (!json.success) {
          toast.error(json.message || 'Failed to edit message');
          setNewMessage(msgContent);
        } else {
          setEditingMessageId(null);
          setMessages(prev => prev.map(m => m.id === editingMessageId ? json.data : m));
        }
      } catch (error) {
         console.error('Error editing message:', error);
         toast.error('Network error while editing message');
         setNewMessage(msgContent);
      } finally {
         setIsSending(false);
      }
      return;
    }

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
                  className="flex-1 overflow-y-auto hide-scrollbar p-3 sm:p-6 space-y-4 sm:space-y-6 bg-slate-50 dark:bg-slate-900/50"
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
                    
                    let showDateDivider = false;
                    if (idx === 0) {
                      showDateDivider = true;
                    } else {
                      const prevDate = new Date(messages[idx - 1].created_at);
                      const currDate = new Date(msg.created_at);
                      if (prevDate.toDateString() !== currDate.toDateString()) {
                        showDateDivider = true;
                      }
                    }
                    
                    return (
                      <React.Fragment key={msg.id}>
                        {showDateDivider && (
                          <div className="flex justify-center my-6">
                            <span className="text-[12px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800/50 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700/50">
                              {formatDateDivider(msg.created_at)}
                            </span>
                          </div>
                        )}
                        <div 
                          className={`group relative flex gap-2 sm:gap-3 items-start max-w-[85%] sm:max-w-[75%] ${isMe ? 'ml-auto flex-row-reverse' : ''}`}
                          onClick={() => { if (isMe && window.innerWidth < 768) setVisibleMenuId(visibleMenuId === msg.id ? null : msg.id); }}
                        >
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
                          
                          <div className={`relative flex items-center gap-2 sm:gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
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

                            {/* Dropdown Menu Trigger & Menu */}
                            {isMe && !editingMessageId && (
                              <div className={`relative items-center z-10 msg-dropdown-menu ${visibleMenuId === msg.id || activeDropdownId === msg.id || msg.image_url ? 'flex opacity-100' : 'hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity'}`}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setActiveDropdownId(activeDropdownId === msg.id ? null : msg.id); }}
                                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                    <path fillRule="evenodd" d="M10.5 6a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm0 6a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm0 6a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" clipRule="evenodd" />
                                  </svg>
                                </button>

                                {/* Dropdown Menu */}
                                {activeDropdownId === msg.id && (
                                  <div className="absolute top-8 left-0 w-32 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in zoom-in duration-100">
                                    {!msg.image_url && (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); startEditing(msg); }}
                                        className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" /></svg>
                                        Edit
                                      </button>
                                    )}
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); promptDeleteMessage(msg.id); }}
                                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-2"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" /></svg>
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1 mt-1 px-1">
                            <span className="text-[11px] text-slate-400">
                              {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {msg.is_edited && (
                              <span className="text-[10px] text-slate-400 font-medium italic">(edited)</span>
                            )}
                          </div>
                        </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
                </div>
                
                <CustomScrollbar scrollContainerRef={scrollContainerRef} />

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

              <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
                {editingMessageId && (
                  <div className="max-w-4xl mx-auto mb-2 flex items-center justify-between text-xs sm:text-sm text-slate-500 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-900/50">
                    <span className="flex items-center gap-1.5 font-medium text-blue-600 dark:text-blue-400">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" /></svg>
                      Editing message
                    </span>
                    <button onClick={cancelEditing} className="hover:text-slate-800 dark:hover:text-slate-200">Cancel</button>
                  </div>
                )}
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
                  {!editingMessageId && (
                    <>
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
                    </>
                  )}
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={isSending}
                    placeholder={editingMessageId ? "Edit your message..." : "Type a message..."}
                    className="flex-1 bg-slate-100 dark:bg-slate-900 border-0 rounded-3xl px-6 py-3.5 sm:py-4 text-sm sm:text-base text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500/50 pr-16 outline-none transition-all self-end"
                  />
                  <button
                    type="submit"
                    disabled={(!newMessage.trim() && !imageFile) || isSending}
                    className="absolute right-1.5 top-1/2 -translate-y-[50%] bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-full w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center transition-colors shadow-sm"
                  >
                    {isSending ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : editingMessageId ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                      </svg>
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
      <ConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setMessageToDelete(null);
        }}
        onConfirm={confirmDeleteMessage}
        title="Delete Message"
        message="Are you sure you want to delete this message? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
      <ImageModal imageUrl={modalImage} onClose={() => setModalImage(null)} />
    </div>
  );
}
