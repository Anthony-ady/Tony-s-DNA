import React from 'react';
import { Switch } from '@/components/ui/switch';

// Toggle Switch Component with ON/OFF labels matching Broker page style
// If checked is undefined, displays in gray without ON/OFF label
const ToggleSwitch = ({ checked, onCheckedChange }) => {
  const isUndefined = checked === undefined;
  
  return (
    <div className="flex items-center gap-2">
      {!isUndefined && (
        <span className={`text-xs font-medium px-2 py-1 rounded ${checked ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {checked ? 'ON' : 'OFF'}
        </span>
      )}
      {isUndefined && (
        <span className="text-xs font-medium px-2 py-1 rounded bg-gray-100 text-gray-500">
          —
        </span>
      )}
      <Switch
        checked={checked ?? false}
        onCheckedChange={onCheckedChange}
        className={isUndefined ? 'data-[state=checked]:bg-gray-400 data-[state=unchecked]:bg-gray-400' : 'data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-red-600'}
      />
    </div>
  );
};

export default ToggleSwitch;

