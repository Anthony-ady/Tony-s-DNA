import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, TrendingUp, BarChart3, Calendar } from 'lucide-react';
import { TAILWIND_CLASSES } from '@/config/theme';
import { getAnalyticsSummaryValue } from '@/utils/hourlyProjections';

function SummaryCardGrid({ stats, formatCurrencyFn, variant = 'real' }) {
  const isEstimated = variant === 'estimated';
  const cardClass = isEstimated
    ? 'border-blue-200 bg-blue-50/60 shadow-sm'
    : 'border-slate-200 shadow-sm';
  const valueClass = isEstimated ? 'text-blue-600' : undefined;

  const dsp = getAnalyticsSummaryValue(stats, 'dspRevenue');
  const publisher = getAnalyticsSummaryValue(stats, 'publisher');
  const margin = getAnalyticsSummaryValue(stats, 'margin');
  const marginPct = getAnalyticsSummaryValue(stats, 'marginPct');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className={cardClass}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className={TAILWIND_CLASSES.formSectionLabel}>DSP Revenue</p>
              <p className={`text-lg lg:text-xl font-bold text-green-600 ${valueClass || ''}`}>
                {formatCurrencyFn(dsp)}
              </p>
              {!isEstimated && stats?.yesterdayTotalDspRevenue !== undefined && (
                <div className="text-sm text-slate-500 mt-1">
                  Yesterday: {formatCurrencyFn(stats.yesterdayTotalDspRevenue || 0)}
                </div>
              )}
            </div>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isEstimated ? 'bg-gradient-to-br from-blue-400 to-blue-600' : 'bg-gradient-to-br from-green-500 to-green-600'}`}>
              <DollarSign className="w-4 h-4 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={cardClass}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className={TAILWIND_CLASSES.formSectionLabel}>Publisher Costs</p>
              <p className={`text-lg lg:text-xl font-bold text-red-600 ${valueClass || ''}`}>
                {formatCurrencyFn(publisher)}
              </p>
              {!isEstimated && stats?.yesterdayTotalPublisherRevenue !== undefined && (
                <div className="text-sm text-slate-500 mt-1">
                  Yesterday: {formatCurrencyFn(stats.yesterdayTotalPublisherRevenue || 0)}
                </div>
              )}
            </div>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isEstimated ? 'bg-gradient-to-br from-blue-400 to-blue-600' : 'bg-gradient-to-br from-red-500 to-red-600'}`}>
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={cardClass}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className={TAILWIND_CLASSES.formSectionLabel}>Margin</p>
              <p
                className={`text-lg lg:text-xl font-bold ${valueClass || ''}`}
                style={isEstimated ? undefined : { color: 'rgb(79, 70, 229)' }}
              >
                {formatCurrencyFn(margin)}
              </p>
              {!isEstimated && stats?.yesterdayTotalMargin !== undefined && (
                <div className="text-sm text-slate-500 mt-1">
                  Yesterday: {formatCurrencyFn(stats.yesterdayTotalMargin || 0)}
                </div>
              )}
            </div>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isEstimated ? 'bg-gradient-to-br from-blue-400 to-blue-600' : 'bg-gradient-to-br from-[rgb(75,99,226)] to-purple-600'}`}>
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={cardClass}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className={TAILWIND_CLASSES.formSectionLabel}>Avg Margin %</p>
              <p className={`text-lg lg:text-xl font-bold text-orange-600 ${valueClass || ''}`}>
                {Number(marginPct ?? 0).toFixed(1)}%
              </p>
              {!isEstimated && stats?.yesterdayAvgMarginPercentage !== undefined && (
                <div className="text-sm text-slate-500 mt-1">
                  Yesterday: {stats.yesterdayAvgMarginPercentage || 0}%
                </div>
              )}
            </div>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isEstimated ? 'bg-gradient-to-br from-blue-400 to-blue-600' : 'bg-gradient-to-br from-orange-500 to-orange-600'}`}>
              <Calendar className="w-4 h-4 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function HourlyAnalyticsSummaryCards({ summaryStats, viewMode, formatCurrencyFn }) {
  if (viewMode !== 'hourly' || !summaryStats) {
    return null;
  }

  const estimated = summaryStats.estimated;

  if (!estimated) {
    return <SummaryCardGrid stats={summaryStats} formatCurrencyFn={formatCurrencyFn} />;
  }

  return (
    <div className="col-span-full w-full max-w-full space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-600 mb-2">Real time (received data only)</p>
        <SummaryCardGrid stats={summaryStats} formatCurrencyFn={formatCurrencyFn} />
      </div>
      <div>
        <p className="text-sm font-medium text-blue-700 mb-2">
          Estimated (full day, including hourly projections)
        </p>
        <SummaryCardGrid stats={estimated} formatCurrencyFn={formatCurrencyFn} variant="estimated" />
      </div>
    </div>
  );
}
