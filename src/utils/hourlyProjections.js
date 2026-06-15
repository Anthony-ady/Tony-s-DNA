/**
 * Shared hourly (real-time) processing: today vs yesterday + full-day projections.
 * Used by Dashboard and DealAnalytics (and future entity dashboards).
 */

export function cleanDruidTimestamp(timestamp) {
  if (!timestamp) return null;
  let clean = String(timestamp).replace(/\.\d{6}/g, '');
  if (!clean.endsWith('Z') && !clean.includes('+')) {
    clean += 'Z';
  }
  return clean;
}

export function groupHourlyRowsByDay(items) {
  const dataByDay = {};
  items.forEach((item) => {
    const cleanTimestamp = cleanDruidTimestamp(item.timestamp);
    if (!cleanTimestamp) return;
    const date = new Date(cleanTimestamp);
    if (isNaN(date.getTime())) return;
    const dayKey = date.toISOString().slice(0, 10);
    if (!dataByDay[dayKey]) {
      dataByDay[dayKey] = [];
    }
    dataByDay[dayKey].push({
      ...item,
      cleanDate: date,
      hour: date.getUTCHours(),
    });
  });
  return dataByDay;
}

export function computeHourlyTrendRatio(todayData, yesterdayMap) {
  let sumTodayDsp = 0;
  let sumYesterdayDsp = 0;
  todayData.forEach((tItem) => {
    const yItem = yesterdayMap[tItem.hour];
    if (yItem) {
      sumTodayDsp += tItem.PriceAdvertiser_PublisherSide || 0;
      sumYesterdayDsp += yItem.PriceAdvertiser_PublisherSide || 0;
    }
  });
  return sumYesterdayDsp > 0 ? sumTodayDsp / sumYesterdayDsp : 1;
}

function makeEmptyTodayItem(hour) {
  const t = new Date();
  const cleanDate = new Date(
    Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), hour, 0, 0, 0)
  );
  return {
    timestamp: cleanDate.toISOString(),
    PricePublisher: 0,
    PriceAdvertiser_PublisherSide: 0,
    CLICK: 0,
    IMPRESSION: 0,
    cleanDate,
    hour,
    isProjected: true,
  };
}

export function buildProjectedTodayItem(hour, yItem, trendRatio) {
  const t = new Date();
  const cleanDate = new Date(
    Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), hour, 0, 0, 0)
  );
  if (!yItem) {
    return makeEmptyTodayItem(hour);
  }
  const s = (v) => (v || 0) * trendRatio;
  return {
    timestamp: cleanDate.toISOString(),
    PricePublisher: s(yItem.PricePublisher),
    PriceAdvertiser_PublisherSide: s(yItem.PriceAdvertiser_PublisherSide),
    CLICK: Math.round(s(yItem.CLICK ?? yItem.Click ?? 0)),
    IMPRESSION: Math.round(s(yItem.IMPRESSION ?? yItem.Impression ?? 0)),
    cleanDate,
    hour,
    isProjected: true,
  };
}

function trendPair(todayVal, yesterdayVal) {
  const trend =
    yesterdayVal == null
      ? 'same'
      : todayVal > yesterdayVal
        ? 'up'
        : todayVal < yesterdayVal
          ? 'down'
          : 'same';
  const changePercent =
    yesterdayVal > 0
      ? (((todayVal - yesterdayVal) / yesterdayVal) * 100).toFixed(1)
      : 0;
  return { trend, changePercent };
}

function formatHourlyDateLabel(cleanDate) {
  const datePart = cleanDate.toLocaleDateString('fr-FR', { timeZone: 'UTC' });
  const timePart = cleanDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  });
  return `${datePart} ${timePart}`;
}

function formatHourOnly(cleanDate) {
  return cleanDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  });
}

/** Shared real-time X axis: 00H … 24H every 4 hours (UTC). */
export const HOURLY_X_AXIS_DOMAIN = [0, 24];
export const HOURLY_X_AXIS_TICKS = [0, 4, 8, 12, 16, 20, 24];

export function formatHourAxisTick(value) {
  const h = Number(value);
  if (Number.isNaN(h)) return '';
  if (h === 24) return '24H';
  return `${String(h).padStart(2, '0')}H`;
}

