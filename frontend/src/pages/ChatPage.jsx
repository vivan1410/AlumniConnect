import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send,
  MessageSquare,
  Building2,
  BookOpen,
  ShieldCheck,
  Check,
  Clock,
  UserCheck,
  Search,
  RefreshCw,
  AlertCircle,
  GraduationCap,
} from 'lucide-react';
import api from '../services/api';
import './ChatPage.css';

/**
 * Safely parse date and format for display.
 * Returns empty string on invalid/missing dates instead of "Invalid Date".
 */
function formatMessageTime(rawDate, options = { hour: '2-digit', minute: '2-digit' }) {
  if (!rawDate) return '';
  try {
    // If rawDate is an object with year, month, day, etc. (e.g. from an old or raw Neo4j object)
    if (typeof rawDate === 'object' && rawDate !== null && !(rawDate instanceof Date)) {
      const year = rawDate.year?.low ?? rawDate.year;
      const month = rawDate.month?.low ?? rawDate.month;
      const day = rawDate.day?.low ?? rawDate.day;
      const hour = rawDate.hour?.low ?? rawDate.hour ?? 0;
      const minute = rawDate.minute?.low ?? rawDate.minute ?? 0;
      const second = rawDate.second?.low ?? rawDate.second ?? 0;
      if (year && month && day) {
        const d = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
        if (!isNaN(d.getTime())) {
          return d.toLocaleTimeString([], options);
        }
      }
    }
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) {
      return '';
    }
    return d.toLocaleTimeString([], options);
  } catch {
    return '';
  }
}

