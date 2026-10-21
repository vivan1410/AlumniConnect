import React from 'react';
import { ArrowRight, Sparkles, Database } from 'lucide-react';
import './CtaSection.css';

export default function CtaSection({ onExploreClick, onOpenDbModal }) {
  return (
    <section className="cta-section">
      <div className="container">
        <div className="cta-card">
          <div className="cta-content">
            <div className="badge badge-teal">
              <Sparkles size={12} />
              <span>Campus Career Accelerator</span>
            </div>
            <h2 className="cta-title">Ready to build your campus network?</h2>
            <p className="cta-description">
              Join students and alumni bridging academic life and high-impact industry careers.
              Every connection is backed by genuine graph intelligence.
            </p>
            <div className="cta-actions">
              <button className="btn btn-primary btn-lg" onClick={onExploreClick}>
                Start Exploring Alumni
                <ArrowRight size={18} />
              </button>
              <button className="btn btn-secondary btn-lg" onClick={onOpenDbModal}>
                <Database size={16} />
                Database Diagnostics
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
