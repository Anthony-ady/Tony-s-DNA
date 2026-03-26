import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Loader2, DollarSign } from 'lucide-react';
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

const FeesEditor = ({ value, onSave, isSaving: isParentSaving }) => {
    const [isEnabled, setIsEnabled] = useState(false);
    const [feeValue, setFeeValue] = useState(0);

    // Initialize from value prop
    useEffect(() => {
        if (value && value.dsp !== undefined) {
            setIsEnabled(true);
            setFeeValue(value.dsp * 100); // Convert to percentage
        } else {
            setIsEnabled(false);
            setFeeValue(0);
        }
    }, [value]);

    const handleToggle = async (newEnabled) => {
        setIsEnabled(newEnabled);
        if (newEnabled) {
            // Enable with current fee value
            await onSave({ dsp: feeValue / 100 });
        } else {
            // Disable - remove fees
            await onSave({});
        }
    };

    const handleFeeChange = async (newValue) => {
        const percentageValue = newValue[0];
        setFeeValue(percentageValue);
        if (isEnabled) {
            // Auto-save when slider changes
            await onSave({ dsp: percentageValue / 100 });
        }
    };

    const handleDecrement = async () => {
        const newValue = Math.max(0, feeValue - 1);
        setFeeValue(newValue);
        if (isEnabled) {
            await onSave({ dsp: newValue / 100 });
        }
    };

    const handleIncrement = async () => {
        const newValue = Math.min(100, feeValue + 1);
        setFeeValue(newValue);
        if (isEnabled) {
            await onSave({ dsp: newValue / 100 });
        }
    };

    return (
        <div className="p-3 bg-slate-50/70 rounded-lg border border-slate-200 space-y-4">
            {/* Header with toggle */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <DollarSign className="w-5 h-5 text-slate-500" />
                    <Label className="text-sm font-semibold text-slate-900">DSP fee</Label>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${isEnabled ? 'bg-green-100' : 'bg-red-100'}`}>
                    <Switch
                        checked={isEnabled}
                        onCheckedChange={handleToggle}
                        disabled={isParentSaving}
                        className={`${isEnabled ? 'data-[state=checked]:bg-green-600' : 'data-[state=unchecked]:bg-red-500'}`}
                    />
                    <span className={`text-xs font-semibold ${isEnabled ? 'text-green-800' : 'text-red-800'}`}>
                        {isEnabled ? 'ON' : 'OFF'}
                    </span>
                    {isParentSaving && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                </div>
            </div>

            {/* Fee value slider - only show when enabled */}
            {isEnabled && (
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={handleDecrement}
                            disabled={isParentSaving || feeValue <= 0}
                        >
                            <span className="text-sm">-</span>
                        </Button>
                        <SliderPrimitive.Root
                            value={[feeValue]}
                            onValueChange={handleFeeChange}
                            max={100}
                            min={0}
                            step={1}
                            disabled={isParentSaving}
                            className="relative flex w-full touch-none select-none items-center flex-1"
                        >
                            <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-slate-200">
                                <SliderPrimitive.Range className="absolute h-full bg-blue-600" />
                            </SliderPrimitive.Track>
                            <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-blue-600 bg-blue-600 shadow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
                        </SliderPrimitive.Root>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={handleIncrement}
                            disabled={isParentSaving || feeValue >= 100}
                        >
                            <span className="text-sm">+</span>
                        </Button>
                        <div className="bg-white border border-slate-300 rounded px-3 py-1.5 min-w-[60px] text-center font-semibold text-slate-900">
                            {feeValue.toFixed(0)}%
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FeesEditor;
