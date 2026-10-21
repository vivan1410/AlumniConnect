import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';
import FeaturedAlumni from './components/FeaturedAlumni';
import CompanyShowcase from './components/CompanyShowcase';
import HowItWorks from './components/HowItWorks';
import CtaSection from './components/CtaSection';
import Footer from './components/Footer';
import ExploreAlumniPage from './pages/ExploreAlumniPage';
import CompaniesPage from './pages/CompaniesPage';
import NetworkGraphView from './pages/NetworkGraphView';
import AboutPage from './pages/AboutPage';
import LoginPage from './pages/LoginPage';
import MentorshipRequestsPage from './pages/MentorshipRequestsPage';
import ChatPage from './pages/ChatPage';
import AlumniProfileModal from './components/AlumniProfileModal';
import DatabaseModal from './components/DatabaseModal';
import AuthModal from './components/AuthModal';
import api from './services/api';

export default function App() {
  // Navigation with URL Hash synchronization (supports #login, #alumni, #graph, #about, #companies, #home, #mentorship, #messages)
  // Defaults directly to 'login' when opening root URL without a hash
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined' && window.location?.hash) {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (['home', 'alumni', 'companies', 'graph', 'about', 'login', 'mentorship', 'messages'].includes(hash)) {
        return hash;
      }
    }
    return 'login';
  });

  const [loginMode, setLoginMode] = useState('login');
  const [returnDestination, setReturnDestination] = useState('home');

  // Database Status
  const [dbStatus, setDbStatus] = useState(null);
  const [isRefreshingDb, setIsRefreshingDb] = useState(false);

  // Platform Metrics & Showcase Data
  const [stats, setStats] = useState(null);
  const [featuredAlumni, setFeaturedAlumni] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [isLoadingShowcase, setIsLoadingShowcase] = useState(true);

  // Search & Filter Transfer (e.g. from hero to explore page)
  const [exploreFilters, setExploreFilters] = useState({});

  // Modals & Navigation States
  const [selectedAlumniId, setSelectedAlumniId] = useState(null);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [authModalState, setAuthModalState] = useState({ isOpen: false, mode: 'login' });

  // Current Logged in User with validated session persistence
  const [currentUser, setCurrentUser] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('alumniconnect_user');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      // Validate session structure: requires an object with a valid email
      if (
        parsed &&
        typeof parsed === 'object' &&
        parsed.email &&
        typeof parsed.email === 'string' &&
        parsed.email.includes('@')
      ) {
        if (parsed.token) {
          api.setAuthToken(parsed.token);
        }
        return parsed;
      }
      localStorage.removeItem('alumniconnect_user');
      localStorage.removeItem('alumniconnect_token');
      return null;
    } catch {
      return null;
    }
  });

  // Health & Initial Data Loader
  const checkDatabaseHealth = async () => {
    setIsRefreshingDb(true);
    try {
      const response = await api.checkHealth();
      if (response.data?.database) {
        setDbStatus(response.data.database);
      } else {
        setDbStatus({
          connected: false,
          error: 'Backend API is not responding on port 5000',
        });
      }
    } catch (err) {
      setDbStatus({
        connected: false,
        error: err.message,
      });
    } finally {
      setIsRefreshingDb(false);
    }
  };

  const loadInitialData = async () => {
    setIsLoadingShowcase(true);
    try {
      // 1. Check DB health
      await checkDatabaseHealth();

      // 2. Load Stats
      const statsRes = await api.getStats();
      if (statsRes.ok && statsRes.data.success) {
        setStats(statsRes.data.data);
      }

      // 3. Load Featured Alumni (top 6)
      const alumniRes = await api.getAlumni();
      if (alumniRes.ok && alumniRes.data.success) {
        setFeaturedAlumni(alumniRes.data.data || []);
      }

      // 4. Load Companies
      const compRes = await api.getCompanies();
      if (compRes.ok && compRes.data.success) {
        setCompanies(compRes.data.data || []);
      }
    } catch (err) {
      console.warn('Initial data load notice:', err);
    } finally {
      setIsLoadingShowcase(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Session token verification and upgrade
  useEffect(() => {
    if (currentUser) {
      if (!currentUser.token) {
        api.ensureAuthToken(currentUser).then((token) => {
          if (token) {
            setCurrentUser((prev) => (prev ? { ...prev, token } : prev));
          }
        });
      } else {
        api.setAuthToken(currentUser.token);
        api.getMe().then((res) => {
          if (res.ok && res.data.success && res.data.data) {
            setCurrentUser((prev) => ({ ...prev, ...res.data.data }));
          }
        });
      }
    }
  }, []);

  // Listen to browser hash changes (e.g. #login, #graph, #alumni, #about, #mentorship, #messages)
  useEffect(() => {
    // If opened at root URL with no hash, initialize hash to #login
    if (typeof window !== 'undefined' && (!window.location.hash || window.location.hash === '#')) {
      window.location.hash = 'login';
    }

    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (['home', 'alumni', 'companies', 'graph', 'about', 'login', 'mentorship', 'messages'].includes(hash)) {
        setActiveTab(hash);
      } else if (!hash) {
        setActiveTab('login');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateToTab = (tab) => {
    setActiveTab(tab);
    window.location.hash = tab;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handlers
  const handleHeroSearchSubmit = (query) => {
    setExploreFilters({ q: query });
    navigateToTab('alumni');
  };

  const handleHeroQuickFilter = (filters) => {
    setExploreFilters(filters);
    navigateToTab('alumni');
  };

  const handleSelectAlumni = (alumni) => {
    const id = alumni.id || alumni.name;
    setSelectedAlumniId(id);
  };

  const handleSelectCompany = (companyName) => {
    setExploreFilters({ company: companyName });
    navigateToTab('alumni');
  };

  const handleOpenAuth = (mode = 'login') => {
    if (activeTab !== 'login') {
      setReturnDestination(activeTab);
    }
    setLoginMode(mode);
    navigateToTab('login');
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('alumniconnect_user', JSON.stringify(user));
      if (user?.token) {
        localStorage.setItem('alumniconnect_token', user.token);
        api.setAuthToken(user.token);
      }
    } catch (e) {
      console.error('Session storage notice:', e);
    }
    const dest = returnDestination && returnDestination !== 'login' ? returnDestination : 'home';
    navigateToTab(dest);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('alumniconnect_user');
      localStorage.removeItem('alumniconnect_token');
      api.setAuthToken(null);
    } catch (e) {
      console.error('Session clearance notice:', e);
    }
    setReturnDestination('home');
    navigateToTab('login');
  };

  return (
    <div className="alumni-connect-app">
      {/* Global Navigation — Rendered on application pages, hidden on login page */}
      {activeTab !== 'login' && (
        <Navbar
          activeTab={activeTab}
          setActiveTab={navigateToTab}
          dbStatus={dbStatus}
          onOpenDbModal={() => setIsDbModalOpen(true)}
          onOpenAuthModal={handleOpenAuth}
          onRefreshDb={checkDatabaseHealth}
          isRefreshingDb={isRefreshingDb}
          currentUser={currentUser}
          onLogout={handleLogout}
        />
      )}

      {/* Main Page Content */}
      <main className="main-content">
        {activeTab === 'home' && (
          <>
            <HeroSection
              stats={stats}
              onSearchSubmit={handleHeroSearchSubmit}
              onExploreClick={() => navigateToTab('alumni')}
              onJoinClick={() => handleOpenAuth('signup')}
              onQuickFilter={handleHeroQuickFilter}
            />

            <FeaturedAlumni
              alumniList={featuredAlumni}
              isLoading={isLoadingShowcase}
              onSelectAlumni={handleSelectAlumni}
              onViewAll={() => navigateToTab('alumni')}
              onOpenDbModal={() => setIsDbModalOpen(true)}
              isDbConnected={dbStatus?.connected}
            />

            <CompanyShowcase
              companies={companies}
              isLoading={isLoadingShowcase}
              onSelectCompany={handleSelectCompany}
              onViewAllCompanies={() => navigateToTab('companies')}
            />

            <HowItWorks />

            <CtaSection
              onExploreClick={() => navigateToTab('alumni')}
              onOpenDbModal={() => setIsDbModalOpen(true)}
            />
          </>
        )}

        {activeTab === 'alumni' && (
          <ExploreAlumniPage
            initialFilters={exploreFilters}
            onSelectAlumni={handleSelectAlumni}
            onOpenDbModal={() => setIsDbModalOpen(true)}
            isDbConnected={dbStatus?.connected}
          />
        )}

        {activeTab === 'companies' && (
          <CompaniesPage
            onSelectAlumni={handleSelectAlumni}
            onOpenDbModal={() => setIsDbModalOpen(true)}
          />
        )}

        {activeTab === 'graph' && (
          <NetworkGraphView
            onSelectAlumni={handleSelectAlumni}
            onOpenDbModal={() => setIsDbModalOpen(true)}
          />
        )}

        {activeTab === 'about' && (
          <AboutPage
            onExploreClick={() => navigateToTab('alumni')}
            onOpenDbModal={() => setIsDbModalOpen(true)}
          />
        )}

        {activeTab === 'mentorship' && (
          <MentorshipRequestsPage
            currentUser={currentUser}
            onNavigate={navigateToTab}
            onOpenAuthModal={handleOpenAuth}
            onSelectConversation={(id) => {
              setSelectedConversationId(id);
              navigateToTab('messages');
            }}
          />
        )}

        {activeTab === 'messages' && (
          <ChatPage
            currentUser={currentUser}
            onNavigate={navigateToTab}
            onOpenAuthModal={handleOpenAuth}
            selectedConversationId={selectedConversationId}
            onSelectConversation={setSelectedConversationId}
          />
        )}

        {activeTab === 'login' && (
          <LoginPage
            initialMode={loginMode}
            currentUser={currentUser}
            onLoginSuccess={handleLoginSuccess}
            onNavigate={navigateToTab}
            returnDestination={returnDestination}
          />
        )}
      </main>

      {/* Footer rendered only on the About page */}
      {activeTab === 'about' && (
        <Footer
          onNavigate={navigateToTab}
          onOpenDbModal={() => setIsDbModalOpen(true)}
          dbStatus={dbStatus}
        />
      )}

      {/* Profile Detail Modal */}
      {selectedAlumniId && (
        <AlumniProfileModal
          alumniId={selectedAlumniId}
          onClose={() => setSelectedAlumniId(null)}
          onSelectColleague={(id) => setSelectedAlumniId(id)}
          currentUser={currentUser}
        />
      )}

      {/* Neo4j Connection Diagnostics Modal */}
      {isDbModalOpen && (
        <DatabaseModal
          dbStatus={dbStatus}
          onClose={() => setIsDbModalOpen(false)}
          onRefresh={checkDatabaseHealth}
          isRefreshing={isRefreshingDb}
        />
      )}

      {/* Authentication Modal (Fallback) */}
      {authModalState.isOpen && (
        <AuthModal
          initialMode={authModalState.mode}
          onClose={() => setAuthModalState({ isOpen: false, mode: 'login' })}
          onLoginSuccess={handleLoginSuccess}
        />
      )}
    </div>
  );
}
