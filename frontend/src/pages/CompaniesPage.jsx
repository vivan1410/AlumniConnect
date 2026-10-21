import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from 'lucide-react';
import api from '../services/api';
import './CompaniesPage.css';

export default function CompaniesPage({ onSelectAlumni, onOpenDbModal }) {
  const [companies, setCompanies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCompanies, setExpandedCompanies] = useState({});

  useEffect(() => {
    async function loadCompanies() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await api.getCompanies();
        if (response.ok && response.data.success) {
          setCompanies(response.data.data || []);
          // Auto-expand first 2 companies for immediate engagement
          const initialExpanded = {};
          (response.data.data || []).slice(0, 2).forEach((c) => {
            initialExpanded[c.name] = true;
          });
          setExpandedCompanies(initialExpanded);
        } else {
          setError(response.data?.error || 'Failed to load companies from Neo4j');
        }
      } catch (err) {
        setError(err.message || 'Error communicating with backend');
      } finally {
        setIsLoading(false);
      }
    }

    loadCompanies();
  }, []);

  const toggleExpand = (companyName) => {
    setExpandedCompanies((prev) => ({
      ...prev,
      [companyName]: !prev[companyName],
    }));
  };

  const filteredCompanies = companies.filter((c) =>
    (c.name || '').toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div className="companies-page">
      {/* Header Banner */}
      <div className="companies-header-banner">
        <div className="container">
          <div className="badge badge-sage">Corporate Network</div>
          <h1 className="companies-page-title">Hiring Companies & Organizations</h1>
          <p className="companies-page-subtitle">
            Explore companies employing our alumni, backed by genuine Neo4j graph relationships.
          </p>
        </div>
      </div>

      <div className="container companies-content-wrap">
        {/* Search & Stats Bar */}
        <div className="companies-toolbar">
          <div className="company-search-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search companies (e.g. Google, Microsoft)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
                ×
              </button>
            )}
          </div>
          <div className="company-counter-badge">
            <Building2 size={14} />
            <span>
              {filteredCompanies.length} Compan{filteredCompanies.length === 1 ? 'y' : 'ies'} Found
            </span>
          </div>
        </div>

        {/* Database Error Banner */}
        {error && (
          <div className="companies-error-card">
            <AlertCircle size={22} className="error-icon" />
            <div>
              <h4>Could not retrieve companies</h4>
              <p>{error}</p>
              <button className="btn btn-primary btn-sm" onClick={onOpenDbModal}>
                Database Setup Guide
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="companies-list">
            {[1, 2, 3].map((i) => (
              <div key={i} className="company-accordion-card skeleton-card">
                <div className="skeleton-line lg" />
                <div className="skeleton-line md" />
              </div>
            ))}
          </div>
        )}

        {/* Companies Accordion List */}
        {!isLoading && !error && filteredCompanies.length > 0 && (
          <div className="companies-list">
            {filteredCompanies.map((comp) => {
              const isExpanded = !!expandedCompanies[comp.name];

              return (
                <div key={comp.name} className="company-accordion-card">
                  {/* Card Header */}
                  <div
                    className="company-accordion-header"
                    onClick={() => toggleExpand(comp.name)}
                  >
                    <div className="company-identity">
                      <div className="company-avatar-box">
                        <Building2 size={22} />
                      </div>
                      <div>
                        <h3 className="comp-title">{comp.name}</h3>
                        <div className="comp-submeta">
                          <span className="badge badge-teal">
                            <Users size={12} />
                            {comp.alumniCount} Verified Alumni
                          </span>
                          {comp.departments?.length > 0 && (
                            <span className="comp-dept-pills">
                              Departments: {comp.departments.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="accordion-action">
                      <span className="view-toggle-text">
                        {isExpanded ? 'Hide Alumni' : 'View Alumni'}
                      </span>
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>

                  {/* Expanded Alumni Roster */}
                  {isExpanded && (
                    <div className="company-accordion-body">
                      <div className="roster-header">
                        <h4>Alumni working at {comp.name}</h4>
                        <span className="roster-count">{comp.alumni?.length || 0} Listed</span>
                      </div>

                      {comp.alumni && comp.alumni.length > 0 ? (
                        <div className="alumni-roster-grid">
                          {comp.alumni.map((alum) => (
                            <div
                              key={alum.id || alum.name}
                              className="roster-item-card"
                              onClick={() => onSelectAlumni(alum)}
                            >
                              <div className="roster-avatar">
                                {alum.name[0]}
                              </div>
                              <div className="roster-info">
                                <span className="roster-name">{alum.name}</span>
                                <span className="roster-details">
                                  {alum.department || 'Department N/A'} • Class of{' '}
                                  {alum.graduationYear || '—'}
                                </span>
                              </div>
                              <button
                                className="btn-view-person"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectAlumni(alum);
                                }}
                                title="View Profile"
                              >
                                <ExternalLink size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="no-roster-msg">
                          No individual alumni details currently returned for this company.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredCompanies.length === 0 && (
          <div className="companies-empty-state">
            <Building2 size={44} className="empty-icon" />
            <h3>No companies match your search</h3>
            <p>Try searching for companies like <strong>Google</strong> or <strong>Microsoft</strong>.</p>
            {searchQuery && (
              <button className="btn btn-secondary btn-sm" onClick={() => setSearchQuery('')}>
                Clear Search
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
