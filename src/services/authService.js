/**
 * Authentication Service
 * Handles user authentication, token management, and API communication
 */

// Configuration constants
const AUTH_CONFIG = {
  API_BASE_URL: 'https://back.platform.gcp.omnitagjs.com/bo-api',
  LOGIN_ENDPOINT: '/auth/login',
  TOKEN_STORAGE_KEY: 'ayl_auth_token',
  TOKEN_EXPIRY_KEY: 'ayl_token_expiry',
  USER_STORAGE_KEY: 'ayl_user_data'
};

/**
 * Authentication Service Class
 * Provides methods for login, logout, token management, and authentication state
 */
class AuthService {
  constructor() {
    this.isAuthenticated = this.checkTokenValidity();
    this.logoutCallbacks = []; // Array to store logout callback functions
    this.SESSION_CACHE_KEY = 'user-session-cache';
    this._unauthorizedInterceptorInstalled = false;
  }

  getCachedSession() {
    const raw = localStorage.getItem(this.SESSION_CACHE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn('Invalid cached session, clearing cache.', error);
      localStorage.removeItem(this.SESSION_CACHE_KEY);
      return null;
    }
  }

  setCachedSession(session) {
    try {
      localStorage.setItem(this.SESSION_CACHE_KEY, JSON.stringify(session));
    } catch (error) {
      console.warn('Unable to cache session data.', error);
    }
  }

  clearSessionCache() {
    localStorage.removeItem(this.SESSION_CACHE_KEY);
  }

  /**
   * Registers a callback function to be called when user is logged out
   * @param {Function} callback - Function to call on logout
   */
  onLogout(callback) {
    this.logoutCallbacks.push(callback);
  }

