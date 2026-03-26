/**
 * Hook for fetching entity data (Broker, DSP, Company, Site, Placement, Realm)
 * Centralizes loading, error, 401 handling, and refetch logic
 */

import { useState, useEffect, useCallback } from 'react';
import { authService } from '@/services/authService';
import { apiFetchJson } from '@/services/apiClient';

/**
 * @param {Object} options
 * @param {string|null} options.entityId - Entity ID (triggers fetch when set)
 * @param {string|Function} options.url - API URL or (entityId) => url
 * @param {Function} [options.dataExtractor] - (data) => entityData. Default: (d) => d.Data ?? d.data
 * @param {Function} [options.getToken] - () => token. Default: authService.getToken
 * @param {Function} [options.onUnauthorized] - (navigate) => void. Called on 401
 * @returns {{ data: any, loading: boolean, error: string|null, refetch: () => Promise<void> }}
 */
export function useEntityFetch({
  entityId,
  url,
  dataExtractor,
  getToken,
  onUnauthorized,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const defaultDataExtractor = useCallback((d) => d.Data ?? d.data ?? d, []);
  const defaultGetToken = useCallback(() => authService.getToken(), []);
  const resolvedDataExtractor = dataExtractor ?? defaultDataExtractor;
  const resolvedGetToken = getToken ?? defaultGetToken;

  const fetchEntity = useCallback(async () => {
    if (!entityId) {
      setData(null);
      setError(null);
      return;
    }

    const resolvedUrl = typeof url === 'function' ? url(entityId) : url;
    if (!resolvedUrl) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = resolvedGetToken();
      if (!token) {
        setError('Authentication required');
        setLoading(false);
        return;
      }

      const { data: responseData } = await apiFetchJson(resolvedUrl, {
        token,
        method: 'GET',
      });

      setData(resolvedDataExtractor(responseData));
    } catch (err) {
      if (err.message?.includes('401') || err.message?.includes('Unauthorized')) {
        onUnauthorized?.();
      }
      setError(err.message || 'Failed to fetch data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [entityId, url, resolvedDataExtractor, resolvedGetToken, onUnauthorized]);

  useEffect(() => {
    fetchEntity();
  }, [fetchEntity]);

  return { data, loading, error, refetch: fetchEntity };
}
