/**
 * API Cache Utility
 * 
 * This utility allows caching API responses to local files to avoid
 * making repeated API calls during development and testing.
 * 
 * Usage:
 * - Enable cache by setting localStorage.setItem('apiCacheEnabled', 'true')
 * - Cache files are stored in the browser's IndexedDB or localStorage
 * - Cache keys are based on URL and request body
 */

// Check if cache is enabled (default: ON, can be disabled via localStorage)
const isCacheEnabled = () => {
  if (typeof window === 'undefined') return false;
  const cacheSetting = localStorage.getItem('apiCacheEnabled');
  // Default to enabled if not set, or if explicitly set to 'true'
  return cacheSetting === null || cacheSetting === 'true';
};

// Generate a cache key from URL and request body
const generateCacheKey = (url, method = 'GET', body = null) => {
  const bodyStr = body ? JSON.stringify(body) : '';
  return `${method}:${url}:${bodyStr}`;
};

/**
 * Hourly (PT1H) = “Real-time” in dashboards. Must not use long-lived localStorage cache
 * (exact or covering) or the UI shows stale intraday data until full reload.
 */
export const isDruidHourlyRequestBody = (body) => {
  if (!body || typeof body !== 'object') return false;
  const g = body.Granularity;
  if (g == null) return false;
  if (typeof g === 'string') return /^PT1H$/i.test(g) || g === 'hour' || g === 'hourly';
  if (typeof g === 'object' && (g.type === 'period' || g.period)) {
    const p = g.period || g.Period;
    if (typeof p === 'string' && /^PT1H$/i.test(p)) return true;
  }
  return false;
};

