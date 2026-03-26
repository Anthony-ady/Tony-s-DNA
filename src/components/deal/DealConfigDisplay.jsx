
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit3, Save, X, HandCoins, Hash, Tag, Loader2, DollarSign, ShieldCheck, Calendar, Globe, FileJson, Smartphone, Monitor, Tablet, AppWindow, Gavel, Activity } from 'lucide-react';
import DealCuratedSection from './DealCuratedSection';

const ACCESS_OPTIONS = ["DISABLED", "ENABLED", "ALL"];
const AD_KINDS = ["AD_BANNER", "AD_TRAFFIC", "AD_VIDEO", "AD_INSTREAM", "AD_OUTSTREAM"];

const AD_KIND_LABELS = {
    "AD_BANNER": "BANNER",
    "AD_TRAFFIC": "NATIVE DISPLAY", 
    "AD_VIDEO": "NATIVE VIDEO",
    "AD_INSTREAM": "INSTREAM",
    "AD_OUTSTREAM": "OUTSTREAM"
};

const AUCTION_TYPES = [
    { value: 1, label: "First Price" },
    { value: 2, label: "Second Price" },
    { value: 3, label: "Fixed Price" }
];

const MEASUREMENT_SOLUTIONS = ["HIGH_ATTENTION", "GMP"];

const formatCurrency = (value) => {
    if (value === undefined || value === null || isNaN(value)) return 'N/A';
    return `$${(value).toFixed(2)}`;
};

