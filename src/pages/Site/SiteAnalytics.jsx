/**
 * Site Analytics Page Component
 * 
 * This page provides detailed analytics for a specific site using the Druid API endpoint.
 * It uses the AnalyticsTemplate for common functionality and provides site-specific logic.
 */

import React, { useMemo, useCallback, useState } from "react";
import { processHourlyTodayWithProjections, computeAnalyticsHourlySummaryStats, computeDailyAnalyticsSummaryStats } from "@/utils/hourlyProjections";
import AnalyticsTemplate from "@/pages/Dashboard/AnalyticsTemplate";
import { TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAnalyticsTrendHelpers } from "@/components/analytics/useAnalyticsTrendHelpers";
import { API_ENDPOINTS } from "@/config/api";
import { formatCurrency as formatCurrencyValue, formatEcpm, formatRpbr, formatLargeNumber, formatPercentage } from "@/utils/formatters";

export default function SiteAnalytics() {
  const formatCurrency = formatCurrencyValue;
  const { getToken } = useAuth();
  const useNetworkOpsOnlyDaily = true;
  
  // States for hourly data expansion
  const [expandedDates, setExpandedDates] = useState(new Set());
  const [hourlyDataCache, setHourlyDataCache] = useState({});
  const [loadingHourlyData, setLoadingHourlyData] = useState(new Set());
  const { renderTrendIndicator, renderTooltipHeader } = useAnalyticsTrendHelpers();

  const networkOperationsMetrics = useMemo(() => ({
    metricList: [
      "network_operations_bid_requests",
      "network_operations_bid_responses",
      "network_operations_impressions",
      "network_operations_click",
      "network_operations_visible_impressions",
      "network_operations_viewability_rate",
      "network_operations_price_publisher",
      "network_operations_ecpm_publisher",
      "network_operations_price_advertiser"
    ],
    derived: [
      "rpbr",
      "fillRate",
      "winRate"
    ],
    filtersBuilder: ({ entityId }) => {
      const filters = {};

      if (typeof window !== "undefined") {
        const selectedCompanyId = localStorage.getItem('selected-company-id');

        if (selectedCompanyId) {
          filters.publisherId = {
            Value: [selectedCompanyId],
            Operator: "in"
          };
        }
      }

      if (entityId) {
        filters.SiteId = {
          Value: [entityId],
          Operator: "in"
        };
      }

      return filters;
    }
  }), []);
  
  // Build API payload based on entity ID, dates, and view mode
  const buildPayload = (siteId, beginDateISO, endDateISO, viewMode) => {
    const granularity = viewMode === 'hourly' ? { type: "period", period: "PT1H" } : { type: "period", period: "P1D" };

    return {
      Intervals: [
        {
          Begin: beginDateISO,
          End: endDateISO
        }
      ],
      Size: 1000,
      Metrics: ["PricePublisher", "PriceAdvertiser_PublisherSide"],
      View: "SIMPLE_PUBLISHER",
      Datasource: "adserver_stats",
      AddTotalRow: false,
      TimeZone: "Etc/GMT",
      Granularity: granularity,
      Filters: {
        Site: {
          Value: [siteId],
          Operator: "in"
        }
      }
    };
  };

  // Process raw API response data (supports network operations KPIs)
  const processAnalyticsData = (responseData, viewMode, networkOpsData) => {
    // Filter out entries that don't have metrics
    const filteredData = responseData.filter(item => 
      item.PricePublisher !== undefined || item.PriceAdvertiser_PublisherSide !== undefined
    );

    // Sort data by timestamp
    const sortedData = filteredData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      if (viewMode === 'hourly') {
      const sortedData = filteredData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      return processHourlyTodayWithProjections(sortedData);
    } else {
      // For daily view, process with trends
      let processedData = sortedData.map((item, index) => {
          let cleanTimestamp = item.timestamp;
          cleanTimestamp = cleanTimestamp.replace(/\.\d{6}/, '');
          if (!cleanTimestamp.endsWith('Z') && !cleanTimestamp.includes('+')) {
            cleanTimestamp += 'Z';
          }
          
          const date = new Date(cleanTimestamp);
        const formattedDate = date.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
        
        // Calculate trends
        const previousItem = index > 0 ? sortedData[index - 1] : null;
        const dspRevenueTrend = previousItem ? 
          (item.PriceAdvertiser_PublisherSide > previousItem.PriceAdvertiser_PublisherSide ? 'up' : 
           item.PriceAdvertiser_PublisherSide < previousItem.PriceAdvertiser_PublisherSide ? 'down' : 'same') : 'same';
        
        const dspRevenueChangePercent = previousItem && previousItem.PriceAdvertiser_PublisherSide > 0 ? 
          (((item.PriceAdvertiser_PublisherSide - previousItem.PriceAdvertiser_PublisherSide) / previousItem.PriceAdvertiser_PublisherSide) * 100).toFixed(1) : 0;
        
        const publisherCostsTrend = previousItem ? 
          (item.PricePublisher > previousItem.PricePublisher ? 'up' : 
           item.PricePublisher < previousItem.PricePublisher ? 'down' : 'same') : 'same';
        
        const publisherCostsChangePercent = previousItem && previousItem.PricePublisher > 0 ? 
          (((item.PricePublisher - previousItem.PricePublisher) / previousItem.PricePublisher) * 100).toFixed(1) : 0;
        
        const marginTrend = previousItem ? 
          ((item.PriceAdvertiser_PublisherSide - item.PricePublisher) > (previousItem.PriceAdvertiser_PublisherSide - previousItem.PricePublisher) ? 'up' : 
           (item.PriceAdvertiser_PublisherSide - item.PricePublisher) < (previousItem.PriceAdvertiser_PublisherSide - previousItem.PricePublisher) ? 'down' : 'same') : 'same';
        
        const marginChangePercent = previousItem && (previousItem.PriceAdvertiser_PublisherSide - previousItem.PricePublisher) !== 0 ? 
          ((((item.PriceAdvertiser_PublisherSide - item.PricePublisher) - (previousItem.PriceAdvertiser_PublisherSide - previousItem.PricePublisher)) / Math.abs(previousItem.PriceAdvertiser_PublisherSide - previousItem.PricePublisher)) * 100).toFixed(1) : 0;
          
          return {
            ...item,
          formattedDate,
          dateKey: date.toISOString().slice(0, 10),
          margin: item.PriceAdvertiser_PublisherSide - item.PricePublisher,
          marginPercentage: item.PriceAdvertiser_PublisherSide > 0 ? ((item.PriceAdvertiser_PublisherSide - item.PricePublisher) / item.PriceAdvertiser_PublisherSide * 100).toFixed(2) : 0,
          dspRevenueTrend,
          dspRevenueChangePercent,
          publisherCostsTrend,
          publisherCostsChangePercent,
          marginTrend,
          marginChangePercent
          };
        });

      // Merge network operations data when available (daily view only)
      if (networkOpsData && Array.isArray(networkOpsData) && networkOpsData.length > 0) {
        const networkOpsMap = {};
        networkOpsData.forEach((networkItem) => {
          let cleanTimestamp = networkItem.timestamp;
          cleanTimestamp = cleanTimestamp.replace(/\.\d{6}/g, '');
          if (!cleanTimestamp.endsWith('Z') && !cleanTimestamp.includes('+')) {
            cleanTimestamp += 'Z';
          }
          const networkDate = new Date(cleanTimestamp);
          if (!isNaN(networkDate.getTime())) {
            const dateKey = networkDate.toISOString().slice(0, 10);
            networkOpsMap[dateKey] = networkItem;
          }
        });

        processedData = processedData.map((item) => {
          const networkOpsItem = networkOpsMap[item.dateKey];
          return {
            ...item,
            network_operations_bid_requests: networkOpsItem ? networkOpsItem.network_operations_bid_requests : null,
            network_operations_bid_responses: networkOpsItem ? networkOpsItem.network_operations_bid_responses : null,
            network_operations_impressions: networkOpsItem ? networkOpsItem.network_operations_impressions : null,
            network_operations_price_publisher: networkOpsItem ? networkOpsItem.network_operations_price_publisher : null,
            network_operations_ecpm_publisher: networkOpsItem ? networkOpsItem.network_operations_ecpm_publisher : null
          };
        });

        let previousEnhancedItem = null;
        processedData = processedData.map((item) => {
          let rpbr = null;
          let fillRate = null;
          let winRate = null;

          if (item.network_operations_bid_requests !== null && item.network_operations_bid_requests > 0) {
            if (item.network_operations_price_publisher !== null && item.network_operations_price_publisher !== undefined) {
              rpbr = (item.network_operations_price_publisher / item.network_operations_bid_requests) * 1000000;
            }
            if (item.network_operations_impressions !== null) {
              fillRate = (item.network_operations_impressions / item.network_operations_bid_requests) * 100;
            }
            if (item.network_operations_bid_responses !== null && item.network_operations_bid_responses > 0 && item.network_operations_impressions !== null) {
              winRate = (item.network_operations_impressions / item.network_operations_bid_responses) * 100;
            }
          }

          let bidRequestsTrend = 'same';
          let bidRequestsChangePercent = 0;
          let bidResponsesTrend = 'same';
          let bidResponsesChangePercent = 0;
          let impressionsTrend = 'same';
          let impressionsChangePercent = 0;
          let pricePublisherTrend = 'same';
          let pricePublisherChangePercent = 0;
          let ecpmTrend = 'same';
          let ecpmChangePercent = 0;
          let rpbrTrend = 'same';
          let rpbrChangePercent = 0;
          let fillRateTrend = 'same';
          let fillRateChangePercent = 0;
          let winRateTrend = 'same';
          let winRateChangePercent = 0;

          if (previousEnhancedItem) {
            const previousBidRequests = previousEnhancedItem.network_operations_bid_requests;
            const previousBidResponses = previousEnhancedItem.network_operations_bid_responses;
            const previousImpressions = previousEnhancedItem.network_operations_impressions;
            const previousPricePublisher = previousEnhancedItem.network_operations_price_publisher;
            const previousEcpm = previousEnhancedItem.network_operations_ecpm_publisher;

            if (item.network_operations_bid_requests !== null && previousBidRequests !== null && previousBidRequests !== 0) {
              if (item.network_operations_bid_requests > previousBidRequests) {
                bidRequestsTrend = 'up';
                bidRequestsChangePercent = (((item.network_operations_bid_requests - previousBidRequests) / previousBidRequests) * 100).toFixed(1);
              } else if (item.network_operations_bid_requests < previousBidRequests) {
                bidRequestsTrend = 'down';
                bidRequestsChangePercent = (((item.network_operations_bid_requests - previousBidRequests) / previousBidRequests) * 100).toFixed(1);
              }
            }

            if (item.network_operations_bid_responses !== null && previousBidResponses !== null && previousBidResponses !== 0) {
              if (item.network_operations_bid_responses > previousBidResponses) {
                bidResponsesTrend = 'up';
                bidResponsesChangePercent = (((item.network_operations_bid_responses - previousBidResponses) / previousBidResponses) * 100).toFixed(1);
              } else if (item.network_operations_bid_responses < previousBidResponses) {
                bidResponsesTrend = 'down';
                bidResponsesChangePercent = (((item.network_operations_bid_responses - previousBidResponses) / previousBidResponses) * 100).toFixed(1);
              }
            }

            if (item.network_operations_impressions !== null && previousImpressions !== null && previousImpressions !== 0) {
              if (item.network_operations_impressions > previousImpressions) {
                impressionsTrend = 'up';
                impressionsChangePercent = (((item.network_operations_impressions - previousImpressions) / previousImpressions) * 100).toFixed(1);
              } else if (item.network_operations_impressions < previousImpressions) {
                impressionsTrend = 'down';
                impressionsChangePercent = (((item.network_operations_impressions - previousImpressions) / previousImpressions) * 100).toFixed(1);
              }
            }

            if (item.network_operations_price_publisher !== null && previousPricePublisher !== null && previousPricePublisher !== 0) {
              if (item.network_operations_price_publisher > previousPricePublisher) {
                pricePublisherTrend = 'up';
                pricePublisherChangePercent = (((item.network_operations_price_publisher - previousPricePublisher) / previousPricePublisher) * 100).toFixed(1);
              } else if (item.network_operations_price_publisher < previousPricePublisher) {
                pricePublisherTrend = 'down';
                pricePublisherChangePercent = (((item.network_operations_price_publisher - previousPricePublisher) / previousPricePublisher) * 100).toFixed(1);
              }
            }

            if (item.network_operations_ecpm_publisher !== null && previousEcpm !== null && previousEcpm !== 0) {
              if (item.network_operations_ecpm_publisher > previousEcpm) {
                ecpmTrend = 'up';
                ecpmChangePercent = (((item.network_operations_ecpm_publisher - previousEcpm) / previousEcpm) * 100).toFixed(1);
              } else if (item.network_operations_ecpm_publisher < previousEcpm) {
                ecpmTrend = 'down';
                ecpmChangePercent = (((item.network_operations_ecpm_publisher - previousEcpm) / previousEcpm) * 100).toFixed(1);
              }
            }

            if (rpbr !== null && previousEnhancedItem.rpbr !== null && previousEnhancedItem.rpbr !== 0) {
              if (rpbr > previousEnhancedItem.rpbr) {
                rpbrTrend = 'up';
                rpbrChangePercent = (((rpbr - previousEnhancedItem.rpbr) / previousEnhancedItem.rpbr) * 100).toFixed(1);
              } else if (rpbr < previousEnhancedItem.rpbr) {
                rpbrTrend = 'down';
                rpbrChangePercent = (((rpbr - previousEnhancedItem.rpbr) / previousEnhancedItem.rpbr) * 100).toFixed(1);
              }
            }

            if (fillRate !== null && previousEnhancedItem.fillRate !== null && previousEnhancedItem.fillRate !== 0) {
              if (fillRate > previousEnhancedItem.fillRate) {
                fillRateTrend = 'up';
                fillRateChangePercent = (((fillRate - previousEnhancedItem.fillRate) / previousEnhancedItem.fillRate) * 100).toFixed(1);
              } else if (fillRate < previousEnhancedItem.fillRate) {
                fillRateTrend = 'down';
                fillRateChangePercent = (((fillRate - previousEnhancedItem.fillRate) / previousEnhancedItem.fillRate) * 100).toFixed(1);
              }
            }

            if (winRate !== null && previousEnhancedItem.winRate !== null && previousEnhancedItem.winRate !== 0) {
              if (winRate > previousEnhancedItem.winRate) {
                winRateTrend = 'up';
                winRateChangePercent = (((winRate - previousEnhancedItem.winRate) / previousEnhancedItem.winRate) * 100).toFixed(1);
              } else if (winRate < previousEnhancedItem.winRate) {
                winRateTrend = 'down';
                winRateChangePercent = (((winRate - previousEnhancedItem.winRate) / previousEnhancedItem.winRate) * 100).toFixed(1);
              }
            }
          }

          const enhancedItem = {
            ...item,
            rpbr,
            fillRate,
            winRate,
            bidRequestsTrend,
            bidRequestsChangePercent,
            bidResponsesTrend,
            bidResponsesChangePercent,
            impressionsTrend,
            impressionsChangePercent,
            pricePublisherTrend,
            pricePublisherChangePercent,
            ecpmTrend,
            ecpmChangePercent,
            rpbrTrend,
            rpbrChangePercent,
            fillRateTrend,
            fillRateChangePercent,
            winRateTrend,
            winRateChangePercent
          };

          previousEnhancedItem = enhancedItem;
          return enhancedItem;
        });
      }

      return processedData;
      }
  };

  // Calculate summary statistics
    const calculateSummaryStats = (data, viewMode) => {
    if (!data || data.length === 0) {
      return null;
    }

    if (viewMode === 'hourly') {
      return computeAnalyticsHourlySummaryStats(data);
    }

    return computeDailyAnalyticsSummaryStats(data);
  };

  const fetchHourlyDataForDate = async (dateString, siteId) => {
    const token = getToken();
    if (!token) throw new Error('No auth token');
    let date;
    if (dateString.includes('/')) {
      const [day, month, year] = dateString.split('/');
      date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
    } else {
      date = new Date(dateString + 'T00:00:00.000Z');
    }
    const nextDay = new Date(date);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const payload = {
      Intervals: [{ Begin: date.toISOString(), End: new Date(nextDay.getTime() - 1).toISOString() }],
      Size: 1000,
      Metrics: ['PricePublisher', 'PriceAdvertiser_PublisherSide'],
      View: 'SIMPLE_PUBLISHER',
      Datasource: 'adserver_stats',
      AddTotalRow: false,
      TimeZone: 'Etc/GMT',
      Granularity: { type: 'period', period: 'PT1H' },
      Filters: { Site: { Value: [siteId], Operator: 'in' } },
    };

    const res = await fetch(API_ENDPOINTS.DRUID_SEARCH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ayl-auth-token': token },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (Array.isArray(data?.Data) ? data.Data : Array.isArray(data) ? data : [])
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map((item) => {
        let ts = item.timestamp.replace(/\.\d{6}/, '');
        if (!ts.endsWith('Z') && !ts.includes('+')) ts += 'Z';
        const d = new Date(ts);
        const dspRev = item.PriceAdvertiser_PublisherSide || 0;
        const pubCost = item.PricePublisher || 0;
        return {
          ...item,
          formattedTime: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' }),
          hour: d.getUTCHours(),
          margin: dspRev - pubCost,
          marginPercentage: dspRev > 0 ? ((dspRev - pubCost) / dspRev * 100).toFixed(2) : 0,
        };
      });
  };

  const toggleDateExpansion = async (dateString, dateKey, siteId) => {
    const key = dateKey || dateString;
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
      if (!hourlyDataCache[key] && !loadingHourlyData.has(key)) {
        setLoadingHourlyData((prev) => new Set(prev).add(key));
        try {
          const hourly = await fetchHourlyDataForDate(dateString, siteId);
          setHourlyDataCache((prev) => ({ ...prev, [key]: hourly }));
        } catch (e) {
          console.error('Error fetching hourly data:', e);
        } finally {
          setLoadingHourlyData((prev) => {
            const s = new Set(prev);
            s.delete(key);
            return s;
          });
        }
      }
    }
    setExpandedDates(newExpanded);
  };

  const tableConfig = useMemo(() => ({
    hourly: {
      columns: [
        {
          id: 'date',
          header: <TableHead className="font-medium text-center">Date</TableHead>,
          cell: ({ item }) => (
            <TableCell className="font-medium text-center">{item.formattedDate}</TableCell>
          ),
        },
        {
          id: 'dspRevenue',
          header: <TableHead className="text-center">DSP Revenue</TableHead>,
          cell: ({ item }) => (
                          <TableCell className="text-center text-green-600">
              {formatCurrency(item.PriceAdvertiser_PublisherSide || 0)}
                          </TableCell>
          ),
        },
        {
          id: 'yesterdayDspRevenue',
          header: <TableHead className="text-center">Yesterday DSP Revenue</TableHead>,
          cell: ({ item }) => {
            const value = item.yesterdayData ? item.yesterdayData.PriceAdvertiser_PublisherSide || 0 : 0;
            return (
                          <TableCell className="text-center text-green-600 opacity-60">
                {formatCurrency(value)}
                          </TableCell>
            );
          },
        },
        {
          id: 'dspTrend',
          header: <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>,
          cell: ({ item }) => (
                          <TableCell className="text-center border-r-2 border-gray-300">
              {renderTrendIndicator(item.dspRevenueTrend, item.dspRevenueChangePercent, { upColor: 'text-green-500', downColor: 'text-red-500' })}
                              </TableCell>
          ),
        },
        {
          id: 'publisherCosts',
          header: <TableHead className="text-center">Publisher Costs</TableHead>,
          cell: ({ item }) => (
                          <TableCell className="text-center text-red-600">
              {formatCurrency(item.PricePublisher || 0)}
                          </TableCell>
          ),
        },
        {
          id: 'yesterdayPublisherCosts',
          header: <TableHead className="text-center">Yesterday Publisher Costs</TableHead>,
          cell: ({ item }) => {
            const value = item.yesterdayData ? item.yesterdayData.PricePublisher || 0 : 0;
            return (
                          <TableCell className="text-center text-red-600 opacity-60">
                {formatCurrency(value)}
                          </TableCell>
            );
          },
        },
        {
          id: 'publisherTrend',
          header: <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>,
          cell: ({ item }) => (
                          <TableCell className="text-center border-r-2 border-gray-300">
              {renderTrendIndicator(item.publisherCostsTrend, item.publisherCostsChangePercent, { upColor: 'text-red-500', downColor: 'text-green-500' })}
                          </TableCell>
          ),
        },
        {
          id: 'margin',
          header: <TableHead className="text-center">Margin</TableHead>,
          cell: ({ item }) => {
            const dspRevenue = item.PriceAdvertiser_PublisherSide || 0;
            const publisherCosts = item.PricePublisher || 0;
            const margin = dspRevenue - publisherCosts;
            return (
                          <TableCell className="text-center text-black">
              {formatCurrency(margin)}
                          </TableCell>
            );
          },
        },
        {
          id: 'yesterdayMargin',
          header: <TableHead className="text-center">Yesterday Margin</TableHead>,
          cell: ({ item }) => {
            const yesterdayRevenue = item.yesterdayData ? item.yesterdayData.PriceAdvertiser_PublisherSide || 0 : 0;
            const yesterdayPublisher = item.yesterdayData ? item.yesterdayData.PricePublisher || 0 : 0;
            const margin = yesterdayRevenue - yesterdayPublisher;
            return (
                          <TableCell className="text-center text-black opacity-60">
                {formatCurrency(margin)}
                          </TableCell>
            );
          },
        },
        {
          id: 'marginTrend',
          header: <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>,
          cell: ({ item }) => (
                          <TableCell className="text-center border-r-2 border-gray-300">
              {renderTrendIndicator(item.marginTrend, item.marginChangePercent)}
                              </TableCell>
          ),
        },
        {
          id: 'profitToday',
          header: <TableHead className="text-center">Today Profit %</TableHead>,
          cell: ({ item }) => {
            const dspRevenue = item.PriceAdvertiser_PublisherSide || 0;
            const publisherCosts = item.PricePublisher || 0;
            const margin = dspRevenue - publisherCosts;
            const marginPct = dspRevenue > 0 ? (margin / dspRevenue) * 100 : 0;
            return (
                              <TableCell className="text-center">
                {marginPct > 0 ? (
                <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                    {marginPct.toFixed(1)}%
                </span>
              ) : (
                  <Badge variant="destructive">{marginPct.toFixed(1)}%</Badge>
              )}
                          </TableCell>
            );
          },
        },
        {
          id: 'profitYesterday',
          header: <TableHead className="text-center">Yesterday Profit %</TableHead>,
          cell: ({ item }) => {
            const yesterdayRevenue = item.yesterdayData ? item.yesterdayData.PriceAdvertiser_PublisherSide || 0 : 0;
            const yesterdayPublisher = item.yesterdayData ? item.yesterdayData.PricePublisher || 0 : 0;
            const margin = yesterdayRevenue - yesterdayPublisher;
            const marginPct = yesterdayRevenue > 0 ? (margin / yesterdayRevenue) * 100 : 0;
            return (
                          <TableCell className="text-center">
                {marginPct > 0 ? (
                <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white opacity-60 inline-block">
                    {marginPct.toFixed(1)}%
                </span>
              ) : (
                  <Badge variant="destructive" className="opacity-60">{marginPct.toFixed(1)}%</Badge>
                            )}
                          </TableCell>
            );
          },
        },
      ],
    },
    daily: {
      columns: [
        {
          id: 'date',
          header: <TableHead className="font-medium text-center">Date</TableHead>,
          cell: ({ item, viewMode, entityId }) => {
            const isExpanded = expandedDates.has(item.dateKey || item.formattedDate);
            
            return (
              <TableCell 
                className={`font-medium text-center ${viewMode === 'daily' ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                onClick={viewMode === 'daily' && entityId ? () => toggleDateExpansion(item.formattedDate, item.dateKey || item.formattedDate, entityId) : undefined}
              >
                <div className="flex items-center justify-center gap-2">
                  {viewMode === 'daily' && (
                    isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )
                  )}
                  <span>{item.formattedDate}</span>
                </div>
              </TableCell>
            );
          },
        },
        {
          id: 'dspRevenue',
          header: <TableHead className="text-center">DSP Revenue</TableHead>,
          cell: ({ item }) => (
                          <TableCell className="text-center text-green-600">
              {formatCurrency(item.PriceAdvertiser_PublisherSide || 0)}
                          </TableCell>
          ),
        },
        {
          id: 'dspTrend',
          header: <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>,
          cell: ({ item }) => (
                          <TableCell className="text-center border-r-2 border-gray-300">
              {renderTrendIndicator(item.dspRevenueTrend, item.dspRevenueChangePercent, { upColor: 'text-green-500', downColor: 'text-red-500' })}
                          </TableCell>
          ),
        },
        {
          id: 'publisherCosts',
          header: <TableHead className="text-center">Publisher Costs</TableHead>,
          cell: ({ item }) => (
                          <TableCell className="text-center text-red-600">
              {formatCurrency(item.PricePublisher || 0)}
                          </TableCell>
          ),
        },
        {
          id: 'publisherTrend',
          header: <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>,
          cell: ({ item }) => (
                          <TableCell className="text-center border-r-2 border-gray-300">
              {renderTrendIndicator(item.publisherCostsTrend, item.publisherCostsChangePercent, { upColor: 'text-red-500', downColor: 'text-green-500' })}
                              </TableCell>
          ),
        },
        {
          id: 'margin',
          header: <TableHead className="text-center">Margin</TableHead>,
          cell: ({ item }) => {
            const dspRevenue = item.PriceAdvertiser_PublisherSide || 0;
            const publisherCosts = item.PricePublisher || 0;
            const margin = dspRevenue - publisherCosts;
            return (
                          <TableCell className="text-center text-black">
              {formatCurrency(margin)}
                          </TableCell>
            );
          },
        },
        {
          id: 'marginTrend',
          header: <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>,
          cell: ({ item }) => (
                          <TableCell className="text-center border-r-2 border-gray-300">
              {renderTrendIndicator(item.marginTrend, item.marginChangePercent)}
            </TableCell>
          ),
        },
        {
          id: 'profitPercent',
          header: <TableHead className="text-center">Profit %</TableHead>,
          cell: ({ item }) => {
            const dspRevenue = item.PriceAdvertiser_PublisherSide || 0;
            const publisherCosts = item.PricePublisher || 0;
            const margin = dspRevenue - publisherCosts;
            const marginPct = dspRevenue > 0 ? (margin / dspRevenue) * 100 : 0;
            return (
              <TableCell className="text-center">
                {marginPct > 0 ? (
                  <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                    {marginPct.toFixed(1)}%
                  </span>
                ) : (
                  <Badge variant="destructive">{marginPct.toFixed(1)}%</Badge>
                )}
              </TableCell>
            );
          },
        },
      ],
      detailedColumns: [
        {
          id: 'bidRequests',
          header: <TableHead className="text-center border-l-2 border-gray-300">Bid Requests</TableHead>,
          cell: ({ item }) => (
            <TableCell className="text-center border-l-2 border-gray-300">
              {item.network_operations_bid_requests !== null && item.network_operations_bid_requests !== undefined ? (
                <span className="text-black">{formatLargeNumber(item.network_operations_bid_requests)}</span>
              ) : (
                <span className="text-gray-400">N/A</span>
              )}
            </TableCell>
          ),
        },
        {
          id: 'bidRequestsTrend',
          header: <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>,
          cell: ({ item }) => (
            <TableCell className="text-center border-r-2 border-gray-300">
              {renderTrendIndicator(item.bidRequestsTrend, item.bidRequestsChangePercent)}
            </TableCell>
          ),
        },
        {
          id: 'bidResponses',
          header: <TableHead className="text-center">Bid Responses</TableHead>,
          cell: ({ item }) => (
            <TableCell className="text-center">
              {item.network_operations_bid_responses !== null && item.network_operations_bid_responses !== undefined ? (
                <span className="text-black">{formatLargeNumber(item.network_operations_bid_responses)}</span>
              ) : (
                <span className="text-gray-400">N/A</span>
                              )}
                          </TableCell>
          ),
        },
        {
          id: 'bidResponsesTrend',
          header: <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>,
          cell: ({ item }) => (
            <TableCell className="text-center border-r-2 border-gray-300">
              {renderTrendIndicator(item.bidResponsesTrend, item.bidResponsesChangePercent)}
            </TableCell>
          ),
        },
        {
          id: 'impressions',
          header: <TableHead className="text-center">Impressions</TableHead>,
          cell: ({ item }) => (
                          <TableCell className="text-center">
              {item.network_operations_impressions !== null && item.network_operations_impressions !== undefined ? (
                <span className="text-black">{formatLargeNumber(item.network_operations_impressions)}</span>
              ) : (
                <span className="text-gray-400">N/A</span>
              )}
                          </TableCell>
          ),
        },
        {
          id: 'impressionsTrend',
          header: <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>,
          cell: ({ item }) => (
            <TableCell className="text-center border-r-2 border-gray-300">
              {renderTrendIndicator(item.impressionsTrend, item.impressionsChangePercent)}
            </TableCell>
          ),
        },
        {
          id: 'ecpmPublisher',
          header: renderTooltipHeader(
            'eCPM Publisher',
            'Publisher eCPM shows the revenue earned per thousand impressions. It helps evaluate yield efficiency across inventory. Drops can highlight pricing, demand, or creative quality issues.',
            'border-l-2 border-gray-300'
          ),
          cell: ({ item }) => (
            <TableCell className="text-center border-l-2 border-gray-300">
              {item.network_operations_ecpm_publisher !== null && item.network_operations_ecpm_publisher !== undefined ? (
                <span className="text-black">{formatEcpm(item.network_operations_ecpm_publisher)}</span>
              ) : (
                <span className="text-gray-400">N/A</span>
              )}
            </TableCell>
          ),
        },
        {
          id: 'ecpmTrend',
          header: <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>,
          cell: ({ item }) => (
            <TableCell className="text-center border-r-2 border-gray-300">
              {renderTrendIndicator(item.ecpmTrend, item.ecpmChangePercent)}
            </TableCell>
          ),
        },
        {
          id: 'rpbr',
          header: renderTooltipHeader(
            'RPBR/M',
            "Revenue per Million Bid Requests (RPBR/M) indicates how much revenue your SSP generates for every one million bid requests. It helps you measure request quality, efficiency, and monetization performance over time.",
            'border-l-2 border-gray-300'
          ),
          cell: ({ item }) => (
            <TableCell className="text-center border-l-2 border-gray-300">
              {item.rpbr !== null && item.rpbr !== undefined ? (
                <span className="text-black">{formatRpbr(item.rpbr)}</span>
              ) : (
                <span className="text-gray-400">N/A</span>
              )}
            </TableCell>
          ),
        },
        {
          id: 'rpbrTrend',
          header: <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>,
          cell: ({ item }) => (
            <TableCell className="text-center border-r-2 border-gray-300">
              {renderTrendIndicator(item.rpbrTrend, item.rpbrChangePercent)}
            </TableCell>
          ),
        },
        {
          id: 'fillRate',
          header: renderTooltipHeader(
            'Fill Rate',
            'Fill Rate measures the ratio between impressions and bid requests. It helps you understand how effectively your ad requests are being filled with winning ads. A low Fill Rate may suggest issues with demand, floor price, or targeting.'
          ),
          cell: ({ item }) => (
            <TableCell className="text-center">
              {item.fillRate !== null && item.fillRate !== undefined ? (
                <span className="text-black">{formatPercentage(item.fillRate)}</span>
              ) : (
                <span className="text-gray-400">N/A</span>
              )}
            </TableCell>
          ),
        },
        {
          id: 'fillRateTrend',
          header: <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>,
          cell: ({ item }) => (
            <TableCell className="text-center border-r-2 border-gray-300">
              {renderTrendIndicator(item.fillRateTrend, item.fillRateChangePercent)}
            </TableCell>
          ),
        },
        {
          id: 'winRate',
          header: renderTooltipHeader(
            'Win Rate',
            'Win Rate measures the percentage of bid requests that received a valid bid response. It reflects how attractive your inventory is to DSPs and buyers. Low values may indicate poor match rates, pricing issues, or low DSP participation.'
          ),
          cell: ({ item }) => (
            <TableCell className="text-center">
              {item.winRate !== null && item.winRate !== undefined ? (
                <span className="text-black">{formatPercentage(item.winRate)}</span>
              ) : (
                <span className="text-gray-400">N/A</span>
              )}
            </TableCell>
          ),
        },
        {
          id: 'winRateTrend',
          header: <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>,
          cell: ({ item }) => (
            <TableCell className="text-center border-r-2 border-gray-300">
              {renderTrendIndicator(item.winRateTrend, item.winRateChangePercent)}
            </TableCell>
          ),
        },
      ],
    },
  }), [formatCurrency, formatEcpm, formatRpbr, formatPercentage, formatLargeNumber, renderTrendIndicator, renderTooltipHeader, expandedDates, toggleDateExpansion]);

      // Enhance tableConfig with expansion states and functions
      const enhancedTableConfig = useMemo(() => ({
        ...tableConfig,
        expandedDates,
        loadingHourlyData,
        hourlyDataCache,
        onRowClick: (item, id) => toggleDateExpansion(item.formattedDate, item.dateKey || item.formattedDate, id),
      }), [tableConfig, expandedDates, loadingHourlyData, hourlyDataCache, toggleDateExpansion]);

  return (
    <AnalyticsTemplate
      entityIdParam="id"
      entityNameParam="name"
      defaultEntityName="Site Analytics"
      buildPayload={buildPayload}
      processAnalyticsData={processAnalyticsData}
      calculateSummaryStats={calculateSummaryStats}
      pageTitle="Site Analytics"
      backButtonPath="/SiteManagement"
      backButtonLabel="Back to Site Management"
      tableConfig={enhancedTableConfig}
      formatCurrency={formatCurrency}
      getAuthToken={getToken}
      networkOperationsConfig={networkOperationsMetrics}
      useNetworkOpsOnlyDaily
    />
  );
}
