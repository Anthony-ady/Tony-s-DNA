import { useCallback } from 'react';
import { ArrowUpRight, ArrowDownRight, Info } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function useAnalyticsTrendHelpers() {
  const formatTrendChange = useCallback((value) => {
    if (value === null || value === undefined) {
      return { display: '0.0', numeric: 0 };
    }

    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return { display: value ?? '0.0', numeric: 0 };
    }

    return { display: numeric.toFixed(1), numeric };
  }, []);

  const renderTrendIndicator = useCallback((trend, changePercent, { upColor = 'text-green-500', downColor = 'text-red-500', showPlus = true } = {}) => {
    const { display, numeric } = formatTrendChange(changePercent);
    const shouldShowPlus = showPlus && numeric >= 0;

    return (
      <div className="flex items-center justify-center gap-1">
        {trend === 'up' ? (
          <>
            <ArrowUpRight className={`w-4 h-4 ${upColor}`} />
            <span className={`${upColor} text-xs font-medium`}>
              {shouldShowPlus ? '+' : ''}
              {display}%
            </span>
          </>
        ) : trend === 'down' ? (
          <>
            <ArrowDownRight className={`w-4 h-4 ${downColor}`} />
            <span className={`${downColor} text-xs font-medium`}>{display}%</span>
          </>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        )}
      </div>
    );
  }, [formatTrendChange]);

  const renderTooltipHeader = useCallback((label, tooltipText, className = '') => (
    <TableHead className={`text-center ${className}`.trim()}>
      <TooltipProvider delayDuration={200}>
        <UiTooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center justify-center gap-1 cursor-help">
              {label}
              <Info className="w-4 h-4 text-slate-400" aria-hidden="true" />
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-sm bg-[rgb(40,62,173)] text-white border-none">
            {tooltipText}
          </TooltipContent>
        </UiTooltip>
      </TooltipProvider>
    </TableHead>
  ), []);

  return { renderTrendIndicator, renderTooltipHeader };
}
