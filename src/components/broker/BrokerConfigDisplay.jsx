
/**
 * BrokerConfigDisplay Component
 * 
 * This component displays and manages broker configuration settings in a comprehensive interface.
 * It provides functionality for:
 * - Viewing and editing broker basic information (name, URL, seller ID, etc.)
 * - Managing inventory directness settings (DIRECT/RESELLER)
 * - Configuring connector protocols and ad transformation settings
 * - Setting up targeting rules (devices, countries, site domains)
 * - Managing ad kinds and billing configurations
 * 
 * The component is organized into several sections:
 * 1. Basic Information - Name, URL, seller ID, tag ID override
 * 2. Protocol Settings - Connector kind and inventory directness
 * 3. Ad Transformation - Native2Banner, Video2Banner, Video2Native settings
 * 4. Targeting Configuration - Device, country, and domain targeting
 * 5. Ad Kinds Management - Different ad types and their configurations
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Edit3, Save, X, FileJson, Hash, Network, Tag, Globe, DollarSign, Settings, Loader2, 
  Monitor, Smartphone, Tablet, Plus, Trash2, AlertTriangle, ArrowRightLeft, ChevronRight, MapPin, PlusCircle, MinusCircle, Link2
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from "@/components/ui/separator";
import { Switch } from '@/components/ui/switch';
import ToggleSwitch from '@/components/ui/toggle-switch';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import CollapsibleBadgeList from '@/components/shared/CollapsibleBadgeList';


// ===== UTILITY FUNCTIONS AND CONSTANTS =====

/**
 * Returns the appropriate CSS classes for inventory directness badges
 * Provides visual distinction between DIRECT and RESELLER inventory types
 * @param {string} directness - The inventory directness value ('DIRECT' or 'RESELLER')
 * @returns {string} CSS classes for styling the badge
 */
const getDirectnessColor = (directness) => {
    switch (directness) {
        case 'DIRECT': return 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100';
        case 'RESELLER': return 'bg-purple-50 text-purple-800 border-purple-300 hover:bg-purple-100';
        default: return 'bg-slate-50 text-slate-800 border-slate-300 hover:bg-slate-100';
    }
};

/**
 * Mapping of ad kinds to their corresponding API keys and values
 * This defines the different types of ads that can be configured for the broker
 * Each ad kind has a specific key used in API calls and an array of supported values
 */
const ALL_AD_KINDS = {
  'Banner': { key: 'AD_BANNER', value: ['AD_BANNER'] },
  'Native Display': { key: 'AD_TRAFFIC', value: ['NATIVE_1_0', 'NATIVE_1_1', 'NATIVE_1_2'] },
  'Native Video': { key: 'AD_VIDEO', value: ['NATIVE_1_0', 'NATIVE_1_1', 'NATIVE_1_2'] },
  'Video In Banner': { key: 'AD_RAW_VIDEO', value: ['VAST_2_0', 'VAST_3_0', 'VAST'] },
  'Outstream': { key: 'AD_OUTSTREAM', value: ['VAST_2_0', 'VAST_3_0', 'VAST'] },
  'Instream': { key: 'AD_INSTREAM', value: ['VAST_2_0', 'VAST_3_0', 'VAST'] },
};

/**
 * Available device types for targeting configuration
 * These are the device categories that can be targeted in ad campaigns
 */
const ALL_DEVICES = ["DESKTOP", "MOBILE", "TABLET"];

/**
 * TargetingList Component
 * 
 * A reusable component for managing lists of targeting items (countries, domains, etc.)
 * Provides functionality to add, remove, and display targeting items with visual distinction
 * between inclusion (green) and exclusion (red) lists.
 * 
 * @param {string} title - The title displayed above the list
 * @param {Array} items - Array of items currently in the list
 * @param {string} inputValue - Current value in the input field
 * @param {Function} setInputValue - Function to update the input value
 * @param {Function} onAdd - Function called when adding a new item
 * @param {Function} onRemove - Function called when removing an item
 * @param {boolean} isSaving - Whether the component is in a saving state
 * @param {string} placeholder - Placeholder text for the input field
 * @param {string} listType - Type of list ('inclusion' or 'exclusion') for styling
 */
