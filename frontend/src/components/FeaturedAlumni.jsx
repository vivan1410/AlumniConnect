import React from 'react';
import { ArrowRight, Building2, Calendar, BookOpen, Users, ExternalLink } from 'lucide-react';
import './FeaturedAlumni.css';

export default function FeaturedAlumni({
  alumniList = [],
  isLoading,
  onSelectAlumni,
  onViewAll,
  onOpenDbModal,
  isDbConnected,
}) {
  return (
    <section className="featured-section">
      <div className="container">
        <div className="section-header">
          <div>
            <div className="badge badge-teal">Verified Graduates</div>
            <h2 className="section-title">Featured Alumni</h2>
            <p className="section-subtitle">
              Explore standout alumni paving the way at top technology corporations.
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onViewAll}>
            Explore All Alumni Directory
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Shimmer Loading State */}
        {isLoading && (
          <div className="alumni-grid">
            {[1, 2, 3].map((n) => (
              <div key={n} className="alumni-card skeleton-card">
                <div className="skeleton-avatar" />
                <div className="skeleton-line title" />
                <div className="skeleton-line subtitle" />
                <div className="skeleton-line meta" />
              </div>
            ))}
          </div>
        )}

        {/* Real Alumni Grid */}
        {!isLoading && alumniList.length > 0 && (
          <div className="alumni-grid">
            {alumniList.slice(0, 6).map((alumni) => {
              const initials = alumni.name
                ? alumni.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                : 'AL';

              return (
                <div
                  key={alumni.id || alumni.name}
                  className="alumni-card"
                  onClick={() => onSelectAlumni(alumni)}
                >
                  <div className="card-top">
                    <div className="avatar-badge">
                      {initials}
                    </div>
                    {alumni.company && (
                      <div className="company-pill">
                        <Building2 size={13} />
                        <span>{alumni.company}</span>
                      </div>
                    )}
                  </div>

                  <h3 className="alumni-name">{alumni.name}</h3>

                  <div className="alumni-meta-list">
                    <div className="meta-item">
                      <BookOpen size={14} className="meta-icon" />
                      <span>{alumni.department || 'Department not specified'}</span>
                    </div>

                    <div className="meta-item">
                      <Calendar size={14} className="meta-icon" />
                      <span>Class of {alumni.graduationYear || '—'}</span>
                    </div>

                    {alumni.interestedStudentsCount > 0 && (
                      <div className="meta-item highlight">
                        <Users size={14} className="meta-icon" />
                        <span>{alumni.interestedStudentsCount} student{alumni.interestedStudentsCount > 1 ? 's' : ''} interested</span>
                      </div>
                    )}
                  </div>

                  <div className="card-footer">
                    <button
                      type="button"
                      className="btn-view-profile"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAlumni(alumni);
                      }}
                    >
                      <span>View Profile & Graph Path</span>
                      <ExternalLink size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Offline / Empty Fallback */}
        {!isLoading && alumniList.length === 0 && (
          <div className="empty-alumni-banner">
            <div className="empty-badge">Neo4j Database Sync Required</div>
            <h3>Waiting for Database Connection</h3>
            <p>
              Your local Neo4j database is currently disconnected or requires authentication password setup.
            </p>
            <button className="btn btn-primary" onClick={onOpenDbModal}>
              Configure Neo4j Connection
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
