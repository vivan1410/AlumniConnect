import React, { useState } from 'react';
import {
  X,
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Server,
  Key,
  Folder,
  Terminal,
  ExternalLink
} from 'lucide-react';
import './DatabaseModal.css';

export default function DatabaseModal({
  dbStatus,
  onClose,
  onRefresh,
  isRefreshing,
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container db-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-badge">
            <Database size={14} />
            <span>Neo4j Database Diagnostics</span>
          </div>
          <button className="btn-close-modal" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Status Banner */}
          <div className={`db-status-banner ${dbStatus?.connected ? 'connected' : 'warning'}`}>
            <div className="status-banner-icon">
              {dbStatus?.connected ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
            </div>
            <div className="status-banner-text">
              <h3>
                {dbStatus?.connected
                  ? 'Connected to Neo4j Database'
                  : 'Neo4j Database Setup Required'}
              </h3>
              <p>
                {dbStatus?.connected
                  ? `Successfully authenticated with Neo4j at ${dbStatus.uri} (database: "${dbStatus.database || 'neo4j'}").`
                  : dbStatus?.error ||
                    'Backend is running, but cannot authenticate with Neo4j Desktop.'}
              </p>
            </div>
          </div>

          {/* Configuration Parameters */}
          <div className="db-params-card">
            <h4 className="params-title">Connection Parameters</h4>
            <div className="params-grid">
              <div className="param-item">
                <span className="param-label">Connection Protocol & URI</span>
                <span className="param-value code">{dbStatus?.uri || 'neo4j://127.0.0.1:7687'}</span>
              </div>
              <div className="param-item">
                <span className="param-label">Database Name</span>
                <span className="param-value code">{dbStatus?.database || 'neo4j'}</span>
              </div>
              <div className="param-item">
                <span className="param-label">Username</span>
                <span className="param-value code">{dbStatus?.user || 'neo4j'}</span>
              </div>
              <div className="param-item">
                <span className="param-label">Driver Version</span>
                <span className="param-value code">{dbStatus?.agent || 'neo4j-driver/5.x (official)'}</span>
              </div>
            </div>
          </div>

          {/* Quick Setup Guide if Disconnected */}
          {!dbStatus?.connected && (
            <div className="db-troubleshoot-guide">
              <h4 className="guide-title">How to connect your Neo4j instance:</h4>
              <ol className="guide-steps">
                <li>
                  <strong>1. Start the Database in Neo4j Desktop:</strong>
                  <p>
                    Open Neo4j Desktop, locate your <code>AlumniConnect</code> instance, and verify that the green
                    <strong> Active / Started</strong> indicator is visible on port <code>7687</code>.
                  </p>
                </li>
                <li>
                  <strong>2. Configure your password in backend/.env:</strong>
                  <p>
                    Open <code>backend/.env</code> in your editor and enter the password you chose when creating the DBMS:
                  </p>
                  <div className="code-snippet-box">
                    <code>
                      NEO4J_URI=neo4j://127.0.0.1:7687<br />
                      NEO4J_USER=neo4j<br />
                      NEO4J_PASSWORD=<strong>your_password_here</strong><br />
                      NEO4J_DATABASE=neo4j
                    </code>
                  </div>
                </li>
                <li>
                  <strong>3. Click the "Test Connection Now" button below:</strong>
                  <p>
                    The backend verifies connectivity via Cypher without restarting the server.
                  </p>
                </li>
              </ol>
            </div>
          )}

          {/* Safety Notice */}
          <div className="db-safety-notice">
            <Database size={15} />
            <span>
              <strong>Database Safety:</strong> Queries are read-only parameterized Cypher. Your existing nodes, labels, and relationships are preserved.
            </span>
          </div>

          {/* Actions */}
          <div className="db-modal-actions">
            <button
              className="btn btn-primary"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw size={15} className={isRefreshing ? 'spinning' : ''} />
              <span>{isRefreshing ? 'Testing Connection...' : 'Test Connection Now'}</span>
            </button>
            <button className="btn btn-secondary" onClick={onClose}>
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
