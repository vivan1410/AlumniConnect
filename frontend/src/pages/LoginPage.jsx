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

  // Read Google Client ID from Vite environment
  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  const googleHiddenBtnRef = useRef(null);

  // Keep a ref of form state so async Google callback always receives latest registration metadata
  const formStateRef = useRef({ role, department, company, graduationYear });
  useEffect(() => {
    formStateRef.current = { role, department, company, graduationYear };
  }, [role, department, company, graduationYear]);

  // Sync mode if initialMode prop changes
  useEffect(() => {
    setMode(initialMode);
    setAuthError(null);
    setSuccessMsg(null);
  }, [initialMode]);

  // Handle Google Identity Services credential response
  const handleGoogleCredentialResponse = async (response) => {
    if (!response || !response.credential) {
      setAuthError('No Google credential returned. Please try again.');
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(true);
    setAuthError(null);
    setSuccessMsg(null);

    const { role: curRole, department: curDept, company: curCompany, graduationYear: curGradYear } = formStateRef.current;

    try {
      const res = await api.googleLogin(response.credential, {
        requestedRole: curRole,
        requestedDepartment: curDept,
        requestedCompany: curRole === 'Alumni' ? curCompany.trim() : '',
        requestedGraduationYear: curRole === 'Alumni' ? curGradYear : '',
      });

      if (res.ok && res.data?.success) {
        const authUser = res.data.data;
        if (authUser?.token) {
          api.setAuthToken(authUser.token);
        }
        setSuccessMsg(`Welcome, ${authUser.name}! Signed in with Google.`);
        if (onLoginSuccess) {
          onLoginSuccess(authUser);
        }
      } else {
        setAuthError(res.data?.error || 'Google authentication failed. Please verify your account.');
      }
    } catch (err) {
      setAuthError(err.message || 'Google authentication request failed. Please check your network.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Initialize Google Identity Services
  useEffect(() => {
    if (!googleClientId) return;

    let initInterval = null;

    const setupGsi = () => {
      if (typeof window !== 'undefined' && window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          if (googleHiddenBtnRef.current) {
            googleHiddenBtnRef.current.innerHTML = '';
            window.google.accounts.id.renderButton(googleHiddenBtnRef.current, {
              type: 'standard',
              theme: 'outline',
              size: 'large',
            });
          }

          if (initInterval) clearInterval(initInterval);
        } catch (e) {
          console.warn('[GIS] Initialization notice:', e);
        }
      }
    };

    setupGsi();
    initInterval = setInterval(setupGsi, 500);
    const timeout = setTimeout(() => {
      if (initInterval) clearInterval(initInterval);
    }, 4000);

    return () => {
      if (initInterval) clearInterval(initInterval);
      clearTimeout(timeout);
    };
  }, [googleClientId]);

  // Google OAuth Button Click Handler
  const handleGoogleSignIn = () => {
    if (isSubmitting) return;

    setAuthError(null);
    setSuccessMsg(null);

    // 1. Check if configured
    if (!googleClientId) {
      setAuthError(
        'Google Sign-In is not configured yet. Please configure VITE_GOOGLE_CLIENT_ID in your environment variables.'
      );
      return;
    }

    // 2. Check if GIS is loaded
    if (typeof window === 'undefined' || !window.google?.accounts?.id) {
      setAuthError(
        'Google Identity Services is still loading or blocked by your browser. Please check your connection and reload.'
      );
      return;
    }

    setIsSubmitting(true);

    // Safety timeout in case popup is closed by user without interacting
    const onWindowFocus = () => {
      setTimeout(() => {
        setIsSubmitting((prev) => (prev ? false : prev));
      }, 1500);
    };
    window.addEventListener('focus', onWindowFocus, { once: true });

    // 3. Trigger genuine Google Sign-In popup
    try {
      const renderedGsiBtn = googleHiddenBtnRef.current?.querySelector('div[role=button]');
      if (renderedGsiBtn) {
        renderedGsiBtn.click();
      } else {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setAuthError('Google Sign-In popup was dismissed or blocked by the browser.');
            setIsSubmitting(false);
          }
        });
      }
    } catch (err) {
      console.warn('[GIS] Prompt invocation error:', err);
      setAuthError('Failed to open Google Sign-In. Please check your browser popup settings.');
      setIsSubmitting(false);
    }
  };

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

                {/* Subtle OR Divider */}
                <div className="exact-or-divider">
                  <span className="divider-line" />
                  <span className="divider-text">OR</span>
                  <span className="divider-line" />
                </div>

                {/* White Outlined Continue with Google Button */}
                <button
                  type="button"
                  className="exact-btn-google"
                  onClick={handleGoogleSignIn}
                  disabled={isSubmitting}
                >
                  <svg className="exact-google-g" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                {/* Hidden Google Identity Services native button anchor */}
                <div
                  ref={googleHiddenBtnRef}
                  id="gsi-hidden-wrapper"
                  style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0, overflow: 'hidden' }}
                  aria-hidden="true"
                />

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
