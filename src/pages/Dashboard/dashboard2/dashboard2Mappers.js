import {
  formatCurrency,
  formatCurrencyRaw,
  formatEcpm,
  formatLargeNumber,
  formatLargeNumberCompact,
  formatPercentage,
} from '@/utils/formatters';

const AD_KIND_LABELS = {
  AD_TRAFFIC: 'NATIVE DISPLAY',
  AD_OUTSTREAM: 'OUTSTREAM',
  AD_INSTREAM: 'INSTREAM',
  AD_RAW_VIDEO: 'VIDEO IN BANNER',
  AD_VIDEO: 'NATIVE VIDEO',
  AD_BANNER: 'DISPLAY',
};

function microToDollars(value) {
  return (value || 0) / 1_000_000;
}

function getAdKindLabel(adKind) {
  return AD_KIND_LABELS[adKind] || adKind || 'Unknown';
}

function formatChartDate(date) {
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

function pctChange(current, previous) {
  if (!previous || previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

function sumMetric(rows, key) {
  return rows.reduce((sum, row) => sum + (row[key] || 0), 0);
}

export function processDailyNetworkOpsRows(rawRows) {
  const rows = Array.isArray(rawRows) ? rawRows : [];
  return rows
    .map((item) => {
      const date = cleanItemDate(item.timestamp);
      if (!date) return null;

      const bidRequests = item.network_operations_bid_requests || 0;
      const bidResponses = item.network_operations_bid_responses || 0;
      const impressions = item.network_operations_impressions || 0;
      const clicks = item.network_operations_click ?? item.network_operations_clicks ?? 0;
      const grossMicro = (item.network_operations_price_advertiser || 0) * 1_000_000;
      const netMicro = (item.network_operations_price_publisher || 0) * 1_000_000;

      return {
        date,
        dateLabel: formatChartDate(date),
        dateKey: date.toISOString().slice(0, 10),
        bidRequests,
        bidResponses,
        impressions,
        clicks,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        grossMicro,
        netMicro,
        fillRate: bidRequests > 0 ? (impressions / bidRequests) * 100 : 0,
        grossEcpm: impressions > 0 ? microToDollars(grossMicro) / (impressions / 1000) : 0,
        netEcpm: impressions > 0 ? microToDollars(netMicro) / (impressions / 1000) : 0,
        rpbr: bidRequests > 0 ? microToDollars(grossMicro) / bidRequests * 1_000_000 : 0,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date);
}

function cleanItemDate(timestamp) {
  if (!timestamp) return null;
  let clean = timestamp.replace(/\.\d{6}/g, '');
  if (!clean.endsWith('Z') && !clean.includes('+')) clean += 'Z';
  const date = new Date(clean);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildKpiCards(currentRows, previousRows) {
  const chartDates = currentRows.map((row) => row.dateLabel);
  const totalGrossMicro = sumMetric(currentRows, 'grossMicro');
  const totalNetMicro = sumMetric(currentRows, 'netMicro');
  const prevGrossMicro = sumMetric(previousRows, 'grossMicro');
  const prevNetMicro = sumMetric(previousRows, 'netMicro');
  const totalImpressions = sumMetric(currentRows, 'impressions');
  const totalBidRequests = sumMetric(currentRows, 'bidRequests');
  const avgFillRate = totalBidRequests > 0 ? (totalImpressions / totalBidRequests) * 100 : 0;
  const avgGrossEcpm = totalImpressions > 0 ? microToDollars(totalGrossMicro) / (totalImpressions / 1000) : 0;
  const avgNetEcpm = totalImpressions > 0 ? microToDollars(totalNetMicro) / (totalImpressions / 1000) : 0;
  const avgRpbr = totalBidRequests > 0 ? microToDollars(totalGrossMicro) / totalBidRequests * 1_000_000 : 0;

  const totalClicks = sumMetric(currentRows, 'clicks');
  const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  const prevBidRequests = sumMetric(previousRows, 'bidRequests');
  const prevImpressions = sumMetric(previousRows, 'impressions');
  const prevClicks = sumMetric(previousRows, 'clicks');
  const prevCtr = prevImpressions > 0 ? (prevClicks / prevImpressions) * 100 : 0;
  const prevFillRate =
    prevBidRequests > 0 ? (prevImpressions / prevBidRequests) * 100 : 0;
  const prevRpbr =
    prevBidRequests > 0 ? microToDollars(sumMetric(previousRows, 'grossMicro')) / prevBidRequests * 1_000_000 : 0;

  const grossSeries = currentRows.map((row) => microToDollars(row.grossMicro));
  const netSeries = currentRows.map((row) => microToDollars(row.netMicro));
  const ctrSeries = currentRows.map((row) => row.ctr);
  const ecpmSeries = currentRows.map((row) => row.grossEcpm);
  const netEcpmSeries = currentRows.map((row) => row.netEcpm);
  const requestSeries = currentRows.map((row) => row.bidRequests / 1_000_000);
  const rpbrSeries = currentRows.map((row) => row.rpbr);
  const fillRateSeries = currentRows.map((row) => row.fillRate);

  return {
    chartDates,
    cards: [
      {
        id: 'gross-revenue',
        title: 'Revenue',
        chartType: 'dual',
        series: [
          { key: 'advertiser', color: '#7eb8e8', data: grossSeries },
          { key: 'publisher', color: '#b8a8e8', data: netSeries },
        ],
        stats: [
          {
            label: 'Price Advertiser',
            value: formatCurrency(totalGrossMicro),
            color: 'text-[#3b82c4]',
            change: pctChange(totalGrossMicro, prevGrossMicro),
          },
          {
            label: 'Price Publisher',
            value: formatCurrency(totalNetMicro),
            color: 'text-[#8b7ec8]',
            change: pctChange(totalNetMicro, prevNetMicro),
          },
        ],
      },
      {
        id: 'ctr',
        title: 'CTR',
        subtitle: `${formatLargeNumber(totalClicks)} Clicks | ${formatLargeNumber(totalImpressions)} Impressions`,
        chartType: 'single',
        series: [{ key: 'v', color: '#7eb8e8', data: ctrSeries }],
        stats: [
          { label: 'Last 7 Days', value: formatPercentage(avgCtr) },
          {
            change: pctChange(avgCtr, prevCtr),
            previous: formatPercentage(prevCtr),
            previousLabel: 'Previous Period',
          },
        ],
      },
      {
        id: 'ecpm',
        title: 'eCPM',
        chartType: 'dual',
        series: [
          { key: 'ecpm', color: '#7eb8e8', data: ecpmSeries },
          { key: 'netEcpm', color: '#b8a8e8', data: netEcpmSeries },
        ],
        stats: [
          { label: 'eCPM', value: formatEcpm(avgGrossEcpm), color: 'text-[#3b82c4]' },
          { label: 'Net eCPM', value: formatEcpm(avgNetEcpm), color: 'text-[#8b7ec8]' },
        ],
      },
      {
        id: 'total-requests',
        title: 'Total Requests',
        chartType: 'single',
        series: [{ key: 'v', color: '#7eb8e8', data: requestSeries }],
        stats: [
          { label: 'Last 7 Days', value: formatLargeNumberCompact(totalBidRequests) },
          {
            change: pctChange(totalBidRequests, prevBidRequests),
            previous: formatLargeNumberCompact(prevBidRequests),
            previousLabel: 'Previous Period',
          },
        ],
      },
      {
        id: 'gross-ecpm',
        title: 'RPBR',
        chartType: 'single',
        series: [{ key: 'v', color: '#7eb8e8', data: rpbrSeries }],
        stats: [
          { label: 'Last 7 Days', value: formatCurrencyRaw(avgRpbr) },
          {
            change: pctChange(avgRpbr, prevRpbr),
            previous: formatCurrencyRaw(prevRpbr),
            previousLabel: 'Previous Period',
          },
        ],
      },
      {
        id: 'fill-rate',
        title: 'Fill Rate',
        subtitle: `${formatLargeNumber(totalImpressions)} Monetized`,
        chartType: 'single',
        series: [{ key: 'v', color: '#7eb8e8', data: fillRateSeries }],
        stats: [
          { label: 'Last 7 Days', value: formatPercentage(avgFillRate) },
          {
            change: pctChange(avgFillRate, prevFillRate),
            previous: formatPercentage(prevFillRate),
            previousLabel: 'Previous Period',
          },
        ],
      },
    ],
  };
}

export function buildFunnelRows(currentRows) {
  const bidRequests = sumMetric(currentRows, 'bidRequests');
  const bidResponses = sumMetric(currentRows, 'bidResponses');
  const impressions = sumMetric(currentRows, 'impressions');

  return [
    {
      stage: 'Total Ad Requests',
      value: formatLargeNumberCompact(bidRequests),
      pct: 100,
    },
    {
      stage: 'Bid Responses',
      value: formatLargeNumberCompact(bidResponses),
      pct: bidRequests > 0 ? (bidResponses / bidRequests) * 100 : 0,
    },
    {
      stage: 'Paid Impressions',
      value: formatLargeNumber(impressions),
      pct: bidRequests > 0 ? (impressions / bidRequests) * 100 : 0,
    },
  ];
}

export function buildDistributionRows(items, getLabel, getGross, getNet, getImpressions) {
  return items
    .map((item) => {
      const gross = getGross(item);
      const net = getNet(item);
      const impressions = getImpressions(item);
      const ecpm = impressions > 0 ? gross / (impressions / 1000) : 0;
      const netEcpm = impressions > 0 ? net / (impressions / 1000) : 0;
      return {
        label: getLabel(item),
        gross,
        net,
        impressions,
        ecpm,
        netEcpm,
      };
    })
    .filter((row) => row.gross > 0 || row.impressions > 0)
    .sort((a, b) => b.gross - a.gross);
}

export function mapDeviceDistribution(deviceItems) {
  return buildDistributionRows(
    deviceItems,
    (item) => item.device || item.Device || item.DEVICE || 'Unknown',
    (item) => microToDollars(item.PriceAdvertiser_PublisherSide),
    (item) => microToDollars(item.PricePublisher),
    (item) => item.IMPRESSION ?? item.Impression ?? item.impressions ?? 0
  );
}

export function mapAdKindDistribution(adKindItems) {
  return buildDistributionRows(
    adKindItems,
    (item) => getAdKindLabel(item.adKind),
    (item) => item.network_operations_price_advertiser || 0,
    (item) => item.network_operations_price_publisher || 0,
    (item) => item.network_operations_impressions || 0
  );
}

export function buildRankedRevenueRowsFromPeriod({
  periodRows,
  yesterdayRows,
  getKey,
  getName,
  getRevenueDollars,
  periodDayCount,
  limit = 5,
}) {
  const yesterdayByKey = new Map();
  yesterdayRows.forEach((row) => {
    const key = getKey(row);
    if (key) yesterdayByKey.set(key, getRevenueDollars(row));
  });

  const entries = periodRows
    .map((row) => {
      const key = getKey(row);
      if (!key) return null;
      const total = getRevenueDollars(row);
      const yesterday = yesterdayByKey.get(key) || 0;
      const avg = total / periodDayCount;
      return {
        name: getName(row),
        total,
        yesterday,
        avg,
        change: pctChange(yesterday, avg),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.total - a.total);

  const topEntries = entries.slice(0, limit);
  const grandTotal = entries.reduce((sum, entry) => sum + entry.total, 0);
  const shareTotal = topEntries.reduce((sum, entry) => sum + entry.total, 0);

  return {
    sharePct: grandTotal > 0 ? (shareTotal / grandTotal) * 100 : 0,
    rows: topEntries.map((entry) => ({
      name: entry.name,
      yesterday: entry.yesterday,
      avg7d: entry.avg,
      change: entry.change,
      total: entry.total,
      pctTotal: grandTotal > 0 ? (entry.total / grandTotal) * 100 : 0,
    })),
  };
}

export function getDealRevenueDollars(item) {
  return item.network_operations_price_advertiser || 0;
}

export function getDealPublisherDollars(item) {
  return item.network_operations_price_publisher || 0;
}

export function getDealImpressions(item) {
  return item.network_operations_impressions || 0;
}

export function buildTopDealsByView(periodRows, yesterdayRows, periodDayCount) {
  const metrics = [
    { label: 'Gross Revenue', getValue: getDealRevenueDollars, valueType: 'currency' },
    { label: 'Net Revenue', getValue: getDealPublisherDollars, valueType: 'currency' },
    { label: 'Impressions', getValue: getDealImpressions, valueType: 'count' },
  ];

  return Object.fromEntries(
    metrics.map(({ label, getValue, valueType }) => [
      label,
      {
        valueType,
        ...buildRankedRevenueRowsFromPeriod({
          periodRows,
          yesterdayRows,
          getKey: getDealKey,
          getName: getDealName,
          getRevenueDollars: getValue,
          periodDayCount,
        }),
      },
    ])
  );
}

export function getDspRevenueDollars(item) {
  return (item.PriceAdvertiser_PublisherSide || 0) / 1_000_000;
}

export const DEMAND_SOURCE_VIEWS = {
  DSPs: {
    dimension: 'Partner',
    metrics: ['PricePublisher', 'PriceAdvertiser_PublisherSide', 'PartnerName'],
    view: 'ADVANCED_PUBLISHER',
    size: 500,
    nameColumnLabel: 'DSP',
    getKey: (item) => item.Partner || item.partnerId,
    getName: (item) => item.Name_Partner || item.PartnerName || item.partnerName || 'Unknown DSP',
  },
  Seats: {
    dimension: 'SeatId',
    metrics: ['PricePublisher', 'PriceAdvertiser_PublisherSide', 'SeatName', 'partner_name'],
    size: 250,
    nameColumnLabel: 'Seat',
    getKey: (item) => item.SeatId || item.seatId,
    getName: (item) => item.SeatName || item.seatName || item.SeatId || 'Unknown Seat',
  },
  Buyers: {
    dimension: 'AdDomains',
    metrics: ['PricePublisher', 'PriceAdvertiser_PublisherSide', 'partner_name'],
    size: 250,
    nameColumnLabel: 'Buyer',
    getKey: (item) => item.AdDomains || item.adDomain,
    getName: (item) => item.AdDomains || item.adDomain || 'Unknown Buyer',
  },
};

export function buildTopDemandSourcesByView(dataByView, periodDayCount) {
  return Object.fromEntries(
    Object.entries(DEMAND_SOURCE_VIEWS).map(([label, config]) => {
      const { periodRows = [], yesterdayRows = [] } = dataByView[label] ?? {};
      return [
        label,
        {
          valueType: 'currency',
          nameColumnLabel: config.nameColumnLabel,
          ...buildRankedRevenueRowsFromPeriod({
            periodRows,
            yesterdayRows,
            getKey: config.getKey,
            getName: config.getName,
            getRevenueDollars: getDspRevenueDollars,
            periodDayCount,
          }),
        },
      ];
    })
  );
}

export function getDealKey(item) {
  return item.DealId || item.dealId;
}

export function getDealName(item) {
  return item.Name_Deal || item.DealName || item.DealId || 'Unknown Deal';
}

export function getDspKey(item) {
  return item.Partner || item.partnerId;
}

export function getDspName(item) {
  return item.Name_Partner || item.PartnerName || item.partnerName || 'Unknown DSP';
}
