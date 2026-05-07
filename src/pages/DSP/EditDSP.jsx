
/**
 * DSP Page Component
 * 
 * This page provides a comprehensive interface for managing DSP (Demand-Side Platform) configurations.
 * It allows users to input partner ID and authentication token, execute API requests to retrieve DSP data,
 * and manage various DSP settings including status, endpoints, debug modes, targeting rules, and inventory access.
 * 
 * Features:
 * - DSP data retrieval via API
 * - DSP configuration management
 * - Partner endpoint management (add/remove/update)
 * - Debug mode configuration
 * - QPS (Queries Per Second) limit management
 * - SNI (Server Name Indication) settings
 * - Connector kind management
 * - Targeting rules management (countries, devices, site domains, app bundles)
 * - Inventory access controls
 * - Advanced settings (supply chain, revenue auction type, bid request overwrite)
 * - Creative scan configuration
 * - Fraud detection level settings
 * - Fees management
 * - Real-time editing of DSP properties
 * - Error handling and loading states
 * - Response time tracking
 * - Auto-execution when partner ID is provided via URL
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { apiUrl } from "@/config/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Play,
  AlertCircle,
  Loader2,
  Monitor,
  Type,
  Package,
  Link2,
  Settings,
  Target,
  Ban,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams, useNavigate } from "react-router-dom";
import { EditEntityPageLayout } from "@/components/layouts/EditEntityPageLayout";
import { toast } from "sonner";

import DspConfigDisplay from "../../components/dsp/DspConfigDisplay";
import DspAdvancedSettingsSidebar from "../../components/dsp/DspAdvancedSettingsSidebar";
import DspInventoryAccessSidebar from "../../components/dsp/DspInventoryAccessSidebar";
import DspBlockCreative from "../../components/dsp/DspBlockCreative";

const DSP_EDIT_SECTIONS = [
  { id: "basic", label: "Basic info", icon: <Type className="w-4 h-4" /> },
  { id: "inventory", label: "Inventory Access", icon: <Package className="w-4 h-4" /> },
  { id: "endpoints", label: "Partner Endpoints", icon: <Link2 className="w-4 h-4" /> },
  { id: "advanced", label: "Advanced Settings", icon: <Settings className="w-4 h-4" /> },
  { id: "targeting", label: "Targeting", icon: <Target className="w-4 h-4" /> },
  { id: "block-creative", label: "Block Creative", icon: <Ban className="w-4 h-4" /> },
];

export default function EditDSP() {
  // Authentication hook - provides access to user token and validation
  const { getToken, validateToken } = useAuth();
  
  // URL search params hook
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [partnerId, setPartnerId] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [isIdFromUrl, setIsIdFromUrl] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [responseTime, setResponseTime] = useState(null);
  const [selectedSection, setSelectedSection] = useState('basic');
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [dspSaveInFlight, setDspSaveInFlight] = useState(false);
  const saveHandlerRef = useRef(null);
  const responseRef = useRef(null);
  /** Preserve cookie_sync_ids from GET so we never send [] by mistake if state was overwritten */
  const cookieSyncIdsRef = useRef(null);

  useEffect(() => {
    responseRef.current = response;
  }, [response]);

  // Load saved token and partner ID from URL params on component mount
  useEffect(() => {
    const savedToken = getToken();
    if (savedToken) {
      setAuthToken(savedToken);
    }
    
    // Get partner ID from URL parameters
    const partnerIdFromUrl = searchParams.get('id');
    if (partnerIdFromUrl) {
      setPartnerId(partnerIdFromUrl);
      setIsIdFromUrl(true); // Mark that ID came from URL
    }
  }, [getToken, searchParams]);

  // API URL - computed based on partnerId
  const getApiUrl = () => apiUrl.partner(partnerId);

  // Helper function to get the token to use (form token or saved token)
  const getTokenToUse = () => {
    return authToken.trim() || getToken();
  };

  // Broadcast save status updates (legacy listeners) and drive sidebar Save spinner
  const emitSaveStatus = (saving) => {
    setDspSaveInFlight(saving);
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('dspSaveStatus', { detail: { saving } }));
  };

  // Helper function to validate token before API calls
  const validateTokenForUpdate = () => {
    const tokenToUse = getTokenToUse();
    if (!tokenToUse) {
      setError("Please login first or provide an auth token");
      return null;
    }
    return tokenToUse;
  };

  const emitPendingChanges = useCallback((dirty) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('dspPendingChanges', { detail: { dirty } }));
  }, []);

  const markPendingChanges = useCallback(() => {
    setHasPendingChanges(true);
    emitPendingChanges(true);
  }, [emitPendingChanges]);

  const clearPendingChanges = useCallback(() => {
    setHasPendingChanges(false);
    emitPendingChanges(false);
  }, [emitPendingChanges]);

  const cloneData = (data) => {
    if (!data) return data;
    if (typeof structuredClone === 'function') {
      return structuredClone(data);
    }
    return JSON.parse(JSON.stringify(data));
  };

  /** Merge API response into prev.data but keep cookie_sync_ids when API returns [] (partial PUTs don't send them) */
  const mergePartnerData = (prevData, nextData) => {
    if (!nextData) return prevData;
    const merged = { ...prevData, ...nextData };
    const hadIds = Array.isArray(prevData?.cookie_sync_ids) && prevData.cookie_sync_ids.length > 0;
    const incomingEmpty = Array.isArray(nextData?.cookie_sync_ids) && nextData.cookie_sync_ids.length === 0;
    if (hadIds && incomingEmpty) {
      merged.cookie_sync_ids = prevData.cookie_sync_ids;
    }
    return merged;
  };

  const applyLocalChange = useCallback((updater) => {
    if (!responseRef.current?.data) {
      setError("No data loaded to update. Please execute a GET request first.");
      return false;
    }

    setResponse((prev) => {
      if (!prev?.data) return prev;
      const cloned = cloneData(prev.data);
      const updated = updater(cloned) || cloned;
      return {
        ...prev,
        data: updated,
      };
    });

    markPendingChanges();
    return true;
  }, [markPendingChanges]);

  const shouldDeferSectionSaves = true;

  const getHeaderValue = (headers, key) => {
    if (!headers) return undefined;
    if (headers instanceof Headers) {
      return headers.get(key);
    }
    if (Array.isArray(headers)) {
      const match = headers.find(([headerKey]) => headerKey?.toLowerCase() === key.toLowerCase());
      return match ? match[1] : undefined;
    }
    return headers[key] ?? headers[key?.toLowerCase()];
  };

  const convertPayloadDataToLocal = useCallback((payloadData) => {
    if (!payloadData) return null;
    let clonedData;
    if (typeof structuredClone === 'function') {
      clonedData = structuredClone(payloadData);
    } else {
      clonedData = JSON.parse(JSON.stringify(payloadData));
    }

    if (clonedData && typeof clonedData.LockVersion !== 'undefined') {
      const currentVersion = responseRef.current?.data?.lock_version ?? 0;
      clonedData.lock_version = currentVersion;
      delete clonedData.LockVersion;
    }

    return clonedData;
  }, []);

  const createMockResponse = (data) => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => data,
    text: async () => JSON.stringify(data ?? {}),
    headers: {
      get: () => null,
    },
  });

  const executeRequest = async () => {
    if (!partnerId.trim()) {
      setError("Please provide a partner ID");
      return;
    }

    // Use saved token if no token is provided in the form
    const tokenToUse = authToken.trim() || getToken();
    if (!tokenToUse) {
      setError("Please login first or provide an auth token");
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);
    setResponseTime(null);

    const startTime = Date.now();

    try {
      const url = getApiUrl();

      const fetchResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'x-ayl-auth-token': tokenToUse,
          'Content-Type': 'application/json'
        }
      });

      const endTime = Date.now();
      setResponseTime(endTime - startTime);

      if (!fetchResponse.ok) {
        throw new Error(`HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`);
      }

      const jsonData = await fetchResponse.json();
      // Normalize: keep flat partner object in response.data (API may return { Data: {...} } or flat)
      const partnerData = jsonData?.Data ?? jsonData;
      if (Array.isArray(partnerData?.cookie_sync_ids)) {
        cookieSyncIdsRef.current = partnerData.cookie_sync_ids;
      }
      // [DSP DEBUG] GET partner response
      console.log('[DSP DEBUG] GET partner – raw response:', JSON.stringify(jsonData, null, 2));
      console.log('[DSP DEBUG] GET partner – normalized data (response.data):', JSON.stringify(partnerData, null, 2));
      console.log('[DSP DEBUG] GET partner – cookie_sync_ids:', partnerData?.cookie_sync_ids);
      setResponse({
        status: fetchResponse.status,
        statusText: fetchResponse.statusText,
        headers: Object.fromEntries(fetchResponse.headers.entries()),
        data: partnerData
      });
      clearPendingChanges();

    } catch (err) {
      setError(`An error occurred while retrieving data: ${err.message}. Please check the provided partner ID and auth token and try again.`);
    }

    setLoading(false);
  };

  // Auto-execute request when partnerId is set from URL
  useEffect(() => {
    if (partnerId && authToken) {
      executeRequest();
    }
  }, [partnerId]); // Only run when partnerId changes

  useEffect(() => {
    if (!shouldDeferSectionSaves || typeof window === 'undefined') {
      return;
    }

    const originalWindowFetch = window.fetch?.bind(window);
    const originalGlobalFetch = (typeof globalThis !== 'undefined' && globalThis.fetch)
      ? globalThis.fetch.bind(globalThis)
      : originalWindowFetch;

    const nativeFetch = originalWindowFetch || originalGlobalFetch;
    if (!nativeFetch) {
      return;
    }

    const interceptedFetch = async (input, init = {}) => {
      const method = init?.method?.toUpperCase();
      const isGlobalSave = getHeaderValue(init?.headers, 'x-dsp-save-mode') === 'global';
      const isPartnerUpdate =
        typeof input === 'string' &&
        input.includes('/bo-api/partners/') &&
        method === 'PUT' &&
        !isGlobalSave;

      if (isPartnerUpdate) {
        try {
          const rawBody = init?.body;
          if (rawBody && typeof rawBody === 'string') {
            const parsedBody = JSON.parse(rawBody);
            if (parsedBody?.kind === 'Partner' && parsedBody?.Data) {
              const simulatedData = convertPayloadDataToLocal(parsedBody.Data);
              if (simulatedData) {
                markPendingChanges();
              }
              return createMockResponse(simulatedData);
            }
          }
        } catch (err) {
          console.error('DSP deferred save interception error:', err);
        }
      }

      return nativeFetch(input, init);
    };

    window.fetch = interceptedFetch;
    if (typeof globalThis !== 'undefined') {
      globalThis.fetch = interceptedFetch;
    }

    return () => {
      if (originalWindowFetch) {
        window.fetch = originalWindowFetch;
      }
      if (typeof globalThis !== 'undefined' && originalGlobalFetch) {
        globalThis.fetch = originalGlobalFetch;
      }
    };
  }, [convertPayloadDataToLocal, markPendingChanges]);

  // Recursively removes any null fields from an object or array
  const removeNullFields = (obj) => {
    if (Array.isArray(obj)) {
      // For arrays, clean each element
      return obj.map(item => removeNullFields(item));
    } else if (obj !== null && typeof obj === 'object') {
      // For objects, filter null fields and clean recursively
      const cleaned = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== null) {
          cleaned[key] = removeNullFields(value);
        }
      }
      return cleaned;
    }
    // For primitive values, return as is
    return obj;
  };

  /** Partner payloads expose both `contents` and `connector_contents`; they must stay identical. */
  const syncContentsMirror = (connectorContents) => {
    const cc = connectorContents && typeof connectorContents === 'object' ? connectorContents : {};
    return { ...cc };
  };

  const updateStatus = async (newStatus) => {
    if (!response?.data) {
        setError("No data loaded to update. Please execute a GET request first.");
        return;
    }

    const tokenToUse = validateTokenForUpdate();
    if (!tokenToUse) return;

    setLoading(true);
    setError(null);

    try {
      const originalData = response.data;
      const cleanedData = removeNullFields(originalData);

      const transformedData = {
        ...cleanedData,
        status: newStatus,
        LockVersion: (originalData.lock_version || 0) + 1
      };

      delete transformedData.lock_version;

      const payload = {
        Data: transformedData,
        kind: "Partner",
        Version: 1010
      };

      const url = getApiUrl();

      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': getTokenToUse(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
      }

      const updatedJsonData = await updateResponse.json();

      const nextData = updatedJsonData?.Data ?? updatedJsonData;
      setResponse((prev) => ({
        ...prev,
        data: prev?.data ? mergePartnerData(prev.data, nextData) : nextData
      }));

    } catch (err) {
      setError(`Error updating status: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  const updateName = (newName) => {
    if (!newName?.trim()) return;
    applyLocalChange((data) => {
      data.name = newName.trim();
      return data;
    });
  };

  const updatePartnerEndpoint = (endpointCode, newUrl) => {
    applyLocalChange((data) => {
      const existingEndpoints = Array.isArray(data.partner_endpoint) ? [...data.partner_endpoint] : [];
      const index = existingEndpoints.findIndex((ep) => ep.code === endpointCode);
      if (index >= 0) {
        existingEndpoints[index] = { ...existingEndpoints[index], url: newUrl };
      } else {
        existingEndpoints.push({
          code: endpointCode,
          url: newUrl,
          type: "configuration",
          partner_uid: data.uid,
        });
      }
      data.partner_endpoint = existingEndpoints;
      return data;
    });
  };

  const removePartnerEndpoint = (endpointCode) => {
    applyLocalChange((data) => {
      const existingEndpoints = Array.isArray(data.partner_endpoint) ? data.partner_endpoint : [];
      data.partner_endpoint = existingEndpoints.filter((endpoint) => endpoint.code !== endpointCode);
      return data;
    });
  };

  const updateDebugMode = (newLogLevel) => {
    applyLocalChange((data) => {
      data.connector_log_level = newLogLevel;
      return data;
    });
  };

  const updateGzipEnabled = (newValue) => {
    applyLocalChange((data) => {
      data.connector_gzip_enabled = newValue;
      return data;
    });
  };

  const updateCncDeserializer = (newValue) => {
    applyLocalChange((data) => {
      data.cnc_deserializer = newValue;
      return data;
    });
  };

  const updateCncSerializer = (newValue) => {
    applyLocalChange((data) => {
      data.cnc_serializer = newValue;
      return data;
    });
  };

  const updateQpsLimit = (newQpsData) => {
    if (!newQpsData) return;
    applyLocalChange((data) => {
      const existing = { ...(data.cec_qps_by_dc || {}) };
      Object.entries(newQpsData).forEach(([dc, value]) => {
        if (value === null || value === undefined) {
          delete existing[dc];
        } else {
          existing[dc] = value;
        }
      });
      data.cec_qps_by_dc = existing;
      return data;
    });
  };

  const updateSni = async (newSniValue) => {
    if (!response?.data) {
        setError("No data loaded to update. Please execute a GET request first.");
        return;
    }

    const tokenToUse = validateTokenForUpdate();
    if (!tokenToUse) return;

    setLoading(true);
    setError(null);

    try {
      const originalData = response.data;
      const cleanedData = removeNullFields(originalData);

      const transformedData = {
        ...cleanedData,
        sni: newSniValue,
        LockVersion: (originalData.lock_version || 0) + 1
      };

      delete transformedData.lock_version;

      const payload = {
        Data: transformedData,
        kind: "Partner",
        Version: 1010
      };

      const url = getApiUrl();

      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': getTokenToUse(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
      }

      const updatedJsonData = await updateResponse.json();

      const nextData = updatedJsonData?.Data ?? updatedJsonData;
      setResponse((prev) => ({
        ...prev,
        data: prev?.data ? mergePartnerData(prev.data, nextData) : nextData
      }));

    } catch (err) {
      setError(`Error updating SNI (HTTPS) status: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  const updateConnectorKind = async (newKind) => {
    if (!response?.data) {
        setError("No data loaded to update. Please execute a GET request first.");
        return;
    }

    const tokenToUse = validateTokenForUpdate();
    if (!tokenToUse) return;

    setLoading(true);
    setError(null);

    try {
      const originalData = response.data;
      const cleanedData = removeNullFields(originalData);

      const transformedData = {
        ...cleanedData,
        connector_kind: newKind,
        LockVersion: (originalData.lock_version || 0) + 1
      };

      delete transformedData.lock_version;

      const payload = {
        Data: transformedData,
        kind: "Partner",
        Version: 1010
      };

      const url = getApiUrl();

      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': getTokenToUse(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
      }

      const updatedJsonData = await updateResponse.json();

      const nextData = updatedJsonData?.Data ?? updatedJsonData;
      setResponse((prev) => ({
        ...prev,
        data: prev?.data ? mergePartnerData(prev.data, nextData) : nextData
      }));

    } catch (err) {
      setError(`Error updating connector kind: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  const updateUserSyncedOnly = async (ruleUid, newUserSyncedValue) => {
    if (!response?.data) {
        setError("No data loaded to update. Please execute a GET request first.");
        return;
    }

    const tokenToUse = validateTokenForUpdate();
    if (!tokenToUse) return;

    setLoading(true);
    setError(null);

    try {
      const originalData = response.data;
      const cleanedData = removeNullFields(originalData);
      const existingTargeting = cleanedData.partner_targeting || [];

      // Update the specific rule
      const updatedTargeting = existingTargeting.map(rule => {
        if (rule.uid === ruleUid) {
          return {
            ...rule,
            config: {
              ...rule.config,
              UserSyncedOnly: newUserSyncedValue
            }
          };
        }
        return rule;
      });

      const transformedData = {
        ...cleanedData,
        partner_targeting: updatedTargeting,
        LockVersion: (originalData.lock_version || 0) + 1
      };

      delete transformedData.lock_version;

      const payload = {
        Data: transformedData,
        kind: "Partner",
        Version: 1010
      };

      const url = getApiUrl();

      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': getTokenToUse(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
      }

      const updatedJsonData = await updateResponse.json();

      const nextData = updatedJsonData?.Data ?? updatedJsonData;
      setResponse((prev) => ({
        ...prev,
        data: prev?.data ? mergePartnerData(prev.data, nextData) : nextData
      }));

    } catch (err) {
      setError(`Error updating synced users setting: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  const updateTargetingDealsOnly = async (ruleUid, newDealsOnlyValue) => {
    if (!response?.data) {
        setError("No data loaded to update. Please execute a GET request first.");
        return;
    }

    const tokenToUse = validateTokenForUpdate();
    if (!tokenToUse) return;

    setLoading(true);
    setError(null);

    try {
      const originalData = response.data;
      const cleanedData = removeNullFields(originalData);
      const existingTargeting = cleanedData.partner_targeting || [];

      const updatedTargeting = existingTargeting.map(rule => {
        if (rule.uid === ruleUid) {
          return {
            ...rule,
            config: {
              ...rule.config,
              DealsOnly: newDealsOnlyValue
            }
          };
        }
        return rule;
      });

      const transformedData = {
        ...cleanedData,
        partner_targeting: updatedTargeting,
        LockVersion: (originalData.lock_version || 0) + 1
      };

      delete transformedData.lock_version;

      const payload = {
        Data: transformedData,
        kind: "Partner",
        Version: 1010
      };

      const url = getApiUrl();

      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': getTokenToUse(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
      }

      const updatedJsonData = await updateResponse.json();

      const nextData = updatedJsonData?.Data ?? updatedJsonData;
      setResponse((prev) => ({
        ...prev,
        data: prev?.data ? mergePartnerData(prev.data, nextData) : nextData
      }));

    } catch (err) {
      setError(`Error updating deals-only setting: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  const updateTargetingDevices = async (ruleUid, newDevices) => {
    if (!response?.data) {
        setError("No data loaded to update. Please execute a GET request first.");
        return;
    }

    const tokenToUse = validateTokenForUpdate();
    if (!tokenToUse) return;

    setLoading(true);
    setError(null);

    try {
      const originalData = response.data;
      const cleanedData = removeNullFields(originalData);
      const existingTargeting = cleanedData.partner_targeting || [];

      // Update the specific rule
      const updatedTargeting = existingTargeting.map(rule => {
        if (rule.uid === ruleUid) {
          return {
            ...rule,
            config: {
              ...rule.config,
              Devices: newDevices
            }
          };
        }
        return rule;
      });

      const transformedData = {
        ...cleanedData,
        partner_targeting: updatedTargeting,
        LockVersion: (originalData.lock_version || 0) + 1
      };

      delete transformedData.lock_version;

      const payload = {
        Data: transformedData,
        kind: "Partner",
        Version: 1010
      };

      const url = getApiUrl();

      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': getTokenToUse(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
      }

      const updatedJsonData = await updateResponse.json();

      const nextData = updatedJsonData?.Data ?? updatedJsonData;
      setResponse((prev) => ({
        ...prev,
        data: prev?.data ? mergePartnerData(prev.data, nextData) : nextData
      }));

    } catch (err) {
      setError(`Error updating targeting devices: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  const addNewTargetingRule = async (newRulesData) => { // Accepts an array of rules
    if (!response?.data) {
        setError("No data loaded to update. Please execute a GET request first.");
        return;
    }

    const tokenToUse = validateTokenForUpdate();
    if (!tokenToUse) return;

    setLoading(true);
    setError(null);

    try {
      let currentData = removeNullFields(response.data);
      let currentTargeting = currentData.partner_targeting || [];
      let currentConnectorContents = { ...(currentData.connector_contents || {}) };
      let currentBillingEvents = { ...(currentData.connector_adkind_billing_events || {}) };

      // Loop over each new rule to add
      for (const newRuleData of newRulesData) {
        // Create the new rule
        const newRule = {
          uid: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`, // More unique ID
          kind: newRuleData.kind,
          traffic_type: newRuleData.traffic_type,
          config: {
            CountriesInclusion: newRuleData.countries || [],
            Devices: newRuleData.devices || ["DESKTOP", "MOBILE", "TABLET", "TV"],
            UserSyncedOnly: newRuleData.userSyncedOnly || false,
            DealsOnly: newRuleData.dealsOnly || false
          }
        };
        currentTargeting.push(newRule);

        // Update connector_contents and billing_events
        const { kind, connectorContent } = newRuleData;
        let contentKey = '';
        let billingEvent = 'IMPRESSION'; // Default

        if (kind === 'AD_TRAFFIC' || kind === 'AD_VIDEO') {
          contentKey = connectorContent || 'NATIVE_1_1';
          currentConnectorContents[kind] = [contentKey];
        } else if (kind === 'AD_BANNER') {
          contentKey = 'AD_BANNER';
          currentConnectorContents[kind] = ['AD_BANNER'];
        } else if (kind === 'AD_INSTREAM' || kind === 'AD_OUTSTREAM') {
          contentKey = 'VAST';
          currentConnectorContents[kind] = [contentKey];
          billingEvent = 'VIDEO_000';
        }

        if (contentKey) {
            if (!currentBillingEvents[contentKey]) {
                currentBillingEvents[contentKey] = {};
            }
            currentBillingEvents[contentKey][kind] = billingEvent;
        }
      }

      const transformedData = {
        ...currentData,
        partner_targeting: currentTargeting,
        connector_contents: currentConnectorContents,
        contents: syncContentsMirror(currentConnectorContents),
        connector_adkind_billing_events: currentBillingEvents,
        LockVersion: (currentData.lock_version || 0) + 1
      };

      delete transformedData.lock_version;

      const payload = {
        Data: transformedData,
        kind: "Partner",
        Version: 1010
      };

      const url = getApiUrl();

      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': getTokenToUse(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
      }

      const updatedJsonData = await updateResponse.json();

      const nextData = updatedJsonData?.Data ?? updatedJsonData;
      setResponse((prev) => ({
        ...prev,
        data: prev?.data ? mergePartnerData(prev.data, nextData) : nextData
      }));

    } catch (err) {
      setError(`Error adding new targeting rule: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  const updateTargetingCountries = (ruleUid, newCountries) => {
    applyLocalChange((data) => {
      data.partner_targeting = (data.partner_targeting || []).map((rule) => {
        if (rule.uid !== ruleUid) return rule;
          return {
            ...rule,
            config: {
            ...(rule.config || {}),
            CountriesInclusion: newCountries,
          },
        };
      });
      return data;
    });
  };

  const updateTargetingSiteDomains = (ruleUid, newDomains) => {
    applyLocalChange((data) => {
      data.partner_targeting = (data.partner_targeting || []).map((rule) => {
        if (rule.uid !== ruleUid) return rule;
        return {
          ...rule,
          config: {
            ...(rule.config || {}),
            SiteDomainsInclusion: newDomains,
          },
        };
      });
      return data;
    });
  };

  const updateTargetingAppBundles = (ruleUid, newBundles) => {
    applyLocalChange((data) => {
      data.partner_targeting = (data.partner_targeting || []).map((rule) => {
        if (rule.uid !== ruleUid) return rule;
          return {
            ...rule,
            config: {
            ...(rule.config || {}),
            AppBundleIdsInclusion: newBundles,
          },
        };
      });
      return data;
    });
  };

  const updateTargetingCountriesExclusion = (ruleUid, newCountries) => {
    applyLocalChange((data) => {
      data.partner_targeting = (data.partner_targeting || []).map((rule) => {
        if (rule.uid !== ruleUid) return rule;
        return {
          ...rule,
          config: {
            ...(rule.config || {}),
            CountriesExclusion: newCountries,
          },
        };
      });
      return data;
    });
  };

  const updateTargetingSiteDomainsExclusion = (ruleUid, newDomains) => {
    applyLocalChange((data) => {
      data.partner_targeting = (data.partner_targeting || []).map((rule) => {
        if (rule.uid !== ruleUid) return rule;
          return {
            ...rule,
            config: {
            ...(rule.config || {}),
            SiteDomainsExclusion: newDomains,
          },
        };
      });
      return data;
    });
  };

  const updateTargetingAppBundlesExclusion = (ruleUid, newBundles) => {
    applyLocalChange((data) => {
      data.partner_targeting = (data.partner_targeting || []).map((rule) => {
        if (rule.uid !== ruleUid) return rule;
        return {
          ...rule,
          config: {
            ...(rule.config || {}),
            AppBundleIdsExclusion: newBundles,
          },
        };
      });
      return data;
    });
  };

  const updateConnectorContent = async (kind, newContent) => {
    if (!response?.data) {
        setError("No data loaded to update. Please execute a GET request first.");
        return;
    }

    const tokenToUse = validateTokenForUpdate();
    if (!tokenToUse) return;

    setLoading(true);
    setError(null);

    try {
      const originalData = response.data;
      const cleanedData = removeNullFields(originalData);

      const updatedConnectorContents = {
        ...(cleanedData.connector_contents || {}),
        [kind]: [newContent]
      };

      const transformedData = {
        ...cleanedData,
        connector_contents: updatedConnectorContents,
        contents: syncContentsMirror(updatedConnectorContents),
        LockVersion: (originalData.lock_version || 0) + 1
      };

      delete transformedData.lock_version;

      const payload = {
        Data: transformedData,
        kind: "Partner",
        Version: 1010
      };

      const url = getApiUrl();

      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': getTokenToUse(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
      }

      const updatedJsonData = await updateResponse.json();

      const nextData = updatedJsonData?.Data ?? updatedJsonData;
      setResponse((prev) => ({
        ...prev,
        data: prev?.data ? mergePartnerData(prev.data, nextData) : nextData
      }));

    } catch (err) {
      setError(`Error updating connector content: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  const removeTargetingRule = async (ruleUid) => {
    if (!response?.data) {
        setError("No data loaded to update. Please execute a GET request first.");
        return;
    }

    const tokenToUse = validateTokenForUpdate();
    if (!tokenToUse) return;

    setLoading(true);
    setError(null);

    try {
      const originalData = response.data;
      const cleanedData = removeNullFields(originalData);
      const existingTargeting = cleanedData.partner_targeting || [];

      // Find the rule to be removed to know its kind
      const ruleToRemove = existingTargeting.find(rule => rule.uid === ruleUid);
      if (!ruleToRemove) {
        throw new Error("Rule not found");
      }

      // Remove the rule
      const updatedTargeting = existingTargeting.filter(rule => rule.uid !== ruleUid);

      // Check if other rules are still using the same kind
      const remainingRulesWithSameKind = updatedTargeting.filter(rule => rule.kind === ruleToRemove.kind);

      // Update connector_contents and billing_events
      const updatedConnectorContents = { ...(cleanedData.connector_contents || {}) };
      const updatedBillingEvents = { ...(cleanedData.connector_adkind_billing_events || {}) };

      // If no other rule uses this kind, remove it from connector_contents
      if (remainingRulesWithSameKind.length === 0) {
        delete updatedConnectorContents[ruleToRemove.kind];

        // Clean up billing_events: find the contentKey associated with the removed kind
        let contentKeyToClean = '';
        if (ruleToRemove.kind === 'AD_TRAFFIC' || ruleToRemove.kind === 'AD_VIDEO') {
          contentKeyToClean = cleanedData.connector_contents?.[ruleToRemove.kind]?.[0]; // e.g., NATIVE_1_1 or NATIVE_1_2
        } else if (ruleToRemove.kind === 'AD_BANNER') {
          contentKeyToClean = 'AD_BANNER';
        } else if (ruleToRemove.kind === 'AD_INSTREAM' || ruleToRemove.kind === 'AD_OUTSTREAM') {
          contentKeyToClean = 'VAST';
        }

        // Delete the entry from billing_events for this kind
        if (contentKeyToClean && updatedBillingEvents[contentKeyToClean]) {
          delete updatedBillingEvents[contentKeyToClean][ruleToRemove.kind];

          // If the object becomes empty, remove the key completely
          if (Object.keys(updatedBillingEvents[contentKeyToClean]).length === 0) {
            delete updatedBillingEvents[contentKeyToClean];
          }
        }
      }

      const transformedData = {
        ...cleanedData,
        partner_targeting: updatedTargeting,
        connector_contents: updatedConnectorContents,
        contents: syncContentsMirror(updatedConnectorContents),
        connector_adkind_billing_events: updatedBillingEvents,
        LockVersion: (originalData.lock_version || 0) + 1
      };

      delete transformedData.lock_version;

      const payload = {
        Data: transformedData,
        kind: "Partner",
        Version: 1010
      };

      const url = getApiUrl();

      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': getTokenToUse(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
      }

      const updatedJsonData = await updateResponse.json();

      const nextData = updatedJsonData?.Data ?? updatedJsonData;
      setResponse((prev) => ({
        ...prev,
        data: prev?.data ? mergePartnerData(prev.data, nextData) : nextData
      }));

    } catch (err) {
      setError(`Error removing targeting rule: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  const updateInventoryAccess = async (newAccessSettings) => {
    if (!response?.data) {
        setError("No data loaded to update. Please execute a GET request first.");
        return;
    }

    const tokenToUse = validateTokenForUpdate();
    if (!tokenToUse) return;

    setLoading(true); // Use general loading
    setError(null);

    try {
      const originalData = response.data;
      const cleanedData = removeNullFields(originalData);

      const transformedData = {
        ...cleanedData,
        ...newAccessSettings, // Apply new settings
        LockVersion: (originalData.lock_version || 0) + 1
      };

      delete transformedData.lock_version;

      const payload = {
        Data: transformedData,
        kind: "Partner",
        Version: 1010
      };

      const url = getApiUrl();

      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': getTokenToUse(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
      }

      const updatedJsonData = await updateResponse.json();

      const nextData = updatedJsonData?.Data ?? updatedJsonData;
      setResponse((prev) => ({
        ...prev,
        data: prev?.data ? mergePartnerData(prev.data, nextData) : nextData
      }));

    } catch (err) {
      setError(`Error updating inventory access: ${err.message}`);
    } finally {
        setLoading(false); // Use general loading
    }
  };

  const updateSupplyChainMaxNodes = (newValue) => {
    if (newValue === undefined || newValue === null) return;
    applyLocalChange((data) => {
      data.supply_chain_max_nodes = newValue;
      return data;
    });
  };

  const updateRevenueAuctionType = async (newType) => {
    if (!response?.data) {
        setError("No data loaded to update. Please execute a GET request first.");
        return;
    }

    const tokenToUse = validateTokenForUpdate();
    if (!tokenToUse) return;

    setLoading(true);
    setError(null);

    try {
      const originalData = response.data;
      const cleanedData = removeNullFields(originalData);

      const transformedData = {
        ...cleanedData,
        revenue_auction_type: newType,
        LockVersion: (originalData.lock_version || 0) + 1
      };

      delete transformedData.lock_version;

      const payload = {
        Data: transformedData,
        kind: "Partner",
        Version: 1010
      };

      const url = getApiUrl();

      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': getTokenToUse(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
      }

      const updatedJsonData = await updateResponse.json();

      const nextData = updatedJsonData?.Data ?? updatedJsonData;
      setResponse((prev) => ({
        ...prev,
        data: prev?.data ? mergePartnerData(prev.data, nextData) : nextData
      }));

    } catch (err) {
      setError(`Error updating revenue auction type: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  const updateBidRequestOverwrite = (newAllow, newOverwrite) => {
    let overwriteObject;
    if (newAllow && newOverwrite && String(newOverwrite).trim()) {
      try {
        overwriteObject = JSON.parse(newOverwrite);
      } catch (e) {
        setError("Invalid JSON format in Bid Request Overwrite. Please correct it before saving.");
        return;
      }
    } else {
      // Empty = send {} so backend takes the update into account
      overwriteObject = {};
    }

    applyLocalChange((data) => {
      data.allow_bid_request_overwrite = newAllow;
      data.bid_request_overwrite = overwriteObject;
      return data;
    });
  };

  const updateCreativeScan = async (newAllow, newRatio) => {
    if (!response?.data) {
        setError("No data loaded to update. Please execute a GET request first.");
        return;
    }

    const tokenToUse = validateTokenForUpdate();
    if (!tokenToUse) return;

    setLoading(true);
    setError(null);

    try {
      const originalData = response.data;
      const cleanedData = removeNullFields(originalData);

      const transformedData = {
        ...cleanedData,
        allow_creative_scan: newAllow,
        creative_scan_ratio: newRatio,
        LockVersion: (originalData.lock_version || 0) + 1
      };

      delete transformedData.lock_version;

      const payload = {
        Data: transformedData,
        kind: "Partner",
        Version: 1010
      };

      const url = getApiUrl();

      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': getTokenToUse(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
      }

      const updatedJsonData = await updateResponse.json();

      const nextData = updatedJsonData?.Data ?? updatedJsonData;
      setResponse((prev) => ({
        ...prev,
        data: prev?.data ? mergePartnerData(prev.data, nextData) : nextData
      }));

    } catch (err) {
      setError(`Error updating creative scan: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  const updateFraudDetectionLevel = async (newLevel) => {
    if (!response?.data) {
        setError("No data loaded to update. Please execute a GET request first.");
        return;
    }

    const tokenToUse = validateTokenForUpdate();
    if (!tokenToUse) return;

    setLoading(true);
    setError(null);

    try {
      const originalData = response.data;
      const cleanedData = removeNullFields(originalData);

      const transformedData = {
        ...cleanedData,
        fraud_detection_filtering_level: newLevel,
        LockVersion: (originalData.lock_version || 0) + 1
      };

      delete transformedData.lock_version;

      const payload = {
        Data: transformedData,
        kind: "Partner",
        Version: 1010
      };

      const url = getApiUrl();

      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': getTokenToUse(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
      }

      const updatedJsonData = await updateResponse.json();

      const nextData = updatedJsonData?.Data ?? updatedJsonData;
      setResponse((prev) => ({
        ...prev,
        data: prev?.data ? mergePartnerData(prev.data, nextData) : nextData
      }));

    } catch (err) {
      setError(`Error updating fraud detection level: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  const updateFees = (newFees) => {
    applyLocalChange((data) => {
      data.fees = newFees;
      return data;
    });
  };

  const updateDuplicationFactor = (nextFactor) => {
    // Treat empty/0 as "unset" and explicitly send null to backend on Save
    const raw = `${nextFactor ?? ''}`.trim();
    if (!raw || raw === '0') {
      setError(null);
      applyLocalChange((data) => {
        data.duplication_factor = null;
        return data;
      });
      return;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Duplication factor must be a positive integer.");
      return;
    }
    setError(null);
    applyLocalChange((data) => {
      data.duplication_factor = parsed;
      return data;
    });
  };

  const updateCookieSyncIds = (newIds) => {
    const ids = Array.isArray(newIds) ? [...newIds] : [];
    cookieSyncIdsRef.current = ids;
    applyLocalChange((data) => {
      data.cookie_sync_ids = ids;
      return data;
    });
  };
  
  // Persist the currently loaded DSP configuration as-is (used by the global Save button in the header)
  const performGlobalSave = async () => {
    if (!response?.data) {
      toast.warning("Nothing to save", {
        description: "Load the DSP first, then try again.",
      });
      emitSaveStatus(false);
      return;
    }

    const tokenToUse = getTokenToUse();
    if (!tokenToUse) {
      toast.error("Cannot save", {
        description: "Sign in or paste an auth token in the header.",
      });
      emitSaveStatus(false);
      return;
    }

    setLoading(true);
    setError(null);
    emitSaveStatus(true);

    try {
      // GET response → add LockVersion → remove nulls → wrap in Data
      const sourceData = response.data?.Data ?? response.data;
      const transformedData = {
        ...sourceData,
        LockVersion: (sourceData.lock_version ?? sourceData.LockVersion ?? 0) + 1
      };
      delete transformedData.lock_version;

      const cleanedData = removeNullFields(transformedData);
      // Keep explicit clears (null) for fields that must be sent as null to backend
      if (Object.prototype.hasOwnProperty.call(transformedData, 'duplication_factor') && transformedData.duplication_factor === null) {
        cleanedData.duplication_factor = null;
      }

      const payload = {
        Data: cleanedData,
        kind: "Partner",
        Version: 1010
      };

      console.log('[DSP DEBUG] SAVE ➜ payload envoyé:', JSON.stringify(payload, null, 2));

      const url = getApiUrl();

      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': tokenToUse,
          'Content-Type': 'application/json',
          'x-dsp-save-mode': 'global'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
      }

      const updatedJsonData = await updateResponse.json();
      const updatedData = updatedJsonData?.Data ?? updatedJsonData;
      console.log('[DSP DEBUG] SAVE ➜ réponse reçue:', JSON.stringify(updatedJsonData, null, 2));

      setResponse((prev) => ({
        ...prev,
        data: updatedData ?? prev.data
      }));
      clearPendingChanges();
      toast.success("DSP saved", {
        description: "Your changes were applied successfully.",
      });
    } catch (err) {
      toast.error("Save failed", {
        description: err.message,
      });
    } finally {
        setLoading(false);
      emitSaveStatus(false);
    }
  };

  // Always keep the mutable ref pointing to the latest save handler implementation
  saveHandlerRef.current = performGlobalSave;

  // Register a single listener so the header can trigger saves via a custom event
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleGlobalSaveRequest = () => {
      if (saveHandlerRef.current) {
        saveHandlerRef.current();
      }
    };

    window.addEventListener('dspGlobalSave', handleGlobalSaveRequest);
    return () => {
      window.removeEventListener('dspGlobalSave', handleGlobalSaveRequest);
    };
  }, []);

  // Get the DSP name from URL params or from response data
  const dspNameFromUrl = searchParams.get('name');
  const dspName = response?.data?.name || dspNameFromUrl || 'DSP Configuration';

  const displayName = dspNameFromUrl?.trim()
    ? decodeURIComponent(dspNameFromUrl)
    : dspName;
  const truncatedTitle =
    displayName.length > 42 ? `${displayName.slice(0, 42)}…` : displayName;

  const partnerIdFromUrl = searchParams.get('id')?.trim();

  const sectionsWithDisabled = useMemo(
    () =>
      DSP_EDIT_SECTIONS.map((s) => ({
        ...s,
        disabled: !response?.data,
      })),
    [response?.data]
  );

  const layoutAlerts = useMemo(() => {
    const list = [];
    if (error) {
      list.push(
        <Alert key="dsp-error" variant="destructive" className="mb-6 border-red-200 bg-red-50">
          <AlertCircle className="h-5 w-5" />
          <AlertDescription className="text-red-800 font-medium">{error}</AlertDescription>
        </Alert>
      );
    }
    return list;
  }, [error]);

  const SectionFallback = ({ title }) => (
    <Card className="border-slate-200 shadow-lg h-full">
      <CardContent className="py-10 text-center text-slate-500">
        <p className="font-semibold text-slate-700 mb-1">{title}</p>
        <p>API did not return data for this section.</p>
      </CardContent>
    </Card>
  );

  if (!partnerIdFromUrl) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">No DSP selected</h2>
          <p className="text-slate-600 mb-4">Open a DSP from the list to edit it.</p>
          <Button variant="outline" onClick={() => navigate("/DSPManagement")}>
            Back to DSP Management
          </Button>
        </div>
      </div>
    );
  }

  return (
    <EditEntityPageLayout
      sections={sectionsWithDisabled}
      selectedSection={selectedSection}
      onSectionSelect={setSelectedSection}
      sectionCardTitle="General Parameters"
      headerIcon={<Monitor className="w-7 h-7" />}
      title={truncatedTitle}
      titleTooltip={displayName}
      subtitle="Edit DSP configuration"
      onSave={performGlobalSave}
      onCancel={() => navigate("/DSPManagement")}
      saving={dspSaveInFlight}
      saveDisabled={!hasPendingChanges || !response?.data}
      alerts={layoutAlerts}
    >
      <div className="space-y-6">
            {loading && !response && (
              <Card className="border-slate-200 shadow-lg h-full">
                <CardContent className="flex items-center justify-center h-full py-16">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-[rgb(75,99,226)] mx-auto mb-4" />
                    <p className="text-slate-600 font-medium">Executing API request...</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pass response.data directly as the structure is flat */}
            {response && (
              <>
                {selectedSection === 'basic' && (
                  <section id="basic">
                    {response.data ? (
                    <DspConfigDisplay
                      data={response.data}
                      onUpdateName={updateName}
                      onUpdateStatus={updateStatus}
                      onUpdateEndpoint={updatePartnerEndpoint}
                      onRemoveEndpoint={removePartnerEndpoint}
                      onUpdateDebugMode={updateDebugMode}
                      onUpdateGzipEnabled={updateGzipEnabled}
                      onUpdateQpsLimit={updateQpsLimit}
                      onUpdateSni={updateSni}
                      onUpdateConnectorKind={updateConnectorKind}
                      onUpdateUserSyncedOnly={updateUserSyncedOnly}
                      onUpdateTargetingDealsOnly={updateTargetingDealsOnly}
                      onUpdateTargetingDevices={updateTargetingDevices}
                      onAddNewTargetingRule={addNewTargetingRule}
                      onUpdateTargetingCountries={updateTargetingCountries}
                      onUpdateTargetingSiteDomains={updateTargetingSiteDomains}
                      onUpdateTargetingAppBundles={updateTargetingAppBundles}
                      onUpdateConnectorContent={updateConnectorContent} 
                      onRemoveTargetingRule={removeTargetingRule}
                      onUpdateTargetingCountriesExclusion={updateTargetingCountriesExclusion}
                      onUpdateTargetingSiteDomainsExclusion={updateTargetingSiteDomainsExclusion}
                      onUpdateTargetingAppBundlesExclusion={updateTargetingAppBundlesExclusion}
                      visibleSections={["basic"]}
                    />
                    ) : (
                      <SectionFallback title="Basic Information" />
                    )}
                  </section>
                )}
                {selectedSection === 'inventory' && (
                  <section id="inventory">
                    {response.data ? (
                    <DspInventoryAccessSidebar
                      data={response.data}
                      onUpdateInventoryAccess={updateInventoryAccess}
                      isSaving={loading}
                    />
                    ) : (
                      <SectionFallback title="Inventory Access" />
                    )}
                  </section>
                )}
                {selectedSection === 'endpoints' && (
                  <section id="endpoints">
                    {response.data ? (
                    <DspConfigDisplay
                      data={response.data}
                      onUpdateName={updateName}
                      onUpdateStatus={updateStatus}
                      onUpdateEndpoint={updatePartnerEndpoint}
                      onRemoveEndpoint={removePartnerEndpoint}
                      onUpdateDebugMode={updateDebugMode}
                      onUpdateGzipEnabled={updateGzipEnabled}
                      onUpdateQpsLimit={updateQpsLimit}
                      onUpdateSni={updateSni}
                      onUpdateConnectorKind={updateConnectorKind}
                      onUpdateUserSyncedOnly={updateUserSyncedOnly}
                      onUpdateTargetingDealsOnly={updateTargetingDealsOnly}
                      onUpdateTargetingDevices={updateTargetingDevices}
                      onAddNewTargetingRule={addNewTargetingRule}
                      onUpdateTargetingCountries={updateTargetingCountries}
                      onUpdateTargetingSiteDomains={updateTargetingSiteDomains}
                      onUpdateTargetingAppBundles={updateTargetingAppBundles}
                      onUpdateConnectorContent={updateConnectorContent} 
                      onRemoveTargetingRule={removeTargetingRule}
                      onUpdateTargetingCountriesExclusion={updateTargetingCountriesExclusion}
                      onUpdateTargetingSiteDomainsExclusion={updateTargetingSiteDomainsExclusion}
                      onUpdateTargetingAppBundlesExclusion={updateTargetingAppBundlesExclusion}
                      visibleSections={["endpoints"]}
                    />
                    ) : (
                      <SectionFallback title="Partner Endpoints" />
                    )}
                  </section>
                )}
                {selectedSection === 'advanced' && (
                  <section id="advanced">
                    {response.data ? (
                    <DspAdvancedSettingsSidebar
                      data={response.data}
                      onUpdateSupplyChainMaxNodes={updateSupplyChainMaxNodes}
                      onUpdateRevenueAuctionType={updateRevenueAuctionType}
                      onUpdateBidRequestOverwrite={updateBidRequestOverwrite}
                      onUpdateCreativeScan={updateCreativeScan}
                      onUpdateDuplicationFactor={updateDuplicationFactor}
                      onUpdateFees={updateFees}
                      onUpdateFraudDetectionLevel={updateFraudDetectionLevel}
                      onUpdateCookieSyncIds={updateCookieSyncIds}
                      isSaving={loading}
                    />
                    ) : (
                      <SectionFallback title="Advanced Settings" />
                    )}
                  </section>
                )}
                {selectedSection === 'targeting' && (
                  <section id="targeting">
                    {response.data ? (
                    <DspConfigDisplay
                      data={response.data}
                      onUpdateName={updateName}
                      onUpdateStatus={updateStatus}
                      onUpdateEndpoint={updatePartnerEndpoint}
                      onRemoveEndpoint={removePartnerEndpoint}
                      onUpdateDebugMode={updateDebugMode}
                      onUpdateGzipEnabled={updateGzipEnabled}
                      onUpdateQpsLimit={updateQpsLimit}
                      onUpdateSni={updateSni}
                      onUpdateConnectorKind={updateConnectorKind}
                      onUpdateUserSyncedOnly={updateUserSyncedOnly}
                      onUpdateTargetingDealsOnly={updateTargetingDealsOnly}
                      onUpdateTargetingDevices={updateTargetingDevices}
                      onAddNewTargetingRule={addNewTargetingRule}
                      onUpdateTargetingCountries={updateTargetingCountries}
                      onUpdateTargetingSiteDomains={updateTargetingSiteDomains}
                      onUpdateTargetingAppBundles={updateTargetingAppBundles}
                      onUpdateConnectorContent={updateConnectorContent} 
                      onRemoveTargetingRule={removeTargetingRule}
                      onUpdateTargetingCountriesExclusion={updateTargetingCountriesExclusion}
                      onUpdateTargetingSiteDomainsExclusion={updateTargetingSiteDomainsExclusion}
                      onUpdateTargetingAppBundlesExclusion={updateTargetingAppBundlesExclusion}
                      onUpdateCncDeserializer={updateCncDeserializer}
                      onUpdateCncSerializer={updateCncSerializer}
                      visibleSections={["targeting"]}
                    />
                    ) : (
                      <SectionFallback title="Targeting" />
                    )}
                  </section>
                )}
                {selectedSection === 'block-creative' && (
                  <section id="block-creative">
                    <DspBlockCreative
                      partnerUid={response?.data?.uid || searchParams.get('id') || ''}
                      authToken={getTokenToUse()}
                    />
                  </section>
                )}
              </>
            )}

            {!loading && !response && !error && (
              <Card className="border-slate-200 shadow-lg border-dashed h-full">
                <CardContent className="flex items-center justify-center h-full py-16">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Play className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-500 font-medium text-lg">Ready to execute API request</p>
                  </div>
                </CardContent>
              </Card>
            )}
      </div>
    </EditEntityPageLayout>
  );
}