import React, { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap,
  Database,
  Sparkles,
  UserCheck,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Users,
  MessageSquare,
  Inbox,
} from 'lucide-react';
import api from '../services/api';
import './Navbar.css';

export default function Navbar({
  activeTab,
  setActiveTab,
  dbStatus,
  onOpenDbModal,
  onOpenAuthModal,
  onRefreshDb,
  isRefreshingDb,
  currentUser,
  onLogout,
}) {
  const [unreadCounts, setUnreadCounts] = useState({ pendingRequests: 0, unreadMessages: 0 });

  const fetchUnreadCounts = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await api.getMentorshipUnreadCount();
      if (res.ok && res.data.success) {
        setUnreadCounts(res.data.data || { pendingRequests: 0, unreadMessages: 0 });
      }
    } catch {
      // Ignore background polling failure
    }
  }, [currentUser]);

  useEffect(() => {
    fetchUnreadCounts();
    // Poll every 15 seconds for unread mentorship requests and new messages
    const timer = setInterval(fetchUnreadCounts, 15000);
    return () => clearInterval(timer);
  }, [fetchUnreadCounts]);

  return (
    <header className="navbar-header">
      <div className="container-wide navbar-inner">
        {/* Brand / Logo */}
        <div className="navbar-brand" onClick={() => setActiveTab('home')}>
          <div className="brand-logo-icon">
            <GraduationCap size={22} className="brand-cap-icon" />
            <span className="brand-node-dot" />
          </div>
          <div className="brand-text-block">
            <span className="brand-title">AlumniConnect</span>
            <span className="brand-subtitle">Campus Network</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="navbar-nav">
          <button
            className={`nav-link ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            Home
          </button>
          <button
            className={`nav-link ${activeTab === 'alumni' ? 'active' : ''}`}
            onClick={() => setActiveTab('alumni')}
          >
            Explore Alumni
          </button>
          <button
            className={`nav-link ${activeTab === 'companies' ? 'active' : ''}`}
            onClick={() => setActiveTab('companies')}
          >
            Companies
          </button>
          <button
            className={`nav-link ${activeTab === 'graph' ? 'active' : ''}`}
            onClick={() => setActiveTab('graph')}
          >
            <Sparkles size={14} className="graph-sparkle-icon" />
            Network Graph
          </button>

          {/* Mentorship & Messages (Active for authenticated users) */}
          {currentUser && (
            <>
              <button
                className={`nav-link ${activeTab === 'mentorship' ? 'active' : ''}`}
                onClick={() => setActiveTab('mentorship')}
                title="Mentorship Requests (Incoming & Sent)"
              >
                <Users size={14} />
                <span>Mentorship</span>
                {unreadCounts.pendingRequests > 0 && (
                  <span className="nav-badge-pill incoming" title={`${unreadCounts.pendingRequests} pending requests`}>
                    {unreadCounts.pendingRequests}
                  </span>
                )}
              </button>
              <button
                className={`nav-link ${activeTab === 'messages' ? 'active' : ''}`}
                onClick={() => setActiveTab('messages')}
                title="Direct Mentorship Messages"
              >
                <MessageSquare size={14} />
                <span>Messages</span>
                {unreadCounts.unreadMessages > 0 && (
                  <span className="nav-badge-pill unread" title={`${unreadCounts.unreadMessages} unread messages`}>
                    {unreadCounts.unreadMessages}
                  </span>
                )}
              </button>
            </>
          )}

          <button
            className={`nav-link ${activeTab === 'about' ? 'active' : ''}`}
            onClick={() => setActiveTab('about')}
          >
            About
          </button>
        </nav>

        {/* Database Status & Actions */}
        <div className="navbar-actions">
          {/* Neo4j Status Pill */}
          <button
            className={`db-status-pill ${dbStatus?.connected ? 'connected' : 'disconnected'}`}
            onClick={onOpenDbModal}
            title={dbStatus?.connected ? 'Neo4j Database Connected' : 'Neo4j Connection Setup Required'}
          >
            <span className="status-indicator-dot" />
            <Database size={14} />
            <span className="status-label">
              {dbStatus?.connected ? 'Neo4j Live' : 'Neo4j Setup'}
            </span>
          </button>

          {/* User Session or Auth Buttons */}
          {currentUser ? (
            <div className="navbar-user-chip">
              <div className="user-avatar-dot" title={`Signed in as ${currentUser.name}`}>
                {currentUser.name ? currentUser.name[0].toUpperCase() : 'U'}
              </div>
              <div className="user-text-info">
                <span className="user-display-name">{currentUser.name}</span>
                <span className="user-role-badge">{currentUser.role || 'Member'}</span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm btn-logout"
                onClick={onLogout}
                title="Sign out of campus network"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <>
              <button
                className={`btn btn-secondary btn-sm ${activeTab === 'login' ? 'active-auth' : ''}`}
                onClick={() => onOpenAuthModal('login')}
              >
                Log In
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onOpenAuthModal('signup')}
              >
                Join Network
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
