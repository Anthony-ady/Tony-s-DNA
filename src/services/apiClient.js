/**
 * Centralized API client
 * Handles auth headers, Content-Type, and consistent error handling
 */

import { authService } from './authService';

const defaultHeaders = {
  'Content-Type': 'application/json',
};

/**
 * Get headers with auth token
 * @param {string} [token] - Optional token override (default: from authService)
 */
function getAuthHeaders(token) {
  const authToken = token || authService.getToken();
  return {
    ...defaultHeaders,
    ...(authToken && { 'x-ayl-auth-token': authToken }),
  };
}

/**
 * GET request with auth
 * @param {string} url - Request URL
 * @param {Object} [options] - Fetch options
 * @param {string} [options.token] - Optional token override
 * @returns {Promise<Response>}
 */
export async function apiGet(url, { token, ...fetchOptions } = {}) {
  return fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(token),
    ...fetchOptions,
  });
}

/**
 * POST request with auth
 * @param {string} url - Request URL
 * @param {Object} [body] - Request body (will be JSON.stringify'd)
 * @param {Object} [options] - Fetch options
 * @param {string} [options.token] - Optional token override
 * @returns {Promise<Response>}
 */
export async function apiPost(url, body = null, { token, ...fetchOptions } = {}) {
  return fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: body != null ? JSON.stringify(body) : undefined,
    ...fetchOptions,
  });
}

/**
 * PUT request with auth
 * @param {string} url - Request URL
 * @param {Object} [body] - Request body
 * @param {Object} [options] - Fetch options
 * @returns {Promise<Response>}
 */
export async function apiPut(url, body = null, { token, ...fetchOptions } = {}) {
  return fetch(url, {
    method: 'PUT',
    headers: getAuthHeaders(token),
    body: body != null ? JSON.stringify(body) : undefined,
    ...fetchOptions,
  });
}

/**
 * PATCH request with auth
 * @param {string} url - Request URL
 * @param {Object} [body] - Request body
 * @param {Object} [options] - Fetch options
 * @returns {Promise<Response>}
 */
export async function apiPatch(url, body = null, { token, ...fetchOptions } = {}) {
  return fetch(url, {
    method: 'PATCH',
    headers: getAuthHeaders(token),
    body: body != null ? JSON.stringify(body) : undefined,
    ...fetchOptions,
  });
}

/**
 * Fetch JSON and handle 401 (redirect handled by authService interceptor)
 * @param {string} url - Request URL
 * @param {Object} [options] - { token, method, body }
 * @returns {Promise<{ data: any, response: Response }>}
 * @throws {Error} on non-2xx response
 */
export async function apiFetchJson(url, { token, method = 'GET', body = null } = {}) {
  const headers = getAuthHeaders(token);
  const fetchOptions = {
    method,
    headers,
    ...(body != null && method !== 'GET' && { body: JSON.stringify(body) }),
  };

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    if (response.status === 401) {
      authService.handleAuthError(response);
    }
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { message: errorText };
    }
    throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return { data, response };
}
