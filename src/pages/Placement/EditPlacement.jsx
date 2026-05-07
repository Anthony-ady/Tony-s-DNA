import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { ArrowLeft, Building2, Settings, Loader2, Save, X, AlertCircle, Target, Shield, Monitor, Smartphone, Tablet, Tv, DollarSign, Palette, Check, ChevronsUpDown, ClipboardCopy, ChevronRight, Plus } from 'lucide-react';
import { authService } from '../../services/authService';
import ToggleSwitch from '../../components/ui/toggle-switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Slider } from '../../components/ui/slider';
import { Checkbox } from '../../components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../components/ui/collapsible';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../../components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { cn } from '@/lib/utils';
import { TAILWIND_CLASSES } from '@/config/theme';
import { API_ENDPOINTS, apiUrl } from '@/config/api';
import EntityEditorLayout from '@/components/layouts/EntityEditorLayout';
import { toast } from 'sonner';
import creativeScanPolicies from '../Realm/creative-scan-policies.json';
import { IAB_TAXONOMY, getIABCodesForCategory } from '@/utils/iabTaxonomy';
import { toggleChipClassName } from '@/lib/toggleChip';

/** Remove IAB inclusion keys from SspConfig (allowed IAB is edited on Site, not on Placement). */
function stripIabCategoriesFromSspConfig(ssp) {
  if (!ssp || typeof ssp !== 'object') return ssp;
  const next = { ...ssp };
  delete next.IABCategories;
  delete next.IabCategories;
  return next;
}

// Predefined banner sizes with categories and descriptive names
const BANNER_SIZES = {
  Horizontal: [
    { Width: 300, Height: 250, name: 'Medium Rectangle/MPU' },
    { Width: 320, Height: 250, name: 'Medium Wide Rectangle' },
    { Width: 336, Height: 280, name: 'Large Rectangle' },
    { Width: 350, Height: 320, name: 'Large Rectangle Extended' },
    { Width: 468, Height: 60, name: 'Banner' },
    { Width: 728, Height: 90, name: 'Leaderboard' },
    { Width: 970, Height: 90, name: 'Large Leaderboard' },
    { Width: 970, Height: 250, name: 'Billboard' },
    { Width: 300, Height: 100, name: '3:1 Rectangle' },
    { Width: 728, Height: 250, name: 'Expanded Leaderboard' },
    { Width: 728, Height: 200, name: 'Expanded Leaderboard' },
    { Width: 120, Height: 60, name: 'Button' }
  ],
  Vertical: [
    { Width: 120, Height: 600, name: 'Skyscraper' },
    { Width: 160, Height: 600, name: 'Wide Skyscraper' },
    { Width: 300, Height: 600, name: 'Half-Page Ad' }
  ],
  Square: [
    { Width: 250, Height: 250, name: 'Square' },
    { Width: 200, Height: 200, name: 'Small Square' }
  ],
  Mobile: [
    { Width: 300, Height: 50, name: 'Smaller Mobile Banner' },
    { Width: 320, Height: 50, name: 'Standard Mobile Banner' },
    { Width: 320, Height: 100, name: 'Large Mobile Banner' },
    { Width: 320, Height: 480, name: 'Mobile Interstitial' }
  ]
};

