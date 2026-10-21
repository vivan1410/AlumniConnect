import React from 'react';
import { Building2, Users, ArrowRight, Briefcase } from 'lucide-react';
import './CompanyShowcase.css';

export default function CompanyShowcase({
  companies = [],
  isLoading,
  onSelectCompany,
  onViewAllCompanies,
}) {
  return (
    <section className="company-showcase-section">
      <div className="container">
        <div className="section-header">
          <div>
            <div className="badge badge-sage">Industry Partners</div>
            <h2 className="section-title">Where Alumni Lead</h2>
            <p className="section-subtitle">
              Graduates of our programs are innovating at global tech leaders and fast-growing organizations.
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onViewAllCompanies}>
            Browse All Companies
            <ArrowRight size={16} />
          </button>
        </div>

        {/* Company Cards Grid */}
        <div className="company-grid">
          {companies.slice(0, 6).map((comp) => (
            <div
              key={comp.name}
              className="company-card"
              onClick={() => onSelectCompany(comp.name)}
            >
              <div className="company-icon-box">
                <Building2 size={24} className="company-icon" />
              </div>
              <div className="company-details">
                <h3 className="company-name">{comp.name}</h3>
                <div className="company-meta">
                  <span className="badge badge-teal">
                    <Users size={12} />
                    {comp.alumniCount} Alumni
                  </span>
                  {comp.departments?.length > 0 && (
                    <span className="dept-tag">
                      {comp.departments.slice(0, 2).join(', ')}
                    </span>
                  )}
                </div>
              </div>
              <div className="company-action">
                <ArrowRight size={18} className="company-arrow" />
              </div>
            </div>
          ))}

          {companies.length === 0 && !isLoading && (
            <div className="empty-company-card">
              <Briefcase size={28} className="empty-icon" />
              <p>Companies will appear as alumni records are linked in Neo4j.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
