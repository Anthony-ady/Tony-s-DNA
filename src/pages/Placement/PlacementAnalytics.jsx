/**
 * Placement Analytics Page Component
 * 
 * This page provides detailed analytics for a specific placement using the Druid API endpoint.
 * It uses the AnalyticsTemplate for common functionality and provides placement-specific logic.
 */

import React, { useMemo, useState } from "react";
import { processHourlyTodayWithProjections, computeAnalyticsHourlySummaryStats, computeDailyAnalyticsSummaryStats } from "@/utils/hourlyProjections";
import AnalyticsTemplate from "@/pages/Dashboard/AnalyticsTemplate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, BarChart3, Calendar, Info, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { API_ENDPOINTS } from "@/config/api";
import { formatCurrency as formatCurrencyValue, formatCurrencyChart, formatEcpm, formatRpbr, formatLargeNumber } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { TAILWIND_CLASSES } from "@/config/theme";

export default function PlacementAnalytics() {
  const formatCurrency = formatCurrencyValue;
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
    derived: [
      "rpbr",
      "fillRate",
      "winRate"
    ],
    filtersBuilder: ({ entityId }) => {
      const filters = {};

      if (typeof window !== "undefined") {
        const selectedRealmId = localStorage.getItem('selected-realm-id');
        const selectedCompanyId = localStorage.getItem('selected-company-id');

        if (selectedRealmId) {
          filters.realmId = {
            Value: [selectedRealmId],
            Operator: "in"
          };
        }

        if (selectedCompanyId) {
          filters.publisherId = {
            Value: [selectedCompanyId],
            Operator: "in"
          };
        }
      }

      if (entityId) {
        filters.PlacementId = {
          Value: [entityId],
          Operator: "in"
        };
      }

      return filters;
    }
  }), []);
  
  // Build API payload based on entity ID, dates, and view mode
  const buildPayload = (placementId, beginDateISO, endDateISO, viewMode) => {
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
        Placement: {
          Value: [placementId],
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
          dateKey: date.toISOString().slice(0, 10), // Add dateKey for network operations merging
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
        
        // Merge network operations data if available
        if (networkOpsData && Array.isArray(networkOpsData) && networkOpsData.length > 0) {
          // Create a map of network operations data by date
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

          // Merge network operations data into processed data
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
        } else {
          // No network operations data available, set all to null
          processedData = processedData.map((item) => ({
            ...item,
            network_operations_bid_requests: null,
            network_operations_bid_responses: null,
            network_operations_impressions: null,
            network_operations_ecpm_publisher: null,
            rpbr: null,
            fillRate: null,
            winRate: null,
            bidRequestsTrend: 'same',
            bidRequestsChangePercent: 0,
            bidResponsesTrend: 'same',
            bidResponsesChangePercent: 0,
            impressionsTrend: 'same',
            impressionsChangePercent: 0,
            ecpmTrend: 'same',
            ecpmChangePercent: 0,
            rpbrTrend: 'same',
            rpbrChangePercent: 0,
            fillRateTrend: 'same',
            fillRateChangePercent: 0,
            winRateTrend: 'same',
            winRateChangePercent: 0
          }));
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


  // Render table headers
  const renderTableHeaders = (viewMode, showDetailedColumns) => {
    return (
      <>
                    <TableHead className="text-center">Date</TableHead>
        {viewMode === 'hourly' ? (
                        <>
                        <TableHead className="text-center">DSP Revenue</TableHead>
                        <TableHead className="text-center">Yesterday DSP Revenue</TableHead>
                        <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>
                        <TableHead className="text-center">Publisher Costs</TableHead>
                        <TableHead className="text-center">Yesterday Publisher Costs</TableHead>
                        <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>
                        <TableHead className="text-center">Margin</TableHead>
                        <TableHead className="text-center">Yesterday Margin</TableHead>
                        <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>
                        <TableHead className="text-center">Today Profit %</TableHead>
                        <TableHead className="text-center">Yesterday Profit %</TableHead>
                      </>
        ) : (
                      <>
                        <TableHead className="text-center">DSP Revenue</TableHead>
                          <TableHead className="text-center">Trend</TableHead>
                        <TableHead className="text-center">Publisher Costs</TableHead>
                          <TableHead className="text-center">Trend</TableHead>
                        <TableHead className="text-center">Margin</TableHead>
                          <TableHead className="text-center">Trend</TableHead>
                        <TableHead className="text-center">Profit %</TableHead>
                        {/* Detailed columns - conditionally rendered */}
                        {showDetailedColumns && (
                          <>
                            <TableHead className="text-center border-l-2 border-gray-300">Bid Requests</TableHead>
                            <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>
                            <TableHead className="text-center">Bid Responses</TableHead>
                            <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>
                            <TableHead className="text-center">Impressions</TableHead>
                            <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>
                            <TableHead className="text-center border-l-2 border-gray-300">
                                  <TooltipProvider delayDuration={200}>
                                    <UiTooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center justify-center gap-1 cursor-help text-center">
                                          eCPM Publisher
                                          <Info className="w-4 h-4 text-slate-400" aria-hidden="true" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs text-sm bg-[rgb(40,62,173)] text-white border-none">
                                        Publisher eCPM shows the revenue earned per thousand impressions.
                                        <br />
                                        It helps you evaluate yield efficiency across inventory.
                                        <br />
                                        Drops can highlight pricing, demand, or creative quality issues.
                                      </TooltipContent>
                                    </UiTooltip>
                                  </TooltipProvider>
                                </TableHead>
                                <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>
                            <TableHead className="text-center border-l-2 border-gray-300">
                                  <TooltipProvider delayDuration={200}>
                                    <UiTooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center justify-center gap-1 cursor-help text-center">
                                          RPBR/M
                                          <Info className="w-4 h-4 text-slate-400" aria-hidden="true" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs text-sm bg-[rgb(40,62,173)] text-white border-none">
                                        Revenue per Million Bid Requests (RPBR/M) indicates how much revenue your SSP generates for every one million bid requests.
                                        <br />
                                        It helps you measure request quality, efficiency, and monetization performance over time.
                                      </TooltipContent>
                                    </UiTooltip>
                                  </TooltipProvider>
                                </TableHead>
                            <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>
                            <TableHead className="text-center">
                                  <TooltipProvider delayDuration={200}>
                                    <UiTooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center justify-center gap-1 cursor-help text-center">
                                          Fill Rate
                                          <Info className="w-4 h-4 text-slate-400" aria-hidden="true" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs text-sm bg-[rgb(40,62,173)] text-white border-none">
                                        Fill Rate measures the ratio between impressions and bid requests.
                                        <br />
                                        It helps you understand how effectively your ad requests are being filled with winning ads.
                                        <br />
                                        A low Fill Rate may suggest issues with demand, floor price, or targeting.
                                      </TooltipContent>
                                    </UiTooltip>
                                  </TooltipProvider>
                                </TableHead>
                            <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>
                            <TableHead className="text-center">
                                  <TooltipProvider delayDuration={200}>
                                    <UiTooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center justify-center gap-1 cursor-help text-center">
                                          Win Rate
                                          <Info className="w-4 h-4 text-slate-400" aria-hidden="true" />
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs text-sm bg-[rgb(40,62,173)] text-white border-none">
                                        Win Rate measures the percentage of bid requests that received a valid bid response.
                                        <br />
                                        It reflects how attractive your inventory is to DSPs and buyers.
                                        <br />
                                        Low values may indicate poor match rates, pricing issues, or low DSP participation.
                                      </TooltipContent>
                                    </UiTooltip>
                                  </TooltipProvider>
                                </TableHead>
                            <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>
                          </>
                        )}
                        </>
                      )}
      </>
    );
  };

  // Render table row
  const renderTableRow = (item, index, analyticsData, viewMode, showDetailedColumns, entityId = null) => {
    const publisherCosts = item.PricePublisher || 0;
    const dspRevenue = item.PriceAdvertiser_PublisherSide || 0;
    const margin = dspRevenue - publisherCosts;
    const marginPercentage = dspRevenue > 0 ? (margin / dspRevenue) * 100 : 0;
    
    const formattedDate = item.formattedDate;
    const isExpanded = viewMode === 'daily' && expandedDates.has(item.dateKey || item.formattedDate);
    const isLoading = viewMode === 'daily' && loadingHourlyData.has(item.dateKey || item.formattedDate);
    const hourlyData = viewMode === 'daily' ? (hourlyDataCache[item.dateKey || item.formattedDate] || []) : [];

    // Calculate trends
    let dspRevenueTrend, publisherCostsTrend, marginTrend;
    let dspRevenueChangePercent, publisherCostsChangePercent, marginChangePercent;

    if (viewMode === 'hourly') {
      // Use pre-calculated trends from yesterday comparison
      dspRevenueTrend = item.dspRevenueTrend || 'same';
      dspRevenueChangePercent = item.dspRevenueChangePercent || 0;
      publisherCostsTrend = item.publisherCostsTrend || 'same';
      publisherCostsChangePercent = item.publisherCostsChangePercent || 0;
      marginTrend = item.marginTrend || 'same';
      marginChangePercent = item.marginChangePercent || 0;
    } else {
      // Compare with previous item
      const prevItem = index > 0 ? analyticsData[index - 1] : null;
      dspRevenueTrend = prevItem ? 
        (dspRevenue > prevItem.PriceAdvertiser_PublisherSide ? 'up' : 
         dspRevenue < prevItem.PriceAdvertiser_PublisherSide ? 'down' : 'same') : 'same';
      publisherCostsTrend = prevItem ? 
        (publisherCosts > prevItem.PricePublisher ? 'up' : 
         publisherCosts < prevItem.PricePublisher ? 'down' : 'same') : 'same';
      marginTrend = prevItem ? 
        (margin > (prevItem.PriceAdvertiser_PublisherSide - prevItem.PricePublisher) ? 'up' : 
         margin < (prevItem.PriceAdvertiser_PublisherSide - prevItem.PricePublisher) ? 'down' : 'same') : 'same';

      dspRevenueChangePercent = prevItem && prevItem.PriceAdvertiser_PublisherSide > 0 ? 
        Math.abs(((dspRevenue - prevItem.PriceAdvertiser_PublisherSide) / prevItem.PriceAdvertiser_PublisherSide) * 100).toFixed(1) : 0;
      publisherCostsChangePercent = prevItem && prevItem.PricePublisher > 0 ? 
        Math.abs(((publisherCosts - prevItem.PricePublisher) / prevItem.PricePublisher) * 100).toFixed(1) : 0;
      marginChangePercent = prevItem && (prevItem.PriceAdvertiser_PublisherSide - prevItem.PricePublisher) !== 0 ? 
        Math.abs(((margin - (prevItem.PriceAdvertiser_PublisherSide - prevItem.PricePublisher)) / Math.abs(prevItem.PriceAdvertiser_PublisherSide - prevItem.PricePublisher)) * 100).toFixed(1) : 0;
    }

    // Yesterday data for hourly view
    const yesterdayDspRevenue = item.yesterdayData ? item.yesterdayData.PriceAdvertiser_PublisherSide || 0 : 0;
    const yesterdayPublisherCosts = item.yesterdayData ? item.yesterdayData.PricePublisher || 0 : 0;
    const yesterdayMargin = yesterdayDspRevenue - yesterdayPublisherCosts;
    const yesterdayMarginPercentage = yesterdayDspRevenue > 0 ? (yesterdayMargin / yesterdayDspRevenue) * 100 : 0;

    return (
                        <React.Fragment key={index}>
                          <TableRow className={viewMode === 'daily' ? 'cursor-pointer hover:bg-slate-50' : ''}>
                            <TableCell 
                              className={`font-medium text-center ${viewMode === 'daily' ? 'cursor-pointer' : ''}`}
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
                                <span>{formattedDate}</span>
                              </div>
                            </TableCell>
                          {viewMode === 'hourly' ? (
                            <>
                          <TableCell className="text-center text-green-600">
              {formatCurrency(dspRevenue)}
                          </TableCell>
                          <TableCell className="text-center text-green-600 opacity-60">
              {formatCurrency(yesterdayDspRevenue)}
                          </TableCell>
                          <TableCell className="text-center border-r-2 border-gray-300">
                                  <div className="flex items-center justify-center gap-1">
                {dspRevenueTrend === 'up' && (
                                <>
                                  <ArrowUpRight className="w-4 h-4 text-green-500" />
                    <span className="text-green-500 text-xs font-medium">+{dspRevenueChangePercent}%</span>
                                </>
                              )}
                {dspRevenueTrend === 'down' && (
                                <>
                                  <ArrowDownRight className="w-4 h-4 text-red-500" />
                    <span className="text-red-500 text-xs font-medium">{dspRevenueChangePercent}%</span>
                                </>
                              )}
                {dspRevenueTrend === 'same' && (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                            </div>
                              </TableCell>
                          <TableCell className="text-center text-red-600">
              {formatCurrency(publisherCosts)}
                          </TableCell>
                          <TableCell className="text-center text-red-600 opacity-60">
              {formatCurrency(yesterdayPublisherCosts)}
                          </TableCell>
                          <TableCell className="text-center border-r-2 border-gray-300">
                                  <div className="flex items-center justify-center gap-1">
                {publisherCostsTrend === 'up' && (
                                <>
                                  <ArrowUpRight className="w-4 h-4 text-red-500" />
                    <span className="text-red-500 text-xs font-medium">+{publisherCostsChangePercent}%</span>
                                </>
                              )}
                {publisherCostsTrend === 'down' && (
                                <>
                                  <ArrowDownRight className="w-4 h-4 text-green-500" />
                    <span className="text-green-500 text-xs font-medium">{publisherCostsChangePercent}%</span>
                                </>
                              )}
                {publisherCostsTrend === 'same' && (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                                  </div>
                          </TableCell>
                          <TableCell className="text-center text-black">
              {formatCurrency(margin)}
                          </TableCell>
                          <TableCell className="text-center text-black opacity-60">
              {formatCurrency(yesterdayMargin)}
                          </TableCell>
                          <TableCell className="text-center border-r-2 border-gray-300">
                            <div className="flex items-center justify-center gap-1">
                {marginTrend === 'up' && (
                                <>
                                  <ArrowUpRight className="w-4 h-4 text-green-500" />
                    <span className="text-green-500 text-xs font-medium">+{marginChangePercent}%</span>
                                </>
                              )}
                {marginTrend === 'down' && (
                                <>
                                  <ArrowDownRight className="w-4 h-4 text-red-500" />
                    <span className="text-red-500 text-xs font-medium">{marginChangePercent}%</span>
                                </>
                              )}
                {marginTrend === 'same' && (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                            </div>
                              </TableCell>
                              <TableCell className="text-center">
              {marginPercentage > 0 ? (
                <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                  {marginPercentage.toFixed(1)}%
                </span>
              ) : (
                <Badge variant="destructive">
                  {marginPercentage.toFixed(1)}%
                            </Badge>
              )}
                          </TableCell>
                          <TableCell className="text-center">
              {yesterdayMarginPercentage > 0 ? (
                <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white opacity-60 inline-block">
                  {yesterdayMarginPercentage.toFixed(1)}%
                </span>
              ) : (
                <Badge variant="destructive" className="opacity-60">
                  {yesterdayMarginPercentage.toFixed(1)}%
                </Badge>
                            )}
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-center text-green-600">
              {formatCurrency(dspRevenue)}
                          </TableCell>
                          <TableCell className="text-center border-r-2 border-gray-300">
                            <div className="flex items-center justify-center gap-1">
                {dspRevenueTrend === 'up' && (
                                <>
                                  <ArrowUpRight className="w-4 h-4 text-green-500" />
                    <span className="text-green-500 text-xs font-medium">+{dspRevenueChangePercent}%</span>
                                </>
                              )}
                {dspRevenueTrend === 'down' && (
                                <>
                                  <ArrowDownRight className="w-4 h-4 text-red-500" />
                    <span className="text-red-500 text-xs font-medium">{dspRevenueChangePercent}%</span>
                                </>
                              )}
                {dspRevenueTrend === 'same' && (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                                  </div>
                          </TableCell>
                          <TableCell className="text-center text-red-600">
              {formatCurrency(publisherCosts)}
                          </TableCell>
                          <TableCell className="text-center border-r-2 border-gray-300">
                            <div className="flex items-center justify-center gap-1">
                {publisherCostsTrend === 'up' && (
                                <>
                                  <ArrowUpRight className="w-4 h-4 text-red-500" />
                    <span className="text-red-500 text-xs font-medium">+{publisherCostsChangePercent}%</span>
                                </>
                              )}
                {publisherCostsTrend === 'down' && (
                                <>
                                  <ArrowDownRight className="w-4 h-4 text-green-500" />
                    <span className="text-green-500 text-xs font-medium">{publisherCostsChangePercent}%</span>
                                </>
                              )}
                {publisherCostsTrend === 'same' && (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                            </div>
                              </TableCell>
                          <TableCell className="text-center text-black">
              {formatCurrency(margin)}
                          </TableCell>
                          <TableCell className="text-center border-r-2 border-gray-300">
                            <div className="flex items-center justify-center gap-1">
                {marginTrend === 'up' && (
                                <>
                                  <ArrowUpRight className="w-4 h-4 text-green-500" />
                    <span className="text-green-500 text-xs font-medium">+{marginChangePercent}%</span>
                                </>
                              )}
                {marginTrend === 'down' && (
                                <>
                                  <ArrowDownRight className="w-4 h-4 text-red-500" />
                    <span className="text-red-500 text-xs font-medium">{marginChangePercent}%</span>
                                </>
                              )}
                {marginTrend === 'same' && (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
              {marginPercentage > 0 ? (
                <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                  {marginPercentage.toFixed(1)}%
                </span>
              ) : (
                <Badge variant="destructive">
                  {marginPercentage.toFixed(1)}%
                            </Badge>
              )}
                          </TableCell>
                          {/* Network Operations columns - conditionally rendered */}
                          {showDetailedColumns && (
                            <>
                              <TableCell className="text-center border-l-2 border-gray-300">
                                {item.network_operations_bid_requests !== null && item.network_operations_bid_requests !== undefined ? (
                                  <span className="text-black">
                                    {formatLargeNumber(item.network_operations_bid_requests)}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">N/A</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center border-r-2 border-gray-300">
                                <div className="flex items-center justify-center gap-1">
                                  {item.bidRequestsTrend === 'up' && (
                                    <>
                                      <ArrowUpRight className="w-4 h-4 text-green-500" />
                                      <span className="text-green-500 text-xs font-medium">+{item.bidRequestsChangePercent}%</span>
                                    </>
                                  )}
                                  {item.bidRequestsTrend === 'down' && (
                                    <>
                                      <ArrowDownRight className="w-4 h-4 text-red-500" />
                                      <span className="text-red-500 text-xs font-medium">{item.bidRequestsChangePercent}%</span>
                                    </>
                                  )}
                                  {item.bidRequestsTrend === 'same' && (
                                    <span className="text-gray-400 text-xs">—</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                {item.network_operations_bid_responses !== null && item.network_operations_bid_responses !== undefined ? (
                                  <span className="text-black">
                                    {formatLargeNumber(item.network_operations_bid_responses)}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">N/A</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center border-r-2 border-gray-300">
                                <div className="flex items-center justify-center gap-1">
                                  {item.bidResponsesTrend === 'up' && (
                                    <>
                                      <ArrowUpRight className="w-4 h-4 text-green-500" />
                                      <span className="text-green-500 text-xs font-medium">+{item.bidResponsesChangePercent}%</span>
                                    </>
                                  )}
                                  {item.bidResponsesTrend === 'down' && (
                                    <>
                                      <ArrowDownRight className="w-4 h-4 text-red-500" />
                                      <span className="text-red-500 text-xs font-medium">{item.bidResponsesChangePercent}%</span>
                                    </>
                                  )}
                                  {item.bidResponsesTrend === 'same' && (
                                    <span className="text-gray-400 text-xs">—</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                {item.network_operations_impressions !== null && item.network_operations_impressions !== undefined ? (
                                  <span className="text-black">
                                    {formatLargeNumber(item.network_operations_impressions)}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">N/A</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center border-r-2 border-gray-300">
                                <div className="flex items-center justify-center gap-1">
                                  {item.impressionsTrend === 'up' && (
                                    <>
                                      <ArrowUpRight className="w-4 h-4 text-green-500" />
                                      <span className="text-green-500 text-xs font-medium">+{item.impressionsChangePercent}%</span>
                                    </>
                                  )}
                                  {item.impressionsTrend === 'down' && (
                                    <>
                                      <ArrowDownRight className="w-4 h-4 text-red-500" />
                                      <span className="text-red-500 text-xs font-medium">{item.impressionsChangePercent}%</span>
                                    </>
                                  )}
                                  {item.impressionsTrend === 'same' && (
                                    <span className="text-gray-400 text-xs">—</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center border-l-2 border-gray-300">
                                {item.network_operations_ecpm_publisher !== null && item.network_operations_ecpm_publisher !== undefined ? (
                                  <span className="text-black">
                                    {formatEcpm(item.network_operations_ecpm_publisher)}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">N/A</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center border-r-2 border-gray-300">
                                <div className="flex items-center justify-center gap-1">
                                  {item.ecpmTrend === 'up' && (
                                    <>
                                      <ArrowUpRight className="w-4 h-4 text-green-500" />
                                      <span className="text-green-500 text-xs font-medium">+{item.ecpmChangePercent}%</span>
                                    </>
                                  )}
                                  {item.ecpmTrend === 'down' && (
                                    <>
                                      <ArrowDownRight className="w-4 h-4 text-red-500" />
                                      <span className="text-red-500 text-xs font-medium">{item.ecpmChangePercent}%</span>
                                    </>
                                  )}
                                  {item.ecpmTrend === 'same' && (
                                    <span className="text-gray-400 text-xs">—</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center border-l-2 border-gray-300">
                                {item.rpbr !== null && item.rpbr !== undefined ? (
                                  <span className="text-black">
                                    {formatRpbr(item.rpbr)}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">N/A</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center border-r-2 border-gray-300">
                                <div className="flex items-center justify-center gap-1">
                                  {item.rpbrTrend === 'up' && (
                                    <>
                                      <ArrowUpRight className="w-4 h-4 text-green-500" />
                                      <span className="text-green-500 text-xs font-medium">+{item.rpbrChangePercent}%</span>
                                    </>
                                  )}
                                  {item.rpbrTrend === 'down' && (
                                    <>
                                      <ArrowDownRight className="w-4 h-4 text-red-500" />
                                      <span className="text-red-500 text-xs font-medium">{item.rpbrChangePercent}%</span>
                                    </>
                                  )}
                                  {item.rpbrTrend === 'same' && (
                                    <span className="text-gray-400 text-xs">—</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                {item.fillRate !== null && item.fillRate !== undefined ? (
                                  <span className="text-black">
                                    {item.fillRate.toFixed(2)}%
                                  </span>
                                ) : (
                                  <span className="text-gray-400">N/A</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center border-r-2 border-gray-300">
                                <div className="flex items-center justify-center gap-1">
                                  {item.fillRateTrend === 'up' && (
                                    <>
                                      <ArrowUpRight className="w-4 h-4 text-green-500" />
                                      <span className="text-green-500 text-xs font-medium">+{item.fillRateChangePercent}%</span>
                                    </>
                                  )}
                                  {item.fillRateTrend === 'down' && (
                                    <>
                                      <ArrowDownRight className="w-4 h-4 text-red-500" />
                                      <span className="text-red-500 text-xs font-medium">{item.fillRateChangePercent}%</span>
                                    </>
                                  )}
                                  {item.fillRateTrend === 'same' && (
                                    <span className="text-gray-400 text-xs">—</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                {item.winRate !== null && item.winRate !== undefined ? (
                                  <span className="text-black">
                                    {item.winRate.toFixed(2)}%
                                  </span>
                                ) : (
                                  <span className="text-gray-400">N/A</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center border-r-2 border-gray-300">
                                <div className="flex items-center justify-center gap-1">
                                  {item.winRateTrend === 'up' && (
                                    <>
                                      <ArrowUpRight className="w-4 h-4 text-green-500" />
                                      <span className="text-green-500 text-xs font-medium">+{item.winRateChangePercent}%</span>
                                    </>
                                  )}
                                  {item.winRateTrend === 'down' && (
                                    <>
                                      <ArrowDownRight className="w-4 h-4 text-red-500" />
                                      <span className="text-red-500 text-xs font-medium">{item.winRateChangePercent}%</span>
                                    </>
                                  )}
                                  {item.winRateTrend === 'same' && (
                                    <span className="text-gray-400 text-xs">—</span>
                                  )}
                                </div>
                              </TableCell>
                            </>
                          )}
                            </>
                          )}
                        </TableRow>
                        
                        {/* Hourly data rows (only in daily mode when expanded) */}
                        {viewMode === 'daily' && isExpanded && (
                          <>
                            {isLoading ? (
                              <TableRow>
                                <TableCell colSpan={showDetailedColumns ? 20 : 8} className="text-center py-4">
                                  <Loader2 className="w-4 h-4 animate-spin text-slate-600 mx-auto inline-block" />
                                  <span className="ml-2 text-sm text-slate-600">Loading hourly data...</span>
                                </TableCell>
                              </TableRow>
                            ) : hourlyData.length > 0 ? (
                              hourlyData.map((hourItem, hourIndex) => (
                                <TableRow key={`hour-${hourIndex}`} className="bg-slate-50/50">
                                  <TableCell className="font-medium text-center text-slate-600 pl-8">
                                    <span className="text-xs">{hourItem.formattedTime}</span>
                                  </TableCell>
                                  <TableCell className="text-center text-green-600">
                                    {formatCurrency(hourItem.PriceAdvertiser_PublisherSide)}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className="text-gray-400 text-xs">—</span>
                                  </TableCell>
                                  <TableCell className="text-center text-red-600">
                                    {formatCurrency(hourItem.PricePublisher)}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className="text-gray-400 text-xs">—</span>
                                  </TableCell>
                                  <TableCell className="text-center text-black">
                                    {formatCurrency(hourItem.margin)}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className="text-gray-400 text-xs">—</span>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {hourItem.marginPercentage > 0 ? (
                                      <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                                        {hourItem.marginPercentage}%
                                      </span>
                                    ) : (
                                      <Badge variant="destructive">
                                        {hourItem.marginPercentage}%
                                      </Badge>
                                    )}
                                  </TableCell>
                                  {showDetailedColumns && (
                                    <>
                                      <TableCell className="text-center border-l-2 border-gray-300">
                                        <span className="text-gray-400">N/A</span>
                                      </TableCell>
                                      <TableCell className="text-center border-r-2 border-gray-300">
                                        <span className="text-gray-400 text-xs">—</span>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <span className="text-gray-400">N/A</span>
                                      </TableCell>
                                      <TableCell className="text-center border-r-2 border-gray-300">
                                        <span className="text-gray-400 text-xs">—</span>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <span className="text-gray-400">N/A</span>
                                      </TableCell>
                                      <TableCell className="text-center border-r-2 border-gray-300">
                                        <span className="text-gray-400 text-xs">—</span>
                                      </TableCell>
                                      <TableCell className="text-center border-l-2 border-gray-300">
                                        <span className="text-gray-400">N/A</span>
                                      </TableCell>
                                      <TableCell className="text-center border-r-2 border-gray-300">
                                        <span className="text-gray-400 text-xs">—</span>
                                      </TableCell>
                                      <TableCell className="text-center border-l-2 border-gray-300">
                                        <span className="text-gray-400">N/A</span>
                                      </TableCell>
                                      <TableCell className="text-center border-r-2 border-gray-300">
                                        <span className="text-gray-400 text-xs">—</span>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <span className="text-gray-400">N/A</span>
                                      </TableCell>
                                      <TableCell className="text-center border-r-2 border-gray-300">
                                        <span className="text-gray-400 text-xs">—</span>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <span className="text-gray-400">N/A</span>
                                      </TableCell>
                                      <TableCell className="text-center border-r-2 border-gray-300">
                                        <span className="text-gray-400 text-xs">—</span>
                                      </TableCell>
                                    </>
                                  )}
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={showDetailedColumns ? 20 : 8} className="text-center py-4 text-sm text-slate-500">
                                  No hourly data available for this date
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        )}
                      </React.Fragment>
    );
  };

  return (
    <AnalyticsTemplate
      entityIdParam="id"
      entityNameParam="name"
      defaultEntityName="Placement Analytics"
      buildPayload={buildPayload}
      processAnalyticsData={processAnalyticsData}
      calculateSummaryStats={calculateSummaryStats}
      pageTitle="Placement Analytics"
      backButtonPath="/PlacementDashboard"
      backButtonLabel="Back to Placement Dashboard"
      renderTableHeaders={renderTableHeaders}
      renderTableRow={renderTableRow}
      formatCurrency={formatCurrency}
      getAuthToken={getToken}
      networkOperationsConfig={networkOperationsMetrics}
      useNetworkOpsOnlyDaily
    />
  );
}
