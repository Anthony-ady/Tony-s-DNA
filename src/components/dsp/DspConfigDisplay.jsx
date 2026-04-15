
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Edit3, Check, X, Zap, Hash, Tag, Power, Loader2, Globe, Network, Bug, Gauge, ShieldCheck, Target, MapPin, Monitor, Smartphone, Tablet, AppWindow, Plus, FileCode, Trash2, Link2, Package, PlusCircle, MinusCircle, Code, FileJson, Settings, AlertCircle, List, UserX, UserCheck, Type, ToggleLeft, ToggleRight, Info, HardDrive, Cpu, CircleDollarSign, ScanLine, Maximize, Route, SlidersHorizontal, GitBranch, Scan, Shield, LayoutTemplate } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CollapsibleBadgeList from '@/components/shared/CollapsibleBadgeList';
import TargetingRuleForm from './TargetingRuleForm';
import { toggleChipClassName } from '@/lib/toggleChip';

const endpointMapping = {
    EUR: "EMEA",
    NORTH_AMERICA: "US EAST",
    NW_AMERICA: "US WEST"
};
const displayRegions = ['EUR', 'NORTH_AMERICA', 'NW_AMERICA']; // Ordre d'affichage stable

const qpsMapping = {
    "gcp-europe-west9": "EMEA",
    "gcp-us-east4": "US EAST",
    "gcp-us-west1": "US WEST"
};

const kindMapping = {
    "AD_TRAFFIC": "Native Display",
    "AD_VIDEO": "Native Video",
    "AD_OUTSTREAM": "Outstream",
    "AD_INSTREAM": "Instream",
    "AD_BANNER": "Banner"
};

const ALL_DEVICES = ["DESKTOP", "TABLET", "MOBILE"];

const deviceIcons = {
    "DESKTOP": <Monitor className="w-3.5 h-3.5 mr-1.5" />,
    "TABLET": <Tablet className="w-3.5 h-3.5 mr-1.5" />,
    "MOBILE": <Smartphone className="w-3.5 h-3.5 mr-1.5" />
};

// --- Helper Components ---

const EditableField = ({ label, value, onSave, icon, isSaving: isParentSaving }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedValue, setEditedValue] = useState(value || '');
    const [isSavingLocal, setIsSavingLocal] = useState(false);
    const inputRef = useRef(null);
    const cancelNextBlur = useRef(false);

    useEffect(() => {
        setEditedValue(value || '');
    }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = async () => {
        if (!editedValue.trim() || isSavingLocal) {
            setIsEditing(false);
            return;
        }
        setIsSavingLocal(true);
        try {
            await onSave(editedValue.trim());
            setIsEditing(false);
        } catch (error) {
            console.error(`Error while saving ${label}:`, error);
        } finally {
            setIsSavingLocal(false);
        }
    };

    const handleCancel = () => {
        setEditedValue(value || '');
        setIsEditing(false);
        cancelNextBlur.current = false;
    };

    const handleBlur = () => {
        if (cancelNextBlur.current) {
            cancelNextBlur.current = false;
            return;
        }
        handleSave();
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleSave();
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            cancelNextBlur.current = true;
            handleCancel();
        }
    };

    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200">
            <div className="flex items-center gap-3">
                {icon && React.cloneElement(icon, { className: "w-5 h-5 text-slate-500" })}
                <span className="font-semibold text-slate-700 text-xs">{label}</span>
            </div>
            {isEditing ? (
                <div className="mt-2 sm:mt-0 flex items-center gap-2">
                    <Input
                        ref={inputRef}
                        value={editedValue}
                        onChange={(e) => setEditedValue(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        className="text-xs"
                        placeholder={label}
                        disabled={isSavingLocal}
                    />
                    <Button
                        size="sm"
                        variant="outline"
                        onMouseDown={() => { cancelNextBlur.current = true; }}
                        onClick={handleCancel}
                        disabled={isSavingLocal}
                        className="text-slate-500"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            ) : (
                <div className="mt-2 sm:mt-0 flex items-center gap-2">
                    <span className="text-xs text-slate-700">{value}</span>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)} className="text-slate-500 hover:text-slate-700" disabled={isParentSaving}><Edit3 className="w-4 h-4" /></Button>
                </div>
            )}
        </div>
    );
};

