/**
 * BrokerDataCenterSettings Component
 * 
 * This component manages data center configuration for broker operations.
 * It allows enabling/disabling specific data centers and configuring their settings
 * such as priority and performance parameters.
 * 
 * @param {Object} dataCenters - Object containing data center configurations
 * @param {Function} onUpdate - Callback function to update data center settings
 * @param {boolean} isSaving - Loading state indicator for save operations
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Save, Loader2, Zap, X, Server } from 'lucide-react';
import { toggleChipClassName } from "@/lib/toggleChip";

export default function BrokerDataCenterSettings({ dataCenters, onUpdate, isSaving }) {
    // Local state for managing data center configurations
    const [localDataCenters, setLocalDataCenters] = useState({});

    // Mapping for user-friendly data center names
    const dataCenterNames = {
        'gcp-europe-west9': 'EMEA',    // Europe, Middle East, Africa region
        'gcp-us-east4': 'US EAST',     // US East Coast region
        'gcp-us-west1': 'US WEST'      // US West Coast region
    };

    // Effect to initialize local state when dataCenters prop changes
    useEffect(() => {
        if (dataCenters) {
            // Create deep copy to avoid mutating original data
            setLocalDataCenters(JSON.parse(JSON.stringify(dataCenters)));
        }
    }, [dataCenters]);

    /**
     * Handles toggling data center enabled/disabled state
     * Automatically saves changes to the parent component
     * @param {string} dcName - The data center name to toggle
     */
    const handleToggleEnabled = (dcName) => {
        const newConfig = JSON.parse(JSON.stringify(localDataCenters));
        const isNowDisabled = newConfig[dcName].Enabled;
        newConfig[dcName].Enabled = !newConfig[dcName].Enabled;
        if (isNowDisabled) {
            delete newConfig[dcName].Default;
        }
        setLocalDataCenters(newConfig);
        onUpdate(newConfig);
    };

    /**
     * Sets a data center as the default (only one can be default at a time)
     * Automatically saves changes to the parent component
     * @param {string} dcNameToSet - The data center name to set as default
     */
    const handleSetDefault = (dcNameToSet) => {
        const newConfig = { ...localDataCenters };
        Object.keys(newConfig).forEach(dcName => {
            // Ensure config object exists before setting Default property
            if (!newConfig[dcName]) {
                newConfig[dcName] = {};
            }
            newConfig[dcName].Default = dcName === dcNameToSet;
        });
        setLocalDataCenters(newConfig);
        onUpdate(newConfig); // Auto-save on change
    };

    /**
     * Handles QPS (Queries Per Second) input changes
     * Updates local state but doesn't save until user clicks save button
     * Validates that QPS values are positive integers only
     * @param {string} dcName - The data center name
     * @param {string} newQps - The new QPS value
     */
    const handleQpsChange = (dcName, newQps) => {
        const newConfig = { ...localDataCenters };
        const qpsValue = parseInt(newQps);
        
        // Only allow positive integers (1 or greater)
        if (newQps === '' || isNaN(qpsValue) || qpsValue <= 0) {
            // If empty or invalid, don't update the value
            return;
        }
        
        newConfig[dcName].QPS = qpsValue;
        setLocalDataCenters(newConfig);
    };

    /**
     * Saves QPS changes for a specific data center
     * Validates that QPS value is positive before saving
     * @param {string} dcName - The data center name to save
     */
    const handleQpsSave = (dcName) => {
        const currentQps = localDataCenters[dcName]?.QPS;
        
        // Validate that QPS is a positive integer before saving
        if (currentQps === undefined || currentQps <= 0) {
            // Don't save invalid QPS values
            return;
        }
        
        onUpdate(localDataCenters); // Save the current state
    };

    /**
     * Removes QPS field from a specific data center
     * This will remove the QPS property from the JSON, effectively clearing the limit
     * @param {string} dcName - The data center name to remove QPS from
     */
    const handleQpsRemove = (dcName) => {
        const newConfig = { ...localDataCenters };
        // Remove the QPS property entirely from the data center config
        delete newConfig[dcName].QPS;
        setLocalDataCenters(newConfig);
        onUpdate(newConfig); // Auto-save the removal
    };
    
    if (Object.keys(localDataCenters).length === 0) {
        return null;
    }

    return (
        <Card className="border-slate-200 shadow-sm overflow-hidden rounded-lg">
            <CardContent className="space-y-4 pt-6">
                <CardHeader className="flex flex-col space-y-1.5 px-6 py-3 bg-[rgb(59,76,164)] text-white rounded-t-lg mb-4 -mx-6 -mt-6">
                    <CardTitle className="flex items-center gap-2 text-white text-base">
                        <Server className="w-5 h-5 shrink-0" />
                        Data centers
                    </CardTitle>
                </CardHeader>
                <div className="space-y-4">
                    {Object.entries(localDataCenters).map(([dcName, config], index) => (
                        <React.Fragment key={dcName}>
                            <div className="space-y-3 p-4 rounded-lg bg-white border border-slate-200">
                                {/* Header with name and default indicator */}
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <Label className="text-sm font-medium text-slate-700">
                                            {dataCenterNames[dcName] || dcName}
                                        </Label>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleSetDefault(dcName)}
                                        disabled={config.Default || isSaving}
                                        className={toggleChipClassName(
                                            Boolean(config.Default),
                                            `text-xs shrink-0 ${config.Default || isSaving ? "cursor-not-allowed" : ""}`
                                        )}
                                    >
                                        Default
                                    </button>
                                </div>

                                {/* Enabled/Disabled Control */}
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm text-slate-600">Enabled</Label>
                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${config.Enabled ? 'bg-green-100' : 'bg-red-100'}`}>
                                        <Switch
                                            checked={config.Enabled}
                                            onCheckedChange={() => handleToggleEnabled(dcName)}
                                            disabled={isSaving}
                                            className={`${config.Enabled ? 'data-[state=checked]:bg-green-600' : 'data-[state=unchecked]:bg-red-500'}`}
                                        />
                                        <span className={`text-xs font-semibold ${config.Enabled ? 'text-green-800' : 'text-red-800'}`}>
                                            {config.Enabled ? 'ON' : 'OFF'}
                                        </span>
                                    </div>
                                </div>

                                {/* QPS Control */}
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-slate-500" />
                                        <Label className="text-sm text-slate-600">QPS Limit</Label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            value={config.QPS || ''}
                                            onChange={(e) => handleQpsChange(dcName, e.target.value)}
                                            className="w-20 text-xs text-center"
                                            disabled={isSaving}
                                            min="1"
                                            step="100"
                                            placeholder="QPS"
                                        />
                                        <Button
                                            size="sm"
                                            onClick={() => handleQpsSave(dcName)}
                                            disabled={isSaving || !config.QPS || config.QPS <= 0}
                                            className="text-xs bg-green-600 hover:bg-green-700 text-white"
                                        >
                                            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                        </Button>
                                        {/* Remove QPS button - show if QPS field exists (even if 0) */}
                                        {config.QPS !== undefined && (
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => handleQpsRemove(dcName)}
                                                disabled={isSaving}
                                                className="text-xs bg-red-600 hover:bg-red-700"
                                                title="Remove QPS limit"
                                            >
                                                <X className="w-3 h-3" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {index < Object.keys(localDataCenters).length - 1 && <div className="h-2" />}
                        </React.Fragment>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}