export default function ChatPage({
  currentUser,
  onNavigate,
  onOpenAuthModal,
  selectedConversationId,
  onSelectConversation,
}) {
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(selectedConversationId || null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const messagesEndRef = useRef(null);
  const prevMsgCountRef = useRef(0);

  // Sync external selectedConversationId prop
  useEffect(() => {
    if (selectedConversationId && selectedConversationId !== activeConvId) {
      setActiveConvId(selectedConversationId);
    }
  }, [selectedConversationId]);

  // Load conversations list
  const loadConversations = useCallback(async (silent = false) => {
    if (!currentUser) {
      setIsLoadingConversations(false);
      return;
    }

    if (!silent) setIsLoadingConversations(true);

    try {
      const res = await api.getConversations();
      if (res.ok && res.data.success) {
        const convList = res.data.data || [];
        setConversations(convList);

        // Auto-select first conversation if none selected
        if (!activeConvId && convList.length > 0) {
          const firstId = convList[0].id;
          setActiveConvId(firstId);
          if (onSelectConversation) onSelectConversation(firstId);
        }
      }
    } catch (err) {
      console.warn('Error loading conversations:', err);
    } finally {
      if (!silent) setIsLoadingConversations(false);
    }
  }, [currentUser, activeConvId, onSelectConversation]);

  // Load messages for the active conversation
  const loadMessages = useCallback(
    async (convId, silent = false) => {
      if (!convId || !currentUser) return;
      if (!silent) setIsLoadingMessages(true);
      setChatError(null);

      try {
        const res = await api.getMessages(convId);
        if (res.ok && res.data.success) {
          const rawMessages = res.data.data || [];

          // Deduplicate incoming messages by unique message id
          const seenIds = new Set();
          const deduplicated = [];
          for (const m of rawMessages) {
            if (m && m.id) {
              if (!seenIds.has(m.id)) {
                seenIds.add(m.id);
                deduplicated.push(m);
              }
            } else if (m) {
              deduplicated.push(m);
            }
          }

          setMessages((prev) => {
            if (
              prev.length === deduplicated.length &&
              prev.every((msg, idx) => msg.id === deduplicated[idx]?.id && msg.read === deduplicated[idx]?.read)
            ) {
              return prev;
            }
            return deduplicated;
          });

          // Scroll to bottom if message count changed
          if (deduplicated.length !== prevMsgCountRef.current) {
            prevMsgCountRef.current = deduplicated.length;
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: silent ? 'auto' : 'smooth' });
            }, 100);
          }
        } else {
          setChatError(res.data?.error || 'Failed to retrieve messages.');
        }
      } catch (err) {
        setChatError(err.message || 'Error communicating with server.');
      } finally {
        if (!silent) setIsLoadingMessages(false);
      }
    },
    [currentUser]
  );

  // Initial load
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // When active conversation changes, load its messages
  useEffect(() => {
    if (activeConvId) {
      prevMsgCountRef.current = 0;
      loadMessages(activeConvId, false);
    } else {
      setMessages([]);
    }
  }, [activeConvId, loadMessages]);

  // Polling for conversation list (every 15 seconds)
  useEffect(() => {
    const listInterval = setInterval(() => {
      loadConversations(true);
    }, 15000);
    return () => clearInterval(listInterval);
  }, [loadConversations]);

  // Polling for active conversation messages (every 4 seconds)
  useEffect(() => {
    if (!activeConvId) return;

    const msgInterval = setInterval(() => {
      loadMessages(activeConvId, true);
    }, 4000);

    return () => clearInterval(msgInterval);
  }, [activeConvId, loadMessages]);

  const handleSelectConv = (id) => {
    setActiveConvId(id);
    if (onSelectConversation) onSelectConversation(id);
    setChatError(null);
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const text = inputText.trim();
    if (!text || !activeConvId || isSending) return;

    setIsSending(true);
    setChatError(null);

    try {
      const res = await api.sendMessage(activeConvId, text);
      if (res.ok && res.data.success) {
        setInputText('');
        const sentMsg = res.data.data;
        if (sentMsg) {
          // Immediately append sent message locally if not already present
          setMessages((prev) => {
            if (sentMsg.id && prev.some((m) => m.id === sentMsg.id)) {
              return prev;
            }
            return [...prev, sentMsg];
          });
          prevMsgCountRef.current += 1;
        }

        // Scroll to bottom
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);

        // Refresh conversation preview
        loadConversations(true);
      } else {
        setChatError(res.data?.error || 'Failed to send message.');
      }
    } catch (err) {
      setChatError(err.message || 'Connection error while sending message.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Filter conversations by search term
  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = c.partner?.name?.toLowerCase().includes(q);
    const companyMatch = c.partner?.company?.toLowerCase().includes(q);
    const deptMatch = c.partner?.department?.toLowerCase().includes(q);
    return nameMatch || companyMatch || deptMatch;
  });

  const activeConv = conversations.find((c) => c.id === activeConvId);

  return (
    <div className="chat-page">
      {/* Top Banner */}
      <section className="chat-header-banner">
        <div className="container-wide">
          <div className="chat-banner-row">
            <div>
              <div className="badge-pill-chat">
                <ShieldCheck size={14} />
                <span>Encrypted Direct Messaging</span>
              </div>
              <h1 className="chat-page-title">Mentorship Messages</h1>
              <p className="chat-page-subtitle">
                Private, one-on-one communication between accepted mentors and mentees.
              </p>
            </div>
            <div className="chat-polling-status">
              <span className="live-dot" />
              <span>Polling Neo4j every 4s</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <div className="container-wide chat-content-wrap">
        {!currentUser ? (
          <div className="chat-empty-panel">
            <UserCheck size={48} className="empty-icon" />
            <h3>Sign In to Access Private Messages</h3>
            <p>You need to be logged into your campus account to view your mentorship conversations.</p>
            <button className="btn btn-primary" onClick={() => onOpenAuthModal('login')}>
              Log In to Continue
            </button>
          </div>
        ) : (
          <div className="chat-card-container">
            {/* Left Sidebar: Conversations List */}
            <aside className="chat-sidebar">
              <div className="sidebar-header">
                <h3 className="sidebar-title">Conversations</h3>
                <span className="conv-count-badge">{conversations.length}</span>
              </div>

              {/* Search filter */}
              <div className="conv-search-box">
                <Search size={15} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Conversation items */}
              <div className="conversations-list">
                {isLoadingConversations && conversations.length === 0 ? (
                  <div className="sidebar-loading">
                    <RefreshCw size={18} className="spin-icon" />
                    <span>Loading conversations...</span>
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="sidebar-empty">
                    <MessageSquare size={32} className="empty-icon" />
                    <p>No active conversations yet.</p>
                    <span className="sidebar-empty-sub">
                      Conversations are unlocked once an alumni accepts a mentorship request.
                    </span>
                  </div>
                ) : (
                  filteredConversations.map((conv) => {
                    const isSelected = conv.id === activeConvId;
                    const partner = conv.partner || {};
                    const lastMsg = conv.lastMessage;
                    const hasUnread = conv.unreadCount > 0;

                    return (
                      <div
                        key={conv.id}
                        className={`conversation-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleSelectConv(conv.id)}
                      >
                        <div className="conv-avatar">
                          {partner.name ? partner.name[0].toUpperCase() : 'U'}
                        </div>
                        <div className="conv-details">
                          <div className="conv-top-line">
                            <h4 className="conv-partner-name">{partner.name || 'User'}</h4>
                            {formatMessageTime(lastMsg?.createdAt) && (
                              <span className="conv-time">
                                {formatMessageTime(lastMsg.createdAt)}
                              </span>
                            )}
                          </div>

                          <div className="conv-role-line">
                            <span className="partner-role-badge">
                              {partner.role || 'Member'}
                            </span>
                            <span className="partner-sub">
                              {partner.company || partner.department || ''}
                            </span>
                          </div>

                          <div className="conv-bottom-line">
                            <p className="conv-last-msg">
                              {lastMsg ? (
                                <>
                                  <span className="last-msg-sender">{lastMsg.senderName ? `${lastMsg.senderName.split(' ')[0]}: ` : ''}</span>
                                  {lastMsg.text}
                                </>
                              ) : (
                                <em>No messages yet</em>
                              )}
                            </p>
                            {hasUnread && (
                              <span className="conv-unread-pill">{conv.unreadCount}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </aside>

            {/* Right Pane: Active Message Thread */}
            <section className="chat-thread-pane">
              {activeConv ? (
                <>
                  {/* Chat Thread Header */}
                  <div className="thread-header">
                    <div className="thread-partner-profile">
                      <div className="thread-avatar">
                        {activeConv.partner?.name ? activeConv.partner.name[0].toUpperCase() : 'U'}
                      </div>
                      <div>
                        <div className="thread-title-row">
                          <h3 className="thread-partner-name">{activeConv.partner?.name}</h3>
                          <span className="thread-role-badge">
                            {activeConv.partner?.role || 'Member'}
                          </span>
                        </div>
                        <div className="thread-sub-info">
                          {activeConv.partner?.company ? (
                            <span className="meta-item">
                              <Building2 size={13} />
                              {activeConv.partner.company}
                            </span>
                          ) : null}
                          {activeConv.partner?.department ? (
                            <span className="meta-item">
                              <BookOpen size={13} />
                              {activeConv.partner.department}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="thread-verified-indicator">
                      <ShieldCheck size={14} />
                      <span>Verified Mentorship Channel</span>
                    </div>
                  </div>

                  {/* Messages Feed */}
                  <div className="thread-messages-body">
                    {chatError && (
                      <div className="chat-error-banner">
                        <AlertCircle size={16} />
                        <span>{chatError}</span>
                      </div>
                    )}

                    {isLoadingMessages && messages.length === 0 ? (
                      <div className="thread-loading">
                        <RefreshCw size={20} className="spin-icon" />
                        <span>Loading message history from Neo4j...</span>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="thread-empty-feed">
                        <MessageSquare size={36} className="empty-icon" />
                        <h4>Start your mentorship conversation</h4>
                        <p>
                          Say hello to {activeConv.partner?.name}! Messages in this conversation are privately stored in Neo4j and accessible anytime.
                        </p>
                      </div>
                    ) : (
                      messages.map((m) => {
                        const isSelf = m.isSelf;
                        const timeStr = formatMessageTime(m.createdAt);

                        return (
                          <div
                            key={m.id}
                            className={`message-bubble-row ${isSelf ? 'self-row' : 'partner-row'}`}
                          >
                            <div className={`message-bubble ${isSelf ? 'bubble-self' : 'bubble-partner'}`}>
                              {!isSelf && (
                                <span className="bubble-sender-name">{m.senderName}</span>
                              )}
                              <p className="bubble-text">{m.text}</p>
                              {timeStr && <span className="bubble-time">{timeStr}</span>}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input Footer */}
                  <form className="thread-input-footer" onSubmit={handleSendMessage}>
                    <textarea
                      rows={1}
                      className="chat-textarea"
                      placeholder={`Message ${activeConv.partner?.name || 'mentor'}... (Press Enter to send)`}
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      maxLength={2000}
                      disabled={isSending}
                    />
                    <button
                      type="submit"
                      className="btn-send-message"
                      disabled={!inputText.trim() || isSending}
                      title="Send message"
                    >
                      <Send size={16} />
                    </button>
                  </form>
                </>
              ) : (
                <div className="thread-no-selection">
                  <MessageSquare size={48} className="empty-icon" />
                  <h3>No Conversation Selected</h3>
                  <p>Choose an active mentorship contact from the list on the left to read and send messages.</p>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
