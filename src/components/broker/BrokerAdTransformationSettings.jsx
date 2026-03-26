import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ArrowRightLeft, AlertTriangle, Loader2, ChevronRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function BrokerAdTransformationSettings({ data, onUpdateSspConfig }) {
    const [isSaving, setIsSaving] = useState(false);
    const [sspSettings, setSspSettings] = useState({});
    
    useEffect(() => {
        const sspConfig = data?.ssp_config;
        if (sspConfig) {
            const newSspSettings = {
                preventAdTransform: {
                    Native2Banner: sspConfig.prevent_native2banner || false,
                    Video2Banner: sspConfig.prevent_video2banner || false,
                    Video2Native: sspConfig.prevent_video2native || false,
                }
            };
            setSspSettings(newSspSettings);
        }
    }, [data]);

    if (!data) return null;

    const handlePreventAdTransformChange = async (settingKey, value) => {
        if (!onUpdateSspConfig) return;
        
        setIsSaving(true);
        try {
            const newPreventAdTransform = {
                ...sspSettings.preventAdTransform,
                [settingKey]: value
            };
            const newSspSettings = {
                ...sspSettings,
                preventAdTransform: newPreventAdTransform
            };
            setSspSettings(newSspSettings);
            
            // Convert nested preventAdTransform to flat format expected by updateSspConfig
            const flatSspSettings = {
                preventNative2Banner: newPreventAdTransform.Native2Banner,
                preventVideo2Banner: newPreventAdTransform.Video2Banner,
                preventVideo2Native: newPreventAdTransform.Video2Native
            };
            
            await onUpdateSspConfig(flatSspSettings);
        } catch (error) {
            console.error('Error updating Ad Transform config:', error);
            // Revert on error
            setSspSettings(prev => ({
                ...prev,
                preventAdTransform: {
                    ...prev.preventAdTransform,
                    [settingKey]: !value
                }
            }));
        } finally {
            setIsSaving(false);
        }
    };

    const PreventTransformToggleSwitch = ({ label, description, settingKey, warningText }) => {
        const checked = sspSettings.preventAdTransform ? sspSettings.preventAdTransform[settingKey] || false : false;
        // For prevent transforms, checked=false means ON (allowed), checked=true means OFF (prevented)
        const isAllowed = !checked;
        return (
            <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200">
                <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                        <Label className="text-sm font-medium text-slate-700">{label}</Label>
                        {warningText && (
                            <TooltipProvider delayDuration={100}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <AlertTriangle className="w-4 h-4 text-orange-500 cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs bg-orange-600 text-white border-orange-700">
                                        <p>{warningText}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>
                    {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${isAllowed ? 'bg-green-100' : 'bg-red-100'}`}>
                    <Switch
                        checked={checked}
                        onCheckedChange={(value) => handlePreventAdTransformChange(settingKey, value)}
                        disabled={isSaving}
                        className={`${isAllowed ? 'data-[state=unchecked]:bg-green-600' : 'data-[state=checked]:bg-red-500'}`}
                    />
                    <span className={`text-xs font-semibold ${isAllowed ? 'text-green-800' : 'text-red-800'}`}>
                        {isAllowed ? 'ON' : 'OFF'}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <Card className="border-slate-200 shadow-sm">
            <CardContent className="pt-4">
                <div className="px-1 mb-2 group flex items-center justify-between">
                    <div className="font-semibold tracking-tight text-sm text-slate-800">Ad transform</div>
                    <ChevronRight className={`w-4 h-4 text-blue-700 transition-opacity ${true ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                </div>
                {/* --- Ad Transformation Section --- */}
                <div className="space-y-3">
                    <div className="space-y-3">
                        <PreventTransformToggleSwitch 
                            label="Native ads in Banner slots" 
                            description="Allows Native ads to be transformed and served in Banner placements" 
                            settingKey="Native2Banner" 
                        />
                        <PreventTransformToggleSwitch 
                            label="Video ads in Banner slots" 
                            description="Allows Video ads to be transformed and served in Banner placements" 
                            settingKey="Video2Banner"
                            warningText="Warning: The DSP is billed on video start, but the publisher is paid on impression. This can lead to negative margins if impressions are higher than video starts."
                        />
                        <PreventTransformToggleSwitch 
                            label="Video ads in Native slots" 
                            description="Allows Video ads to be transformed and served in Native placements" 
                            settingKey="Video2Native"
                            warningText="Warning: The DSP is billed on video start, but the publisher is paid on impression. This can lead to negative margins if impressions are higher than video starts."
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
