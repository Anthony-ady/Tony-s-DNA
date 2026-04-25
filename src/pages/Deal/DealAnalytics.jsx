/**
 * Deal Analytics Page Component
 * 
 * This page provides detailed analytics for a specific deal using the Druid API endpoint.
 * It uses the AnalyticsTemplate for common functionality and provides deal-specific logic.
 */

import React, { useMemo, useCallback, useState } from "react";
import AnalyticsTemplate from "@/pages/Dashboard/AnalyticsTemplate";
import { Card, CardContent } from "@/components/ui/card";
import { TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, BarChart3, Calendar, Info, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { API_ENDPOINTS } from "@/config/api";
import { formatCurrency, formatEcpm, formatRpbr, formatLargeNumber, formatPercentage } from "@/utils/formatters";
import { TAILWIND_CLASSES } from "@/config/theme";

export default function DealAnalytics() {
  const { getToken } = useAuth();
  const useNetworkOpsOnlyDaily = true;
  
  // States for hourly data expansion
  const [expandedDates, setExpandedDates] = useState(new Set());
  const [hourlyDataCache, setHourlyDataCache] = useState({});
  const [loadingHourlyData, setLoadingHourlyData] = useState(new Set());
  
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
    derived: ["rpbr", "fillRate", "winRate"],
    filtersBuilder: ({ entityId }) => {
      const filters = {};
      if (entityId) {
        filters.DealId = {
          Value: [entityId],
          Operator: "in",
        };
      }

      return filters;
    },
  }), []);
  
  // Build API payload based on entity ID, dates, and view mode
  const buildPayload = (dealId, beginDateISO, endDateISO, viewMode) => {
    const granularity = viewMode === 'hourly' ? { type: "period", period: "PT1H" } : { type: "period", period: "P1D" };

    return {
          Intervals: [
            {
          Begin: beginDateISO,
          End: endDateISO
            }
          ],
          Size: 1000,
          Metrics: ["PricePublisher", "PriceAdvertiser_PublisherSide", "CLICK", "IMPRESSION"],
          View: "SIMPLE_PUBLISHER",
          Datasource: "adserver_stats",
          AddTotalRow: false,
          TimeZone: "Etc/GMT",
      Granularity: granularity,
          Filters: {
            Dealid: {
              Value: [dealId],
              Operator: "in"
            }
          }
        };
  };

  // Process raw API response data
  const processAnalyticsData = (responseData, viewMode, networkOpsData) => {
    // Filter out entries that don't have metrics
        const filteredData = responseData.filter(item => 
          item.PricePublisher !== undefined || item.PriceAdvertiser_PublisherSide !== undefined
        );
        
        if (viewMode === 'hourly') {
      // Sort data by timestamp
          const sortedData = filteredData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          
      // Group data by day (using UTC+0 timezone - no adjustment)
          const dataByDay = {};
          sortedData.forEach((item) => {
            let cleanTimestamp = item.timestamp;
            cleanTimestamp = cleanTimestamp.replace(/\.\d{6}/, '');
            if (!cleanTimestamp.endsWith('Z') && !cleanTimestamp.includes('+')) {
              cleanTimestamp += 'Z';
            }
            
            const date = new Date(cleanTimestamp);
        // Use UTC+0 timezone (no adjustment)
            const adjustedDate = new Date(date.getTime());
            const dayKey = adjustedDate.toISOString().slice(0, 10);
            
            if (!dataByDay[dayKey]) {
              dataByDay[dayKey] = [];
            }
            
            dataByDay[dayKey].push({
              ...item,
              cleanDate: adjustedDate,
              hour: adjustedDate.getUTCHours()
            });
          });
          
      // Create comparison rows
      const processedData = [];
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
          const adjustedToday = new Date(today.getTime());
          const adjustedYesterday = new Date(yesterday.getTime());
          const todayData = dataByDay[adjustedToday.toISOString().slice(0, 10)] || [];
          const yesterdayData = dataByDay[adjustedYesterday.toISOString().slice(0, 10)] || [];
          
          const yesterdayMap = {};
          yesterdayData.forEach(item => {
            yesterdayMap[item.hour] = item;
          });

          const todayMap = {};
          todayData.forEach((item) => {
            todayMap[item.hour] = item;
          });

          // Union of UTC hours: for missing "today" slots, project from yesterday * trend ratio (comparable hours)
          const hoursSet = new Set();
          todayData.forEach((i) => hoursSet.add(i.hour));
          yesterdayData.forEach((i) => hoursSet.add(i.hour));
          const hoursToShow = Array.from(hoursSet).sort((a, b) => a - b);

          // Trend on comparable hours: ratio today/hier = (1 + %). Applied heure par heure to missing "today" slots
          let sumTodayDspForTrend = 0;
          let sumYesterdayDspForTrend = 0;
          todayData.forEach((tItem) => {
            const yItem = yesterdayMap[tItem.hour];
            if (yItem) {
              sumTodayDspForTrend += tItem.PriceAdvertiser_PublisherSide || 0;
              sumYesterdayDspForTrend += yItem.PriceAdvertiser_PublisherSide || 0;
            }
          });
          const trendRatio = sumYesterdayDspForTrend > 0
            ? sumTodayDspForTrend / sumYesterdayDspForTrend
            : 1;

          const makeEmptyTodayItem = (hour) => {
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
              isProjected: true
            };
          };

          const buildProjectedTodayItem = (hour, yItem) => {
            const t = new Date();
            const cleanDate = new Date(
              Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), hour, 0, 0, 0)
            );
            if (!yItem) {
              return makeEmptyTodayItem(hour);
            }
            const s = (v) => (v || 0) * trendRatio;
            const pricePub = s(yItem.PricePublisher);
            const priceDsp = s(yItem.PriceAdvertiser_PublisherSide);
            const cl = Math.round(s(yItem.CLICK ?? yItem.Click ?? 0));
            const im = Math.round(s(yItem.IMPRESSION ?? yItem.Impression ?? 0));
            return {
              timestamp: cleanDate.toISOString(),
              PricePublisher: pricePub,
              PriceAdvertiser_PublisherSide: priceDsp,
              CLICK: cl,
              IMPRESSION: im,
              cleanDate,
              hour,
              isProjected: true
            };
          };

      hoursToShow.forEach((hour) => {
            const todayItem = todayMap[hour] ?? buildProjectedTodayItem(hour, yesterdayMap[hour]);
            const yesterdayItem = yesterdayMap[todayItem.hour];
            
        const todayClicks = todayItem.CLICK ?? todayItem.Click ?? 0;
        const todayImpressions = todayItem.IMPRESSION ?? todayItem.Impression ?? 0;
        const todayCtr = todayImpressions ? (todayClicks / todayImpressions) * 100 : 0;
        const yesterdayClicks = yesterdayItem ? (yesterdayItem.CLICK ?? yesterdayItem.Click ?? 0) : 0;
        const yesterdayImpressions = yesterdayItem ? (yesterdayItem.IMPRESSION ?? yesterdayItem.Impression ?? 0) : 0;
        const yesterdayCtr = yesterdayImpressions ? (yesterdayClicks / yesterdayImpressions) * 100 : 0;

        const clickTrend = yesterdayItem
          ? (todayClicks > yesterdayClicks ? 'up' : todayClicks < yesterdayClicks ? 'down' : 'same')
          : 'same';
        const clickChangePercent = yesterdayClicks > 0
          ? (((todayClicks - yesterdayClicks) / yesterdayClicks) * 100).toFixed(1)
          : 0;

        const impressionTrend = yesterdayItem
          ? (todayImpressions > yesterdayImpressions ? 'up' : todayImpressions < yesterdayImpressions ? 'down' : 'same')
          : 'same';
        const impressionChangePercent = yesterdayImpressions > 0
          ? (((todayImpressions - yesterdayImpressions) / yesterdayImpressions) * 100).toFixed(1)
          : 0;

        const ctrTrend = yesterdayItem
          ? (todayCtr > yesterdayCtr ? 'up' : todayCtr < yesterdayCtr ? 'down' : 'same')
          : 'same';
        const ctrChangePercent = yesterdayCtr > 0
          ? (((todayCtr - yesterdayCtr) / yesterdayCtr) * 100).toFixed(1)
          : 0;

        const todayDspRevenue = todayItem.PriceAdvertiser_PublisherSide || 0;
        const yesterdayDspRevenue = yesterdayItem ? (yesterdayItem.PriceAdvertiser_PublisherSide || 0) : 0;
        const dspRevenueTrend = yesterdayItem
          ? (todayDspRevenue > yesterdayDspRevenue ? 'up' : todayDspRevenue < yesterdayDspRevenue ? 'down' : 'same')
          : 'same';
        const dspRevenueChangePercent = yesterdayDspRevenue > 0
          ? (((todayDspRevenue - yesterdayDspRevenue) / yesterdayDspRevenue) * 100).toFixed(1)
          : 0;

        const todayPublisherCosts = todayItem.PricePublisher || 0;
        const yesterdayPublisherCosts = yesterdayItem ? (yesterdayItem.PricePublisher || 0) : 0;
        const publisherCostsTrend = yesterdayItem
          ? (todayPublisherCosts > yesterdayPublisherCosts ? 'up' : todayPublisherCosts < yesterdayPublisherCosts ? 'down' : 'same')
          : 'same';
        const publisherCostsChangePercent = yesterdayPublisherCosts > 0
          ? (((todayPublisherCosts - yesterdayPublisherCosts) / yesterdayPublisherCosts) * 100).toFixed(1)
          : 0;

        const todayMargin = todayDspRevenue - todayPublisherCosts;
        const yesterdayMargin = yesterdayDspRevenue - yesterdayPublisherCosts;
        const marginTrend = yesterdayItem
          ? (todayMargin > yesterdayMargin ? 'up' : todayMargin < yesterdayMargin ? 'down' : 'same')
          : 'same';
        const marginChangePercent = yesterdayMargin !== 0
          ? (((todayMargin - yesterdayMargin) / Math.abs(yesterdayMargin)) * 100).toFixed(1)
          : 0;

        const isProjected = !todayMap[hour];
        const dateBase = `${todayItem.cleanDate.toLocaleDateString('fr-FR', { timeZone: 'UTC' })} ${todayItem.cleanDate.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true,
                timeZone: 'UTC'
              })}`;

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
              formattedDate: isProjected ? `${dateBase} (estim.)` : dateBase,
              hourOnly: todayItem.cleanDate.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true,
                timeZone: 'UTC'
          }),
          yesterdayData: yesterdayItem || {
            PriceAdvertiser_PublisherSide: 0,
            PricePublisher: 0
          },
          yesterdayDspRevenue: yesterdayDspRevenue
            });
          });
      
      return processedData;
        } else {
          let processedData = filteredData.map((item, index) => {
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
            
            const sourceDateKey = typeof item.timestamp === 'string' && item.timestamp.length >= 10
              ? item.timestamp.slice(0, 10)
              : null;

            const dateKey = sourceDateKey && sourceDateKey.length === 10
              ? sourceDateKey
              : date.toISOString().slice(0, 10);

            const previousItem = index > 0 ? filteredData[index - 1] : null;
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

            const clicks = item.CLICK ?? item.Click ?? 0;
            const impressions = item.IMPRESSION ?? item.Impression ?? 0;
            const ctr = impressions ? (clicks / impressions) * 100 : 0;
            const previousClicks = previousItem ? (previousItem.CLICK ?? previousItem.Click ?? 0) : 0;
            const previousImpressions = previousItem ? (previousItem.IMPRESSION ?? previousItem.Impression ?? 0) : 0;
            const previousCtr = previousImpressions ? (previousClicks / previousImpressions) * 100 : 0;

            const clickTrend = previousItem
              ? (clicks > previousClicks ? 'up' : clicks < previousClicks ? 'down' : 'same')
              : 'same';
            const clickChangePercent = previousClicks > 0
              ? (((clicks - previousClicks) / previousClicks) * 100).toFixed(1)
              : 0;

            const impressionTrend = previousItem
              ? (impressions > previousImpressions ? 'up' : impressions < previousImpressions ? 'down' : 'same')
              : 'same';
            const impressionChangePercent = previousImpressions > 0
              ? (((impressions - previousImpressions) / previousImpressions) * 100).toFixed(1)
              : 0;

            const ctrTrend = previousItem
              ? (ctr > previousCtr ? 'up' : ctr < previousCtr ? 'down' : 'same')
              : 'same';
            const ctrChangePercent = previousCtr > 0
              ? (((ctr - previousCtr) / previousCtr) * 100).toFixed(1)
              : 0;
            
            return {
              ...item,
              formattedDate,
              dateKey,
              margin: item.PriceAdvertiser_PublisherSide - item.PricePublisher,
              marginPercentage: item.PriceAdvertiser_PublisherSide > 0 ? ((item.PriceAdvertiser_PublisherSide - item.PricePublisher) / item.PriceAdvertiser_PublisherSide * 100).toFixed(2) : 0,
              dspRevenueTrend,
              dspRevenueChangePercent,
              publisherCostsTrend,
              publisherCostsChangePercent,
              marginTrend,
              marginChangePercent,
              click: clicks,
              impression: impressions,
              ctr,
              clickTrend,
              clickChangePercent,
              impressionTrend,
              impressionChangePercent,
              ctrTrend,
              ctrChangePercent
            };
          });

          if (networkOpsData && Array.isArray(networkOpsData) && networkOpsData.length > 0) {
            const networkOpsMap = {};
            networkOpsData.forEach((networkItem) => {
              let networkDateKey = null;
              let networkDateObj = null;

              if (typeof networkItem.timestamp === 'string') {
                const candidate = networkItem.timestamp.slice(0, 10);
                if (candidate && candidate.length === 10) {
                  networkDateKey = candidate;
                }
              }

              if (!networkDateKey) {
                let cleanTimestamp = networkItem.timestamp;
                cleanTimestamp = cleanTimestamp.replace(/\.\d{6}/g, '');
                if (!cleanTimestamp.endsWith('Z') && !cleanTimestamp.includes('+')) {
                  cleanTimestamp += 'Z';
                }
                const networkDate = new Date(cleanTimestamp);
                if (!isNaN(networkDate.getTime())) {
                  networkDateKey = networkDate.toISOString().slice(0, 10);
                  networkDateObj = networkDate;
                }
              }

              if (!networkDateObj && networkDateKey) {
                const fallbackDate = new Date(`${networkDateKey}T00:00:00Z`);
                if (!isNaN(fallbackDate.getTime())) {
                  networkDateObj = fallbackDate;
                }
              }

              if (networkDateKey) {
                networkOpsMap[networkDateKey] = networkItem;
              }

              if (networkDateObj) {
                const displayKey = networkDateObj.toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                });
                networkOpsMap[displayKey] = networkItem;
              }
            });

            processedData = processedData.map((item) => {
              const networkOpsItem = networkOpsMap[item.dateKey] || networkOpsMap[item.formattedDate];
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

    const sumRows = (rows) => {
      if (!rows.length) {
        return {
          totalPublisher: 0,
          totalDSP: 0,
          totalMargin: 0,
          marginPercentage: 0,
          dataPoints: 0
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
        dataPoints: rows.length
      };
    };

    if (viewMode === 'hourly') {
      const realRows = data.filter((item) => !item.isProjected);
      const hasProjected = data.some((item) => item.isProjected);
      const realStats = sumRows(realRows);
      if (hasProjected) {
        return { ...realStats, estimated: sumRows(data) };
      }
      return realStats;
    }

    return sumRows(data);
  };

  // Fetch hourly data for a specific date
  const fetchHourlyDataForDate = async (dateString, dealId) => {
    const token = getToken();
    if (!token) {
      throw new Error("No authentication token found");
    }

    // Parse the date string - handle both DD/MM/YYYY and YYYY-MM-DD formats
    let date;
    if (dateString.includes('/')) {
      // Format: DD/MM/YYYY
      const [day, month, year] = dateString.split('/');
      date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day), 0, 0, 0, 0));
    } else {
      // Format: YYYY-MM-DD
      date = new Date(dateString + 'T00:00:00.000Z');
    }
    
    const nextDay = new Date(date);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    const startDateValue = date;
    const endDateValue = new Date(nextDay.getTime() - 1); // End at 23:59:59 of the selected day

    const payload = {
      Intervals: [{
        Begin: startDateValue.toISOString(),
        End: endDateValue.toISOString()
      }],
      Size: 1000,
      Metrics: ["PricePublisher", "PriceAdvertiser_PublisherSide", "CLICK", "IMPRESSION"],
      View: "SIMPLE_PUBLISHER",
      Datasource: "adserver_stats",
      AddTotalRow: false,
      TimeZone: "Etc/GMT",
      Granularity: {
        type: "period",
        period: "PT1H"
      },
      Filters: {
        Dealid: {
          Value: [dealId],
          Operator: "in"
        }
      }
    };

    const response = await fetch(API_ENDPOINTS.DRUID_SEARCH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ayl-auth-token": token
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Process hourly data
    const sortedData = data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    return sortedData.map((item) => {
      // Clean timestamp
      let cleanTimestamp = item.timestamp;
      cleanTimestamp = cleanTimestamp.replace(/\.\d{6}/, '');
      if (!cleanTimestamp.endsWith('Z') && !cleanTimestamp.includes('+')) {
        cleanTimestamp += 'Z';
      }
      
      const date = new Date(cleanTimestamp);
      const clicks = item.CLICK ?? item.Click ?? 0;
      const impressions = item.IMPRESSION ?? item.Impression ?? 0;
      const ctr = impressions ? (clicks / impressions) * 100 : 0;
      
      return {
        ...item,
        date: date.toLocaleDateString('fr-FR'),
        formattedTime: date.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true,
          timeZone: 'UTC'
        }),
        hour: date.getUTCHours(),
        margin: item.PriceAdvertiser_PublisherSide - item.PricePublisher,
        marginPercentage: item.PriceAdvertiser_PublisherSide > 0 ? ((item.PriceAdvertiser_PublisherSide - item.PricePublisher) / item.PriceAdvertiser_PublisherSide * 100).toFixed(2) : 0,
        click: clicks,
        impression: impressions,
        ctr
      };
    });
  };

  // Toggle date expansion and fetch hourly data
  const toggleDateExpansion = async (dateString, dateKey, dealId) => {
    const key = dateKey || dateString;
    const newExpandedDates = new Set(expandedDates);
    
    if (newExpandedDates.has(key)) {
      // Collapse
      newExpandedDates.delete(key);
    } else {
      // Expand - fetch hourly data if not cached
      newExpandedDates.add(key);
      
      if (!hourlyDataCache[key] && !loadingHourlyData.has(key)) {
        setLoadingHourlyData(prev => new Set(prev).add(key));
        
        try {
          const dateToFetch = dateKey || dateString;
          const hourlyData = await fetchHourlyDataForDate(dateToFetch, dealId);
          setHourlyDataCache(prev => ({
            ...prev,
            [key]: hourlyData
          }));
        } catch (err) {
          console.error(`Error fetching hourly data for ${dateString}:`, err);
        } finally {
          setLoadingHourlyData(prev => {
            const newSet = new Set(prev);
            newSet.delete(key);
            return newSet;
          });
        }
      }
    }
    
    setExpandedDates(newExpandedDates);
  };

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

  const renderTooltipHeader = useCallback((label, tooltipText, className = "") => (
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

  // Render summary cards
  const renderSummaryCards = (summaryStats, viewMode, formatCurrencyFn) => {
    const real = summaryStats;
    const est = summaryStats?.estimated;
    const showEstimated = viewMode === 'hourly' && est && typeof est.totalDSP === 'number';

    const realTimeCards = (
      <>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={TAILWIND_CLASSES.formSectionLabel}>DSP Revenue</p>
                <p className="text-lg lg:text-xl font-bold text-green-600">{formatCurrencyFn(real.totalDSP)}</p>
              </div>
              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={TAILWIND_CLASSES.formSectionLabel}>Publisher Costs</p>
                <p className="text-lg lg:text-xl font-bold text-red-600">{formatCurrencyFn(real.totalPublisher)}</p>
              </div>
              <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={TAILWIND_CLASSES.formSectionLabel}>Margin</p>
                <p className="text-lg lg:text-xl font-bold" style={{ color: 'rgb(79, 70, 229)' }}>{formatCurrencyFn(real.totalMargin)}</p>
              </div>
              <div className="w-8 h-8 bg-gradient-to-br from-[rgb(75,99,226)] to-purple-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={TAILWIND_CLASSES.formSectionLabel}>Avg Margin %</p>
                <p className="text-lg lg:text-xl font-bold text-orange-600">{Number(real.marginPercentage ?? 0).toFixed(1)}%</p>
              </div>
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <Calendar className="w-4 h-4 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </>
    );

    if (!showEstimated) {
      return realTimeCards;
    }

    const realTimeGrid = (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {realTimeCards}
      </div>
    );

    const estimGrid = (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-blue-200 bg-blue-50/60 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={TAILWIND_CLASSES.formSectionLabel}>DSP Revenue</p>
                <p className="text-lg lg:text-xl font-bold text-blue-600">{formatCurrencyFn(est.totalDSP)}</p>
              </div>
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/60 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={TAILWIND_CLASSES.formSectionLabel}>Publisher Costs</p>
                <p className="text-lg lg:text-xl font-bold text-blue-600">{formatCurrencyFn(est.totalPublisher)}</p>
              </div>
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/60 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={TAILWIND_CLASSES.formSectionLabel}>Margin</p>
                <p className="text-lg lg:text-xl font-bold text-blue-600">{formatCurrencyFn(est.totalMargin)}</p>
              </div>
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/60 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={TAILWIND_CLASSES.formSectionLabel}>Avg Margin %</p>
                <p className="text-lg lg:text-xl font-bold text-blue-600">{Number(est.marginPercentage ?? 0).toFixed(1)}%</p>
              </div>
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center">
                <Calendar className="w-4 h-4 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );

    return (
      <div className="col-span-full w-full max-w-full space-y-6">
        <div>
          <p className="text-sm font-medium text-slate-600 mb-2">Real time (received data only)</p>
          {realTimeGrid}
        </div>
        <div>
          <p className="text-sm font-medium text-blue-700 mb-2">Estimated (full day, including hourly projections)</p>
          {estimGrid}
        </div>
      </div>
    );
  };

  // Prepare chart data for hourly view
  const prepareHourlyChartData = (data) => {
    if (!data?.length) return [];
    const mapped = data.map((item) => {
      const hourOnly = item.hourOnly || 'N/A';
      const yesterdayDspRevenue = item.yesterdayData ? item.yesterdayData.PriceAdvertiser_PublisherSide || 0 : 0;
      const dsp = item.PriceAdvertiser_PublisherSide || 0;
      return {
        ...item,
        hourOnly,
        yesterdayDspRevenue,
        dspRevenueTodayReal: item.isProjected ? null : dsp,
        dspRevenueTodayProjected: item.isProjected ? dsp : null,
        bridgeDsp: null
      };
    });
    // Lien visuel vert → bleu : recharts trace deux polylignes; un segment teal sur la dernière heure réelle + 1ʳᵉ heure estimée
    for (let i = 0; i < mapped.length - 1; i += 1) {
      if (!mapped[i].isProjected && mapped[i + 1].isProjected) {
        const v0 = mapped[i].PriceAdvertiser_PublisherSide || 0;
        const v1 = mapped[i + 1].PriceAdvertiser_PublisherSide || 0;
        mapped[i] = { ...mapped[i], bridgeDsp: v0 };
        mapped[i + 1] = { ...mapped[i + 1], bridgeDsp: v1 };
        break;
      }
    }
    return mapped;
  };

  // Render chart component
  const renderChart = (analyticsData, viewMode) => {
    if (!analyticsData?.length) return null;

    if (viewMode === 'hourly') {
      return (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={prepareHourlyChartData(analyticsData)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="hourOnly"
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${(value / 1000000).toFixed(0)}`}
              />
              <RechartsTooltip
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                  backgroundColor: '#f9fafb',
                  color: '#374151',
                  fontSize: '14px',
                  padding: '10px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                }}
                formatter={(value, name, item) => {
                  if (item?.dataKey === 'bridgeDsp' || name === 'bridgeDsp') {
                    return ['', ''];
                  }
                  if (value == null || Number.isNaN(Number(value))) {
                    return ['', ''];
                  }
                  return [
                    `$${(value / 1000000).toFixed(2)}`,
                    name === 'dspRevenueTodayReal' ? 'DSP Revenue' :
                    name === 'dspRevenueTodayProjected' ? 'DSP Revenue (estim.)' :
                    name === 'yesterdayDspRevenue' ? 'Yesterday DSP Revenue' : name
                  ];
                }}
                labelFormatter={(label) => `Time: ${label}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="dspRevenueTodayReal"
                stroke="#10b981"
                strokeWidth={2}
                connectNulls
                name="DSP Revenue"
                dot={false}
                activeDot={false}
              />
              <Line
                type="monotone"
                dataKey="dspRevenueTodayProjected"
                stroke="#2563eb"
                strokeWidth={2}
                connectNulls
                name="DSP Revenue (estim.)"
                dot={false}
                activeDot={false}
              />
              <Line
                type="monotone"
                dataKey="yesterdayDspRevenue"
                stroke="#6b7280"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Yesterday DSP Revenue"
                dot={false}
                activeDot={false}
              />
              <Line
                type="linear"
                dataKey="bridgeDsp"
                stroke="#14b8a6"
                strokeWidth={2}
                connectNulls
                name=""
                legendType="none"
                dot={false}
                activeDot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // Daily view chart (restores 5D/7D/30d chart)
    return (
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={analyticsData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="formattedDate"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => formatCurrency(value)}
            />
            <RechartsTooltip
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                backgroundColor: '#f9fafb',
                color: '#374151',
                fontSize: '14px',
                padding: '10px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              }}
              formatter={(value, name, props) => [
                formatCurrency(value),
                props?.dataKey === 'PriceAdvertiser_PublisherSide' ? 'DSP Revenue' :
                props?.dataKey === 'PricePublisher' ? 'Publisher Costs' : name
              ]}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="PriceAdvertiser_PublisherSide"
              stroke="#10b981"
              strokeWidth={2}
              name="DSP Revenue"
              dot={false}
              activeDot={false}
            />
            <Line
              type="monotone"
              dataKey="PricePublisher"
              stroke="#ef4444"
              strokeWidth={2}
              name="Publisher Costs"
              dot={false}
              activeDot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const tableConfig = useMemo(() => ({
    hourly: {
      columns: [
        {
          id: 'date',
          header: <TableHead className="font-medium text-center">Date</TableHead>,
          cell: ({ item }) => (
            <TableCell className={`font-medium text-center${item.isProjected ? ' text-blue-600' : ''}`}>{item.formattedDate}</TableCell>
          ),
        },
        {
          id: 'dspRevenue',
          header: <TableHead className="text-center">DSP Revenue</TableHead>,
          cell: ({ item }) => (
                              <TableCell className={item.isProjected ? 'text-center text-blue-600' : 'text-center text-green-600'}>
              {formatCurrency(item.PriceAdvertiser_PublisherSide || 0)}
                              </TableCell>
          ),
        },
        {
          id: 'yesterdayDspRevenue',
          header: <TableHead className="text-center">Yesterday DSP Revenue</TableHead>,
          cell: ({ item }) => {
            const yesterdayRevenue = item.yesterdayData ? item.yesterdayData.PriceAdvertiser_PublisherSide || 0 : 0;
            return (
                              <TableCell className="text-center text-green-600 opacity-60">
                {formatCurrency(yesterdayRevenue)}
                              </TableCell>
            );
          },
        },
        {
          id: 'dspTrend',
          header: <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>,
          cell: ({ item }) => (
                              <TableCell className={`text-center border-r-2 border-gray-300${item.isProjected ? ' text-blue-600' : ''}`}>
              {renderTrendIndicator(item.dspRevenueTrend, item.dspRevenueChangePercent, item.isProjected
                ? { upColor: 'text-blue-500', downColor: 'text-blue-800' }
                : { upColor: 'text-green-500', downColor: 'text-red-500' })}
                              </TableCell>
          ),
        },
        {
          id: 'publisherCosts',
          header: <TableHead className="text-center">Publisher Costs</TableHead>,
          cell: ({ item }) => (
                              <TableCell className={item.isProjected ? 'text-center text-blue-600' : 'text-center text-red-600'}>
              {formatCurrency(item.PricePublisher || 0)}
                              </TableCell>
          ),
        },
        {
          id: 'yesterdayPublisherCosts',
          header: <TableHead className="text-center">Yesterday Publisher Costs</TableHead>,
          cell: ({ item }) => {
            const yesterdayPublisher = item.yesterdayData ? item.yesterdayData.PricePublisher || 0 : 0;
            return (
                              <TableCell className="text-center text-red-600 opacity-60">
                {formatCurrency(yesterdayPublisher)}
                              </TableCell>
            );
          },
        },
        {
          id: 'publisherTrend',
          header: <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>,
          cell: ({ item }) => (
                              <TableCell className={`text-center border-r-2 border-gray-300${item.isProjected ? ' text-blue-600' : ''}`}>
              {renderTrendIndicator(item.publisherCostsTrend, item.publisherCostsChangePercent, item.isProjected
                ? { upColor: 'text-blue-500', downColor: 'text-blue-800' }
                : { upColor: 'text-red-500', downColor: 'text-green-500' })}
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
                              <TableCell className={item.isProjected ? 'text-center text-blue-600' : 'text-center text-black'}>
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
            const yesterdayMargin = yesterdayRevenue - yesterdayPublisher;
            return (
                              <TableCell className="text-center text-black opacity-60">
                                {formatCurrency(yesterdayMargin)}
                              </TableCell>
            );
          },
        },
        {
          id: 'marginTrend',
          header: <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>,
          cell: ({ item }) => (
                              <TableCell className={`text-center border-r-2 border-gray-300${item.isProjected ? ' text-blue-600' : ''}`}>
              {renderTrendIndicator(
                item.marginTrend,
                item.marginChangePercent,
                item.isProjected ? { upColor: 'text-blue-500', downColor: 'text-blue-800' } : undefined
              )}
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
            const marginPercentage = dspRevenue > 0 ? (margin / dspRevenue) * 100 : 0;
            return (
                              <TableCell className="text-center">
              {marginPercentage > 0 ? (
                <span
                  className={
                    item.isProjected
                      ? 'px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-blue-100 text-blue-800 inline-block'
                      : 'px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block'
                  }
                >
                  {marginPercentage.toFixed(1)}%
                </span>
              ) : item.isProjected ? (
                <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-blue-100 text-blue-800 inline-block">
                  {marginPercentage.toFixed(1)}%
                </span>
              ) : (
                  <Badge variant="destructive">{marginPercentage.toFixed(1)}%</Badge>
              )}
                              </TableCell>
            );
          },
        },
        {
          id: 'profitYesterday',
          header: <TableHead className="text-center border-r-2 border-gray-300">Yesterday Profit %</TableHead>,
          cell: ({ item }) => {
            const yesterdayRevenue = item.yesterdayData ? item.yesterdayData.PriceAdvertiser_PublisherSide || 0 : 0;
            const yesterdayPublisher = item.yesterdayData ? item.yesterdayData.PricePublisher || 0 : 0;
            const yesterdayMargin = yesterdayRevenue - yesterdayPublisher;
            const marginPercentage = yesterdayRevenue > 0 ? (yesterdayMargin / yesterdayRevenue) * 100 : 0;
            return (
                              <TableCell className="text-center border-r-2 border-gray-300">
                {marginPercentage > 0 ? (
                <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white opacity-60 inline-block">
                    {marginPercentage.toFixed(1)}%
                </span>
              ) : (
                  <Badge variant="destructive" className="opacity-60">{marginPercentage.toFixed(1)}%</Badge>
              )}
                              </TableCell>
            );
          },
        },
        {
          id: 'click',
          header: <TableHead className="text-center">Click</TableHead>,
          cell: ({ item }) => (
                              <TableCell className={item.isProjected ? 'text-center text-blue-600' : 'text-center'}>
              {formatLargeNumber(item.click ?? 0)}
                              </TableCell>
          ),
        },
        {
          id: 'yesterdayClick',
          header: <TableHead className="text-center">Yesterday Click</TableHead>,
          cell: ({ item }) => (
                              <TableCell className="text-center opacity-60">
              {formatLargeNumber(item.yesterdayClick ?? 0)}
                              </TableCell>
          ),
        },
        {
          id: 'clickTrend',
          header: <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>,
          cell: ({ item }) => (
                              <TableCell className={`text-center border-r-2 border-gray-300${item.isProjected ? ' text-blue-600' : ''}`}>
              {renderTrendIndicator(
                item.clickTrend,
                item.clickChangePercent,
                item.isProjected ? { upColor: 'text-blue-500', downColor: 'text-blue-800' } : undefined
              )}
                              </TableCell>
          ),
        },
        {
          id: 'impression',
          header: <TableHead className="text-center">Impression</TableHead>,
          cell: ({ item }) => (
                              <TableCell className={item.isProjected ? 'text-center text-blue-600' : 'text-center'}>
              {formatLargeNumber(item.impression ?? 0)}
                              </TableCell>
          ),
        },
        {
          id: 'yesterdayImpression',
          header: <TableHead className="text-center">Yesterday Impression</TableHead>,
          cell: ({ item }) => (
                              <TableCell className="text-center opacity-60">
              {formatLargeNumber(item.yesterdayImpression ?? 0)}
                              </TableCell>
          ),
        },
        {
          id: 'impressionTrend',
          header: <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>,
          cell: ({ item }) => (
                              <TableCell className={`text-center border-r-2 border-gray-300${item.isProjected ? ' text-blue-600' : ''}`}>
              {renderTrendIndicator(
                item.impressionTrend,
                item.impressionChangePercent,
                item.isProjected ? { upColor: 'text-blue-500', downColor: 'text-blue-800' } : undefined
              )}
                              </TableCell>
          ),
        },
        {
          id: 'ctr',
          header: <TableHead className="text-center">CTR</TableHead>,
          cell: ({ item }) => (
                              <TableCell className={item.isProjected ? 'text-center text-blue-600' : 'text-center'}>
              {formatPercentage(item.ctr ?? 0)}
                              </TableCell>
          ),
        },
        {
          id: 'yesterdayCtr',
          header: <TableHead className="text-center">Yesterday CTR</TableHead>,
          cell: ({ item }) => (
                              <TableCell className="text-center opacity-60">
              {formatPercentage(item.yesterdayCtr ?? 0)}
                              </TableCell>
          ),
        },
        {
          id: 'ctrTrend',
          header: <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>,
          cell: ({ item }) => (
                              <TableCell className={`text-center border-r-2 border-gray-300${item.isProjected ? ' text-blue-600' : ''}`}>
              {renderTrendIndicator(
                item.ctrTrend,
                item.ctrChangePercent,
                item.isProjected ? { upColor: 'text-blue-500', downColor: 'text-blue-800' } : undefined
              )}
                              </TableCell>
          ),
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
          header: <TableHead className="text-center border-r-2 border-gray-300">Profit %</TableHead>,
          cell: ({ item }) => {
            const dspRevenue = item.PriceAdvertiser_PublisherSide || 0;
            const publisherCosts = item.PricePublisher || 0;
            const margin = dspRevenue - publisherCosts;
            const marginPercentage = dspRevenue > 0 ? (margin / dspRevenue) * 100 : 0;
            return (
                              <TableCell className="text-center border-r-2 border-gray-300">
                                {marginPercentage > 0 ? (
                                  <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                                    {marginPercentage.toFixed(1)}%
                                  </span>
                                ) : (
                  <Badge variant="destructive">{marginPercentage.toFixed(1)}%</Badge>
                )}
              </TableCell>
            );
          },
        },
        {
          id: 'click',
          header: <TableHead className="text-center">Click</TableHead>,
          cell: ({ item }) => (
                              <TableCell className="text-center">
              {formatLargeNumber(item.click ?? 0)}
                              </TableCell>
          ),
        },
        {
          id: 'clickTrend',
          header: <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>,
          cell: ({ item }) => (
                              <TableCell className="text-center border-r-2 border-gray-300">
              {renderTrendIndicator(item.clickTrend, item.clickChangePercent)}
                              </TableCell>
          ),
        },
        {
          id: 'impression',
          header: <TableHead className="text-center">Impression</TableHead>,
          cell: ({ item }) => (
                              <TableCell className="text-center">
              {formatLargeNumber(item.impression ?? 0)}
                              </TableCell>
          ),
        },
        {
          id: 'impressionTrend',
          header: <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>,
          cell: ({ item }) => (
                              <TableCell className="text-center border-r-2 border-gray-300">
              {renderTrendIndicator(item.impressionTrend, item.impressionChangePercent)}
                              </TableCell>
          ),
        },
        {
          id: 'ctr',
          header: <TableHead className="text-center">CTR</TableHead>,
          cell: ({ item }) => (
                              <TableCell className="text-center">
              {formatPercentage(item.ctr ?? 0)}
                              </TableCell>
          ),
        },
        {
          id: 'ctrTrend',
          header: <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>,
          cell: ({ item }) => (
                              <TableCell className="text-center border-r-2 border-gray-300">
              {renderTrendIndicator(item.ctrTrend, item.ctrChangePercent)}
                              </TableCell>
          ),
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
      defaultEntityName="Deal Analytics"
      buildPayload={buildPayload}
      processAnalyticsData={processAnalyticsData}
      calculateSummaryStats={calculateSummaryStats}
      renderChart={renderChart}
      renderSummaryCards={renderSummaryCards}
      pageTitle="Deal Analytics"
      backButtonPath="/DealDashboard"
      backButtonLabel="Back to Deal Dashboard"
      tableConfig={enhancedTableConfig}
      formatCurrency={formatCurrency}
      getAuthToken={getToken}
      networkOperationsConfig={networkOperationsMetrics}
      useNetworkOpsOnlyDaily
    />
  );
}
