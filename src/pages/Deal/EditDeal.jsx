/**
 * Edit Deal Page Component
 * 
 * This page allows editing of deal configurations with a clean DSP-style design.
 * It provides a multi-section layout for managing deal settings including basic info,
 * targeting, content, and advanced configurations.
 * 
 * Features:
 * - Multi-section navigation sidebar
 * - Real-time form updates with PUT requests
 * - Clean slate-colored design matching DSP template
 * - Comprehensive deal configuration management
 * - Error handling and loading states
 * - Responsive design with proper form validation
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Building2, Loader2, Save, X, AlertCircle, Users, ClipboardCopy, Globe2, Clock3, AppWindow, Monitor, Video, ImageIcon, Layers, Target as TargetIcon, FileText, DollarSign } from 'lucide-react';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { authService } from '../../services/authService';
import { cn } from '@/lib/utils';
import { API_ENDPOINTS, apiUrl } from '@/config/api';
import EntityEditorLayout from '@/components/layouts/EntityEditorLayout';

const EditDeal = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [dealId, setDealId] = useState('');
  const [dealName, setDealName] = useState('');
  const [dealData, setDealData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSuccessVisible, setIsSuccessVisible] = useState(false);
  const [availableAudiences, setAvailableAudiences] = useState([]);
  const [audiencesLoading, setAudiencesLoading] = useState(false);
  const [audiencesError, setAudiencesError] = useState('');
  const [selectedAudienceId, setSelectedAudienceId] = useState('');
  const [activeSection, setActiveSection] = useState('general');

  // Load deal ID from URL params
  useEffect(() => {
    const id = searchParams.get('id');
    const name = searchParams.get('name');
    if (id) {
      setDealId(id);
      setDealName(name || 'Deal');
      fetchDealData(id);
    }
  }, [searchParams]);

  const fetchDealData = async (id) => {
    setLoading(true);
    setError('');

    try {
      const token = authService.getToken();
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await fetch(apiUrl.deal(id), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-ayl-auth-token': token
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Deal data fetched:', data);
      setDealData(data.Data);
      setDealName(prev => prev || data.Data?.Name || 'Deal');
    } catch (err) {
      console.error('Error fetching deal data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!dealData) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const token = authService.getToken();
      if (!token) {
        throw new Error('Authentication token not found');
      }

      // Remove null fields before sending
      const cleanedData = removeNullFields(dealData);

      const response = await fetch(apiUrl.deal(dealId), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-ayl-auth-token': token
        },
        body: JSON.stringify({
          Data: cleanedData
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setSuccess('Deal updated successfully!');
      setIsSuccessVisible(true);
      setTimeout(() => {
        setSuccess('');
        setIsSuccessVisible(false);
      }, 3000);
      
      if (cleanedData.Name) {
        setDealName(cleanedData.Name);
      }
      // Reload deal data to get updated LockVersion
      await fetchDealData(dealId);
    } catch (err) {
      console.error('Error saving deal:', err);
      setError(err.message);
    } finally {
      setSaving(false);
      setIsSuccessVisible(false);
    }
  };

  const dealAudiences = dealData?.Audiences;

  useEffect(() => {
    const fetchAudiences = async () => {
      if (!dealAudiences || dealAudiences.length === 0) return;
      if (availableAudiences.length > 0) return;

      const token = authService.getToken();
      if (!token) return;

      try {
        setAudiencesError('');
        setAudiencesLoading(true);

        const cachedAudiences = localStorage.getItem('deal_audiences_cache');
        const cacheTimestamp = localStorage.getItem('deal_audiences_cache_timestamp');
        const now = Date.now();
        const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

        if (cachedAudiences && cacheTimestamp && (now - parseInt(cacheTimestamp, 10)) < CACHE_DURATION) {
          try {
            const parsed = JSON.parse(cachedAudiences);
            setAvailableAudiences(Array.isArray(parsed) ? parsed : []);
            return;
          } catch (error) {
            // Cache corrupted, fall through to refetch
          }
        }

        const response = await fetch(API_ENDPOINTS.DEALS_AUDIENCES, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-ayl-auth-token': token,
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            authService.handleUnauthorized?.(navigate);
          }
          throw new Error(`Failed to load audiences (${response.status})`);
        }

        const data = await response.json();
        const normalized = Array.isArray(data) ? data : [];
        setAvailableAudiences(normalized);
        localStorage.setItem('deal_audiences_cache', JSON.stringify(normalized));
        localStorage.setItem('deal_audiences_cache_timestamp', String(Date.now()));
      } catch (err) {
        console.error('Error fetching audiences:', err);
        setAudiencesError(err.message || 'Unable to load audiences');
      } finally {
        setAudiencesLoading(false);
      }
    };

    fetchAudiences();
  }, [dealAudiences, availableAudiences.length, navigate]);

  const removeNullFields = (obj) => {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(removeNullFields);
    if (typeof obj !== 'object') return obj;

    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== null && value !== undefined) {
        cleaned[key] = removeNullFields(value);
      }
    }
    return cleaned;
  };

  const updateDealData = (field, value) => {
    setDealData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateNestedData = (parentField, field, value) => {
    setDealData(prev => ({
      ...prev,
      [parentField]: {
        ...(prev?.[parentField] || {}),
        [field]: value
      }
    }));
  };

  const addAudience = () => {
    if (!selectedAudienceId) return;
    const audienceId = selectedAudienceId;
    setDealData(prev => {
      const current = Array.isArray(prev?.Audiences) ? prev.Audiences : [];
      if (current.includes(audienceId)) {
        return prev;
      }
      return {
        ...prev,
        Audiences: [...current, audienceId],
      };
    });
    setSelectedAudienceId('');
  };

  const removeAudience = (audienceId) => {
    setDealData(prev => {
      const current = Array.isArray(prev?.Audiences) ? prev.Audiences : [];
      return {
        ...prev,
        Audiences: current.filter((id) => id !== audienceId),
      };
    });
  };

  const handleCopyDealId = async () => {
    if (!dealId) return;
    try {
      await navigator.clipboard.writeText(dealId);
      setSuccess('Deal ID copied to clipboard.');
      setIsSuccessVisible(true);
      setTimeout(() => {
        setSuccess('');
        setIsSuccessVisible(false);
      }, 2000);
    } catch (clipboardError) {
      console.error('Unable to copy Deal ID:', clipboardError);
    }
  };

  const formatDateTimeInput = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 16);
  };

  const parseDateTimeInput = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.getTime();
  };

  const isAdFormatActive = (value) => Array.isArray(dealData?.AdKinds) && dealData.AdKinds.includes(value);

  const toggleAdFormat = (value) => {
    setDealData(prev => {
      const current = Array.isArray(prev?.AdKinds) ? prev.AdKinds : [];
      const isActive = current.includes(value);
      return {
        ...prev,
        AdKinds: isActive ? current.filter(item => item !== value) : [...current, value]
      };
    });
  };

  const isOpenerActive = (value) => Array.isArray(dealData?.Content?.Openers) && dealData.Content.Openers.includes(value);

  const toggleOpener = (value) => {
    const current = Array.isArray(dealData?.Content?.Openers) ? dealData.Content.Openers : [];
    const isActive = current.includes(value);
    const updated = isActive ? current.filter(item => item !== value) : [...current, value];
    updateNestedData('Content', 'Openers', updated);
  };

  const minMarginValue = Number.isFinite(dealData?.MinMargin) ? Number(dealData.MinMargin) : 0;
  const sliderValue = [minMarginValue];

  const displayDealName = dealData?.Name || dealName || 'Deal';
  const displayCompany = dealData?.CompanyName || dealData?.Company || 'N/A';
  const displayRealm = dealData?.RealmName || dealData?.Realm || 'N/A';
  
  // Truncate deal name to 15 characters with ellipsis
  const truncatedDealName = displayDealName.length > 15 
    ? `${displayDealName.substring(0, 15)}...` 
    : displayDealName;

  const renderToggleButton = (isActive, label) => cn(
    'flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
    isActive
      ? 'bg-[rgb(75,99,226)] text-white border-transparent shadow-sm'
      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
  );

  const sections = [
    { id: 'general', label: 'General info', icon: <Building2 className="w-4 h-4" /> },
    { id: 'audience', label: 'Audience', icon: <Users className="w-4 h-4" /> },
    { id: 'notes', label: 'Notes', icon: <FileText className="w-4 h-4" /> }
  ];

  const timezoneOptions = useMemo(() => [
    'Europe/Paris',
    'Europe/London',
    'UTC',
    'America/New_York',
    'America/Los_Angeles',
    'Asia/Singapore'
  ], []);

  const dealTypes = useMemo(() => ([
    { value: 'CLASSIC', label: 'Classic' },
    { value: 'DIRECT', label: 'Direct' },
    { value: 'PUBLISHER', label: 'Publisher' }
  ]), []);

  const adFormatOptions = useMemo(() => ([
    { value: 'AD_BANNER', label: 'Banner', icon: <ImageIcon className="w-4 h-4" /> },
    { value: 'AD_STORY', label: 'Story', icon: <Monitor className="w-4 h-4" /> },
    { value: 'AD_VIDEO', label: 'Native Video', icon: <Video className="w-4 h-4" /> },
    { value: 'AD_INSTREAM', label: 'Instream', icon: <AppWindow className="w-4 h-4" /> },
    { value: 'AD_OUTSTREAM', label: 'Outstream', icon: <Layers className="w-4 h-4" /> }
  ]), []);

  const openerOptions = [
    { value: 'REDIRECT', label: 'ADREADER' },
    { value: 'FEED', label: 'FEED' }
  ];

  const auctionTypeOptions = [
    { value: 1, label: 'First Price' },
    { value: 2, label: 'Fixed Price' }
  ];

  const priorityOptions = [
    { value: 'OPEN', label: 'Normal' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGHEST', label: 'Highest' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading deal data...</p>
        </div>
      </div>
    );
  }

  if (error && !dealData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Error Loading Deal</h2>
          <p className="text-slate-600 mb-4">{error}</p>
        </div>
      </div>
    );
  }

  if (!dealData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Deal data unavailable</h2>
          <p className="text-slate-600 mb-4">We couldn't load this deal. Please try again.</p>
        </div>
      </div>
    );
  }

  return (
    <EntityEditorLayout
      sections={sections}
      selectedSection={activeSection}
      onSectionSelect={setActiveSection}
      sectionCardTitle="General Parameters"
      sidebarFooter={(
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 space-y-2">
              <Button
                onClick={handleSave}
                disabled={saving}
              className="w-full bg-slate-600 hover:bg-slate-700 text-white"
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
              onClick={() => navigate('/Deal')}
              className="w-full hover:bg-slate-50 hover:border-slate-300"
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
                <div className="w-14 h-14 rounded-xl bg-[rgb(59,76,164)]/10 text-[rgb(59,76,164)] flex items-center justify-center">
                  <Building2 className="w-7 h-7" />
            </div>
                <div className="space-y-1">
                  <h1 className="text-2xl font-semibold text-slate-900 leading-tight" title={displayDealName}>{truncatedDealName}</h1>
                  <p className="text-sm text-slate-500">Edit deal configuration</p>
          </div>
        </div>
              <div className="flex flex-wrap items-center gap-3">
                {dealData?.Access && (
                  <span className={cn(
                    'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border',
                    dealData.Access === 'DISABLED'
                      ? 'bg-red-50 text-red-600 border-red-200'
                      : dealData.Access === 'ALL'
                        ? 'bg-green-50 text-green-600 border-green-200'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                  )}>
                    Access: {dealData.Access}
                  </span>
                )}
                {dealData?.ModeKind && (
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium bg-[rgb(59,76,164)]/10 text-[rgb(59,76,164)] border border-[rgb(59,76,164)]/20">
                    Mode: {dealData.ModeKind}
                  </span>
                )}
                {dealData?.PriorityKind && (
                  <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    Priority: {dealData.PriorityKind}
                  </span>
                )}
                        </div>
          </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-600">
              <div className="space-y-1">
                <p className="font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Deal UID</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-700 text-xs md:text-sm break-all">{dealData.Uid}</span>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={handleCopyDealId}>
                    <ClipboardCopy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Company</p>
                <p className="font-medium text-slate-700">{displayCompany}</p>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-slate-500 uppercase text-[11px] tracking-wide">Realm</p>
                <p className="font-medium text-slate-700">{displayRealm}</p>
              </div>
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
          <Alert className={`border-green-200 bg-green-50 transition-opacity duration-700 ${isSuccessVisible ? 'opacity-100' : 'opacity-0'}`}>
            <AlertDescription className="text-green-800 font-medium">
              {success}
            </AlertDescription>
          </Alert>
        )
      ]}
    >
      <>
        {activeSection === 'general' && (
          <div className="space-y-6">
                  <Card className="border-slate-200 shadow-sm">
              <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
                <CardTitle className="flex items-center gap-2 text-white text-base">
                  <Building2 className="w-5 h-5" />
                  General info
                      </CardTitle>
                    </CardHeader>
              <CardContent className="space-y-6 text-sm text-slate-600">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        <div className="space-y-2">
                    <Label>Name*</Label>
                          <Input
                            value={dealData.Name || ''}
                            onChange={(e) => updateDealData('Name', e.target.value)}
                      placeholder="Enter deal name"
                          />
                        </div>
                        <div className="space-y-2">
                    <Label>Company*</Label>
                          <Input
                      value={dealData.Company || ''}
                      onChange={(e) => updateDealData('Company', e.target.value)}
                      placeholder="Company identifier"
                          />
                        </div>
                        <div className="space-y-2">
                    <Label>Realm*</Label>
                          <Input
                      value={dealData.Realm || ''}
                      onChange={(e) => updateDealData('Realm', e.target.value)}
                      placeholder="Realm identifier"
                          />
                        </div>
                        <div className="space-y-2">
                    <Label>Sale manager</Label>
                          <Input
                      value={dealData.Sale || ''}
                      onChange={(e) => updateDealData('Sale', e.target.value)}
                      placeholder="Assign a sale manager"
                          />
                        </div>
                      </div>
                      <Separator />
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-3">
                          <Switch
                      id="cross-realm"
                            checked={dealData.CrossRealm || false}
                            onCheckedChange={(checked) => updateDealData('CrossRealm', checked)}
                          />
                          <div>
                      <Label htmlFor="cross-realm" className="font-medium">Cross realm</Label>
                      <p className="text-xs text-slate-500">Toggle if the deal spans multiple realms.</p>
                          </div>
                          </div>
                  <div className="flex items-center gap-3">
                          <Switch
                            id="curated"
                            checked={dealData.Curated || false}
                            onCheckedChange={(checked) => updateDealData('Curated', checked)}
                          />
                          <div>
                      <Label htmlFor="curated" className="font-medium">Curated</Label>
                      <p className="text-xs text-slate-500">Use curated marketplace settings.</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 shadow-sm mb-4">
                    <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
                      <CardTitle className="flex items-center gap-2 text-white text-base">
                  <Clock3 className="w-5 h-5" />
                  Schedules
                      </CardTitle>
                    </CardHeader>
              <CardContent className="space-y-6 text-sm text-slate-600">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="space-y-2">
                    <Label>Time zone</Label>
                    <Select
                      value={dealData.TimeZone || ''}
                      onValueChange={(value) => updateDealData('TimeZone', value)}
                    >
                      <SelectTrigger><SelectValue placeholder="Select a time zone" /></SelectTrigger>
                      <SelectContent className="max-h-64">
                        {timezoneOptions.map((tz) => (
                          <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                        <div className="space-y-2">
                    <Label>From</Label>
                          <Input
                      type="datetime-local"
                      value={formatDateTimeInput(dealData.StartedAt)}
                      onChange={(e) => updateDealData('StartedAt', parseDateTimeInput(e.target.value))}
                          />
                        </div>
                        <div className="space-y-2">
                    <Label>To</Label>
                          <Input
                      type="datetime-local"
                      value={formatDateTimeInput(dealData.FinishedAt)}
                      onChange={(e) => updateDealData('FinishedAt', parseDateTimeInput(e.target.value))}
                          />
                        </div>
                      </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm mb-4">
              <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
                <CardTitle className="flex items-center gap-2 text-white text-base">
                  <AppWindow className="w-5 h-5" />
                  Deal settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 text-sm text-slate-600">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-wide text-slate-500">Deal type</Label>
                        <div className="flex flex-wrap gap-2">
                      {dealTypes.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={renderToggleButton(dealData.ModeKind === option.value, option.label)}
                          onClick={() => updateDealData('ModeKind', option.value)}
                        >
                          {option.label}
                        </button>
                          ))}
                        </div>
                      </div>
                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-wide text-slate-500">Ad format</Label>
                          <div className="flex flex-wrap gap-2">
                      {adFormatOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={renderToggleButton(isAdFormatActive(option.value), option.label)}
                          onClick={() => toggleAdFormat(option.value)}
                        >
                          {option.icon}
                          {option.label}
                        </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <Separator />

                <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-wide text-slate-500">Openers</Label>
                    <div className="flex flex-wrap gap-6">
                      {openerOptions.map((opener) => (
                        <label key={opener.value} className="flex items-center gap-2 text-sm text-slate-600">
                          <Checkbox
                            checked={isOpenerActive(opener.value)}
                            onCheckedChange={() => toggleOpener(opener.value)}
                          />
                          {opener.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-slate-500">Partners</Label>
                    <Input placeholder="Search for partners" className="bg-white" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 shadow-sm mb-4">
                    <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
                      <CardTitle className="flex items-center gap-2 text-white text-base">
                  <DollarSign className="w-5 h-5" />
                  Pricing & priority
                      </CardTitle>
                    </CardHeader>
              <CardContent className="space-y-6 text-sm text-slate-600">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="font-medium">Floor price</Label>
                    <div className="flex flex-col md:flex-row items-stretch gap-3">
                      <div className="flex-1">
                        <Label className="text-xs text-slate-500">Value (cents)</Label>
                        <Input
                          type="number"
                          value={dealData.Floor ?? ''}
                          onChange={(e) => updateDealData('Floor', Number(e.target.value) || 0)}
                          placeholder="e.g. 130"
                          />
                          </div>
                      <div className="flex-1">
                        <Label className="text-xs text-slate-500">Display (USD CPM)</Label>
                        <Input
                          readOnly
                          value={dealData.Floor ? (dealData.Floor / 100).toFixed(2) : '0.00'}
                          className="bg-slate-100"
                          />
                        </div>
                          </div>
                          </div>
                  <div className="space-y-2">
                    <Label className="font-medium">Min margin</Label>
                    <div className="flex items-center gap-4">
                      <Slider
                        value={sliderValue}
                        max={100}
                        step={1}
                        onValueChange={(values) => updateDealData('MinMargin', values[0])}
                        className="flex-1"
                      />
                      <div className="w-12 text-sm font-semibold text-right">{sliderValue[0]}%</div>
                    </div>
                    <p className="text-xs text-slate-500">Once activated, the margin overrides SSP remuneration strategy.</p>
                        </div>
                      </div>

                      <Separator />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-wide text-slate-500">Bid price</Label>
                        <div className="flex flex-wrap gap-2">
                      {auctionTypeOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={renderToggleButton(dealData.AuctionType === option.value, option.label)}
                          onClick={() => updateDealData('AuctionType', option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-xs uppercase tracking-wide text-slate-500">Bid priority</Label>
                        <div className="flex flex-wrap gap-2">
                      {priorityOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={renderToggleButton(dealData.PriorityKind === option.value, option.label)}
                          onClick={() => updateDealData('PriorityKind', option.value)}
                        >
                          {option.label}
                        </button>
                          ))}
                    </div>
                        </div>
                      </div>

                      <Separator />

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Switch
                      id="allow-js"
                      checked={dealData.AllowJavascript || false}
                      onCheckedChange={(checked) => updateDealData('AllowJavascript', checked)}
                    />
                          <div>
                      <Label htmlFor="allow-js" className="font-medium">Allow JavaScript</Label>
                      <p className="text-xs text-slate-500">Enable JavaScript creatives for this deal.</p>
                          </div>
                          </div>
                  <div className="flex items-center gap-3">
                    <Label className="text-sm text-slate-600">Visibility</Label>
                    <Input
                      type="number"
                      value={dealData.Visibility ?? 0}
                      onChange={(e) => updateDealData('Visibility', Number(e.target.value) || 0)}
                      className="w-24"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 shadow-sm mb-4">
                    <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
                      <CardTitle className="flex items-center gap-2 text-white text-base">
                  <Globe2 className="w-5 h-5" />
                  Geography & Restrictions
                      </CardTitle>
                    </CardHeader>
              <CardContent className="space-y-6 text-sm text-slate-600">
                        <div className="space-y-2">
                  <Label className="font-medium">Blacklisted domains</Label>
                  {Array.isArray(dealData.BlacklistSiteDomains) && dealData.BlacklistSiteDomains.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {dealData.BlacklistSiteDomains.map((domain) => (
                        <Badge key={domain} variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          {domain}
                        </Badge>
                      ))}
                        </div>
                  ) : (
                    <p className="text-sm text-slate-500">No blacklisted domains.</p>
                  )}
                        </div>

                      <Separator />

                        <div className="space-y-2">
                  <Label className="font-medium">Geolocation targeting</Label>
                  <p className="text-sm text-slate-500">
                    {dealData.Targeting?.Geolocation ? 'Custom geolocation rules applied.' : 'No geolocation restrictions.'}
                  </p>
                        </div>
              </CardContent>
            </Card>
                      </div>
        )}

        {activeSection === 'audience' && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <Users className="w-5 h-5" />
                Audience
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-sm text-slate-600">
              {audiencesLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading audiences…
                              </div>
              ) : (
                <>
                  {audiencesError && (
                    <Alert variant="destructive">
                      <AlertDescription>{audiencesError}</AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-3">
                    <h4 className="text-base font-semibold text-slate-700">Selected audiences</h4>
                    <div className="flex flex-wrap gap-2">
                      {Array.isArray(dealData.Audiences) && dealData.Audiences.length > 0 ? (
                        dealData.Audiences.map((audienceId) => {
                          const match = availableAudiences.find((aud) => String(aud.id) === String(audienceId) || String(aud.Uid) === String(audienceId));
                          const audienceLabel = match?.name || match?.Name || audienceId;
                          return (
                            <Badge
                              key={audienceId}
                              variant="outline"
                              onClick={() => removeAudience(audienceId)}
                              className="bg-blue-50 text-blue-800 border-blue-300 cursor-pointer hover:bg-blue-100"
                              title="Click to remove"
                            >
                              {audienceLabel}
                            </Badge>
                          );
                        })
                      ) : (
                        <span className="text-sm text-slate-500">No audiences selected</span>
                      )}
                        </div>
                      </div>

                      <Separator />

                  <div className="space-y-3">
                    <h4 className="text-base font-semibold text-slate-700">Add audience</h4>
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                      <Select
                        value={selectedAudienceId}
                        onValueChange={setSelectedAudienceId}
                        disabled={availableAudiences.length === 0}
                      >
                        <SelectTrigger className="md:w-72">
                          <SelectValue placeholder="Select an audience" />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          {availableAudiences.map((audience) => (
                            <SelectItem key={audience.id || audience.Uid} value={String(audience.id || audience.Uid)}>
                              {audience.name || audience.Name || audience.id || audience.Uid}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" onClick={addAudience} disabled={!selectedAudienceId}>
                        Add audience
                      </Button>
                          </div>
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500">Select an audience from the list to associate it with this deal.</p>
                        </div>
                      </div>
                </>
              )}
                    </CardContent>
                  </Card>
                )}

        {activeSection === 'notes' && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <FileText className="w-5 h-5" />
                Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-600">
              <h4 className="text-base font-semibold text-slate-700">Internal notes</h4>
              <Textarea
                id="deal-notes"
                value={dealData.Comments || ''}
                onChange={(e) => updateDealData('Comments', e.target.value)}
                placeholder="Add internal context or comments about this deal"
                rows={8}
              />
                    </CardContent>
                  </Card>
                )}
              </>
    </EntityEditorLayout>
  );
};

export default EditDeal;