export default function DealConfigDisplay({ 
    data, onUpdateName, onUpdateAccess, onUpdateFloor, onUpdateBooleanField, onUpdateAdKinds, onUpdateAuctionType, onUpdateCuratedDeals, onUpdateStartedAt, onUpdateFinishedAt, onUpdateExcludedDeals, onUpdateMeasurementSolutions, onUpdateAudiences, authToken
}) {
    // --- State for Information section ---
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState('');
    const [isSavingName, setIsSavingName] = useState(false);
    
    const [isEditingFloor, setIsEditingFloor] = useState(false);
    const [editedFloor, setEditedFloor] = useState('');
    const [isSavingFloor, setIsSavingFloor] = useState(false);

    const [isEditingStartedAt, setIsEditingStartedAt] = useState(false);
    const [editedStartedAt, setEditedStartedAt] = useState('');
    const [isSavingStartedAt, setIsSavingStartedAt] = useState(false);

    const [isEditingFinishedAt, setIsEditingFinishedAt] = useState(false);
    const [editedFinishedAt, setEditedFinishedAt] = useState('');
    const [isSavingFinishedAt, setIsSavingFinishedAt] = useState(false);

    const [isSavingAccess, setIsSavingAccess] = useState(false);
    const [isSavingBoolean, setIsSavingBoolean] = useState(false);
    const [isSavingAdKinds, setIsSavingAdKinds] = useState(false);
    const [isSavingAuctionType, setIsSavingAuctionType] = useState(false);
    const [isSavingMeasurement, setIsSavingMeasurement] = useState(false);

    // Helper functions for date conversion
    const timestampToDatetimeLocal = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        // Format: YYYY-MM-DDTHH:MM
        // Using toISOString and slicing to get the desired format for datetime-local input
        // This will represent the UTC time of the timestamp
        return date.toISOString().slice(0, 16); 
    };

    const datetimeLocalToTimestamp = (datetimeLocal) => {
        if (!datetimeLocal) return null; // Returns null for empty string or null
        // Convert datetime-local string to Date object and then to milliseconds since epoch
        // new Date(datetimeLocal) will parse the string as a local time if it lacks timezone info
        return new Date(datetimeLocal).getTime();
    };

    useEffect(() => {
        if (data?.Data) {
            setEditedName(data.Data.Name || '');
            // Divide by 1000 for display/edit
            setEditedFloor(data.Data.Floor !== undefined ? String(data.Data.Floor / 1000) : '');
            setEditedStartedAt(timestampToDatetimeLocal(data.Data.StartedAt));
            setEditedFinishedAt(timestampToDatetimeLocal(data.Data.FinishedAt));
        }
    }, [data]);

    if (!data?.Data) return null;

    const { Id, Data } = data;

    // --- Logic for Name ---
    const handleSaveName = async () => {
        if (!editedName.trim() || !onUpdateName) return;
        setIsSavingName(true);
        try {
            await onUpdateName(editedName.trim());
            setIsEditingName(false);
        } catch (error) {
            console.error('Error saving name:', error);
        } finally {
            setIsSavingName(false);
        }
    };
    
    const handleCancelEditName = () => {
        setEditedName(Data.Name || '');
        setIsEditingName(false);
    };

    // --- Logic for Floor ---
    const handleSaveFloor = async () => {
        // Convert dollars back to original units (multiply by 1000)
        const floorValue = parseFloat(editedFloor) * 1000; 
        if (isNaN(floorValue) || !onUpdateFloor) return;
        setIsSavingFloor(true);
        try {
            await onUpdateFloor(floorValue);
            setIsEditingFloor(false);
        } catch (error) {
            console.error('Error saving floor:', error);
        } finally {
            setIsSavingFloor(false);
        }
    };
    
    const handleCancelEditFloor = () => {
        // Divide by 1000 for display/edit
        setEditedFloor(Data.Floor !== undefined ? String(Data.Floor / 1000) : '');
        setIsEditingFloor(false);
    };

    // --- Logic for StartedAt ---
    const handleSaveStartedAt = async () => {
        if (!editedStartedAt || !onUpdateStartedAt) return; // Must have a value
        const timestamp = datetimeLocalToTimestamp(editedStartedAt);
        setIsSavingStartedAt(true);
        try {
            await onUpdateStartedAt(timestamp);
            setIsEditingStartedAt(false);
        } catch (error) {
            console.error('Error saving started at:', error);
        } finally {
            setIsSavingStartedAt(false);
        }
    };

    const handleCancelEditStartedAt = () => {
        setEditedStartedAt(timestampToDatetimeLocal(Data.StartedAt));
        setIsEditingStartedAt(false);
    };

    // --- Logic for FinishedAt ---
    const handleSaveFinishedAt = async () => {
        const timestamp = datetimeLocalToTimestamp(editedFinishedAt); // Can be null if editedFinishedAt is empty
        if (!onUpdateFinishedAt) return;
        setIsSavingFinishedAt(true);
        try {
            await onUpdateFinishedAt(timestamp);
            setIsEditingFinishedAt(false);
        } catch (error) {
            console.error('Error saving finished at:', error);
        } finally {
            setIsSavingFinishedAt(false);
        }
    };

    const handleCancelEditFinishedAt = () => {
        setEditedFinishedAt(timestampToDatetimeLocal(Data.FinishedAt));
        setIsEditingFinishedAt(false);
    };

    // --- Logic for Access ---
    const handleAccessChange = async (newAccess) => {
        if (!onUpdateAccess) return;
        setIsSavingAccess(true);
        try {
            await onUpdateAccess(newAccess);
        } catch (error) {
            console.error('Error updating access:', error);
        } finally {
            setIsSavingAccess(false);
        }
    };

    const handleAuctionTypeChange = async (newType) => {
        if (!onUpdateAuctionType) return;
        setIsSavingAuctionType(true);
        try {
            await onUpdateAuctionType(newType);
        } catch (error) {
            console.error('Error updating auction type:', error);
        } finally {
            setIsSavingAuctionType(false);
        }
    };

    // --- Logic for Boolean Fields ---
    const handleBooleanChange = async (fieldName, newValue) => {
        if (!onUpdateBooleanField) return;
        setIsSavingBoolean(true);
        try {
            await onUpdateBooleanField(fieldName, newValue);
        } catch (error) {
            console.error(`Error updating ${fieldName}:`, error);
        } finally {
            setIsSavingBoolean(false);
        }
    };

    const handleCuratedDealsChange = async (newValue) => {
        if (!onUpdateCuratedDeals) return;
        setIsSavingBoolean(true); // Can reuse the same loading state
        try {
            await onUpdateCuratedDeals(newValue);
        } catch (error) {
            console.error('Error updating Curated Deals:', error);
        } finally {
            setIsSavingBoolean(false);
        }
    };

    // --- Logic for AdKinds ---
    const handleToggleAdKind = async (adKind) => {
        if (!onUpdateAdKinds || isSavingAdKinds) return;

        const currentAdKinds = Data.AdKinds || [];
        const isCurrentlyActive = currentAdKinds.includes(adKind);

        let newAdKinds;
        if (isCurrentlyActive) {
            // Si on clique sur l'AdKind déjà actif, on le désactive (array vide)
            newAdKinds = [];
        } else {
            // Si on clique sur un autre AdKind, on le remplace (un seul AdKind autorisé)
            newAdKinds = [adKind];
        }

        setIsSavingAdKinds(true);
        try {
            await onUpdateAdKinds(newAdKinds);
        } catch (error) {
            console.error("Failed to update Ad Kinds:", error);
        } finally {
            setIsSavingAdKinds(false);
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'Not set';
        return new Date(timestamp).toLocaleString();
    };

    return (
        <Card className="border-slate-200 shadow-lg h-full">
            <CardContent className="space-y-6 pt-4">
                {/* --- Basic Information Section --- */}
                <div className="space-y-4">
                    <div className="flex flex-col space-y-1.5 p-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-t-lg">
                        <div className="font-semibold tracking-tight text-base flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg">
                                <Tag className="w-5 h-5 text-white"/>
                            </div>
                            Basic Information
                        </div>
                    </div>
                    <div className="space-y-3 pl-2">
                        {Id && (
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200">
                                <div className="flex items-center gap-3">
                                    <Hash className="w-5 h-5 text-slate-500" />
                                    <span className="font-semibold text-slate-700 text-xs">Deal ID</span>
                                </div>
                                <code className="mt-2 sm:mt-0 text-xs font-mono bg-green-50 text-green-800 px-2 py-1 rounded-md">{Id}</code>
                            </div>
                        )}
                        
                        {(Data.Name || isEditingName) && (
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200">
                                <div className="flex items-center gap-3">
                                    <span className="font-semibold text-slate-700 text-xs">Name</span>
                                </div>
                                {isEditingName ? (
                                    <div className="mt-2 sm:mt-0 flex items-center gap-2">
                                        <Input value={editedName} onChange={(e) => setEditedName(e.target.value)} className="text-xs" placeholder="Deal name" disabled={isSavingName} />
                                        <Button size="sm" onClick={handleSaveName} disabled={isSavingName || !editedName.trim()} className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"><Save className="w-4 h-4" /></Button>
                                        <Button size="sm" variant="outline" onClick={handleCancelEditName} disabled={isSavingName}><X className="w-4 h-4" /></Button>
                                    </div>
                                ) : (
                                    <div className="mt-2 sm:mt-0 flex items-center gap-2">
                                        <span className="text-xs text-slate-700">{Data.Name}</span>
                                        <Button size="sm" variant="ghost" onClick={() => setIsEditingName(true)} className="text-slate-500 hover:text-slate-700"><Edit3 className="w-4 h-4" /></Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {Data.Access !== undefined && (
                            <div className="flex items-center justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200">
                                <div className="flex items-center gap-3">
                                    <ShieldCheck className="w-5 h-5 text-slate-500" />
                                    <span className="font-semibold text-slate-700 text-xs">Access</span>
                                    {isSavingAccess && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                                </div>
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${Data.Access === 'ALL' ? 'bg-green-100' : 'bg-red-100'}`}>
                                    <Switch
                                        checked={Data.Access === 'ALL'}
                                        onCheckedChange={(value) => handleAccessChange(value ? 'ALL' : 'DISABLED')}
                                        disabled={isSavingAccess}
                                        className={`${Data.Access === 'ALL' ? 'data-[state=checked]:bg-green-600' : 'data-[state=unchecked]:bg-red-500'}`}
                                    />
                                    <span className={`text-xs font-semibold ${Data.Access === 'ALL' ? 'text-green-800' : 'text-red-800'}`}>
                                        {Data.Access === 'ALL' ? 'ON' : 'OFF'}
                                    </span>
                                </div>
                            </div>
                        )}

                        {Data.Floor !== undefined && (
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200">
                                <div className="flex items-center gap-3">
                                    <DollarSign className="w-5 h-5 text-slate-500" />
                                    <span className="font-semibold text-slate-700 text-xs">Floor Price</span>
                                </div>
                                {isEditingFloor ? (
                                    <div className="mt-2 sm:mt-0 flex items-center gap-2">
                                        <Input type="number" step="0.01" value={editedFloor} onChange={(e) => setEditedFloor(e.target.value)} className="text-xs w-24" placeholder="100" disabled={isSavingFloor} />
                                        <Button size="sm" onClick={handleSaveFloor} disabled={isSavingFloor || !editedFloor.trim()} className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"><Save className="w-4 h-4" /></Button>
                                        <Button size="sm" variant="outline" onClick={handleCancelEditFloor} disabled={isSavingFloor}><X className="w-4 h-4" /></Button>
                                    </div>
                                ) : (
                                    <div className="mt-2 sm:mt-0 flex items-center gap-2">
                                        <span className="text-xs font-mono text-slate-700">{formatCurrency(Data.Floor / 1000)}</span>
                                        <Button size="sm" variant="ghost" onClick={() => setIsEditingFloor(true)} className="text-slate-500 hover:text-slate-700"><Edit3 className="w-4 h-4" /></Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {Data.Region && (
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200">
                                <div className="flex items-center gap-3">
                                    <Globe className="w-5 h-5 text-slate-500" />
                                    <span className="font-semibold text-slate-700 text-xs">Region</span>
                                </div>
                                <code className="mt-2 sm:mt-0 text-xs font-mono bg-blue-50 text-blue-800 px-2 py-1 rounded-md">{Data.Region}</code>
                            </div>
                        )}

                        {(Data.StartedAt !== undefined || isEditingStartedAt) && (
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200">
                                <div className="flex items-center gap-3">
                                    <Calendar className="w-5 h-5 text-slate-500" />
                                    <span className="font-semibold text-slate-700 text-xs">Started At</span>
                                </div>
                                {isEditingStartedAt ? (
                                    <div className="mt-2 sm:mt-0 flex items-center gap-2">
                                        <Input 
                                            type="datetime-local" 
                                            value={editedStartedAt} 
                                            onChange={(e) => setEditedStartedAt(e.target.value)} 
                                            className="text-xs" 
                                            disabled={isSavingStartedAt} 
                                        />
                                        <Button size="sm" onClick={handleSaveStartedAt} disabled={isSavingStartedAt || !editedStartedAt} className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"><Save className="w-4 h-4" /></Button>
                                        <Button size="sm" variant="outline" onClick={handleCancelEditStartedAt} disabled={isSavingStartedAt}><X className="w-4 h-4" /></Button>
                                    </div>
                                ) : (
                                    <div className="mt-2 sm:mt-0 flex items-center gap-2">
                                        <span className="text-xs text-slate-700">{formatDate(Data.StartedAt)}</span>
                                        <Button size="sm" variant="ghost" onClick={() => setIsEditingStartedAt(true)} className="text-slate-500 hover:text-slate-700"><Edit3 className="w-4 h-4" /></Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {(Data.FinishedAt !== undefined || isEditingFinishedAt) && (
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200">
                                <div className="flex items-center gap-3">
                                    <Calendar className="w-5 h-5 text-slate-500" />
                                    <span className="font-semibold text-slate-700 text-xs">Finished At</span>
                                </div>
                                {isEditingFinishedAt ? (
                                    <div className="mt-2 sm:mt-0 flex items-center gap-2">
                                        <Input 
                                            type="datetime-local" 
                                            value={editedFinishedAt} 
                                            onChange={(e) => setEditedFinishedAt(e.target.value)} 
                                            className="text-xs" 
                                            disabled={isSavingFinishedAt} 
                                        />
                                        <Button size="sm" onClick={handleSaveFinishedAt} disabled={isSavingFinishedAt} className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"><Save className="w-4 h-4" /></Button>
                                        <Button size="sm" variant="outline" onClick={handleCancelEditFinishedAt} disabled={isSavingFinishedAt}><X className="w-4 h-4" /></Button>
                                    </div>
                                ) : (
                                    <div className="mt-2 sm:mt-0 flex items-center gap-2">
                                        <span className="text-xs text-slate-700">{formatDate(Data.FinishedAt)}</span>
                                        <Button size="sm" variant="ghost" onClick={() => setIsEditingFinishedAt(true)} className="text-slate-500 hover:text-slate-700"><Edit3 className="w-4 h-4" /></Button>
                                    </div>
                                )}
                            </div>
                        )}
                </div>

                {/* --- Additional Information Section --- */}
                {(Data.ModeKind || Data.PriorityKind || Data.AuctionType !== undefined) && (
                    <>
                        <Separator />
                        <div className="space-y-4">
                            <div className="flex flex-col space-y-1.5 p-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-t-lg">
                                <div className="font-semibold tracking-tight text-base flex items-center gap-3">
                                    <div className="p-2 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg">
                                        <Globe className="w-5 h-5 text-white"/>
                                    </div>
                                    Additional Information
                                </div>
                            </div>
                            <div className="space-y-3 pl-2">
                                {Data.ModeKind && (
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200">
                                        <span className="font-semibold text-slate-700 text-xs">Mode Kind</span>
                                        <Badge className="mt-2 sm:mt-0 bg-purple-100 text-purple-800">{Data.ModeKind}</Badge>
                                    </div>
                                )}
                                {Data.PriorityKind && (
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200">
                                        <span className="font-semibold text-slate-700 text-xs">Priority Kind</span>
                                        <Badge className="mt-2 sm:mt-0 bg-blue-100 text-blue-800">{Data.PriorityKind}</Badge>
                                    </div>
                                )}
                                {Data.AuctionType !== undefined && (
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200">
                                        <div className="flex items-center gap-3">
                                            <Gavel className="w-5 h-5 text-slate-500" />
                                            <span className="font-semibold text-slate-700 text-xs">Auction Type</span>
                                            {isSavingAuctionType && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                                        </div>
                                        <div className="mt-2 sm:mt-0 flex items-center gap-2 flex-wrap">
                                            {AUCTION_TYPES.map(type => {
                                                const isActive = Data.AuctionType === type.value;
                                                return (
                                                    <Badge
                                                        key={type.value}
                                                        variant="outline"
                                                        onClick={() => handleAuctionTypeChange(type.value)}
                                                        className={`transition-all cursor-pointer ${
                                                            isActive
                                                                ? 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200'
                                                                : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                                                        } ${isSavingAuctionType ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    >
                                                        {type.label}
                                                    </Badge>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

                <Separator />

                {/* --- Measurement Solutions Section --- */}
                <div className="space-y-4">
                    <div className="flex flex-col space-y-1.5 p-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-t-lg">
                        <div className="font-semibold tracking-tight text-base flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg">
                                <Activity className="w-5 h-5 text-white" />
                            </div>
                            Measurement Solutions
                            {isSavingMeasurement && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                        </div>
                    </div>
                    <div className="space-y-3 pl-2">
                        {/* High Attention Toggle */}
                        <div className="flex items-center justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200">
                            <span className="font-semibold text-slate-700 text-xs">High Attention</span>
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${Array.isArray(Data.MeasurementSolutions) && Data.MeasurementSolutions.includes('HIGH_ATTENTION') ? 'bg-green-100' : 'bg-red-100'}`}>
                                <Switch
                                    checked={Array.isArray(Data.MeasurementSolutions) && Data.MeasurementSolutions.includes('HIGH_ATTENTION')}
                                    onCheckedChange={async (enabled) => {
                                        if (isSavingMeasurement) return;
                                        const current = Array.isArray(Data.MeasurementSolutions) ? Data.MeasurementSolutions : [];
                                        let newSolutions;
                                        if (enabled) {
                                            // Add HIGH_ATTENTION
                                            newSolutions = [...current, 'HIGH_ATTENTION'];
                                        } else {
                                            // Remove HIGH_ATTENTION
                                            newSolutions = current.filter(s => s !== 'HIGH_ATTENTION');
                                        }
                                        setIsSavingMeasurement(true);
                                        try {
                                            await onUpdateMeasurementSolutions?.(newSolutions);
                                        } finally {
                                            setIsSavingMeasurement(false);
                                        }
                                    }}
                                    disabled={isSavingMeasurement}
                                    className={`${Array.isArray(Data.MeasurementSolutions) && Data.MeasurementSolutions.includes('HIGH_ATTENTION') ? 'data-[state=checked]:bg-green-600' : 'data-[state=unchecked]:bg-red-500'}`}
                                />
                                <span className={`text-xs font-semibold ${Array.isArray(Data.MeasurementSolutions) && Data.MeasurementSolutions.includes('HIGH_ATTENTION') ? 'text-green-800' : 'text-red-800'}`}>
                                    {Array.isArray(Data.MeasurementSolutions) && Data.MeasurementSolutions.includes('HIGH_ATTENTION') ? 'ON' : 'OFF'}
                                </span>
                            </div>
                        </div>

                        {/* Green Media (GMP) Toggle */}
                        <div className="flex items-center justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200">
                            <span className="font-semibold text-slate-700 text-xs">Green Media</span>
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${Array.isArray(Data.MeasurementSolutions) && Data.MeasurementSolutions.includes('GMP') ? 'bg-green-100' : 'bg-red-100'}`}>
                                <Switch
                                    checked={Array.isArray(Data.MeasurementSolutions) && Data.MeasurementSolutions.includes('GMP')}
                                    onCheckedChange={async (enabled) => {
                                        if (isSavingMeasurement) return;
                                        const current = Array.isArray(Data.MeasurementSolutions) ? Data.MeasurementSolutions : [];
                                        let newSolutions;
                                        if (enabled) {
                                            // Add GMP
                                            newSolutions = [...current, 'GMP'];
                                        } else {
                                            // Remove GMP
                                            newSolutions = current.filter(s => s !== 'GMP');
                                        }
                                        setIsSavingMeasurement(true);
                                        try {
                                            await onUpdateMeasurementSolutions?.(newSolutions);
                                        } finally {
                                            setIsSavingMeasurement(false);
                                        }
                                    }}
                                    disabled={isSavingMeasurement}
                                    className={`${Array.isArray(Data.MeasurementSolutions) && Data.MeasurementSolutions.includes('GMP') ? 'data-[state=checked]:bg-green-600' : 'data-[state=unchecked]:bg-red-500'}`}
                                />
                                <span className={`text-xs font-semibold ${Array.isArray(Data.MeasurementSolutions) && Data.MeasurementSolutions.includes('GMP') ? 'text-green-800' : 'text-red-800'}`}>
                                    {Array.isArray(Data.MeasurementSolutions) && Data.MeasurementSolutions.includes('GMP') ? 'ON' : 'OFF'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                </div>

                <Separator />

                {/* --- Curated Deal Section with Audiences and Excluded Deals --- */}
                <DealCuratedSection 
                    data={data}
                    onUpdateCuratedDeals={onUpdateCuratedDeals}
                    onUpdateAudiences={onUpdateAudiences}
                    onUpdateExcludedDeals={onUpdateExcludedDeals}
                    authToken={authToken}
                />

            
            </CardContent>
        </Card>
    );
}
