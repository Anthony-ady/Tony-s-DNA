
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, ArrowRightLeft, DollarSign, Save, Loader2, Bug, ChevronRight } from 'lucide-react';
import { Separator } from "@/components/ui/separator";

export default function BrokerSettingsSidebar({ data, onUpdateSspConfig, onUpdateDebug, onUpdateVisitorKind, isSaving }) {
    const [sspSettings, setSspSettings] = useState({});
    const [chuckId, setChuckId] = useState('');

    useEffect(() => {
        const sspConfig = data?.ssp_config;
        if (sspConfig) {
            setSspSettings({
                enabled: !sspConfig.disabled,
                creativeScan: !sspConfig.disable_creative_scan,
                dynamicMargin: !sspConfig.disable_dynamic_margin,
                partnerSelection: !sspConfig.disable_partner_selection,
                margin: sspConfig.margin || 0,
                preventNative2Banner: sspConfig.prevent_native2banner || false,
                preventVideo2Banner: sspConfig.prevent_video2banner || false,
                preventVideo2Native: sspConfig.prevent_video2native || false
            });
        }
        setChuckId(data?.debug?.ChuckNorrisId || '');
    }, [data]);

    if (!data) return null;

    const debug = data?.debug;
    const isDebugEnabled = debug?.LogLevel === "VERBOSE";

    const handleToggleChange = async (setting, value) => {
        const newSettings = { ...sspSettings, [setting]: value };
        setSspSettings(newSettings);
        if (onUpdateSspConfig) {
            await onUpdateSspConfig(newSettings);
        }
    };

    const handleMarginSave = async () => {
        if (onUpdateSspConfig) {
            await onUpdateSspConfig(sspSettings);
        }
    };

    const handleDebugToggle = async (enabled) => {
        if (!debug || !onUpdateDebug) return;

        const newLogLevel = enabled ? "VERBOSE" : "DISABLED"; 
        
        const updatedDebugData = {
            ...debug,
            LogLevel: newLogLevel
        };

        // If debug is being disabled, remove ChuckNorrisId
        if (!enabled) {
            delete updatedDebugData.ChuckNorrisId;
            setChuckId(''); // Clear the local state too
        }

        // MaxLogPerSecond is implicitly preserved by the spread operator (...debug)
        // No explicit deletion is needed as per the requirement to keep it in JSON.

        if (onUpdateDebug) {
            await onUpdateDebug(updatedDebugData);
        }
    };

    const handleSaveChuckId = async () => {
        if (!debug || !onUpdateDebug) return;
        const updatedDebugData = { ...debug, ChuckNorrisId: chuckId };
        // If the chuckId is empty, delete the property from the debug object
        if (!chuckId) {
            delete updatedDebugData.ChuckNorrisId;
        }
        // MaxLogPerSecond is implicitly preserved by the spread operator (...debug)
        // No explicit deletion is needed as per the requirement to keep it in JSON.
        await onUpdateDebug(updatedDebugData);
    };

    const ToggleSwitch = ({ label, description, settingKey }) => {
        const checked = sspSettings[settingKey] || false;
        return (
            <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200">
                <div className="flex-1">
                    <Label className="text-sm font-medium text-slate-700">{label}</Label>
                    {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${checked ? 'bg-green-100' : 'bg-red-100'}`}>
                    <Switch
                        checked={checked}
                        onCheckedChange={(value) => handleToggleChange(settingKey, value)}
                        disabled={isSaving}
                        className={`${checked ? 'data-[state=checked]:bg-green-600' : 'data-[state=unchecked]:bg-red-500'}`}
                    />
                    <span className={`text-xs font-semibold ${checked ? 'text-green-800' : 'text-red-800'}`}>
                        {checked ? 'ON' : 'OFF'}
                    </span>
                </div>
            </div>
        );
    };

    return (
        <Card className="border-slate-200 shadow-sm" id="ssp-config">
            <CardContent className="space-y-6 pt-6">
                {/* Debug Configuration Section */}
                {debug && (
                    <>
                    <div className="space-y-3">
                        <div className="px-1 group flex items-center justify-between">
                            <div className="font-semibold tracking-tight text-sm text-slate-800">Debug</div>
                            <ChevronRight className={`w-4 h-4 text-blue-700 transition-opacity ${true ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                        </div>
                        <div className="space-y-3 pl-2">
                            <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200">
                                <div className="flex-1">
                                    <Label className="text-sm font-medium text-slate-700">Debug Logging</Label>
                                    <p className="text-xs text-slate-500 mt-1">Enable verbose logging</p>
                                </div>
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${isDebugEnabled ? 'bg-green-100' : 'bg-red-100'}`}>
                                    <Switch
                                        checked={isDebugEnabled}
                                        onCheckedChange={handleDebugToggle}
                                        disabled={isSaving}
                                        className={`${isDebugEnabled ? 'data-[state=checked]:bg-green-600' : 'data-[state=unchecked]:bg-red-500'}`}
                                    />
                                    <span className={`text-xs font-semibold ${isDebugEnabled ? 'text-green-800' : 'text-red-800'}`}>
                                        {isDebugEnabled ? 'ON' : 'OFF'}
                                    </span>
                                </div>
                            </div>
                            
                            {isDebugEnabled && (
                                <div className="p-3 rounded-lg bg-white border border-slate-200">
                                    <Label htmlFor="chuckIdInput" className="text-sm font-medium text-slate-700 mb-2 block">Chuck Norris ID</Label>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id="chuckIdInput"
                                            value={chuckId}
                                            onChange={(e) => setChuckId(e.target.value)}
                                            className="font-mono text-sm"
                                            placeholder="Enter ID for verbose logging"
                                            disabled={isSaving}
                                        />
                                        <Button size="sm" onClick={handleSaveChuckId} disabled={isSaving}>
                                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="h-4" />
                    </>
                )}

                {/* Matching Table Host Section */}
                <div className="space-y-3">
                    <div className="px-1 group flex items-center justify-between">
                        <div className="font-semibold tracking-tight text-sm text-slate-800">Matching Table Host</div>
                        <ChevronRight className={`w-4 h-4 text-blue-700 transition-opacity ${true ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                    </div>
                    <div className="space-y-3 pl-2">
                        <div className="p-3 rounded-lg bg-white border border-slate-200">
                            <Select
                                value={data?.visitor_kind || ''}
                                onValueChange={(value) => {
                                    if (onUpdateVisitorKind) {
                                        onUpdateVisitorKind(value);
                                    }
                                }}
                                disabled={isSaving}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select visitor kind" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="AYL">SSP hosts the matching table (recommended)</SelectItem>
                                    <SelectItem value="EXTERNAL">ADYOULIKE hosts the matching table</SelectItem>
                                </SelectContent>
                            </Select>
                            {data?.visitor_kind === 'AYL' && (
                                <p className="text-xs text-slate-500 mt-3">
                                    The SSP is expected to include in its requests, under user.buyeruid, the users it has previously registered.
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* SSP Configuration Section */}
                <div className="space-y-3">
                    <div className="px-1 group flex items-center justify-between">
                        <div className="font-semibold tracking-tight text-sm text-slate-800">SSP Configuration</div>
                        <ChevronRight className={`w-4 h-4 text-blue-700 transition-opacity ${true ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                    </div>
                    <div className="space-y-3">
                        {/* <ToggleSwitch label="Enabled" description="Enable SSP configuration" settingKey="enabled" /> REMOVED */}
                        <ToggleSwitch label="Creative scan" description="Enable creative scanning" settingKey="creativeScan" />
                        <ToggleSwitch label="Dynamic margin" description="Enable dynamic margin on auctions" settingKey="dynamicMargin" />
                        <ToggleSwitch label="Partner selection" description="Enable automatic partner selection" settingKey="partnerSelection" />
                        
                        {/* Margin Input REMOVED */}
                        {/* 
                        <div className="p-3 rounded-lg bg-white border border-slate-200">
                            <Label className="text-sm font-medium text-slate-700 mb-2 block">Margin</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="1"
                                    value={sspSettings.margin || 0}
                                    onChange={(e) => setSspSettings({...sspSettings, margin: parseFloat(e.target.value) || 0})}
                                    className="text-sm"
                                    disabled={isSaving}
                                />
                                <Button size="sm" onClick={handleMarginSave} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                </Button>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Revenue share margin (0.0 - 1.0)</p>
                        </div>
                        */}
                    </div>
                </div>

            </CardContent>
        </Card>
    );
}
