
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

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { apiUrl } from "@/config/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Play,
  AlertCircle,
  Loader2,
  Network,
  Type,
  Settings,
  FileText,
  Server,
  Layers,
  Target,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams, useNavigate } from "react-router-dom";
import { EditEntityPageLayout } from "@/components/layouts/EditEntityPageLayout";

import BrokerConfigDisplay from "../../components/broker/BrokerConfigDisplay";
import BrokerSettingsSidebar from "../../components/broker/BrokerSettingsSidebar";
import BrokerDataCenterSettings from "../../components/broker/BrokerDataCenterSettings";
import BrokerAdTransformationSettings from "../../components/broker/BrokerAdTransformationSettings";

const BROKER_EDIT_SECTIONS = [
  { id: "general", label: "General info", icon: <Type className="w-4 h-4" /> },
  { id: "ssp-config", label: "SSP Configuration", icon: <Settings className="w-4 h-4" /> },
  { id: "content", label: "Contents", icon: <FileText className="w-4 h-4" /> },
  { id: "data-centers", label: "Data centers", icon: <Server className="w-4 h-4" /> },
  { id: "ad-transformation", label: "Ad transform", icon: <Layers className="w-4 h-4" /> },
  { id: "targeting", label: "Targeting", icon: <Target className="w-4 h-4" /> },
];

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

function cloneBrokerData(data) {
  if (!data) return data;
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(data);
    } catch {
      /* ignore */
    }
  }
  return JSON.parse(JSON.stringify(data));
}