const TargetingList = ({ title, items, inputValue, setInputValue, onAdd, onRemove, isSaving, placeholder, listType }) => {
    /**
     * Handles input field changes
     * Updates the input value state when user types
     */
    const handleInputChange = (e) => {
        setInputValue(e.target.value);
    };

    /**
     * Handles Enter key press in input field
     * Adds the current input value to the list when Enter is pressed
     */
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            onAdd();
        }
    };

    /**
     * Determines badge styling based on list type
     * Inclusion lists use green styling, exclusion lists use red styling
     */
    const badgeClasses = listType === 'inclusion' 
        ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
        : 'bg-rose-100 text-rose-800 border-rose-200';

    return (
        <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200 space-y-3">
            <h4 className="font-semibold text-slate-800 text-xs">{title}</h4>
            <div className="flex flex-wrap gap-1.5 min-h-[24px]">
                {items && items.length > 0 ? (
                    items.map(item => (
                        <Badge
                            key={item}
                            variant="outline"
                            className={`group relative cursor-pointer transition-colors pl-2 pr-5 font-normal ${badgeClasses} hover:bg-red-200 hover:text-red-900 hover:border-red-300`}
                            onClick={() => !isSaving && onRemove(item)}
                        >
                            {item}
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center opacity-50 group-hover:opacity-100">
                                <X className="w-3 h-3" />
                            </div>
                        </Badge>
                    ))
                ) : (
                    <p className="text-xs text-slate-500 italic px-2">No items specified</p>
                )}
            </div>
            <div className="flex items-center gap-2">
                <Input
                    value={inputValue}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="h-9 text-xs font-mono"
                    disabled={isSaving}
                />
                <Button
                    size="icon"
                    onClick={onAdd}
                    disabled={isSaving || !inputValue.trim()}
                    className="h-9 w-9 flex-shrink-0"
                >
                    <Plus className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};


/**
 * Main BrokerConfigDisplay Component
 * 
 * This is the main component that displays and manages broker configuration settings.
 * It provides a comprehensive interface for editing all aspects of broker configuration
 * including basic information, targeting settings, ad transformation rules, and more.
 * 
 * @param {Object} data - The broker data object containing all configuration settings
 * @param {Function} onUpdateName - Callback function to update broker name
 * @param {Function} onUpdateSellerId - Callback function to update seller ID
 * @param {Function} onUpdateUrl - Callback function to update broker URL
 * @param {Function} onUpdateTagIdOverride - Callback function to update tag ID override
 * @param {Function} onUpdateContents - Callback function to update ad transformation contents
 * @param {Function} onUpdateTargeting - Callback function to update targeting settings
 * @param {Function} onUpdateInventoryDirectness - Callback function to update inventory directness
 * @returns {JSX.Element} The complete broker configuration interface
 */