export function parseHourFromItem(item) {
  if (typeof item?.hour === 'number' && !Number.isNaN(item.hour)) {
    return item.hour;
  }
  if (item?.cleanDate instanceof Date && !Number.isNaN(item.cleanDate.getTime())) {
    return item.cleanDate.getUTCHours();
  }
  const match = String(item?.hourOnly ?? item?.day ?? '').match(/^(\d{1,2})/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Process hourly rows: union of today/yesterday hours, project missing today slots.
 * @param {Array} sortedData - filtered rows sorted by timestamp
 * @returns {Array} processed rows with isProjected, trends, yesterdayData
 */
export function processHourlyTodayWithProjections(sortedData) {
  const dataByDay = groupHourlyRowsByDay(sortedData);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const todayKey = today.toISOString().slice(0, 10);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  const todayData = dataByDay[todayKey] || [];
  const yesterdayData = dataByDay[yesterdayKey] || [];

  const yesterdayMap = {};
  yesterdayData.forEach((item) => {
    yesterdayMap[item.hour] = item;
  });

  const todayMap = {};
  todayData.forEach((item) => {
    todayMap[item.hour] = item;
  });

  const hoursSet = new Set();
  todayData.forEach((i) => hoursSet.add(i.hour));
  yesterdayData.forEach((i) => hoursSet.add(i.hour));
  const hoursToShow = Array.from(hoursSet).sort((a, b) => a - b);

  const trendRatio = computeHourlyTrendRatio(todayData, yesterdayMap);
  const processedData = [];

  hoursToShow.forEach((hour) => {
    const todayItem = todayMap[hour] ?? buildProjectedTodayItem(hour, yesterdayMap[hour], trendRatio);
    const yesterdayItem = yesterdayMap[todayItem.hour];
    const isProjected = !todayMap[hour];

    const todayClicks = todayItem.CLICK ?? todayItem.Click ?? 0;
    const todayImpressions = todayItem.IMPRESSION ?? todayItem.Impression ?? 0;
    const todayCtr = todayImpressions ? (todayClicks / todayImpressions) * 100 : 0;
    const yesterdayClicks = yesterdayItem ? (yesterdayItem.CLICK ?? yesterdayItem.Click ?? 0) : 0;
    const yesterdayImpressions = yesterdayItem ? (yesterdayItem.IMPRESSION ?? yesterdayItem.Impression ?? 0) : 0;
    const yesterdayCtr = yesterdayImpressions ? (yesterdayClicks / yesterdayImpressions) * 100 : 0;

    const todayDspRevenue = todayItem.PriceAdvertiser_PublisherSide || 0;
    const yesterdayDspRevenue = yesterdayItem ? (yesterdayItem.PriceAdvertiser_PublisherSide || 0) : 0;
    const todayPublisherCosts = todayItem.PricePublisher || 0;
    const yesterdayPublisherCosts = yesterdayItem ? (yesterdayItem.PricePublisher || 0) : 0;
    const todayMargin = todayDspRevenue - todayPublisherCosts;
    const yesterdayMargin = yesterdayDspRevenue - yesterdayPublisherCosts;

    const { trend: dspRevenueTrend, changePercent: dspRevenueChangePercent } = trendPair(
      todayDspRevenue,
      yesterdayItem ? yesterdayDspRevenue : null
    );
    const { trend: publisherCostsTrend, changePercent: publisherCostsChangePercent } = trendPair(
      todayPublisherCosts,
      yesterdayItem ? yesterdayPublisherCosts : null
    );
    const { trend: marginTrend, changePercent: marginChangePercent } = trendPair(
      todayMargin,
      yesterdayItem ? yesterdayMargin : null
    );
    const { trend: clickTrend, changePercent: clickChangePercent } = trendPair(
      todayClicks,
      yesterdayItem ? yesterdayClicks : null
    );
    const { trend: impressionTrend, changePercent: impressionChangePercent } = trendPair(
      todayImpressions,
      yesterdayItem ? yesterdayImpressions : null
    );
    const { trend: ctrTrend, changePercent: ctrChangePercent } = trendPair(
      todayCtr,
      yesterdayItem ? yesterdayCtr : null
    );

    const dateBase = formatHourlyDateLabel(todayItem.cleanDate);
    const marginPercentage =
      todayDspRevenue > 0
        ? ((todayMargin / todayDspRevenue) * 100).toFixed(2)
        : '0.00';

    processedData.push({
      ...todayItem,
      isProjected,
      click: todayClicks,
      impression: todayImpressions,
      ctr: todayCtr,
      yesterdayClick: yesterdayClicks,
      yesterdayImpression: yesterdayImpressions,
      yesterdayCtr,
      clickTrend,
      clickChangePercent,
      impressionTrend,
      impressionChangePercent,
      ctrTrend,
      ctrChangePercent,
      dspRevenueTrend,
      dspRevenueChangePercent,
      publisherCostsTrend,
      publisherCostsChangePercent,
      marginTrend,
      marginChangePercent,
      date: isProjected ? `${dateBase} (estim.)` : dateBase,
      formattedDate: isProjected ? `${dateBase} (estim.)` : dateBase,
      hourOnly: formatHourOnly(todayItem.cleanDate),
      margin: todayMargin,
      marginPercentage,
      yesterdayData: yesterdayItem
        ? {
            PriceAdvertiser_PublisherSide: yesterdayDspRevenue,
            PricePublisher: yesterdayPublisherCosts,
            margin: yesterdayMargin,
            marginPercentage:
              yesterdayDspRevenue > 0
                ? ((yesterdayMargin / yesterdayDspRevenue) * 100).toFixed(2)
                : '0.00',
          }
        : null,
      yesterdayDSPRevenue: yesterdayItem ? yesterdayDspRevenue : null,
      yesterdayDspRevenue: yesterdayItem ? yesterdayDspRevenue : null,
    });
  });

  return processedData;
}

export function sumHourlyMetrics(rows) {
  if (!rows?.length) {
    return {
      totalPublisher: 0,
      totalDSP: 0,
      totalMargin: 0,
      marginPercentage: 0,
      dataPoints: 0,
    };
  }
  const totalPublisher = rows.reduce((sum, item) => sum + (item.PricePublisher || 0), 0);
  const totalDSP = rows.reduce((sum, item) => sum + (item.PriceAdvertiser_PublisherSide || 0), 0);
  const totalMargin = totalDSP - totalPublisher;
  const marginPercentage = totalDSP > 0 ? (totalMargin / totalDSP) * 100 : 0;
  return {
    totalPublisher,
    totalDSP,
    totalMargin,
    marginPercentage,
    dataPoints: rows.length,
  };
}

/**
 * Real (received) vs estimated (full day) summary for hourly view.
 */
export function computeHourlySummaryStats(processedData) {
  const realRows = processedData.filter((item) => !item.isProjected);
  const hasProjected = processedData.some((item) => item.isProjected);
  const real = sumHourlyMetrics(realRows);
  if (!hasProjected) {
    return { real, estimated: null };
  }
  return { real, estimated: sumHourlyMetrics(processedData) };
}

/** Chart series: green = real, blue = projected, gray dashed = yesterday */
export function prepareHourlyChartData(data) {
  if (!data?.length) return [];
  const mapped = data.map((item) => {
    const dsp = item.PriceAdvertiser_PublisherSide || 0;
    return {
      ...item,
      hour: parseHourFromItem(item),
      yesterdayDspRevenue: item.yesterdayDSPRevenue ?? item.yesterdayDspRevenue ?? null,
      dspRevenueTodayReal: item.isProjected ? null : dsp,
      dspRevenueTodayProjected: item.isProjected ? dsp : null,
      bridgeDsp: null,
    };
  });
  for (let i = 0; i < mapped.length - 1; i += 1) {
    if (!mapped[i].isProjected && mapped[i + 1].isProjected) {
      const v0 = mapped[i].PriceAdvertiser_PublisherSide || 0;
      const v1 = mapped[i + 1].PriceAdvertiser_PublisherSide || 0;
      mapped[i].bridgeDsp = v0;
      mapped[i + 1].bridgeDsp = v1;
    }
  }
  return mapped;
}

function sumYesterdayFromRows(processedData) {
  const yesterdayTotalDspRevenue = processedData.reduce(
    (sum, item) => sum + (item.yesterdayData?.PriceAdvertiser_PublisherSide || 0),
    0
  );
  const yesterdayTotalPublisherRevenue = processedData.reduce(
    (sum, item) => sum + (item.yesterdayData?.PricePublisher || 0),
    0
  );
  const yesterdayTotalMargin = yesterdayTotalDspRevenue - yesterdayTotalPublisherRevenue;
  const yesterdayAvgMarginPercentage = yesterdayTotalDspRevenue > 0
    ? ((yesterdayTotalMargin / yesterdayTotalDspRevenue) * 100).toFixed(2)
    : 0;
  return {
    yesterdayTotalDspRevenue,
    yesterdayTotalPublisherRevenue,
    yesterdayTotalMargin,
    yesterdayAvgMarginPercentage,
  };
}

function metricsToAnalyticsSummary(metrics, yesterdayStats = {}) {
  const avgMarginPercentage = metrics.marginPercentage.toFixed(2);
  return {
    totalDspRevenue: metrics.totalDSP,
    totalPublisherRevenue: metrics.totalPublisher,
    totalMargin: metrics.totalMargin,
    avgMarginPercentage,
    totalDSP: metrics.totalDSP,
    totalPublisher: metrics.totalPublisher,
    marginPercentage: avgMarginPercentage,
    dataPoints: metrics.dataPoints,
    ...yesterdayStats,
  };
}

/** Summary stats for AnalyticsTemplate pages (real + optional estimated). */
export function computeAnalyticsHourlySummaryStats(processedData) {
  const { real, estimated } = computeHourlySummaryStats(processedData);
  const yesterdayStats = sumYesterdayFromRows(processedData);
  const summary = metricsToAnalyticsSummary(real, yesterdayStats);

  if (estimated) {
    summary.estimated = {
      totalDspRevenue: estimated.totalDSP,
      totalPublisherRevenue: estimated.totalPublisher,
      totalMargin: estimated.totalMargin,
      avgMarginPercentage: estimated.marginPercentage.toFixed(2),
      totalDSP: estimated.totalDSP,
      totalPublisher: estimated.totalPublisher,
      marginPercentage: estimated.marginPercentage.toFixed(2),
    };
  }

  return summary;
}

/** Daily totals for analytics pages (non-hourly view). */
export function computeDailyAnalyticsSummaryStats(data) {
  const totalDspRevenue = data.reduce((sum, item) => sum + (item.PriceAdvertiser_PublisherSide || 0), 0);
  const totalPublisherRevenue = data.reduce((sum, item) => sum + (item.PricePublisher || 0), 0);
  const totalMargin = totalDspRevenue - totalPublisherRevenue;
  const avgMarginPercentage = totalDspRevenue > 0 ? (totalMargin / totalDspRevenue * 100).toFixed(2) : '0.00';
  const marginPctNum = totalDspRevenue > 0 ? (totalMargin / totalDspRevenue) * 100 : 0;
  return {
    totalDspRevenue,
    totalPublisherRevenue,
    totalMargin,
    avgMarginPercentage,
    totalDSP: totalDspRevenue,
    totalPublisher: totalPublisherRevenue,
    marginPercentage: marginPctNum,
    dataPoints: data.length,
  };
}

/** Deal daily summary (marginPercentage as number). */
export function computeDealDailySummaryStats(data) {
  const totalPublisher = data.reduce((sum, item) => sum + (item.PricePublisher || 0), 0);
  const totalDSP = data.reduce((sum, item) => sum + (item.PriceAdvertiser_PublisherSide || 0), 0);
  const totalMargin = totalDSP - totalPublisher;
  const marginPercentage = totalDSP > 0 ? (totalMargin / totalDSP) * 100 : 0;
  return {
    totalPublisher,
    totalDSP,
    totalMargin,
    marginPercentage,
    dataPoints: data.length,
    totalDspRevenue: totalDSP,
    totalPublisherRevenue: totalPublisher,
    avgMarginPercentage: marginPercentage.toFixed(2),
  };
}

/** Process raw PT1H Druid rows into entity sparkline series (with projections). */
export function processEntityHourlySparkFromRaw(rawData) {
  if (!rawData || !Array.isArray(rawData)) return [];
  const filteredData = rawData.filter(
    (item) => item.PricePublisher !== undefined || item.PriceAdvertiser_PublisherSide !== undefined
  );
  if (filteredData.length === 0) return [];
  const sortedData = [...filteredData].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const processed = processHourlyTodayWithProjections(sortedData);

  return processed.map((item) => {
    const clicks = item.click ?? item.CLICK ?? item.Click ?? 0;
    const impressions = item.impression ?? item.IMPRESSION ?? item.Impression ?? 0;
    const ctr = typeof item.ctr === 'number' ? item.ctr : (impressions ? (clicks / impressions) * 100 : 0);
    const visibleImpressions = item.network_operations_visible_impressions ?? item.visibleImpressions ?? 0;
    const viewabilityRate = typeof item.network_operations_viewability_rate === 'number'
      ? item.network_operations_viewability_rate * 100
      : (typeof item.viewabilityRate === 'number' ? item.viewabilityRate : 0);

    const yesterdayItem = item.yesterdayData;
    const yesterdayClicks = item.yesterdayClick ?? 0;
    const yesterdayImpressions = item.yesterdayImpression ?? 0;
    const yesterdayCtr = item.yesterdayCtr ?? 0;

    return {
      day: item.hourOnly || item.formattedDate || item.date,
      hourOnly: item.hourOnly,
      hour: item.hour,
      entityRevenue: item.PriceAdvertiser_PublisherSide || 0,
      publisherCost: item.PricePublisher || 0,
      margin: item.margin ?? ((item.PriceAdvertiser_PublisherSide || 0) - (item.PricePublisher || 0)),
      isProjected: !!item.isProjected,
      click: clicks,
      impression: impressions,
      visibleImpressions,
      viewabilityRate,
      ctr,
      yesterdayData: yesterdayItem ? {
        entityRevenue: yesterdayItem.PriceAdvertiser_PublisherSide ?? yesterdayItem.entityRevenue ?? 0,
        publisherCost: yesterdayItem.PricePublisher ?? yesterdayItem.publisherCost ?? 0,
        margin: yesterdayItem.margin ?? 0,
        click: yesterdayClicks,
        impression: yesterdayImpressions,
        visibleImpressions: yesterdayItem.visibleImpressions ?? 0,
        viewabilityRate: yesterdayItem.viewabilityRate ?? 0,
        ctr: yesterdayCtr,
      } : null,
      hour: item.hour,
    };
  });
}

export function getAnalyticsSummaryValue(summaryStats, key) {
  if (!summaryStats) return 0;
  const aliases = {
    dspRevenue: ['totalDspRevenue', 'totalDSP', 'totalAdvertiserSpend', 'entityRevenue'],
    publisher: ['totalPublisherRevenue', 'totalPublisher', 'publisherCosts'],
    margin: ['totalMargin', 'margin'],
    marginPct: ['avgMarginPercentage', 'marginPercentage'],
  };
  const map = {
    dspRevenue: aliases.dspRevenue,
    publisher: aliases.publisher,
    margin: aliases.margin,
    marginPct: aliases.marginPct,
  };
  const keys = map[key] || [key];
  for (const k of keys) {
    if (summaryStats[k] !== undefined && summaryStats[k] !== null) {
      return summaryStats[k];
    }
  }
  return 0;
}

/** Convert YYYY-MM-DD range to Druid interval strings (+00:00). */
export function dateRangeToDruidInterval(startDate, endDate) {
  const begin = new Date(`${startDate}T00:00:00Z`).toISOString().replace('Z', '+00:00');
  const end = new Date(`${endDate}T23:59:59Z`).toISOString().replace('Z', '+00:00');
  return { begin, end };
}

/** Standard PT1H aggregate payload for dashboard KPI summary cards. */
export function buildAdserverHourlySummaryPayload(beginISO, endISO, filters) {
  const payload = {
    Intervals: [{ Begin: beginISO, End: endISO }],
    Metrics: ['PricePublisher', 'PriceAdvertiser_PublisherSide'],
    Granularity: { type: 'period', period: 'PT1H' },
    Datasource: 'adserver_stats',
    TimeZone: 'Etc/GMT',
  };
  if (filters && Object.keys(filters).length > 0) {
    payload.Filters = filters;
  }
  return payload;
}

/** Process raw PT1H Druid rows into analytics summary stats (real + optional estimated). */
export function computeHourlySummaryFromRawData(rawData) {
  if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
    return null;
  }
  const filteredData = rawData.filter(
    (item) => item.PricePublisher !== undefined || item.PriceAdvertiser_PublisherSide !== undefined
  );
  if (filteredData.length === 0) {
    return null;
  }
  const sortedData = [...filteredData].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const processed = processHourlyTodayWithProjections(sortedData);
  return computeAnalyticsHourlySummaryStats(processed);
}
