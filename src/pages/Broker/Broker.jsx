
/**
 * Broker Page Component
 * 
 * This page provides a complete interface for managing broker configurations.
 * It allows users to input broker ID and authentication token, execute API requests
 * to retrieve broker data, and manage various broker settings including SSP configuration,
 * debug settings, data center management, and ad transformation controls.
 * 
 * Features:
 * - Broker data retrieval via API
 * - Broker configuration management
 * - SSP (Supply-Side Platform) settings
 * - Debug configuration with Chuck Norris ID
 * - Data center management
 * - Ad transformation controls with warnings
 * - Real-time editing of broker properties
 * - Error handling and loading states
 * - Response time tracking
 */

import React, { useState, useEffect } from "react";
import { apiUrl } from "@/config/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Play,
  AlertCircle,
  Loader2,
  Network,
  ArrowLeft
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams, useNavigate } from "react-router-dom";

// Import broker-specific components
import BrokerRequestForm from "../../components/broker/BrokerRequestForm";
import BrokerConfigDisplay from "../../components/broker/BrokerConfigDisplay";
import BrokerSettingsSidebar from "../../components/broker/BrokerSettingsSidebar";
import BrokerDataCenterSettings from "../../components/broker/BrokerDataCenterSettings";
import BrokerAdTransformationSettings from "../../components/broker/BrokerAdTransformationSettings";
import BrokerSectionNav from "../../components/broker/BrokerSectionNav";

/**
 * Recursively removes null and undefined fields from an object
 * This utility function is used to clean API response data before sending updates
 * It handles nested objects and arrays, removing empty structures after cleaning
 * @param {any} obj - The object to clean
 * @returns {any} - The cleaned object with null/undefined fields removed
 */
const removeNullFields = (obj) => {
  // Return primitive values as-is
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays by filtering out null/undefined items and cleaning their contents
  if (Array.isArray(obj)) {
    return obj.map(item => removeNullFields(item)).filter(item => item !== null && item !== undefined);
  }

  // Process object properties recursively
  const newObj = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (value !== null && value !== undefined) {
        if (typeof value === 'object' && !Array.isArray(value)) {
          // Recursively clean objects
          const cleanedValue = removeNullFields(value);
          // Only add if the cleaned object is not empty (unless it was explicitly an empty object)
          if (Object.keys(cleanedValue).length > 0 || value === cleanedValue) {
            newObj[key] = cleanedValue;
          }
        } else if (Array.isArray(value)) {
          // Recursively clean arrays
          const cleanedArray = removeNullFields(value);
          if (cleanedArray.length > 0) {
            newObj[key] = cleanedArray;
          }
        } else {
          // Add primitive values directly
          newObj[key] = value;
        }
      }
    }
  }
  return newObj;
};


