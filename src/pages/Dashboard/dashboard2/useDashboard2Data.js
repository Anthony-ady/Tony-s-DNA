import { useCallback, useEffect, useRef, useState } from 'react';
import { authService } from '@/services/authService';
import { cachedFetch } from '@/utils/apiCache';
import { API_ENDPOINTS } from '@/config/api';
import { formatError } from '@/utils/errorFormatter';
import {
  buildFunnelRows,
  buildKpiCards,
  buildTopDealsByView,
  buildTopDemandSourcesByView,
  DEMAND_SOURCE_VIEWS,
  getDealKey,
  mapAdKindDistribution,
  mapDeviceDistribution,
  processDailyNetworkOpsRows,
} from './dashboard2Mappers';
import {
  calculateDatesFromTimeRange,
  countInclusiveDays,
  countNetworkOpsDays,
  getNetworkOpsInterval,
  getPreviousPeriod,
  getTimeRange,
  getYesterdayDateStr,
} from './dateRange';

function extractDataArray(result) {
  if (Array.isArray(result?.Data)) return result.Data;
  if (Array.isArray(result)) return result;
  return [];
}

async function druidSearch(token, payload) {
  const response = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-ayl-auth-token': token,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(formatError(new Error(`HTTP error! status: ${response.status}`), response));
  }

  return response.json();
}

function fetchNetworkOpsDaily(token, start, end) {
  const interval = getNetworkOpsInterval(start, end);
  if (!interval) return Promise.resolve([]);

  return druidSearch(token, {
    Datasource: 'network_operations',
    Metrics: [
      'network_operations_bid_requests',
      'network_operations_bid_responses',
      'network_operations_impressions',
      'network_operations_click',
      'network_operations_price_publisher',
      'network_operations_price_advertiser',
    ],
    Dimensions: [],
    TimeZone: 'Etc/GMT',
    Granularity: { type: 'period', period: 'P1D' },
    Intervals: [{ Begin: interval.begin.toISOString(), End: interval.end.toISOString() }],
  }).then(extractDataArray);
}

