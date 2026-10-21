/**
 * AlumniConnect Frontend API Client
 * Connects to Express backend REST endpoints.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

let inMemoryToken = null;

function getStoredToken() {
  if (inMemoryToken) return inMemoryToken;
  if (typeof window !== 'undefined') {
    try {
      const directToken = localStorage.getItem('alumniconnect_token');
      if (directToken && directToken.trim()) {
        inMemoryToken = directToken.trim();
        return inMemoryToken;
      }
      const savedUser = localStorage.getItem('alumniconnect_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed?.token && typeof parsed.token === 'string') {
          inMemoryToken = parsed.token.trim();
          return inMemoryToken;
        }
      }
    } catch {
      // Ignore parse notice
    }
  }
  return null;
}

function setStoredToken(token) {
  inMemoryToken = token || null;
  if (typeof window !== 'undefined') {
    try {
      if (token) {
        localStorage.setItem('alumniconnect_token', token);
        const savedUser = localStorage.getItem('alumniconnect_user');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          parsed.token = token;
          localStorage.setItem('alumniconnect_user', JSON.stringify(parsed));
        }
      } else {
        localStorage.removeItem('alumniconnect_token');
      }
    } catch {
      // Ignore storage error
    }
  }
}

/**
 * Helper to perform fetch requests with error handling, proper header merge,
 * and automatic Bearer token injection.
 */
async function fetchJson(endpoint, options = {}, isRetry = false) {
  const url = `${API_BASE}${endpoint}`;

  // Automatically read session token if present
  let token = options.token || getStoredToken();

  // If calling protected mentorship, chat, or auth endpoint without a token, attempt auto-resolution
  const isProtected =
    endpoint.startsWith('/api/mentorship/') ||
    endpoint.startsWith('/api/chat/') ||
    endpoint === '/api/auth/me';

  if (isProtected && !token && !isRetry) {
    token = await api.ensureAuthToken();
  }

  let authHeaders = {};
  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }

  const { token: _omitToken, headers: customHeaders, ...fetchOptions } = options;

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...(customHeaders || {}),
      },
    });

    const data = await response.json().catch(() => null);

    // If 401 occurs on protected endpoint and not retrying, attempt auto-token refresh & retry once
    if (response.status === 401 && isProtected && !isRetry) {
      const refreshed = await api.ensureAuthToken();
      if (refreshed) {
        return fetchJson(endpoint, { ...options, token: refreshed }, true);
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: {
        success: false,
        error: error.message || 'Network connection failed',
      },
    };
  }
}

