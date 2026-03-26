import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AppWindow, ShieldCheck, Users, Smartphone, Circle } from 'lucide-react';
import { API_ENDPOINTS } from '@/config/api';

const AD_KINDS = ["AD_BANNER", "AD_TRAFFIC", "AD_VIDEO", "AD_INSTREAM", "AD_OUTSTREAM"];

const AD_KIND_LABELS = {
    "AD_BANNER": "BANNER",
    "AD_TRAFFIC": "NATIVE DISPLAY",
    "AD_VIDEO": "NATIVE VIDEO",
    "AD_INSTREAM": "INSTREAM",
    "AD_OUTSTREAM": "OUTSTREAM"
};

const DISTRIBUTION_CHANNELS = ["APP", "SITE"];

export default function DealLeftSidebar({ data, onUpdateAdKinds, onUpdateBooleanField, onUpdateCuratedDeals, onUpdateAudiences, onUpdateDistributionChannels, authToken }) {
    const Data = data?.Data;
    if (!Data) return null;

    const [isSavingAdKinds, setIsSavingAdKinds] = useState(false);
    const [isSavingBoolean, setIsSavingBoolean] = useState(false);
    const [isSavingDistribution, setIsSavingDistribution] = useState(false);
    const [editedAudience, setEditedAudience] = useState('');
    const [availableAudiences, setAvailableAudiences] = useState([]);
    const [loadingAudiences, setLoadingAudiences] = useState(false);
    const [selectedAudienceId, setSelectedAudienceId] = useState('');

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

    const handleToggleAdKind = async (adKind) => {
        if (!onUpdateAdKinds || isSavingAdKinds) return;
        const currentAdKinds = Data.AdKinds || [];
        const isCurrentlyActive = currentAdKinds.includes(adKind);
        const newAdKinds = isCurrentlyActive ? [] : [adKind];
        setIsSavingAdKinds(true);
        try {
            await onUpdateAdKinds(newAdKinds);
        } finally {
            setIsSavingAdKinds(false);
        }
    };

    const handleBooleanChange = async (fieldName, newValue) => {
        if (!onUpdateBooleanField) return;
        setIsSavingBoolean(true);
        try {
            await onUpdateBooleanField(fieldName, newValue);
        } finally {
            setIsSavingBoolean(false);
        }
    };

    const handleCuratedDealsChange = async (newValue) => {
        if (!onUpdateCuratedDeals) return;
        setIsSavingBoolean(true);
        try {
            await onUpdateCuratedDeals(newValue);
        } finally {
            setIsSavingBoolean(false);
        }
    };

    const handleToggleDistributionChannel = async (channel) => {
        if (!onUpdateDistributionChannels || isSavingDistribution) return;
        const currentChannels = Data.DistributionChannelKinds || [];
        const isCurrentlyActive = currentChannels.includes(channel);
        let newChannels;
        
        if (isCurrentlyActive) {
            // Remove the channel
            newChannels = currentChannels.filter(c => c !== channel);
        } else {
            // Add the channel
            newChannels = [...currentChannels, channel];
        }
        
        // Ensure at least one channel is selected
        if (newChannels.length === 0) return;
        
        setIsSavingDistribution(true);
        try {
            await onUpdateDistributionChannels(newChannels);
        } finally {
            setIsSavingDistribution(false);
        }
    };

    return (
        <div className="space-y-6">
              {/* Distribution Channels Card */}
              {Array.isArray(Data.DistributionChannelKinds) && (
                <Card className="border-slate-200 shadow-lg">
                    <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-t-lg">
                        <CardTitle className="text-base flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg">
                                <Smartphone className="w-5 h-5 text-white" />
                            </div>
                            Distribution Channels
                            {isSavingDistribution && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                                <div className="flex flex-wrap gap-2">
                                    {DISTRIBUTION_CHANNELS.map((channel) => {
                                        const isActive = Data.DistributionChannelKinds.includes(channel);
                                        return (
                                            <Badge
                                                key={channel}
                                                variant="outline"
                                                onClick={() => handleToggleDistributionChannel(channel)}
                                                className={`transition-all cursor-pointer ${
                                                    isActive
                                                        ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
                                                        : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                                                } ${isSavingDistribution ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                {channel}
                                            </Badge>
                                        );
                                    })}
                                </div>
                    </CardContent>
                </Card>
            )}

              {/* Ad Kinds Card */}
              {Array.isArray(Data.AdKinds) && (
                <Card className="border-slate-200 shadow-lg">
                    <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-t-lg">
                        <CardTitle className="text-base flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg">
                                <AppWindow className="w-5 h-5 text-white" />
                            </div>
                            Ad Kinds
                            {isSavingAdKinds && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                                <div className="flex flex-wrap gap-2">
                                    {AD_KINDS.map((adKind) => {
                                        const isActive = Data.AdKinds.includes(adKind);
                                        return (
                                            <Badge
                                                key={adKind}
                                                variant="outline"
                                                onClick={() => handleToggleAdKind(adKind)}
                                                className={`transition-all cursor-pointer ${
                                                    isActive
                                                        ? 'bg-green-100 text-green-800 border-green-300 hover:bg-green-200'
                                                        : 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200'
                                                } ${isSavingAdKinds ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                {AD_KIND_LABELS[adKind] || adKind}
                                            </Badge>
                                        );
                                    })}
                                </div>
                    </CardContent>
                </Card>
            )}
            
            {/* Settings Card */}
            <Card className="border-slate-200 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-t-lg">
                    <CardTitle className="text-base flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg">
                            <ShieldCheck className="w-5 h-5 text-white" />
                        </div>
                        Settings
                        {isSavingBoolean && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                            {Data.CrossRealm !== undefined && (
                                <div className="flex items-center justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200">
                                    <span className="font-semibold text-slate-700 text-sm">Cross Realm</span>
                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${Data.CrossRealm ? 'bg-green-100' : 'bg-red-100'}`}>
                                        <Switch
                                            checked={Data.CrossRealm}
                                            onCheckedChange={(value) => handleBooleanChange('CrossRealm', value)}
                                            disabled={isSavingBoolean}
                                            className={`${Data.CrossRealm ? 'data-[state=checked]:bg-green-600' : 'data-[state=unchecked]:bg-red-500'}`}
                                        />
                                        <span className={`text-xs font-semibold ${Data.CrossRealm ? 'text-green-800' : 'text-red-800'}`}>
                                            {Data.CrossRealm ? 'ON' : 'OFF'}
                                        </span>
                                    </div>
                                </div>
                            )}


                            {Data.BannerStoryDisplay !== undefined && Data.AdKinds?.includes('AD_BANNER') && (
                                <div className="flex items-center justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200">
                                    <span className="font-semibold text-slate-700 text-sm">Banner Story Display</span>
                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${Data.BannerStoryDisplay ? 'bg-green-100' : 'bg-red-100'}`}>
                                        <Switch
                                            checked={Data.BannerStoryDisplay}
                                            onCheckedChange={(value) => handleBooleanChange('BannerStoryDisplay', value)}
                                            disabled={isSavingBoolean}
                                            className={`${Data.BannerStoryDisplay ? 'data-[state=checked]:bg-green-600' : 'data-[state=unchecked]:bg-red-500'}`}
                                        />
                                        <span className={`text-xs font-semibold ${Data.BannerStoryDisplay ? 'text-green-800' : 'text-red-800'}`}>
                                            {Data.BannerStoryDisplay ? 'ON' : 'OFF'}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {Data.StoryDisplay !== undefined && Data.AdKinds?.includes('AD_TRAFFIC') && (
                                <div className="flex items-center justify-between p-3 bg-slate-50/70 rounded-lg border border-slate-200">
                                    <span className="font-semibold text-slate-700 text-sm">Native Story Display</span>
                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${Data.StoryDisplay ? 'bg-green-100' : 'bg-red-100'}`}>
                                        <Switch
                                            checked={Data.StoryDisplay}
                                            onCheckedChange={(value) => handleBooleanChange('StoryDisplay', value)}
                                            disabled={isSavingBoolean}
                                            className={`${Data.StoryDisplay ? 'data-[state=checked]:bg-green-600' : 'data-[state=unchecked]:bg-red-500'}`}
                                        />
                                        <span className={`text-xs font-semibold ${Data.StoryDisplay ? 'text-green-800' : 'text-red-800'}`}>
                                            {Data.StoryDisplay ? 'ON' : 'OFF'}
                                        </span>
                                    </div>
                                </div>
                            )}
                </CardContent>
            </Card>

          
        </div>
    );
}