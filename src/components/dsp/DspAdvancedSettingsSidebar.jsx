
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Edit3, Check, X, Loader2, GitBranch, Code, Scan, Shield, Settings, ChevronRight, Link2, Plus, RefreshCw } from 'lucide-react';
import * as SliderPrimitive from "@radix-ui/react-slider";
import FeesEditor from './FeesEditor';
import { apiUrl, API_ENDPOINTS } from '@/config/api';
import { authService } from '@/services/authService';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserSyncPanel } from '@/pages/UserSync/UserSync';

const EditableField = ({ label, value, onSave, icon, isSaving: isParentSaving }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [currentValue, setCurrentValue] = useState(value);
    const inputRef = useRef(null);
    const cancelNextBlur = useRef(false);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        if (currentValue !== value) {
            onSave(currentValue);
        }
        setIsEditing(false);
        cancelNextBlur.current = false;
    };

    const handleCancel = () => {
        setCurrentValue(value);
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
                {icon}
                <span className="font-semibold text-slate-700 text-sm">{label}</span>
            </div>
            {isEditing ? (
                <div className="mt-2 sm:mt-0 flex items-center gap-2">
                    <Input
                        ref={inputRef}
                        value={currentValue}
                        onChange={(e) => setCurrentValue(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        type="number"
                        className="text-sm w-24"
                        placeholder={label}
                        disabled={isParentSaving}
                    />
                    <Button
                        size="icon"
                        variant="outline"
                        onMouseDown={() => { cancelNextBlur.current = true; }}
                        onClick={handleCancel}
                        disabled={isParentSaving}
                        className="h-8 w-8"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            ) : (
                <div className="mt-2 sm:mt-0 flex items-center gap-2">
                    <span className="text-sm text-slate-700">{value !== undefined ? value : '(not set)'}</span>
                    <Button size="icon" variant="ghost" onClick={() => setIsEditing(true)} className="text-slate-500 hover:text-slate-700 h-8 w-8"><Edit3 className="w-4 h-4" /></Button>
                </div>
            )}
        </div>
    );
};

const EditableSelect = ({ label, value, options, onSave, icon, isSaving: isParentSaving }) => {
    const handleSave = (newValue) => {
        if (newValue !== value) {
            onSave(newValue);
        }
    };

    // Mapping pour l'affichage des valeurs d'enchères
    const displayMapping = {
        'FIRST_PRICE': 'First Price',
        'SECOND_PRICE': 'Second Price'
    };

    const getDisplayValue = (option) => {
        return displayMapping[option] || option.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    };

    return (
        <div className="flex items-center justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200">
            <div className="flex items-center gap-3">
                {icon}
                <span className="font-semibold text-slate-700 text-sm">{label}</span>
            </div>
            <Select value={value || ''} onValueChange={handleSave} disabled={isParentSaving}>
                <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select...">
                        {getDisplayValue(value)}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {options.map(option => (
                        <SelectItem key={option} value={option}>{getDisplayValue(option)}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
};

const EditableNumericSelect = ({ label, value, numericOptions, onSave, icon, isSaving: isParentSaving }) => {
    const handleSave = (newValue) => {
        const numericValue = parseInt(newValue, 10);
        if (numericValue !== value) {
            onSave(numericValue);
        }
    };

    // Gérer le cas où value est undefined ou null
    const currentValue = value !== undefined && value !== null ? value : 0;
    const displayValue = numericOptions[currentValue] || 'UNSET';

    return (
        <div className="flex items-center justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200">
            <div className="flex items-center gap-3">
                {icon}
                <span className="font-semibold text-slate-700 text-sm">{label}</span>
            </div>
            <Select value={String(currentValue)} onValueChange={handleSave} disabled={isParentSaving}>
                <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select...">
                        {displayValue}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {Object.entries(numericOptions).map(([numericValue, displayLabel]) => (
                        <SelectItem key={numericValue} value={String(numericValue)}>{displayLabel}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
};

const isBidRequestOverwriteEmpty = (v) =>
    v === null || v === undefined ||
    (typeof v === 'string' && v.trim() === '') ||
    (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length === 0);

const JsonEditor = ({ label, value, onSave, isSaving: isParentSaving }) => {
    const isEmpty = isBidRequestOverwriteEmpty(value);
    const displayValue = isEmpty ? '' : (typeof value === 'string' ? value : JSON.stringify(value, null, 2));
    const [isEditing, setIsEditing] = useState(false);
    const [currentValue, setCurrentValue] = useState(displayValue);
    const [error, setError] = useState(null);
    const textareaRef = useRef(null);
    const cancelNextBlur = useRef(false);

    // Sync currentValue when value prop changes
    useEffect(() => {
        setCurrentValue(isEmpty ? '' : (typeof value === 'string' ? value : JSON.stringify(value, null, 2)));
    }, [value, isEmpty]);

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [isEditing]);

    const handleSave = () => {
        const trimmed = currentValue.trim();
        // Empty or "null" string = remove overwrite (field will be omitted from payload)
        if (trimmed === '' || trimmed === 'null') {
            setError(null);
            onSave(false, '');
            setIsEditing(false);
            cancelNextBlur.current = false;
            return;
        }
        try {
            JSON.parse(trimmed);
            setError(null);
            onSave(true, trimmed);
            setIsEditing(false);
            cancelNextBlur.current = false;
        } catch (e) {
            setError('Invalid JSON format');
        }
    };

    const handleCancel = () => {
        setCurrentValue(isEmpty ? '' : (typeof value === 'string' ? value : JSON.stringify(value, null, 2)));
        setIsEditing(false);
        setError(null);
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
        if ((event.key === 'Enter' && event.metaKey) || (event.key === 'Enter' && event.ctrlKey)) {
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
        <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200 space-y-2">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <Code className="w-5 h-5 text-slate-500" />
                    <Label className="text-sm font-semibold text-slate-700">{label}</Label>
                </div>
                {!isEditing && (
                    <Button size="sm" variant="ghost" onClick={() => setIsEditing(true)}><Edit3 className="w-4 h-4 text-slate-500" /></Button>
                )}
            </div>
            {isEditing ? (
                <>
                    <Textarea
                        ref={textareaRef}
                        value={currentValue}
                        onChange={(e) => setCurrentValue(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        className="font-mono text-xs h-32"
                    />
                    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                    <div className="flex items-center gap-2">
                        <div className="text-xs text-slate-500">Press Ctrl+Enter to apply. Leave empty to clear the overwrite.</div>
                        <Button
                            size="sm"
                            variant="outline"
                            onMouseDown={() => { cancelNextBlur.current = true; }}
                            onClick={handleCancel}
                            disabled={isParentSaving}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                </>
            ) : (
                <pre className="text-xs bg-slate-100 p-2 rounded max-h-32 overflow-auto"><code>{isEmpty ? '(empty – no overwrite)' : (typeof value === 'string' ? value : JSON.stringify(value, null, 2))}</code></pre>
            )}
        </div>
    );
};

const CreativeScanEditor = ({ value, onSave, isSaving: isParentSaving }) => {
    const [isEnabled, setIsEnabled] = useState(value?.allow_creative_scan || false);
    const [ratio, setRatio] = useState((value?.creative_scan_ratio || 0.0) * 100); // Store as percentage
    const [isEditingRatio, setIsEditingRatio] = useState(false);
    const [ratioInput, setRatioInput] = useState('');

    const handleToggleChange = async (newEnabled) => {
        setIsEnabled(newEnabled);
        // Auto-save when toggling
        await onSave(newEnabled, ratio / 100);
    };

    const handleRatioChange = async (newValue) => {
        const percentageValue = newValue[0];
        setRatio(percentageValue);
        if (isEnabled) {
            // Auto-save when slider changes
            await onSave(isEnabled, percentageValue / 100);
        }
    };

    const handleDecrement = async () => {
        const newValue = Math.max(0, ratio - 0.1);
        setRatio(newValue);
        if (isEnabled) {
            await onSave(isEnabled, newValue / 100);
        }
    };

    const handleIncrement = async () => {
        const newValue = Math.min(100, ratio + 0.1);
        setRatio(newValue);
        if (isEnabled) {
            await onSave(isEnabled, newValue / 100);
        }
    };

    const handleRatioInputChange = (e) => {
        setRatioInput(e.target.value);
    };

    const handleRatioInputBlur = async () => {
        const numValue = parseFloat(ratioInput);
        if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
            setRatio(numValue);
            if (isEnabled) {
                await onSave(isEnabled, numValue / 100);
            }
        } else {
            setRatioInput(ratio.toFixed(1));
        }
        setIsEditingRatio(false);
    };

    const handleRatioInputKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleRatioInputBlur();
        }
        if (e.key === 'Escape') {
            setRatioInput(ratio.toFixed(1));
            setIsEditingRatio(false);
        }
    };

    const startEditingRatio = () => {
        setRatioInput(ratio.toFixed(1));
        setIsEditingRatio(true);
    };

    return (
        <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200 space-y-4">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <Scan className="w-5 h-5 text-slate-500" />
                    <Label className="text-sm font-semibold text-slate-700">Creative Scan</Label>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${isEnabled ? 'bg-green-100' : 'bg-red-100'}`}>
                    <Switch 
                        checked={isEnabled} 
                        onCheckedChange={handleToggleChange} 
                        disabled={isParentSaving}
                        className={`${isEnabled ? 'data-[state=checked]:bg-green-600' : 'data-[state=unchecked]:bg-red-500'}`}
                    />
                    <span className={`text-xs font-semibold ${isEnabled ? 'text-green-800' : 'text-red-800'}`}>
                        {isEnabled ? 'ON' : 'OFF'}
                    </span>
                    {isParentSaving && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                </div>
            </div>
            {isEnabled && (
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={handleDecrement}
                            disabled={isParentSaving || ratio <= 0}
                        >
                            <span className="text-sm">-</span>
                        </Button>
                        <SliderPrimitive.Root
                            value={[ratio]}
                            onValueChange={handleRatioChange}
                            max={100}
                            min={0}
                            step={0.1}
                            disabled={isParentSaving}
                            className="relative flex w-full touch-none select-none items-center flex-1"
                        >
                            <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-slate-200">
                                <SliderPrimitive.Range className="absolute h-full bg-blue-600" />
                            </SliderPrimitive.Track>
                            <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-blue-600 bg-blue-600 shadow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
                        </SliderPrimitive.Root>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={handleIncrement}
                            disabled={isParentSaving || ratio >= 100}
                        >
                            <span className="text-sm">+</span>
                        </Button>
                        {isEditingRatio ? (
                            <Input
                                type="number"
                                step="0.1"
                                min="0"
                                max="100"
                                value={ratioInput}
                                onChange={handleRatioInputChange}
                                onBlur={handleRatioInputBlur}
                                onKeyDown={handleRatioInputKeyDown}
                                className="w-20 text-center font-semibold text-slate-900"
                                autoFocus
                            />
                        ) : (
                            <div 
                                className="bg-white border border-slate-300 rounded px-3 py-1.5 min-w-[60px] text-center font-semibold text-slate-900 cursor-pointer hover:bg-slate-50"
                                onClick={startEditingRatio}
                                title="Click to edit"
                            >
                                {ratio.toFixed(1)}%
                        </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};


const CookieSyncIdsEditor = ({ value, onSave, isSaving: isParentSaving }) => {
    const ids = Array.isArray(value) ? value : [];
    const [names, setNames] = useState({});
    const [loadingNames, setLoadingNames] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [filterQuery, setFilterQuery] = useState('');
    const [modalUid, setModalUid] = useState(null);
    const [modalName, setModalName] = useState('');

    // Fetch name for each existing uid
    const fetchNames = useCallback(async (idList) => {
        if (!idList.length) return;
        const token = authService.getToken();
        if (!token) return;
        setLoadingNames(true);
        const results = {};
        await Promise.all(idList.map(async (id) => {
            try {
                const res = await fetch(apiUrl.cookieSync(id), {
                    headers: { 'x-ayl-auth-token': token, 'Content-Type': 'application/json' }
                });
                if (res.ok) {
                    const data = await res.json();
                    const item = data?.Data ?? data;
                    results[id] = item?.name ?? item?.Name ?? null;
                }
            } catch (_) {}
        }));
        setNames(prev => ({ ...prev, ...results }));
        setLoadingNames(false);
    }, []);

    useEffect(() => { fetchNames(ids); }, [ids.join(',')]);

    // Fetch search results to populate the add dropdown
    const fetchSearch = useCallback(async () => {
        const token = authService.getToken();
        if (!token) return;
        setLoadingSearch(true);
        try {
            const res = await fetch(API_ENDPOINTS.COOKIE_SYNC_SEARCH, {
                method: 'POST',
                headers: { 'x-ayl-auth-token': token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ From: 0, Order: [{ Field: "UpdatedAt", Operator: "desc" }], Size: 500 })
            });
            if (res.ok) {
                const data = await res.json();
                const list = data?.Data ?? data ?? [];
                setSearchResults(Array.isArray(list) ? list : []);
            }
        } catch (_) {}
        setLoadingSearch(false);
    }, []);

    const handleOpenDropdown = () => {
        setShowDropdown(true);
        if (!searchResults.length) fetchSearch();
    };

    const handleAdd = (item) => {
        if (ids.includes(item.uid)) return;
        const next = [...ids, item.uid];
        setNames(prev => ({ ...prev, [item.uid]: item.name }));
        onSave(next);
        setShowDropdown(false);
    };

    const handleRemove = (id) => {
        onSave(ids.filter((i) => i !== id));
    };

    const available = searchResults
        .filter(r => !ids.includes(r.uid))
        .filter(r => !filterQuery || r.name.toLowerCase().includes(filterQuery.toLowerCase()));

    return (
        <>
        <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200 space-y-3">
            <div className="flex items-center gap-3">
                <Link2 className="w-5 h-5 text-slate-500 shrink-0" />
                <Label className="text-sm font-semibold text-slate-700">Cookie Sync IDs</Label>
                {loadingNames && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
            </div>

            {ids.length === 0 ? (
                <span className="text-xs text-slate-500">No IDs configured</span>
            ) : (
                <div className="space-y-1">
                    {ids.map((id) => (
                        <div
                            key={id}
                            className="flex items-center justify-between px-2 py-1.5 rounded bg-white border border-slate-200 cursor-pointer hover:bg-slate-50 hover:border-[rgb(75,99,226)]/40 transition-colors"
                            onClick={() => { setModalUid(id); setModalName(names[id] ?? id); }}
                        >
                            <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-xs font-semibold text-slate-800">{names[id] ?? id}</span>
                                <span className="text-xs font-mono text-slate-400">{id}</span>
                            </div>
                            {!isParentSaving && (
                                <button
                                    type="button"
                                    onClick={e => { e.stopPropagation(); handleRemove(id); }}
                                    className="text-slate-400 hover:text-red-600 p-0.5 shrink-0 ml-2"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {!isParentSaving && (
                <div className="relative">
                    <Button type="button" size="sm" variant="outline" className="w-full" onClick={handleOpenDropdown}>
                        <Plus className="w-4 h-4 mr-1" /> Add cookie sync
                    </Button>
                    {showDropdown && (
                        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 flex flex-col">
                            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 shrink-0">
                                <span className="text-xs font-semibold text-slate-600">Select a partner</span>
                                <button type="button" onClick={() => { setShowDropdown(false); setFilterQuery(''); }} className="text-slate-400 hover:text-slate-600">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <div className="px-2 py-1.5 border-b border-slate-100 shrink-0">
                                <Input
                                    autoFocus
                                    value={filterQuery}
                                    onChange={(e) => setFilterQuery(e.target.value)}
                                    placeholder="Search…"
                                    className="h-7 text-xs"
                                />
                            </div>
                            <div className="overflow-y-auto flex-1">
                            {loadingSearch ? (
                                <div className="flex items-center gap-2 p-3 text-xs text-slate-500">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
                                </div>
                            ) : available.length === 0 ? (
                                <p className="p-3 text-xs text-slate-500">No more partners available</p>
                            ) : (
                                available.map((item) => (
                                    <button
                                        key={item.uid}
                                        type="button"
                                        onClick={() => handleAdd(item)}
                                        className="w-full text-left px-3 py-2 hover:bg-indigo-50 transition-colors"
                                    >
                                        <span className="text-xs font-semibold text-slate-800 block">{item.name}</span>
                                        <span className="text-xs font-mono text-slate-400">{item.uid}</span>
                                    </button>
                                ))
                            )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>

        <Dialog open={!!modalUid} onOpenChange={open => { if (!open) setModalUid(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-slate-800">{modalName}</DialogTitle>
            </DialogHeader>
            {modalUid && <UserSyncPanel uid={modalUid} nameFromUrl={modalName} />}
          </DialogContent>
        </Dialog>
        </>
    );
};

export default function DspAdvancedSettingsSidebar({
    data,
    onUpdateSupplyChainMaxNodes,
    onUpdateRevenueAuctionType,
    onUpdateBidRequestOverwrite,
    onUpdateCreativeScan,
    onUpdateFees,
    onUpdateFraudDetectionLevel,
    onUpdateCookieSyncIds,
    isSaving,
}) {

    if (!data) return null;

    const {
        supply_chain_max_nodes,
        revenue_auction_type,
        allow_bid_request_overwrite,
        bid_request_overwrite,
        allow_creative_scan,
        creative_scan_ratio,
        fraud_detection_filtering_level,
        fees,
        cookie_sync_ids
    } = data;

    const handleSave = async (updateFn, ...args) => {
        try {
            await updateFn(...args);
        } catch (error) {
            console.error("Failed to save:", error);
        }
    };

    return (
        <Card className="border-slate-200 shadow-sm">
            <CardContent className="space-y-4 pt-4">
                <div className="px-1 mb-1 group flex items-center justify-between">
                    <div className="font-semibold tracking-tight text-sm text-slate-800">Advanced Settings</div>
                    <ChevronRight className="w-4 h-4 text-blue-700 opacity-100" />
                </div>
                {onUpdateCookieSyncIds && (
                    <CookieSyncIdsEditor
                        value={cookie_sync_ids}
                        onSave={(ids) => handleSave(onUpdateCookieSyncIds, ids)}
                        isSaving={isSaving}
                    />
                )}
                 <EditableField
                    label="Supply Chain Max Nodes"
                    value={supply_chain_max_nodes}
                    onSave={(value) => handleSave(onUpdateSupplyChainMaxNodes, parseInt(value, 10))}
                    icon={<GitBranch className="w-5 h-5 text-slate-500" />}
                    isSaving={isSaving}
                />
                <EditableSelect
                    label="Auction Type"
                    value={revenue_auction_type}
                    options={['FIRST_PRICE', 'SECOND_PRICE']}
                    onSave={(value) => handleSave(onUpdateRevenueAuctionType, value)}
                    icon={<Shield className="w-5 h-5 text-slate-500" />}
                    isSaving={isSaving}
                />
                <EditableNumericSelect
                    label="Fraud Detection Filtering Level"
                    value={fraud_detection_filtering_level}
                    numericOptions={{
                        0: 'UNSET',
                        1: 'EXTREME',
                        2: 'HIGH',
                        3: 'MEDIUM'
                    }}
                    onSave={(value) => handleSave(onUpdateFraudDetectionLevel, value)}
                    icon={<Shield className="w-5 h-5 text-slate-500" />}
                    isSaving={isSaving}
                />
                <JsonEditor
                    label="Bid Request Overwrite"
                    value={bid_request_overwrite}
                    onSave={(...args) => handleSave(onUpdateBidRequestOverwrite, ...args)}
                    isSaving={isSaving}
                />
                 <CreativeScanEditor
                    value={{ allow_creative_scan, creative_scan_ratio }}
                    onSave={(...args) => handleSave(onUpdateCreativeScan, ...args)}
                    isSaving={isSaving}
                />
                <FeesEditor
                    value={fees}
                    onSave={(fees) => handleSave(onUpdateFees, fees)}
                    isSaving={isSaving}
                />
            </CardContent>
        </Card>
    );
}