  /**
   * Calls all registered logout callbacks
   */
  triggerLogoutCallbacks() {
    this.logoutCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('Error in logout callback:', error);
      }
    });
  }

  /**
   * Performs user login with email and password
   * @param {string} email - User email address
   * @param {string} password - User password
   * @returns {Promise<Object>} Login response with user data and token
   */
  async login(email, password) {
    try {
      const response = await fetch(`${AUTH_CONFIG.API_BASE_URL}${AUTH_CONFIG.LOGIN_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Email: email.trim(),
          Password: password.trim(),
          Realm: 'edea93ac85495750f5f983ace20d848a' // Default realm from your URL
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Login failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Store authentication data
      if (data.Token) {
        this.setToken(data.Token, data.expiresIn);
        this.setUserData(data.user || data.User);
        this.isAuthenticated = true;
      }

      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Performs Google OAuth login
   * @param {string} code - OAuth authorization code
   * @returns {Promise<Object>} Login response
   */
  async loginWithGoogle(code) {
    try {
      const response = await fetch(`${AUTH_CONFIG.API_BASE_URL}/auth/login/google_oauth?realm=edea93ac85495750f5f983ace20d848a`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code })
      });

      if (!response.ok) {
        throw new Error(`Google OAuth login failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.Token) {
        this.setToken(data.Token, data.expiresIn);
        this.setUserData(data.user || data.User);
        this.isAuthenticated = true;
      }

      return data;
    } catch (error) {
      console.error('Google OAuth login error:', error);
      throw error;
    }
  }

  /**
   * Fetches current session information from the API
   * @returns {Promise<Object|null>} Session data or null if failed
   */
  async getSessionData(forceRefresh = false) {
    const token = this.getToken();
    if (!token) return null;

    if (!forceRefresh) {
      const cached = this.getCachedSession();
      if (cached) {
        if (cached.CurrentUser) {
          this.setUserData(cached.CurrentUser);
          this.isAuthenticated = true;
        }
        return cached;
      }
    }

    try {
      const response = await fetch(`${AUTH_CONFIG.API_BASE_URL}/session`, {
        method: 'GET',
        headers: {
          'x-ayl-auth-token': token,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.logout();
        }
        this.clearSessionCache();
        return null;
      }

      const sessionData = await response.json();
      
      // Extract user data and store it
      if (sessionData.CurrentUser) {
        this.setUserData(sessionData.CurrentUser);
        this.isAuthenticated = true;
      }

      this.setCachedSession(sessionData);

      return sessionData;
    } catch (error) {
      console.error('Session data fetch error:', error);
      this.clearSessionCache();
      return null;
    }
  }

  /**
   * Validates the current token by fetching session data
   * @returns {Promise<boolean>} True if token is valid, false otherwise
   */
  async validateToken() {
    const sessionData = await this.getSessionData(true);
    return sessionData !== null;
  }

  /**
   * Stores authentication token in localStorage with expiry
   * @param {string} token - Authentication token
   * @param {number} expiresIn - Token expiry time in seconds
   */
  setToken(token, expiresIn = 3600) {
    const expiryTime = Date.now() + (expiresIn * 1000);
    localStorage.setItem(AUTH_CONFIG.TOKEN_STORAGE_KEY, token);
    localStorage.setItem(AUTH_CONFIG.TOKEN_EXPIRY_KEY, expiryTime.toString());
  }

  /**
   * Retrieves authentication token from localStorage
   * @returns {string|null} Authentication token or null if not found/expired
   */
  getToken() {
    const token = localStorage.getItem(AUTH_CONFIG.TOKEN_STORAGE_KEY);
    const expiry = localStorage.getItem(AUTH_CONFIG.TOKEN_EXPIRY_KEY);
    
    if (!token || !expiry) return null;
    
    // Check if token has expired
    if (Date.now() > parseInt(expiry)) {
      this.logout();
      return null;
    }
    
    return token;
  }

  /**
   * Stores user data in localStorage
   * @param {Object} userData - User information object
   */
  setUserData(userData) {
    if (userData && typeof userData === 'object') {
      localStorage.setItem(AUTH_CONFIG.USER_STORAGE_KEY, JSON.stringify(userData));
    } else {
      // Clear user data if invalid
      localStorage.removeItem(AUTH_CONFIG.USER_STORAGE_KEY);
    }
  }

  /**
   * Retrieves user data from localStorage
   * @returns {Object|null} User data or null if not found
   */
  getUserData() {
    const userData = localStorage.getItem(AUTH_CONFIG.USER_STORAGE_KEY);
    if (!userData || userData === 'undefined' || userData === 'null') {
      return null;
    }
    try {
      return JSON.parse(userData);
    } catch (error) {
      console.error('Error parsing user data:', error);
      // Clear invalid data
      localStorage.removeItem(AUTH_CONFIG.USER_STORAGE_KEY);
      return null;
    }
  }

  /**
   * Checks if the current token is valid (not expired)
   * @returns {boolean} True if token exists and is not expired
   */
  checkTokenValidity() {
    const token = this.getToken();
    return token !== null;
  }

  /**
   * Logs out the user and clears all stored authentication data
   */
  logout() {
    localStorage.removeItem(AUTH_CONFIG.TOKEN_STORAGE_KEY);
    localStorage.removeItem(AUTH_CONFIG.TOKEN_EXPIRY_KEY);
    localStorage.removeItem(AUTH_CONFIG.USER_STORAGE_KEY);
    this.clearSessionCache();
    this.isAuthenticated = false;
    
    // Trigger logout callbacks to notify components
    this.triggerLogoutCallbacks();
  }

  /**
   * Checks if a response indicates an authentication error
   * @param {Response|Object} response - API response or error object
   * @returns {boolean} True if the response indicates authentication failure
   */
  isUnauthorizedResponse(response) {
    // Check for HTTP 401 status
    if (response && response.status === 401) {
      return true;
    }
    
    // Check for JSON response with error field
    if (response && typeof response === 'object') {
      const responseData = response.data || response;
      if (responseData.error === 'Unauthorized' || 
          responseData.error === 'unauthorized' ||
          responseData.message === 'Unauthorized' ||
          responseData.message === 'unauthorized') {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Handles authentication errors by logging out the user
   * @param {Response|Object} response - API response or error object
   * @returns {boolean} True if the user was logged out
   */
  handleAuthError(response) {
    if (this.isUnauthorizedResponse(response)) {
      console.warn('Authentication error detected, logging out user');
      this.logout();
      return true;
    }
    return false;
  }

  /**
   * Gets the current authentication status
   * @returns {boolean} True if user is authenticated
   */
  getAuthStatus() {
    return this.isAuthenticated && this.checkTokenValidity();
  }

  /**
   * Handles 401 errors by logging out and redirecting to login
   * @param {Function} navigate - React Router navigate function
   */
  handleUnauthorized(navigate) {
    console.log('Unauthorized access detected, redirecting to login...');
    this.logout();
    if (navigate) {
      navigate('/login');
    }
  }

  /**
   * Installs a global fetch interceptor to automatically handle unauthorized responses
   */
  installUnauthorizedInterceptor() {
    if (this._unauthorizedInterceptorInstalled) {
      return;
    }

    if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
      return;
    }

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (...args) => {
      const response = await originalFetch(...args);

      if (response && response.status === 401) {
        const alreadyLoggedOut = !this.isAuthenticated;
        this.logout();

        if (!alreadyLoggedOut) {
          const eventDetail = { url: args[0], status: response.status };
          window.dispatchEvent(new CustomEvent('auth-unauthorized', { detail: eventDetail }));
        }
      }

      return response;
    };

    this._unauthorizedInterceptorInstalled = true;
  }
}

// Create and export a singleton instance
export const authService = new AuthService();

// Export the class for testing purposes
export default AuthService;
