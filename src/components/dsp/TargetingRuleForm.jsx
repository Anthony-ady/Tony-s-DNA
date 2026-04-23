
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toggleChipClassName } from "@/lib/toggleChip";
import { Switch } from "@/components/ui/switch";
import { Plus, X, Globe, AppWindow, Monitor, Smartphone, Tablet, Tv, LayoutTemplate, FileCode, Info, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

// ----------------------------
// Configuration constants
// ----------------------------

// Options for the "Ad Type" select dropdown
const kindOptions = [
    { value: "AD_TRAFFIC", label: "Native Display" },
    { value: "AD_VIDEO", label: "Native Video" },
    { value: "AD_OUTSTREAM", label: "Outstream" },
    { value: "AD_INSTREAM", label: "Instream" },
    { value: "AD_BANNER", label: "Banner" }
];

// All possible target devices
const ALL_DEVICES = ["DESKTOP", "MOBILE", "TABLET", "TV"];

// Mapping of device types to icons
const deviceIcons = {
    "DESKTOP": <Monitor className="w-3.5 h-3.5 mr-1.5" />,
    "MOBILE": <Smartphone className="w-3.5 h-3.5 mr-1.5" />,
    "TABLET": <Tablet className="w-3.5 h-3.5 mr-1.5" />,
    "TV": <Tv className="w-3.5 h-3.5 mr-1.5" />
};

/**
 * TargetingRuleForm
 * 
 * A form component used to create targeting rules for ads.
 * - Supports both Site and App traffic
 * - Can define countries, devices, and user sync constraints
 * - Dynamically adapts based on available combinations from props
 */
export default function TargetingRuleForm({ onAdd, onCancel, loading, availableCombinations, cnc_deserializer, cnc_serializer, onSaveCncDeserializer, onSaveCncSerializer, isSaving }) {
    // ----------------------------
    // State: form data
    // ----------------------------
    const [formData, setFormData] = useState({
        kind: "",                // Ad type selected
        enableSite: false,       // Whether "Site traffic" is enabled
        enableApp: false,        // Whether "App traffic" is enabled
        countries: "",           // Comma-separated ISO3 country codes
        devices: ["DESKTOP", "MOBILE", "TABLET", "TV"], // Default to all devices enabled
        userSyncedOnly: false,   // Restrict to only synced users
        dealsOnly: false,        // Restrict to deals-only traffic
        connectorContent: "NATIVE_1_1" // Default Native version
    });

// Toggle all logs here
const DEBUG = true;

// Safe console methods with fallbacks - only use console.log
const dbg = {
  group(label) { 
    if (DEBUG) {
      console.log(`=== ${label} ===`);
    }
  },
  groupCollapsed(label) { 
    if (DEBUG) {
      console.log(`--- ${label} ---`);
    }
  },
  groupEnd() { 
    if (DEBUG) {
      console.log('--- End ---');
    }
  },
  time(label) { 
    if (DEBUG) {
      console.log(`Timer started: ${label}`);
    }
  },
  timeEnd(label) { 
    if (DEBUG) {
      console.log(`Timer ended: ${label}`);
    }
  },
  log(...args) { if (DEBUG) console.log(...args); },
  info(...args) { if (DEBUG) console.log('[INFO]', ...args); },
  warn(...args) { if (DEBUG) console.log('[WARN]', ...args); },
  error(...args) { if (DEBUG) console.log('[ERROR]', ...args); },
  table(obj) { 
    if (DEBUG && obj) {
      console.log('Table data:', JSON.stringify(obj, null, 2));
    }
  }
};

    /**
     * handleSubmit
     * Processes the form submission and creates targeting rules
     */
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        dbg.group("🚀 TargetingRuleForm.handleSubmit");
        dbg.time("Form submission");
        
        // Validation check
        if (!formData.kind || (!formData.enableSite && !formData.enableApp)) {
            dbg.warn("Form validation failed:", { 
                kind: formData.kind, 
                enableSite: formData.enableSite, 
                enableApp: formData.enableApp 
            });
            dbg.groupEnd();
            return;
        }

        dbg.info("Form data received:", formData);

        // Parse countries input
        const countriesList = formData.countries 
            ? formData.countries.split(',').map(c => c.trim().toUpperCase()).filter(c => c)
            : [];

        dbg.info("Parsed countries:", countriesList);

        // Create rules for each enabled traffic type
        const rulesToCreate = [];
        
        if (formData.enableSite) {
            const siteRule = {
                kind: formData.kind,
                traffic_type: "SITE",
                countries: countriesList,
                devices: formData.devices,
                userSyncedOnly: formData.userSyncedOnly,
                dealsOnly: formData.dealsOnly,
                connectorContent: formData.connectorContent
            };
            rulesToCreate.push(siteRule);
            dbg.info("Created SITE rule:", siteRule);
        }
        
        if (formData.enableApp) {
            const appRule = {
                kind: formData.kind,
                traffic_type: "APP", 
                countries: countriesList,
                devices: formData.devices,
                userSyncedOnly: formData.userSyncedOnly,
                dealsOnly: formData.dealsOnly,
                connectorContent: formData.connectorContent
            };
            rulesToCreate.push(appRule);
            dbg.info("Created APP rule:", appRule);
        }

        dbg.info(`Total rules to create: ${rulesToCreate.length}`);
        dbg.table(rulesToCreate);

        try {
            dbg.info("Calling onAdd with rules...");
            await onAdd(rulesToCreate);
            dbg.info("✅ onAdd completed successfully");
        } catch (error) {
            dbg.error("❌ onAdd failed:", error);
            throw error; // Re-throw to let parent handle
        } finally {
            dbg.timeEnd("Form submission");
            dbg.groupEnd();
        }
    };

    /**
     * handleDeviceToggle
     * Toggles a device in the selected devices array
     */
    const handleDeviceToggle = (device) => {
        const newDevices = formData.devices.includes(device)
            ? formData.devices.filter(d => d !== device) // remove if already selected
            : [...formData.devices, device];             // add if not selected

        setFormData(prev => ({ ...prev, devices: newDevices }));
    };

    /**
     * getAvailableTrafficTypes
     * Determines which traffic types (SITE / APP) are valid for the selected ad kind
     */
    const getAvailableTrafficTypes = () => {
        if (!formData.kind) return { site: false, app: false };
        
        const siteAvailable = availableCombinations.some(
            combo => combo.kind === formData.kind && combo.traffic_type === 'SITE'
        );
        const appAvailable = availableCombinations.some(
            combo => combo.kind === formData.kind && combo.traffic_type === 'APP'
        );
        
        return { site: siteAvailable, app: appAvailable };
    };

    // Determine which traffic types are currently allowed
    const availableTrafficTypes = getAvailableTrafficTypes();

    // Whether the form has the minimum data to allow submission
    const isFormValid = formData.kind && (formData.enableSite || formData.enableApp);

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}  // start animation (fade in & slide up)
            animate={{ opacity: 1, y: 0 }}    // end state
            exit={{ opacity: 0, y: -20 }}     // exit animation
            className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-indigo-200"
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <Plus className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-lg font-semibold text-slate-800">
                        Add New Targeting Rule
                    </h3>
                </div>

                {/* Ad Kind (Ad Type) selection */}
                <div className="space-y-3">
                    <Label>Ad Type</Label>
                    <Select 
                        value={formData.kind} 
                        onValueChange={(value) => {
                            // When ad type changes, reset traffic toggles
                            setFormData(prev => ({ 
                                ...prev, 
                                kind: value,
                                enableSite: false,
                                enableApp: false
                            }));
                        }}
                    >
                        <SelectTrigger className="focus:ring-teal-500 focus:border-teal-500">
                            <SelectValue placeholder="Select ad type" />
                        </SelectTrigger>
                        <SelectContent>
                            {kindOptions.map(option => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Traffic Type (Site/App) selection */}
                {formData.kind && (
                    <div className="space-y-3">
                        <Label>Traffic Types</Label>
                        <div className="flex gap-4">

                            {/* Site Traffic toggle */}
                            <div 
                                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                                    availableTrafficTypes.site 
                                        ? 'border-slate-200 bg-white' 
                                        : 'border-slate-100 bg-slate-50 opacity-50'
                                }`}
                            >
                                <Globe className="w-4 h-4 text-[rgb(75,99,226)]" />
                                <div className="flex-1">
                                    <Label>Site Traffic</Label>
                                    <p className="text-xs text-slate-500">Web traffic</p>
                                </div>
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${formData.enableSite ? 'bg-green-100' : 'bg-red-100'}`}>
                                    <Switch
                                        checked={formData.enableSite}
                                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enableSite: checked }))}
                                        disabled={!availableTrafficTypes.site} // disabled if site traffic not supported
                                        className={`${formData.enableSite ? 'data-[state=checked]:bg-green-600' : 'data-[state=unchecked]:bg-red-500'}`}
                                    />
                                    <span className={`text-xs font-semibold ${formData.enableSite ? 'text-green-800' : 'text-red-800'}`}>
                                        {formData.enableSite ? 'ON' : 'OFF'}
                                    </span>
                                </div>
                            </div>
                            
                            {/* App Traffic toggle */}
                            <div 
                                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                                    availableTrafficTypes.app 
                                        ? 'border-slate-200 bg-white' 
                                        : 'border-slate-100 bg-slate-50 opacity-50'
                                }`}
                            >
                                <AppWindow className="w-4 h-4 text-purple-600" />
                                <div className="flex-1">
                                    <Label>App Traffic</Label>
                                    <p className="text-xs text-slate-500">Mobile app traffic</p>
                                </div>
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${formData.enableApp ? 'bg-green-100' : 'bg-red-100'}`}>
                                    <Switch
                                        checked={formData.enableApp}
                                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enableApp: checked }))}
                                        disabled={!availableTrafficTypes.app} // disabled if app traffic not supported
                                        className={`${formData.enableApp ? 'data-[state=checked]:bg-green-600' : 'data-[state=unchecked]:bg-red-500'}`}
                                    />
                                    <span className={`text-xs font-semibold ${formData.enableApp ? 'text-green-800' : 'text-red-800'}`}>
                                        {formData.enableApp ? 'ON' : 'OFF'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Warning if neither traffic type is enabled */}
                        {!formData.enableSite && !formData.enableApp && (
                            <p className="text-xs text-amber-600 font-medium">
                                ⚠️ You must enable at least one traffic type
                            </p>
                        )}
                    </div>
                )}

                {/* Native Version - only visible for AD_TRAFFIC and AD_VIDEO kinds */}
                {(formData.kind === 'AD_TRAFFIC' || formData.kind === 'AD_VIDEO') && 
                 (formData.enableSite || formData.enableApp) && (
                    <div className="space-y-3">
                        <Label>Native Version</Label>
                        <Select 
                            value={formData.connectorContent}
                            onValueChange={(value) => setFormData(prev => ({...prev, connectorContent: value}))}
                        >
                            <SelectTrigger className="focus:ring-teal-500 focus:border-teal-500">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="NATIVE_1_1">Native 1.1</SelectItem>
                                <SelectItem value="NATIVE_1_2">Native 1.2</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500">
                            Select the native connector content version
                        </p>
                    </div>
                )}

                {/* Native serialization (Deserializer / Serializer) - only for Native Display / Native Video */}
                {(formData.kind === 'AD_TRAFFIC' || formData.kind === 'AD_VIDEO') && onSaveCncDeserializer && onSaveCncSerializer && (
                    <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200 space-y-3">
                        <div className="font-semibold text-slate-700 text-xs">Native (serialization)</div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-1.5">
                                    <LayoutTemplate className="w-3.5 h-3.5" /> Deserializer
                                </Label>
                                <Select
                                    value={cnc_deserializer || 'STRING'}
                                    onValueChange={(val) => val && onSaveCncDeserializer(val)}
                                    disabled={loading || isSaving}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Deserializer" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {['APPNEXUS', 'STRING', 'OBJECT'].map((opt) => (
                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-1.5">
                                    <FileCode className="w-3.5 h-3.5" /> Serializer
                                </Label>
                                <Select
                                    value={cnc_serializer || 'STRING'}
                                    onValueChange={(val) => val && onSaveCncSerializer(val)}
                                    disabled={loading || isSaving}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Serializer" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {['APPNEXUS', 'STRING', 'OBJECT'].map((opt) => (
                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        {(loading || isSaving) && (
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
                            </div>
                        )}
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
                )}

                {/* Remaining fields only shown if at least one traffic type is selected */}
                {(formData.enableSite || formData.enableApp) && (
                    <>
                        {/* Countries input */}
                        <div className="space-y-3">
                            <Label>
                                Countries (Optional)
                            </Label>
                            <Input
                                value={formData.countries}
                                onChange={(e) => setFormData(prev => ({...prev, countries: e.target.value}))}
                                placeholder="FRA, USA, DEU, ITA..."
                                className="font-mono text-sm focus:border-teal-500 focus:ring-teal-500"
                            />
                            <p className="text-xs text-slate-500">
                                Comma-separated ISO3 country codes (leave empty for all countries)
                            </p>
                        </div>

                        {/* Device selection */}
                        <div className="space-y-3">
                            <Label>
                                Target Devices
                            </Label>
                            <div className="flex flex-wrap gap-2">
                                {ALL_DEVICES.map(device => {
                                    const isActive = formData.devices.includes(device);
                                    return (
                                        <button
                                            key={device}
                                            type="button"
                                            onClick={() => handleDeviceToggle(device)}
                                            className={toggleChipClassName(isActive, "flex items-center")}
                                        >
                                            {deviceIcons[device]}
                                            {device}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* User Synced Only toggle */}
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <div>
                                <Label>
                                    Send only synced users
                                </Label>
                                <p className="text-xs text-slate-500">
                                    Only send traffic with synced users (buyeruid present)
                                </p>
                            </div>
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${formData.userSyncedOnly ? 'bg-green-100' : 'bg-red-100'}`}>
                                <Switch
                                    checked={formData.userSyncedOnly}
                                    onCheckedChange={(checked) => setFormData(prev => ({...prev, userSyncedOnly: checked}))}
                                    className={`${formData.userSyncedOnly ? 'data-[state=checked]:bg-green-600' : 'data-[state=unchecked]:bg-red-500'}`}
                                />
                                <span className={`text-xs font-semibold ${formData.userSyncedOnly ? 'text-green-800' : 'text-red-800'}`}>
                                    {formData.userSyncedOnly ? 'ON' : 'OFF'}
                                </span>
                            </div>
                        </div>

                        {/* Deals Only toggle */}
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <div>
                                <Label>
                                    Deals only
                                </Label>
                                <p className="text-xs text-slate-500">
                                    Only allow traffic from deals
                                </p>
                            </div>
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${formData.dealsOnly ? 'bg-green-100' : 'bg-red-100'}`}>
                                <Switch
                                    checked={formData.dealsOnly}
                                    onCheckedChange={(checked) => setFormData(prev => ({...prev, dealsOnly: checked}))}
                                    className={`${formData.dealsOnly ? 'data-[state=checked]:bg-green-600' : 'data-[state=unchecked]:bg-red-500'}`}
                                />
                                <span className={`text-xs font-semibold ${formData.dealsOnly ? 'text-green-800' : 'text-red-800'}`}>
                                    {formData.dealsOnly ? 'ON' : 'OFF'}
                                </span>
                            </div>
                        </div>
                    </>
                )}

                {/* Form actions */}
                <div className="flex justify-end gap-3 pt-4">
                    {/* Cancel button */}
                    <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                    </Button>

                    {/* Submit button */}
                    <Button 
                        type="submit" 
                        disabled={loading || !isFormValid}
                        className="bg-green-600 hover:bg-green-700" // custom color styling
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Rule{(formData.enableSite && formData.enableApp) ? 's' : ''}
                    </Button>
                </div>
            </form>
        </motion.div>
    );
}
