/**
 * Error Formatter Utility
 * 
 * Formats error messages with detailed information for better user experience.
 * Centralized error handling for consistent error messages across the application.
 */

/**
 * Format error message with detailed information
 * @param {Error|Object} err - The error object
 * @param {Response|null} response - The HTTP response object (if available)
 * @returns {string} - Formatted error message
 */
export const formatError = (err, response = null) => {
  // Handle case where err might be null or undefined
  if (!err) {
    return 'An unexpected error occurred. Please try again later.';
  }

  // Check for CORS errors
  const errorMessage = err.message || err.toString() || '';
  if (errorMessage && (
    errorMessage.includes('CORS') || 
    errorMessage.includes('Failed to fetch') ||
    errorMessage.includes('NetworkError') ||
    errorMessage.includes('Network request failed') ||
    errorMessage.includes('NetworkError when attempting to fetch resource')
  )) {
    return 'CORS error: The API is currently unavailable. Please try again later.';
  }

  // Check for HTTP status errors
  if (response) {
    const status = response.status;
    if (status === 503) {
      return 'Error 503: Service Unavailable - The API is currently unavailable. Please try again later.';
    }
    if (status === 502) {
      return 'Error 502: Bad Gateway - The backend service is temporarily unavailable.';
    }
    if (status === 500) {
      return 'Error 500: Internal Server Error - The backend encountered an error. Please try again later.';
    }
    if (status === 401) {
      return 'Error 401: Unauthorized - Please refresh the page and log in again.';
    }
    if (status === 404) {
      return 'Error 404: Not Found - The requested resource was not found.';
    }
    if (status === 403) {
      return 'Error 403: Forbidden - You do not have permission to access this resource.';
    }
    if (status === 429) {
      return 'Error 429: Too Many Requests - Please wait a moment and try again.';
    }
    return `Error ${status}: The API returned an error. Please try again later.`;
  }

  // Generic error message
  if (errorMessage) {
    return `Error: ${errorMessage}`;
  }

  return 'An unexpected error occurred. Please try again later.';
};

/**
 * Helper function to handle fetch errors with proper error formatting
 * @param {Promise<Response>} fetchPromise - The fetch promise
 * @returns {Promise<{response: Response, error: null}|{response: null, error: string}>}
 */
export const handleFetchError = async (fetchPromise) => {
  try {
    const response = await fetchPromise;
    if (!response.ok) {
      return { response, error: formatError(new Error(`HTTP error! status: ${response.status}`), response) };
    }
    return { response, error: null };
  } catch (fetchError) {
    return { response: null, error: formatError(fetchError, null) };
  }
};

