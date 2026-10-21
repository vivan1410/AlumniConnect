import React from 'react';
import {
  GraduationCap,
  Network,
  Database,
  Compass,
  Briefcase,
  Users,
  ShieldCheck,
  Cpu,
  ArrowRight
} from 'lucide-react';
import './AboutPage.css';

export default function AboutPage({ onExploreClick, onOpenDbModal }) {
  return (
    <div className="about-page">
      {/* Header Banner */}
      <div className="about-header-banner">
        <div className="container">
          <div className="badge badge-teal">Our Purpose & Architecture</div>
          <h1 className="about-page-title">About AlumniConnect</h1>
          <p className="about-page-subtitle">
            A graph-driven campus network connecting undergraduate talent with accomplished industry leaders.
          </p>
        </div>
      </div>

      <div className="container about-content-wrap">
        {/* Mission Statement */}
        <div className="about-mission-card">
          <div className="mission-content">
            <h2 className="mission-title">Empowering Collegiate Futures Through Real Connection</h2>
            <p className="mission-text">
              Navigating post-graduation careers is one of the most defining challenges for college students.
              AlumniConnect eliminates guesswork by providing students with transparent access to where former seniors
              now work, how they progressed from specific degree programs, and how to build authentic professional relationships.
            </p>
          </div>
        </div>

        {/* 3 Pillars */}
        <div className="about-pillars-grid">
          <div className="pillar-card">
            <div className="pillar-icon-box teal">
              <Compass size={24} />
            </div>
            <h3>Career Path Transparency</h3>
            <p>
              Students can view exact career destinations for graduates from their department (e.g. CSE, IT, ECE)
              and discover realistic entry points into top-tier tech firms.
            </p>
          </div>

          <div className="pillar-card">
            <div className="pillar-icon-box sage">
              <Briefcase size={24} />
            </div>
            <h3>Company Discovery</h3>
            <p>
              Rather than searching generic job boards, students can pinpoint organizations with verified campus ties,
              where alumni can provide meaningful referrals and interview advice.
            </p>
          </div>

          <div className="pillar-card">
            <div className="pillar-icon-box amber">
              <Users size={24} />
            </div>
            <h3>Direct Mentorship</h3>
            <p>
              Direct contact channels enable students to request resume reviews, portfolio feedback, and insights
              into company engineering cultures.
            </p>
          </div>
        </div>

        {/* Technical Architecture Section */}
        <div className="about-tech-section">
          <div className="badge badge-teal">Graph Database Technology</div>
          <h2 className="tech-section-title">Why Neo4j Powers AlumniConnect</h2>
          <p className="tech-section-desc">
            Traditional relational databases require complex, slow multi-table SQL joins to determine who works where
            and who is connected to whom. AlumniConnect is built on <strong>Neo4j</strong>, the world's leading graph database.
          </p>

          <div className="graph-concepts-grid">
            <div className="concept-card">
              <div className="concept-header">
                <Database size={18} className="concept-icon" />
                <h4>Graph Nodes (:Label)</h4>
              </div>
              <p>
                Represent real-world campus entities: <code>:Alumni</code>, <code>:Company</code>, and <code>:Student</code>.
                Each node encapsulates verified properties like <code>name</code>, <code>department</code>, and <code>graduationYear</code>.
              </p>
            </div>

            <div className="concept-card">
              <div className="concept-header">
                <Network size={18} className="concept-icon" />
                <h4>Relationships (-[:TYPE]&rarr;)</h4>
              </div>
              <p>
                First-class graph pointers such as <code>(Alumni)-[:WORKS_AT]&rarr;(Company)</code> and <code>(Student)-[:INTERESTED_IN]&rarr;(Alumni)</code>.
                Traversals execute with native index-free adjacency.
              </p>
            </div>

            <div className="concept-card">
              <div className="concept-header">
                <Cpu size={18} className="concept-icon" />
                <h4>Cypher Query Language</h4>
              </div>
              <p>
                Declarative pattern matching queries like <code>MATCH (a:Alumni)-[:WORKS_AT]&rarr;(c:Company) RETURN a, c</code>
                guarantee lightning-fast queries and expressive relationship discovery.
              </p>
            </div>
          </div>
        </div>

        {/* Full-Stack Architecture Banner */}
        <div className="fullstack-arch-card">
          <div className="arch-header">
            <ShieldCheck size={24} className="arch-icon" />
            <div>
              <h3>Full-Stack Architecture Overview</h3>
              <p>Strict separation of concerns between frontend, backend, and graph storage.</p>
            </div>
          </div>

          <div className="arch-flow">
            <div className="flow-step">
              <span className="step-tag">Frontend</span>
              <strong>React 19 + Vite</strong>
              <span>Modular UI with responsive design tokens</span>
            </div>
            <div className="flow-arrow">→</div>
            <div className="flow-step">
              <span className="step-tag">Backend</span>
              <strong>Express REST API</strong>
              <span>Node.js service with parameterized Cypher queries</span>
            </div>
            <div className="flow-arrow">→</div>
            <div className="flow-step">
              <span className="step-tag">Database</span>
              <strong>Neo4j Desktop</strong>
              <span>Native Graph Database via neo4j://127.0.0.1:7687</span>
            </div>
          </div>
        </div>

        {/* CTA Bar */}
        <div className="about-actions-bar">
          <button className="btn btn-primary btn-lg" onClick={onExploreClick}>
            Explore Verified Alumni
            <ArrowRight size={18} />
          </button>
          <button className="btn btn-secondary btn-lg" onClick={onOpenDbModal}>
            View Database Connection Status
          </button>
        </div>
      </div>
    </div>
  );
}