export default function EditBroker() {
  // Authentication hook
  const { getToken } = useAuth();
  
  // URL search params hook
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Form input state
  const [brokerId, setBrokerId] = useState("");
  const [authToken, setAuthToken] = useState("");
  
  // API response state
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
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
    }
  }, [getToken, searchParams]);

  /** Same pattern as Edit DSP / Deal: edits are local until Save (single PUT). */
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [isSavingBroker, setIsSavingBroker] = useState(false);
  const brokerDataRef = useRef(null);
  /** Success banner (same pattern as Edit Deal / Edit Placement). */
  const [success, setSuccess] = useState("");
  const [isSuccessVisible, setIsSuccessVisible] = useState(false);

  const clearPendingChanges = useCallback(() => setHasPendingChanges(false), []);

  const applyLocalChange = useCallback((updater) => {
    setResponse((prev) => {
      if (!prev?.data) return prev;
      const cloned = cloneBrokerData(prev.data);
      updater(cloned);
      brokerDataRef.current = cloned;
      return { ...prev, data: cloned };
    });
    setHasPendingChanges(true);
  }, []);

  const applyBrokerFieldPatch = useCallback(
    (fieldData) => {
      applyLocalChange((d) => {
        Object.entries(fieldData).forEach(([key, val]) => {
          if (val !== null && val !== undefined) {
            d[key] = val;
          }
        });
      });
    },
    [applyLocalChange]
  );

  /**
   * Merge UI SSP flags into draft broker (same mapping as previous immediate PUT).
   */
  const applySspConfigDraft = useCallback(
    (newSspSettings) => {
      applyLocalChange((d) => {
        const updatedSspConfig = { ...(d.ssp_config || {}) };
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
        d.ssp_config = updatedSspConfig;
      });
    },
    [applyLocalChange]
  );

  const applyDebugDraft = useCallback(
    (newDebugData) => {
      applyLocalChange((d) => {
        d.debug = newDebugData;
      });
    },
    [applyLocalChange]
  );

  const applyDataCentersDraft = useCallback(
    (newDataCenters) => {
      applyLocalChange((d) => {
        d.data_centers = newDataCenters;
      });
    },
    [applyLocalChange]
  );

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

      // Handle HTTP errors
      if (!fetchResponse.ok) {
        throw new Error(`HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`);
      }

      // Parse and store successful response
      const jsonData = await fetchResponse.json();
      brokerDataRef.current = jsonData;
      setResponse({
        status: fetchResponse.status,
        statusText: fetchResponse.statusText,
        headers: Object.fromEntries(fetchResponse.headers.entries()),
        data: jsonData
      });
      setHasPendingChanges(false);

    } catch (err) {
      // Handle and display errors
      setError(`An error occurred while retrieving data: ${err.message}. Please check the provided broker ID and auth token and try again.`);
    }

    setLoading(false);
  };

  /** Persist full broker draft (same as previous per-field PUT, one round-trip). */
  const performBrokerSave = useCallback(async () => {
    const data = brokerDataRef.current;
    if (!data) {
      setError("No data loaded to save. Please load the broker first.");
      return;
    }

    const tokenToUse = authToken.trim() || getToken();
    if (!tokenToUse) {
      setError("Please login first or provide an auth token");
      return;
    }

    setIsSavingBroker(true);
    setError(null);
    setSuccess("");

    try {
      const draft = cloneBrokerData(data);
      delete draft.endpoint_id;
      delete draft.endpoint_type;
      delete draft.provisioning_status;
      const cleanedData = removeNullFields(draft);

      const transformedData = {
        ...cleanedData,
        lock_version: (cleanedData.lock_version || 0) + 1,
      };

      const payload = { Data: transformedData };
      const url = apiUrl.brokerPartner(brokerId);

      const updateResponse = await fetch(url, {
        method: "PUT",
        headers: {
          "x-ayl-auth-token": tokenToUse,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!updateResponse.ok) {
        const errorBody = await updateResponse.text();
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}. Details: ${errorBody}`);
      }

      const updatedJsonData = await updateResponse.json();
      const updatedData = updatedJsonData?.Data ?? updatedJsonData;
      const nextData = updatedData ?? brokerDataRef.current;
      brokerDataRef.current = nextData;
      setResponse((prev) => ({
        ...prev,
        data: nextData,
      }));
      clearPendingChanges();
      setSuccess("Broker updated successfully!");
    } catch (err) {
      setError(`Error saving broker: ${err.message}`);
    } finally {
      setIsSavingBroker(false);
    }
  }, [authToken, brokerId, clearPendingChanges, getToken]);

  // Auto-hide success message after 3s with fade (same as Edit Placement / Edit Deal)
  useEffect(() => {
    if (success) {
      setIsSuccessVisible(true);
      const fadeOutTimer = setTimeout(() => {
        setIsSuccessVisible(false);
      }, 2400);
      const hideTimer = setTimeout(() => {
        setSuccess("");
      }, 3000);
      return () => {
        clearTimeout(fadeOutTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [success]);

  // Auto-execute request when brokerId is set from URL
  useEffect(() => {
    if (brokerId && authToken) {
      executeRequest();
    }
  }, [brokerId]); // Only run when brokerId changes

  const updateName = async (newName) => {
    applyBrokerFieldPatch({ name: newName });
  };

  const updateSellerId = async (newSellerId) => {
    applyBrokerFieldPatch({ seller_id: newSellerId });
  };

  const updateUrl = async (newUrl) => {
    applyBrokerFieldPatch({ url: newUrl });
  };

  const updateTagIdOverride = async (newTagId) => {
    applyBrokerFieldPatch({ tag_id_override: newTagId });
  };

  const updateInventoryDirectness = async (newDirectness) => {
    applyBrokerFieldPatch({ inventory_directness: newDirectness });
  };

  const updateConnectorKind = async (newKind) => {
    applyBrokerFieldPatch({ connector_kind: newKind });
  };

  const updateContents = async (newContents) => {
    applyBrokerFieldPatch({ contents: newContents });
  };

  const updateTargeting = async (newTargeting) => {
    applyBrokerFieldPatch({ targeting: newTargeting });
  };

  const updateVisitorKind = async (newVisitorKind) => {
    applyBrokerFieldPatch({ visitor_kind: newVisitorKind });
  };

  const updateVisibility = async (newVisibility) => {
    applyBrokerFieldPatch({ visibility: newVisibility });
  };

  const brokerNameFromUrl = searchParams.get("name");
  const brokerName = response?.data?.name || brokerNameFromUrl || "Broker Configuration";
  const displayName = brokerNameFromUrl?.trim()
    ? decodeURIComponent(brokerNameFromUrl)
    : brokerName;
  const truncatedTitle =
    displayName.length > 42 ? `${displayName.slice(0, 42)}…` : displayName;

  const partnerIdFromUrl = searchParams.get("id")?.trim();

  const editSections = useMemo(
    () =>
      BROKER_EDIT_SECTIONS.map((s) => ({
        ...s,
        disabled:
          s.id === "data-centers" &&
          Boolean(response?.data) &&
          response.data.data_centers == null,
      })),
    [response?.data]
  );

  const layoutAlerts = useMemo(() => {
    const list = [];
    if (error) {
      list.push(
        <Alert key="broker-error" variant="destructive" className="mb-6 border-red-200 bg-red-50">
          <AlertCircle className="h-5 w-5" />
          <AlertDescription className="text-red-800 font-medium">{error}</AlertDescription>
        </Alert>
      );
    }
    if (success) {
      list.push(
        <Alert
          key="broker-save-success"
          className={`border-green-200 bg-green-50 transition-opacity duration-700 ${isSuccessVisible ? "opacity-100" : "opacity-0"}`}
        >
          <AlertDescription className="text-green-800 font-medium">{success}</AlertDescription>
        </Alert>
      );
    }
    return list;
  }, [error, success, isSuccessVisible]);

  if (!partnerIdFromUrl) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">No broker selected</h2>
          <p className="text-slate-600 mb-4">Open a broker from the list to edit it.</p>
          <Button variant="outline" onClick={() => navigate("/BrokerManagement")}>
            Back to Broker Management
          </Button>
        </div>
      </div>
    );
  }

  return (
    <EditEntityPageLayout
      sections={editSections}
      selectedSection={selectedSection}
      onSectionSelect={setSelectedSection}
      sectionCardTitle="General Parameters"
      headerIcon={<Network className="w-7 h-7" />}
      title={truncatedTitle}
      titleTooltip={displayName}
      subtitle="Edit broker configuration"
      onSave={performBrokerSave}
      onCancel={() => navigate("/BrokerManagement")}
      saving={isSavingBroker}
      saveDisabled={!response?.data || !hasPendingChanges}
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
                      onUpdateSspConfig={applySspConfigDraft}
                      onUpdateDebug={applyDebugDraft}
                      onUpdateVisitorKind={updateVisitorKind}
                      isSaving={isSavingBroker}
                    />
                  </section>
                )}
                {(selectedSection === 'ad-transformation') && (
                  <section id="ad-transformation">
                    <BrokerAdTransformationSettings
                      data={response.data}
                      onUpdateSspConfig={applySspConfigDraft}
                      saving={isSavingBroker}
                    />
                  </section>
                )}
                {(selectedSection === 'data-centers' && response.data.data_centers) && (
                  <section id="data-centers">
                    <BrokerDataCenterSettings
                      dataCenters={response.data.data_centers}
                      onUpdate={applyDataCentersDraft}
                      isSaving={isSavingBroker}
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
    </EditEntityPageLayout>
  );
}
