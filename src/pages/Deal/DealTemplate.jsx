
/**
 * Deal Page Component
 * 
 * This page provides a complete interface for managing deal configurations.
 * It allows users to input deal ID and authentication token, execute API requests
 * to retrieve deal data, and manage various deal settings including access control,
 * floor prices, ad kinds, auction types, and date ranges.
 * 
 * Features:
 * - Deal data retrieval via API
 * - Deal configuration management
 * - Real-time editing of deal properties
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
  HandCoins
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// Import deal-specific components
import DealRequestForm from "../components/deal/DealRequestForm";
import DealConfigDisplay from "../components/deal/DealConfigDisplay";
import DealLeftSidebar from "../components/deal/DealLeftSidebar";

/**
 * Recursively removes null and undefined fields from an object
 * This utility function is used to clean API response data before sending updates
 * @param {any} obj - The object to clean
 * @returns {any} - The cleaned object with null/undefined fields removed
 */
const removeNullFields = (obj) => {
  // Return primitive values as-is
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays by filtering out null/undefined items
  if (Array.isArray(obj)) {
    return obj.map(item => removeNullFields(item)).filter(item => item !== null && item !== undefined);
  }

  // Process object properties recursively
  const newObj = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (value !== null && value !== undefined) {
        newObj[key] = removeNullFields(value);
      }
    }
  }
  return newObj;
};

