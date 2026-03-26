import { useState, useEffect } from 'react';
import { authService } from '@/services/authService';

/**
 * Custom hook for authentication management
 * Provides authentication state and token access throughout the application
 */
export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userData, setUserData] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const checkAuthStatus = () => {
      const authStatus = authService.getAuthStatus();
      const user = authService.getUserData();
      const authToken = authService.getToken();

      setIsAuthenticated(authStatus);
      setUserData(user);
      setToken(authToken);
    };

    // Logout callback to handle automatic logout
    const handleLogout = () => {
      setIsAuthenticated(false);
      setUserData(null);
      setToken(null);
      // Let the Layout component handle the redirection
    };

    // Register logout callback
    authService.onLogout(handleLogout);

    // Initial auth check and session data fetch
    const initializeAuth = async () => {
      checkAuthStatus();
      // If authenticated, fetch session data to get user details
      if (authService.getAuthStatus()) {
        await authService.getSessionData();
        checkAuthStatus(); // Update state with fresh data
      }
    };

    initializeAuth();

    // Set up interval to check token validity periodically
    const interval = setInterval(checkAuthStatus, 60000); // Check every minute

    return () => {
      clearInterval(interval);
      // Note: In a real app, you might want to unregister the callback
    };
  }, []);

  /**
   * Gets the current authentication token
   * @returns {string|null} Authentication token or null if not available
   */
  const getToken = () => {
    return authService.getToken();
  };

  /**
   * Validates the current token with the server
   * @returns {Promise<boolean>} True if token is valid
   */
  const validateToken = async () => {
    const isValid = await authService.validateToken();
    setIsAuthenticated(isValid);
    if (!isValid) {
      setToken(null);
      setUserData(null);
    }
    return isValid;
  };

  /**
   * Logs out the user
   */
  const logout = () => {
    authService.logout();
    setIsAuthenticated(false);
    setUserData(null);
    setToken(null);
  };

  return {
    isAuthenticated,
    userData,
    token,
    getToken,
    validateToken,
    logout
  };
}

export default useAuth;
