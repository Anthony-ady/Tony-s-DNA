/**
 * Placement Analytics Page Component
 * 
 * This page provides detailed analytics for a specific placement using the Druid API endpoint.
 * It uses the AnalyticsTemplate for common functionality and provides placement-specific logic.
 */

import React, { useMemo, useState } from "react";
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
      // Use UTC+0 timezone (no adjustment)
      const adjustedToday = new Date(today.getTime());
      const adjustedYesterday = new Date(yesterday.getTime());
        const todayData = dataByDay[adjustedToday.toISOString().slice(0, 10)] || [];
        const yesterdayData = dataByDay[adjustedYesterday.toISOString().slice(0, 10)] || [];
        
        const yesterdayMap = {};
        yesterdayData.forEach(item => {
          yesterdayMap[item.hour] = item;
        });
        
      todayData.forEach(todayItem => {
          const yesterdayItem = yesterdayMap[todayItem.hour];
          
          // Calculate trends compared to same hour yesterday
          const dspRevenueTrend = yesterdayItem ? 
            (todayItem.PriceAdvertiser_PublisherSide > yesterdayItem.PriceAdvertiser_PublisherSide ? 'up' : 
             todayItem.PriceAdvertiser_PublisherSide < yesterdayItem.PriceAdvertiser_PublisherSide ? 'down' : 'same') : 'same';
          
        const dspRevenueChangePercent = yesterdayItem && yesterdayItem.PriceAdvertiser_PublisherSide > 0 ? 
            (((todayItem.PriceAdvertiser_PublisherSide - yesterdayItem.PriceAdvertiser_PublisherSide) / yesterdayItem.PriceAdvertiser_PublisherSide) * 100).toFixed(1) : 0;
          
          const publisherCostsTrend = yesterdayItem ? 
            (todayItem.PricePublisher > yesterdayItem.PricePublisher ? 'up' : 
             todayItem.PricePublisher < yesterdayItem.PricePublisher ? 'down' : 'same') : 'same';
          
        const publisherCostsChangePercent = yesterdayItem && yesterdayItem.PricePublisher > 0 ? 
            (((todayItem.PricePublisher - yesterdayItem.PricePublisher) / yesterdayItem.PricePublisher) * 100).toFixed(1) : 0;
          
          const marginTrend = yesterdayItem ? 
            ((todayItem.PriceAdvertiser_PublisherSide - todayItem.PricePublisher) > (yesterdayItem.PriceAdvertiser_PublisherSide - yesterdayItem.PricePublisher) ? 'up' : 
             (todayItem.PriceAdvertiser_PublisherSide - todayItem.PricePublisher) < (yesterdayItem.PriceAdvertiser_PublisherSide - yesterdayItem.PricePublisher) ? 'down' : 'same') : 'same';
          
        const marginChangePercent = yesterdayItem && (yesterdayItem.PriceAdvertiser_PublisherSide - yesterdayItem.PricePublisher) !== 0 ? 
          ((((todayItem.PriceAdvertiser_PublisherSide - todayItem.PricePublisher) - (yesterdayItem.PriceAdvertiser_PublisherSide - yesterdayItem.PricePublisher)) / Math.abs(yesterdayItem.PriceAdvertiser_PublisherSide - yesterdayItem.PricePublisher)) * 100).toFixed(1) : 0;
          
          processedData.push({
            ...todayItem,
          formattedDate: `${todayItem.cleanDate.toLocaleDateString('fr-FR', { timeZone: 'UTC' })} ${todayItem.cleanDate.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
            minute: '2-digit',
            hour12: true,
            timeZone: 'UTC'
            })}`,
          hourOnly: todayItem.cleanDate.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true,
            timeZone: 'UTC'
          }),
          yesterdayData: yesterdayItem ? {
            PriceAdvertiser_PublisherSide: yesterdayItem.PriceAdvertiser_PublisherSide,
            PricePublisher: yesterdayItem.PricePublisher,
            margin: yesterdayItem.PriceAdvertiser_PublisherSide - yesterdayItem.PricePublisher,
            marginPercentage: yesterdayItem.PriceAdvertiser_PublisherSide > 0 ? ((yesterdayItem.PriceAdvertiser_PublisherSide - yesterdayItem.PricePublisher) / yesterdayItem.PriceAdvertiser_PublisherSide * 100).toFixed(2) : 0
          } : {
            PriceAdvertiser_PublisherSide: 0,
            PricePublisher: 0
          },
          yesterdayDspRevenue: yesterdayItem ? yesterdayItem.PriceAdvertiser_PublisherSide : 0,
            dspRevenueTrend,
            dspRevenueChangePercent,
            publisherCostsTrend,
            publisherCostsChangePercent,
            marginTrend,
          marginChangePercent
          });
        });
      
      return processedData;
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

    const totalDspRevenue = data.reduce((sum, item) => sum + (item.PriceAdvertiser_PublisherSide || 0), 0);
    const totalPublisherRevenue = data.reduce((sum, item) => sum + (item.PricePublisher || 0), 0);
      const totalMargin = totalDspRevenue - totalPublisherRevenue;
    const avgMarginPercentage = totalDspRevenue > 0 ? (totalMargin / totalDspRevenue * 100).toFixed(2) : 0;

      let yesterdayStats = {};
      if (viewMode === 'hourly') {
      // Calculate yesterday totals from yesterdayData in each item
      const yesterdayTotalDspRevenue = data.reduce((sum, item) => {
        if (item.yesterdayData && item.yesterdayData.PriceAdvertiser_PublisherSide) {
          return sum + item.yesterdayData.PriceAdvertiser_PublisherSide;
          }
          return sum;
        }, 0);

      const yesterdayTotalPublisherRevenue = data.reduce((sum, item) => {
        if (item.yesterdayData && item.yesterdayData.PricePublisher) {
          return sum + item.yesterdayData.PricePublisher;
          }
          return sum;
        }, 0);

        const yesterdayTotalMargin = yesterdayTotalDspRevenue - yesterdayTotalPublisherRevenue;
        const yesterdayAvgMarginPercentage = yesterdayTotalDspRevenue > 0 ? 
          (yesterdayTotalMargin / yesterdayTotalDspRevenue * 100).toFixed(2) : 0;

        yesterdayStats = {
          yesterdayTotalDspRevenue,
          yesterdayTotalPublisherRevenue,
          yesterdayTotalMargin,
          yesterdayAvgMarginPercentage
        };
      }

    return {
        totalDspRevenue,
        totalPublisherRevenue,
        totalMargin,
        avgMarginPercentage,
      totalDSP: totalDspRevenue,
      totalPublisher: totalPublisherRevenue,
      marginPercentage: Number(avgMarginPercentage),
      dataPoints: data.length,
        ...yesterdayStats
    };
  };

  // Fetch hourly data for a specific date
  const fetchHourlyDataForDate = async (dateString, placementId) => {
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
      Metrics: ["PricePublisher", "PriceAdvertiser_PublisherSide"],
      View: "SIMPLE_PUBLISHER",
      Datasource: "adserver_stats",
      AddTotalRow: false,
      TimeZone: "Etc/GMT",
      Granularity: {
        type: "period",
        period: "PT1H"
      },
      Filters: {
        Placement: {
          Value: [placementId],
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
        marginPercentage: item.PriceAdvertiser_PublisherSide > 0 ? ((item.PriceAdvertiser_PublisherSide - item.PricePublisher) / item.PriceAdvertiser_PublisherSide * 100).toFixed(2) : 0
      };
    });
  };

  // Toggle date expansion and fetch hourly data
  const toggleDateExpansion = async (dateString, dateKey, placementId) => {
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
          const hourlyData = await fetchHourlyDataForDate(dateToFetch, placementId);
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

  // Render summary cards
  const renderSummaryCards = (summaryStats, viewMode, formatCurrencyFn) => {
    if (viewMode === 'hourly') {
  return (
              <>
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">DSP Revenue</p>
                  <p className="text-lg lg:text-xl font-bold text-green-600">{formatCurrencyFn(summaryStats.totalDspRevenue)}</p>
                  <div className="text-sm text-slate-500 mt-1">
                    Yesterday: {formatCurrencyFn(summaryStats.yesterdayTotalDspRevenue || 0)}
                </div>
                </div>
                <div className="w-8 h-8 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Publisher Costs</p>
                  <p className="text-lg lg:text-xl font-bold text-red-600">{formatCurrencyFn(summaryStats.totalPublisherRevenue)}</p>
                  <div className="text-sm text-slate-500 mt-1">
                    Yesterday: {formatCurrencyFn(summaryStats.yesterdayTotalPublisherRevenue || 0)}
                </div>
                </div>
                <div className="w-8 h-8 bg-gradient-to-br from-red-100 to-red-200 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Margin</p>
                  <p className="text-lg lg:text-xl font-bold" style={{ color: 'rgb(79, 70, 229)' }}>{formatCurrencyFn(summaryStats.totalMargin)}</p>
                  <div className="text-sm text-slate-500 mt-1">
                    Yesterday: {formatCurrencyFn(summaryStats.yesterdayTotalMargin || 0)}
                </div>
                </div>
                <div className="w-8 h-8 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Margin %</p>
                  <p className="text-lg lg:text-xl font-bold text-orange-600">{summaryStats.avgMarginPercentage}%</p>
                  <div className="text-sm text-slate-500 mt-1">
                    Yesterday: {(summaryStats.yesterdayAvgMarginPercentage || 0)}%
                </div>
                </div>
                <div className="w-8 h-8 bg-gradient-to-br from-orange-100 to-orange-200 rounded-lg flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
              </>
      );
    } else {
      return (
              <>
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">DSP Revenue</p>
                  <p className="text-lg lg:text-xl font-bold text-green-600">{formatCurrencyFn(summaryStats.totalDspRevenue)}</p>
        </div>
                      <div className="w-8 h-8 bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Publisher Costs</p>
                  <p className="text-lg lg:text-xl font-bold text-red-600">{formatCurrencyFn(summaryStats.totalPublisherRevenue)}</p>
                      </div>
                      <div className="w-8 h-8 bg-gradient-to-br from-red-100 to-red-200 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-red-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Margin</p>
                  <p className="text-lg lg:text-xl font-bold" style={{ color: 'rgb(79, 70, 229)' }}>{formatCurrencyFn(summaryStats.totalMargin)}</p>
                      </div>
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center">
                        <BarChart3 className="w-4 h-4 text-purple-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Margin %</p>
                        <p className="text-lg lg:text-xl font-bold text-orange-600">{summaryStats.avgMarginPercentage}%</p>
                      </div>
                      <div className="w-8 h-8 bg-gradient-to-br from-orange-100 to-orange-200 rounded-lg flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-orange-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
      );
    }
  };

  // Prepare chart data for hourly view
  const prepareHourlyChartData = (data) => {
    return data.map((item) => {
      const hourOnly = item.hourOnly || 'N/A';
      const yesterdayDspRevenue = item.yesterdayData ? item.yesterdayData.PriceAdvertiser_PublisherSide || 0 : 0;
      
      return {
        ...item,
        hourOnly,
        yesterdayDspRevenue
      };
    });
  };

  // Render chart component with daily and hourly views
  const renderChart = (analyticsData, viewMode, networkOperationsData) => {
    // Hourly view chart
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
                tickFormatter={(value) => formatCurrencyChart(value)}
                    />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid rgba(148, 163, 184, 0.3)',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                      padding: '10px',
                      fontSize: '12px',
                      color: '#333333',
                    }}
                    formatter={(value, name) => [
                  formatCurrencyChart(value), 
                        name === 'PriceAdvertiser_PublisherSide' ? 'DSP Revenue' : 
                        name === 'yesterdayDspRevenue' ? 'Yesterday DSP Revenue' : name
                    ]}
                      labelFormatter={(label) => `Time: ${label}`}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="PriceAdvertiser_PublisherSide" 
                    stroke="#10b981" 
                    strokeWidth={2}
                      name="DSP Revenue"
                      dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                      dataKey="yesterdayDspRevenue" 
                      stroke="#6b7280" 
                    strokeWidth={2}
                      strokeDasharray="5 5"
                      name="Yesterday DSP Revenue"
                      dot={{ fill: '#6b7280', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              </div>
    );
    }

    // Daily view charts
    if (viewMode === 'daily' && analyticsData.length > 0) {
      return (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Combined Revenue & Costs Chart */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3 pt-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <BarChart3 className="w-4 h-4" />
                  Revenue & Costs
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-40 lg:h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analyticsData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="formattedDate" 
                        tick={{ fontSize: 10, fill: '#6b7280' }}
                        angle={-45}
                        textAnchor="end"
                        height={50}
                      />
                      <YAxis 
                        tick={{ fontSize: 10, fill: '#6b7280' }}
                        tickFormatter={(value) => formatCurrencyChart(value)}
                        width={60}
                      />
                      <RechartsTooltip 
                        formatter={(value, name, props) => [
                          formatCurrencyChart(value),
                          props.dataKey === 'PriceAdvertiser_PublisherSide' ? 'DSP Revenue' : 'Publisher Costs'
                        ]}
                        labelFormatter={(label) => `Date: ${label}`}
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px' }}
                      />
                      <Legend 
                        wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                        iconType="line"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="PriceAdvertiser_PublisherSide" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        dot={{ fill: '#10b981', strokeWidth: 2, r: 2 }}
                        activeDot={{ r: 4 }}
                        name="DSP Revenue"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="PricePublisher" 
                        stroke="#ef4444" 
                        strokeWidth={2}
                        dot={{ fill: '#ef4444', strokeWidth: 2, r: 2 }}
                        activeDot={{ r: 4 }}
                        name="Publisher Costs"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Performance Metrics Section */}
            {networkOperationsData && networkOperationsData.length > 0 && (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3 pt-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'rgb(30, 47, 130)' }}>
                    <Info className="w-4 h-4" />
                    Performance Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* Impressions */}
                    <div className="p-4 rounded-lg border" style={{ backgroundColor: 'rgb(239, 246, 255)', borderColor: 'rgb(191, 219, 254)' }}>
                      <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(30, 64, 175)' }}>Impressions</div>
                      <div className="text-lg font-bold" style={{ color: 'rgb(29, 78, 216)' }}>
                        {formatLargeNumber(
                          analyticsData.reduce((sum, item) => sum + (item.network_operations_impressions || 0), 0)
                        )}
                      </div>
                    </div>

                    {/* eCPM Publisher */}
                    <div className="p-4 rounded-lg border" style={{ backgroundColor: 'rgb(240, 253, 244)', borderColor: 'rgb(187, 247, 208)' }}>
                      <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(20, 83, 45)' }}>eCPM Publisher</div>
                      <div className="text-lg font-bold" style={{ color: 'rgb(22, 101, 52)' }}>
                        {(() => {
                          const totalImpressions = analyticsData.reduce((sum, item) => sum + (item.network_operations_impressions || 0), 0);
                          const totalPublisherRevenue = analyticsData.reduce((sum, item) => sum + (item.PricePublisher || 0), 0);
                          if (totalImpressions > 0) {
                            return formatEcpm((totalPublisherRevenue / 1000000) / (totalImpressions / 1000));
                          }
                          return '$0.00';
                        })()}
                      </div>
                    </div>

                    {/* RPBR/M */}
                    <div className="p-4 rounded-lg border" style={{ backgroundColor: 'rgb(250, 245, 255)', borderColor: 'rgb(221, 214, 254)' }}>
                      <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(88, 28, 135)' }}>RPBR/M</div>
                      <div className="text-lg font-bold" style={{ color: 'rgb(109, 40, 217)' }}>
                        {(() => {
                          const totalBidRequests = analyticsData.reduce((sum, item) => sum + (item.network_operations_bid_requests || 0), 0);
                          const totalPublisherRevenue = analyticsData.reduce((sum, item) => sum + (item.network_operations_price_publisher || 0), 0);
                          if (totalBidRequests > 0) {
                            return formatRpbr((totalPublisherRevenue / totalBidRequests) * 1000000);
                          }
                          return '$0.00';
                        })()}
                      </div>
                    </div>

                    {/* Win Rate */}
                    <div className="p-4 rounded-lg border" style={{ backgroundColor: 'rgb(255, 251, 235)', borderColor: 'rgb(254, 240, 138)' }}>
                      <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(113, 63, 18)' }}>Win Rate</div>
                      <div className="text-lg font-bold" style={{ color: 'rgb(146, 64, 14)' }}>
                        {(() => {
                          const totalBidResponses = analyticsData.reduce((sum, item) => sum + (item.network_operations_bid_responses || 0), 0);
                          const totalImpressions = analyticsData.reduce((sum, item) => sum + (item.network_operations_impressions || 0), 0);
                          if (totalBidResponses > 0) {
                            return `${((totalImpressions / totalBidResponses) * 100).toFixed(2)}%`;
                          }
                          return '0.00%';
                        })()}
                      </div>
                    </div>

                    {/* Fill Rate */}
                    <div className="p-4 rounded-lg border" style={{ backgroundColor: 'rgb(255, 241, 242)', borderColor: 'rgb(254, 202, 202)' }}>
                      <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(153, 27, 27)' }}>Fill Rate</div>
                      <div className="text-lg font-bold" style={{ color: 'rgb(185, 28, 28)' }}>
                        {(() => {
                          const totalBidRequests = analyticsData.reduce((sum, item) => sum + (item.network_operations_bid_requests || 0), 0);
                          const totalImpressions = analyticsData.reduce((sum, item) => sum + (item.network_operations_impressions || 0), 0);
                          if (totalBidRequests > 0) {
                            return `${((totalImpressions / totalBidRequests) * 100).toFixed(2)}%`;
                          }
                          return '0.00%';
                        })()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      );
    }

    return null;
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