export default function Deal() {
  // Authentication hook
  const { getToken, validateToken } = useAuth();
  
  // Form input state
  const [dealId, setDealId] = useState("");
  const [authToken, setAuthToken] = useState("");
  
  // API response state
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [responseTime, setResponseTime] = useState(null);

  // Load saved token on component mount
  useEffect(() => {
    const savedToken = getToken();
    if (savedToken) {
      setAuthToken(savedToken);
    }
  }, [getToken]);

  // API URL - computed based on dealId
  const getApiUrl = () => apiUrl.deal(dealId);

  const executeRequest = async () => {
    if (!dealId.trim()) {
      setError("Please provide deal ID");
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
      setResponse({
        status: fetchResponse.status,
        statusText: fetchResponse.statusText,
        headers: Object.fromEntries(fetchResponse.headers.entries()),
        data: jsonData
      });

    } catch (err) {
      setError(`An error occurred while retrieving data: ${err.message}. Please check the provided deal ID and auth token and try again.`);
    }

    setLoading(false);
  };

  const updateName = async (newName) => {
    if (!response?.data) {
        setError("No data loaded to update. Please execute a GET request first.");
        return;
    }

    setLoading(true);
    setError(null);

    try {
      const originalData = response.data.Data;
      const cleanedData = removeNullFields(originalData);
      
      const transformedData = {
        ...cleanedData,
        Name: newName,
        LockVersion: (originalData.LockVersion || 0) + 1
      };

      const payload = {
        Data: transformedData,
        Kind: "Deal",
        Version: 1000
      };

      const url = getApiUrl();
      
      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
      }

      const updatedJsonData = await updateResponse.json();
      
      setResponse({
        ...response,
        data: updatedJsonData
      });

    } catch (err) {
      setError(`Error updating name: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  const updateAccess = async (newAccess) => {
    if (!response?.data) {
        setError("No data loaded to update. Please execute a GET request first.");
        return;
    }

    setLoading(true);
    setError(null);

    try {
      const originalData = response.data.Data;
      const cleanedData = removeNullFields(originalData);
      
      const transformedData = {
        ...cleanedData,
        Access: newAccess,
        LockVersion: (originalData.LockVersion || 0) + 1
      };

      const payload = {
        Data: transformedData,
        Kind: "Deal",
        Version: 1000
      };

      const url = getApiUrl();
      
      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
      }

      const updatedJsonData = await updateResponse.json();
      
      setResponse({
        ...response,
        data: updatedJsonData
      });

    } catch (err) {
      setError(`Error updating access: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  const updateFloor = async (newFloor) => {
    if (!response?.data) {
        setError("No data loaded to update. Please execute a GET request first.");
        return;
    }

    setLoading(true);
    setError(null);

    try {
      const originalData = response.data.Data;
      const cleanedData = removeNullFields(originalData);
      
      const transformedData = {
        ...cleanedData,
        Floor: newFloor,
        LockVersion: (originalData.LockVersion || 0) + 1
      };

      const payload = {
        Data: transformedData,
        Kind: "Deal",
        Version: 1000
      };

      const url = getApiUrl();
      
      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
      }

      const updatedJsonData = await updateResponse.json();
      
      setResponse({
        ...response,
        data: updatedJsonData
      });

    } catch (err) {
      setError(`Error updating floor: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  const updateAuctionType = async (newAuctionType) => {
    if (!response?.data) {
        setError("No data loaded to update. Please execute a GET request first.");
        return;
    }

    setLoading(true);
    setError(null);

    try {
      const originalData = response.data.Data;
      const cleanedData = removeNullFields(originalData);
      
      const transformedData = {
        ...cleanedData,
        AuctionType: newAuctionType,
        LockVersion: (originalData.LockVersion || 0) + 1
      };

      const payload = {
        Data: transformedData,
        Kind: "Deal",
        Version: 1000
      };

      const url = getApiUrl();
      
      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
      }

      const updatedJsonData = await updateResponse.json();
      
      setResponse({
        ...response,
        data: updatedJsonData
      });

    } catch (err) {
      setError(`Error updating auction type: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  const updateAdKinds = async (newAdKinds) => {
    if (!response?.data) {
        setError("No data loaded to update. Please execute a GET request first.");
        return;
    }

    setLoading(true);
    setError(null);

    try {
      const originalData = response.data.Data;
      const cleanedData = removeNullFields(originalData);
      
      const transformedData = {
        ...cleanedData,
        AdKinds: newAdKinds,
        LockVersion: (originalData.LockVersion || 0) + 1
      };

      const payload = {
        Data: transformedData,
        Kind: "Deal",
        Version: 1000
      };

      const url = getApiUrl();
      
      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
      }

      const updatedJsonData = await updateResponse.json();
      
      setResponse({
        ...response,
        data: updatedJsonData
      });

    } catch (err) {
      setError(`Error updating Ad Kinds: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  const updateExcludedDeals = async (newExcludedDeals) => {
    if (!response?.data) {
        setError("No data loaded to update. Please execute a GET request first.");
        return;
    }

    setLoading(true);
    setError(null);

    try {
      const originalData = response.data.Data;
      
      // Don't clean the data before adding ExcludedDeals to ensure empty arrays are sent
      const transformedData = {
        ...originalData,
        ExcludedDeals: newExcludedDeals,
        LockVersion: (originalData.LockVersion || 0) + 1
      };

      const payload = {
        Data: transformedData,
        Kind: "Deal",
        Version: 1000
      };

      const url = getApiUrl();

      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
      }

      const updatedJsonData = await updateResponse.json();

      setResponse({
        ...response,
        data: updatedJsonData
      });

    } catch (err) {
      setError(`Error updating Excluded Deals: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  const updateAudiences = async (newAudiences) => {
    if (!response?.data) {
        setError("No data loaded to update. Please execute a GET request first.");
        return;
    }

    setLoading(true);
    setError(null);

    try {
      const originalData = response.data.Data;
      
      // Don't clean the data before adding Audiences to ensure empty arrays are sent
      const transformedData = {
        ...originalData,
        Audiences: newAudiences,
        LockVersion: (originalData.LockVersion || 0) + 1
      };

      const payload = {
        Data: transformedData,
        Kind: "Deal",
        Version: 1000
      };

      const url = getApiUrl();

      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
      }

      const updatedJsonData = await updateResponse.json();

      setResponse({
        ...response,
        data: updatedJsonData
      });

    } catch (err) {
      setError(`Error updating Audiences: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  const updateDistributionChannels = async (newChannels) => {
    if (!response?.data) {
        setError("No data loaded to update. Please execute a GET request first.");
        return;
    }

    setLoading(true);
    setError(null);

    try {
      const originalData = response.data.Data;
      
      // Don't clean the data before adding DistributionChannelKinds
      const transformedData = {
        ...originalData,
        DistributionChannelKinds: newChannels,
        LockVersion: (originalData.LockVersion || 0) + 1
      };

      const payload = {
        Data: transformedData,
        Kind: "Deal",
        Version: 1000
      };

      const url = getApiUrl();

      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${errorText}`);
      }

      const updatedJsonData = await updateResponse.json();

      setResponse({
        ...response,
        data: updatedJsonData
      });

    } catch (err) {
      setError(`Error updating Distribution Channels: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  const updateMeasurementSolutions = async (newMeasurementSolutions) => {
    if (!response?.data) {
        setError("No data loaded to update. Please execute a GET request first.");
        return;
    }

    setLoading(true);
    setError(null);

    try {
      const originalData = response.data.Data;
      
      // Don't clean the data before adding MeasurementSolutions
      const transformedData = {
        ...originalData,
        MeasurementSolutions: newMeasurementSolutions,
        LockVersion: (originalData.LockVersion || 0) + 1
      };

      const payload = {
        Data: transformedData,
        Kind: "Deal",
        Version: 1000
      };

      const url = getApiUrl();

      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${errorText}`);
      }

      const updatedJsonData = await updateResponse.json();

      setResponse({
        ...response,
        data: updatedJsonData
      });

    } catch (err) {
      setError(`Error updating Measurement Solutions: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  const updateCuratedDeals = async (newEnabledValue) => {
    if (!response?.data) {
        setError("No data loaded to update. Please execute a GET request first.");
        return;
    }

    setLoading(true);
    setError(null);

    try {
      const originalData = response.data.Data;
      const cleanedData = removeNullFields(originalData);
      
      const transformedData = {
        ...cleanedData,
        Curated: newEnabledValue,
        LockVersion: (originalData.LockVersion || 0) + 1
      };

      const payload = {
        Data: transformedData,
        Kind: "Deal",
        Version: 1000
      };

      const url = getApiUrl();
      
      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
      }

      const updatedJsonData = await updateResponse.json();
      
      setResponse({
        ...response,
        data: updatedJsonData
      });

    } catch (err) {
      setError(`Error updating Curated Deals: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  const updateStartedAt = async (newTimestamp) => {
    if (!response?.data) {
        setError("No data loaded to update. Please execute a GET request first.");
        return;
    }

    setLoading(true);
    setError(null);

    try {
      const originalData = response.data.Data;
      const cleanedData = removeNullFields(originalData);
      
      const transformedData = {
        ...cleanedData,
        StartedAt: newTimestamp,
        LockVersion: (originalData.LockVersion || 0) + 1
      };

      const payload = {
        Data: transformedData,
        Kind: "Deal",
        Version: 1000
      };

      const url = getApiUrl();
      
      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
      }

      const updatedJsonData = await updateResponse.json();
      
      setResponse({
        ...response,
        data: updatedJsonData
      });

    } catch (err) {
      setError(`Error updating started at: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  const updateFinishedAt = async (newTimestamp) => {
    if (!response?.data) {
        setError("No data loaded to update. Please execute a GET request first.");
        return;
    }

    setLoading(true);
    setError(null);

    try {
      const originalData = response.data.Data;
      const cleanedData = removeNullFields(originalData);
      
      const transformedData = {
        ...cleanedData,
        FinishedAt: newTimestamp,
        LockVersion: (originalData.LockVersion || 0) + 1
      };

      const payload = {
        Data: transformedData,
        Kind: "Deal",
        Version: 1000
      };

      const url = getApiUrl();
      
      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
      }

      const updatedJsonData = await updateResponse.json();
      
      setResponse({
        ...response,
        data: updatedJsonData
      });

    } catch (err) {
      setError(`Error updating finished at: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  const updateBooleanField = async (fieldName, newValue) => {
    if (!response?.data) {
        setError("No data loaded to update. Please execute a GET request first.");
        return;
    }

    setLoading(true);
    setError(null);

    try {
      const originalData = response.data.Data;
      const cleanedData = removeNullFields(originalData);
      
      const transformedData = {
        ...cleanedData,
        [fieldName]: newValue,
        LockVersion: (originalData.LockVersion || 0) + 1
      };

      const payload = {
        Data: transformedData,
        Kind: "Deal",
        Version: 1000
      };

      const url = getApiUrl();
      
      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': authToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
      }

      const updatedJsonData = await updateResponse.json();
      
      setResponse({
        ...response,
        data: updatedJsonData
      });

    } catch (err) {
      setError(`Error updating ${fieldName}: ${err.message}`);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto p-6 lg:p-8">
        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-1 space-y-8">
            <DealRequestForm
              dealId={dealId}
              setDealId={setDealId}
              authToken={authToken}
              setAuthToken={setAuthToken}
              onExecute={executeRequest}
              loading={loading}
            />
            {response && response.data && (
              <DealLeftSidebar
                data={response.data}
                onUpdateAdKinds={updateAdKinds}
                onUpdateBooleanField={updateBooleanField}
                onUpdateCuratedDeals={updateCuratedDeals}
                onUpdateAudiences={updateAudiences}
                onUpdateDistributionChannels={updateDistributionChannels}
                authToken={authToken}
              />
            )}
          </div>

          {/* Right Column */}
          <div className="lg:col-span-2">
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
              <DealConfigDisplay
                data={response.data}
                onUpdateName={updateName}
                onUpdateAccess={updateAccess}
                onUpdateFloor={updateFloor}
                onUpdateBooleanField={updateBooleanField}
                onUpdateAdKinds={updateAdKinds}
                onUpdateAuctionType={updateAuctionType}
                onUpdateCuratedDeals={updateCuratedDeals}
                onUpdateStartedAt={updateStartedAt}
                onUpdateFinishedAt={updateFinishedAt}
                onUpdateExcludedDeals={updateExcludedDeals}
                onUpdateMeasurementSolutions={updateMeasurementSolutions}
                onUpdateAudiences={updateAudiences}
                authToken={authToken}
              />
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
    </div>
  );
}
