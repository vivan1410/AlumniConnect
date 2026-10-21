import React, { useState, useEffect } from 'react';
import {
  Search,
  Building2,
  Calendar,
  BookOpen,
  Users,
  ExternalLink,
  RotateCcw,
  AlertCircle,
  Database,
  ArrowUpDown,
  GraduationCap
} from 'lucide-react';
import api from '../services/api';
import './ExploreAlumniPage.css';

export default function ExploreAlumniPage({
  initialFilters = {},
  onSelectAlumni,
  onOpenDbModal,
  isDbConnected,
}) {
  const [alumni, setAlumni] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState(initialFilters.q || '');
  const [selectedDept, setSelectedDept] = useState(initialFilters.department || 'all');
  const [selectedCompany, setSelectedCompany] = useState(initialFilters.company || 'all');
  const [selectedYear, setSelectedYear] = useState(initialFilters.graduationYear ? String(initialFilters.graduationYear) : 'all');
  const [sortBy, setSortBy] = useState('name-asc');

  // Synchronize internal filter state when initialFilters prop updates
  useEffect(() => {
    if (initialFilters.q !== undefined) setSearchQuery(initialFilters.q);
    if (initialFilters.department !== undefined) setSelectedDept(initialFilters.department);
    if (initialFilters.company !== undefined) setSelectedCompany(initialFilters.company);
    if (initialFilters.graduationYear !== undefined) setSelectedYear(String(initialFilters.graduationYear));
  }, [initialFilters]);

  // Filter option lists
  const [departments, setDepartments] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [years, setYears] = useState([]);

  // Fetch alumni whenever filters change
  const fetchAlumniData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.getAlumni({
        q: searchQuery,
        department: selectedDept,
        company: selectedCompany,
        graduationYear: selectedYear,
      });

      if (response.ok && response.data.success) {
        setAlumni(response.data.data || []);
      } else {
        const errorMsg = response.data?.details || response.data?.error || 'Could not fetch alumni';
        setError(errorMsg);
      }
    } catch (err) {
      setError(err.message || 'Failed to connect to backend API');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch filter metadata (stats) once
  useEffect(() => {
    async function loadStats() {
      try {
        const statsRes = await api.getStats();
        if (statsRes.ok && statsRes.data.success) {
          const data = statsRes.data.data;
          if (data.departments) setDepartments(data.departments);
          if (data.graduationYears) setYears(data.graduationYears);
        }

        const compRes = await api.getCompanies();
        if (compRes.ok && compRes.data.success) {
          const compNames = compRes.data.data.map((c) => c.name);
          setCompanies(compNames);
        }
      } catch (e) {
        console.warn('Could not load filter metadata:', e);
      }
    }
    loadStats();
  }, []);

  // Trigger search on filter changes with slight debounce on search text
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAlumniData();
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedDept, selectedCompany, selectedYear]);

  // Apply in-memory sorting
  const sortedAlumni = [...alumni].sort((a, b) => {
    if (sortBy === 'name-asc') return (a.name || '').localeCompare(b.name || '');
    if (sortBy === 'name-desc') return (b.name || '').localeCompare(a.name || '');
    if (sortBy === 'year-desc') return (b.graduationYear || 0) - (a.graduationYear || 0);
    if (sortBy === 'year-asc') return (a.graduationYear || 0) - (b.graduationYear || 0);
    return 0;
  });

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedDept('all');
    setSelectedCompany('all');
    setSelectedYear('all');
    setSortBy('name-asc');
  };

  const hasActiveFilters =
    searchQuery || selectedDept !== 'all' || selectedCompany !== 'all' || selectedYear !== 'all';

  return (
    <div className="explore-page">
      {/* Header Banner */}
      <div className="explore-header-banner">
        <div className="container">
          <div className="badge badge-teal">Alumni Directory</div>
          <h1 className="explore-page-title">Explore Campus Alumni</h1>
          <p className="explore-page-subtitle">
            Search and connect with graduates across technology and engineering fields, verified directly from Neo4j.
          </p>
        </div>
      </div>

      <div className="container explore-content-wrap">
        {/* Search & Filter Toolbar */}
        <div className="filter-toolbar-card">
          <div className="search-row">
            <div className="filter-search-box">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search alumni by name, company, or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
                  ×
                </button>
              )}
            </div>

            <div className="sort-box">
              <ArrowUpDown size={15} className="sort-icon" />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="name-asc">Sort: Name (A-Z)</option>
                <option value="name-desc">Sort: Name (Z-A)</option>
                <option value="year-desc">Sort: Grad Year (Newest)</option>
                <option value="year-asc">Sort: Grad Year (Oldest)</option>
              </select>
            </div>
          </div>

          <div className="filter-selectors-row">
            {/* Department Filter */}
            <div className="filter-field">
              <label>Department</label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
              >
                <option value="all">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
                {!departments.includes('CSE') && <option value="CSE">CSE</option>}
              </select>
            </div>

            {/* Company Filter */}
            <div className="filter-field">
              <label>Company</label>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
              >
                <option value="all">All Companies</option>
                {companies.map((comp) => (
                  <option key={comp} value={comp}>
                    {comp}
                  </option>
                ))}
                {!companies.includes('Google') && <option value="Google">Google</option>}
                {!companies.includes('Microsoft') && <option value="Microsoft">Microsoft</option>}
              </select>
            </div>

            {/* Graduation Year Filter */}
            <div className="filter-field">
              <label>Graduation Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                <option value="all">All Graduation Years</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    Class of {y}
                  </option>
                ))}
                {!years.includes(2022) && <option value="2022">Class of 2022</option>}
                {!years.includes(2023) && <option value="2023">Class of 2023</option>}
              </select>
            </div>

            {/* Reset Button */}
            {hasActiveFilters && (
              <button className="btn-reset-filters" onClick={handleResetFilters}>
                <RotateCcw size={14} />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Results Bar */}
        <div className="results-status-bar">
          <div className="results-count">
            {isLoading ? (
              <span>Querying Neo4j database...</span>
            ) : (
              <span>
                Found <strong>{sortedAlumni.length}</strong> verified alumni record
                {sortedAlumni.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          <div className="db-verification-tag">
            <Database size={13} />
            <span>Cypher query executed with parameters</span>
          </div>
        </div>

        {/* Database Error Banner */}
        {error && (
          <div className="explore-error-card">
            <div className="error-icon-box">
              <AlertCircle size={24} />
            </div>
            <div className="error-details">
              <h3>Neo4j Database Unavailable</h3>
              <p>{error}</p>
              <div className="error-actions">
                <button className="btn btn-primary btn-sm" onClick={fetchAlumniData}>
                  Retry Query
                </button>
                <button className="btn btn-secondary btn-sm" onClick={onOpenDbModal}>
                  Database Setup Guide
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="alumni-cards-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="alumni-profile-card skeleton-profile-card">
                <div className="skeleton-avatar" />
                <div className="skeleton-line" style={{ width: '60%', height: '22px' }} />
                <div className="skeleton-line" style={{ width: '40%', height: '16px' }} />
                <div className="skeleton-line" style={{ width: '80%', height: '14px' }} />
              </div>
            ))}
          </div>
        )}

        {/* Alumni Cards Grid */}
        {!isLoading && !error && sortedAlumni.length > 0 && (
          <div className="alumni-cards-grid">
            {sortedAlumni.map((al) => {
              const initials = al.name
                ? al.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                : 'AL';

              return (
                <div
                  key={al.id || al.name}
                  className="alumni-profile-card"
                  onClick={() => onSelectAlumni(al)}
                >
                  <div className="profile-card-top">
                    <div className="alumni-avatar">{initials}</div>
                    {al.company && (
                      <span className="company-badge">
                        <Building2 size={12} />
                        {al.company}
                      </span>
                    )}
                  </div>

                  <h3 className="card-alumni-name">{al.name}</h3>

                  <div className="card-specs">
                    <div className="spec-item">
                      <BookOpen size={14} className="spec-icon" />
                      <span>{al.department || 'Department not listed'}</span>
                    </div>
                    <div className="spec-item">
                      <Calendar size={14} className="spec-icon" />
                      <span>Graduated {al.graduationYear || '—'}</span>
                    </div>
                    {al.interestedStudentsCount > 0 && (
                      <div className="spec-item highlight">
                        <Users size={14} className="spec-icon" />
                        <span>
                          {al.interestedStudentsCount} student
                          {al.interestedStudentsCount > 1 ? 's' : ''} connected
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="card-action-bar">
                    <button
                      className="btn-view-details"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectAlumni(al);
                      }}
                    >
                      <span>View Full Profile</span>
                      <ExternalLink size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && sortedAlumni.length === 0 && (
          <div className="explore-empty-state">
            <div className="empty-icon-wrap">
              <GraduationCap size={44} />
            </div>
            <h3>No alumni matching your search</h3>
            <p>
              We couldn't find any alumni in your Neo4j database matching your search filters.
              Try clearing filters or searching for sample records like <strong>Arun Kumar</strong> or <strong>Google</strong>.
            </p>
            {hasActiveFilters && (
              <button className="btn btn-primary" onClick={handleResetFilters}>
                <RotateCcw size={16} />
                Clear All Filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