// Get cache from localStorage (limited to ~5-10MB)
const getCachedData = (cacheKey) => {
  if (!isCacheEnabled() || typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(`apiCache:${cacheKey}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Check if cache is still valid (optional: add expiration)
      return parsed.data;
    }
  } catch (error) {
    console.warn('Error reading from cache:', error);
  }
  
  return null;
};

// Save data to cache
const saveToCache = (cacheKey, data) => {
  if (!isCacheEnabled() || typeof window === 'undefined') return;
  
  try {
    const cacheEntry = {
      data,
      timestamp: new Date().toISOString(),
      cacheKey
    };
    localStorage.setItem(`apiCache:${cacheKey}`, JSON.stringify(cacheEntry));
    console.log('💾 Cached API response:', cacheKey);
  } catch (error) {
    // If localStorage is full, try to clear old entries
    if (error.name === 'QuotaExceededError') {
      console.warn('⚠️ LocalStorage full, clearing old cache entries...');
      clearOldCacheEntries();
      // Retry once
      try {
        localStorage.setItem(`apiCache:${cacheKey}`, JSON.stringify(cacheEntry));
      } catch (retryError) {
        console.error('Failed to save to cache after cleanup:', retryError);
      }
    } else {
      console.warn('Error saving to cache:', error);
    }
  }
};

// Clear old cache entries (keep last 50)
const clearOldCacheEntries = () => {
  if (typeof window === 'undefined') return;
  
  try {
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter(k => k.startsWith('apiCache:'));
    
    if (cacheKeys.length > 50) {
      // Sort by timestamp and remove oldest
      const entries = cacheKeys.map(key => {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          return { key, timestamp: data.timestamp };
        } catch {
          return { key, timestamp: '0' };
        }
      }).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      // Remove oldest entries
      const toRemove = entries.slice(0, entries.length - 50);
      toRemove.forEach(({ key }) => localStorage.removeItem(key));
      console.log(`🗑️ Cleared ${toRemove.length} old cache entries`);
    }
  } catch (error) {
    console.error('Error clearing old cache:', error);
  }
};

// Export cache to JSON file (for download)
export const exportCache = () => {
  if (typeof window === 'undefined') return;
  
  try {
    const keys = Object.keys(localStorage);
    const cacheEntries = {};
    
    keys.filter(k => k.startsWith('apiCache:')).forEach(key => {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        cacheEntries[key.replace('apiCache:', '')] = data;
      } catch (e) {
        // Skip invalid entries
      }
    });
    
    const blob = new Blob([JSON.stringify(cacheEntries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-cache-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('📥 Cache exported to file');
  } catch (error) {
    console.error('Error exporting cache:', error);
  }
};

// Import cache from JSON file
export const importCache = (jsonData) => {
  if (typeof window === 'undefined') return;
  
  try {
    const cacheData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    let imported = 0;
    
    Object.entries(cacheData).forEach(([key, value]) => {
      try {
        localStorage.setItem(`apiCache:${key}`, JSON.stringify(value));
        imported++;
      } catch (e) {
        console.warn(`Failed to import cache entry: ${key}`, e);
      }
    });
    
    console.log(`📤 Imported ${imported} cache entries`);
    return imported;
  } catch (error) {
    console.error('Error importing cache:', error);
    return 0;
  }
};

// Clear all cache
export const clearCache = () => {
  if (typeof window === 'undefined') return;
  
  try {
    const keys = Object.keys(localStorage);
    keys.filter(k => k.startsWith('apiCache:')).forEach(key => localStorage.removeItem(key));
    console.log('🗑️ Cache cleared');
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
};

// Extract date range from Druid API payload
const extractDateRange = (body) => {
  if (!body || typeof body !== 'object') return null;
  try {
    const intervals = body.Intervals || body.intervals;
    if (intervals && intervals.length > 0) {
      const interval = intervals[0];
      return {
        begin: interval.Begin || interval.begin,
        end: interval.End || interval.end
      };
    }
  } catch (e) {
    // Not a Druid request or invalid format
  }
  return null;
};

// Check if a date range is contained within another
const isDateRangeContained = (requestedRange, cachedRange) => {
  if (!requestedRange || !cachedRange) return false;
  const reqBegin = new Date(requestedRange.begin);
  const reqEnd = new Date(requestedRange.end);
  const cacheBegin = new Date(cachedRange.begin);
  const cacheEnd = new Date(cachedRange.end);
  
  return reqBegin >= cacheBegin && reqEnd <= cacheEnd;
};

// Filter data by date range (for Druid responses)
const filterDataByDateRange = (data, requestedRange) => {
  if (!Array.isArray(data) || !requestedRange) return data;
  
  const reqBegin = new Date(requestedRange.begin);
  const reqEnd = new Date(requestedRange.end);
  
  return data.filter(item => {
    if (!item.timestamp) return false;
    const itemDate = new Date(item.timestamp);
    return itemDate >= reqBegin && itemDate <= reqEnd;
  });
};

// Find cached data that covers the requested date range
const findCoveringCache = (url, method, requestedBody) => {
  if (!isCacheEnabled() || typeof window === 'undefined') return null;
  
  const requestedRange = extractDateRange(requestedBody);
  if (!requestedRange) return null; // Not a date-based request
  
  try {
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter(k => k.startsWith('apiCache:'));
    
    for (const key of cacheKeys) {
      try {
        const cached = JSON.parse(localStorage.getItem(key));
        if (!cached || !cached.cacheKey) continue;
        
        // Parse the cached request to get its date range
        const cacheKeyParts = cached.cacheKey.split(':');
        if (cacheKeyParts.length < 3) continue;
        
        const cachedBodyStr = cacheKeyParts.slice(2).join(':');
        const cachedBody = JSON.parse(cachedBodyStr);
        const cachedRange = extractDateRange(cachedBody);
        
        // Check if cached range covers requested range
        if (cachedRange && isDateRangeContained(requestedRange, cachedRange)) {
          // Also check if it's the same endpoint and datasource
          const cachedUrl = cacheKeyParts[1];
          if (cachedUrl === url) {
            // Check if datasource matches (for Druid requests)
            const requestedDatasource = requestedBody?.Datasource || requestedBody?.datasource;
            const cachedDatasource = cachedBody?.Datasource || cachedBody?.datasource;
            if (requestedDatasource && cachedDatasource && requestedDatasource !== cachedDatasource) {
              continue; // Different datasource, skip
            }
            
            // Check if granularity matches (important for filtering)
            const requestedGranularity = requestedBody?.Granularity?.period || requestedBody?.granularity?.period;
            const cachedGranularity = cachedBody?.Granularity?.period || cachedBody?.granularity?.period;
            if (requestedGranularity && cachedGranularity && requestedGranularity !== cachedGranularity) {
              continue; // Different granularity, can't reuse
            }
            
            console.log('📦 Found covering cache entry:', cachedRange, 'covers', requestedRange);
            return { data: cached.data, cachedRange };
          }
        }
      } catch (e) {
        // Skip invalid cache entries
        continue;
      }
    }
  } catch (error) {
    console.warn('Error searching for covering cache:', error);
  }
  
  return null;
};

// Smart cache for hourly data: use cache for old data (48h+) and fetch fresh data for today
const smartHourlyCache = async (url, options, requestedBody) => {
  if (!isCacheEnabled() || typeof window === 'undefined') return null;
  
  const requestedRange = extractDateRange(requestedBody);
  if (!requestedRange) return null;
  
  const requestedGranularity = requestedBody?.Granularity?.period || requestedBody?.granularity?.period;
  if (requestedGranularity !== 'PT1H') return null; // Only for hourly data
  
  const now = new Date();
  const reqBegin = new Date(requestedRange.begin);
  const reqEnd = new Date(requestedRange.end);
  
  // Calculate cutoff time: data older than 2 hours can be from cache
  const cutoffTime = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
  
  // Find cached data that covers the old part of the requested range
  const oldRangeBegin = reqBegin;
  const oldRangeEnd = new Date(Math.min(reqEnd.getTime(), cutoffTime.getTime()));
  
  if (oldRangeEnd <= oldRangeBegin) {
    // All requested data is recent, no cache to use
    return null;
  }
  
  // Look for cached data that covers the old period
  const oldRangePayload = {
    ...requestedBody,
    Intervals: [{
      Begin: oldRangeBegin.toISOString(),
      End: oldRangeEnd.toISOString()
    }]
  };
  
  const coveringCache = findCoveringCache(url, 'POST', oldRangePayload);
  if (!coveringCache) {
    return null; // No cache found for old data
  }
  
  // Extract old data from cache
  const oldData = filterDataByDateRange(coveringCache.data, {
    begin: oldRangeBegin.toISOString(),
    end: oldRangeEnd.toISOString()
  });
  
  // Calculate fresh data range (last 2 hours or from cutoff to end)
  const freshRangeBegin = cutoffTime;
  const freshRangeEnd = reqEnd;
  
  if (freshRangeEnd <= freshRangeBegin) {
    // No fresh data needed, return all from cache
    console.log(`📦 Using full cache for hourly data: ${oldData.length} items`);
    return {
      ok: true,
      status: 200,
      json: async () => oldData,
      text: async () => JSON.stringify(oldData),
      headers: new Headers(),
      clone: () => ({ ok: true, status: 200, json: async () => oldData })
    };
  }
  
  // Make API call only for fresh data
  const freshPayload = {
    ...requestedBody,
    Intervals: [{
      Begin: freshRangeBegin.toISOString(),
      End: freshRangeEnd.toISOString()
    }]
  };
  
  console.log(`🔄 Smart cache: Using ${oldData.length} cached items + fetching fresh data for last 2 hours`);
  
  try {
    const freshResponse = await fetch(url, {
      ...options,
      body: JSON.stringify(freshPayload)
    });
    
    if (!freshResponse.ok) {
      // If fresh fetch fails, return cached data only
      console.warn('⚠️ Fresh data fetch failed, using cached data only');
      return {
        ok: true,
        status: 200,
        json: async () => oldData,
        text: async () => JSON.stringify(oldData),
        headers: new Headers(),
        clone: () => ({ ok: true, status: 200, json: async () => oldData })
      };
    }
    
    const freshData = await freshResponse.json();
    
    // Merge old cached data with fresh data
    const mergedData = [...oldData, ...freshData].sort((a, b) => {
      const dateA = new Date(a.timestamp);
      const dateB = new Date(b.timestamp);
      return dateA - dateB;
    });
    
    // Cache the merged result for future use
    const fullCacheKey = generateCacheKey(url, 'POST', requestedBody);
    saveToCache(fullCacheKey, mergedData);
    
    console.log(`✅ Merged ${oldData.length} cached + ${freshData.length} fresh = ${mergedData.length} total items`);
    
    return {
      ok: true,
      status: 200,
      json: async () => mergedData,
      text: async () => JSON.stringify(mergedData),
      headers: new Headers(),
      clone: () => ({ ok: true, status: 200, json: async () => mergedData })
    };
  } catch (error) {
    console.error('Error in smart hourly cache:', error);
    // Fallback to cached data only
    return {
      ok: true,
      status: 200,
      json: async () => oldData,
      text: async () => JSON.stringify(oldData),
      headers: new Headers(),
      clone: () => ({ ok: true, status: 200, json: async () => oldData })
    };
  }
};

// Track in-flight requests to dedupe identical calls
const inFlightRequests = new Map();

// Wrapper for fetch that uses cache
export const cachedFetch = async (url, options = {}) => {
  const method = options.method || 'GET';
  const body = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : null;
  const cacheKey = generateCacheKey(url, method, body);
  const skipClientCache = isDruidHourlyRequestBody(body);

  if (skipClientCache) {
    console.log('⏱️ Real-time (PT1H): bypassing localStorage API cache for:', url);
  }

  // Try to get from cache first (exact match) — never for hourly granularity
  if (isCacheEnabled() && !skipClientCache) {
    const cached = getCachedData(cacheKey);
    if (cached) {
      console.log('📦 Using exact cached response for:', url);
      return {
        ok: true,
        status: 200,
        json: async () => cached,
        text: async () => JSON.stringify(cached),
        headers: new Headers(),
        clone: () => ({ ok: true, status: 200, json: async () => cached })
      };
    }
    
    // Smart cache for hourly data: use cache for old data, fetch fresh for recent
    if (method === 'POST' && body) {
      const smartCacheResult = await smartHourlyCache(url, options, body);
      if (smartCacheResult) {
        return smartCacheResult;
      }
      
      // Try to find a covering cache (longer period that contains this period)
      const coveringCache = findCoveringCache(url, method, body);
      if (coveringCache) {
        const requestedRange = extractDateRange(body);
        const filteredData = filterDataByDateRange(coveringCache.data, requestedRange);
        
        console.log(`📦 Using covering cache: ${coveringCache.data.length} items filtered to ${filteredData.length} items`);
        
        return {
          ok: true,
          status: 200,
          json: async () => filteredData,
          text: async () => JSON.stringify(filteredData),
          headers: new Headers(),
          clone: () => ({ ok: true, status: 200, json: async () => filteredData })
        };
      }
    }
  }

  // Deduplicate in-flight requests with same cache key
  if (inFlightRequests.has(cacheKey)) {
    const inflight = inFlightRequests.get(cacheKey);
    return inflight.then(({ ok, status, data }) => ({
      ok,
      status,
      json: async () => data,
      text: async () => JSON.stringify(data),
      headers: new Headers(),
      clone: () => ({ ok, status, json: async () => data })
    }));
  }
  
  // Make actual API call
  console.log('🌐 Making API call:', url);
  let resolveInflight;
  const inflightPromise = new Promise((resolve) => {
    resolveInflight = resolve;
  });
  inFlightRequests.set(cacheKey, inflightPromise);

  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    resolveInflight({ ok: false, status: 0, data: null });
    inFlightRequests.delete(cacheKey);
    throw error;
  }
  
  // Cache successful responses (skip hourly: would freeze “today” in localStorage)
  let dataForCache = null;
  try {
    dataForCache = await response.clone().json();
    if (response.ok && isCacheEnabled() && !skipClientCache) {
      saveToCache(cacheKey, dataForCache);
    }
  } catch (e) {
    try {
      const text = await response.clone().text();
      dataForCache = text;
      if (response.ok && isCacheEnabled() && !skipClientCache) {
        saveToCache(cacheKey, text);
      }
    } catch (e2) {
      // Skip caching if we can't parse the response
    }
  } finally {
    resolveInflight({ ok: response.ok, status: response.status, data: dataForCache });
    inFlightRequests.delete(cacheKey);
  }
  
  return response;
};

// Enable/disable cache
export const enableCache = () => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('apiCacheEnabled', 'true');
    console.log('✅ API cache enabled');
  }
};

export const disableCache = () => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('apiCacheEnabled', 'false');
    console.log('❌ API cache disabled');
  }
};

// Check cache status
export const isCacheEnabledCheck = () => isCacheEnabled();

