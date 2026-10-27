import React, { useState, useEffect, useRef } from 'react';
import {
  GraduationCap,
  Mail,
  Lock,
  User,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Briefcase,
  Users,
  Network,
  Share2,
  Sparkles,
  Loader2,
  X,
  Info
} from 'lucide-react';
import api from '../services/api';
import './LoginPage.css';

export default function LoginPage({
  initialMode = 'login',
  currentUser,
  onLoginSuccess,
  onNavigate,
  returnDestination = 'home',
  showCard = true,
}) {
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('Student');
  const [department, setDepartment] = useState('CSE');
  const [company, setCompany] = useState('');
  const [graduationYear, setGraduationYear] = useState('2024');
  const [rememberMe, setRememberMe] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [forgotModalOpen, setForgotModalOpen] = useState(false);

  // Sync mode if initialMode prop changes
  useEffect(() => {
    setMode(initialMode);
    setAuthError(null);
    setSuccessMsg(null);
  }, [initialMode]);

  // Form Submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setAuthError(null);
    setSuccessMsg(null);

    const userName = name.trim() || (email.split('@')[0] || 'Campus User');

    try {
      if (mode === 'signup') {
        if (!password.trim() || password.trim().length < 6) {
          setAuthError('Please enter a password with at least 6 characters.');
          return;
        }

        const payload = {
          name: userName,
          email: email.trim(),
          password: password.trim(),
          role,
          department,
          company: role === 'Alumni' ? company.trim() : '',
          graduationYear: role === 'Alumni' ? graduationYear : '',
        };

        const response = await api.register(payload);

        if (response.ok && response.data?.success) {
          setSuccessMsg(`Welcome, ${userName}! Setting up your campus profile...`);
          const authData = response.data?.data || {};
          const newUser = {
            name: userName,
            email: email.trim(),
            role,
            department,
            company: role === 'Alumni' ? company.trim() : '',
            graduationYear: role === 'Alumni' ? graduationYear : '',
            id: authData.id,
            token: authData.token,
            provider: 'password',
          };

          if (authData.token) {
            api.setAuthToken(authData.token);
          }

          if (onLoginSuccess) {
            onLoginSuccess(newUser);
          }
        } else {
          setAuthError(response.data?.error || response.data?.details || 'Failed to save profile.');
        }
      } else {
        // Sign-in mode
        if (!email.trim() || !password.trim()) {
          setAuthError('Please enter your university email and password.');
          return;
        }

        const loginRes = await api.login({
          email: email.trim(),
          name: userName,
          password: password.trim(),
          role,
          department,
        });

        if (loginRes.ok && loginRes.data?.success) {
          const authUser = loginRes.data.data;
          if (authUser?.token) {
            api.setAuthToken(authUser.token);
          }
          setSuccessMsg(`Welcome back, ${authUser.name}! Signing in...`);
          if (onLoginSuccess) {
            onLoginSuccess(authUser);
          }
        } else {
          setAuthError(loginRes.data?.error || 'Login failed. Please verify your credentials or register.');
        }
      }
    } catch (err) {
      setAuthError(err.message || 'Network connection failed. Verify that backend is running.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-exact-page">
      {/* Decorative leafy illustration anchored in bottom-right corner */}
      <img
        src="/assets/leaf-decor.png"
        alt=""
        className="leaf-corner-decor"
        aria-hidden="true"
      />

      <div className="login-exact-canvas">
        {/* =========================================================================
            TOP HEADER: Logo on Left, Quotation on Right
            ========================================================================= */}
        <header className="exact-header-bar">
          {/* Logo with rounded teal cap box */}
          <div
            className="exact-logo-group"
            onClick={() => onNavigate && onNavigate('home')}
            role="button"
            tabIndex={0}
            title="Return to AlumniConnect Homepage"
          >
            <div className="exact-logo-icon">
              <GraduationCap size={22} className="exact-cap-svg" />
              <span className="exact-cap-accent-dot" />
            </div>
            <div className="exact-logo-text-col">
              <span className="exact-logo-brand">AlumniConnect</span>
              <span className="exact-logo-subtitle">CAMPUS NETWORK</span>
            </div>
          </div>

          {/* Quotation on Top-Right */}
          <div className="exact-header-quote">
            <span className="quote-italic-text">
              “Great minds don't just graduate, they stay connected.”
            </span>
            <span className="quote-heart-symbol" aria-hidden="true">
              ♡
            </span>
          </div>
        </header>

        {/* =========================================================================
            TWO-COLUMN MAIN BODY
            ========================================================================= */}
        <main className={`exact-main-grid ${!showCard ? 'promo-only' : ''}`}>
          {/* -----------------------------------------------------------------------
              LEFT SECTION: Pill, Headlines, Features, Campus Artwork
              ----------------------------------------------------------------------- */}
          <section className="exact-left-section">
            {/* Pill Tag: Connect • Learn • Grow */}
            <div className="exact-pill-badge">
              <Share2 size={13} className="pill-share-icon" />
              <span className="pill-text">Connect • Learn • Grow</span>
            </div>

            {/* Main Headline */}
            <h1 className="exact-headline">
              <span className="headline-dark-navy">Where Campus Connections</span>
              <span className="headline-teal-gradient">Build Your Future.</span>
            </h1>

            {/* Supporting Description */}
            <p className="exact-supporting-desc">
              Join a trusted network of alumni, students and companies to explore opportunities,
              gain mentorship, and build meaningful professional relationships.
            </p>

            {/* Four Feature Highlights */}
            <div className="exact-features-row">
              <div className="exact-feature-item">
                <div className="feature-icon-square">
                  <Users size={18} />
                </div>
                <div className="feature-title-text">
                  <span>Verified</span>
                  <span>Alumni</span>
                </div>
              </div>

              <div className="exact-feature-item">
                <div className="feature-icon-square">
                  <Briefcase size={18} />
                </div>
                <div className="feature-title-text">
                  <span>Hiring</span>
                  <span>Companies</span>
                </div>
              </div>

              <div className="exact-feature-item">
                <div className="feature-icon-square">
                  <GraduationCap size={18} />
                </div>
                <div className="feature-title-text">
                  <span>Academic</span>
                  <span>Departments</span>
                </div>
              </div>

              <div className="exact-feature-item">
                <div className="feature-icon-square">
                  <Network size={18} />
                </div>
                <div className="feature-title-text">
                  <span>Neo4j</span>
                  <span>Graph-Powered</span>
                </div>
              </div>
            </div>

            {/* Campus Artwork at Bottom-Left */}
            <div className="exact-campus-artwork-container">
              <img
                src="/assets/campus-artwork.png"
                alt="University campus with students and network graph: Same Campus Bigger Dreams"
                className="exact-campus-artwork-img"
              />
            </div>
          </section>

          {/* -----------------------------------------------------------------------
              RIGHT SECTION: Premium White Login Card
              ----------------------------------------------------------------------- */}
          {showCard && (
            <section className="exact-right-section">
              <div className="exact-login-card">
                {/* Card Title & Greeting with 3 Teal Rays */}
                <div className="exact-card-header">
                  <div className="title-burst-row">
                    <h2 className="card-welcome-title">
                      {mode === 'login' ? 'Welcome Back!' : 'Join Network!'}
                    </h2>
                    <svg
                      className="card-burst-rays"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#0D9488"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <line x1="12" y1="2" x2="12" y2="7" />
                      <line x1="5" y1="5" x2="8.5" y2="8.5" />
                      <line x1="2" y1="12" x2="7" y2="12" />
                    </svg>
                  </div>
                  <p className="card-welcome-sub">
                    {mode === 'login'
                      ? 'Sign in to your AlumniConnect account to continue your journey.'
                      : 'Create your campus profile to start connecting with alumni.'}
                  </p>
                </div>

                {/* Form Element */}
                <form className="exact-login-form" onSubmit={handleSubmit}>
                  {/* Registration Additional Fields */}
                  {mode === 'signup' && (
                    <div className="signup-extra-fields">
                      <div className="exact-input-group">
                        <div className="exact-input-shell">
                          <User size={16} className="input-prefix-icon user-icon" />
                          <input
                            type="text"
                            className="exact-field-input"
                            placeholder="Full Name (e.g. Rahul Sharma)"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div className="exact-role-pills">
                        <button
                          type="button"
                          className={`role-pill-btn ${role === 'Student' ? 'active' : ''}`}
                          onClick={() => setRole('Student')}
                        >
                          Student
                        </button>
                        <button
                          type="button"
                          className={`role-pill-btn ${role === 'Alumni' ? 'active' : ''}`}
                          onClick={() => setRole('Alumni')}
                        >
                          Alumni
                        </button>
                      </div>

                      <div className="exact-input-group">
                        <select
                          className="exact-select-input"
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                        >
                          <option value="CSE">Computer Science & Engineering (CSE)</option>
                          <option value="IT">Information Technology (IT)</option>
                          <option value="ECE">Electronics & Communication (ECE)</option>
                          <option value="Mechanical">Mechanical Engineering</option>
                        </select>
                      </div>

                      {role === 'Alumni' && (
                        <div className="exact-alumni-row">
                          <input
                            type="text"
                            className="exact-field-input inline-sub"
                            placeholder="Current Company (e.g. Google)"
                            value={company}
                            onChange={(e) => setCompany(e.target.value)}
                            required={role === 'Alumni'}
                          />
                          <input
                            type="number"
                            className="exact-field-input inline-sub"
                            placeholder="Grad Year (e.g. 2023)"
                            min="1990"
                            max="2030"
                            value={graduationYear}
                            onChange={(e) => setGraduationYear(e.target.value)}
                            required={role === 'Alumni'}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* College / University Email Field */}
                  <div className="exact-input-group">
                    <div className="exact-input-shell">
                      <Mail size={16} className="input-prefix-icon mail-icon" />
                      <input
                        type="email"
                        className="exact-field-input"
                        placeholder="College / University Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="input-helper-note">e.g. student@university.edu</div>
                  </div>

                  {/* Password Field with Lock & Eye Toggle */}
                  <div className="exact-input-group">
                    <div className="exact-input-shell">
                      <Lock size={16} className="input-prefix-icon lock-icon" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="exact-field-input"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="exact-eye-btn"
                        onClick={() => setShowPassword(!showPassword)}
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me Checkbox & Forgot Password */}
                  {mode === 'login' && (
                    <div className="exact-options-row">
                      <label className="exact-remember-label">
                        <input
                          type="checkbox"
                          className="exact-checkbox-input"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                        />
                        <span className="remember-text">Remember me</span>
                      </label>

                      <button
                        type="button"
                        className="exact-forgot-link"
                        onClick={() => setForgotModalOpen(true)}
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}

                  {/* Alerts */}
                  {authError && (
                    <div className="exact-alert error">
                      <AlertCircle size={14} />
                      <span>{authError}</span>
                    </div>
                  )}

                  {successMsg && (
                    <div className="exact-alert success">
                      <CheckCircle2 size={14} />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  {/* Full-width Teal Gradient Sign In Button */}
                  <button
                    type="submit"
                    className="exact-btn-signin"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="spinning" />
                        <span>{mode === 'signup' ? 'Writing to Neo4j...' : 'Signing In...'}</span>
                      </>
                    ) : (
                      <>
                        <span>{mode === 'signup' ? 'Complete Registration' : 'Sign In'}</span>
                        <ArrowRight size={17} />
                      </>
                    )}
                  </button>
                </form>



                {/* Pale-Mint Registration Panel at Bottom of Card */}
                <div className="exact-register-panel">
                  <div className="register-panel-left">
                    <div className="register-sparkle-box">
                      <Sparkles size={16} />
                    </div>
                    <div className="register-copy-col">
                      <strong className="register-title">
                        {mode === 'login' ? 'New to AlumniConnect?' : 'Already registered?'}
                      </strong>
                      <span className="register-sub">
                        {mode === 'login'
                          ? 'Join the network and be part of something bigger.'
                          : 'Sign in to access your campus profile.'}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="exact-btn-create-account"
                    onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                  >
                    <span>{mode === 'login' ? 'Create Account' : 'Sign In'}</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* Forgot Password Information Modal */}
      {forgotModalOpen && (
        <div className="exact-modal-backdrop" onClick={() => setForgotModalOpen(false)}>
          <div className="exact-dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <div className="dialog-badge">
                <Info size={14} />
                <span>Password Recovery Notice</span>
              </div>
              <button
                type="button"
                className="dialog-close-btn"
                onClick={() => setForgotModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <h3 className="dialog-title">Campus Single Sign-On Recovery</h3>
            <p className="dialog-text">
              In a college production environment, password recovery is linked directly to your institutional Google Workspace or campus Active Directory.
            </p>
            <p className="dialog-text">
              For this academic DBMS evaluation, you can sign in with any college email (e.g. <code>rahul.student@campus.edu</code>) or click <strong>Create Account</strong> below to register a new verified profile directly into your local Neo4j database.
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setForgotModalOpen(false)}
              >
                Got it, continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
