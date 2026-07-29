/**
 * Dashboard 2 — PubMatic-style overview powered by live Dashboard APIs.
 * Does not replace the existing Dashboard.jsx.
 */

import { BarChart3, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  KpiCardGrid,
  FunnelSection,
  RankedTableCard,
  DistributionTables,
} from './dashboard2/Dashboard2Widgets';
import { useDashboard2Data } from './dashboard2/useDashboard2Data';

const hasTopDealsRows = (topDeals) =>
  Object.values(topDeals).some((view) => view?.rows?.length > 0);

const hasTopDemandRows = (topDemandSources) =>
  Object.values(topDemandSources).some((view) => view?.rows?.length > 0);

export default function Dashboard2() {
  const {
    loading,
    error,
    refetch,
    chartDates,
    kpiCards,
    adRequestFlow,
    topDeals,
    topDemandSources,
    adDistribution,
  } = useDashboard2Data();

  const distributionSections = [
    { title: 'Device', rows: adDistribution.platform },
    { title: 'Ad Format', rows: adDistribution.adFormat },
  ].filter((section) => section.rows.length > 0);

  return (
    <div className="bg-slate-50 flex flex-col min-h-screen">
      <div className="flex flex-col p-3 lg:p-12 space-y-6 max-w-[1600px] w-full mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[rgb(75,99,226)]" />
            <span className="text-sm text-slate-600">Dashboard 2 — Overview</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs font-medium">
              Live data
            </Badge>
            <Button variant="outline" size="sm" onClick={refetch} disabled={loading} className="h-8 gap-1.5">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading && kpiCards.length === 0 ? (
          <div className="flex items-center justify-center py-24 text-slate-500 gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading dashboard data…
          </div>
        ) : (
          <>
            <KpiCardGrid cards={kpiCards} chartDates={chartDates} loading={loading} />

            <FunnelSection rows={adRequestFlow} loading={loading} />

            {hasTopDealsRows(topDeals) && (
              <RankedTableCard
                title="Top Deals"
                viewByData={topDeals}
                viewByOptions={['Gross Revenue', 'Net Revenue', 'Impressions']}
                nameColumnLabel="Deals"
                footerLink="View All Deals"
              />
            )}

            {hasTopDemandRows(topDemandSources) && (
              <RankedTableCard
                title="Top Demand Sources"
                viewByData={topDemandSources}
                viewByOptions={['DSPs', 'Buyers', 'Seats']}
                viewByDefault="DSPs"
                nameColumnLabel="DSP"
              />
            )}

            {distributionSections.length > 0 && (
              <DistributionTables sections={distributionSections} loading={loading} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
