import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Layers } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function BrokerAdTransformationSettings({ data, onUpdateSspConfig, saving = false }) {
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

    const handlePreventAdTransformChange = (settingKey, value) => {
        if (!onUpdateSspConfig) return;

        const newPreventAdTransform = {
            ...sspSettings.preventAdTransform,
            [settingKey]: value
        };
        setSspSettings((prev) => ({
            ...prev,
            preventAdTransform: newPreventAdTransform
        }));

        const flatSspSettings = {
            preventNative2Banner: newPreventAdTransform.Native2Banner,
            preventVideo2Banner: newPreventAdTransform.Video2Banner,
            preventVideo2Native: newPreventAdTransform.Video2Native
        };

        onUpdateSspConfig(flatSspSettings);
    };

    const PreventTransformToggleSwitch = ({ label, description, settingKey, warningText }) => {
        const checked = sspSettings.preventAdTransform ? sspSettings.preventAdTransform[settingKey] || false : false;
        // For prevent transforms, checked=false means ON (allowed), checked=true means OFF (prevented)
        const isAllowed = !checked;
        return (
            <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200">
                <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                        <Label>{label}</Label>
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
                        disabled={saving}
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
        <Card className="border-slate-200 shadow-sm overflow-hidden rounded-lg">
            <CardContent className="space-y-3 pt-6">
                <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4 -mx-6 -mt-6">
                    <CardTitle className="flex items-center gap-2 text-white text-base">
                        <Layers className="w-5 h-5 shrink-0" />
                        Ad transform
                    </CardTitle>
                </CardHeader>
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
