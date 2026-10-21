import React from 'react';
import { Search, Compass, Network, Sparkles, CheckCircle2 } from 'lucide-react';
import './HowItWorks.css';

export default function HowItWorks() {
  const steps = [
    {
      number: '01',
      title: 'Explore Verified Alumni',
      description:
        'Search our campus graph directory by graduate name, hiring company, graduation year, or academic department.',
      icon: Search,
      pill: 'Graph Search',
    },
    {
      number: '02',
      title: 'Map Career Pathways',
      description:
        'Discover the companies employing graduates from your specific degree program and see where past seniors advanced.',
      icon: Compass,
      pill: 'Trajectory Insights',
    },
    {
      number: '03',
      title: 'Build Meaningful Bonds',
      description:
        'Establish direct professional links for portfolio reviews, interview prep, referrals, and authentic industry mentorship.',
      icon: Network,
      pill: 'Direct Mentorship',
    },
  ];

  return (
    <section className="how-it-works-section">
      <div className="container">
        <div className="section-header center">
          <div className="badge badge-teal">The AlumniConnect Advantage</div>
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">
            A graph-powered approach to collegiate networking that connects students with opportunity.
          </p>
        </div>

        <div className="steps-grid">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.number} className="step-card">
                <div className="step-top">
                  <span className="step-number">{step.number}</span>
                  <span className="badge badge-neutral">{step.pill}</span>
                </div>
                <div className="step-icon-wrap">
                  <Icon size={26} className="step-icon" />
                </div>
                <h3 className="step-title">{step.title}</h3>
                <p className="step-description">{step.description}</p>
                <div className="step-check">
                  <CheckCircle2 size={16} className="check-icon" />
                  <span>Verified data from Neo4j</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