const EditableSelect = ({ label, value, options, onSave, icon, isSaving: isParentSaving }) => {
    const [isSavingLocal, setIsSavingLocal] = useState(false);

    const handleValueChange = async (newValue) => {
        if (newValue === value || isSavingLocal) return;
        setIsSavingLocal(true);
        try {
            await onSave(newValue);
        } catch (error) {
            console.error(`Error while saving ${label}:`, error);
        } finally {
            setIsSavingLocal(false);
        }
    };

    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200">
            <div className="flex items-center gap-3">
                {icon && React.cloneElement(icon, { className: "w-5 h-5 text-slate-500" })}
                <span className="font-semibold text-slate-700 text-xs">{label}</span>
            </div>
            <div className="mt-2 sm:mt-0 flex items-center gap-2">
                <Select value={value} onValueChange={handleValueChange} disabled={isSavingLocal || isParentSaving}>
                    <SelectTrigger className="w-[180px] h-9">
                        <SelectValue placeholder={label} />
                    </SelectTrigger>
                    <SelectContent>
                        {options.map(option => (
                            <SelectItem key={option} value={option}>{(() => { const m = option.match(/(\d+)[_.](\d+)$/); return m ? `OpenRTB ${m[1]}.${m[2]}` : option; })()}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {isSavingLocal && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
        </div>
    );
};

const EditableSwitch = ({ label, description, value, onSave, icon, isSaving: isParentSaving }) => {
    const [isSavingLocal, setIsSavingLocal] = useState(false);

    const handleToggle = async (newValue) => {
        if (isSavingLocal) return;
        setIsSavingLocal(true);
        try {
            await onSave(newValue);
        } catch (error) {
            console.error(`Error updating ${label}:`, error);
        } finally {
            setIsSavingLocal(false);
        }
    };

    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200">
            <div className="flex items-center gap-3">
                {icon && React.cloneElement(icon, { className: "w-5 h-5 text-slate-500" })}
                <div className="flex flex-col">
                    <span className="font-semibold text-slate-700 text-xs">{label}</span>
                    {description && <span className="text-xs text-slate-500">{description}</span>}
                </div>
            </div>
            <div className="mt-2 sm:mt-0 flex items-center gap-3">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${value ? 'bg-green-100' : 'bg-red-100'}`}>
                    <Switch
                        checked={value}
                        onCheckedChange={handleToggle}
                        disabled={isSavingLocal || isParentSaving}
                        className={`${value ? 'data-[state=checked]:bg-green-600' : 'data-[state=unchecked]:bg-red-500'}`}
                    />
                    <span className={`text-xs font-semibold ${value ? 'text-green-800' : 'text-red-800'}`}>
                        {value ? 'ON' : 'OFF'}
                    </span>
                </div>
                {isSavingLocal && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
        </div>
    );
};

const EditableToggle = ({ label, value, onSave, icon, isSaving: isParentSaving, activeValue, inactiveValue }) => {
    const [isSavingLocal, setIsSavingLocal] = useState(false);
    const isActive = value === activeValue;

    const handleToggle = async () => {
        if (isSavingLocal) return;
        setIsSavingLocal(true);
        try {
            const newValue = isActive ? inactiveValue : activeValue;
            await onSave(newValue);
        } catch (error) {
            console.error(`Error updating ${label}:`, error);
        } finally {
            setIsSavingLocal(false);
        }
    };

    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200">
            <div className="flex items-center gap-3">
                {icon && React.cloneElement(icon, { className: "w-5 h-5 text-slate-500" })}
                <div className="flex flex-col">
                    <span className="font-semibold text-slate-700 text-xs">{label}</span>
                </div>
            </div>
            <div className="mt-2 sm:mt-0 flex items-center gap-3">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${isActive ? 'bg-green-100' : 'bg-red-100'}`}>
                    <Switch
                        checked={isActive}
                        onCheckedChange={handleToggle}
                        disabled={isSavingLocal || isParentSaving}
                        className={`${isActive ? 'data-[state=checked]:bg-green-600' : 'data-[state=unchecked]:bg-red-500'}`}
                    />
                    <span className={`text-xs font-semibold ${isActive ? 'text-green-800' : 'text-red-800'}`}>
                        {isActive ? 'ON' : 'OFF'}
                    </span>
                </div>
                {(isSavingLocal || isParentSaving) && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
        </div>
    );
};

const QpsLimitEditor = ({ label, dc, value, onSave, onRemove, isSaving: isParentSaving, isVisible = true }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedValue, setEditedValue] = useState(value !== undefined ? String(value) : '');
    const [isSavingLocal, setIsSavingLocal] = useState(false);
    const inputRef = useRef(null);
    const cancelNextBlur = useRef(false);

    useEffect(() => {
        setEditedValue(value !== undefined ? String(value) : '');
    }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleQpsChange = (val) => {
        if (/^\d*$/.test(val) || val === '') {
            setEditedValue(val);
        }
    };

    const handleSave = async () => {
        const numericValue = editedValue.trim() === '' ? null : parseInt(editedValue, 10);

        if (editedValue.trim() !== '' && (isNaN(numericValue) || numericValue < 0)) {
            return;
        }

        setIsSavingLocal(true);
        try {
            await onSave({ [dc]: numericValue });
            setIsEditing(false);
        } catch (error) {
            console.error('Error saving QPS limit:', error);
        } finally {
            setIsSavingLocal(false);
        }
    };

    const handleCancel = () => {
        setEditedValue(value !== undefined ? String(value) : '');
        setIsEditing(false);
        cancelNextBlur.current = false;
    };

    const handleBlur = () => {
        if (cancelNextBlur.current) {
            cancelNextBlur.current = false;
            return;
        }
        handleSave();
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleSave();
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            cancelNextBlur.current = true;
            handleCancel();
        }
    };

    const handleRemove = async () => {
        setIsSavingLocal(true);
        try {
            await onRemove(dc);
        } catch (error) {
            console.error('Error removing QPS limit:', error);
        } finally {
            setIsSavingLocal(false);
        }
    };

    // Si le champ n'est pas visible, ne rien afficher
    if (!isVisible) {
        return null;
    }

    return (
        <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-slate-700 text-xs">{label}</span>
                <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={handleRemove} className="text-red-500 hover:text-red-700 hover:bg-red-50" disabled={isParentSaving || isSavingLocal} title="Remove QPS Limit">
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>
            {isEditing ? (
                <div className="space-y-3">
                    <Input
                        ref={inputRef}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={editedValue || ''}
                        onChange={(e) => handleQpsChange(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        className="text-xs font-mono"
                        placeholder="QPS Limit"
                        disabled={isSavingLocal}
                    />
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onMouseDown={() => { cancelNextBlur.current = true; }}
                            onClick={handleCancel}
                            disabled={isSavingLocal}
                        >
                            <X className="w-4 h-4 mr-2" />
                            Cancel
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between bg-white border border-slate-200 rounded-md p-3">
                    <code className="text-xs font-mono text-blue-800">{value !== undefined ? <span className="bg-blue-50 px-2 py-1 rounded-md">{value}</span> : <span className="text-slate-400 italic">(Not set)</span>}</code>
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)} className="text-slate-500 hover:text-slate-700" disabled={isParentSaving}>
                        <Edit3 className="w-4 h-4" />
                    </Button>
                </div>
            )}
        </div>
    );
};

const EndpointEditor = ({ code, url, onSave, onRemove, isSaving: isParentSaving, qpsDc, qpsValue, onQpsSave, onQpsRemove }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedUrl, setEditedUrl] = useState(url || '');
    const [isSavingLocal, setIsSavingLocal] = useState(false);
    const [urlError, setUrlError] = useState(null);
    const [showQpsField, setShowQpsField] = useState(qpsValue !== undefined);
    const inputRef = useRef(null);
    const cancelNextBlur = useRef(false);

    useEffect(() => {
        setEditedUrl(url || '');
    }, [url]);

    useEffect(() => {
        setShowQpsField(qpsValue !== undefined);
    }, [qpsValue]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleQpsRemove = async (dc) => {
        setIsSavingLocal(true);
        try {
            await onQpsRemove(dc);
            setShowQpsField(false);
        } catch (error) {
            console.error('Error removing QPS limit:', error);
        } finally {
            setIsSavingLocal(false);
        }
    };

    const handleRestoreQps = () => {
        setShowQpsField(true);
    };

    const handleUrlChange = (value) => {
        setEditedUrl(value);
        if (urlError) setUrlError(null);
    };

    const handleSave = async () => {
        const rawUrl = editedUrl;
        const cleanedUrl = rawUrl.trim().replace(/[\n\r\t]/g, '');

        if (cleanedUrl && !cleanedUrl.startsWith('http://') && !cleanedUrl.startsWith('https://')) {
            setUrlError('URL must start with http:// or https://');
            return;
        }

        if (!cleanedUrl && rawUrl.trim() !== '') {
            setUrlError('URL cannot be empty or only whitespace.');
            return;
        }

        setIsSavingLocal(true);
        try {
            await onSave(code, cleanedUrl);
            setIsEditing(false);
            setUrlError(null);
        } catch (error) {
            console.error('Error saving endpoint:', error);
        } finally {
            setIsSavingLocal(false);
        }
    };

    const handleCancel = () => {
        setEditedUrl(url || '');
        setIsEditing(false);
        setUrlError(null);
        cancelNextBlur.current = false;
    };

    const handleBlur = () => {
        if (cancelNextBlur.current) {
            cancelNextBlur.current = false;
            return;
        }
        handleSave();
    };

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            handleSave();
        }
        if (event.key === 'Escape') {
            event.preventDefault();
            cancelNextBlur.current = true;
            handleCancel();
        }
    };

    const handleRemove = async () => {
        if (!url) return; // Can't remove if no URL is set
        
        setIsSavingLocal(true);
        try {
            await onRemove(code);
        } catch (error) {
            console.error('Error removing endpoint:', error);
        } finally {
            setIsSavingLocal(false);
        }
    };

    const regionName = endpointMapping[code];

    return (
        <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-slate-700 text-xs">{regionName}</span>
            </div>
            
            <div className="space-y-3">
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs font-medium text-slate-600">URL</Label>
                        <div className="flex gap-2">
                            {!isEditing && url && (
                                <Button size="sm" variant="ghost" onClick={handleRemove} className="text-red-500 hover:text-red-700 hover:bg-red-50" disabled={isParentSaving || isSavingLocal}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            )}
                            {!isEditing && (
                                <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)} className="text-slate-500 hover:text-slate-700" disabled={isParentSaving}>
                                    <Edit3 className="w-4 h-4 mr-1" />
                                    {url ? 'Edit' : 'Add'}
                                </Button>
                            )}
                        </div>
                    </div>
                    {isEditing ? (
                        <div className="space-y-3">
                            <Textarea
                                ref={inputRef}
                                value={editedUrl || ''}
                                onChange={(e) => handleUrlChange(e.target.value)}
                                onBlur={handleBlur}
                                onKeyDown={handleKeyDown}
                                className={`text-xs font-mono resize-none ${urlError ? 'border-red-500 focus:ring-red-500' : ''}`}
                                rows={3}
                                placeholder={`URL for ${regionName}`}
                                disabled={isSavingLocal}
                            />
                            {urlError && (
                                <p className="text-xs text-red-600 font-medium">{urlError}</p>
                            )}
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onMouseDown={() => { cancelNextBlur.current = true; }}
                                    onClick={handleCancel}
                                    disabled={isSavingLocal}
                                >
                                    <X className="w-4 h-4 mr-2" />
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white border border-slate-200 rounded-md p-3 min-h-[50px] flex items-center">
                            <code className="text-xs font-mono text-slate-700 break-all">{url || <span className="text-slate-400 italic">(Not set)</span>}</code>
                        </div>
                    )}
                </div>
                
                {qpsDc && (
                    <div>
                        {showQpsField ? (
                            <QpsLimitEditor 
                                label="QPS Limit" 
                                dc={qpsDc} 
                                value={qpsValue} 
                                onSave={onQpsSave} 
                                onRemove={handleQpsRemove}
                                isSaving={isParentSaving || isSavingLocal}
                                isVisible={true}
                            />
                        ) : (
                            <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200">
                                <div className="flex items-center justify-between">
                                    <span className="font-semibold text-slate-700 text-xs">QPS Limit</span>
                                    <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        onClick={handleRestoreQps} 
                                        className="text-green-600 hover:text-green-700 hover:bg-green-50" 
                                        disabled={isParentSaving || isSavingLocal}
                                        title="Restore QPS Limit Field"
                                    >
                                        <Plus className="w-4 h-4 mr-1" />
                                        Restore
                                    </Button>
                                </div>
                                <div className="mt-2 text-xs text-slate-500 italic">
                                    QPS Limit field has been removed. Click "Restore" to add it back.
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const TargetingRule = ({
    rule, onUpdateUserSyncedOnly, onUpdateTargetingDevices, onUpdateTargetingCountries,
    onUpdateTargetingSiteDomains, onUpdateTargetingAppBundles, onUpdateConnectorContent,
    onRemoveTargetingRule, onUpdateTargetingCountriesExclusion, onUpdateTargetingSiteDomainsExclusion,
    onUpdateTargetingAppBundlesExclusion, onUpdateTargetingDealsOnly, connectorContents, isSaving: isParentSaving,
    cnc_deserializer, cnc_serializer, onSaveCncDeserializer, onSaveCncSerializer,
}) => {
    // Local states for editing specific lists within this rule
    const [editingCountries, setEditingCountries] = useState(false);
    const [newCountryInput, setNewCountryInput] = useState('');
    const [editingSiteDomains, setEditingSiteDomains] = useState(false);
    const [newSiteDomainInput, setNewSiteDomainInput] = useState('');
    const [editingAppBundles, setEditingAppBundles] = useState(false);
    const [newAppBundleInput, setNewAppBundleInput] = useState('');

    const [editingCountriesExclusion, setEditingCountriesExclusion] = useState(false);
    const [newCountryExclusionInput, setNewCountryExclusionInput] = useState('');
    const [editingSiteDomainsExclusion, setEditingSiteDomainsExclusion] = useState(false);
    const [newSiteDomainExclusionInput, setNewSiteDomainExclusionInput] = useState('');
    const [editingAppBundlesExclusion, setEditingAppBundlesExclusion] = useState(false);
    const [newAppBundleExclusionInput, setNewAppBundleExclusionInput] = useState('');

    const [editingContent, setEditingContent] = useState(false);
    const [editedContent, setEditedContent] = useState(connectorContents?.[rule.kind]?.[0] || '');
    const [nativeSerializationOpen, setNativeSerializationOpen] = useState(false);

    const content = connectorContents?.[rule.kind]?.[0];
    const isEditableContent = rule.kind === 'AD_TRAFFIC' || rule.kind === 'AD_VIDEO';

    const handleAddCountry = async () => {
        if (!newCountryInput.trim()) return;
        
        const countriesToAdd = newCountryInput.split(',').map(c => c.trim().toUpperCase()).filter(c => c && /^[A-Z]{3}$/.test(c));
        if (countriesToAdd.length === 0) { setNewCountryInput(''); return; }

        const currentCountries = rule.config.CountriesInclusion || [];
        const uniqueNewCountries = countriesToAdd.filter(c => !currentCountries.includes(c));
        if (uniqueNewCountries.length === 0) { setNewCountryInput(''); return; }
        await onUpdateTargetingCountries(rule.uid, [...currentCountries, ...uniqueNewCountries]);
     
       setNewCountryInput('');
        setEditingCountries(false);
    };

    const handleAddSiteDomain = async () => {
        if (!newSiteDomainInput.trim()) return;
        const domainsToAdd = newSiteDomainInput.split(',').map(d => d.trim().toLowerCase()).filter(d => d && d.includes('.'));
        if (domainsToAdd.length === 0) { setNewSiteDomainInput(''); return; }
        const currentDomains = rule.config.SiteDomainsInclusion || [];
        const uniqueNewDomains = domainsToAdd.filter(d => !currentDomains.includes(d));
        if (uniqueNewDomains.length === 0) { setNewSiteDomainInput(''); return; }
        await onUpdateTargetingSiteDomains(rule.uid, [...currentDomains, ...uniqueNewDomains]);
        setNewSiteDomainInput('');
        setEditingSiteDomains(false);
    };

    const handleAddAppBundle = async () => {
        if (!newAppBundleInput.trim()) return;
        const bundlesToAdd = newAppBundleInput.split(',').map(b => b.trim()).filter(b => b);
        if (bundlesToAdd.length === 0) { setNewAppBundleInput(''); return; }
        const currentBundles = rule.config.AppBundleIdsInclusion || [];
        const uniqueNewBundles = bundlesToAdd.filter(b => !currentBundles.includes(b));
        if (uniqueNewBundles.length === 0) { setNewAppBundleInput(''); return; }
        await onUpdateTargetingAppBundles(rule.uid, [...currentBundles, ...uniqueNewBundles]);
        setNewAppBundleInput('');
        setEditingAppBundles(false);
    };

    const handleAddCountryExclusion = async () => {
        if (!newCountryExclusionInput.trim()) return;
       const countriesToAdd = newCountryExclusionInput.split(',').map(c => c.trim().toUpperCase()).filter(c => c && /^[A-Z]{3}$/.test(c));
        if (countriesToAdd.length === 0) { setNewCountryExclusionInput(''); return; }
        const currentCountries = rule.config.CountriesExclusion || [];
        const uniqueNewCountries = countriesToAdd.filter(c => !currentCountries.includes(c));
        if (uniqueNewCountries.length === 0) { setNewCountryExclusionInput(''); return; }
        await onUpdateTargetingCountriesExclusion(rule.uid, [...currentCountries, ...uniqueNewCountries]);
        setNewCountryExclusionInput('');
        setEditingCountriesExclusion(false);
    };

    const handleAddSiteDomainExclusion = async () => {
        if (!newSiteDomainExclusionInput.trim()) return;
        const domainsToAdd = newSiteDomainExclusionInput.split(',').map(d => d.trim().toLowerCase()).filter(d => d && d.includes('.'));
        if (domainsToAdd.length === 0) { setNewSiteDomainExclusionInput(''); return; }
        const currentDomains = rule.config.SiteDomainsExclusion || [];
        const uniqueNewDomains = domainsToAdd.filter(d => !currentDomains.includes(d));
        if (uniqueNewDomains.length === 0) { setNewSiteDomainExclusionInput(''); return; }
        await onUpdateTargetingSiteDomainsExclusion(rule.uid, [...currentDomains, ...uniqueNewDomains]);
        setNewSiteDomainExclusionInput('');
        setEditingSiteDomainsExclusion(false);
    };

    const handleAddAppBundleExclusion = async () => {
        if (!newAppBundleExclusionInput.trim()) return;
        const bundlesToAdd = newAppBundleExclusionInput.split(',').map(b => b.trim()).filter(b => b);
        if (bundlesToAdd.length === 0) { setNewAppBundleExclusionInput(''); return; }
        const currentBundles = rule.config.AppBundleIdsExclusion || [];
        const uniqueNewBundles = bundlesToAdd.filter(b => !currentBundles.includes(b));
        if (uniqueNewBundles.length === 0) { setNewAppBundleExclusionInput(''); return; }
        await onUpdateTargetingAppBundlesExclusion(rule.uid, [...currentBundles, ...uniqueNewBundles]);
        setNewAppBundleExclusionInput('');
        setEditingAppBundlesExclusion(false);
    };

    const handleSaveContent = async () => {
        if (!editedContent) return;
        await onUpdateConnectorContent(rule.kind, editedContent);
        setEditingContent(false);
    };

    const handleCancelContent = () => {
        setEditedContent(content);
        setEditingContent(false);
    };

    const handleRemoveCountry = useCallback((countryToRemove) => onUpdateTargetingCountries(rule.uid, rule.config.CountriesInclusion.filter(c => c !== countryToRemove)), [rule.uid, rule.config.CountriesInclusion, onUpdateTargetingCountries]);
    const handleRemoveSiteDomain = useCallback((domainToRemove) => onUpdateTargetingSiteDomains(rule.uid, rule.config.SiteDomainsInclusion.filter(d => d !== domainToRemove)), [rule.uid, rule.config.SiteDomainsInclusion, onUpdateTargetingSiteDomains]);
    const handleRemoveAppBundle = useCallback((bundleToRemove) => onUpdateTargetingAppBundles(rule.uid, rule.config.AppBundleIdsInclusion.filter(b => b !== bundleToRemove)), [rule.uid, rule.config.AppBundleIdsInclusion, onUpdateTargetingAppBundles]);
    const handleRemoveCountryExclusion = useCallback((countryToRemove) => onUpdateTargetingCountriesExclusion(rule.uid, rule.config.CountriesExclusion.filter(c => c !== countryToRemove)), [rule.uid, rule.config.CountriesExclusion, onUpdateTargetingCountriesExclusion]);
    const handleRemoveSiteDomainExclusion = useCallback((domainToRemove) => onUpdateTargetingSiteDomainsExclusion(rule.uid, rule.config.SiteDomainsExclusion.filter(d => d !== domainToRemove)), [rule.uid, rule.config.SiteDomainsExclusion, onUpdateTargetingSiteDomainsExclusion]);
    const handleRemoveAppBundleExclusion = useCallback((bundleToRemove) => onUpdateTargetingAppBundlesExclusion(rule.uid, rule.config.AppBundleIdsExclusion.filter(b => b !== bundleToRemove)), [rule.uid, rule.config.AppBundleIdsExclusion, onUpdateTargetingAppBundlesExclusion]);

    // Clear all functions
    const handleClearAllCountries = useCallback(() => onUpdateTargetingCountries(rule.uid, []), [rule.uid, onUpdateTargetingCountries]);
    const handleClearAllCountriesExclusion = useCallback(() => onUpdateTargetingCountriesExclusion(rule.uid, []), [rule.uid, onUpdateTargetingCountriesExclusion]);
    const handleClearAllSiteDomains = useCallback(() => onUpdateTargetingSiteDomains(rule.uid, []), [rule.uid, onUpdateTargetingSiteDomains]);
    const handleClearAllSiteDomainsExclusion = useCallback(() => onUpdateTargetingSiteDomainsExclusion(rule.uid, []), [rule.uid, onUpdateTargetingSiteDomainsExclusion]);
    const handleClearAllAppBundles = useCallback(() => onUpdateTargetingAppBundles(rule.uid, []), [rule.uid, onUpdateTargetingAppBundles]);
    const handleClearAllAppBundlesExclusion = useCallback(() => onUpdateTargetingAppBundlesExclusion(rule.uid, []), [rule.uid, onUpdateTargetingAppBundlesExclusion]);


    return (
        <div className="p-4 bg-slate-50/70 rounded-lg border border-slate-200">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h4 className="font-semibold text-md text-indigo-700">{kindMapping[rule.kind] || rule.kind}</h4>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge
                            variant="outline"
                            className={`font-medium text-xs ${
                                rule.traffic_type === 'SITE'
                                    ? 'bg-sky-100 text-sky-800 border-sky-200'
                                    : 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200'
                            }`}
                        >
                            {rule.traffic_type === 'SITE' ? <Globe className="w-3 h-3 mr-1.5" /> : <AppWindow className="w-3 h-3 mr-1.5" />}
                            {rule.traffic_type}
                        </Badge>
                        {content && rule.kind !== 'AD_BANNER' && (
                            editingContent ? (
                                <div className="flex items-center gap-2">
                                    <Select value={editedContent} onValueChange={setEditedContent} disabled={isParentSaving}>
                                        <SelectTrigger className="h-7 text-xs w-[130px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="NATIVE_1_1">Native 1.1</SelectItem>
                                            <SelectItem value="NATIVE_1_2">Native 1.2</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button size="icon" className="h-7 w-7 bg-[rgb(75,99,226)] hover:bg-[rgb(60,80,200)]" onClick={handleSaveContent} disabled={isParentSaving}>
                                        <Check className="w-3.5 h-3.5 text-white" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancelContent} disabled={isParentSaving}><X className="w-3.5 h-3.5" /></Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1">
                                    <Badge variant="secondary" className="font-mono text-xs bg-purple-100 text-purple-800 border-purple-200">
                                        <FileCode className="w-3 h-3 mr-1.5" />
                                        {content.replace('NATIVE_', 'Native ').replace('_', '.')}
                                    </Badge>
                                    {isEditableContent && (
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-6 w-6 text-slate-500 hover:text-slate-700"
                                            onClick={() => setEditingContent(true)}
                                            disabled={isParentSaving}
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                        </Button>
                                    )}
                                </div>
                            )
                        )}
                    </div>

                    <div className="mt-3">
                        <Label className="flex items-center gap-2 text-xs font-medium text-slate-600 mb-2">
                            Devices
                            {isParentSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                        </Label>
                        <div className="flex flex-wrap gap-1.5">
                            {ALL_DEVICES.map(device => {
                                const isActive = rule.config.Devices?.includes(device);
                                return (
                                    <button
                                        key={device}
                                        type="button"
                                        onClick={() => onUpdateTargetingDevices(rule.uid, [...(rule.config.Devices || []).filter(d => d !== device), ...(isActive ? [] : [device])])}
                                        disabled={isParentSaving}
                                        className={toggleChipClassName(isActive, `text-xs font-semibold ${isParentSaving ? 'opacity-50 cursor-not-allowed' : ''}`)}
                                    >
                                        {deviceIcons[device] || null}
                                        {device}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onRemoveTargetingRule(rule.uid)}
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                        disabled={isParentSaving}
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6 text-xs">
                <div>
                    {/* Countries Inclusion */}
                    <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                            <PlusCircle className="w-3.5 h-3.5 text-green-600" />
                            Countries Inclusion
                            {isParentSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                        </Label>
                        <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setEditingCountries(true)} className="text-slate-500 hover:text-slate-700 h-6 px-2" disabled={isParentSaving}><Plus className="w-3 h-3" /></Button>
                            {rule.config.CountriesInclusion && rule.config.CountriesInclusion.length > 0 && (
                                <Button size="sm" variant="ghost" onClick={handleClearAllCountries} className="text-red-500 hover:text-red-700 h-6 px-2" disabled={isParentSaving} title="Clear all countries">
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            )}
                        </div>
                    </div>
                    {editingCountries && (
                        <div className="mb-2 flex gap-2">
                            <Input
                                value={newCountryInput}
                                onChange={(e) => setNewCountryInput(e.target.value.toUpperCase())}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleAddCountry(); }}
                                placeholder="FRA, ITA..."
                                className="text-xs font-mono h-8"
                                disabled={isParentSaving}
                            />
                            <Button
                                size="sm"
                                onClick={handleAddCountry}
                                disabled={!newCountryInput.trim() || isParentSaving || !newCountryInput.split(',').some(c => /^[A-Z]{3}$/.test(c.trim()))}
                                className="bg-[rgb(75,99,226)] hover:bg-[rgb(60,80,200)] h-8 px-3 text-white"
                            >
                                <Plus className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setEditingCountries(false); setNewCountryInput(''); }} className="h-8 px-3" disabled={isParentSaving}><X className="w-3 h-3" /></Button>
                        </div>
                    )}
                    <CollapsibleBadgeList items={rule.config.CountriesInclusion} onRemove={handleRemoveCountry} icon={MapPin} isSaving={isParentSaving} inclusionType="inclusion" />

                    {/* Countries Exclusion */}
                    <div className="flex items-center justify-between mt-4 mb-2">
                        <Label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                            <MinusCircle className="w-3.5 h-3.5 text-red-600" />
                            Countries Exclusion
                            {isParentSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                        </Label>
                        <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setEditingCountriesExclusion(true)} className="text-slate-500 hover:text-slate-700 h-6 px-2" disabled={isParentSaving}><Plus className="w-3 h-3" /></Button>
                            {rule.config.CountriesExclusion && rule.config.CountriesExclusion.length > 0 && (
                                <Button size="sm" variant="ghost" onClick={handleClearAllCountriesExclusion} className="text-red-500 hover:text-red-700 h-6 px-2" disabled={isParentSaving} title="Clear all countries">
                                    <Trash2 className="w-3 h-3" />
                                </Button>
                            )}
                        </div>
                    </div>
                    {editingCountriesExclusion && (
                        <div className="mb-2 flex gap-2">
                            <Input
                                value={newCountryExclusionInput}
                                onChange={(e) => setNewCountryExclusionInput(e.target.value.toUpperCase())}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleAddCountryExclusion(); if (e.key === 'Escape') { setEditingCountriesExclusion(false); setNewCountryExclusionInput(''); }}}
                                placeholder="USA, GBR..."
                                className="text-xs font-mono h-8"
                                disabled={isParentSaving}
                            />
                            <Button
                                size="sm"
                                onClick={handleAddCountryExclusion}
                                disabled={!newCountryExclusionInput.trim() || isParentSaving || !newCountryExclusionInput.split(',').some(c => /^[A-Z]{3}$/.test(c.trim()))}
                                className="bg-[rgb(75,99,226)] hover:bg-[rgb(60,80,200)] h-8 px-3 text-white"
                            >
                                <Plus className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setEditingCountriesExclusion(false); setNewCountryExclusionInput(''); }} className="h-8 px-3" disabled={isParentSaving}><X className="w-3 h-3" /></Button>
                        </div>
                    )}
                    <CollapsibleBadgeList items={rule.config.CountriesExclusion} onRemove={handleRemoveCountryExclusion} icon={MapPin} isSaving={isParentSaving} inclusionType="exclusion" />
                </div>

                {rule.traffic_type === 'SITE' ? (
                    <div>
                        {/* Site Domains Inclusion */}
                        <div className="flex items-center justify-between mb-2">
                            <Label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                                <PlusCircle className="w-3.5 h-3.5 text-green-600" />
                                Site Domains Inclusion
                                {isParentSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                            </Label>
                            <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => setEditingSiteDomains(true)} className="text-slate-500 hover:text-slate-700 h-6 px-2" disabled={isParentSaving}><Plus className="w-3 h-3" /></Button>
                                {rule.config.SiteDomainsInclusion && rule.config.SiteDomainsInclusion.length > 0 && (
                                    <Button size="sm" variant="ghost" onClick={handleClearAllSiteDomains} className="text-red-500 hover:text-red-700 h-6 px-2" disabled={isParentSaving} title="Clear all domains">
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                )}
                            </div>
                        </div>
                        {editingSiteDomains && (
                            <div className="mb-2 flex gap-2">
                                <Input
                                    value={newSiteDomainInput}
                                    onChange={(e) => setNewSiteDomainInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddSiteDomain(); }}
                                    placeholder="example.com, news.org..."
                                    className="text-xs font-mono h-8"
                                    disabled={isParentSaving}
                                />
                                <Button
                                    size="sm"
                                    onClick={handleAddSiteDomain}
                                    disabled={!newSiteDomainInput.trim() || isParentSaving}
                                    className="bg-[rgb(75,99,226)] hover:bg-[rgb(60,80,200)] h-8 px-3 text-white"
                                >
                                    <Plus className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => { setEditingSiteDomains(false); setNewSiteDomainInput(''); }} className="h-8 px-3" disabled={isParentSaving}><X className="w-3 h-3" /></Button>
                            </div>
                        )}
                        <CollapsibleBadgeList items={rule.config.SiteDomainsInclusion} onRemove={handleRemoveSiteDomain} icon={Link2} isSaving={isParentSaving} inclusionType="inclusion" />

                        {/* Site Domains Exclusion */}
                        <div className="flex items-center justify-between mt-4 mb-2">
                            <Label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                                <MinusCircle className="w-3.5 h-3.5 text-red-600" />
                                Site Domains Exclusion
                                {isParentSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                            </Label>
                            <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => setEditingSiteDomainsExclusion(true)} className="text-slate-500 hover:text-slate-700 h-6 px-2" disabled={isParentSaving}><Plus className="w-3 h-3" /></Button>
                                {rule.config.SiteDomainsExclusion && rule.config.SiteDomainsExclusion.length > 0 && (
                                    <Button size="sm" variant="ghost" onClick={handleClearAllSiteDomainsExclusion} className="text-red-500 hover:text-red-700 h-6 px-2" disabled={isParentSaving} title="Clear all domains">
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                )}
                            </div>
                        </div>
                        {editingSiteDomainsExclusion && (
                            <div className="mb-2 flex gap-2">
                                <Input
                                    value={newSiteDomainExclusionInput}
                                    onChange={(e) => setNewSiteDomainExclusionInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddSiteDomainExclusion(); if (e.key === 'Escape') { setEditingSiteDomainsExclusion(false); setNewSiteDomainExclusionInput(''); }}}
                                    placeholder="bad.com, other.net..."
                                    className="text-xs font-mono h-8"
                                    disabled={isParentSaving}
                                />
                                <Button
                                    size="sm"
                                    onClick={handleAddSiteDomainExclusion}
                                    disabled={!newSiteDomainExclusionInput.trim() || isParentSaving}
                                    className="bg-[rgb(75,99,226)] hover:bg-[rgb(60,80,200)] h-8 px-3 text-white"
                                >
                                    <Plus className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => { setEditingSiteDomainsExclusion(false); setNewSiteDomainExclusionInput(''); }} className="h-8 px-3" disabled={isParentSaving}><X className="w-3 h-3" /></Button>
                            </div>
                        )}
                        <CollapsibleBadgeList items={rule.config.SiteDomainsExclusion} onRemove={handleRemoveSiteDomainExclusion} icon={Link2} isSaving={isParentSaving} inclusionType="exclusion" />
                    </div>
                ) : rule.traffic_type === 'APP' ? (
                    <div>
                        {/* App Bundles Inclusion */}
                        <div className="flex items-center justify-between mb-2">
                            <Label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                                <PlusCircle className="w-3.5 h-3.5 text-green-600" />
                                App Bundles Inclusion
                                {isParentSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                            </Label>
                            <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => setEditingAppBundles(true)} className="text-slate-500 hover:text-slate-700 h-6 px-2" disabled={isParentSaving}><Plus className="w-3 h-3" /></Button>
                                {rule.config.AppBundleIdsInclusion && rule.config.AppBundleIdsInclusion.length > 0 && (
                                    <Button size="sm" variant="ghost" onClick={handleClearAllAppBundles} className="text-red-500 hover:text-red-700 h-6 px-2" disabled={isParentSaving} title="Clear all app bundles">
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                )}
                            </div>
                        </div>
                        {editingAppBundles && (
                            <div className="mb-2 flex gap-2">
                                <Input
                                    value={newAppBundleInput}
                                    onChange={(e) => setNewAppBundleInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddAppBundle(); }}
                                    placeholder="com.app, 12345..."
                                    className="text-xs font-mono h-8"
                                    disabled={isParentSaving}
                                />
                                <Button
                                    size="sm"
                                    onClick={handleAddAppBundle}
                                    disabled={!newAppBundleInput.trim() || isParentSaving}
                                    className="bg-[rgb(75,99,226)] hover:bg-[rgb(60,80,200)] h-8 px-3 text-white"
                                >
                                    <Plus className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => { setEditingAppBundles(false); setNewAppBundleInput(''); }} className="h-8 px-3" disabled={isParentSaving}><X className="w-3 h-3" /></Button>
                            </div>
                        )}
                        <CollapsibleBadgeList items={rule.config.AppBundleIdsInclusion} onRemove={handleRemoveAppBundle} icon={Package} isSaving={isParentSaving} inclusionType="inclusion" />

                        {/* App Bundles Exclusion */}
                        <div className="flex items-center justify-between mt-4 mb-2">
                            <Label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                                <MinusCircle className="w-3.5 h-3.5 text-red-600" />
                                App Bundles Exclusion
                                {isParentSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                            </Label>
                            <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => setEditingAppBundlesExclusion(true)} className="text-slate-500 hover:text-slate-700 h-6 px-2" disabled={isParentSaving}><Plus className="w-3 h-3" /></Button>
                                {rule.config.AppBundleIdsExclusion && rule.config.AppBundleIdsExclusion.length > 0 && (
                                    <Button size="sm" variant="ghost" onClick={handleClearAllAppBundlesExclusion} className="text-red-500 hover:text-red-700 h-6 px-2" disabled={isParentSaving} title="Clear all app bundles">
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                )}
                            </div>
                        </div>
                        {editingAppBundlesExclusion && (
                            <div className="mb-2 flex gap-2">
                                <Input
                                    value={newAppBundleExclusionInput}
                                    onChange={(e) => setNewAppBundleExclusionInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddAppBundleExclusion(); if (e.key === 'Escape') { setEditingAppBundlesExclusion(false); setNewAppBundleExclusionInput(''); }}}
                                    placeholder="com.bad.app, 54321..."
                                    className="text-xs font-mono h-8"
                                    disabled={isParentSaving}
                                />
                                <Button
                                    size="sm"
                                    onClick={handleAddAppBundleExclusion}
                                    disabled={!newAppBundleExclusionInput.trim() || isParentSaving}
                                    className="bg-[rgb(75,99,226)] hover:bg-[rgb(60,80,200)] h-8 px-3 text-white"
                                >
                                    <Plus className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => { setEditingAppBundlesExclusion(false); setNewAppBundleExclusionInput(''); }} className="h-8 px-3" disabled={isParentSaving}><X className="w-3 h-3" /></Button>
                            </div>
                        )}
                        <CollapsibleBadgeList items={rule.config.AppBundleIdsExclusion} onRemove={handleRemoveAppBundleExclusion} icon={Package} isSaving={isParentSaving} inclusionType="exclusion" />

                        {/* Site Domains Exclusion (APP traffic) */}
                        <div className="flex items-center justify-between mt-4 mb-2">
                            <Label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                                <MinusCircle className="w-3.5 h-3.5 text-red-600" />
                                Site Domains Exclusion
                                {isParentSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                            </Label>
                            <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => setEditingSiteDomainsExclusion(true)} className="text-slate-500 hover:text-slate-700 h-6 px-2" disabled={isParentSaving}><Plus className="w-3 h-3" /></Button>
                                {rule.config.SiteDomainsExclusion && rule.config.SiteDomainsExclusion.length > 0 && (
                                    <Button size="sm" variant="ghost" onClick={handleClearAllSiteDomainsExclusion} className="text-red-500 hover:text-red-700 h-6 px-2" disabled={isParentSaving} title="Clear all domains">
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                )}
                            </div>
                        </div>
                        {editingSiteDomainsExclusion && (
                            <div className="mb-2 flex gap-2">
                                <Input
                                    value={newSiteDomainExclusionInput}
                                    onChange={(e) => setNewSiteDomainExclusionInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddSiteDomainExclusion(); if (e.key === 'Escape') { setEditingSiteDomainsExclusion(false); setNewSiteDomainExclusionInput(''); }}}
                                    placeholder="bad.com, other.net..."
                                    className="text-xs font-mono h-8"
                                    disabled={isParentSaving}
                                />
                                <Button
                                    size="sm"
                                    onClick={handleAddSiteDomainExclusion}
                                    disabled={!newSiteDomainExclusionInput.trim() || isParentSaving}
                                    className="bg-[rgb(75,99,226)] hover:bg-[rgb(60,80,200)] h-8 px-3 text-white"
                                >
                                    <Plus className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => { setEditingSiteDomainsExclusion(false); setNewSiteDomainExclusionInput(''); }} className="h-8 px-3" disabled={isParentSaving}><X className="w-3 h-3" /></Button>
                            </div>
                        )}
                        <CollapsibleBadgeList items={rule.config.SiteDomainsExclusion} onRemove={handleRemoveSiteDomainExclusion} icon={Link2} isSaving={isParentSaving} inclusionType="exclusion" />
                    </div>
                ) : null}
            </div>

            {/* Native serialization (only for Native Display / Native Video) - dépliable / plié */}
            {(rule.kind === 'AD_TRAFFIC' || rule.kind === 'AD_VIDEO') && onSaveCncDeserializer && onSaveCncSerializer && (
                <Collapsible open={nativeSerializationOpen} onOpenChange={setNativeSerializationOpen} className="mt-4">
                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 overflow-hidden">
                        <CollapsibleTrigger className="flex w-full items-center justify-between p-3 text-left hover:bg-slate-100/80 transition-colors">
                            <span className="font-semibold text-slate-700 text-xs">Native (serialization)</span>
                            {nativeSerializationOpen ? (
                                <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                            ) : (
                                <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                            )}
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="px-3 pb-3 pt-0 space-y-3 border-t border-slate-200">
                                <EditableSelect
                                    label="Deserializer"
                                    value={cnc_deserializer || 'STRING'}
                                    options={[...new Set([cnc_deserializer || 'STRING', 'APPNEXUS', 'STRING', 'OBJECT'].filter(Boolean))]}
                                    onSave={onSaveCncDeserializer}
                                    icon={<LayoutTemplate />}
                                    isSaving={isParentSaving}
                                />
                                <EditableSelect
                                    label="Serializer"
                                    value={cnc_serializer || 'STRING'}
                                    options={[...new Set([cnc_serializer || 'STRING', 'APPNEXUS', 'STRING', 'OBJECT'].filter(Boolean))]}
                                    onSave={onSaveCncSerializer}
                                    icon={<FileCode />}
                                    isSaving={isParentSaving}
                                />
                                <div className="p-3 bg-amber-50/80 rounded-lg border border-amber-200/80">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Info className="w-4 h-4 text-amber-600 shrink-0" />
                                        <span className="font-semibold text-amber-900 text-xs">Native ADM formats</span>
                                    </div>
                                    <p className="text-xs text-amber-800 mb-2">How to read <code className="bg-amber-100 px-1 rounded">bid.adm</code> depending on the format:</p>
                                    <div className="overflow-x-auto">
                                    <table className="w-full text-xs border border-amber-200 rounded overflow-hidden">
                                        <thead>
                                            <tr className="bg-amber-100/80">
                                                <th className="text-left p-2 font-semibold text-amber-900">Format</th>
                                                <th className="text-left p-2 font-semibold text-amber-900">Root of ADM</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white">
                                            <tr className="border-t border-amber-100">
                                                <td className="p-2 font-medium">STRING</td>
                                                <td className="p-2"><code className="text-[10px] bg-slate-100 px-1 rounded">{"{ \"native\": { ... } }"}</code></td>
                                            </tr>
                                            <tr className="border-t border-amber-100">
                                                <td className="p-2 font-medium">OBJECT</td>
                                                <td className="p-2"><code className="text-[10px] bg-slate-100 px-1 rounded">{"{ native: { ... } }"}</code></td>
                                            </tr>
                                            <tr className="border-t border-amber-100">
                                                <td className="p-2 font-medium">APPNEXUS</td>
                                                <td className="p-2"><code className="text-[10px] bg-slate-100 px-1 rounded">{"{ ver, assets, link }"}</code></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    </div>
                                </div>
                            </div>
                        </CollapsibleContent>
                    </div>
                </Collapsible>
            )}

            {/* User Synced Only toggle - bottom left */}
            <div className="flex items-center gap-3 mt-4">
                <Label className="text-xs font-medium text-slate-600">Send only synced users (buyeruid present)</Label>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${rule.config.UserSyncedOnly ? 'bg-green-100' : 'bg-red-100'}`}>
                    <Switch
                        checked={rule.config.UserSyncedOnly}
                        onCheckedChange={() => onUpdateUserSyncedOnly(rule.uid, !rule.config.UserSyncedOnly)}
                        disabled={isParentSaving}
                        className={`${rule.config.UserSyncedOnly ? 'data-[state=checked]:bg-green-600' : 'data-[state=unchecked]:bg-red-500'}`}
                    />
                    <span className={`text-xs font-semibold ${rule.config.UserSyncedOnly ? 'text-green-800' : 'text-red-800'}`}>
                        {rule.config.UserSyncedOnly ? 'ON' : 'OFF'}
                    </span>
                    {isParentSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                </div>
            </div>

            {/* Deals Only toggle */}
            <div className="flex items-center gap-3 mt-3">
                <Label className="text-xs font-medium text-slate-600">Deals only</Label>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${rule.config.DealsOnly ? 'bg-green-100' : 'bg-red-100'}`}>
                    <Switch
                        checked={!!rule.config.DealsOnly}
                        onCheckedChange={() => onUpdateTargetingDealsOnly(rule.uid, !rule.config.DealsOnly)}
                        disabled={isParentSaving}
                        className={`${rule.config.DealsOnly ? 'data-[state=checked]:bg-green-600' : 'data-[state=unchecked]:bg-red-500'}`}
                    />
                    <span className={`text-xs font-semibold ${rule.config.DealsOnly ? 'text-green-800' : 'text-red-800'}`}>
                        {rule.config.DealsOnly ? 'ON' : 'OFF'}
                    </span>
                    {isParentSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                </div>
            </div>
        </div>
    );
};

