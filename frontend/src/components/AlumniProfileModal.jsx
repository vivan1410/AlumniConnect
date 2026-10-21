import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  Calendar,
  BookOpen,
  Users,
  Check,
  Send,
  Database,
  Briefcase,
  Share2,
  ExternalLink
} from 'lucide-react';
import api from '../services/api';
import './AlumniProfileModal.css';

export default function AlumniProfileModal({ alumniId, onClose, onSelectColleague, currentUser }) {
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [connectMessageSent, setConnectMessageSent] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [showConnectForm, setShowConnectForm] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [connectError, setConnectError] = useState(null);

  useEffect(() => {
    async function loadProfile() {
      if (!alumniId) return;
      setIsLoading(true);
      setError(null);

      try {
        const response = await api.getAlumniById(alumniId);
        if (response.ok && response.data.success) {
          setProfile(response.data.data);
        } else {
          setError(response.data?.error || 'Failed to load alumni profile');
        }
      } catch (err) {
        setError(err.message || 'Error communicating with server');
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [alumniId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      setConnectError('Please sign in to send a mentorship request.');
      return;
    }

    if (currentUser.role === 'Alumni') {
      setConnectError('Mentorship requests are submitted by students to alumni. You are signed in as an Alumni.');
      return;
    }

    if (!messageText.trim() || messageText.trim().length < 5) {
      setConnectError('Please enter a personalized note of at least 5 characters.');
      return;
    }

    setIsSending(true);
    setConnectError(null);

    try {
      // Ensure a valid token exists for the authenticated student
      const token = await api.ensureAuthToken(currentUser);

      const res = await api.sendMentorshipRequest(
        profile.id || alumniId,
        {
          message: messageText.trim(),
        },
        token
      );

      if (res.ok && res.data.success) {
        setConnectMessageSent(true);
        // Refresh profile from Neo4j to display the newly linked student node
        const updated = await api.getAlumniById(profile.id || alumniId);
        if (updated.ok && updated.data.success) {
          setProfile(updated.data.data);
        }
      } else {
        const errorMsg = res.data?.error || res.data?.message || 'Failed to submit mentorship request.';
        setConnectError(errorMsg);
      }
    } catch (err) {
      setConnectError(err.message || 'Connection error with database');
    } finally {
      setIsSending(false);
    }
  };

  const initials = profile?.name
    ? profile.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : 'AL';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-header-badge">
            <Database size={13} />
            <span>Neo4j Node Record</span>
          </div>
          <button className="btn-close-modal" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="modal-body modal-loading">
            <div className="skeleton-avatar lg" />
            <div className="skeleton-line lg" />
            <div className="skeleton-line md" />
            <p>Retrieving graph record from Neo4j...</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="modal-body modal-error">
            <h3>Profile Unavailable</h3>
            <p>{error}</p>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        )}

        {/* Loaded Profile */}
        {!isLoading && profile && (
          <div className="modal-body">
            {/* Top Profile Header */}
            <div className="profile-banner">
              <div className="profile-avatar-lg">{initials}</div>
              <div className="profile-main-meta">
                <h2 className="profile-full-name">{profile.name}</h2>
                <div className="profile-company-pill">
                  <Building2 size={15} />
                  <span>{profile.company || 'Company not specified'}</span>
                </div>
              </div>
            </div>

            {/* Verified Information Grid */}
            <div className="profile-info-grid">
              <div className="info-cell">
                <span className="info-label">Academic Department</span>
                <div className="info-val">
                  <BookOpen size={16} className="info-icon" />
                  <strong>{profile.department || 'Not recorded'}</strong>
                </div>
              </div>

              <div className="info-cell">
                <span className="info-label">Graduation Year</span>
                <div className="info-val">
                  <Calendar size={16} className="info-icon" />
                  <strong>
                    {profile.graduationYear ? `Class of ${profile.graduationYear}` : 'Not recorded'}
                  </strong>
                </div>
              </div>

              <div className="info-cell">
                <span className="info-label">Current Organization</span>
                <div className="info-val">
                  <Briefcase size={16} className="info-icon" />
                  <strong>{profile.company || 'Not recorded'}</strong>
                </div>
              </div>

              <div className="info-cell">
                <span className="info-label">Verified Identifier</span>
                <div className="info-val">
                  <Database size={16} className="info-icon" />
                  <span className="neo4j-id-tag">{profile.id}</span>
                </div>
              </div>
            </div>

            {/* Connected Colleagues at Same Company */}
            {profile.colleagues && profile.colleagues.length > 0 && (
              <div className="profile-section">
                <h4 className="section-heading">
                  <Building2 size={16} />
                  <span>Colleagues at {profile.company}</span>
                </h4>
                <div className="colleagues-list">
                  {profile.colleagues.map((peer) => (
                    <div
                      key={peer.id || peer.name}
                      className="colleague-item"
                      onClick={() => onSelectColleague(peer.id || peer.name)}
                    >
                      <div className="peer-avatar">
                        {peer.name[0]}
                      </div>
                      <div className="peer-meta">
                        <span className="peer-name">{peer.name}</span>
                        <span className="peer-dept">
                          {peer.department} • Class of {peer.graduationYear || '—'}
                        </span>
                      </div>
                      <ExternalLink size={14} className="peer-link" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Students Connected via INTERESTED_IN relationship */}
            {profile.interestedStudents && profile.interestedStudents.length > 0 && (
              <div className="profile-section">
                <h4 className="section-heading">
                  <Users size={16} />
                  <span>Interested Students (INTERESTED_IN)</span>
                </h4>
                <div className="students-tag-list">
                  {profile.interestedStudents.map((st) => (
                    <div key={st.id || st.name} className="student-badge">
                      <span className="student-dot" />
                      <strong>{st.name}</strong>
                      <span className="student-sub">
                        ({st.department || 'Student'}{st.year ? `, Year ${st.year}` : ''})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw Database Properties (Transparent Cypher Representation) */}
            <div className="profile-section raw-properties-section">
              <h4 className="section-heading">
                <Database size={15} />
                <span>Raw Database Properties (Neo4j Node)</span>
              </h4>
              <div className="raw-props-box">
                {Object.entries(profile.properties || {}).map(([key, val]) => (
                  <div key={key} className="prop-row">
                    <span className="prop-key">{key}:</span>
                    <span className="prop-val">{JSON.stringify(val)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Message / Connect Section */}
            {!showConnectForm && !connectMessageSent && (
              <div className="profile-action-buttons">
                <button
                  className="btn btn-primary"
                  onClick={() => setShowConnectForm(true)}
                >
                  <Send size={15} />
                  <span>Reach Out for Mentorship</span>
                </button>
                <button className="btn btn-secondary" onClick={handleCopy}>
                  {copied ? <Check size={15} /> : <Share2 size={15} />}
                  <span>{copied ? 'Link Copied!' : 'Share Profile'}</span>
                </button>
              </div>
            )}

            {showConnectForm && !connectMessageSent && (
              <form className="connect-form" onSubmit={handleSendMessage}>
                <h4 className="connect-form-title">Reach Out to {profile.name}</h4>
                <p className="connect-form-desc">
                  Submit a mentorship request. Your authenticated student identity will be linked to {profile.name} in Neo4j with status <code>PENDING</code>.
                </p>

                {currentUser ? (
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    marginBottom: '0.85rem',
                    fontSize: '0.82rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b', fontWeight: 600 }}>Sender (You)</span>
                      <span style={{
                        background: '#0d9488',
                        color: '#ffffff',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '9999px'
                      }}>
                        {currentUser.role || 'Student'}
                      </span>
                    </div>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>
                      {currentUser.name}
                    </div>
                    <div style={{ color: '#64748b' }}>
                      {currentUser.department || 'CSE'} • {currentUser.email || 'Campus Account'}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    marginBottom: '0.85rem',
                    color: '#991b1b',
                    fontSize: '0.85rem'
                  }}>
                    Please sign in with a student account to submit a mentorship request.
                  </div>
                )}

                <div style={{ marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: '4px' }}>
                    Your Message
                  </label>
                  <textarea
                    rows={4}
                    className="connect-textarea"
                    placeholder={`Hi ${profile.name}, I'm interested in your work at ${profile.company} and would love your guidance on...`}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    required
                    maxLength={2000}
                    disabled={!currentUser || currentUser.role === 'Alumni'}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                    {messageText.length}/2000 characters (min 5)
                  </div>
                </div>

                {connectError && (
                  <div style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    padding: '0.5rem 0.75rem',
                    color: '#b91c1c',
                    fontSize: '0.82rem',
                    marginBottom: '0.75rem'
                  }}>
                    {connectError}
                  </div>
                )}

                <div className="connect-form-actions">
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={isSending || !currentUser || currentUser.role === 'Alumni' || messageText.trim().length < 5}
                  >
                    {isSending ? 'Submitting to Neo4j...' : 'Send Mentorship Request'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setShowConnectForm(false);
                      setConnectError(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {connectMessageSent && (
              <div className="connect-success-banner">
                <Check size={18} className="check-success" />
                <div>
                  <strong>Mentorship request sent!</strong>
                  <div style={{ fontSize: '0.8rem', marginTop: '2px', opacity: 0.9 }}>
                    Your request has been recorded with status <code>PENDING</code>. You will be able to start a private conversation once {profile.name} accepts.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