export default function Broker() {
  // Authentication hook
  const { getToken, validateToken } = useAuth();
  
  // URL search params hook
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Form input state
  const [brokerId, setBrokerId] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [isIdFromUrl, setIsIdFromUrl] = useState(false);
  
  // API response state
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [responseTime, setResponseTime] = useState(null);
  const [selectedSection, setSelectedSection] = useState('general');

  // Load saved token and broker ID from URL params on component mount
  useEffect(() => {
    const savedToken = getToken();
    if (savedToken) {
      setAuthToken(savedToken);
    }
    
    // Get broker ID from URL parameters
    const brokerIdFromUrl = searchParams.get('id');
    if (brokerIdFromUrl) {
      setBrokerId(brokerIdFromUrl);
      setIsIdFromUrl(true); // Mark that ID came from URL
    }
  }, [getToken, searchParams]);

  // Loading states for different operations
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingDataCenters, setIsSavingDataCenters] = useState(false);

  // API URL - computed based on brokerId
  const getApiUrl = () => apiUrl.brokerPartner(brokerId);

  /**
   * Executes the broker API request to retrieve broker configuration data
   * Handles authentication, error management, and response time tracking
   */
  const executeRequest = async () => {
    // Validate required inputs
    if (!brokerId.trim()) {
      setError("Please provide broker ID");
      return;
    }

    // Use saved token if no token is provided in the form
    const tokenToUse = authToken.trim() || getToken();
    if (!tokenToUse) {
      setError("Please login first or provide an auth token");
      return;
    }

    // Reset state and start loading
    setLoading(true);
    setError(null);
    setResponse(null);
    setResponseTime(null);

    const startTime = Date.now();

    try {
      // Construct API URL for broker data
      const url = getApiUrl();

      // Make API request with authentication headers
      const fetchResponse = await fetch(url, {
        method: 'GET',
        headers: {
          'x-ayl-auth-token': tokenToUse,
          'Content-Type': 'application/json'
        }
      });

      // Calculate and store response time
      const endTime = Date.now();
      setResponseTime(endTime - startTime);

      // Handle HTTP errors
      if (!fetchResponse.ok) {
        throw new Error(`HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`);
      }

      // Parse and store successful response
      const jsonData = await fetchResponse.json();
      setResponse({
        status: fetchResponse.status,
        statusText: fetchResponse.statusText,
        headers: Object.fromEntries(fetchResponse.headers.entries()),
        data: jsonData
      });

    } catch (err) {
      // Handle and display errors
      setError(`An error occurred while retrieving data: ${err.message}. Please check the provided broker ID and auth token and try again.`);
    }

    setLoading(false);
  };

  // Auto-execute request when brokerId is set from URL
  useEffect(() => {
    if (brokerId && authToken) {
      executeRequest();
    }
  }, [brokerId]); // Only run when brokerId changes

  /**
   * Updates broker configuration fields via API
   * Handles data cleaning, lock versioning, and error management
   * @param {Object} fieldData - The fields to update in the broker configuration
   */
  const updateBrokerField = async (fieldData) => {
      if (!response?.data) {
          setError("No data loaded to update. Please execute a GET request first.");
          throw new Error("No data loaded");
      }

      setLoading(true);
      setError(null);

      try {
          const { endpoint_id, endpoint_type, provisioning_status, ...originalData } = response.data;
          const cleanedData = removeNullFields(originalData);

          const transformedData = {
              ...cleanedData,
              ...fieldData,
              lock_version: (cleanedData.lock_version || 0) + 1
          };

          // Explicitly preserve numeric/boolean fields that removeNullFields may have dropped
          // (e.g. visibility: 0 or -1 are valid values, not nulls)
          Object.entries(fieldData).forEach(([key, val]) => {
              if (val !== null && val !== undefined) {
                  transformedData[key] = val;
              }
          });

          const payload = { Data: transformedData };
          const url = getApiUrl();

          const updateResponse = await fetch(url, {
              method: 'PUT',
              headers: { 'x-ayl-auth-token': authToken, 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });

          if (!updateResponse.ok) {
              const errorBody = await updateResponse.text();
              throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
          }

          const updatedJsonData = await updateResponse.json();
          // Unwrap Data if API returns { Data: {...} }, then apply fieldData to ensure
          // local state reflects what we just sent (API may return stale values)
          const updatedData = updatedJsonData?.Data ?? updatedJsonData;
          setResponse({ ...response, data: { ...updatedData, ...fieldData } });

      } catch (err) {
          setError(`Error updating broker: ${err.message}`);
          throw err;
      } finally {
          setLoading(false);
      }
  };

  /**
   * Updates broker name
   * @param {string} newName - The new broker name
   */
  const updateName = async (newName) => {
      try {
          await updateBrokerField({ name: newName });
      } catch (err) {
          // Error already handled by updateBrokerField
      }
  };

  /**
   * Updates seller ID
   * @param {string} newSellerId - The new seller ID
   */
  const updateSellerId = async (newSellerId) => {
      try {
          await updateBrokerField({ seller_id: newSellerId });
      } catch (err) {
          // Error already handled by updateBrokerField
      }
  };
  
  /**
   * Updates broker URL
   * @param {string} newUrl - The new broker URL
   */
  const updateUrl = async (newUrl) => {
      try {
          await updateBrokerField({ url: newUrl });
      } catch (err) {
          // Error already handled by updateBrokerField
      }
  };
  
  /**
   * Updates tag ID override
   * @param {string} newTagId - The new tag ID override
   */
  const updateTagIdOverride = async (newTagId) => {
      try {
          await updateBrokerField({ tag_id_override: newTagId });
      } catch (err) {
          // Error already handled by updateBrokerField
      }
  };
  
  /**
   * Updates inventory directness (DIRECT/RESELLER)
   * @param {string} newDirectness - The new inventory directness value
   */
  const updateInventoryDirectness = async (newDirectness) => {
      try {
          await updateBrokerField({ inventory_directness: newDirectness });
      } catch (err) {
          // Error already handled by updateBrokerField
      }
  };

  const updateConnectorKind = async (newKind) => {
      try {
          await updateBrokerField({ connector_kind: newKind });
      } catch (err) {
          // Error already handled by updateBrokerField
      }
  };


  /**
   * Updates SSP (Supply-Side Platform) configuration
   * Handles creative scan, dynamic margin, partner selection, and ad transformation settings
   * @param {Object} newSspSettings - The new SSP settings object
   */
  const updateSspConfig = async (newSspSettings) => {
    if (!response?.data) {
        setError("No data loaded to update. Please execute a GET request first.");
        return;
    }

    setIsSavingSettings(true);
    setError(null);

    try {
      // Exclude read-only fields and clean the data
      const { endpoint_id, endpoint_type, provisioning_status, ...originalData } = response.data;
      const cleanedData = removeNullFields(originalData);

      // Transform UI settings to API format (invert boolean values for disable flags)
      // SECURITY: Always preserve ALL existing ssp_config properties to prevent data loss
      const updatedSspConfig = {
        ...cleanedData.ssp_config, // Keep ALL existing ssp_config values (SECURITY: never remove original properties)
      };
      
      // Only update properties that are explicitly provided in newSspSettings
      if (newSspSettings.creativeScan !== undefined) {
        updatedSspConfig.disable_creative_scan = !newSspSettings.creativeScan;
      }
      if (newSspSettings.dynamicMargin !== undefined) {
        updatedSspConfig.disable_dynamic_margin = !newSspSettings.dynamicMargin;
      }
      if (newSspSettings.partnerSelection !== undefined) {
        updatedSspConfig.disable_partner_selection = !newSspSettings.partnerSelection;
      }
      if (newSspSettings.enabled !== undefined) {
        updatedSspConfig.disabled = !newSspSettings.enabled;
      }
      if (newSspSettings.margin !== undefined) {
        updatedSspConfig.margin = newSspSettings.margin;
      }
      if (newSspSettings.preventNative2Banner !== undefined) {
        updatedSspConfig.prevent_native2banner = newSspSettings.preventNative2Banner;
      }
      if (newSspSettings.preventVideo2Banner !== undefined) {
        updatedSspConfig.prevent_video2banner = newSspSettings.preventVideo2Banner;
      }
      if (newSspSettings.preventVideo2Native !== undefined) {
        updatedSspConfig.prevent_video2native = newSspSettings.preventVideo2Native;
      }

      // Merge updated SSP config with existing data
      const transformedData = {
        ...cleanedData,
        ssp_config: updatedSspConfig,
        lock_version: (cleanedData.lock_version || 0) + 1
      };
      
      // Prepare API payload
      const payload = { Data: transformedData };

      const url = getApiUrl();
      
      const tokenToUse = authToken.trim() || getToken();
      if (!tokenToUse) {
        setError("Please login first or provide an auth token");
        return;
      }

      // Send PUT request to update SSP configuration
      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': tokenToUse,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
      }

      // Update local state with new data
      const updatedJsonData = await updateResponse.json();
      setResponse({
        ...response,
        data: updatedJsonData
      });

    } catch (err) {
      setError(`Error updating SSP config: ${err.message}`);
    } finally {
        setIsSavingSettings(false);
    }
  };

  /**
   * Updates debug configuration (logging settings and Chuck Norris ID)
   * @param {Object} newDebugData - The new debug configuration object
   */
  const updateDebugConfig = async (newDebugData) => {
    if (!response?.data) {
        setError("No data loaded to update.");
        return;
    }

    setIsSavingSettings(true); // Reuse settings saving state for spinner
    setError(null);

    try {
        // Exclude read-only fields and clean the data
        const { endpoint_id, endpoint_type, provisioning_status, ...originalData } = response.data;
        const cleanedData = removeNullFields(originalData);

        // Merge debug configuration with existing data
        const transformedData = {
            ...cleanedData,
            debug: newDebugData,
            lock_version: (cleanedData.lock_version || 0) + 1
        };

        const payload = { Data: transformedData };

        const url = getApiUrl();

        // Send PUT request to update debug configuration
        const updateResponse = await fetch(url, {
            method: 'PUT',
            headers: { 'x-ayl-auth-token': authToken, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!updateResponse.ok) {
            const errorBody = await updateResponse.text();
            throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
        }

        const updatedJsonData = await updateResponse.json();
        setResponse({ ...response, data: updatedJsonData });

    } catch (err) {
        setError(`Error updating Debug config: ${err.message}`);
    } finally {
        setIsSavingSettings(false);
    }
  };

  const updateDataCenters = async (newDataCenters) => {
    if (!response?.data) {
        setError("No data loaded to update.");
        return;
    }

    setIsSavingDataCenters(true);
    setError(null);

    try {
        const { endpoint_id, endpoint_type, provisioning_status, ...originalData } = response.data;
        const cleanedData = removeNullFields(originalData);

        const transformedData = {
            ...cleanedData,
            data_centers: newDataCenters,
            lock_version: (cleanedData.lock_version || 0) + 1
        };

        const payload = { Data: transformedData };

        const url = getApiUrl();

        const updateResponse = await fetch(url, {
            method: 'PUT',
            headers: { 'x-ayl-auth-token': authToken, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!updateResponse.ok) {
            const errorBody = await updateResponse.text();
            throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
        }

        const updatedJsonData = await updateResponse.json();
        setResponse({ ...response, data: updatedJsonData });

    } catch (err) {
        setError(`Error updating Data Centers: ${err.message}`);
    } finally {
        setIsSavingDataCenters(false);
    }
  };

  const updateContents = async (newContents) => {
      try {
          await updateBrokerField({ contents: newContents });
      } catch (err) {
          // Error already handled by updateBrokerField
      }
  };

  const updateTargeting = async (newTargeting) => {
      try {
          await updateBrokerField({ targeting: newTargeting });
      } catch (err) {
          // Error already handled by updateBrokerField
      }
  };

  /**
   * Updates visitor_kind (Matching Table Host)
   * @param {string} newVisitorKind - The new visitor_kind value ("AYL" or "EXTERNAL")
   */
  const updateVisitorKind = async (newVisitorKind) => {
      try {
          await updateBrokerField({ visitor_kind: newVisitorKind });
      } catch (err) {
          // Error already handled by updateBrokerField
      }
  };

  const updateVisibility = async (newVisibility) => {
      try {
          await updateBrokerField({ visibility: newVisibility });
      } catch (err) {
          // Error already handled by updateBrokerField
      }
  };

  // Get the Broker name from URL params or from response data
  const brokerNameFromUrl = searchParams.get('name');
  const brokerName = response?.data?.name || brokerNameFromUrl || 'Broker Configuration';
  
  // Get initials for the Broker name
  const getBrokerInitials = (name) => {
    if (!name) return 'B';
    const words = name.split('_');
    if (words.length >= 2) {
      return words.slice(0, 2).map(w => w[0]).join('').toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="bg-slate-50">
      <div className="max-w-7xl mx-auto p-6 lg:p-8">
        {/* Horizontal Navigation */}
        {response && response.data && (
          <BrokerSectionNav currentSection={selectedSection} onSelect={setSelectedSection} horizontal={true} />
        )}
        
        {/* Main Content */}
        <div className="space-y-6">
            {error && (
              <Alert variant="destructive" className="mb-6 border-red-200 bg-red-50">
                <AlertCircle className="h-5 w-5" />
                <AlertDescription className="text-red-800 font-medium">
                  {error}
                </AlertDescription>
              </Alert>
            )}

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

            {response && response.data && (
              <div className="space-y-6">
                {(selectedSection === 'general') && (
                  <section id="general">
                    <BrokerConfigDisplay
                      data={response.data}
                      onUpdateName={updateName}
                      onUpdateSellerId={updateSellerId}
                      onUpdateUrl={updateUrl}
                      onUpdateTagIdOverride={updateTagIdOverride}
                      onUpdateContents={updateContents}
                      onUpdateTargeting={updateTargeting}
                      onUpdateInventoryDirectness={updateInventoryDirectness}
                      onUpdateConnectorKind={updateConnectorKind}
                      onUpdateVisibility={updateVisibility}
                      visibleSections={['general']}
                    />
                  </section>
                )}
                {(selectedSection === 'content') && (
                  <section id="content">
                    <BrokerConfigDisplay
                      data={response.data}
                      onUpdateName={updateName}
                      onUpdateSellerId={updateSellerId}
                      onUpdateUrl={updateUrl}
                      onUpdateTagIdOverride={updateTagIdOverride}
                      onUpdateContents={updateContents}
                      onUpdateTargeting={updateTargeting}
                      onUpdateInventoryDirectness={updateInventoryDirectness}
                      onUpdateConnectorKind={updateConnectorKind}
                      visibleSections={['contents']}
                    />
                  </section>
                )}
                {(selectedSection === 'ssp-config') && (
                  <section id="ssp-config" className="space-y-6">
                    <BrokerSettingsSidebar
                      data={response.data}
                      onUpdateSspConfig={updateSspConfig}
                      onUpdateDebug={updateDebugConfig}
                      onUpdateVisitorKind={updateVisitorKind}
                      isSaving={isSavingSettings}
                    />
                  </section>
                )}
                {(selectedSection === 'ad-transformation') && (
                  <section id="ad-transformation">
                    <BrokerAdTransformationSettings
                      data={response.data}
                      onUpdateSspConfig={updateSspConfig}
                    />
                  </section>
                )}
                {(selectedSection === 'data-centers' && response.data.data_centers) && (
                  <section id="data-centers">
                    <BrokerDataCenterSettings
                      dataCenters={response.data.data_centers}
                      onUpdate={updateDataCenters}
                      isSaving={isSavingDataCenters}
                    />
                  </section>
                )}
                {(selectedSection === 'targeting') && (
                  <section id="targeting">
                    <BrokerConfigDisplay
                      data={response.data}
                      onUpdateName={updateName}
                      onUpdateSellerId={updateSellerId}
                      onUpdateUrl={updateUrl}
                      onUpdateTagIdOverride={updateTagIdOverride}
                      onUpdateContents={updateContents}
                      onUpdateTargeting={updateTargeting}
                      onUpdateInventoryDirectness={updateInventoryDirectness}
                      onUpdateConnectorKind={updateConnectorKind}
                      visibleSections={['targeting']}
                    />
                  </section>
                )}
              </div>
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
      </div>
    </div>
  );
}