export const api = {
  /**
   * Get currently active session token
   */
  getAuthToken() {
    return getStoredToken();
  },

  /**
   * Update active session token in memory and localStorage
   */
  setAuthToken(token) {
    setStoredToken(token);
  },

  async ensureAuthToken(currentUser = null) {
    let token = getStoredToken();
    if (token) return token;

    if (currentUser?.token) {
      setStoredToken(currentUser.token);
      return currentUser.token;
    }

    return null;
  },

  /**
   * Health check to test backend and Neo4j connectivity
   */
  async checkHealth() {
    return fetchJson('/api/health');
  },

  /**
   * Fetch all alumni with optional query filters
   */
  async getAlumni(params = {}) {
    const query = new URLSearchParams();
    if (params.q) query.append('q', params.q);
    if (params.department && params.department !== 'all') query.append('department', params.department);
    if (params.company && params.company !== 'all') query.append('company', params.company);
    if (params.graduationYear && params.graduationYear !== 'all') query.append('graduationYear', params.graduationYear);

    const queryString = query.toString();
    const endpoint = `/api/alumni${queryString ? `?${queryString}` : ''}`;
    return fetchJson(endpoint);
  },

  /**
   * Quick search endpoint
   */
  async searchAlumni(q) {
    return fetchJson(`/api/alumni/search?q=${encodeURIComponent(q || '')}`);
  },

  /**
   * Get single alumni details by ID
   */
  async getAlumniById(id) {
    return fetchJson(`/api/alumni/${encodeURIComponent(id)}`);
  },

  /**
   * Get list of all companies with alumni counts
   */
  async getCompanies() {
    return fetchJson('/api/companies');
  },

  /**
   * Get alumni working at a specific company
   */
  async getCompanyAlumni(companyName) {
    return fetchJson(`/api/companies/${encodeURIComponent(companyName)}/alumni`);
  },

  /**
   * Get platform statistics (totals, departments, years)
   */
  async getStats() {
    return fetchJson('/api/stats');
  },

  /**
   * Get network graph data (nodes & links)
   */
  async getNetworkGraph() {
    return fetchJson('/api/stats/graph');
  },

  /**
   * Create or register new Alumni / Student in Neo4j (DA3 CRUD write persistence)
   */
  async createProfile(profileData) {
    return fetchJson('/api/alumni', {
      method: 'POST',
      body: JSON.stringify(profileData),
    });
  },

  /**
   * Authenticate via Google OAuth credential token
   */
  async googleLogin(credential, metadata = {}) {
    return fetchJson('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({
        credential,
        ...metadata,
      }),
    });
  },

  /**
   * Authenticate via standard email/password or demo login
   */
  async login(credentials) {
    return fetchJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  /**
   * Register a new user with secure password hashing
   */
  async register(registrationData) {
    return fetchJson('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(registrationData),
    });
  },

  /**
   * Set or update password for authenticated user
   */
  async setPassword(password) {
    return fetchJson('/api/auth/set-password', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
  },

  /**
   * Request password setup / reset token for an account
   */
  async requestPasswordReset(email) {
    return fetchJson('/api/auth/request-password-reset', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  /**
   * Complete password reset using verified single-use token
   */
  async resetPassword(token, password) {
    return fetchJson('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },

  /**
   * Verify session token and retrieve current user
   */
  async getMe() {
    return fetchJson('/api/auth/me');
  },

  // -------------------------------------------------------------------------
  // MENTORSHIP REQUESTS API
  // -------------------------------------------------------------------------

  /**
   * Submit a new mentorship request from signed-in student to an alumni
   */
  async sendMentorshipRequest(recipientId, payload, explicitToken = null) {
    return fetchJson('/api/mentorship/requests', {
      method: 'POST',
      token: explicitToken,
      body: JSON.stringify({
        recipientId,
        message: payload.message,
      }),
    });
  },

  /**
   * Get incoming mentorship requests (for signed-in alumni)
   */
  async getIncomingMentorshipRequests() {
    return fetchJson('/api/mentorship/incoming');
  },

  /**
   * Get sent mentorship requests (for signed-in student)
   */
  async getSentMentorshipRequests() {
    return fetchJson('/api/mentorship/sent');
  },

  /**
   * Accept or decline a mentorship request
   */
  async respondMentorshipRequest(requestId, action) {
    return fetchJson(`/api/mentorship/requests/${encodeURIComponent(requestId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    });
  },

  /**
   * Get unread mentorship requests and chat message counts
   */
  async getMentorshipUnreadCount() {
    return fetchJson('/api/mentorship/unread-count');
  },

  // -------------------------------------------------------------------------
  // PRIVATE CHAT API
  // -------------------------------------------------------------------------

  /**
   * Get all active conversations for the authenticated user
   */
  async getConversations() {
    return fetchJson('/api/chat/conversations');
  },

  /**
   * Get chronological messages for a conversation
   */
  async getMessages(conversationId) {
    return fetchJson(`/api/chat/conversations/${encodeURIComponent(conversationId)}/messages`);
  },

  /**
   * Send a private message inside a conversation
   */
  async sendMessage(conversationId, text) {
    return fetchJson(`/api/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },

  /**
   * Legacy express interest endpoint (preserved for backward compatibility)
   */
  async expressInterest(alumniId, payload) {
    return fetchJson(`/api/alumni/${encodeURIComponent(alumniId)}/interest`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

export default api;
