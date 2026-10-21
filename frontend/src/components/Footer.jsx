import React from 'react';
import { GraduationCap, Database, Heart, ExternalLink, ShieldCheck } from 'lucide-react';
import './Footer.css';

export default function Footer({ onNavigate, onOpenDbModal, dbStatus }) {
  return (
    <footer className="footer-wrap">
      <div className="container footer-inner">
        <div className="footer-brand-column">
          <div className="footer-brand" onClick={() => onNavigate('home')}>
            <div className="footer-logo-icon">
              <GraduationCap size={20} />
            </div>
            <span className="footer-title">AlumniConnect</span>
          </div>
          <p className="footer-tagline">
            Connecting students with accomplished alumni through authentic Neo4j graph relationships.
          </p>
          <div className="footer-db-status" onClick={onOpenDbModal}>
            <span className={`db-bullet ${dbStatus?.connected ? 'live' : 'idle'}`} />
            <span>Database: {dbStatus?.connected ? 'Neo4j Live' : 'Neo4j Local Instance'}</span>
          </div>
        </div>

        <div className="footer-links-grid">
          <div className="footer-col">
            <h4 className="footer-col-title">Platform</h4>
            <ul className="footer-list">
              <li>
                <button onClick={() => onNavigate('home')}>Home</button>
              </li>
              <li>
                <button onClick={() => onNavigate('alumni')}>Explore Alumni</button>
              </li>
              <li>
                <button onClick={() => onNavigate('companies')}>Company Directory</button>
              </li>
              <li>
                <button onClick={() => onNavigate('graph')}>Network Graph</button>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Neo4j Graph</h4>
            <ul className="footer-list">
              <li>
                <span className="graph-label">Nodes: :Alumni, :Company, :Student</span>
              </li>
              <li>
                <span className="graph-label">Edges: :WORKS_AT, :INTERESTED_IN</span>
              </li>
              <li>
                <button onClick={onOpenDbModal}>Connection Settings</button>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">Technology</h4>
            <ul className="footer-list">
              <li><span>React 19 + Vite</span></li>
              <li><span>Node.js + Express REST API</span></li>
              <li><span>Neo4j Graph Database</span></li>
              <li><span>Cypher Query Engine</span></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="container footer-bottom-inner">
          <p className="copyright-text">
            © {new Date().getFullYear()} AlumniConnect. Built for college alumni & student career advancement.
          </p>
          <div className="footer-pill">
            <ShieldCheck size={14} className="shield-icon" />
            <span>Real Neo4j Database Verified</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