export default function DspConfigDisplay({
    data,
    onUpdateName,
    onUpdateStatus,
    onUpdateEndpoint,
    onRemoveEndpoint,
    onUpdateDebugMode,
    onUpdateGzipEnabled,
    onUpdateQpsLimit,
    onUpdateSni,
    onUpdateConnectorKind,
    onUpdateUserSyncedOnly,
    onUpdateTargetingDevices,
    onAddNewTargetingRule,
    onUpdateTargetingCountries,
    onUpdateTargetingSiteDomains,
    onUpdateTargetingAppBundles,
    onUpdateConnectorContent,
    onRemoveTargetingRule,
    onUpdateTargetingCountriesExclusion,
    onUpdateTargetingSiteDomainsExclusion,
    onUpdateTargetingAppBundlesExclusion,
    onUpdateTargetingDealsOnly,
    onUpdateCncDeserializer,
    onUpdateCncSerializer,
    visibleSections,
}) {
    const [isSaving, setIsSaving] = useState(false);
    const [showTargetingForm, setShowTargetingForm] = useState(false);

    if (!data) {
        return <p>No data available</p>;
    }

    const {
        uid: Id,
        name,
        status,
        partner_endpoint = [],
        connector_log_level,
        cec_qps_by_dc = {},
        sni,
        connector_kind,
        connector_gzip_enabled,
        partner_targeting = [],
        connector_contents = {},
        cnc_deserializer,
        cnc_serializer,
    } = data;

    const handleSave = async (updateFn, ...args) => {
        setIsSaving(true);
        try {
            await updateFn(...args);
        } catch (error) {
            console.error("Failed to save:", error);
        } finally {
            setIsSaving(false);
        }
    };

    // Get existing rule combinations (kind + traffic_type) to show which ones can be added
    const existingCombinations = partner_targeting?.map(rule => `${rule.kind}_${rule.traffic_type}`) || [];
    const availableCombinations = [];
    
    // Generate all possible combinations
    Object.keys(kindMapping).forEach(kind => {
        ['SITE', 'APP'].forEach(trafficType => {
            const combination = `${kind}_${trafficType}`;
            if (!existingCombinations.includes(combination)) {
                availableCombinations.push({ kind, traffic_type: trafficType });
            }
        });
    });

    const hasAvailableRules = availableCombinations.length > 0;

    const includes = (section) => !visibleSections || visibleSections.includes(section);

    return (
        <Card className="border-slate-200 shadow-lg h-full">
            <CardContent className="pt-4">
                <div className="space-y-6">
                    {/* --- Basic Information Section --- */}
                    {includes('basic') && (
                    <div className="space-y-4" id="basic">
                        <div className="px-1 group flex items-center justify-between">
                            <div className="font-semibold tracking-tight text-sm text-slate-800">Basic info</div>
                            <ChevronRight className={`w-4 h-4 text-blue-700 transition-opacity ${includes('basic') ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                        </div>
                        <div className="space-y-3 pl-2">
                            {Id && (
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200">
                                    <div className="flex items-center gap-3">
                                        <Hash className="w-5 h-5 text-slate-500" />
                                        <span className="font-semibold text-slate-700 text-xs">Partner ID</span>
                                    </div>
                                    <code className="mt-2 sm:mt-0 text-xs font-mono bg-indigo-50 text-indigo-800 px-2 py-1 rounded-md">{Id}</code>
                                </div>
                            )}
                            <EditableField label="Name" value={name} onSave={(val) => handleSave(onUpdateName, val)} icon={<Type />} isSaving={isSaving} />
                            <EditableSelect label="Protocol" value={connector_kind} options={['OPENRTB_2_3', 'OPENRTB_2_5', 'OPENRTB_2_6']} onSave={(val) => handleSave(onUpdateConnectorKind, val)} icon={<Network />} isSaving={isSaving} />
                            <EditableToggle
                                label="GZIP"
                                value={connector_gzip_enabled}
                                onSave={(val) => handleSave(onUpdateGzipEnabled, val)}
                                icon={<Settings />}
                                isSaving={isSaving}
                                activeValue={true}
                                inactiveValue={false}
                            />
                            <EditableToggle 
                                label="Status" 
                                value={status} 
                                onSave={(val) => handleSave(onUpdateStatus, val)} 
                                icon={<Power />} 
                                isSaving={isSaving}
                                activeValue="PRODUCTION"
                                inactiveValue="DISABLED"
                            />
                            <EditableToggle 
                                label="Debug Mode" 
                                value={connector_log_level} 
                                onSave={(val) => handleSave(onUpdateDebugMode, val)} 
                                icon={<Bug />} 
                                isSaving={isSaving}
                                activeValue="VERBOSE"
                                inactiveValue="DISABLED"
                            />
                        </div>
                    </div>
                    )}

                    {includes('basic') && <Separator />}

                    {/* --- Endpoints Section --- */}
                    {includes('endpoints') && (
                    <div className="space-y-4" id="endpoints">
                        <div className="px-1 group flex items-center justify-between">
                            <div className="font-semibold tracking-tight text-sm text-slate-800">Partner Endpoints</div>
                            <ChevronRight className={`w-4 h-4 text-blue-700 transition-opacity ${includes('endpoints') ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                        </div>
                        <div className="space-y-3 pl-2">
                            <EditableSwitch label="HTTPS" description="SNI Enabled" value={sni} onSave={(val) => handleSave(onUpdateSni, val)} icon={<ShieldCheck />} isSaving={isSaving} />
                            {displayRegions.map(regionCode => {
                                const endpoint = partner_endpoint?.find(ep => ep.code === regionCode);
                                const regionName = endpointMapping[regionCode];
                                const dcKey = Object.keys(qpsMapping).find(key => qpsMapping[key] === regionName);

                                return (
                                    <div key={regionCode}>
                                        <EndpointEditor 
                                            code={regionCode} 
                                            url={endpoint?.url} 
                                            onSave={(code, url) => handleSave(onUpdateEndpoint, code, url)} 
                                            onRemove={(code) => handleSave(onRemoveEndpoint, code)} 
                                            isSaving={isSaving}
                                            qpsDc={dcKey}
                                            qpsValue={cec_qps_by_dc?.[dcKey]}
                                            onQpsSave={(obj) => handleSave(onUpdateQpsLimit, obj)}
                                            onQpsRemove={(dc) => handleSave(onUpdateQpsLimit, { [dc]: null })}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    )}

                    {includes('endpoints') && <Separator />}

                    {/* --- Targeting Rules Section --- */}
                    {includes('targeting') && (
                    <div className="space-y-4" id="targeting">
                        <div className="px-1 group flex items-center justify-between">
                            <div className="font-semibold tracking-tight text-sm text-slate-800">Targeting ({partner_targeting.length || 0})</div>
                            <ChevronRight className={`w-4 h-4 text-blue-700 transition-opacity ${includes('targeting') ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                        </div>
                        <div className="pl-2">
                            {!showTargetingForm && hasAvailableRules && (
                                <Button
                                    size="sm"
                                    onClick={() => setShowTargetingForm(true)}
                                    className="bg-indigo-600 hover:bg-indigo-700"
                                    disabled={isSaving}
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Rule
                                </Button>
                            )}
                        </div>

                        {showTargetingForm && (
                            <TargetingRuleForm
                                onAdd={async (newRuleData) => {
                                    await handleSave(onAddNewTargetingRule, newRuleData);
                                    setShowTargetingForm(false);
                                }}
                                onCancel={() => setShowTargetingForm(false)}
                                isSaving={isSaving}
                                availableCombinations={availableCombinations}
                                cnc_deserializer={cnc_deserializer}
                                cnc_serializer={cnc_serializer}
                                onSaveCncDeserializer={onUpdateCncDeserializer ? (val) => handleSave(onUpdateCncDeserializer, val) : undefined}
                                onSaveCncSerializer={onUpdateCncSerializer ? (val) => handleSave(onUpdateCncSerializer, val) : undefined}
                            />
                        )}

                        <div className="space-y-4 pl-2">
                            {partner_targeting.length > 0 ? (
                                [...partner_targeting].sort((a, b) => {
                                    const trafficTypeCompare = a.traffic_type.localeCompare(b.traffic_type);
                                    if (trafficTypeCompare !== 0) return trafficTypeCompare;
                                    return a.kind.localeCompare(b.kind);
                                }).map((rule) => (
                                    <TargetingRule
                                        key={rule.uid}
                                        rule={rule}
                                        onUpdateUserSyncedOnly={(ruleUid, value) => handleSave(onUpdateUserSyncedOnly, ruleUid, value)}
                                        onUpdateTargetingDevices={(ruleUid, devices) => handleSave(onUpdateTargetingDevices, ruleUid, devices)}
                                        onUpdateTargetingCountries={(ruleUid, countries) => handleSave(onUpdateTargetingCountries, ruleUid, countries)}
                                        onUpdateTargetingSiteDomains={(ruleUid, domains) => handleSave(onUpdateTargetingSiteDomains, ruleUid, domains)}
                                        onUpdateTargetingAppBundles={(ruleUid, bundles) => handleSave(onUpdateTargetingAppBundles, ruleUid, bundles)}
                                        onUpdateConnectorContent={(kind, content) => handleSave(onUpdateConnectorContent, kind, content)}
                                        onRemoveTargetingRule={(ruleUid) => handleSave(onRemoveTargetingRule, ruleUid)}
                                        onUpdateTargetingCountriesExclusion={(ruleUid, countries) => handleSave(onUpdateTargetingCountriesExclusion, ruleUid, countries)}
                                        onUpdateTargetingSiteDomainsExclusion={(ruleUid, domains) => handleSave(onUpdateTargetingSiteDomainsExclusion, ruleUid, domains)}
                                        onUpdateTargetingAppBundlesExclusion={(ruleUid, bundles) => handleSave(onUpdateTargetingAppBundlesExclusion, ruleUid, bundles)}
                                        onUpdateTargetingDealsOnly={(ruleUid, value) => handleSave(onUpdateTargetingDealsOnly, ruleUid, value)}
                                        connectorContents={connector_contents}
                                        isSaving={isSaving}
                                        cnc_deserializer={cnc_deserializer}
                                        cnc_serializer={cnc_serializer}
                                        onSaveCncDeserializer={onUpdateCncDeserializer ? (val) => handleSave(onUpdateCncDeserializer, val) : undefined}
                                        onSaveCncSerializer={onUpdateCncSerializer ? (val) => handleSave(onUpdateCncSerializer, val) : undefined}
                                    />
                                ))
                            ) : (
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <p className="text-xs text-slate-500 text-center">No targeting rules configured</p>
                                </div>
                            )}
                        </div>
                    </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
