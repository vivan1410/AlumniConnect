import React, { useState } from 'react';
import { X, Lock, Mail, User, ShieldCheck, GraduationCap, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../services/api';
import './AuthModal.css';

export default function AuthModal({ initialMode = 'login', onClose, onLoginSuccess }) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Student');
  const [department, setDepartment] = useState('CSE');
  const [company, setCompany] = useState('');
  const [graduationYear, setGraduationYear] = useState('2024');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAuthError(null);

    const userName = name || (email.split('@')[0] || 'Campus User');

    try {
      if (mode === 'signup') {
        if (!password.trim() || password.trim().length < 6) {
          setAuthError('Please enter a password with at least 6 characters.');
          setIsSubmitting(false);
          return;
        }

        const response = await api.register({
          name: userName,
          email: email.trim(),
          password: password.trim(),
          role,
          department,
          company: role === 'Alumni' ? company : '',
          graduationYear: role === 'Alumni' ? graduationYear : '',
        });

        if (response.ok && response.data.success) {
          setSuccessMsg(response.data.message || 'Profile saved to Neo4j!');
          const authData = response.data?.data || {};
          if (authData.token) {
            api.setAuthToken(authData.token);
          }
          setTimeout(() => {
            if (onLoginSuccess) {
              onLoginSuccess({
                name: authData.name || userName,
                email,
                role,
                department,
                id: authData.id,
                token: authData.token,
              });
            }
            onClose();
          }, 800);
          return;
        } else {
          setAuthError(response.data?.error || response.data?.details || 'Failed to save profile in Neo4j');
        }
      } else {
        if (!password.trim()) {
          setAuthError('Please enter your password.');
          setIsSubmitting(false);
          return;
        }

        // Sign in mode: authenticate via API and retrieve session token
        const loginRes = await api.login({
          email: email.trim(),
          name: userName,
          password: password.trim(),
          role,
          department,
        });

        if (loginRes.ok && loginRes.data.success) {
          const authUser = loginRes.data.data;
          if (authUser?.token) {
            api.setAuthToken(authUser.token);
          }
          setSuccessMsg(`Welcome back, ${authUser.name}!`);
          setTimeout(() => {
            if (onLoginSuccess) {
              onLoginSuccess(authUser);
            }
            onClose();
          }, 500);
        } else {
          if (loginRes.data?.code === 'NO_PASSWORD_SET') {
            setAuthError(loginRes.data?.error || 'This account has no password set yet. Please use Google Sign-In.');
          } else {
            setAuthError(loginRes.data?.error || 'Authentication failed. Please verify your credentials.');
          }
        }
      }
    } catch (err) {
      setAuthError(err.message || 'Network error writing to database');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container auth-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-badge">
            <Lock size={13} />
            <span>Campus Authentication</span>
          </div>
          <button className="btn-close-modal" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="auth-brand-center">
            <div className="auth-icon-box">
              <GraduationCap size={28} />
            </div>
            <h3 className="auth-title">
              {mode === 'login' ? 'Welcome Back to AlumniConnect' : 'Join the Campus Network'}
            </h3>
            <p className="auth-subtitle">
              {mode === 'login'
                ? 'Sign in to connect with graduates and track your career bookmarks.'
                : 'Create your campus profile to start connecting with alumni.'}
            </p>
          </div>

          {/* Mode Tabs */}
          <div className="auth-mode-tabs">
            <button
              className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
              onClick={() => setMode('login')}
            >
              Sign In
            </button>
            <button
              className={`auth-tab-btn ${mode === 'signup' ? 'active' : ''}`}
              onClick={() => setMode('signup')}
            >
              Create Account
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <>
                <div className="form-group">
                  <label>Full Name</label>
                  <div className="input-icon-wrap">
                    <User size={16} className="field-icon" />
                    <input
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Role</label>
                    <select value={role} onChange={(e) => setRole(e.target.value)}>
                      <option value="Student">Student</option>
                      <option value="Alumni">Alumni</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Department</label>
                    <select value={department} onChange={(e) => setDepartment(e.target.value)}>
                      <option value="CSE">CSE</option>
                      <option value="IT">IT</option>
                      <option value="ECE">ECE</option>
                      <option value="Mechanical">Mechanical</option>
                    </select>
                  </div>
                </div>

                {role === 'Alumni' && (
                  <div className="form-row">
                    <div className="form-group">
                      <label>Current Company</label>
                      <input
                        type="text"
                        placeholder="e.g. Google, Amazon"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        required={role === 'Alumni'}
                      />
                    </div>
                    <div className="form-group">
                      <label>Graduation Year</label>
                      <input
                        type="number"
                        placeholder="e.g. 2023"
                        value={graduationYear}
                        onChange={(e) => setGraduationYear(e.target.value)}
                        required={role === 'Alumni'}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="form-group">
              <label>College / University Email</label>
              <div className="input-icon-wrap">
                <Mail size={16} className="field-icon" />
                <input
                  type="email"
                  placeholder="student@college.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Password</label>
              <div className="input-icon-wrap">
                <Lock size={16} className="field-icon" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {authError && (
              <div style={{ color: '#dc2626', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={15} />
                <span>{authError}</span>
              </div>
            )}

            {successMsg && (
              <div style={{ color: '#0f766e', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle2 size={15} />
                <span>{successMsg}</span>
              </div>
            )}

            <button type="submit" className="btn btn-primary auth-submit-btn" disabled={isSubmitting}>
              <span>{isSubmitting ? 'Writing to Neo4j...' : mode === 'login' ? 'Sign In to Network' : 'Complete Registration'}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Architecture Transparency Notice */}
          <div className="auth-notice-box">
            <ShieldCheck size={16} className="shield-icon" />
            <p>
              <strong>Architecture Note:</strong> In accordance with project requirements, this interface is architected to hook into institutional OAuth / SSO providers. Direct database credentials remain isolated on the backend.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
