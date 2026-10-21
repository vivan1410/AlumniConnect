import React, { useState } from 'react';
import { Search, ArrowRight, Building2, Users, GraduationCap, Network, Sparkles } from 'lucide-react';
import './HeroSection.css';

export default function HeroSection({
  stats,
  onSearchSubmit,
  onExploreClick,
  onJoinClick,
  onQuickFilter,
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearchSubmit(searchQuery.trim());
    } else {
      onExploreClick();
    }
  };

  const quickChips = [
    { label: 'Google', filter: { company: 'Google' } },
    { label: 'Microsoft', filter: { company: 'Microsoft' } },
    { label: 'CSE Department', filter: { department: 'CSE' } },
    { label: 'Class of 2022', filter: { graduationYear: '2022' } },
    { label: 'Class of 2023', filter: { graduationYear: '2023' } },
  ];

  return (
    <section className="hero-section">
      <div className="container hero-container">
        {/* Editorial Pill */}
        <div className="hero-badge-wrap animate-fade-in">
          <div className="badge badge-teal">
            <Sparkles size={13} />
            <span>Campus Professional Network Powered by Neo4j Graph Intelligence</span>
          </div>
        </div>

        {/* Main Headline */}
        <h1 className="hero-title animate-fade-in">
          Your Campus Connections.<br />
          <span className="hero-title-accent">Your Future.</span>
        </h1>

        {/* Subtitle */}
        <p className="hero-subtitle animate-fade-in">
          AlumniConnect bridges students and graduates across premier tech companies and innovative industries. 
          Discover verified career paths, explore hiring companies, and unlock direct mentorship.
        </p>

        {/* Search Bar */}
        <div className="hero-search-card animate-fade-in">
          <form className="hero-search-form" onSubmit={handleSubmit}>
            <div className="hero-search-input-wrap">
              <Search size={20} className="search-icon" />
              <input
                type="text"
                className="hero-search-input"
                placeholder="Search alumni by name (e.g. Arun Kumar), company (e.g. Google), or department (e.g. CSE)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-search">
              Search Alumni
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Quick Filter Chips */}
          <div className="hero-quick-chips">
            <span className="quick-label">Suggested searches:</span>
            {quickChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                className="chip-btn"
                onClick={() => onQuickFilter(chip.filter)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Secondary Actions */}
        <div className="hero-actions-row">
          <button className="btn btn-primary btn-lg" onClick={onExploreClick}>
            Explore Alumni Directory
            <ArrowRight size={18} />
          </button>
          <button className="btn btn-secondary btn-lg" onClick={onJoinClick}>
            Join the Network
          </button>
        </div>

        {/* Metric Badges / Stats Bar */}
        <div className="hero-stats-grid">
          <div className="stat-card">
            <div className="stat-icon-wrap teal">
              <Users size={22} />
            </div>
            <div className="stat-info">
              <div className="stat-value">{stats?.totalAlumni || '—'}</div>
              <div className="stat-label">Verified Alumni</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrap sage">
              <Building2 size={22} />
            </div>
            <div className="stat-info">
              <div className="stat-value">{stats?.totalCompanies || '—'}</div>
              <div className="stat-label">Hiring Companies</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrap amber">
              <GraduationCap size={22} />
            </div>
            <div className="stat-info">
              <div className="stat-value">
                {stats?.departments?.length || 'CSE+'}
              </div>
              <div className="stat-label">Academic Departments</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrap teal">
              <Network size={22} />
            </div>
            <div className="stat-info">
              <div className="stat-value">Neo4j</div>
              <div className="stat-label">Graph-Mapped Relationships</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
