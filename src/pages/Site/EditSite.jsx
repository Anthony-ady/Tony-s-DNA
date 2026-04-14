import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { ArrowLeft, Building2, Settings, Loader2, Save, X, AlertCircle, Globe, Target, Users, ClipboardCopy, Plus } from 'lucide-react';
import { authService } from '../../services/authService';
import ToggleSwitch from '../../components/ui/toggle-switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Slider } from '../../components/ui/slider';
import { Checkbox } from '../../components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../../components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import creativeScanPolicies from '../Realm/creative-scan-policies.json';
import { cn } from '@/lib/utils';
import { TAILWIND_CLASSES } from '@/config/theme';
import { apiUrl, API_ENDPOINTS } from '@/config/api';
import EntityEditorLayout from '@/components/layouts/EntityEditorLayout';
import { IAB_TAXONOMY, getIABCodesForCategory } from '@/utils/iabTaxonomy';

const EditSite = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const siteId = searchParams.get('id');
  const siteName = searchParams.get('name') || 'Unnamed Site';

  const [siteData, setSiteData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSection, setSelectedSection] = useState('basic');
  const [openIABId, setOpenIABId] = useState(null);
  const [openIABExclusionId, setOpenIABExclusionId] = useState(null);
  const [newAdvertiserExclusion, setNewAdvertiserExclusion] = useState('');
  const [newPartnerExclusion, setNewPartnerExclusion] = useState('');
  const [newAllowedSeat, setNewAllowedSeat] = useState('');
  const [newBlockedSeat, setNewBlockedSeat] = useState('');
  const [partnerNameMap, setPartnerNameMap] = useState({});
  const [partnerSearchTerm, setPartnerSearchTerm] = useState('');
  const [partnerSearchResults, setPartnerSearchResults] = useState([]);
  const [partnerSearchOpen, setPartnerSearchOpen] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  // Frozen initial IAB selection (for sort order): only updated on fetch, not on user toggle
  const initialIabListRef = useRef(null);
  const initialIabExclusionListRef = useRef(null);

  // Truncate site name to 15 characters with ellipsis
  const displaySiteName = siteData?.Name || siteName || 'Site';
  const truncatedSiteName = displaySiteName.length > 15 
    ? `${displaySiteName.substring(0, 15)}...` 
    : displaySiteName;

  // Floor Price: backend stores in thousandths of dollar (3000 = $3.00, 2500 = $2.50)
  const floorToDisplay = (backendVal) => {
    if (backendVal == null || backendVal === undefined || backendVal === '') return '';
    const dollars = Number(backendVal) / 1000;
    return Number.isNaN(dollars) ? '' : String(dollars);
  };
  const floorToBackend = (displayVal) => {
    if (displayVal === '' || displayVal == null) return undefined;
    const v = parseFloat(String(displayVal).replace(',', '.'));
    if (Number.isNaN(v) || v < 0) return undefined;
    return Math.round(v * 1000);
  };

  const handleCopySiteId = async () => {
    if (siteData?.Uid) {
      try {
        await navigator.clipboard.writeText(siteData.Uid);
        setSuccess('Site UID copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const sections = [
    { id: 'basic', label: 'Basic Info', icon: <Building2 className="w-4 h-4" /> },
    { id: 'ssp', label: 'SSP Configuration', icon: <Settings className="w-4 h-4" /> },
    { id: 'targeting', label: 'Targeting', icon: <Target className="w-4 h-4" /> }
  ];

  useEffect(() => {
    if (siteId) {
      fetchSiteData();
    }
  }, [siteId]);

  // Fetch partners for UID -> name mapping (Partners Exclusion display)
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

  // Debounced partner search for Partners Exclusion add-by-name
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

  const fetchSiteData = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      const response = await fetch(apiUrl.site(siteId), {
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
      // API may return { Data: site, Id, Kind, Version } or the site object directly
      const payload = data.Data ?? data;
      setSiteData(payload);
      // Freeze initial IAB state for sort order (so list doesn't move when user toggles)
      initialIabListRef.current = Array.isArray(payload.IABCategories) ? [...payload.IABCategories] : [];
      initialIabExclusionListRef.current = Array.isArray(payload.SspConfig?.CategoriesExclusion) ? [...payload.SspConfig.CategoriesExclusion] : [];
    } catch (err) {
      console.error('Error fetching site data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!siteData) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess('');
      const token = authService.getToken();
      
      // Prepare the data for the API (remove null fields and clean objects)
      const updateData = removeNullFields(siteData);
      
      // Backend expects UID strings only (psycopg2 can't adapt dict)
      if (updateData.Company && typeof updateData.Company === 'object' && updateData.Company.Uid) {
        updateData.Company = updateData.Company.Uid;
      }
      if (updateData.PublisherManager && typeof updateData.PublisherManager === 'object' && updateData.PublisherManager.Uid) {
        updateData.PublisherManager = updateData.PublisherManager.Uid;
      }
      if (updateData.Realm && typeof updateData.Realm === 'object' && updateData.Realm.Uid) {
        updateData.Realm = updateData.Realm.Uid;
      }
      
      // Use LockVersion from fetched site to avoid "model has already been updated" conflict
      const currentVersion = siteData.LockVersion ?? siteData.lock_version ?? 1000;
      const payload = {
        Data: updateData,
        Id: siteId,
        Kind: "Site",
        Version: currentVersion
      };

      console.log('Sending payload:', payload);
      
      const response = await fetch(apiUrl.site(siteId), {
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
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.Message || errorData.message || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      // Re-fetch site data to get the updated LockVersion for the next save
      await fetchSiteData();

      setSuccess('Site updated successfully!');
    } catch (err) {
      console.error('Error saving site:', err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
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

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString('fr-FR');
  };

  const getIABBadgeColor = (category) => {
    const colors = ['bg-blue-100 text-blue-800', 'bg-green-100 text-green-800', 'bg-purple-100 text-purple-800', 'bg-orange-100 text-orange-800', 'bg-pink-100 text-pink-800'];
    const index = category.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const iabList = Array.isArray(siteData?.IABCategories) ? siteData.IABCategories : [];

  // API uses underscore (IAB9_1), CSV uses hyphen (IAB9-1). Normalize for comparison.
  const iabCodeToApi = (code) => (code || '').replace(/-/g, '_');
  const isIABSelected = (code) => {
    if (!code) return false;
    const apiCode = iabCodeToApi(code);
    return iabList.includes(code) || iabList.includes(apiCode);
  };

  const toggleIABCode = (code) => {
    const apiCode = iabCodeToApi(code);
    const isSelected = iabList.includes(code) || iabList.includes(apiCode);
    if (isSelected) {
      const isMainCategory = /^IAB\d+$/.test(code) || /^IAB\d+$/.test(apiCode);
      const mainCode = apiCode.replace(/-/g, '_'); // e.g. IAB19
      const next = iabList.filter((c) => {
        if (c === code || c === apiCode) return false;
        if (isMainCategory && (c.startsWith(mainCode + '_') || c.startsWith(mainCode + '-'))) return false;
        return true;
      });
      setSiteData({ ...siteData, IABCategories: next });
    } else {
      const next = [...iabList.filter((c) => c !== code && c !== apiCode), apiCode];
      setSiteData({ ...siteData, IABCategories: next });
    }
  };

  // IAB inclusion: sort order based on initial load only (so list doesn't move when user toggles)
  const isIABSelectedInInitial = (code) => {
    const list = initialIabListRef.current;
    if (!list || !code) return false;
    const apiCode = iabCodeToApi(code);
    return list.includes(code) || list.includes(apiCode);
  };
  const iabTaxonomySorted = IAB_TAXONOMY.map((cat, i) => ({
    cat,
    i,
    hasSelection: getIABCodesForCategory(cat).some((c) => isIABSelectedInInitial(c))
  }))
    .sort((a, b) => {
      if (a.hasSelection && !b.hasSelection) return -1;
      if (!a.hasSelection && b.hasSelection) return 1;
      return a.i - b.i;
    })
    .map((x) => x.cat);

  const iabExclusionList = Array.isArray(siteData?.SspConfig?.CategoriesExclusion) ? siteData.SspConfig.CategoriesExclusion : [];
  const isIABExclusionSelected = (code) => {
    if (!code) return false;
    const apiCode = iabCodeToApi(code);
    return iabExclusionList.includes(code) || iabExclusionList.includes(apiCode);
  };
  const toggleIABExclusion = (code) => {
    const apiCode = iabCodeToApi(code);
    const isSelected = iabExclusionList.includes(code) || iabExclusionList.includes(apiCode);
    if (isSelected) {
      const isMainCategory = /^IAB\d+$/.test(code) || /^IAB\d+$/.test(apiCode);
      const mainCode = apiCode.replace(/-/g, '_');
      const next = iabExclusionList.filter((c) => {
        if (c === code || c === apiCode) return false;
        if (isMainCategory && (c.startsWith(mainCode + '_') || c.startsWith(mainCode + '-'))) return false;
        return true;
      });
      setSiteData({
        ...siteData,
        SspConfig: { ...siteData.SspConfig, CategoriesExclusion: next }
      });
    } else {
      const next = [...iabExclusionList.filter((c) => c !== code && c !== apiCode), apiCode];
      setSiteData({
        ...siteData,
        SspConfig: { ...siteData.SspConfig, CategoriesExclusion: next }
      });
    }
  };

  // IAB exclusion: sort order based on initial load only (so list doesn't move when user toggles)
  const isIABExclusionSelectedInInitial = (code) => {
    const list = initialIabExclusionListRef.current;
    if (!list || !code) return false;
    const apiCode = iabCodeToApi(code);
    return list.includes(code) || list.includes(apiCode);
  };
  const iabExclusionTaxonomySorted = IAB_TAXONOMY.map((cat, i) => ({
    cat,
    i,
    hasSelection: getIABCodesForCategory(cat).some((c) => isIABExclusionSelectedInInitial(c))
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
              <p className="text-slate-600 font-medium">Loading site data...</p>
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

  if (!siteData) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto p-6 lg:p-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <p className="text-slate-600 mb-4">No site data found</p>
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
      sectionCardTitle="Site"
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
                  onClick={() => navigate('/Site')}
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
                  <Globe className="w-7 h-7" />
            </div>
                <div className="space-y-1">
                  <h1 className="text-2xl font-semibold text-slate-900 leading-tight" title={displaySiteName}>{truncatedSiteName}</h1>
                  <p className="text-sm text-slate-500">Edit site configuration</p>
          </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {siteData?.Access != null && (
                  <span className="inline-flex items-center gap-2">
                    <ToggleSwitch
                      checked={siteData.Access === 'ALL'}
                      onCheckedChange={(checked) => setSiteData({ ...siteData, Access: checked ? 'ALL' : 'DISABLED' })}
                    />
                  </span>
                )}
                {siteData?.DistributionChannelKind && (
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium bg-[rgb(59,76,164)]/10 text-[rgb(59,76,164)] border border-[rgb(59,76,164)]/20">
                    Channel: {siteData.DistributionChannelKind}
                  </span>
                )}
                {siteData?.Sources && siteData.Sources.length > 0 && (
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    Sources: {siteData.Sources.join(', ')}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 text-sm text-slate-600">
              <div className="space-y-1">
                <p className="font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Site UID</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-700 text-xs md:text-sm break-all">{siteData?.Uid || siteId}</span>
                  {siteData?.Uid && (
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={handleCopySiteId}>
                      <ClipboardCopy className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              {siteData?.Company && (
                <div className="space-y-1">
                  <p className="font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Company</p>
                  <p className="font-medium text-slate-700">{typeof siteData.Company === 'string' ? siteData.Company : siteData.Company.Name || siteData.Company.Uid || 'N/A'}</p>
                </div>
              )}
              {siteData?.HasPlacements != null && (
                <div className="space-y-1">
                  <p className="font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Placements</p>
                  <p className="font-medium text-slate-700">{siteData.HasPlacements ? 'Yes' : 'No'}</p>
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
        success && (
            <Alert className="border-green-200 bg-green-50">
              <AlertDescription className="text-green-800 font-medium">
                {success}
              </AlertDescription>
            </Alert>
        )
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
                      <Label htmlFor="name">Site Name</Label>
                      <Input
                        id="name"
                        value={siteData.Name || ''}
                        onChange={(e) => setSiteData({...siteData, Name: e.target.value})}
                        placeholder="Enter site name"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hostname">Hostname</Label>
                      <Input
                        id="hostname"
                        value={siteData.Hostname || ''}
                        onChange={(e) => setSiteData({...siteData, Hostname: e.target.value})}
                        placeholder="Enter hostname"
                        className="bg-white"
                      />
                    </div>
                  </div>

                  {(siteData.HasPlacements != null) && (
                    <div className="space-y-2">
                      <Label>Has Placements</Label>
                      <p className="text-sm text-slate-600">{siteData.HasPlacements ? 'Yes' : 'No'}</p>
                        </div>
                  )}

                  <Separator />

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Company Name</Label>
                        <Input
                          value={siteData.Company?.Name || ''}
                          disabled
                          className="bg-slate-50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Company UID</Label>
                        <Input
                          value={siteData.Company?.Uid || ''}
                          disabled
                          className="bg-slate-50"
                        />
                      </div>
                      {(siteData.Company?.Revenues?.length > 0) && (
                        <div className="space-y-2 md:col-span-2">
                          <Label>Company Revenue Floor Price</Label>
                          <div className="flex items-center rounded-md border border-slate-200 bg-slate-50">
                            <span className="pl-3 text-slate-500 font-medium">$</span>
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              value={floorToDisplay(siteData.Company.Revenues[0]?.Floor)}
                              disabled
                              className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 pl-0 bg-slate-50"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2 max-w-xs">
                      <Label>Floor Price</Label>
                      <div className="flex items-center rounded-md border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-[rgb(59,76,164)] focus-within:ring-offset-0">
                        <span className="pl-3 text-slate-500 font-medium">$</span>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="0.00"
                          value={floorToDisplay(siteData.Revenues?.[0]?.Floor ?? siteData.SspConfig?.Revenues?.[0]?.Floor)}
                          onChange={(e) => {
                            const backend = floorToBackend(e.target.value);
                            const nextRevenues = [{ Floor: backend }];
                            setSiteData({
                              ...siteData,
                              Revenues: nextRevenues,
                              SspConfig: {
                                ...siteData.SspConfig,
                                Revenues: nextRevenues
                              }
                            });
                          }}
                          className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 pl-0"
                        />
                      </div>
                      <p className="text-xs text-slate-500">Amount in dollars (e.g. 3.5 for $3.50). Saved in Data.Revenues and Data.SspConfig.Revenues.</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Publisher Manager</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>First Name</Label>
                        <Input
                          value={siteData.PublisherManager?.FirstName || ''}
                          disabled
                          className="bg-slate-50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Last Name</Label>
                        <Input
                          value={siteData.PublisherManager?.LastName || ''}
                          disabled
                          className="bg-slate-50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Title</Label>
                      <Input
                          value={siteData.PublisherManager?.Title || ''}
                          disabled
                          className="bg-slate-50"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-3">
                        <Label>Publisher Manager UID</Label>
                        <Input
                          value={siteData.PublisherManager?.Uid || ''}
                          disabled
                          className="bg-slate-50 font-mono text-xs"
                        />
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
                    <h3 className="text-lg font-semibold text-slate-900">Ad Transformation Prevention</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="preventNative2Banner">Native ads in Banner slots</Label>
                          <p className="text-sm text-slate-600">Allows Native ads to be transformed and served in Banner placements</p>
                        </div>
                        <ToggleSwitch
                          id="preventNative2Banner"
                          checked={hasProperty(siteData, 'SspConfig.PreventAdTransform.Native2Banner') ? !siteData.SspConfig?.PreventAdTransform?.Native2Banner : undefined}
                          onCheckedChange={(checked) => setSiteData({
                            ...siteData,
                            SspConfig: {
                              ...siteData.SspConfig,
                              PreventAdTransform: {
                                ...siteData.SspConfig?.PreventAdTransform,
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
                          checked={hasProperty(siteData, 'SspConfig.PreventAdTransform.Video2Banner') ? !siteData.SspConfig?.PreventAdTransform?.Video2Banner : undefined}
                          onCheckedChange={(checked) => setSiteData({
                            ...siteData,
                            SspConfig: {
                              ...siteData.SspConfig,
                              PreventAdTransform: {
                                ...siteData.SspConfig?.PreventAdTransform,
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
                          checked={hasProperty(siteData, 'SspConfig.PreventAdTransform.Video2Native') ? !siteData.SspConfig?.PreventAdTransform?.Video2Native : undefined}
                          onCheckedChange={(checked) => setSiteData({
                            ...siteData,
                            SspConfig: {
                              ...siteData.SspConfig,
                              PreventAdTransform: {
                                ...siteData.SspConfig?.PreventAdTransform,
                                Video2Native: !checked
                              }
                            }
                          })}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Creative Scan</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="disableCreativeScan">Creative Scan</Label>
                          <p className="text-sm text-slate-600">Enable creative scanning for fraud detection</p>
                        </div>
                        <ToggleSwitch
                          checked={hasProperty(siteData, 'SspConfig.CreativeScan.DisableCreativeScan') ? !siteData.SspConfig?.CreativeScan?.DisableCreativeScan : undefined}
                          onCheckedChange={(checked) => {
                            if (!checked) {
                              // When disabling Creative Scan, only keep DisableCreativeScan: true
                              setSiteData({
                                ...siteData,
                                SspConfig: {
                                  ...siteData.SspConfig,
                                  CreativeScan: {
                                    DisableCreativeScan: true
                                  }
                                }
                              });
                            } else {
                              // When enabling Creative Scan, set DisableCreativeScan: false and initialize if needed
                              setSiteData({
                                ...siteData,
                                SspConfig: {
                                  ...siteData.SspConfig,
                                  CreativeScan: {
                                    DisableCreativeScan: false,
                                    CreativeScanPolicy: siteData.SspConfig?.CreativeScan?.CreativeScanPolicy || '',
                                    CreativeScanRatio: siteData.SspConfig?.CreativeScan?.CreativeScanRatio || 0
                                  }
                                }
                              });
                            }
                          }}
                        />
                      </div>
                      {/* Creative Scan details (shown when ON) */}
                      {(!siteData.SspConfig?.CreativeScan?.DisableCreativeScan) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="creativeScanPolicy">Creative Scan Policy</Label>
                            <Select
                              value={siteData.SspConfig?.CreativeScan?.CreativeScanPolicy || ''}
                              onValueChange={(value) => setSiteData({
                                ...siteData,
                                SspConfig: {
                                  ...siteData.SspConfig,
                                  CreativeScan: {
                                    ...siteData.SspConfig?.CreativeScan,
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
                                  const currentValue = siteData.SspConfig?.CreativeScan?.CreativeScanRatio || 0;
                                  const newValue = Math.max(0, currentValue - 0.01);
                                  setSiteData({
                                    ...siteData,
                                    SspConfig: {
                                      ...siteData.SspConfig,
                                      CreativeScan: {
                                        ...siteData.SspConfig?.CreativeScan,
                                        CreativeScanRatio: newValue
                                      }
                                    }
                                  });
                                }}
                              >
                                <span className="text-sm">-</span>
                              </Button>
                              <Slider
                                value={[(siteData.SspConfig?.CreativeScan?.CreativeScanRatio || 0) * 100]}
                                onValueChange={(value) => setSiteData({
                                  ...siteData,
                                  SspConfig: {
                                    ...siteData.SspConfig,
                                    CreativeScan: {
                                      ...siteData.SspConfig?.CreativeScan,
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
                                  const currentValue = siteData.SspConfig?.CreativeScan?.CreativeScanRatio || 0;
                                  const newValue = Math.min(1, currentValue + 0.01);
                                  setSiteData({
                                    ...siteData,
                                    SspConfig: {
                                      ...siteData.SspConfig,
                                      CreativeScan: {
                                        ...siteData.SspConfig?.CreativeScan,
                                        CreativeScanRatio: newValue
                                      }
                                    }
                                  });
                                }}
                              >
                                <span className="text-sm">+</span>
                              </Button>
                              <div className="bg-white border border-slate-300 rounded px-3 py-1.5 min-w-[60px] text-center font-semibold text-slate-900">
                                {(((siteData.SspConfig?.CreativeScan?.CreativeScanRatio || 0) * 100).toFixed(0))}%
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
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
                          checked={hasProperty(siteData, 'SspConfig.DisableDynamicMargin') ? !siteData.SspConfig?.DisableDynamicMargin : undefined}
                          onCheckedChange={(checked) => setSiteData({
                            ...siteData,
                            SspConfig: {
                              ...siteData.SspConfig,
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
                          checked={hasProperty(siteData, 'SspConfig.DisableIntentIq') ? !siteData.SspConfig?.DisableIntentIq : undefined}
                          onCheckedChange={(checked) => setSiteData({
                            ...siteData,
                            SspConfig: {
                              ...siteData.SspConfig,
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
                          checked={hasProperty(siteData, 'SspConfig.EnableEncodedTracking') ? siteData.SspConfig?.EnableEncodedTracking : undefined}
                          onCheckedChange={(checked) => setSiteData({
                            ...siteData,
                            SspConfig: {
                              ...siteData.SspConfig,
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
                          checked={hasProperty(siteData, 'SspConfig.EnableEnrichTrackingMetrics') ? siteData.SspConfig?.EnableEnrichTrackingMetrics : undefined}
                          onCheckedChange={(checked) => setSiteData({
                            ...siteData,
                            SspConfig: {
                              ...siteData.SspConfig,
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
                          checked={hasProperty(siteData, 'SspConfig.IsLegacyNativeTracking') ? siteData.SspConfig?.IsLegacyNativeTracking : undefined}
                          onCheckedChange={(checked) => setSiteData({
                            ...siteData,
                            SspConfig: {
                              ...siteData.SspConfig,
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
                          checked={hasProperty(siteData, 'SspConfig.OpenWebManaged') ? siteData.SspConfig?.OpenWebManaged : undefined}
                          onCheckedChange={(checked) => setSiteData({
                            ...siteData,
                            SspConfig: {
                              ...siteData.SspConfig,
                              OpenWebManaged: checked
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="disableOpenAuction">Disable Open Auction</Label>
                        </div>
                        <ToggleSwitch
                          checked={hasProperty(siteData, 'SspConfig.DisableOpenAuction') ? siteData.SspConfig?.DisableOpenAuction : undefined}
                          onCheckedChange={(checked) => setSiteData({
                            ...siteData,
                            SspConfig: {
                              ...siteData.SspConfig,
                              DisableOpenAuction: checked
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="enableEncodedAttempt">Enable Encoded Attempt</Label>
                        </div>
                        <ToggleSwitch
                          checked={hasProperty(siteData, 'SspConfig.EnableEncodedAttempt') ? siteData.SspConfig?.EnableEncodedAttempt : undefined}
                          onCheckedChange={(checked) => setSiteData({
                            ...siteData,
                            SspConfig: {
                              ...siteData.SspConfig,
                              EnableEncodedAttempt: checked
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label htmlFor="hbMatchedPlacementSizeOnly">HB Matched Placement Size Only</Label>
                        </div>
                        <ToggleSwitch
                          checked={hasProperty(siteData, 'SspConfig.HbMatchedPlacementSizeOnly') ? siteData.SspConfig?.HbMatchedPlacementSizeOnly : undefined}
                          onCheckedChange={(checked) => setSiteData({
                            ...siteData,
                            SspConfig: {
                              ...siteData.SspConfig,
                              HbMatchedPlacementSizeOnly: checked
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                    <div>
                          <Label htmlFor="disabled">Status</Label>
                        </div>
                        <ToggleSwitch
                          checked={hasProperty(siteData, 'SspConfig.Disabled') ? !siteData.SspConfig?.Disabled : undefined}
                          onCheckedChange={(checked) => setSiteData({
                            ...siteData,
                            SspConfig: {
                              ...siteData.SspConfig,
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
                          checked={hasProperty(siteData, 'SspConfig.DisabledOnFraudulent') ? !siteData.SspConfig?.DisabledOnFraudulent : undefined}
                          onCheckedChange={(checked) => setSiteData({
                            ...siteData,
                            SspConfig: {
                              ...siteData.SspConfig,
                              DisabledOnFraudulent: !checked
                            }
                          })}
                        />
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
                    <h3 className="text-lg font-semibold text-slate-900">IAB Categories</h3>
                    <p className="text-sm text-slate-500">Select main categories and/or subcategories. Saved as IABCategories array.</p>
                    <div className="space-y-1 border border-emerald-200 rounded-lg divide-y divide-emerald-100 max-h-[420px] overflow-y-auto bg-emerald-50/50">
                      {iabTaxonomySorted.map((cat) => {
                        const codes = getIABCodesForCategory(cat);
                        const mainCode = cat.code;
                        const selectedInCat = codes.filter((c) => isIABSelected(c));
                        const selectedCount = selectedInCat.length;
                        const isOpen = openIABId === cat.code;
                        return (
                          <Collapsible key={cat.code} open={isOpen} onOpenChange={(open) => setOpenIABId(open ? cat.code : null)}>
                            <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-emerald-100/80 text-sm font-medium text-emerald-900">
                              <ChevronRight className={cn("w-4 h-4 shrink-0 transition-transform", isOpen && "rotate-90")} />
                              <span className="flex-1">{cat.name}</span>
                              {selectedCount > 0 && (
                                <Badge variant="secondary" className="text-xs bg-emerald-200 text-emerald-900 hover:bg-emerald-300">
                                  {selectedCount}
                                </Badge>
                              )}
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="pl-6 pr-4 pb-3 pt-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    id={`iab-${mainCode}`}
                                    checked={isIABSelected(mainCode)}
                                    onCheckedChange={() => toggleIABCode(mainCode)}
                                    className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                  />
                                  <Label htmlFor={`iab-${mainCode}`} className="text-sm cursor-pointer text-emerald-900">
                                    {cat.name}{' '}
                                    <span className="text-xs text-emerald-600">(IAB {mainCode.replace(/^IAB/, '')})</span>
                                  </Label>
                                </div>
                                {cat.children?.length > 0 && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5">
                                    {cat.children.map((child) => (
                                      <div key={child.code} className="flex items-center gap-2">
                                        <Checkbox
                                          id={`iab-${child.code}`}
                                          checked={isIABSelected(child.code)}
                                          onCheckedChange={() => toggleIABCode(child.code)}
                                          className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                        />
                                        <Label htmlFor={`iab-${child.code}`} className="text-xs cursor-pointer truncate text-emerald-900" title={child.code}>
                                          {child.name}{' '}
                                          <span className="text-xs text-emerald-600">({child.code.replace(/^IAB/, 'IAB ')})</span>
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

                  <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 className="text-xl font-semibold text-slate-900 border-b border-slate-200 pb-2">Allowed Seats</h2>
                    <p className="text-sm text-slate-500">Allowed IAB categories are configured above. Seat allowlist for this site:</p>
                    <div className="space-y-4">
                      <p className="text-sm text-slate-500">Seat ID(s) to allow:</p>
                      <div className="flex flex-wrap gap-2">
                        {(siteData.SspConfig?.AllowedSeats || []).map((item, idx) => (
                          <span key={`${item}-${idx}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-900 text-sm font-mono border border-emerald-200">
                            {item}
                            <button
                              type="button"
                              onClick={() => setSiteData({
                                ...siteData,
                                SspConfig: {
                                  ...siteData.SspConfig,
                                  AllowedSeats: (siteData.SspConfig?.AllowedSeats || []).filter((_, i) => i !== idx),
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
                            const list = siteData.SspConfig?.AllowedSeats || [];
                            if (list.includes(v)) return;
                            setSiteData({
                              ...siteData,
                              SspConfig: {
                                ...siteData.SspConfig,
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
                            const list = siteData.SspConfig?.AllowedSeats || [];
                            if (list.includes(v)) return;
                            setSiteData({
                              ...siteData,
                              SspConfig: {
                                ...siteData.SspConfig,
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

                  <Separator />

                  <div className="space-y-6 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                    <h2 className="text-xl font-semibold text-slate-900 border-b border-slate-200 pb-2">Exclusions</h2>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Advertisers Exclusion</h3>
                    <p className="text-sm text-slate-500">Domain(s) to exclude:</p>
                    <div className="flex flex-wrap gap-2">
                      {(siteData.SspConfig?.AdvertisersExclusion || []).map((item, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 text-red-800 text-sm font-mono border border-red-100">
                          {item}
                          <button
                            type="button"
                            onClick={() => setSiteData({
                              ...siteData,
                              SspConfig: {
                                ...siteData.SspConfig,
                                AdvertisersExclusion: (siteData.SspConfig?.AdvertisersExclusion || []).filter((_, i) => i !== idx)
                              }
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
                          setSiteData({
                            ...siteData,
                            SspConfig: {
                              ...siteData.SspConfig,
                              AdvertisersExclusion: [...(siteData.SspConfig?.AdvertisersExclusion || []), v]
                            }
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
                          setSiteData({
                            ...siteData,
                            SspConfig: {
                              ...siteData.SspConfig,
                              AdvertisersExclusion: [...(siteData.SspConfig?.AdvertisersExclusion || []), v]
                            }
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
                        const isOpen = openIABExclusionId === cat.code;
                        return (
                          <Collapsible key={`excl-${cat.code}`} open={isOpen} onOpenChange={(open) => setOpenIABExclusionId(open ? cat.code : null)}>
                            <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-red-100/80 text-sm font-medium text-red-900">
                              <ChevronRight className={cn("w-4 h-4 shrink-0 transition-transform", isOpen && "rotate-90")} />
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
                                    id={`iab-excl-${mainCode}`}
                                    checked={isIABExclusionSelected(mainCode)}
                                    onCheckedChange={() => toggleIABExclusion(mainCode)}
                                    className="data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                                  />
                                  <Label htmlFor={`iab-excl-${mainCode}`} className="text-sm cursor-pointer text-red-900">
                                    {cat.name}{' '}
                                    <span className="text-xs text-red-600">(IAB {mainCode.replace(/^IAB/, '')})</span>
                                  </Label>
                                </div>
                                {cat.children?.length > 0 && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5">
                                    {cat.children.map((child) => (
                                      <div key={child.code} className="flex items-center gap-2">
                                        <Checkbox
                                          id={`iab-excl-${child.code}`}
                                          checked={isIABExclusionSelected(child.code)}
                                          onCheckedChange={() => toggleIABExclusion(child.code)}
                                          className="data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                                        />
                                        <Label htmlFor={`iab-excl-${child.code}`} className="text-xs cursor-pointer truncate text-red-900" title={child.code}>
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
                      {(siteData.SspConfig?.PartnersExclusion || []).map((item, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 text-red-800 text-sm border border-red-100"
                          title={item}
                        >
                          {partnerNameMap[item] || item}
                          <button
                            type="button"
                            onClick={() => setSiteData({
                            ...siteData,
                              SspConfig: {
                                ...siteData.SspConfig,
                                PartnersExclusion: (siteData.SspConfig?.PartnersExclusion || []).filter((_, i) => i !== idx)
                              }
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
                              const list = siteData.SspConfig?.PartnersExclusion || [];
                              if (list.includes(v)) return;
                              setSiteData({
                            ...siteData,
                                SspConfig: { ...siteData.SspConfig, PartnersExclusion: [...list, v] }
                              });
                              setNewPartnerExclusion('');
                              setPartnerSearchOpen(false);
                            } else if (partnerSearchResults.length > 0) {
                              const uid = partnerSearchResults[0].uid;
                              const list = siteData.SspConfig?.PartnersExclusion || [];
                              if (list.includes(uid)) return;
                              setSiteData({
                                ...siteData,
                                SspConfig: { ...siteData.SspConfig, PartnersExclusion: [...list, uid] }
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
                            const list = siteData.SspConfig?.PartnersExclusion || [];
                            if (!list.includes(v)) {
                              setSiteData({
                                ...siteData,
                                SspConfig: { ...siteData.SspConfig, PartnersExclusion: [...list, v] }
                              });
                            }
                            setNewPartnerExclusion('');
                          } else if (partnerSearchResults.length > 0) {
                            const uid = partnerSearchResults[0].uid;
                            const list = siteData.SspConfig?.PartnersExclusion || [];
                            if (!list.includes(uid)) {
                              setSiteData({
                                ...siteData,
                                SspConfig: { ...siteData.SspConfig, PartnersExclusion: [...list, uid] }
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
                            const alreadyExcluded = (siteData.SspConfig?.PartnersExclusion || []).includes(p.uid);
                            return (
                              <li key={p.uid}>
                                <button
                                  type="button"
                                  disabled={alreadyExcluded}
                                  className={cn(
                                    "w-full px-3 py-2 text-left hover:bg-slate-100 flex justify-between",
                                    alreadyExcluded && "opacity-50 cursor-not-allowed"
                                  )}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    if (alreadyExcluded) return;
                                    const list = siteData.SspConfig?.PartnersExclusion || [];
                                    setSiteData({
                                      ...siteData,
                                      SspConfig: { ...siteData.SspConfig, PartnersExclusion: [...list, p.uid] }
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
                        {(siteData.SspConfig?.BlockedSeats || []).map((item, idx) => (
                          <span key={`${item}-${idx}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 text-red-800 text-sm font-mono border border-red-100">
                            {item}
                            <button
                              type="button"
                              onClick={() => setSiteData({
                                ...siteData,
                                SspConfig: {
                                  ...siteData.SspConfig,
                                  BlockedSeats: (siteData.SspConfig?.BlockedSeats || []).filter((_, i) => i !== idx),
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
                            const list = siteData.SspConfig?.BlockedSeats || [];
                            if (list.includes(v)) return;
                            setSiteData({
                              ...siteData,
                              SspConfig: {
                                ...siteData.SspConfig,
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
                            const list = siteData.SspConfig?.BlockedSeats || [];
                            if (list.includes(v)) return;
                            setSiteData({
                              ...siteData,
                              SspConfig: {
                                ...siteData.SspConfig,
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
    </EntityEditorLayout>
  );
};

export default EditSite;