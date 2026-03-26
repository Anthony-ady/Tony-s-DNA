import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Loader2, Globe, ChevronRight } from 'lucide-react';

const InventoryAccessToggles = ({ data, onUpdate, isSaving }) => {
    const [isSavingLocal, setIsSavingLocal] = useState(false);

    const handleToggle = async (key, newValue) => {
        if (isSavingLocal) return;
        setIsSavingLocal(true);
        try {
            await onUpdate({ [key]: newValue });
        } catch (error) {
            console.error(`Error updating ${key}:`, error);
        } finally {
            setIsSavingLocal(false);
        }
    };

    const accessTypes = [
        { key: 'inventory_access_broker', label: 'Broker' },
        { key: 'inventory_access_in_app', label: 'In-App' },
        { key: 'inventory_access_prebid', label: 'Prebid Client' },
        { key: 'inventory_access_prebid_server', label: 'Prebid Server' }
    ];

    return (
        <div className="grid grid-cols-1 gap-4">
            {accessTypes.map(({ key, label }) => {
                const isEnabled = data?.[key] || false;
                return (
                    <div key={key} className="p-3 bg-slate-50/70 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Globe className="w-4 h-4 text-slate-500" />
                                <span className="font-semibold text-slate-700 text-sm">{label}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${isEnabled ? 'bg-green-100' : 'bg-red-100'}`}>
                                    <Switch
                                        checked={isEnabled}
                                        onCheckedChange={(newValue) => handleToggle(key, newValue)}
                                        disabled={isSavingLocal || isSaving}
                                        className={`${isEnabled ? 'data-[state=checked]:bg-green-600' : 'data-[state=unchecked]:bg-red-500'}`}
                                    />
                                    <span className={`text-xs font-semibold ${isEnabled ? 'text-green-800' : 'text-red-800'}`}>
                                        {isEnabled ? 'ON' : 'OFF'}
                                    </span>
                                </div>
                                {(isSavingLocal || isSaving) && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default function DspInventoryAccessSidebar({ data, onUpdateInventoryAccess, isSaving }) {
    if (!data) return null;
    
    return (
        <Card className="border-slate-200 shadow-sm">
            <CardContent className="pt-4">
                <div className="px-1 mb-2 group flex items-center justify-between">
                    <div className="font-semibold tracking-tight text-sm text-slate-800">Inventory Access</div>
                    <ChevronRight className="w-4 h-4 text-blue-700 opacity-100" />
                </div>
                <InventoryAccessToggles 
                    data={data} 
                    onUpdate={onUpdateInventoryAccess} 
                    isSaving={isSaving} 
                />
            </CardContent>
        </Card>
    );
}