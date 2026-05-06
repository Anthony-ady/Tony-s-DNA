import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Slider } from '../../components/ui/slider';
import { Checkbox } from '../../components/ui/checkbox';
import { ArrowLeft, Building2, Settings, Loader2, Save, X, AlertCircle, Globe, Shield, Target, Users, ClipboardCopy } from 'lucide-react';
import { authService } from '../../services/authService';
import ToggleSwitch from '@/components/ui/toggle-switch';
import creativeScanPolicies from './creative-scan-policies.json';
import { cn } from '@/lib/utils';
import { TAILWIND_CLASSES } from '@/config/theme';
import { apiUrl } from '@/config/api';
import EntityEditorLayout from '@/components/layouts/EntityEditorLayout';
import { toast } from 'sonner';

const EditRealm = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const realmId = searchParams.get('id');
  const realmName = searchParams.get('name') || 'Unnamed Realm';

  const [realmData, setRealmData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSection, setSelectedSection] = useState('basic');
  const [error, setError] = useState(null);

  // Truncate realm name to 15 characters with ellipsis
  const displayRealmName = realmData?.Name || realmName || 'Realm';
  const truncatedRealmName = displayRealmName.length > 15 
    ? `${displayRealmName.substring(0, 15)}...` 
    : displayRealmName;

  const handleCopyRealmId = async () => {
    if (realmData?.Uid) {
      try {
        await navigator.clipboard.writeText(realmData.Uid);
        toast.success('Copied', { description: 'Realm UID copied to clipboard.' });
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const sections = [
    { id: 'basic', label: 'Basic Info', icon: <Building2 className="w-4 h-4" /> },
    { id: 'ssp', label: 'SSP Configuration', icon: <Globe className="w-4 h-4" /> },
    { id: 'targeting', label: 'Targeting', icon: <Target className="w-4 h-4" /> },
    { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> }
  ];

  useEffect(() => {
    if (realmId) {
      fetchRealmData();
    }
  }, [realmId]);

  const fetchRealmData = async () => {
    try {
      setLoading(true);
      const token = authService.getToken();
      const response = await fetch(apiUrl.realm(realmId), {
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
      setRealmData(data.Data);
    } catch (err) {
      console.error('Error fetching realm data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!realmData || saving) return;

    try {
      setSaving(true);
      setError(null);
      const token = authService.getToken();
      
      // Prepare the data for the API (remove null fields)
      const updateData = removeNullFields(realmData);
      
      // Create the proper payload structure
      const payload = {
        Data: updateData,
        Id: realmId,
        Kind: "Realm",
        Version: realmData.LockVersion || 1000
      };

      console.log('Sending payload:', payload);
      
      const response = await fetch(apiUrl.realm(realmId), {
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

      // Re-fetch the realm data to get the updated LockVersion
      await fetchRealmData();

      toast.success('Realm saved', {
        description: 'Your changes were applied successfully.',
      });
    } catch (err) {
      console.error('Error saving realm:', err);
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

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString('fr-FR');
  };

  const getAccessBadgeColor = (access) => {
    switch (access) {
      case 'ALL': return 'bg-green-100 text-green-800';
      case 'RESTRICTED': return 'bg-yellow-100 text-yellow-800';
      case 'NONE': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto p-6 lg:p-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-slate-600 mx-auto mb-4" />
              <p className="text-slate-600 font-medium">Loading realm data...</p>
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

  if (!realmData) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto p-6 lg:p-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <p className="text-slate-600 mb-4">No realm data found</p>
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
      sectionCardTitle="Realm"
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
                  onClick={() => navigate('/Realm')}
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
                  <h1 className="text-2xl font-semibold text-slate-900 leading-tight" title={displayRealmName}>{truncatedRealmName}</h1>
                  <p className="text-sm text-slate-500">Edit realm configuration</p>
          </div>
        </div>
              <div className="flex flex-wrap items-center gap-3">
                {realmData?.SspConfig?.Disabled !== undefined && (
                  <span className={cn(
                    'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border',
                    realmData.SspConfig.Disabled
                      ? 'bg-red-50 text-red-600 border-red-200'
                      : 'bg-green-50 text-green-600 border-green-200'
                  )}>
                    Status: {realmData.SspConfig.Disabled ? 'OFF' : 'ON'}
                  </span>
                )}
                {realmData?.Currency && (
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium bg-[rgb(59,76,164)]/10 text-[rgb(59,76,164)] border border-[rgb(59,76,164)]/20">
                    Currency: {realmData.Currency}
                  </span>
                )}
                {realmData?.Lang && (
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    Language: {realmData.Lang}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
              <div className="space-y-1">
                <p className="font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Realm UID</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-700 text-xs md:text-sm break-all">{realmData?.Uid || realmId}</span>
                  {realmData?.Uid && (
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={handleCopyRealmId}>
                      <ClipboardCopy className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              {realmData?.AdminEmail && (
                <div className="space-y-1">
                  <p className="font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Admin Email</p>
                  <p className="font-medium text-slate-700">{realmData.AdminEmail}</p>
                </div>
              )}
              {realmData?.MainCountry && (
                <div className="space-y-1">
                  <p className="font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Main Country</p>
                  <p className="font-medium text-slate-700">{realmData.MainCountry}</p>
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
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="enableSSP">Status</Label>
                      <ToggleSwitch
                        checked={!realmData.SspConfig?.Disabled}
                        onCheckedChange={(checked) => setRealmData({
                          ...realmData,
                          SspConfig: {
                            ...realmData.SspConfig,
                            Disabled: !checked
                          }
                        })}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Realm Name</Label>
                      <Input
                        id="name"
                        value={realmData.Name || ''}
                        onChange={(e) => setRealmData({...realmData, Name: e.target.value})}
                        placeholder="Enter realm name"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="uid">Realm UID</Label>
                      <Input
                        id="uid"
                        value={realmData.Uid || ''}
                        disabled
                        className="bg-slate-50"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="admin_email">Admin Email</Label>
                      <Input
                        id="admin_email"
                        type="email"
                        value={realmData.AdminEmail || ''}
                        onChange={(e) => setRealmData({...realmData, AdminEmail: e.target.value})}
                        placeholder="Enter admin email"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="language">Language</Label>
                      <Select
                        value={realmData.Lang || 'EN'}
                        onValueChange={(value) => setRealmData({...realmData, Lang: value})}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="EN">English</SelectItem>
                          <SelectItem value="FR">French</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <Select
                        value={realmData.Currency || 'USD'}
                        onValueChange={(value) => setRealmData({...realmData, Currency: value})}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="main_country">Main Distribution Country</Label>
                      <Select
                        value={realmData.MainDistributionCountry || 'FR'}
                        onValueChange={(value) => setRealmData({...realmData, MainDistributionCountry: value})}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FR">France</SelectItem>
                          <SelectItem value="US">United States</SelectItem>
                          <SelectItem value="GB">United Kingdom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dc">Data Center</Label>
                      <Select
                        value={realmData.DC || ''}
                        onValueChange={(value) => setRealmData({ ...realmData, DC: value })}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select data center" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fra02">Europe (fra02)</SelectItem>
                          <SelectItem value="usa02">USA (usa02)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="region">Region</Label>
                      <Select
                        value={realmData.Region || ''}
                        onValueChange={(value) => setRealmData({...realmData, Region: value})}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select region" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UNASSIGNED">UNASSIGNED</SelectItem>
                          <SelectItem value="FR">FR</SelectItem>
                          <SelectItem value="UK">UK</SelectItem>
                          <SelectItem value="US">US</SelectItem>
                          <SelectItem value="Internal">Internal</SelectItem>
                          <SelectItem value="EMEA">EMEA</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Timestamps</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Created At</Label>
                        <Input
                          value={formatTimestamp(realmData.CreatedAt)}
                          disabled
                          className="bg-slate-50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Updated At</Label>
                        <Input
                          value={formatTimestamp(realmData.UpdatedAt)}
                          disabled
                          className="bg-slate-50"
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
                    <Globe className="w-5 h-5" />
                    SSP Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between w-full">
                        <Label htmlFor="isAdNetwork">Is Ad Network</Label>
                        <ToggleSwitch
                          id="isAdNetwork"
                          checked={realmData.IsAdNetwork || false}
                          onCheckedChange={(checked) => setRealmData({
                            ...realmData,
                            IsAdNetwork: checked
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between w-full">
                        <Label htmlFor="locked">Locked</Label>
                        <ToggleSwitch
                          id="locked"
                          checked={realmData.Locked || false}
                          onCheckedChange={(checked) => setRealmData({
                            ...realmData,
                            Locked: checked
                          })}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Demand source</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { value: 'SSP', label: 'Programmatic' },
                        { value: 'ADSERVER', label: 'DIRECT' }
                      ].map(({ value, label }) => {
                        const isChecked = realmData.Sources?.includes(value) || false;
                        return (
                          <div key={value} className="flex items-center space-x-3">
                            <Checkbox
                              id={`source-${value}`}
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                const currentSources = realmData.Sources || [];
                                const newSources = checked
                                  ? [...currentSources, value]
                                  : currentSources.filter(s => s !== value);
                                setRealmData({...realmData, Sources: newSources});
                              }}
                              className="h-5 w-5 border-2 border-slate-300 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600 data-[state=checked]:text-white"
                            />
                            <Label htmlFor={`source-${value}`} className="cursor-pointer">
                              {label}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">System Information</h3>
                    <div className="space-y-2">
                      <Label>Lock Version</Label>
                      <Input
                        value={realmData.LockVersion || 0}
                        disabled
                        className="bg-slate-50"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                      <div className="flex items-center justify-between ">
                        <div>
                          <Label htmlFor="enableDynamicMargin">Dynamic Margin</Label>
                        </div>
                        <ToggleSwitch
                          checked={!realmData.SspConfig?.DisableDynamicMargin}
                          onCheckedChange={(checked) => setRealmData({
                            ...realmData,
                            SspConfig: {
                              ...realmData.SspConfig,
                              DisableDynamicMargin: !checked
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between ">
                        <div>
                          <Label htmlFor="enableIntentIq">Intent IQ</Label>
                        </div>
                        <ToggleSwitch
                          checked={!realmData.SspConfig?.DisableIntentIq}
                          onCheckedChange={(checked) => setRealmData({
                            ...realmData,
                            SspConfig: {
                              ...realmData.SspConfig,
                              DisableIntentIq: !checked
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between ">
                        <div>
                          <Label htmlFor="enableEncodedTracking">Encoded Tracking</Label>
                        </div>
                        <ToggleSwitch
                          checked={realmData.SspConfig?.EnableEncodedTracking || false}
                          onCheckedChange={(checked) => setRealmData({
                            ...realmData,
                            SspConfig: {
                              ...realmData.SspConfig,
                              EnableEncodedTracking: checked
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between w-full">
                        <div>
                          <Label htmlFor="disablePartnerSelection">Partner Selection</Label>
                        </div>
                        <ToggleSwitch
                          checked={!realmData.SspConfig?.DisablePartnerSelection}
                          onCheckedChange={(checked) => setRealmData({
                            ...realmData,
                            SspConfig: {
                              ...realmData.SspConfig,
                              DisablePartnerSelection: !checked
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between ">
                        <div>
                          <Label htmlFor="enableEnrichTrackingMetrics">Enrich Tracking Metrics</Label>
                        </div>
                        <ToggleSwitch
                          checked={realmData.SspConfig?.EnableEnrichTrackingMetrics || false}
                          onCheckedChange={(checked) => setRealmData({
                            ...realmData,
                            SspConfig: {
                              ...realmData.SspConfig,
                              EnableEnrichTrackingMetrics: checked
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between w-full">
                        <div>
                          <Label htmlFor="isLegacyNativeTracking">Legacy Native Tracking</Label>
                        </div>
                        <ToggleSwitch
                          checked={realmData.SspConfig?.IsLegacyNativeTracking || false}
                          onCheckedChange={(checked) => setRealmData({
                            ...realmData,
                            SspConfig: {
                              ...realmData.SspConfig,
                              IsLegacyNativeTracking: checked
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between w-full">
                        <div>
                          <Label htmlFor="openWebManaged">OpenWeb Managed</Label>
                        </div>
                        <ToggleSwitch
                          checked={realmData.SspConfig?.OpenWebManaged || false}
                          onCheckedChange={(checked) => setRealmData({
                            ...realmData,
                            SspConfig: {
                              ...realmData.SspConfig,
                              OpenWebManaged: checked
                            }
                          })}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Ad Transform</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between w-full">
                        <div>
                          <Label htmlFor="allowNative2Banner">Native ads in Banner slots</Label>
                          <p className="text-sm text-slate-600">Allows Native ads to be transformed and served in Banner placements</p>
                        </div>
                        <ToggleSwitch
                          checked={!realmData.SspConfig?.PreventAdTransform?.Native2Banner}
                          onCheckedChange={(checked) => setRealmData({
                            ...realmData,
                            SspConfig: {
                              ...realmData.SspConfig,
                              PreventAdTransform: {
                                ...realmData.SspConfig?.PreventAdTransform,
                                Native2Banner: !checked
                              }
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between w-full">
                        <div>
                          <Label htmlFor="allowVideo2Banner">Video ads in Banner slots</Label>
                          <p className="text-sm text-slate-600">Allows Video ads to be transformed and served in Banner placements</p>
                        </div>
                        <ToggleSwitch
                          checked={!realmData.SspConfig?.PreventAdTransform?.Video2Banner}
                          onCheckedChange={(checked) => setRealmData({
                            ...realmData,
                            SspConfig: {
                              ...realmData.SspConfig,
                              PreventAdTransform: {
                                ...realmData.SspConfig?.PreventAdTransform,
                                Video2Banner: !checked
                              }
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between w-full">
                        <div>
                          <Label htmlFor="allowVideo2Native">Video ads in Native slots</Label>
                          <p className="text-sm text-slate-600">Allows Video ads to be transformed and served in Native placements</p>
                        </div>
                        <ToggleSwitch
                          checked={!realmData.SspConfig?.PreventAdTransform?.Video2Native}
                          onCheckedChange={(checked) => setRealmData({
                            ...realmData,
                            SspConfig: {
                              ...realmData.SspConfig,
                              PreventAdTransform: {
                                ...realmData.SspConfig?.PreventAdTransform,
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
                    <h3 className="text-lg font-semibold text-slate-900">Margin Strategy</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="marginStrategy">Strategy</Label>
                        <Select
                          value={realmData.SspConfig?.MarginStrategy?.Strategy || 'SHARE'}
                          onValueChange={(value) => setRealmData({
                            ...realmData,
                            SspConfig: {
                              ...realmData.SspConfig,
                              MarginStrategy: {
                                ...realmData.SspConfig?.MarginStrategy,
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
                          {realmData.SspConfig?.MarginStrategy?.Strategy === 'SHARE' ? "Publisher's share (%)" : "Adyoulike's margin (%)"}
                        </Label>
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => {
                              const currentValue = realmData.SspConfig?.MarginStrategy?.Margin || 0;
                              const newValue = Math.max(0, currentValue - 0.01);
                              setRealmData({
                                ...realmData,
                                SspConfig: {
                                  ...realmData.SspConfig,
                                  MarginStrategy: {
                                    ...realmData.SspConfig?.MarginStrategy,
                                    Margin: newValue
                                  }
                                }
                              });
                            }}
                          >
                            <span className="text-sm">-</span>
                          </Button>
                          <Slider
                            value={[(realmData.SspConfig?.MarginStrategy?.Margin || 0) * 100]}
                            onValueChange={(value) => setRealmData({
                              ...realmData,
                              SspConfig: {
                                ...realmData.SspConfig,
                                MarginStrategy: {
                                  ...realmData.SspConfig?.MarginStrategy,
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
                              const currentValue = realmData.SspConfig?.MarginStrategy?.Margin || 0;
                              const newValue = Math.min(1, currentValue + 0.01);
                              setRealmData({
                                ...realmData,
                                SspConfig: {
                                  ...realmData.SspConfig,
                                  MarginStrategy: {
                                    ...realmData.SspConfig?.MarginStrategy,
                                    Margin: newValue
                                  }
                                }
                              });
                            }}
                          >
                            <span className="text-sm">+</span>
                          </Button>
                          <div className="bg-white border border-slate-300 rounded px-3 py-1.5 min-w-[60px] text-center font-semibold text-slate-900">
                            {((realmData.SspConfig?.MarginStrategy?.Margin || 0) * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                        <p className="text-sm text-slate-700">
                          {realmData.SspConfig?.MarginStrategy?.Strategy === 'SHARE' ? (
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

            {/* Targeting Section */}
            {selectedSection === 'targeting' && (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
                  <CardTitle className="flex items-center gap-2 text-white text-base">
                    <Target className="w-5 h-5" />
                    Targeting & Exclusions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Advertisers Exclusion</h3>
                    <div className="space-y-2">
                      <Label>Advertiser Domains</Label>
                      <Textarea
                        value={(realmData.SspConfig?.AdvertisersExclusion || []).join('\n')}
                        onChange={(e) => {
                          const advertisers = e.target.value.split('\n').filter(adv => adv.trim() !== '');
                          setRealmData({
                            ...realmData,
                            SspConfig: {
                              ...realmData.SspConfig,
                              AdvertisersExclusion: advertisers
                            }
                          });
                        }}
                        placeholder="Enter advertiser domains to exclude (one per line)"
                        rows={4}
                        className="bg-white"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Categories Exclusion</h3>
                    <div className="space-y-2">
                      <Label>Category Codes</Label>
                      <Textarea
                        value={(realmData.SspConfig?.CategoriesExclusion || []).join('\n')}
                        onChange={(e) => {
                          const categories = e.target.value.split('\n').filter(cat => cat.trim() !== '');
                          setRealmData({
                            ...realmData,
                            SspConfig: {
                              ...realmData.SspConfig,
                              CategoriesExclusion: categories
                            }
                          });
                        }}
                        placeholder="Enter category codes to exclude (one per line)"
                        rows={4}
                        className="bg-white"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Partners Exclusion</h3>
                    <div className="space-y-2">
                      <Label>Partner UIDs</Label>
                      <Textarea
                        value={(realmData.SspConfig?.PartnersExclusion || []).join('\n')}
                        onChange={(e) => {
                          const partners = e.target.value.split('\n').filter(partner => partner.trim() !== '');
                          setRealmData({
                            ...realmData,
                            SspConfig: {
                              ...realmData.SspConfig,
                              PartnersExclusion: partners
                            }
                          });
                        }}
                        placeholder="Enter partner UIDs to exclude (one per line)"
                        rows={4}
                        className="bg-white"
                      />
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
                    <div className="space-y-4">
                      <div className="flex items-center justify-between w-full">
                        <Label htmlFor="skipBotEnrichment">Bot Enrichment</Label>
                        <ToggleSwitch
                          id="skipBotEnrichment"
                          checked={!realmData.SspConfig?.SkipBotEnrichment || false}
                          onCheckedChange={(checked) => setRealmData({
                            ...realmData,
                            SspConfig: {
                              ...realmData.SspConfig,
                              SkipBotEnrichment: !checked
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between w-full">
                        <Label htmlFor="skipUaDetection">UA Detection</Label>
                        <ToggleSwitch
                          id="skipUaDetection"
                          checked={!realmData.SspConfig?.SkipUaDetection || false}
                          onCheckedChange={(checked) => setRealmData({
                            ...realmData,
                            SspConfig: {
                              ...realmData.SspConfig,
                              SkipUaDetection: !checked
                            }
                          })}
                        />
                      </div>
                      <div className="flex items-center justify-between w-full">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">Creative Scan</h3>
                          <p className="text-sm text-slate-600">Enable creative scanning for fraud detection</p>
                        </div>
                        <ToggleSwitch
                          checked={!realmData.SspConfig?.CreativeScan?.DisableCreativeScan}
                          onCheckedChange={(checked) => setRealmData({
                            ...realmData,
                            SspConfig: {
                              ...realmData.SspConfig,
                              CreativeScan: {
                                ...realmData.SspConfig?.CreativeScan,
                                DisableCreativeScan: !checked
                              }
                            }
                          })}
                        />
                      </div>
                      {/* Creative Scan details (shown when ON) */}
                      {(!realmData.SspConfig?.CreativeScan?.DisableCreativeScan) && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="creativeScanPolicy">Creative Scan Policy</Label>
                            <Select
                              value={realmData.SspConfig?.CreativeScan?.CreativeScanPolicy || ''}
                              onValueChange={(value) => setRealmData({
                                ...realmData,
                                SspConfig: {
                                  ...realmData.SspConfig,
                                  CreativeScan: {
                                    ...realmData.SspConfig?.CreativeScan,
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
                                  const currentValue = realmData.SspConfig?.CreativeScan?.CreativeScanRatio || 0;
                                  const newValue = Math.max(0, currentValue - 0.01);
                                  setRealmData({
                                    ...realmData,
                                    SspConfig: {
                                      ...realmData.SspConfig,
                                      CreativeScan: {
                                        ...realmData.SspConfig?.CreativeScan,
                                        CreativeScanRatio: newValue
                                      }
                                    }
                                  });
                                }}
                              >
                                <span className="text-sm">-</span>
                              </Button>
                              <Slider
                                value={[(realmData.SspConfig?.CreativeScan?.CreativeScanRatio || 0) * 100]}
                                onValueChange={(value) => setRealmData({
                                  ...realmData,
                                  SspConfig: {
                                    ...realmData.SspConfig,
                                    CreativeScan: {
                                      ...realmData.SspConfig?.CreativeScan,
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
                                  const currentValue = realmData.SspConfig?.CreativeScan?.CreativeScanRatio || 0;
                                  const newValue = Math.min(1, currentValue + 0.01);
                                  setRealmData({
                                    ...realmData,
                                    SspConfig: {
                                      ...realmData.SspConfig,
                                      CreativeScan: {
                                        ...realmData.SspConfig?.CreativeScan,
                                        CreativeScanRatio: newValue
                                      }
                                    }
                                  });
                                }}
                              >
                                <span className="text-sm">+</span>
                              </Button>
                              <div className="bg-white border border-slate-300 rounded px-3 py-1.5 min-w-[60px] text-center font-semibold text-slate-900">
                                {(((realmData.SspConfig?.CreativeScan?.CreativeScanRatio || 0) * 100).toFixed(0))}%
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
    </EntityEditorLayout>
  );
};

export default EditRealm;