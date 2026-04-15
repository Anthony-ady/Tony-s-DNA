import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { ArrowLeft, Building2, Settings, Loader2, Save, X, AlertCircle, Globe, Shield, Target, Users, ClipboardCopy } from 'lucide-react';
import { authService } from '../../services/authService';
import ToggleSwitch from '../../components/ui/toggle-switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Slider } from '../../components/ui/slider';
import creativeScanPolicies from '../Realm/creative-scan-policies.json';
import { cn } from '@/lib/utils';
import { TAILWIND_CLASSES } from '@/config/theme';
import { apiUrl } from '@/config/api';
import EntityEditorLayout from '@/components/layouts/EntityEditorLayout';
import { useEntityFetch } from '@/hooks/useEntityFetch';
import { apiPut } from '@/services/apiClient';
import { toast } from 'sonner';

const EditCompany = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const companyId = searchParams.get('id');
  const companyName = searchParams.get('name') || 'Unnamed Company';

  const resolveCompanyUrl = useCallback((id) => apiUrl.company(id), []);
  const extractCompanyData = useCallback((d) => d.Data, []);
  const handleUnauthorized = useCallback(() => authService.handleUnauthorized(navigate), [navigate]);

  const { data: fetchedData, loading, error: fetchError, refetch } = useEntityFetch({
    entityId: companyId,
    url: resolveCompanyUrl,
    dataExtractor: extractCompanyData,
    onUnauthorized: handleUnauthorized,
  });

  const [companyData, setCompanyData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedSection, setSelectedSection] = useState('basic');
  const [error, setError] = useState(null);

  useEffect(() => {
    setCompanyData(fetchedData);
  }, [fetchedData]);

  // Truncate company name to 15 characters with ellipsis
  const displayCompanyName = companyData?.Name || companyName || 'Company';
  const truncatedCompanyName = displayCompanyName.length > 15 
    ? `${displayCompanyName.substring(0, 15)}...` 
    : displayCompanyName;

  const handleCopyCompanyId = async () => {
    if (companyData?.Uid) {
      try {
        await navigator.clipboard.writeText(companyData.Uid);
        toast.success('Copied', { description: 'Company UID copied to clipboard.' });
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const sections = useMemo(() => ([
    { id: 'basic', label: 'Basic Info', icon: <Building2 className="w-4 h-4" /> },
    { id: 'ssp', label: 'SSP Configuration', icon: <Settings className="w-4 h-4" /> },
    { id: 'targeting', label: 'Targeting', icon: <Target className="w-4 h-4" /> },
    { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> }
  ]), []);

  const handleSave = async () => {
    if (!companyData) return;

    try {
      setSaving(true);
      setError(null);
      const token = authService.getToken();
      
      // Prepare the data for the API (remove null fields and clean manager objects)
      const updateData = removeNullFields(companyData);
      
      // Clean manager objects - keep only UID if they are objects
      if (updateData.AccountManager && typeof updateData.AccountManager === 'object' && updateData.AccountManager.Uid) {
        updateData.AccountManager = updateData.AccountManager.Uid;
      }
      if (updateData.Manager && typeof updateData.Manager === 'object' && updateData.Manager.Uid) {
        updateData.Manager = updateData.Manager.Uid;
      }
      
      // Create the proper payload structure
      const payload = {
        Data: updateData,
        Id: companyId,
        Kind: "Company",
        Version: 1000
      };

      console.log('Sending payload:', payload);
      
      const response = await apiPut(apiUrl.company(companyId), payload);

      if (!response.ok) {
        if (response.status === 401) {
          authService.handleUnauthorized(navigate);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      toast.success('Company saved', {
        description: 'Your changes were applied successfully.',
      });
      refetch();
    } catch (err) {
      console.error('Error saving company:', err);
      toast.error('Save failed', { description: err.message });
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
              <p className="text-slate-600 font-medium">Loading company data...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const displayError = error || fetchError;

  if (displayError) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto p-6 lg:p-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Alert variant="destructive" className="mb-4 border-red-200 bg-red-50">
                <AlertCircle className="h-5 w-5" />
                <AlertDescription className="text-red-800 font-medium">
                  Error: {displayError}
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!companyData) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-7xl mx-auto p-6 lg:p-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <p className="text-slate-600 mb-4">No company data found</p>
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
      sectionCardTitle="Company"
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
                  onClick={() => navigate('/Company')}
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
                  <Building2 className="w-7 h-7" />
            </div>
                <div className="space-y-1">
                  <h1 className="text-2xl font-semibold text-slate-900 leading-tight" title={displayCompanyName}>{truncatedCompanyName}</h1>
                  <p className="text-sm text-slate-500">Edit company configuration</p>
          </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {companyData?.SspConfig?.Disabled !== undefined && (
                  <span className={cn(
                    'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border',
                    companyData.SspConfig.Disabled
                      ? 'bg-red-50 text-red-600 border-red-200'
                      : 'bg-green-50 text-green-600 border-green-200'
                  )}>
                    Status: {companyData.SspConfig.Disabled ? 'OFF' : 'ON'}
                  </span>
                )}
                {companyData?.Currency && (
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium bg-[rgb(59,76,164)]/10 text-[rgb(59,76,164)] border border-[rgb(59,76,164)]/20">
                    Currency: {companyData.Currency}
                  </span>
                )}
                {companyData?.Lang && (
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    Language: {companyData.Lang}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
              <div className="space-y-1">
                <p className="font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Company UID</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-700 text-xs md:text-sm break-all">{companyData?.Uid || companyId}</span>
                  {companyData?.Uid && (
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={handleCopyCompanyId}>
                      <ClipboardCopy className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              {companyData?.Manager && (
                <div className="space-y-1">
                  <p className="font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Manager</p>
                  <p className="font-medium text-slate-700">{companyData.Manager.FirstName} {companyData.Manager.LastName}</p>
                </div>
              )}
              {companyData?.Realm && (
                <div className="space-y-1">
                  <p className="font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Realm</p>
                  <p className="font-medium text-slate-700">{typeof companyData.Realm === 'string' ? companyData.Realm : companyData.Realm.Uid || 'N/A'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      alerts={[
        displayError && (
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <AlertCircle className="h-5 w-5" />
                <AlertDescription className="text-red-800 font-medium">
                  {displayError}
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
                      <Label htmlFor="name">Company Name</Label>
                      <Input
                        id="name"
                        value={companyData.Name || ''}
                        onChange={(e) => setCompanyData({...companyData, Name: e.target.value})}
                        placeholder="Enter company name"
                        className="bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="uid">Company UID</Label>
                      <Input
                        id="uid"
                        value={companyData.Uid || ''}
                        disabled
                        className="bg-slate-50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inventoryDirectness">Inventory Directness</Label>
                      <Select
                        value={companyData.InventoryDirectness ?? ''}
                        onValueChange={(value) => setCompanyData({ ...companyData, InventoryDirectness: value })}
                      >
                        <SelectTrigger id="inventoryDirectness" className="bg-white">
                          <SelectValue placeholder="Select inventory directness" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BOTH">BOTH</SelectItem>
                          <SelectItem value="DIRECT">DIRECT</SelectItem>
                          <SelectItem value="RESELLER">RESELLER</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Realm Information</h3>
                    <div className="space-y-2">
                      <Label>Realm UID</Label>
                      <Input
                        value={companyData.Realm || ''}
                        disabled
                        className="bg-slate-50"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Timestamps</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Created At</Label>
                        <Input
                          value={formatTimestamp(companyData.CreatedAt)}
                          disabled
                          className="bg-slate-50"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Updated At</Label>
                        <Input
                          value={formatTimestamp(companyData.UpdatedAt)}
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
                          checked={hasProperty(companyData, 'SspConfig.PreventAdTransform.Native2Banner') ? !companyData.SspConfig?.PreventAdTransform?.Native2Banner : undefined}
                          onCheckedChange={(checked) => setCompanyData({
                            ...companyData,
                            SspConfig: {
                              ...companyData.SspConfig,
                              PreventAdTransform: {
                                ...companyData.SspConfig?.PreventAdTransform,
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
                          checked={hasProperty(companyData, 'SspConfig.PreventAdTransform.Video2Banner') ? !companyData.SspConfig?.PreventAdTransform?.Video2Banner : undefined}
                          onCheckedChange={(checked) => setCompanyData({
                            ...companyData,
                            SspConfig: {
                              ...companyData.SspConfig,
                              PreventAdTransform: {
                                ...companyData.SspConfig?.PreventAdTransform,
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
                          checked={hasProperty(companyData, 'SspConfig.PreventAdTransform.Video2Native') ? !companyData.SspConfig?.PreventAdTransform?.Video2Native : undefined}
                          onCheckedChange={(checked) => setCompanyData({
                            ...companyData,
                            SspConfig: {
                              ...companyData.SspConfig,
                              PreventAdTransform: {
                                ...companyData.SspConfig?.PreventAdTransform,
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
                          checked={hasProperty(companyData, 'SspConfig.CreativeScan.DisableCreativeScan') ? !companyData.SspConfig?.CreativeScan?.DisableCreativeScan : undefined}
                          onCheckedChange={(checked) => {
                            if (!checked) {
                              // When disabling Creative Scan, only keep DisableCreativeScan: true
                              setCompanyData({
                                ...companyData,
                                SspConfig: {
                                  ...companyData.SspConfig,
                                  CreativeScan: {
                                    DisableCreativeScan: true
                                  }
                                }
                              });
                            } else {
                              // When enabling Creative Scan, set DisableCreativeScan: false and initialize if needed
                              setCompanyData({
                                ...companyData,
                                SspConfig: {
                                  ...companyData.SspConfig,
                                  CreativeScan: {
                                    DisableCreativeScan: false,
                                    CreativeScanPolicy: companyData.SspConfig?.CreativeScan?.CreativeScanPolicy || '',
                                    CreativeScanRatio: companyData.SspConfig?.CreativeScan?.CreativeScanRatio || 0
                                  }
                                }
                              });
                            }
                          }}
                        />
                      </div>
                      {/* Creative Scan details (shown when ON) */}
                      {(!companyData.SspConfig?.CreativeScan?.DisableCreativeScan) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="creativeScanPolicy">Creative Scan Policy</Label>
                            <Select
                              value={companyData.SspConfig?.CreativeScan?.CreativeScanPolicy || ''}
                              onValueChange={(value) => setCompanyData({
                                ...companyData,
                                SspConfig: {
                                  ...companyData.SspConfig,
                                  CreativeScan: {
                                    ...companyData.SspConfig?.CreativeScan,
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
                                  const currentValue = companyData.SspConfig?.CreativeScan?.CreativeScanRatio || 0;
                                  const newValue = Math.max(0, currentValue - 0.01);
                                  setCompanyData({
                                    ...companyData,
                                    SspConfig: {
                                      ...companyData.SspConfig,
                                      CreativeScan: {
                                        ...companyData.SspConfig?.CreativeScan,
                                        CreativeScanRatio: newValue
                                      }
                                    }
                                  });
                                }}
                              >
                                <span className="text-sm">-</span>
                              </Button>
                              <Slider
                                value={[(companyData.SspConfig?.CreativeScan?.CreativeScanRatio || 0) * 100]}
                                onValueChange={(value) => setCompanyData({
                                  ...companyData,
                                  SspConfig: {
                                    ...companyData.SspConfig,
                                    CreativeScan: {
                                      ...companyData.SspConfig?.CreativeScan,
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
                                  const currentValue = companyData.SspConfig?.CreativeScan?.CreativeScanRatio || 0;
                                  const newValue = Math.min(1, currentValue + 0.01);
                                  setCompanyData({
                                    ...companyData,
                                    SspConfig: {
                                      ...companyData.SspConfig,
                                      CreativeScan: {
                                        ...companyData.SspConfig?.CreativeScan,
                                        CreativeScanRatio: newValue
                                      }
                                    }
                                  });
                                }}
                              >
                                <span className="text-sm">+</span>
                              </Button>
                              <div className="bg-white border border-slate-300 rounded px-3 py-1.5 min-w-[60px] text-center font-semibold text-slate-900">
                                {(((companyData.SspConfig?.CreativeScan?.CreativeScanRatio || 0) * 100).toFixed(0))}%
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
                          checked={hasProperty(companyData, 'SspConfig.DisableDynamicMargin') ? !companyData.SspConfig?.DisableDynamicMargin : undefined}
                          onCheckedChange={(checked) => setCompanyData({
                            ...companyData,
                            SspConfig: {
                              ...companyData.SspConfig,
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
                          checked={hasProperty(companyData, 'SspConfig.DisableIntentIq') ? !companyData.SspConfig?.DisableIntentIq : undefined}
                          onCheckedChange={(checked) => setCompanyData({
                            ...companyData,
                            SspConfig: {
                              ...companyData.SspConfig,
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
                          checked={hasProperty(companyData, 'SspConfig.EnableEncodedTracking') ? companyData.SspConfig?.EnableEncodedTracking : undefined}
                          onCheckedChange={(checked) => setCompanyData({
                            ...companyData,
                            SspConfig: {
                              ...companyData.SspConfig,
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
                          checked={hasProperty(companyData, 'SspConfig.EnableEnrichTrackingMetrics') ? companyData.SspConfig?.EnableEnrichTrackingMetrics : undefined}
                          onCheckedChange={(checked) => setCompanyData({
                            ...companyData,
                            SspConfig: {
                              ...companyData.SspConfig,
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
                          checked={hasProperty(companyData, 'SspConfig.IsLegacyNativeTracking') ? companyData.SspConfig?.IsLegacyNativeTracking : undefined}
                          onCheckedChange={(checked) => setCompanyData({
                            ...companyData,
                            SspConfig: {
                              ...companyData.SspConfig,
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
                          checked={hasProperty(companyData, 'SspConfig.OpenWebManaged') ? companyData.SspConfig?.OpenWebManaged : undefined}
                          onCheckedChange={(checked) => setCompanyData({
                            ...companyData,
                            SspConfig: {
                              ...companyData.SspConfig,
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
                          checked={hasProperty(companyData, 'SspConfig.Disabled') ? !companyData.SspConfig?.Disabled : undefined}
                          onCheckedChange={(checked) => setCompanyData({
                            ...companyData,
                            SspConfig: {
                              ...companyData.SspConfig,
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
                          checked={hasProperty(companyData, 'SspConfig.DisabledOnFraudulent') ? !companyData.SspConfig?.DisabledOnFraudulent : undefined}
                          onCheckedChange={(checked) => setCompanyData({
                            ...companyData,
                            SspConfig: {
                              ...companyData.SspConfig,
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
                    <h3 className="text-lg font-semibold text-slate-900">Company Revenues</h3>
                    <div className="space-y-2">
                      {companyData.Revenues?.map((revenue, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <Badge variant="outline">
                            Floor: {revenue.Floor}
                          </Badge>
                        </div>
                      ))}
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
                    Security
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900">Access Control</h3>
                    <div className="space-y-2">
                      <Label>Access Level</Label>
                      <Badge className={getAccessBadgeColor(companyData.Access)}>
                        {companyData.Access || 'N/A'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
    </EntityEditorLayout>
  );
};

export default EditCompany;