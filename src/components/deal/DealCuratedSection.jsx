import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Users, Tag, Star, Circle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { API_ENDPOINTS } from '@/config/api';

export default function DealCuratedSection({ 
    data, 
    onUpdateCuratedDeals, 
    onUpdateAudiences, 
    onUpdateExcludedDeals,
    authToken 
}) {
    const Data = data?.Data;
    if (!Data) return null;

    const [isSavingBoolean, setIsSavingBoolean] = useState(false);
    const [availableAudiences, setAvailableAudiences] = useState([]);
    const [loadingAudiences, setLoadingAudiences] = useState(false);
    const [selectedAudienceId, setSelectedAudienceId] = useState('');
    const [editedExcludedDeal, setEditedExcludedDeal] = useState('');

    // Fetch available audiences on mount with cache
    useEffect(() => {
        const fetchAudiences = async () => {
            if (!authToken) return;
            
            // Check cache first
            const cachedAudiences = localStorage.getItem('deal_audiences_cache');
            const cacheTimestamp = localStorage.getItem('deal_audiences_cache_timestamp');
            const now = Date.now();
            const CACHE_DURATION = 1000 * 60 * 60; // 1 hour cache
            
            // Use cache if it's less than 1 hour old
            if (cachedAudiences && cacheTimestamp && (now - parseInt(cacheTimestamp)) < CACHE_DURATION) {
                try {
                    const audiences = JSON.parse(cachedAudiences);
                    setAvailableAudiences(audiences);
                    return;
                } catch (e) {
                    // Cache corrupted, fetch from API
                }
            }
            
            // Fetch from API if no cache or expired
            setLoadingAudiences(true);
            try {
                const response = await fetch(API_ENDPOINTS.DEALS_AUDIENCES, {
                    method: 'GET',
                    headers: {
                        'x-ayl-auth-token': authToken,
                        'Content-Type': 'application/json'
                    }
                });
                if (response.ok) {
                    const audiences = await response.json();
                    setAvailableAudiences(audiences || []);
                    // Store in cache
                    localStorage.setItem('deal_audiences_cache', JSON.stringify(audiences));
                    localStorage.setItem('deal_audiences_cache_timestamp', String(now));
                }
            } catch (error) {
                console.error('Error fetching audiences:', error);
            } finally {
                setLoadingAudiences(false);
            }
        };
        fetchAudiences();
    }, [authToken]);

    const handleCuratedDealsChange = async (newValue) => {
        if (!onUpdateCuratedDeals) return;
        setIsSavingBoolean(true);
        try {
            await onUpdateCuratedDeals(newValue);
        } finally {
            setIsSavingBoolean(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Curated Deals Toggle */}
            {Data.Curated !== undefined && (
                <Card className="border-slate-200 shadow-lg">
                    <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-t-lg">
                        <CardTitle className="text-base flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg">
                                <Star className="w-5 h-5 text-white" />
                            </div>
                            Curated Deal
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200">
                            <span className="font-semibold text-slate-700 text-sm">Curated</span>
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${Data.Curated ? 'bg-green-100' : 'bg-red-100'}`}>
                                <Switch
                                    checked={Data.Curated}
                                    onCheckedChange={handleCuratedDealsChange}
                                    disabled={isSavingBoolean}
                                    className={`${Data.Curated ? 'data-[state=checked]:bg-green-600' : 'data-[state=unchecked]:bg-red-500'}`}
                                />
                                <span className={`text-xs font-semibold ${Data.Curated ? 'text-green-800' : 'text-red-800'}`}>
                                    {Data.Curated ? 'ON' : 'OFF'}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Separator />

            {/* Audiences Section */}
            <Card className="border-slate-200 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-t-lg">
                    <CardTitle className="text-base flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg">
                            <Users className="w-5 h-5 text-white" />
                        </div>
                        Audiences
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    {/* Selected audiences badges */}
                    <div className="flex flex-wrap gap-2">
                        {(!Array.isArray(Data.Audiences) || Data.Audiences.length === 0) && (
                            <span className="text-sm text-slate-500">No audiences selected</span>
                        )}
                        {(Array.isArray(Data.Audiences) ? Data.Audiences : []).map((audienceId) => {
                            const audienceData = availableAudiences.find(a => String(a.id) === String(audienceId));
                            const audienceName = audienceData?.name || audienceId;
                            return (
                                <Badge
                                    key={audienceId}
                                    variant="outline"
                                    onClick={async () => {
                                        const current = Array.isArray(Data.Audiences) ? Data.Audiences : [];
                                        const updated = current.filter((id) => id !== audienceId);
                                        await onUpdateAudiences?.(updated);
                                    }}
                                    className="cursor-pointer bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200"
                                    title="Click to remove"
                                >
                                    {audienceName}
                                </Badge>
                            );
                        })}
                    </div>
                    
                    {/* Dropdown to select from available audiences */}
                    {loadingAudiences ? (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading audiences...
                        </div>
                    ) : availableAudiences.length > 0 ? (
                        <div className="flex gap-2">
                            <Select value={selectedAudienceId} onValueChange={setSelectedAudienceId}>
                                <SelectTrigger className="text-sm">
                                    <SelectValue placeholder="Select an audience" />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableAudiences
                                        .sort((a, b) => {
                                            // Sort by enabled first (true before false), then by name
                                            if (a.enabled === b.enabled) {
                                                return a.name.localeCompare(b.name);
                                            }
                                            return a.enabled ? -1 : 1;
                                        })
                                        .map((audience) => {
                                            const isAlreadyAdded = Array.isArray(Data.Audiences) && Data.Audiences.includes(String(audience.id));
                                            return (
                                                <SelectItem 
                                                    key={audience.id} 
                                                    value={String(audience.id)}
                                                    disabled={isAlreadyAdded}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Circle 
                                                            className={`w-2 h-2 ${audience.enabled ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'}`}
                                                        />
                                                        <span>{audience.name}</span>
                                                        {isAlreadyAdded && <span className="text-xs text-slate-400">(added)</span>}
                                                    </div>
                                                </SelectItem>
                                            );
                                        })
                                    }
                                </SelectContent>
                            </Select>
                            <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                disabled={!selectedAudienceId}
                                onClick={async () => {
                                    if (!selectedAudienceId) return;
                                    const current = Array.isArray(Data.Audiences) ? Data.Audiences : [];
                                    if (!current.includes(selectedAudienceId)) {
                                        await onUpdateAudiences?.([...current, selectedAudienceId]);
                                        setSelectedAudienceId('');
                                    }
                                }}
                            >
                                Add
                            </Button>
                        </div>
                    ) : (
                        <p className="text-xs text-slate-500">No audiences available</p>
                    )}
                </CardContent>
            </Card>

            <Separator />

            {/* Excluded Deals Section */}
            <Card className="border-slate-200 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-t-lg">
                    <CardTitle className="text-base flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg">
                            <Tag className="w-5 h-5 text-white" />
                        </div>
                        Excluded Deals
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="flex flex-wrap gap-2">
                        {(!Array.isArray(Data.ExcludedDeals) || Data.ExcludedDeals.length === 0) && (
                            <span className="text-sm text-slate-500">No excluded deals</span>
                        )}
                        {(Array.isArray(Data.ExcludedDeals) ? Data.ExcludedDeals : []).map((dealId) => (
                            <Badge
                                key={dealId}
                                variant="outline"
                                onClick={async () => {
                                    const current = Array.isArray(Data.ExcludedDeals) ? Data.ExcludedDeals : [];
                                    const updated = current.filter((id) => id !== dealId);
                                    await onUpdateExcludedDeals?.(updated);
                                }}
                                className="cursor-pointer bg-red-100 text-red-800 border-red-300 hover:bg-red-200"
                                title="Click to remove"
                            >
                                {dealId}
                            </Badge>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <Input
                            placeholder="Add deal ID(s) separated by commas"
                            value={editedExcludedDeal}
                            onChange={(e) => setEditedExcludedDeal(e.target.value)}
                            className="text-sm"
                        />
                        <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={async () => {
                                const raw = editedExcludedDeal.trim();
                                if (!raw) return;
                                const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
                                if (parts.length === 0) return;
                                const current = Array.isArray(Data.ExcludedDeals) ? Data.ExcludedDeals : [];
                                const merged = [...current];
                                for (const pid of parts) {
                                    if (!merged.includes(pid)) merged.push(pid);
                                }
                                await onUpdateExcludedDeals?.(merged);
                                setEditedExcludedDeal('');
                            }}
                        >
                            Add
                        </Button>
                    </div>
                </CardContent>
        </Card>
        </div>
    );
}