function fetchDeviceData(token, start, end) {
  const begin = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T23:59:59.999Z`);

  return druidSearch(token, {
    Intervals: [{ Begin: begin.toISOString(), End: endDate.toISOString() }],
    Metrics: ['PricePublisher', 'PriceAdvertiser_PublisherSide', 'IMPRESSION'],
    Dimensions: ['DEVICE'],
    Granularity: 'all',
    Datasource: 'adserver_stats',
    TimeZone: 'Etc/GMT',
  }).then((result) =>
    extractDataArray(result).map((item) => ({
      ...item,
      device: item.Device || item.DEVICE || 'Unknown',
    }))
  );
}

function fetchAdKindData(token, start, end) {
  const interval = getNetworkOpsInterval(start, end);
  if (!interval) return Promise.resolve([]);

  return druidSearch(token, {
    Intervals: [{ Begin: interval.begin.toISOString(), End: interval.end.toISOString() }],
    Metrics: [
      'network_operations_impressions',
      'network_operations_price_publisher',
      'network_operations_price_advertiser',
    ],
    Dimensions: ['adKind'],
    Granularity: 'all',
    Datasource: 'network_operations',
    TimeZone: 'Etc/GMT',
  }).then((result) =>
    extractDataArray(result).filter(
      (item) => item.adKind && item.adKind !== 'Unknown' && item.adKind !== 'unknown'
    )
  );
}

function fetchTopDeals(token, start, end) {
  const interval = getNetworkOpsInterval(start, end);
  if (!interval) return Promise.resolve([]);

  return druidSearch(token, {
    Datasource: 'network_operations',
    Metrics: [
      'network_operations_price_advertiser',
      'network_operations_price_publisher',
      'network_operations_impressions',
      'DealName',
    ],
    Dimensions: ['DealId'],
    TimeZone: 'Etc/GMT',
    Granularity: 'all',
    Intervals: [{ Begin: interval.begin.toISOString(), End: interval.end.toISOString() }],
    OrderBy: 'network_operations_price_advertiser',
    OrderOp: 'DESC',
    Size: 1500,
    AddTotalRow: true,
  }).then((result) => extractDataArray(result).filter((item) => getDealKey(item)));
}

function fetchTopDealsYesterday(token) {
  const yesterday = getYesterdayDateStr();
  return fetchTopDeals(token, yesterday, yesterday);
}

function fetchTopDemandSources(token, start, end, config) {
  const begin = new Date(`${start}T00:00:00.000Z`).toISOString();
  const endDate = new Date(`${end}T23:59:59.999Z`).toISOString();

  return druidSearch(token, {
    Intervals: [{ Begin: begin, End: endDate }],
    Metrics: config.metrics,
    Dimensions: [config.dimension],
    Granularity: 'all',
    ...(config.view ? { View: config.view } : {}),
    Datasource: 'adserver_stats',
    OrderBy: 'PriceAdvertiser_PublisherSide',
    OrderOp: 'DESC',
    Size: config.size || 500,
    AddTotalRow: true,
    TimeZone: 'Etc/GMT',
  }).then((result) => extractDataArray(result).filter((item) => config.getKey(item)));
}

async function fetchAllDemandSourceViews(token, start, end) {
  const yesterday = getYesterdayDateStr();
  const entries = await Promise.all(
    Object.entries(DEMAND_SOURCE_VIEWS).map(async ([label, config]) => {
      const [periodRows, yesterdayRows] = await Promise.all([
        fetchTopDemandSources(token, start, end, config),
        fetchTopDemandSources(token, yesterday, yesterday, config),
      ]);
      return [label, { periodRows, yesterdayRows }];
    })
  );
  return Object.fromEntries(entries);
}

const EMPTY_WIDGETS = {
  chartDates: [],
  kpiCards: [],
  adRequestFlow: [],
  topDeals: {},
  topDemandSources: {},
  adDistribution: { platform: [], adFormat: [], channel: [] },
};

export function useDashboard2Data() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [widgets, setWidgets] = useState(EMPTY_WIDGETS);
  const loadSeqRef = useRef(0);

  const loadData = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);

    try {
      const token = authService.getToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const range = getTimeRange();
      const { start, end } = calculateDatesFromTimeRange(range);
      const previous = getPreviousPeriod(start, end);

      const [
        currentDailyRaw,
        previousDailyRaw,
        deviceRaw,
        adKindRaw,
        topDealsPeriodRaw,
        topDealsYesterdayRaw,
        demandSourceDataByView,
      ] = await Promise.all([
        fetchNetworkOpsDaily(token, start, end),
        fetchNetworkOpsDaily(token, previous.start, previous.end),
        fetchDeviceData(token, start, end),
        fetchAdKindData(token, start, end),
        fetchTopDeals(token, start, end),
        fetchTopDealsYesterday(token),
        fetchAllDemandSourceViews(token, start, end),
      ]);

      if (seq !== loadSeqRef.current) return;

      const currentRows = processDailyNetworkOpsRows(currentDailyRaw);
      const previousRows = processDailyNetworkOpsRows(previousDailyRaw);
      const { chartDates, cards } = buildKpiCards(currentRows, previousRows);
      const funnelRows = buildFunnelRows(currentRows);

      const dealDayCount = countNetworkOpsDays(start, end);
      const dspDayCount = countInclusiveDays(start, end);

      const topDeals = buildTopDealsByView(topDealsPeriodRaw, topDealsYesterdayRaw, dealDayCount);

      const topDemandSources = buildTopDemandSourcesByView(demandSourceDataByView, dspDayCount);

      setWidgets({
        chartDates,
        kpiCards: cards,
        adRequestFlow: funnelRows,
        topDeals,
        topDemandSources,
        adDistribution: {
          platform: mapDeviceDistribution(deviceRaw),
          adFormat: mapAdKindDistribution(adKindRaw),
          channel: [],
        },
      });
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      setError(typeof err === 'string' ? err : err.message || 'Failed to load dashboard data');
      setWidgets(EMPTY_WIDGETS);
    } finally {
      if (seq === loadSeqRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const handleTimeRangeChange = () => loadData();

    window.addEventListener('timeRangeChanged', handleTimeRangeChange);

    return () => {
      window.removeEventListener('timeRangeChanged', handleTimeRangeChange);
    };
  }, [loadData]);

  return { loading, error, refetch: loadData, ...widgets };
}