export default function BrokerConfigDisplay({ data, onUpdateName, onUpdateSellerId, onUpdateUrl, onUpdateTagIdOverride, onUpdateContents, onUpdateTargeting, onUpdateInventoryDirectness, onUpdateConnectorKind, onUpdateVisibility, visibleSections }) {
    // ===== STATE MANAGEMENT =====
    // These state variables manage the editing and saving states for different fields
    
    // Name editing state
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState('');
    const [isSavingName, setIsSavingName] = useState(false);

    // Seller ID editing state
    const [isEditingSellerId, setIsEditingSellerId] = useState(false);
    const [editedSellerId, setEditedSellerId] = useState('');
    const [isSavingSellerId, setIsSavingSellerId] = useState(false);

    // URL editing state
    const [isEditingUrl, setIsEditingUrl] = useState(false);
    const [editedUrl, setEditedUrl] = useState('');
    const [isSavingUrl, setIsSavingUrl] = useState(false);

    // Tag ID Override editing state
    const [isEditingTagId, setIsEditingTagId] = useState(false);
    const [editedTagId, setEditedTagId] = useState('');
    const [isSavingTagId, setIsSavingTagId] = useState(false);

    // Ad transformation contents saving state
    const [isSavingContents, setIsSavingContents] = useState(false);
    
    // Targeting configuration saving state
    const [isSavingTargeting, setIsSavingTargeting] = useState(false);
    
    // Inventory directness saving state
    const [isSavingInventoryDirectness, setIsSavingInventoryDirectness] = useState(false);

    // Visibility saving state
    const [isSavingVisibility, setIsSavingVisibility] = useState(false);
    
    // Input values for targeting lists
    const [newCountryInclusion, setNewCountryInclusion] = useState('');
    const [newCountryExclusion, setNewCountryExclusion] = useState('');
    const [newDomainInclusion, setNewDomainInclusion] = useState('');
    const [newDomainExclusion, setNewDomainExclusion] = useState('');
    
    // Editing state for targeting sections
    const [editingCountriesInclusion, setEditingCountriesInclusion] = useState(false);
    const [editingCountriesExclusion, setEditingCountriesExclusion] = useState(false);
    const [editingSiteDomainsInclusion, setEditingSiteDomainsInclusion] = useState(false);
    const [editingSiteDomainsExclusion, setEditingSiteDomainsExclusion] = useState(false);

    // ===== EFFECTS =====
    // Update local state when data changes from parent component
    useEffect(() => {
        setEditedName(data?.name || '');
        setEditedSellerId(data?.seller_id || '');
        setEditedUrl(data?.url || '');
        setEditedTagId(data?.tag_id_override || '');
    }, [data]);

    // ===== DATA VALIDATION =====
    // Return null if no data is provided
    if (!data) return null;

    // ===== DATA DESTRUCTURING =====
    // Extract all necessary fields from the broker data object
    const { 
        uid, 
        name, 
        url, 
        endpoint_id, 
        connector_kind,
        inventory_directness,
        contents = {},
        integration, 
        seller_id,
        tag_id_override,
        visibility,
        targeting: rawTargeting = {}
    } = data;

    // ===== DATA SAFETY =====
    // Ensure targeting is always a valid object to prevent Object.keys() errors
    // This prevents the "Cannot convert undefined or null to object" error
    // that occurs when targeting data is null or undefined from the API
    const targeting = rawTargeting && typeof rawTargeting === 'object' ? rawTargeting : {};

    // ===== EVENT HANDLERS =====
    // These functions handle user interactions and API calls

    /**
     * Handles saving the broker name
     * Validates the input and calls the parent update function
     */
    const handleSaveName = async () => {
        if (!editedName.trim() || !onUpdateName) return;
        setIsSavingName(true);
        try {
            await onUpdateName(editedName.trim());
            setIsEditingName(false);
        } catch (error) {
            console.error('Error while saving name:', error);
        } finally {
            setIsSavingName(false);
        }
    };
    
    /**
     * Handles canceling name editing
     * Resets the edited name to the original value and exits edit mode
     */
    const handleCancelEditName = () => {
        setEditedName(name || '');
        setIsEditingName(false);
    };

    const handleSaveSellerId = async () => {
        if (!onUpdateSellerId) return;
        setIsSavingSellerId(true);
        try {
            // Trim the seller ID, but allow empty string if user wants to clear it
            await onUpdateSellerId(editedSellerId.trim());
            setIsEditingSellerId(false);
        } catch (error) {
            console.error('Error while saving seller ID:', error);
        } finally {
            setIsSavingSellerId(false);
        }
    };
    
    const handleCancelEditSellerId = () => {
        setEditedSellerId(seller_id || '');
        setIsEditingSellerId(false);
    };

    const handleSaveUrl = async () => {
        if (!onUpdateUrl) return;
        setIsSavingUrl(true);
        try {
            await onUpdateUrl(editedUrl.trim());
            setIsEditingUrl(false);
        } catch (error) {
            console.error('Error while saving URL:', error);
        } finally {
            setIsSavingUrl(false);
        }
    };

    const handleCancelEditUrl = () => {
        setEditedUrl(url || '');
        setIsEditingUrl(false);
    };

    const handleSaveTagId = async () => {
        if (!onUpdateTagIdOverride) return;
        setIsSavingTagId(true);
        try {
            await onUpdateTagIdOverride(editedTagId.trim());
            setIsEditingTagId(false);
        } catch (error) {
            console.error('Error while saving TagIdOverride:', error);
        } finally {
            setIsSavingTagId(false);
        }
    };
    
    const handleCancelEditTagId = () => {
        setEditedTagId(tag_id_override || ''); 
        setIsEditingTagId(false);
    };

    const handleToggleInventoryDirectness = async () => {
        if (!onUpdateInventoryDirectness) return;

        setIsSavingInventoryDirectness(true);
        const newDirectness = inventory_directness === 'DIRECT' ? 'RESELLER' : 'DIRECT';

        try {
            await onUpdateInventoryDirectness(newDirectness);
        } catch (error) {
            console.error('Error while updating inventory directness:', error);
        } finally {
            setIsSavingInventoryDirectness(false);
        }
    };

    const handleToggleAdKind = async (adKindConfig, isCurrentlyActive) => {
        if (!onUpdateContents) return;

        setIsSavingContents(true);
        const currentContents = data.contents || {};
        const newContents = { ...currentContents };

        if (isCurrentlyActive) {
            delete newContents[adKindConfig.key];
        } else {
            newContents[adKindConfig.key] = adKindConfig.value;
        }

        try {
            await onUpdateContents(newContents);
        } catch (error) {
            console.error('Error updating contents:', error);
        } finally {
            setIsSavingContents(false);
        }
    };

    const handleToggleDevice = async (deviceToToggle) => {
        if (!onUpdateTargeting) return;

        setIsSavingTargeting(true);
        const currentTargeting = data.targeting || {};
        const currentDevices = currentTargeting.Devices || [];
        
        const isCurrentlyActive = currentDevices.includes(deviceToToggle);
        
        let newDevices;
        if (isCurrentlyActive) {
            newDevices = currentDevices.filter(d => d !== deviceToToggle);
        } else {
            newDevices = [...currentDevices, deviceToToggle];
        }

        const newTargeting = {
            ...currentTargeting,
            Devices: newDevices
        };

        try {
            await onUpdateTargeting(newTargeting);
        } catch (error) {
            console.error('Error updating targeting:', error);
        } finally {
            setIsSavingTargeting(false);
        }
    };

    const handleAddTargetingItems = async (field, newItemsString, itemStateSetter) => {
        const isCountry = field.toLowerCase().includes('countries');
        
        const itemsToAdd = newItemsString.split(',')
            .map(item => item.trim())
            .filter(Boolean)
            .map(item => isCountry ? item.toUpperCase() : item.toLowerCase()); // Normalize domains to lowercase

        if (isCountry) {
            const invalidItems = itemsToAdd.filter(item => item.length !== 3);
            if (invalidItems.length > 0) {
                alert(`Invalid country code(s) found (must be 3 letters): ${invalidItems.join(', ')}`);
                return;
            }
        }

        if (itemsToAdd.length === 0) return;
        if (!onUpdateTargeting) return;

        setIsSavingTargeting(true);
        const currentTargeting = data.targeting || {};
        const currentItems = currentTargeting[field] || [];
        
        const updatedItems = [...new Set([...currentItems, ...itemsToAdd])];

        const newTargeting = { ...currentTargeting, [field]: updatedItems };

        try {
            await onUpdateTargeting(newTargeting);
            itemStateSetter('');
        } catch (error) {
            console.error(`Error updating ${field}:`, error);
        } finally {
            setIsSavingTargeting(false);
        }
    };

    const handleClearTargetingField = async (field) => {
        if (!onUpdateTargeting) return;
        setIsSavingTargeting(true);
        const currentTargeting = data.targeting || {};
        const newTargeting = { ...currentTargeting, [field]: [] };
        try {
            await onUpdateTargeting(newTargeting);
        } catch (error) {
            console.error(`Error clearing ${field}:`, error);
        } finally {
            setIsSavingTargeting(false);
        }
    };

    const handleRemoveTargetingItem = async (field, itemToRemove) => {
        if (!onUpdateTargeting) return;
        setIsSavingTargeting(true);
        const currentTargeting = data.targeting || {};
        const currentItems = currentTargeting[field] || [];
        const newTargeting = {
            ...currentTargeting,
            [field]: currentItems.filter(item => item !== itemToRemove)
        };
        try {
            await onUpdateTargeting(newTargeting);
        } catch (error) {
            console.error(`Error updating ${field}:`, error);
        } finally {
            setIsSavingTargeting(false);
        }
    };

    const formattedConnectorKind = (kind) => {
        if (kind === 'OPEN_RTB_2_5') {
            return 'OPEN RTB 2.5';
        }
        return kind;
    };

    // ===== COMPONENT RENDER =====
    // This section contains the JSX that renders the complete broker configuration interface

    return (
        <Card className="border-slate-200 shadow-sm h-full">
            <CardContent className="space-y-8 pt-6">
                {/* ===== BASIC INFORMATION SECTION ===== */}
                {/* Displays and allows editing of basic broker information */}
                {( !visibleSections || visibleSections.includes('general') ) && (
                <div className="space-y-4" id="general">
                    <div className="px-1 group flex items-center justify-between">
                        <div className="font-semibold tracking-tight text-sm text-slate-800">General info</div>
                        <ChevronRight className={`w-4 h-4 text-blue-700 transition-opacity ${visibleSections && visibleSections.includes('general') ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {uid && (
                            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                                <div className="flex items-center gap-3">
                                    <Hash className="w-5 h-5 text-slate-500" />
                                    <span className="font-medium text-slate-700 text-xs">Broker UID</span>
                                </div>
                                <code className="text-xs font-mono bg-slate-50 text-slate-800 px-2 py-1 rounded">{uid}</code>
                            </div>
                        )}
                        {onUpdateVisibility && (
                            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                                <div className="flex items-center gap-3">
                                    <Settings className="w-5 h-5 text-slate-500" />
                                    <span className="font-medium text-slate-700 text-xs">Status</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isSavingVisibility && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                                    <ToggleSwitch
                                        checked={visibility !== -1}
                                        disabled={isSavingVisibility}
                                        onCheckedChange={async (checked) => {
                                            setIsSavingVisibility(true);
                                            try {
                                                await onUpdateVisibility(checked ? 0 : -1);
                                            } finally {
                                                setIsSavingVisibility(false);
                                            }
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                        {(seller_id !== undefined || isEditingSellerId) && (
                            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                                <div className="flex items-center gap-3">
                                    <Hash className="w-5 h-5 text-slate-500" />
                                    <span className="font-medium text-slate-700 text-xs">Seller ID</span>
                                </div>
                                {isEditingSellerId ? (
                                    <div className="flex items-center gap-2">
                                        <Input value={editedSellerId} onChange={(e) => setEditedSellerId(e.target.value)} className="text-xs font-mono" placeholder="Seller ID" disabled={isSavingSellerId} />
                                        <Button size="sm" onClick={handleSaveSellerId} disabled={isSavingSellerId} className="bg-green-600 hover:bg-green-700"><Save className="w-4 h-4" /></Button>
                                        <Button size="sm" variant="outline" onClick={handleCancelEditSellerId} disabled={isSavingSellerId}><X className="w-4 h-4" /></Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <code className="text-xs font-mono bg-slate-50 text-slate-800 px-2 py-1 rounded">{seller_id || '(not set)'}</code>
                                        <Button size="sm" variant="ghost" onClick={() => setIsEditingSellerId(true)} className="text-slate-500 hover:text-slate-700"><Edit3 className="w-4 h-4" /></Button>
                                    </div>
                                )}
                            </div>
                        )}
                        {(name || isEditingName) && (
                            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                                <div className="flex items-center gap-3">
                                    <span className="font-medium text-slate-700 text-xs">Name</span>
                                </div>
                                {isEditingName ? (
                                    <div className="flex items-center gap-2">
                                        <Input value={editedName} onChange={(e) => setEditedName(e.target.value)} className="text-xs" placeholder="Broker name" disabled={isSavingName} />
                                        <Button size="sm" onClick={handleSaveName} disabled={isSavingName || !editedName.trim()} className="bg-green-600 hover:bg-green-700"><Save className="w-4 h-4" /></Button>
                                        <Button size="sm" variant="outline" onClick={handleCancelEditName} disabled={isSavingName}><X className="w-4 h-4" /></Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-700">{name}</span>
                                        <Button size="sm" variant="ghost" onClick={() => setIsEditingName(true)} className="text-slate-500 hover:text-slate-700"><Edit3 className="w-4 h-4" /></Button>
                                    </div>
                                )}
                            </div>
                        )}
                        {(url || isEditingUrl) && (
                            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                                <div className="flex items-center gap-3">
                                    <Globe className="w-5 h-5 text-slate-500" />
                                    <span className="font-medium text-slate-700 text-xs">URL</span>
                                </div>
                                {isEditingUrl ? (
                                    <div className="flex items-center gap-2">
                                        <Input value={editedUrl} onChange={(e) => setEditedUrl(e.target.value)} className="text-xs font-mono" placeholder="https://example.com" disabled={isSavingUrl} />
                                        <Button size="sm" onClick={handleSaveUrl} disabled={isSavingUrl} className="bg-green-600 hover:bg-green-700"><Save className="w-4 h-4" /></Button>
                                        <Button size="sm" variant="outline" onClick={handleCancelEditUrl} disabled={isSavingUrl}><X className="w-4 h-4" /></Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-[rgb(75,99,226)] hover:text-blue-800 underline font-mono break-all">{url || '(not set)'}</a>
                                        <Button size="sm" variant="ghost" onClick={() => setIsEditingUrl(true)} className="text-slate-500 hover:text-slate-700"><Edit3 className="w-4 h-4" /></Button>
                                    </div>
                                )}
                            </div>
                        )}
                        {/* Tag ID Override - Always show */}
                        <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                            <div className="flex items-center gap-3">
                                <Hash className="w-5 h-5 text-slate-500" />
                                <span className="font-medium text-slate-700 text-xs">Tag ID</span>
                            </div>
                            {isEditingTagId ? (
                                <div className="flex items-center gap-2">
                                    <Input value={editedTagId} onChange={(e) => setEditedTagId(e.target.value)} className="text-xs font-mono" placeholder="Tag ID" disabled={isSavingTagId} />
                                    <Button size="sm" onClick={handleSaveTagId} disabled={isSavingTagId} className="bg-green-600 hover:bg-green-700"><Save className="w-4 h-4" /></Button>
                                    <Button size="sm" variant="outline" onClick={handleCancelEditTagId} disabled={isSavingTagId}><X className="w-4 h-4" /></Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <code className="text-xs font-mono bg-slate-50 text-slate-800 px-2 py-1 rounded">{tag_id_override || '(not set)'}</code>
                                    <Button size="sm" variant="ghost" onClick={() => setIsEditingTagId(true)} className="text-slate-500 hover:text-slate-700"><Edit3 className="w-4 h-4" /></Button>
                                </div>
                            )}
                        </div>

                        {endpoint_id && (
                            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                                <div className="flex items-center gap-3">
                                    <span className="font-semibold text-slate-700 text-xs">Endpoint ID</span>
                                </div>
                                <code className="text-xs font-mono bg-slate-50 text-slate-800 px-2 py-1 rounded">{endpoint_id}</code>
                            </div>
                        )}
                        {connector_kind && (
                            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                                <div className="flex items-center gap-3">
                                    <Network className="w-5 h-5 text-slate-500" />
                                    <span className="font-semibold text-slate-700 text-xs">Protocol</span>
                                </div>
                                {onUpdateConnectorKind ? (
                                    <Select value={connector_kind} onValueChange={onUpdateConnectorKind}>
                                        <SelectTrigger className="w-[180px] h-9">
                                            <SelectValue placeholder="Protocol" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(() => {
                                                const base = ['OPEN_RTB_2_3', 'OPEN_RTB_2_5', 'OPEN_RTB_2_6'];
                                                const opts = base.includes(connector_kind) ? base : [connector_kind, ...base];
                                                return opts.map(opt => (
                                                    <SelectItem key={opt} value={opt}>
                                                        {(() => { const m = opt.match(/(\d+)[_.](\d+)$/); return m ? `OpenRTB ${m[1]}.${m[2]}` : opt; })()}
                                                    </SelectItem>
                                                ));
                                            })()}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Badge variant="outline" className="bg-slate-50 text-slate-800 border-slate-200">{formattedConnectorKind(connector_kind)}</Badge>
                                )}
                            </div>
                        )}
                        {inventory_directness && (
                            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                                <div className="flex items-center gap-3">
                                    <span className="font-semibold text-slate-700 text-xs">Inventory</span>
                                </div>
                                <button
                                    onClick={handleToggleInventoryDirectness}
                                    disabled={isSavingInventoryDirectness}
                                    className="mt-2 sm:mt-0"
                                >
                                    <Badge className={`cursor-pointer hover:opacity-80 transition-opacity ${isSavingInventoryDirectness ? 'opacity-50 cursor-not-allowed' : ''} ${inventory_directness === 'DIRECT' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-indigo-50 text-indigo-800 border-indigo-200'}`}>
                                        {isSavingInventoryDirectness ? (
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                {inventory_directness}
                                            </div>
                                        ) : (
                                            inventory_directness
                                        )}
                                    </Badge>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                )}


                {/* ===== CONTENT TYPES SECTION ===== */}
                {/* Manages ad transformation settings (Native2Banner, Video2Banner, etc.) */}
                {( !visibleSections || visibleSections.includes('contents') ) && (
                <div className="space-y-4">
                    <div className="px-1 group flex items-center justify-between">
                        <div className="font-semibold tracking-tight text-sm text-slate-800">Contents</div>
                        <ChevronRight className={`w-4 h-4 text-blue-700 transition-opacity ${visibleSections && visibleSections.includes('contents') ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(ALL_AD_KINDS).map(([friendlyName, adKindConfig]) => {
                            const isCurrentlyActive = !!(contents && contents[adKindConfig.key]);
                            return (
                                <div key={adKindConfig.key} className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200">
                                    <Label className="text-xs font-medium text-slate-700">{friendlyName}</Label>
                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${isCurrentlyActive ? 'bg-green-100' : 'bg-red-100'}`}>
                                        <Switch
                                            checked={isCurrentlyActive}
                                            onCheckedChange={() => handleToggleAdKind(adKindConfig, isCurrentlyActive)}
                                            disabled={isSavingContents}
                                            className={`${isCurrentlyActive ? 'data-[state=checked]:bg-green-600' : 'data-[state=unchecked]:bg-red-500'}`}
                                        />
                                        <span className={`text-xs font-semibold ${isCurrentlyActive ? 'text-green-800' : 'text-red-800'}`}>
                                            {isCurrentlyActive ? 'ON' : 'OFF'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                )}

                {/* ===== TARGETING CONFIGURATION SECTION ===== */}
                {/* Manages device, country, and domain targeting settings */}
                {/* Always show targeting section, even if empty */}
                {( !visibleSections || visibleSections.includes('targeting') ) && (
                <div className="space-y-6">
                    <div className="px-1 group flex items-center justify-between">
                        <div className="font-semibold tracking-tight text-sm text-slate-800">Targeting</div>
                        <ChevronRight className={`w-4 h-4 text-blue-700 transition-opacity ${visibleSections && visibleSections.includes('targeting') ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Devices */}
                        <div className="p-3 bg-white rounded-lg border border-slate-200 md:col-span-2">
                            <div className="flex items-center gap-3 mb-2">
                                <Monitor className="w-4 h-4 text-slate-500" />
                                <span className="text-xs font-medium text-slate-700">Enabled devices</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {ALL_DEVICES.map(device => {
                                    const isActive = (targeting.Devices || []).includes(device);
                                    return (
                                        <Badge 
                                            key={device} 
                                            variant="outline"
                                            onClick={() => handleToggleDevice(device)}
                                            disabled={isSavingTargeting}
                                            className={`cursor-pointer transition-all rounded-full px-3 ${
                                                isActive 
                                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100' 
                                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                            } ${isSavingTargeting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            {device}
                                        </Badge>
                                    )
                                })}
                            </div>
                        </div>
                        
                        {/* Countries Inclusion */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <Label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                                    <PlusCircle className="w-3.5 h-3.5 text-green-600" />
                                    Countries Inclusion
                                    {isSavingTargeting && <Loader2 className="w-3 h-3 animate-spin" />}
                                </Label>
                                <div className="flex gap-1">
                                    <Button size="sm" variant="ghost" onClick={() => setEditingCountriesInclusion(true)} className="text-slate-500 hover:text-slate-700 h-6 px-2" disabled={isSavingTargeting}><Plus className="w-3 h-3" /></Button>
                                    {(targeting.CountriesInclusion || []).length > 0 && (
                                        <Button size="sm" variant="ghost" onClick={() => handleClearTargetingField('CountriesInclusion')} className="text-red-500 hover:text-red-700 h-6 px-2" disabled={isSavingTargeting} title="Clear all countries">
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                            {editingCountriesInclusion && (
                                <div className="mb-2 flex gap-2">
                                    <Input
                                        value={newCountryInclusion}
                                        onChange={(e) => setNewCountryInclusion(e.target.value.toUpperCase())}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddTargetingItems('CountriesInclusion', newCountryInclusion, setNewCountryInclusion); }}
                                        placeholder="FRA, ITA..."
                                        className="text-xs font-mono h-8"
                                        disabled={isSavingTargeting}
                                    />
                                    <Button size="sm" onClick={() => handleAddTargetingItems('CountriesInclusion', newCountryInclusion, setNewCountryInclusion)} disabled={!newCountryInclusion.trim() || isSavingTargeting || !newCountryInclusion.split(',').some(c => /^[A-Z]{3}$/.test(c.trim()))} className="bg-green-600 hover:bg-green-700 h-8 px-3"><Save className="w-3 h-3" /></Button>
                                    <Button size="sm" variant="outline" onClick={() => { setEditingCountriesInclusion(false); setNewCountryInclusion(''); }} className="h-8 px-3" disabled={isSavingTargeting}><X className="w-3 h-3" /></Button>
                                </div>
                            )}
                            <CollapsibleBadgeList items={targeting.CountriesInclusion || []} onRemove={(country) => handleRemoveTargetingItem('CountriesInclusion', country)} icon={MapPin} isSaving={isSavingTargeting} inclusionType="inclusion" />

                            {/* Countries Exclusion */}
                            <div className="flex items-center justify-between mt-4 mb-2">
                                <Label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                                    <MinusCircle className="w-3.5 h-3.5 text-red-600" />
                                    Countries Exclusion
                                    {isSavingTargeting && <Loader2 className="w-3 h-3 animate-spin" />}
                                </Label>
                                <div className="flex gap-1">
                                    <Button size="sm" variant="ghost" onClick={() => setEditingCountriesExclusion(true)} className="text-slate-500 hover:text-slate-700 h-6 px-2" disabled={isSavingTargeting}><Plus className="w-3 h-3" /></Button>
                                    {(targeting.CountriesExclusion || []).length > 0 && (
                                        <Button size="sm" variant="ghost" onClick={() => handleClearTargetingField('CountriesExclusion')} className="text-red-500 hover:text-red-700 h-6 px-2" disabled={isSavingTargeting} title="Clear all countries">
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                            {editingCountriesExclusion && (
                                <div className="mb-2 flex gap-2">
                                    <Input
                                        value={newCountryExclusion}
                                        onChange={(e) => setNewCountryExclusion(e.target.value.toUpperCase())}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddTargetingItems('CountriesExclusion', newCountryExclusion, setNewCountryExclusion); if (e.key === 'Escape') { setEditingCountriesExclusion(false); setNewCountryExclusion(''); }}}
                                        placeholder="USA, GBR..."
                                        className="text-xs font-mono h-8"
                                        disabled={isSavingTargeting}
                                    />
                                    <Button size="sm" onClick={() => handleAddTargetingItems('CountriesExclusion', newCountryExclusion, setNewCountryExclusion)} disabled={!newCountryExclusion.trim() || isSavingTargeting || !newCountryExclusion.split(',').some(c => /^[A-Z]{3}$/.test(c.trim()))} className="bg-green-600 hover:bg-green-700 h-8 px-3"><Save className="w-3 h-3" /></Button>
                                    <Button size="sm" variant="outline" onClick={() => { setEditingCountriesExclusion(false); setNewCountryExclusion(''); }} className="h-8 px-3" disabled={isSavingTargeting}><X className="w-3 h-3" /></Button>
                                </div>
                            )}
                            <CollapsibleBadgeList items={targeting.CountriesExclusion || []} onRemove={(country) => handleRemoveTargetingItem('CountriesExclusion', country)} icon={MapPin} isSaving={isSavingTargeting} inclusionType="exclusion" />
                        </div>

                        {/* Site Domains Inclusion */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <Label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                                    <PlusCircle className="w-3.5 h-3.5 text-green-600" />
                                    Site Domains Inclusion
                                    {isSavingTargeting && <Loader2 className="w-3 h-3 animate-spin" />}
                                </Label>
                                <div className="flex gap-1">
                                    <Button size="sm" variant="ghost" onClick={() => setEditingSiteDomainsInclusion(true)} className="text-slate-500 hover:text-slate-700 h-6 px-2" disabled={isSavingTargeting}><Plus className="w-3 h-3" /></Button>
                                    {(targeting.SiteDomainsInclusion || []).length > 0 && (
                                        <Button size="sm" variant="ghost" onClick={() => handleClearTargetingField('SiteDomainsInclusion')} className="text-red-500 hover:text-red-700 h-6 px-2" disabled={isSavingTargeting} title="Clear all domains">
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                            {editingSiteDomainsInclusion && (
                                <div className="mb-2 flex gap-2">
                                    <Input
                                        value={newDomainInclusion}
                                        onChange={(e) => setNewDomainInclusion(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddTargetingItems('SiteDomainsInclusion', newDomainInclusion, setNewDomainInclusion); }}
                                        placeholder="example.com, news.org..."
                                        className="text-xs font-mono h-8"
                                        disabled={isSavingTargeting}
                                    />
                                    <Button size="sm" onClick={() => handleAddTargetingItems('SiteDomainsInclusion', newDomainInclusion, setNewDomainInclusion)} disabled={!newDomainInclusion.trim() || isSavingTargeting} className="bg-green-600 hover:bg-green-700 h-8 px-3"><Save className="w-3 h-3" /></Button>
                                    <Button size="sm" variant="outline" onClick={() => { setEditingSiteDomainsInclusion(false); setNewDomainInclusion(''); }} className="h-8 px-3" disabled={isSavingTargeting}><X className="w-3 h-3" /></Button>
                                </div>
                            )}
                            <CollapsibleBadgeList items={targeting.SiteDomainsInclusion || []} onRemove={(domain) => handleRemoveTargetingItem('SiteDomainsInclusion', domain)} icon={Link2} isSaving={isSavingTargeting} inclusionType="inclusion" />

                            {/* Site Domains Exclusion */}
                            <div className="flex items-center justify-between mt-4 mb-2">
                                <Label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                                    <MinusCircle className="w-3.5 h-3.5 text-red-600" />
                                    Site Domains Exclusion
                                    {isSavingTargeting && <Loader2 className="w-3 h-3 animate-spin" />}
                                </Label>
                                <div className="flex gap-1">
                                    <Button size="sm" variant="ghost" onClick={() => setEditingSiteDomainsExclusion(true)} className="text-slate-500 hover:text-slate-700 h-6 px-2" disabled={isSavingTargeting}><Plus className="w-3 h-3" /></Button>
                                    {(targeting.SiteDomainsExclusion || []).length > 0 && (
                                        <Button size="sm" variant="ghost" onClick={() => handleClearTargetingField('SiteDomainsExclusion')} className="text-red-500 hover:text-red-700 h-6 px-2" disabled={isSavingTargeting} title="Clear all domains">
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                            {editingSiteDomainsExclusion && (
                                <div className="mb-2 flex gap-2">
                                    <Input
                                        value={newDomainExclusion}
                                        onChange={(e) => setNewDomainExclusion(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddTargetingItems('SiteDomainsExclusion', newDomainExclusion, setNewDomainExclusion); if (e.key === 'Escape') { setEditingSiteDomainsExclusion(false); setNewDomainExclusion(''); }}}
                                        placeholder="bad.com, other.net..."
                                        className="text-xs font-mono h-8"
                                        disabled={isSavingTargeting}
                                    />
                                    <Button size="sm" onClick={() => handleAddTargetingItems('SiteDomainsExclusion', newDomainExclusion, setNewDomainExclusion)} disabled={!newDomainExclusion.trim() || isSavingTargeting} className="bg-green-600 hover:bg-green-700 h-8 px-3"><Save className="w-3 h-3" /></Button>
                                    <Button size="sm" variant="outline" onClick={() => { setEditingSiteDomainsExclusion(false); setNewDomainExclusion(''); }} className="h-8 px-3" disabled={isSavingTargeting}><X className="w-3 h-3" /></Button>
                                </div>
                            )}
                            <CollapsibleBadgeList items={targeting.SiteDomainsExclusion || []} onRemove={(domain) => handleRemoveTargetingItem('SiteDomainsExclusion', domain)} icon={Link2} isSaving={isSavingTargeting} inclusionType="exclusion" />
                        </div>
                        
                        {/* Placeholder for grid layout */}
                        <div />
                    </div>
                </div>
                )}
            </CardContent>
        </Card>
    );
}