const EditPlacement = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const placementId = searchParams.get('id');
  const placementName = searchParams.get('name') || 'Unnamed Placement';

  const [placementData, setPlacementData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSection, setSelectedSection] = useState('basic');
  const [error, setError] = useState(null);
  const [brokers, setBrokers] = useState([]);
  const [brokerSearchOpen, setBrokerSearchOpen] = useState(false);
  const [brokerSearchTerm, setBrokerSearchTerm] = useState('');
  const [openIABExclusionId, setOpenIABExclusionId] = useState(null);
  const [newAdvertiserExclusion, setNewAdvertiserExclusion] = useState('');
  const [newPartnerExclusion, setNewPartnerExclusion] = useState('');
  const [newAllowedSeat, setNewAllowedSeat] = useState('');
  const [newBlockedSeat, setNewBlockedSeat] = useState('');
  const [partnerNameMap, setPartnerNameMap] = useState({});
  const [partnerSearchTerm, setPartnerSearchTerm] = useState('');
  const [partnerSearchResults, setPartnerSearchResults] = useState([]);
  const [partnerSearchOpen, setPartnerSearchOpen] = useState(false);
  const initialIabExclusionListRef = useRef(null);

  // Truncate placement name to 15 characters with ellipsis
  const displayPlacementName = placementData?.Name || placementName || 'Placement';
  const truncatedPlacementName = displayPlacementName.length > 15 
    ? `${displayPlacementName.substring(0, 15)}...` 
    : displayPlacementName;

  const handleCopyPlacementId = async () => {
    if (placementData?.Uid) {
      try {
        await navigator.clipboard.writeText(placementData.Uid);
        toast.success('Copied', { description: 'Placement UID copied to clipboard.' });
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const sections = [
    { id: 'basic', label: 'Basic Info', icon: <Building2 className="w-4 h-4" /> },
    { id: 'ssp', label: 'SSP Configuration', icon: <Settings className="w-4 h-4" /> },
    { id: 'revenue', label: 'Revenue', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'integration', label: 'Integration', icon: <Palette className="w-4 h-4" />, disabled: true },
    { id: 'targeting', label: 'Targeting', icon: <Target className="w-4 h-4" /> },
    { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> }
  ];

  useEffect(() => {
    if (placementId) {
      fetchPlacementData();
    }
  }, [placementId]);

  // Fetch brokers list for ExternalPartner selection
  useEffect(() => {
    fetchBrokers();
  }, []);

  // Debounce broker search
  useEffect(() => {
    if (!brokerSearchOpen) return;
    
    const timeoutId = setTimeout(() => {
      fetchBrokers(brokerSearchTerm);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [brokerSearchTerm, brokerSearchOpen]);

  useEffect(() => {
    const fetchPartnerNameMap = async () => {
      const token = authService.getToken();
      if (!token) return;
      try {
        const response = await fetch(API_ENDPOINTS.PARTNERS_SEARCH, {
          method: 'POST',
          headers: { 'x-ayl-auth-token': token, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            Filters: [{ Field: 'Status', Operator: 'in', Value: ['PRODUCTION', 'DISABLED'] }],
            From: 0,
            Order: [{ Field: 'Name', Operator: 'asc' }],
            Size: 500,
          }),
        });
        if (!response.ok) return;
        const data = await response.json();
        const list = Array.isArray(data?.Data) ? data.Data : [];
        const map = {};
        list.forEach((p) => {
          if (p.uid) map[p.uid] = p.name || p.uid;
        });
        setPartnerNameMap(map);
      } catch {
        // ignore
      }
    };
    fetchPartnerNameMap();
  }, []);

  useEffect(() => {
    if (!partnerSearchOpen) return;
    const timeoutId = setTimeout(() => {
      const search = async () => {
        const token = authService.getToken();
        if (!token) return;
        const q = partnerSearchTerm.trim();
        const filters = [{ Field: 'Status', Operator: 'in', Value: ['PRODUCTION', 'DISABLED'] }];
        if (q) {
          const isUid = /^[a-f0-9]{32}$/i.test(q);
          filters.push({
            Field: isUid ? 'Uid' : '_all',
            Operator: 'match',
            Value: q,
          });
        }
        try {
          const response = await fetch(API_ENDPOINTS.PARTNERS_SEARCH, {
            method: 'POST',
            headers: { 'x-ayl-auth-token': token, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              Filters: filters,
              From: 0,
              Order: [{ Field: 'Name', Operator: 'asc' }],
              Size: 50,
            }),
          });
          if (!response.ok) return;
          const data = await response.json();
          const list = Array.isArray(data?.Data) ? data.Data : [];
          setPartnerSearchResults(list.map((p) => ({ uid: p.uid, name: p.name || p.uid })));
        } catch {
          setPartnerSearchResults([]);
        }
      };
      search();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [partnerSearchTerm, partnerSearchOpen]);

  const fetchBrokers = async (searchTerm = '') => {
    try {
      const token = authService.getToken();
      if (!token) return;

      const filters = [];
      
      // Add search filter if search term exists
      if (searchTerm && searchTerm.trim()) {
        const q = searchTerm.trim();
        const isLikelyId = /^[a-f0-9]{32}$/i.test(q);
        if (isLikelyId) {
          filters.push({
            "Field": "Uid",
            "Operator": "match",
            "Value": q
          });
        } else {
          filters.push({
            "Field": "_all",
            "Operator": "match",
            "Value": q
          });
        }
      }

      // Only show production brokers (visibility: 0)
      filters.push({
        "Field": "Visibility",
        "Operator": "in",
        "Value": [0]
      });

      const requestBody = {
        "Filters": filters,
        "From": 0,
        "Order": [
          {
            "Field": "Name",
            "Operator": "asc"
          }
        ],
        "Size": 500 // Get up to 500 brokers
      };
      
      const response = await fetch(API_ENDPOINTS.BROKER_PARTNERS_SEARCH, {
        method: 'POST',
        headers: {
          'x-ayl-auth-token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Transform API data
      const transformedBrokers = data.Data.map(broker => ({
        uid: broker.uid,
        name: broker.name || 'Unnamed Broker'
      }));

      setBrokers(transformedBrokers);
    } catch (err) {
      console.error('Error fetching brokers:', err);
      // Don't show error to user, just log it
    }
  };

  const fetchPlacementData = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      const response = await fetch(apiUrl.placement(placementId), {
        headers: {
          'x-ayl-auth-token': token,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          authService.handleUnauthorized(navigate);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const payload = data.Data;
      setPlacementData(payload);
      initialIabExclusionListRef.current = Array.isArray(payload.SspConfig?.CategoriesExclusion)
        ? [...payload.SspConfig.CategoriesExclusion]
        : [];
    } catch (err) {
      console.error('Error fetching placement data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!placementData || saving) return;

    try {
      setSaving(true);
      setError(null);
      const token = authService.getToken();
      
      // Prepare the data for the API (remove null fields and clean objects)
      const updateData = removeNullFields(placementData);
      
      // Clean Company object - keep only UID if it is an object
      if (updateData.Company && typeof updateData.Company === 'object' && updateData.Company.Uid) {
        updateData.Company = updateData.Company.Uid;
      }
      
      // Clean DistributionChannel object - keep only UID if it is an object
      if (updateData.DistributionChannel && typeof updateData.DistributionChannel === 'object' && updateData.DistributionChannel.Uid) {
        updateData.DistributionChannel = updateData.DistributionChannel.Uid;
      }
      
      // Clean Manager object - keep only UID if it is an object
      if (updateData.Manager && typeof updateData.Manager === 'object' && updateData.Manager.Uid) {
        updateData.Manager = updateData.Manager.Uid;
      }
      
      // Clean Realm object - keep only UID if it is an object
      if (updateData.Realm && typeof updateData.Realm === 'object' && updateData.Realm.Uid) {
        updateData.Realm = updateData.Realm.Uid;
      }
      
      // Clean Site object - keep only UID if it is an object
      if (updateData.Site && typeof updateData.Site === 'object' && updateData.Site.Uid) {
        updateData.Site = updateData.Site.Uid;
      }

      // Allowed IAB categories are configured on Site (Edit Site), not on Placement — omit from PUT.
      delete updateData.IABCategories;
      if (updateData.Targeting && typeof updateData.Targeting === 'object') {
        delete updateData.Targeting.IABCategories;
      }
      if (updateData.SspConfig) {
        updateData.SspConfig = stripIabCategoriesFromSspConfig(updateData.SspConfig);
      }
      
      // Clean CreativeScan object - if DisableCreativeScan is true, only keep that field
      if (updateData.SspConfig?.CreativeScan) {
        if (updateData.SspConfig.CreativeScan.DisableCreativeScan === true) {
          updateData.SspConfig.CreativeScan = {
            DisableCreativeScan: true
          };
        }
      }
      
      // Handle ExternalId and ExternalPartner - include if they have values or if they existed in original data
      // This allows users to add new fields or modify existing ones
      if (updateData.ExternalId === '' && !placementData.ExternalId) {
        delete updateData.ExternalId;
      }
      if (updateData.ExternalPartner === '' && !placementData.ExternalPartner) {
        delete updateData.ExternalPartner;
      }
      
      // Create the proper payload structure
      const payload = {
        Data: updateData,
        Id: placementId,
        Kind: "Placement",
        Version: placementData.LockVersion || 1000
      };

      const response = await fetch(apiUrl.placement(placementId), {
        method: 'PUT',
        headers: {
          'x-ayl-auth-token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        if (response.status === 401) {
          authService.handleUnauthorized(navigate);
          return;
        }
        
        // Try to parse error message from response
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.Message || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      // Re-fetch the placement data to get the updated LockVersion
      await fetchPlacementData();

      toast.success('Placement saved', {
        description: 'Your changes were applied successfully.',
      });
    } catch (err) {
      console.error('Error saving placement:', err);
      toast.error('Save failed', { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const removeNullFields = (obj) => {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(removeNullFields);

    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined) {
        cleaned[key] = removeNullFields(value);
      }
    }
    return cleaned;
  };

  // Helper function to check if a nested property exists
  const hasProperty = (obj, path) => {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
      if (current === null || current === undefined || !(key in current)) {
        return false;
      }
      current = current[key];
    }
    return true;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString('fr-FR');
  };

  const getIntegrationBadgeColor = (kind) => {
    switch (kind) {
      case 'WIDGET': return 'bg-blue-100 text-blue-800';
      case 'TEMPLATE': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAccessBadgeColor = (access) => {
    switch (access) {
      case 'ALL': return 'bg-green-100 text-green-800';
      case 'RESTRICTED': return 'bg-yellow-100 text-yellow-800';
      case 'NONE': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDeviceIcon = (device) => {
    switch (device) {
      case 'DESKTOP': return <Monitor className="w-4 h-4" />;
      case 'MOBILE': return <Smartphone className="w-4 h-4" />;
      case 'TABLET': return <Tablet className="w-4 h-4" />;
      case 'TV': return <Tv className="w-4 h-4" />;
      default: return <Monitor className="w-4 h-4" />;
    }
  };

  const iabCodeToApi = (code) => (code || '').replace(/-/g, '_');

  const iabExclusionList = Array.isArray(placementData?.SspConfig?.CategoriesExclusion)
    ? placementData.SspConfig.CategoriesExclusion
    : [];
  const isIABExclusionSelected = (code) => {
    if (!code) return false;
    const apiCode = iabCodeToApi(code);
    return iabExclusionList.includes(code) || iabExclusionList.includes(apiCode);
  };
  const setIABExclusionSelected = (code, selected) => {
    const apiCode = iabCodeToApi(code);
    setPlacementData((prev) => {
      if (!prev) return prev;
      const list = Array.isArray(prev.SspConfig?.CategoriesExclusion)
        ? prev.SspConfig.CategoriesExclusion
        : [];
      const already = list.includes(code) || list.includes(apiCode);
      if (selected) {
        if (already) return prev;
        const next = [...list.filter((c) => c !== code && c !== apiCode), apiCode];
        return {
          ...prev,
          SspConfig: { ...prev.SspConfig, CategoriesExclusion: next },
        };
      }
      if (!already) return prev;
      const isMainCategory = /^IAB\d+$/.test(code) || /^IAB\d+$/.test(apiCode);
      const mainCode = apiCode.replace(/-/g, '_');
      const next = list.filter((c) => {
        if (c === code || c === apiCode) return false;
        if (isMainCategory && (c.startsWith(mainCode + '_') || c.startsWith(mainCode + '-'))) return false;
        return true;
      });
      return {
        ...prev,
        SspConfig: { ...prev.SspConfig, CategoriesExclusion: next },
      };
    });
  };
  const isIABExclusionSelectedInInitial = (code) => {
    const list = initialIabExclusionListRef.current;
    if (!list || !code) return false;
    const apiCode = iabCodeToApi(code);
    return list.includes(code) || list.includes(apiCode);
  };
  const iabExclusionTaxonomySorted = IAB_TAXONOMY.map((cat, i) => ({
    cat,
    i,
    hasSelection: getIABCodesForCategory(cat).some((c) => isIABExclusionSelectedInInitial(c)),
  }))
    .sort((a, b) => {
      if (a.hasSelection && !b.hasSelection) return -1;
      if (!a.hasSelection && b.hasSelection) return 1;
      return a.i - b.i;
    })
    .map((x) => x.cat);

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto p-6 lg:p-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-slate-600 mx-auto mb-4" />
              <p className="text-slate-600 font-medium">Loading placement data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto p-6 lg:p-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Alert variant="destructive" className="mb-4 border-red-200 bg-red-50">
                <AlertCircle className="h-5 w-5" />
                <AlertDescription className="text-red-800 font-medium">
                  Error: {error}
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!placementData) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto p-6 lg:p-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <p className="text-slate-600 mb-4">No placement data found</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <EntityEditorLayout
      sections={sections}
      selectedSection={selectedSection}
      onSectionSelect={setSelectedSection}
      sectionCardTitle="Placement"
      sidebarFooter={(
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-4 space-y-2">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className={cn(TAILWIND_CLASSES.editPrimaryButton)}
                >
                  {saving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate('/Placement')}
                  className={cn(TAILWIND_CLASSES.editCancelButton)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </CardContent>
            </Card>
      )}
      header={(
        <div className="mb-6">
          <div className="bg-gradient-to-r from-white via-[rgb(244,246,255)] to-white border border-[rgb(220,227,255)] shadow-sm rounded-2xl p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={cn('w-14 h-14 rounded-xl flex items-center justify-center', TAILWIND_CLASSES.editIconBox)}>
                  <Target className="w-7 h-7" />
          </div>
                <div className="space-y-1">
                  <h1 className="text-2xl font-semibold text-slate-900 leading-tight" title={displayPlacementName}>{truncatedPlacementName}</h1>
                  <p className="text-sm text-slate-500">Edit placement configuration</p>
              </div>
        </div>
              <div className="flex flex-wrap items-center gap-3">
                {placementData?.SspConfig && (
                  <button
                    type="button"
                    onClick={() => {
                      const isCurrentlyOn = !placementData.SspConfig.Disabled;
                      setPlacementData({
                        ...placementData,
                        Access: isCurrentlyOn ? 'DISABLED' : 'ALL',
                        SspConfig: { ...placementData.SspConfig, Disabled: isCurrentlyOn }
                      });
                    }}
                    title="Click to toggle status"
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border cursor-pointer transition-all hover:opacity-80 select-none',
                      placementData.SspConfig.Disabled
                        ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                        : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'
                    )}
                  >
                    <span className={cn(
                      'w-2 h-2 rounded-full',
                      placementData.SspConfig.Disabled ? 'bg-red-400' : 'bg-green-400'
                    )} />
                    {placementData.SspConfig.Disabled ? 'OFF' : 'ON'}
                  </button>
                )}
                {placementData?.DistributionChannelKind && (
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium bg-[rgb(59,76,164)]/10 text-[rgb(59,76,164)] border border-[rgb(59,76,164)]/20">
                    Channel: {placementData.DistributionChannelKind}
                  </span>
                )}
                {placementData?.Sources && placementData.Sources.length > 0 && (
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    Sources: {placementData.Sources.join(', ')}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
              <div className="space-y-1">
                <p className="font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Placement UID</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-700 text-xs md:text-sm break-all">{placementData?.Uid || placementId}</span>
                  {placementData?.Uid && (
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={handleCopyPlacementId}>
                      <ClipboardCopy className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              {placementData?.Company && (
                <div className="space-y-1">
                  <p className="font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Company</p>
                  <p className="font-medium text-slate-700">{typeof placementData.Company === 'string' ? placementData.Company : placementData.Company.Name || placementData.Company.Uid || 'N/A'}</p>
                </div>
              )}
              {placementData?.Site && (
                <div className="space-y-1">
                  <p className="font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Site</p>
                  <p className="font-medium text-slate-700">{typeof placementData.Site === 'string' ? placementData.Site : placementData.Site.Name || placementData.Site.Uid || 'N/A'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      alerts={[
        error && (
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertCircle className="h-5 w-5" />
                <AlertDescription className="text-red-800 font-medium">
                  {error}
              </AlertDescription>
            </Alert>
        ),
      ]}
    >
            {/* Basic Info Section */}
            {selectedSection === 'basic' && (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
                  <CardTitle className="flex items-center gap-2 text-white text-base">
                    <Building2 className="w-5 h-5" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Placement Name</Label>
                      <Input
                        id="name"
                        value={placementData.Name || ''}
                        onChange={(e) => setPlacementData({...placementData, Name: e.target.value})}
                        placeholder="Enter placement name"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="uid">Placement UID</Label>
                      <Input
                        id="uid"
                        value={placementData.Uid || ''}
                        disabled
                        className="bg-slate-50"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Company Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Company Name</Label>
                        <Input
                          value={placementData.Company?.Name || ''}
                          disabled
                          className="bg-slate-50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Company UID</Label>
                        <Input
                          value={placementData.Company?.Uid || ''}
                          disabled
                          className="bg-slate-50"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Site Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Site Name</Label>
                        <Input
                          value={placementData.Site?.Name || ''}
                          disabled
                          className="bg-slate-50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Site UID</Label>
                      <Input
                          value={placementData.Site?.Uid || ''}
                          disabled
                          className="bg-slate-50"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Manager Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>First Name</Label>
                        <Input
                          value={placementData.Manager?.FirstName || ''}
                          disabled
                          className="bg-slate-50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Last Name</Label>
                        <Input
                          value={placementData.Manager?.LastName || ''}
                          disabled
                          className="bg-slate-50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Title</Label>
                      <Input
                          value={placementData.Manager?.Title || ''}
                          disabled
                          className="bg-slate-50"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Placement Configuration</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex flex-wrap gap-2">
                          {['SITE', 'APP'].map((ch) => {
                            const current = placementData.DistributionChannelKind || 'SITE';
                            return (
                              <button
                                key={ch}
                                type="button"
                                className={toggleChipClassName(current === ch)}
                                onClick={() =>
                                  setPlacementData({ ...placementData, DistributionChannelKind: ch })
                                }
                              >
                                {ch}
                              </button>
                            );
                          })}
                        </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Sources</h3>
                    <div className="flex flex-wrap gap-2">
                        {['SSP', 'ADSERVER'].map((source) => {
                          const isChecked = placementData.Sources?.includes(source) || false;
                          const label = source === 'SSP' ? 'Programmatic' : 'Direct';
                          return (
                            <button
                              key={source}
                              type="button"
                              className={toggleChipClassName(isChecked)}
                              onClick={() => {
                                const currentSources = placementData.Sources || [];
                                const newSources = isChecked
                                  ? currentSources.filter((s) => s !== source)
                                  : [...currentSources, source];
                                setPlacementData({ ...placementData, Sources: newSources });
                              }}
                            >
                              {label}
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Broker Mapping</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="externalId">TAG ID</Label>
                        <Input
                          id="externalId"
                          value={placementData.ExternalId || ''}
                          onChange={(e) => setPlacementData({...placementData, ExternalId: e.target.value})}
                          placeholder="Enter TAG ID"
                          className="bg-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="externalPartner">Broker ID</Label>
                        <Popover open={brokerSearchOpen} onOpenChange={setBrokerSearchOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={brokerSearchOpen}
                              className="w-full justify-between bg-white"
                            >
                              {placementData.ExternalPartner || "Select broker ID..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <Command shouldFilter={false}>
                              <CommandInput 
                                placeholder="Search brokers..." 
                                value={brokerSearchTerm}
                                onValueChange={setBrokerSearchTerm}
                              />
                              <CommandList>
                                {brokers.length === 0 ? (
                                  <CommandEmpty>No brokers found.</CommandEmpty>
                                ) : (
                                  <CommandGroup>
                                    {brokers.map((broker) => (
                                      <CommandItem
                                        key={broker.uid}
                                        value={`${broker.name} ${broker.uid}`}
                                        onSelect={() => {
                                          setPlacementData({...placementData, ExternalPartner: broker.uid});
                                          setBrokerSearchOpen(false);
                                          setBrokerSearchTerm('');
                                        }}
                                      >
                                        <Check
                                          className={`mr-2 h-4 w-4 ${
                                            placementData.ExternalPartner === broker.uid ? "opacity-100" : "opacity-0"
                                          }`}
                                        />
                                        <div className="flex flex-col">
                                          <span>{broker.name}</span>
                                          <span className="text-xs text-slate-500">{broker.uid}</span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                )}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        {placementData.ExternalPartner && (
                          <p className="text-xs text-slate-500 mt-1">
                            Selected: {placementData.ExternalPartner}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                </CardContent>
              </Card>
            )}

            {/* SSP Configuration Section */}
            {selectedSection === 'ssp' && (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
                  <CardTitle className="flex items-center gap-2 text-white text-base">
                    <Settings className="w-5 h-5" />
                    SSP Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">

                  <div className="space-y-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="headerBidding">Header Bidding</Label>
                          <p className="text-sm text-slate-600">Enable header bidding for this placement</p>
                        </div>
                        <ToggleSwitch
                          id="headerBidding"
                          checked={placementData.HeaderBidding || false}
                          onCheckedChange={(checked) => setPlacementData({
                            ...placementData,
                            HeaderBidding: checked
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="disableOpenAuction">Open Auction</Label>
                          <p className="text-sm text-slate-600">Enable open auction functionality</p>
                        </div>
                        <ToggleSwitch
                          id="disableOpenAuction"
                          checked={!placementData.SspConfig?.DisableOpenAuction}
                          onCheckedChange={(checked) => setPlacementData({
                            ...placementData,
                            SspConfig: {
                              ...placementData.SspConfig,
                              DisableOpenAuction: !checked
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                    <div>
                          <Label htmlFor="disablePartnerSelection">Partner Selection</Label>
                          <p className="text-sm text-slate-600">Enable partner selection functionality</p>
                        </div>
                        <ToggleSwitch
                          id="disablePartnerSelection"
                          checked={!placementData.SspConfig?.DisablePartnerSelection}
                          onCheckedChange={(checked) => setPlacementData({
                            ...placementData,
                            SspConfig: {
                              ...placementData.SspConfig,
                              DisablePartnerSelection: !checked
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="allowStoryDisplay">Allow Story Display</Label>
                          <p className="text-sm text-slate-600">Enable story display functionality</p>
                        </div>
                        <ToggleSwitch
                          id="allowStoryDisplay"
                          checked={placementData.AllowStoryDisplay || false}
                          onCheckedChange={(checked) => setPlacementData({
                            ...placementData,
                            AllowStoryDisplay: checked
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="resizeIframe">Resize Iframe</Label>
                          <p className="text-sm text-slate-600">Allow iframe resizing</p>
                        </div>
                        <ToggleSwitch
                          id="resizeIframe"
                          checked={placementData.ResizeIframe || false}
                          onCheckedChange={(checked) => setPlacementData({
                            ...placementData,
                            ResizeIframe: checked
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="serveVPAID">Serve VPAID</Label>
                          <p className="text-sm text-slate-600">Enable VPAID ad serving</p>
                        </div>
                        <ToggleSwitch
                          id="serveVPAID"
                          checked={placementData.ServeVPAID || false}
                          onCheckedChange={(checked) => setPlacementData({
                            ...placementData,
                            ServeVPAID: checked
                          })}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Advanced Settings</h3>
                    <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="disableDynamicMargin">Dynamic Margin</Label>
                        </div>
                        <ToggleSwitch
                          checked={!placementData.SspConfig?.DisableDynamicMargin}
                          onCheckedChange={(checked) => setPlacementData({
                            ...placementData,
                            SspConfig: {
                              ...placementData.SspConfig,
                              DisableDynamicMargin: !checked
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="disableIntentIq">Intent IQ</Label>
                        </div>
                        <ToggleSwitch
                          checked={!placementData.SspConfig?.DisableIntentIq}
                          onCheckedChange={(checked) => setPlacementData({
                            ...placementData,
                            SspConfig: {
                              ...placementData.SspConfig,
                              DisableIntentIq: !checked
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="enableEncodedTracking">Encoded Tracking</Label>
                        </div>
                        <ToggleSwitch
                          checked={placementData.SspConfig?.EnableEncodedTracking || false}
                          onCheckedChange={(checked) => setPlacementData({
                            ...placementData,
                            SspConfig: {
                              ...placementData.SspConfig,
                              EnableEncodedTracking: checked
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="enableEnrichTrackingMetrics">Enrich Tracking Metrics</Label>
                        </div>
                        <ToggleSwitch
                          checked={placementData.SspConfig?.EnableEnrichTrackingMetrics || false}
                          onCheckedChange={(checked) => setPlacementData({
                            ...placementData,
                            SspConfig: {
                              ...placementData.SspConfig,
                              EnableEnrichTrackingMetrics: checked
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="isLegacyNativeTracking">Legacy Native Tracking</Label>
                        </div>
                        <ToggleSwitch
                          checked={placementData.SspConfig?.IsLegacyNativeTracking || false}
                          onCheckedChange={(checked) => setPlacementData({
                            ...placementData,
                            SspConfig: {
                              ...placementData.SspConfig,
                              IsLegacyNativeTracking: checked
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="openWebManaged">OpenWeb Managed</Label>
                        </div>
                        <ToggleSwitch
                          checked={placementData.SspConfig?.OpenWebManaged || false}
                          onCheckedChange={(checked) => setPlacementData({
                            ...placementData,
                            SspConfig: {
                              ...placementData.SspConfig,
                              OpenWebManaged: checked
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="disabled">Status</Label>
                        </div>
                        <ToggleSwitch
                          checked={!placementData.SspConfig?.Disabled}
                          onCheckedChange={(checked) => setPlacementData({
                            ...placementData,
                            SspConfig: {
                              ...placementData.SspConfig,
                              Disabled: !checked
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="disabledOnFraudulent">Disabled on Fraudulent</Label>
                        </div>
                        <ToggleSwitch
                          checked={!placementData.SspConfig?.DisabledOnFraudulent}
                          onCheckedChange={(checked) => setPlacementData({
                            ...placementData,
                            SspConfig: {
                              ...placementData.SspConfig,
                              DisabledOnFraudulent: !checked
                            }
                          })}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Ad Transformation Prevention</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="preventNative2Banner">Native ads in Banner slots</Label>
                          <p className="text-sm text-slate-600">Allows Native ads to be transformed and served in Banner placements</p>
                        </div>
                        <ToggleSwitch
                          id="preventNative2Banner"
                          checked={!placementData.SspConfig?.PreventAdTransform?.Native2Banner}
                          onCheckedChange={(checked) => setPlacementData({
                            ...placementData,
                            SspConfig: {
                              ...placementData.SspConfig,
                              PreventAdTransform: {
                                ...placementData.SspConfig?.PreventAdTransform,
                                Native2Banner: !checked
                              }
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="preventVideo2Banner">Video ads in Banner slots</Label>
                          <p className="text-sm text-slate-600">Allows Video ads to be transformed and served in Banner placements</p>
                        </div>
                        <ToggleSwitch
                          id="preventVideo2Banner"
                          checked={!placementData.SspConfig?.PreventAdTransform?.Video2Banner}
                          onCheckedChange={(checked) => setPlacementData({
                            ...placementData,
                            SspConfig: {
                              ...placementData.SspConfig,
                              PreventAdTransform: {
                                ...placementData.SspConfig?.PreventAdTransform,
                                Video2Banner: !checked
                              }
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                    <div>
                          <Label htmlFor="preventVideo2Native">Video ads in Native slots</Label>
                          <p className="text-sm text-slate-600">Allows Video ads to be transformed and served in Native placements</p>
                        </div>
                        <ToggleSwitch
                          id="preventVideo2Native"
                          checked={!placementData.SspConfig?.PreventAdTransform?.Video2Native}
                          onCheckedChange={(checked) => setPlacementData({
                            ...placementData,
                            SspConfig: {
                              ...placementData.SspConfig,
                              PreventAdTransform: {
                                ...placementData.SspConfig?.PreventAdTransform,
                                Video2Native: !checked
                              }
                            }
                          })}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Revenue Section */}
            {selectedSection === 'revenue' && (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
                  <CardTitle className="flex items-center gap-2 text-white text-base">
                    <DollarSign className="w-5 h-5" />
                    Revenue Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Margin Strategy</h3>
                    <div className="space-y-4">
                          <div className="space-y-2">
                        <Label htmlFor="marginStrategy">Strategy</Label>
                            <Select
                          value={placementData.SspConfig?.MarginStrategy?.Strategy || 'SHARE'}
                              onValueChange={(value) => setPlacementData({
                                ...placementData,
                                SspConfig: {
                                  ...placementData.SspConfig,
                              MarginStrategy: {
                                ...placementData.SspConfig?.MarginStrategy,
                                Strategy: value
                                  }
                                }
                              })}
                            >
                              <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Select margin strategy" />
                              </SelectTrigger>
                              <SelectContent>
                            <SelectItem value="SHARE">Shared</SelectItem>
                            <SelectItem value="FIXED">Fixed</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                      
                          <div className="space-y-2">
                        <Label htmlFor="marginValue">
                          {placementData.SspConfig?.MarginStrategy?.Strategy === 'SHARE' ? "Publisher's share (%)" : "Adyoulike's margin (%)"}
                        </Label>
                            <div className="flex items-center gap-3">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => {
                              const currentValue = placementData.SspConfig?.MarginStrategy?.Margin || 0;
                                  const newValue = Math.max(0, currentValue - 0.01);
                                  setPlacementData({
                                    ...placementData,
                                    SspConfig: {
                                      ...placementData.SspConfig,
                                  MarginStrategy: {
                                    ...placementData.SspConfig?.MarginStrategy,
                                    Margin: newValue
                                      }
                                    }
                                  });
                                }}
                              >
                                <span className="text-sm">-</span>
                              </Button>
                              <Slider
                            value={[(placementData.SspConfig?.MarginStrategy?.Margin || 0) * 100]}
                                onValueChange={(value) => setPlacementData({
                                  ...placementData,
                                  SspConfig: {
                                    ...placementData.SspConfig,
                                MarginStrategy: {
                                  ...placementData.SspConfig?.MarginStrategy,
                                  Margin: value[0] / 100
                                    }
                                  }
                                })}
                                max={100}
                                min={0}
                                step={1}
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => {
                              const currentValue = placementData.SspConfig?.MarginStrategy?.Margin || 0;
                                  const newValue = Math.min(1, currentValue + 0.01);
                                  setPlacementData({
                                    ...placementData,
                                    SspConfig: {
                                      ...placementData.SspConfig,
                                  MarginStrategy: {
                                    ...placementData.SspConfig?.MarginStrategy,
                                    Margin: newValue
                                      }
                                    }
                                  });
                                }}
                              >
                                <span className="text-sm">+</span>
                              </Button>
                              <div className="bg-white border border-slate-300 rounded px-3 py-1.5 min-w-[60px] text-center font-semibold text-slate-900">
                            {((placementData.SspConfig?.MarginStrategy?.Margin || 0) * 100).toFixed(0)}%
                              </div>
                            </div>
                          </div>

                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <p className="text-sm text-slate-700">
                          {placementData.SspConfig?.MarginStrategy?.Strategy === 'SHARE' ? (
                            <>
                              <strong>Shared (Revenue Split)</strong><br /><br />
                              Revenue is split between the Publisher and Adyoulike.<br />
                              The buyer's price stays the same — the margin comes from the existing revenue.<br /><br />
                              <strong>Example (20%)</strong><br />
                              Floor: $1.00 → Publisher gets $0.20, Adyoulike gets $0.80
                            </>
                          ) : (
                            <>
                              <strong>Fixed (Margin Added)</strong><br /><br />
                              Adyoulike's margin is added on top of the floor price.<br />
                              The Publisher always gets the full floor, and the buyer pays a bit more.<br /><br />
                              <strong>Example (20%)</strong><br />
                              Floor: $1.00 → Buyer pays $1.20 → Publisher gets $1.00, Adyoulike gets $0.20
                            </>
                      )}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Integration Section */}
            {selectedSection === 'integration' && (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
                  <CardTitle className="flex items-center gap-2 text-white text-base">
                    <Palette className="w-5 h-5" />
                    Integration Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Integration Type</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="integrationKind">Integration Kind</Label>
                        <Select
                          value={placementData.Integration?.Kind || 'WIDGET'}
                          onValueChange={(value) => setPlacementData({
                            ...placementData,
                            Integration: {
                              ...placementData.Integration,
                              Kind: value
                            }
                          })}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Select integration kind" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="WIDGET">Widget</SelectItem>
                            <SelectItem value="TEMPLATE">Template</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="nativeType">Native Type</Label>
                        <Select
                          value={placementData.Integration?.NativeType || 'IN_FEED_CONTENT'}
                          onValueChange={(value) => setPlacementData({
                            ...placementData,
                            Integration: {
                              ...placementData.Integration,
                              NativeType: value
                            }
                          })}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Select native type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="IN_FEED_CONTENT">In Feed Content</SelectItem>
                            <SelectItem value="RECOMMENDATION_WIDGET">Recommendation Widget</SelectItem>
                            <SelectItem value="IN_ARTICLE">In Article</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="videoType">Video Type</Label>
                        <Select
                          value={placementData.Integration?.VideoType || 'OUTSTREAM_IN_ARTICLE'}
                          onValueChange={(value) => setPlacementData({
                            ...placementData,
                            Integration: {
                              ...placementData.Integration,
                              VideoType: value
                            }
                          })}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Select video type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="OUTSTREAM_IN_ARTICLE">Outstream In Article</SelectItem>
                            <SelectItem value="INSTREAM">Instream</SelectItem>
                            <SelectItem value="PREROLL">Preroll</SelectItem>
                            <SelectItem value="POSTROLL">Postroll</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="trigger">Trigger</Label>
                        <Select
                          value={placementData.Integration?.Trigger || 'LOAD'}
                          onValueChange={(value) => setPlacementData({
                            ...placementData,
                            Integration: {
                              ...placementData.Integration,
                              Trigger: value
                            }
                          })}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Select trigger" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="LOAD">Load</SelectItem>
                            <SelectItem value="SCROLL">Scroll</SelectItem>
                            <SelectItem value="CLICK">Click</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Video Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="videoStartDelay">Video Start Delay (ms)</Label>
                        <Input
                          id="videoStartDelay"
                          type="number"
                          value={placementData.Integration?.VideoStartDelay || 0}
                          onChange={(e) => setPlacementData({
                            ...placementData,
                            Integration: {
                              ...placementData.Integration,
                              VideoStartDelay: parseInt(e.target.value) || 0
                            }
                          })}
                          className="bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Banner Integration</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Banner Sizes</Label>
                        <p className="text-sm text-slate-600">Select the banner sizes available for this placement</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                          {Object.entries(BANNER_SIZES).map(([category, sizes]) => (
                            <div key={category} className="space-y-3">
                              <h4 className={cn(TAILWIND_CLASSES.formSectionLabel, 'border-b border-slate-200 pb-2')}>
                                {category}
                              </h4>
                              <div className="space-y-2">
                                {sizes.map((size, index) => {
                                  const isSelected = placementData.BannerIntegration?.Sizes?.some(
                                    s => s.Width === size.Width && s.Height === size.Height
                                  ) || false;
                                  
                                  const sizeId = `${category}-${size.Width}-${size.Height}-${index}`;
                                  
                                  return (
                                    <div key={sizeId} className="flex items-center space-x-2 p-2 rounded hover:bg-slate-50">
                                      <Checkbox
                                        id={sizeId}
                                        checked={isSelected}
                                        onCheckedChange={(checked) => {
                                          const currentSizes = placementData.BannerIntegration?.Sizes || [];
                                          let newSizes;
                                          
                                          if (checked) {
                                            // Add the size if it's not already present
                                            if (!currentSizes.some(s => s.Width === size.Width && s.Height === size.Height)) {
                                              newSizes = [...currentSizes, { Width: size.Width, Height: size.Height }];
                                            } else {
                                              newSizes = currentSizes;
                                            }
                                          } else {
                                            // Remove the size
                                            newSizes = currentSizes.filter(
                                              s => !(s.Width === size.Width && s.Height === size.Height)
                                            );
                                          }
                                          
                                          setPlacementData({
                                            ...placementData,
                                            BannerIntegration: {
                                              ...placementData.BannerIntegration,
                                              Sizes: newSizes
                                            }
                                          });
                                        }}
                                        className="h-5 w-5 border-2 border-slate-300 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                                      />
                                      <Label 
                                        htmlFor={sizeId} 
                                        className="text-sm font-medium cursor-pointer flex-1"
                                      >
                                        <div className="flex flex-col">
                                          <span className="font-semibold">{size.Width}×{size.Height}</span>
                                          <span className="text-xs text-slate-500">{size.name}</span>
                                        </div>
                                      </Label>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                        {placementData.BannerIntegration?.Sizes && placementData.BannerIntegration.Sizes.length > 0 && (
                          <p className="text-sm text-slate-600 mt-4">
                            {placementData.BannerIntegration.Sizes.length} size(s) selected
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Config Actions</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="legalAction">Legal Action</Label>
                        <Select
                          value={placementData.Config?.Actions?.Legal || 'Sponsored'}
                          onValueChange={(value) => setPlacementData({
                            ...placementData,
                            Config: {
                              ...placementData.Config,
                              Actions: {
                                ...placementData.Config?.Actions,
                                Legal: value
                              }
                            }
                          })}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Select legal action" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Sponsored">Sponsored</SelectItem>
                            <SelectItem value="Advertisement">Advertisement</SelectItem>
                            <SelectItem value="Ad">Ad</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="performUITriggers">Perform UI Triggers</Label>
                        <Select
                          value={placementData.Config?.Actions?.PerformUITriggers || 'CLICK_MOUSE_OVER_SCROLL'}
                          onValueChange={(value) => setPlacementData({
                            ...placementData,
                            Config: {
                              ...placementData.Config,
                              Actions: {
                                ...placementData.Config?.Actions,
                                PerformUITriggers: value
                              }
                            }
                          })}
                        >
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Select UI triggers" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CLICK_MOUSE_OVER_SCROLL">Click, Mouse Over, Scroll</SelectItem>
                            <SelectItem value="CLICK">Click</SelectItem>
                            <SelectItem value="SCROLL">Scroll</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Targeting Section */}
            {selectedSection === 'targeting' && (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
                  <CardTitle className="flex items-center gap-2 text-white text-base">
                    <Target className="w-5 h-5" />
                    Targeting
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Enabled Devices</h3>
                    <div className="flex flex-wrap gap-2">
                      {['DESKTOP', 'MOBILE', 'TABLET', 'TV'].map((device) => {
                        const isEnabled = placementData.EnabledDevices?.includes(device) || false;
                        return (
                          <button
                            key={device}
                            type="button"
                            className={toggleChipClassName(isEnabled, 'flex items-center')}
                            onClick={() => {
                              const currentDevices = placementData.EnabledDevices || [];
                              let newDevices;
                              
                              if (isEnabled) {
                                newDevices = currentDevices.filter(d => d !== device);
                              } else {
                                newDevices = [...currentDevices, device];
                              }
                              
                              setPlacementData({
                                ...placementData,
                                EnabledDevices: newDevices
                              });
                            }}
                          >
                          <div className="flex items-center gap-1">
                            {getDeviceIcon(device)}
                            {device}
                          </div>
                        </button>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 className="text-xl font-semibold text-slate-900 border-b border-slate-200 pb-2">Allowed Seats</h2>
                    <p className="text-sm text-slate-500">Allowed IAB categories are configured on the Site (Edit Site). Seat allowlist for this placement:</p>
                    <div className="space-y-4">
                      <p className="text-sm text-slate-500">Seat ID(s) to allow:</p>
                      <div className="flex flex-wrap gap-2">
                        {(placementData.SspConfig?.AllowedSeats || []).map((item, idx) => (
                          <span key={`${item}-${idx}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-900 text-sm font-mono border border-emerald-200">
                            {item}
                            <button
                              type="button"
                              onClick={() => setPlacementData({
                                ...placementData,
                                SspConfig: {
                                  ...placementData.SspConfig,
                                  AllowedSeats: (placementData.SspConfig?.AllowedSeats || []).filter((_, i) => i !== idx),
                                },
                              })}
                              className="p-0.5 rounded hover:bg-emerald-100 text-emerald-700"
                              aria-label="Remove"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g. t1233"
                          className="max-w-xs font-mono"
                          value={newAllowedSeat}
                          onChange={(e) => setNewAllowedSeat(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            const v = newAllowedSeat.trim();
                            if (!v) return;
                            const list = placementData.SspConfig?.AllowedSeats || [];
                            if (list.includes(v)) return;
                            setPlacementData({
                              ...placementData,
                              SspConfig: {
                                ...placementData.SspConfig,
                                AllowedSeats: [...list, v],
                              },
                            });
                            setNewAllowedSeat('');
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const v = newAllowedSeat.trim();
                            if (!v) return;
                            const list = placementData.SspConfig?.AllowedSeats || [];
                            if (list.includes(v)) return;
                            setPlacementData({
                              ...placementData,
                              SspConfig: {
                                ...placementData.SspConfig,
                                AllowedSeats: [...list, v],
                              },
                            });
                            setNewAllowedSeat('');
                          }}
                        >
                          <Plus className="w-4 h-4" /> Add
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 rounded-lg border border-slate-200 bg-slate-50/50 p-4 shadow-sm">
                    <h2 className="text-xl font-semibold text-slate-900 border-b border-slate-200 pb-2">Exclusions</h2>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-slate-900">Advertisers Exclusion</h3>
                      <p className="text-sm text-slate-500">Domain(s) to exclude:</p>
                      <div className="flex flex-wrap gap-2">
                        {(placementData.SspConfig?.AdvertisersExclusion || []).map((item, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 text-red-800 text-sm font-mono border border-red-100">
                            {item}
                            <button
                              type="button"
                              onClick={() => setPlacementData({
                                ...placementData,
                                SspConfig: {
                                  ...placementData.SspConfig,
                                  AdvertisersExclusion: (placementData.SspConfig?.AdvertisersExclusion || []).filter((_, i) => i !== idx),
                                },
                              })}
                              className="p-0.5 rounded hover:bg-red-100 text-red-600"
                              aria-label="Remove"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g. test.com"
                          className="max-w-xs font-mono"
                          value={newAdvertiserExclusion}
                          onChange={(e) => setNewAdvertiserExclusion(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            const v = newAdvertiserExclusion.trim();
                            if (!v) return;
                            setPlacementData({
                              ...placementData,
                              SspConfig: {
                                ...placementData.SspConfig,
                                AdvertisersExclusion: [...(placementData.SspConfig?.AdvertisersExclusion || []), v],
                              },
                            });
                            setNewAdvertiserExclusion('');
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const v = newAdvertiserExclusion.trim();
                            if (!v) return;
                            setPlacementData({
                              ...placementData,
                              SspConfig: {
                                ...placementData.SspConfig,
                                AdvertisersExclusion: [...(placementData.SspConfig?.AdvertisersExclusion || []), v],
                              },
                            });
                            setNewAdvertiserExclusion('');
                          }}
                        >
                          <Plus className="w-4 h-4" /> Add
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-slate-900">Categories Exclusion (IAB)</h3>
                      <p className="text-sm text-slate-500">Select main categories and/or subcategories to exclude.</p>
                      <div className="space-y-1 border border-red-200 rounded-lg divide-y divide-red-100 max-h-[420px] overflow-y-auto bg-red-50/50">
                        {iabExclusionTaxonomySorted.map((cat) => {
                          const codes = getIABCodesForCategory(cat);
                          const mainCode = cat.code;
                          const selectedInCat = codes.filter((c) => isIABExclusionSelected(c));
                          const selectedCount = selectedInCat.length;
                          const isOpenEx = openIABExclusionId === cat.code;
                          return (
                            <Collapsible key={`placement-excl-${cat.code}`} open={isOpenEx} onOpenChange={(open) => setOpenIABExclusionId(open ? cat.code : null)}>
                              <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-red-100/80 text-sm font-medium text-red-900">
                                <ChevronRight className={cn('w-4 h-4 shrink-0 transition-transform', isOpenEx && 'rotate-90')} />
                                <span className="flex-1">{cat.name}</span>
                                {selectedCount > 0 && (
                                  <Badge variant="secondary" className="text-xs bg-red-200 text-red-900 hover:bg-red-300">
                                    {selectedCount}
                                  </Badge>
                                )}
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="pl-6 pr-4 pb-3 pt-1 space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      id={`placement-iab-excl-${mainCode}`}
                                      checked={isIABExclusionSelected(mainCode)}
                                      onCheckedChange={(checked) => {
                                        if (checked === 'indeterminate') return;
                                        setIABExclusionSelected(mainCode, checked === true);
                                      }}
                                      className="data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                                    />
                                    <Label htmlFor={`placement-iab-excl-${mainCode}`} className="cursor-pointer text-red-900">
                                      {cat.name}{' '}
                                      <span className="text-xs text-red-600">(IAB {mainCode.replace(/^IAB/, '')})</span>
                                    </Label>
                                  </div>
                                  {cat.children?.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5">
                                      {cat.children.map((child) => (
                                        <div key={child.code} className="flex items-center gap-2">
                                          <Checkbox
                                            id={`placement-iab-excl-${child.code}`}
                                            checked={isIABExclusionSelected(child.code)}
                                            onCheckedChange={(checked) => {
                                              if (checked === 'indeterminate') return;
                                              setIABExclusionSelected(child.code, checked === true);
                                            }}
                                            className="data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                                          />
                                          <Label htmlFor={`placement-iab-excl-${child.code}`} className="cursor-pointer truncate text-red-900" title={child.code}>
                                            {child.name}{' '}
                                            <span className="text-xs text-red-600">({child.code.replace(/^IAB/, 'IAB ')})</span>
                                          </Label>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-slate-900">Partners Exclusion</h3>
                      <p className="text-sm text-slate-500">Search by partner name or paste UID. Excluded partners are shown by name.</p>
                      <div className="flex flex-wrap gap-2">
                        {(placementData.SspConfig?.PartnersExclusion || []).map((item, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 text-red-800 text-sm border border-red-100"
                            title={item}
                          >
                            {partnerNameMap[item] || item}
                            <button
                              type="button"
                              onClick={() => setPlacementData({
                                ...placementData,
                                SspConfig: {
                                  ...placementData.SspConfig,
                                  PartnersExclusion: (placementData.SspConfig?.PartnersExclusion || []).filter((_, i) => i !== idx),
                                },
                              })}
                              className="p-0.5 rounded hover:bg-red-100 text-red-600"
                              aria-label="Remove"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="relative flex gap-2 max-w-md">
                        <Input
                          placeholder="Search partner by name or paste UID..."
                          className="font-mono"
                          value={newPartnerExclusion}
                          onChange={(e) => {
                            setNewPartnerExclusion(e.target.value);
                            setPartnerSearchOpen(true);
                          }}
                          onFocus={() => setPartnerSearchOpen(true)}
                          onBlur={() => setTimeout(() => setPartnerSearchOpen(false), 200)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const v = newPartnerExclusion.trim();
                              if (!v) return;
                              const isUid = /^[a-f0-9]{32}$/i.test(v);
                              if (isUid) {
                                const list = placementData.SspConfig?.PartnersExclusion || [];
                                if (list.includes(v)) return;
                                setPlacementData({
                                  ...placementData,
                                  SspConfig: { ...placementData.SspConfig, PartnersExclusion: [...list, v] },
                                });
                                setNewPartnerExclusion('');
                                setPartnerSearchOpen(false);
                              } else if (partnerSearchResults.length > 0) {
                                const uid = partnerSearchResults[0].uid;
                                const list = placementData.SspConfig?.PartnersExclusion || [];
                                if (list.includes(uid)) return;
                                setPlacementData({
                                  ...placementData,
                                  SspConfig: { ...placementData.SspConfig, PartnersExclusion: [...list, uid] },
                                });
                                setNewPartnerExclusion('');
                                setPartnerSearchOpen(false);
                              }
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const v = newPartnerExclusion.trim();
                            if (!v) return;
                            const isUid = /^[a-f0-9]{32}$/i.test(v);
                            if (isUid) {
                              const list = placementData.SspConfig?.PartnersExclusion || [];
                              if (!list.includes(v)) {
                                setPlacementData({
                                  ...placementData,
                                  SspConfig: { ...placementData.SspConfig, PartnersExclusion: [...list, v] },
                                });
                              }
                              setNewPartnerExclusion('');
                            } else if (partnerSearchResults.length > 0) {
                              const uid = partnerSearchResults[0].uid;
                              const list = placementData.SspConfig?.PartnersExclusion || [];
                              if (!list.includes(uid)) {
                                setPlacementData({
                                  ...placementData,
                                  SspConfig: { ...placementData.SspConfig, PartnersExclusion: [...list, uid] },
                                });
                              }
                              setNewPartnerExclusion('');
                            }
                            setPartnerSearchOpen(false);
                          }}
                        >
                          <Plus className="w-4 h-4" /> Add
                        </Button>
                        {partnerSearchOpen && partnerSearchResults.length > 0 && (
                          <ul className="absolute z-10 top-full left-0 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg py-1 text-sm">
                            {partnerSearchResults.map((p) => {
                              const alreadyExcluded = (placementData.SspConfig?.PartnersExclusion || []).includes(p.uid);
                              return (
                                <li key={p.uid}>
                                  <button
                                    type="button"
                                    disabled={alreadyExcluded}
                                    className={cn(
                                      'w-full px-3 py-2 text-left hover:bg-slate-100 flex justify-between',
                                      alreadyExcluded && 'opacity-50 cursor-not-allowed',
                                    )}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      if (alreadyExcluded) return;
                                      const list = placementData.SspConfig?.PartnersExclusion || [];
                                      setPlacementData({
                                        ...placementData,
                                        SspConfig: { ...placementData.SspConfig, PartnersExclusion: [...list, p.uid] },
                                      });
                                      setNewPartnerExclusion('');
                                      setPartnerSearchOpen(false);
                                    }}
                                  >
                                    <span>{p.name}</span>
                                    <span className="text-slate-400 font-mono text-xs truncate max-w-[120px]" title={p.uid}>{p.uid}</span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </div>

                    <Separator className="bg-slate-200" />

                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-slate-900">Blocked Seats</h3>
                      <p className="text-sm text-slate-500">Seat ID(s) to block:</p>
                      <div className="flex flex-wrap gap-2">
                        {(placementData.SspConfig?.BlockedSeats || []).map((item, idx) => (
                          <span key={`${item}-${idx}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 text-red-800 text-sm font-mono border border-red-100">
                            {item}
                            <button
                              type="button"
                              onClick={() => setPlacementData({
                                ...placementData,
                                SspConfig: {
                                  ...placementData.SspConfig,
                                  BlockedSeats: (placementData.SspConfig?.BlockedSeats || []).filter((_, i) => i !== idx),
                                },
                              })}
                              className="p-0.5 rounded hover:bg-red-100 text-red-600"
                              aria-label="Remove"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g. t1233"
                          className="max-w-xs font-mono"
                          value={newBlockedSeat}
                          onChange={(e) => setNewBlockedSeat(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            const v = newBlockedSeat.trim();
                            if (!v) return;
                            const list = placementData.SspConfig?.BlockedSeats || [];
                            if (list.includes(v)) return;
                            setPlacementData({
                              ...placementData,
                              SspConfig: {
                                ...placementData.SspConfig,
                                BlockedSeats: [...list, v],
                              },
                            });
                            setNewBlockedSeat('');
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const v = newBlockedSeat.trim();
                            if (!v) return;
                            const list = placementData.SspConfig?.BlockedSeats || [];
                            if (list.includes(v)) return;
                            setPlacementData({
                              ...placementData,
                              SspConfig: {
                                ...placementData.SspConfig,
                                BlockedSeats: [...list, v],
                              },
                            });
                            setNewBlockedSeat('');
                          }}
                        >
                          <Plus className="w-4 h-4" /> Add
                        </Button>
                      </div>
                    </div>
                  </div>

                  </CardContent>
                </Card>
              )}

            {/* Security Section */}
            {selectedSection === 'security' && (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
                  <CardTitle className="flex items-center gap-2 text-white text-base">
                    <Shield className="w-5 h-5" />
                    Security & Advanced Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">Creative Scan</h3>
                        <p className="text-sm text-slate-600">Enable creative scanning for fraud detection</p>
                      </div>
                      <ToggleSwitch
                          checked={!placementData.SspConfig?.CreativeScan?.DisableCreativeScan}
                          onCheckedChange={(checked) => {
                            if (!checked) {
                              // When disabling Creative Scan, only keep DisableCreativeScan: true
                              setPlacementData({
                            ...placementData,
                                SspConfig: {
                                  ...placementData.SspConfig,
                                  CreativeScan: {
                                    DisableCreativeScan: true
                                  }
                                }
                              });
                            } else {
                              // When enabling Creative Scan, set DisableCreativeScan: false and initialize if needed
                              setPlacementData({
                            ...placementData,
                                SspConfig: {
                                  ...placementData.SspConfig,
                                  CreativeScan: {
                                    DisableCreativeScan: false,
                                    CreativeScanPolicy: placementData.SspConfig?.CreativeScan?.CreativeScanPolicy || '',
                                    CreativeScanRatio: placementData.SspConfig?.CreativeScan?.CreativeScanRatio || 0
                                  }
                                }
                              });
                            }
                          }}
                        />
                    </div>
                      {/* Creative Scan details (shown when ON) */}
                      {(!placementData.SspConfig?.CreativeScan?.DisableCreativeScan) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                            <Label htmlFor="creativeScanPolicy">Creative Scan Policy</Label>
                        <Select
                              value={placementData.SspConfig?.CreativeScan?.CreativeScanPolicy || ''}
                          onValueChange={(value) => setPlacementData({
                            ...placementData,
                                SspConfig: {
                                  ...placementData.SspConfig,
                                  CreativeScan: {
                                    ...placementData.SspConfig?.CreativeScan,
                                    CreativeScanPolicy: value
                                  }
                            }
                          })}
                        >
                          <SelectTrigger className="bg-white">
                                <SelectValue placeholder="Select a policy" />
                          </SelectTrigger>
                          <SelectContent>
                                {creativeScanPolicies.map((p) => (
                                  <SelectItem key={p.uid} value={p.uid}>
                                    {p.name} — {p.uid}
                                  </SelectItem>
                                ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                            <Label htmlFor="creativeScanRatio">Creative Scan Ratio (%)</Label>
                            <div className="flex items-center gap-3">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => {
                                  const currentValue = placementData.SspConfig?.CreativeScan?.CreativeScanRatio || 0;
                                  const newValue = Math.max(0, currentValue - 0.01);
                                  setPlacementData({
                                    ...placementData,
                                    SspConfig: {
                                      ...placementData.SspConfig,
                                      CreativeScan: {
                                        ...placementData.SspConfig?.CreativeScan,
                                        CreativeScanRatio: newValue
                                      }
                                    }
                                  });
                                }}
                              >
                                <span className="text-sm">-</span>
                              </Button>
                              <Slider
                                value={[(placementData.SspConfig?.CreativeScan?.CreativeScanRatio || 0) * 100]}
                          onValueChange={(value) => setPlacementData({
                            ...placementData,
                                  SspConfig: {
                                    ...placementData.SspConfig,
                                    CreativeScan: {
                                      ...placementData.SspConfig?.CreativeScan,
                                      CreativeScanRatio: value[0] / 100
                                    }
                            }
                          })}
                                max={100}
                                min={0}
                                step={1}
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => {
                                  const currentValue = placementData.SspConfig?.CreativeScan?.CreativeScanRatio || 0;
                                  const newValue = Math.min(1, currentValue + 0.01);
                                  setPlacementData({
                                    ...placementData,
                                    SspConfig: {
                                      ...placementData.SspConfig,
                                      CreativeScan: {
                                        ...placementData.SspConfig?.CreativeScan,
                                        CreativeScanRatio: newValue
                                      }
                                    }
                                  });
                                }}
                              >
                                <span className="text-sm">+</span>
                              </Button>
                              <div className="bg-white border border-slate-300 rounded px-3 py-1.5 min-w-[60px] text-center font-semibold text-slate-900">
                                {(((placementData.SspConfig?.CreativeScan?.CreativeScanRatio || 0) * 100).toFixed(0))}%
                      </div>
                    </div>
            </div>
                      </div>
                      )}
                </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">Human Security</h3>
                        <p className="text-sm text-slate-600">Enable human scanning for security and fraud protection</p>
                      </div>
                      <ToggleSwitch
                        checked={hasProperty(placementData, 'SspConfig.HumanSecurity.DisableHumanSecurity') ? !placementData.SspConfig?.HumanSecurity?.DisableHumanSecurity : undefined}
                        onCheckedChange={(checked) => {
                          if (!checked) {
                            setPlacementData({
                              ...placementData,
                              SspConfig: {
                                ...placementData.SspConfig,
                                HumanSecurity: {
                                  DisableHumanSecurity: true
                                }
                              }
                            });
                          } else {
                            setPlacementData({
                              ...placementData,
                              SspConfig: {
                                ...placementData.SspConfig,
                                HumanSecurity: {
                                  DisableHumanSecurity: false,
                                  HumanSecurityScanRatio: placementData.SspConfig?.HumanSecurity?.HumanSecurityScanRatio ?? 0.001
                                }
                              }
                            });
                          }
                        }}
                      />
                    </div>

                    {(!placementData.SspConfig?.HumanSecurity?.DisableHumanSecurity) && (
                      <div className="space-y-2">
                        <Label htmlFor="humanSecurityScanRatio">Human Security Scan Ratio (%)</Label>
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => {
                              const currentValue = placementData.SspConfig?.HumanSecurity?.HumanSecurityScanRatio ?? 0.001;
                              const newValue = Math.max(0, currentValue - 0.001);
                              setPlacementData({
                                ...placementData,
                                SspConfig: {
                                  ...placementData.SspConfig,
                                  HumanSecurity: {
                                    ...placementData.SspConfig?.HumanSecurity,
                                    HumanSecurityScanRatio: newValue
                                  }
                                }
                              });
                            }}
                          >
                            <span className="text-sm">-</span>
                          </Button>
                          <Slider
                            value={[(placementData.SspConfig?.HumanSecurity?.HumanSecurityScanRatio ?? 0.001) * 100]}
                            onValueChange={(value) => setPlacementData({
                              ...placementData,
                              SspConfig: {
                                ...placementData.SspConfig,
                                HumanSecurity: {
                                  ...placementData.SspConfig?.HumanSecurity,
                                  HumanSecurityScanRatio: value[0] / 100
                                }
                              }
                            })}
                            max={100}
                            min={0}
                            step={0.1}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => {
                              const currentValue = placementData.SspConfig?.HumanSecurity?.HumanSecurityScanRatio ?? 0.001;
                              const newValue = Math.min(1, currentValue + 0.001);
                              setPlacementData({
                                ...placementData,
                                SspConfig: {
                                  ...placementData.SspConfig,
                                  HumanSecurity: {
                                    ...placementData.SspConfig?.HumanSecurity,
                                    HumanSecurityScanRatio: newValue
                                  }
                                }
                              });
                            }}
                          >
                            <span className="text-sm">+</span>
                          </Button>
                          <div className="bg-white border border-slate-300 rounded px-3 py-1.5 min-w-[70px] text-center font-semibold text-slate-900">
                            {(((placementData.SspConfig?.HumanSecurity?.HumanSecurityScanRatio ?? 0.001) * 100).toFixed(1))}%
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">System Information</h3>
                    <div className="space-y-2">
                      <Label>Lock Version</Label>
                      <Input
                        value={placementData.LockVersion || 0}
                        disabled
                        className="bg-slate-50"
                      />
                    </div>
                  </div>
              </CardContent>
            </Card>
          )}
    </EntityEditorLayout>
  );
};

export default EditPlacement;