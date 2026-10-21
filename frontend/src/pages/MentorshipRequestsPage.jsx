import React, { useState, useEffect, useCallback } from 'react';
import {
  Inbox,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Building2,
  BookOpen,
  RefreshCw,
  AlertCircle,
  UserCheck,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import api from '../services/api';
import './MentorshipRequestsPage.css';

export default function MentorshipRequestsPage({
  currentUser,
  onNavigate,
  onOpenAuthModal,
  onSelectConversation,
}) {
  const isAlumni = currentUser?.role === 'Alumni';
  const [activeSubTab, setActiveSubTab] = useState(isAlumni ? 'incoming' : 'sent');
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [error, setError] = useState(null);

  // Synchronize default tab if user role changes
  useEffect(() => {
    if (currentUser?.role === 'Alumni') {
      setActiveSubTab('incoming');
    } else if (currentUser?.role === 'Student') {
      setActiveSubTab('sent');
    }
  }, [currentUser?.role]);

  const loadRequests = useCallback(async (silent = false) => {
    if (!currentUser) {
      setIsLoading(false);
      return;
    }

    if (!silent) {
      setIsLoading(true);
      setError(null);
    } else {
      setIsRefreshing(true);
    }

    try {
      const [incRes, sentRes] = await Promise.all([
        api.getIncomingMentorshipRequests(),
        api.getSentMentorshipRequests(),
      ]);

      if (incRes.ok && incRes.data.success) {
        setIncomingRequests(incRes.data.data || []);
      }
      if (sentRes.ok && sentRes.data.success) {
        setSentRequests(sentRes.data.data || []);
      }
    } catch (err) {
      if (!silent) {
        setError(err.message || 'Failed to load mentorship requests.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadRequests();

    // Reliable background polling every 15 seconds
    const interval = setInterval(() => {
      loadRequests(true);
    }, 15000);

    return () => clearInterval(interval);
  }, [loadRequests]);

  const handleRespond = async (requestId, action) => {
    setActionLoadingId(requestId);
    setActionFeedback(null);

    try {
      const res = await api.respondMentorshipRequest(requestId, action);
      if (res.ok && res.data.success) {
        const updatedStatus = action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED';
        setActionFeedback({
          type: 'success',
          message: res.data.message || `Request ${updatedStatus.toLowerCase()} successfully.`,
        });

        // Update local list
        setIncomingRequests((prev) =>
          prev.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  status: updatedStatus,
                  conversationId: res.data.data?.conversationId || r.conversationId,
                }
              : r
          )
        );
      } else {
        setActionFeedback({
          type: 'error',
          message: res.data?.error || 'Failed to update request status.',
        });
      }
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: err.message || 'Connection error while processing response.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenChat = (conversationId) => {
    if (onSelectConversation) {
      onSelectConversation(conversationId);
    }
    if (onNavigate) {
      onNavigate('messages');
    }
  };

  const pendingIncomingCount = incomingRequests.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="mentorship-page">
      {/* Banner */}
      <section className="mentorship-header-banner">
        <div className="container-wide">
          <div className="mentorship-header-content">
            <div>
              <div className="badge-pill-mentorship">
                <ShieldCheck size={14} />
                <span>Verified Mentorship System</span>
              </div>
              <h1 className="mentorship-title">Mentorship Requests</h1>
              <p className="mentorship-subtitle">
                Manage your academic and career mentorship connections. All requests and private conversations are secured with verified campus credentials.
              </p>
            </div>

            <div className="mentorship-header-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm refresh-polling-btn"
                onClick={() => loadRequests(false)}
                disabled={isRefreshing || isLoading}
                title="Refresh requests from Neo4j"
              >
                <RefreshCw size={14} className={isRefreshing ? 'spin-icon' : ''} />
                <span>{isRefreshing ? 'Polling Neo4j...' : 'Refresh'}</span>
              </button>
            </div>
          </div>

          <div className="polling-notice-bar">
            <span className="live-dot" />
            <span>Live status updates active via polling every 15s.</span>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <div className="container-wide mentorship-content-wrap">
        {!currentUser ? (
          <div className="mentorship-empty-card">
            <UserCheck size={48} className="empty-icon" />
            <h3>Sign In to Access Mentorship</h3>
            <p>You need to be logged into your campus account to view your mentorship inbox or sent requests.</p>
            <button className="btn btn-primary" onClick={() => onOpenAuthModal('login')}>
              Log In to Continue
            </button>
          </div>
        ) : (
          <>
            {/* Feedback alert */}
            {actionFeedback && (
              <div
                className={`feedback-alert ${
                  actionFeedback.type === 'success' ? 'feedback-success' : 'feedback-error'
                }`}
              >
                {actionFeedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <span>{actionFeedback.message}</span>
              </div>
            )}

            {/* Sub-tabs */}
            <div className="mentorship-tabs-nav">
              <button
                type="button"
                className={`mentorship-tab-btn ${activeSubTab === 'incoming' ? 'active' : ''}`}
                onClick={() => setActiveSubTab('incoming')}
              >
                <Inbox size={17} />
                <span>Incoming Inbox</span>
                {pendingIncomingCount > 0 && (
                  <span className="count-badge-incoming">{pendingIncomingCount}</span>
                )}
              </button>
              <button
                type="button"
                className={`mentorship-tab-btn ${activeSubTab === 'sent' ? 'active' : ''}`}
                onClick={() => setActiveSubTab('sent')}
              >
                <Send size={17} />
                <span>Sent Requests</span>
                <span className="count-badge-neutral">{sentRequests.length}</span>
              </button>
            </div>

            {/* Error view */}
            {error && (
              <div className="feedback-alert feedback-error">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* Loading Skeleton */}
            {isLoading && (
              <div className="requests-loading-grid">
                {[1, 2].map((n) => (
                  <div key={n} className="request-card-skeleton">
                    <div className="skeleton-avatar" />
                    <div style={{ flex: 1 }}>
                      <div className="skeleton-line lg" />
                      <div className="skeleton-line md" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* INCOMING TAB */}
            {!isLoading && activeSubTab === 'incoming' && (
              <div className="requests-list">
                {incomingRequests.length === 0 ? (
                  <div className="mentorship-empty-card">
                    <Inbox size={42} className="empty-icon" />
                    <h3>No Incoming Mentorship Requests</h3>
                    <p>
                      {isAlumni
                        ? 'Students interested in your career guidance will submit requests here. You can accept or decline each request.'
                        : 'You have not received any mentorship requests. Mentorship requests are addressed to alumni mentors.'}
                    </p>
                  </div>
                ) : (
                  incomingRequests.map((req) => {
                    const isPending = req.status === 'PENDING';
                    const isAccepted = req.status === 'ACCEPTED';
                    const isDeclined = req.status === 'DECLINED';
                    const isProcessing = actionLoadingId === req.id;

                    return (
                      <div key={req.id} className={`request-card status-${req.status.toLowerCase()}`}>
                        <div className="request-card-header">
                          <div className="request-sender-profile">
                            <div className="request-avatar">
                              {req.sender?.name ? req.sender.name[0].toUpperCase() : 'S'}
                            </div>
                            <div className="request-sender-meta">
                              <h3 className="request-sender-name">{req.sender?.name || 'Student'}</h3>
                              <div className="request-sender-sub">
                                <BookOpen size={14} />
                                <span>
                                  {req.sender?.department || 'Department not specified'}
                                  {req.sender?.year ? ` • Year ${req.sender.year}` : ''}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="request-header-right">
                            <span className={`status-pill status-${req.status.toLowerCase()}`}>
                              {isPending && <Clock size={12} />}
                              {isAccepted && <CheckCircle2 size={12} />}
                              {isDeclined && <XCircle size={12} />}
                              <span>{req.status}</span>
                            </span>
                            <span className="request-date">
                              {req.createdAt ? new Date(req.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              }) : ''}
                            </span>
                          </div>
                        </div>

                        {/* Request Note */}
                        <div className="request-message-bubble">
                          <p className="request-message-text">{req.message}</p>
                        </div>

                        {/* Actions */}
                        <div className="request-card-actions">
                          {isPending && (
                            <>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleRespond(req.id, 'ACCEPT')}
                                disabled={isProcessing}
                              >
                                <CheckCircle2 size={15} />
                                <span>{isProcessing ? 'Accepting...' : 'Accept Mentorship'}</span>
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm btn-decline"
                                onClick={() => handleRespond(req.id, 'DECLINE')}
                                disabled={isProcessing}
                              >
                                <XCircle size={15} />
                                <span>{isProcessing ? 'Declining...' : 'Decline'}</span>
                              </button>
                            </>
                          )}

                          {isAccepted && (
                            <div className="accepted-action-box">
                              <span className="accepted-note">
                                Mentorship accepted! A private conversation channel is active.
                              </span>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleOpenChat(req.conversationId)}
                              >
                                <MessageSquare size={15} />
                                <span>Open Conversation</span>
                              </button>
                            </div>
                          )}

                          {isDeclined && (
                            <span className="declined-note">This mentorship request was declined.</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* SENT TAB */}
            {!isLoading && activeSubTab === 'sent' && (
              <div className="requests-list">
                {sentRequests.length === 0 ? (
                  <div className="mentorship-empty-card">
                    <Send size={42} className="empty-icon" />
                    <h3>No Sent Requests Yet</h3>
                    <p>
                      Explore the alumni directory and click "Reach Out for Mentorship" on any alumni's profile to request guidance.
                    </p>
                    <button className="btn btn-primary" onClick={() => onNavigate('alumni')}>
                      Explore Alumni Directory
                    </button>
                  </div>
                ) : (
                  sentRequests.map((req) => {
                    const isPending = req.status === 'PENDING';
                    const isAccepted = req.status === 'ACCEPTED';
                    const isDeclined = req.status === 'DECLINED';

                    return (
                      <div key={req.id} className={`request-card status-${req.status.toLowerCase()}`}>
                        <div className="request-card-header">
                          <div className="request-sender-profile">
                            <div className="request-avatar alumni-avatar-accent">
                              {req.recipient?.name ? req.recipient.name[0].toUpperCase() : 'A'}
                            </div>
                            <div className="request-sender-meta">
                              <h3 className="request-sender-name">{req.recipient?.name || 'Alumni Mentor'}</h3>
                              <div className="request-sender-sub">
                                <Building2 size={14} />
                                <span>
                                  {req.recipient?.company || 'Company not specified'}
                                  {req.recipient?.department ? ` • ${req.recipient.department}` : ''}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="request-header-right">
                            <span className={`status-pill status-${req.status.toLowerCase()}`}>
                              {isPending && <Clock size={12} />}
                              {isAccepted && <CheckCircle2 size={12} />}
                              {isDeclined && <XCircle size={12} />}
                              <span>{req.status}</span>
                            </span>
                            <span className="request-date">
                              {req.createdAt ? new Date(req.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              }) : ''}
                            </span>
                          </div>
                        </div>

                        {/* Message sent */}
                        <div className="request-message-bubble">
                          <span className="request-message-label">Your Note:</span>
                          <p className="request-message-text">{req.message}</p>
                        </div>

                        {/* Status feedback & chat action */}
                        <div className="request-card-actions">
                          {isAccepted && (
                            <div className="accepted-action-box">
                              <span className="accepted-note">
                                {req.recipient?.name} accepted your request! Start your conversation now.
                              </span>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleOpenChat(req.conversationId)}
                              >
                                <MessageSquare size={15} />
                                <span>Open Conversation</span>
                              </button>
                            </div>
                          )}

                          {isPending && (
                            <div className="pending-status-text">
                              <Clock size={14} />
                              <span>Awaiting response from {req.recipient?.name}. You will be able to message them once accepted.</span>
                            </div>
                          )}

                          {isDeclined && (
                            <span className="declined-note">
                              {req.recipient?.name} was unable to accept this request. You can reach out to other alumni in your field.
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
