import React, { useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from 'lucide-react';

/**
 * Reusable collapsible list of badges (e.g. countries, domains, bundle IDs).
 * Used in BrokerConfigDisplay and DspConfigDisplay for targeting rules.
 */
export default function CollapsibleBadgeList({ items = [], onRemove, limit = 5, icon: Icon, isSaving, inclusionType = 'inclusion' }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!items || items.length === 0) {
    return <span className="text-xs text-slate-400 italic">No items specified</span>;
  }

  const displayedItems = isExpanded ? items : items.slice(0, limit);
  const remainingCount = items.length - limit;

  const baseClass = "font-mono text-xs cursor-pointer hover:bg-red-100 hover:text-red-800 hover:border-red-200 transition-all";
  const inclusionClass = "bg-green-100 text-green-800 border-green-200";
  const exclusionClass = "bg-red-100 text-red-800 border-red-200";
  const badgeClass = `${baseClass} ${inclusionType === 'inclusion' ? inclusionClass : exclusionClass}`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {displayedItems.map(item => (
          <Badge
            key={item}
            onClick={() => onRemove(item)}
            className={badgeClass}
            style={{ pointerEvents: isSaving ? 'none' : 'auto' }}
          >
            {Icon && <Icon className="w-3 h-3 mr-1" />}
            {item}
            <X className="w-3 h-3 ml-1.5 opacity-60 group-hover:opacity-100" />
          </Badge>
        ))}
      </div>
      {remainingCount > 0 && (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs text-indigo-600 hover:text-indigo-800"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Show less' : `... and ${remainingCount} more`}
        </Button>
      )}
    </div>
  );
}
