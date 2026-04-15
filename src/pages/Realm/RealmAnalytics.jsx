/**
 * Realm Analytics Page Component
 * 
 * This page provides detailed analytics for a specific realm using the Druid API endpoint.
 * It uses the AnalyticsTemplate for common functionality and provides realm-specific logic.
 */

import React, { useMemo, useCallback, useState } from "react";
import AnalyticsTemplate from "@/pages/Dashboard/AnalyticsTemplate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, TrendingDown, BarChart3, Calendar, ChevronDown, ChevronUp, Loader2, ArrowUpRight, ArrowDownRight, Info, Percent, Gauge, PieChart, Activity } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { API_ENDPOINTS } from "@/config/api";
import { formatCurrency as formatCurrencyValue, formatCurrencyChart, formatEcpm, formatRpbr, formatLargeNumber, formatPercentage } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { TAILWIND_CLASSES } from "@/config/theme";

export default function RealmAnalytics() {
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
      if (entityId) {
        filters.realmId = {
          Value: [entityId],
          Operator: "in"
        };
      }
      return filters;
    }
  }), []);
  
  // Build API payload based on entity ID, dates, and view mode
  const buildPayload = (realmId, beginDateISO, endDateISO, viewMode) => {
    const granularity = viewMode === 'hourly' ? { type: "period", period: "PT1H" } : { type: "period", period: "P1D" };

    return {
      Filters: {
        RealmPublisher: {
          Value: [realmId],
          Operator: "in"
        }
      },
      Semantic: null,
      Inventories: null,
      Intervals: [
        {
          Begin: beginDateISO,
          End: endDateISO
        }
      ],
      Metrics: ["PricePublisher", "PriceAdvertiser_PublisherSide"],
      Granularity: granularity,
      Datasource: "adserver_stats",
      TimeZone: "Etc/GMT"
    };
  };

  // Process raw API response data - enhanced with network operations metrics for daily view
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

      // Merge network operations data when available (daily view)
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
            if (item.network_operations_bid_responses !== null) {
              winRate = (item.network_operations_bid_responses / item.network_operations_bid_requests) * 100;
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

  // Calculate summary statistics - same as SiteAnalytics
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
      dataPoints: data.length,
        ...yesterdayStats
    };
  };

  // Fetch hourly data for a specific date
  const fetchHourlyDataForDate = async (dateString, realmId) => {
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
      Filters: {
        RealmPublisher: {
          Value: [realmId],
          Operator: "in"
        }
      },
      Semantic: null,
      Inventories: null,
      Intervals: [{
        Begin: startDateValue.toISOString(),
        End: endDateValue.toISOString()
      }],
      Metrics: ["PricePublisher", "PriceAdvertiser_PublisherSide"],
      Granularity: {
        type: "period",
        period: "PT1H"
      },
      View: "SIMPLE_PUBLISHER",
      Datasource: "adserver_stats",
      TimeZone: "Etc/GMT"
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
  const toggleDateExpansion = async (dateString, dateKey, realmId) => {
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
          const hourlyData = await fetchHourlyDataForDate(dateToFetch, realmId);
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

  // Render summary cards - same as SiteAnalytics
  const renderSummaryCards = (summaryStats, viewMode, formatCurrencyFn) => {
    if (viewMode !== 'hourly') {
      return null;
    }
    if (viewMode === 'hourly') {
  return (
              <>
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={TAILWIND_CLASSES.formSectionLabel}>DSP Revenue</p>
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
                        <p className={TAILWIND_CLASSES.formSectionLabel}>Publisher Costs</p>
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
                        <p className={TAILWIND_CLASSES.formSectionLabel}>Margin</p>
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
                        <p className={TAILWIND_CLASSES.formSectionLabel}>Avg Margin %</p>
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
                        <p className={TAILWIND_CLASSES.formSectionLabel}>DSP Revenue</p>
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
                        <p className={TAILWIND_CLASSES.formSectionLabel}>Publisher Costs</p>
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
                        <p className={TAILWIND_CLASSES.formSectionLabel}>Margin</p>
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
                        <p className={TAILWIND_CLASSES.formSectionLabel}>Avg Margin %</p>
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
                        backgroundColor: '#f9fafb',
                        color: '#374151',
                        fontSize: '14px',
                        padding: '10px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
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
      const totalAdvertiserSpend = analyticsData.reduce((sum, item) => sum + (item.PriceAdvertiser_PublisherSide || 0), 0);
      const totalPublisherRevenue = analyticsData.reduce((sum, item) => sum + (item.PricePublisher || 0), 0);
      const totalMargin = totalAdvertiserSpend - totalPublisherRevenue;
      const avgMarginPercentage = totalAdvertiserSpend > 0 ? ((totalMargin / totalAdvertiserSpend) * 100).toFixed(2) : '0.00';

      const ecpmChartData = analyticsData.map((item) => {
        const impressions = item.network_operations_impressions || 0;
        const bidRequests = item.network_operations_bid_requests || 0;
        const bidResponses = item.network_operations_bid_responses || 0;
        const dspRevenue = item.PriceAdvertiser_PublisherSide || 0;
        const pubRevenue = item.PricePublisher || 0;

        const ecpmAdvertiser = impressions > 0 ? (dspRevenue / 1000000) / (impressions / 1000) : 0;
        const ecpmPublisher = impressions > 0 ? (pubRevenue / 1000000) / (impressions / 1000) : 0;
        const winRate = bidResponses > 0 ? (impressions / bidResponses) * 100 : 0;
        const fillRate = bidRequests > 0 ? (impressions / bidRequests) * 100 : 0;

        return {
          ...item,
          ecpmAdvertiser,
          ecpmPublisher,
          winRate,
          fillRate
        };
      });

      return (
        <>
          {networkOperationsData && networkOperationsData.length > 0 && (
            <div className="mb-4">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3 pt-3" />
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <div className={cn(TAILWIND_CLASSES.formSectionLabel, 'mb-3')}>Revenue Snapshot</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg border" style={{ backgroundColor: 'rgb(240, 253, 244)', borderColor: 'rgb(187, 247, 208)' }}>
                          <div className="flex items-start justify-between mb-1">
                            <div className={cn(TAILWIND_CLASSES.formSectionLabel)} style={{ color: 'rgb(20, 83, 45)' }}>DSP Revenue</div>
                            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'rgb(220, 252, 231)', color: 'rgb(20, 83, 45)' }}>
                              <DollarSign className="w-3.5 h-3.5" />
                            </div>
                          </div>
                          <div className="text-base font-bold" style={{ color: 'rgb(22, 101, 52)' }}>
                            {formatCurrencyChart(totalAdvertiserSpend)}
                          </div>
                        </div>

                        <div className="p-3 rounded-lg border" style={{ backgroundColor: 'rgb(255, 241, 242)', borderColor: 'rgb(254, 202, 202)' }}>
                          <div className="flex items-start justify-between mb-1">
                            <div className={cn(TAILWIND_CLASSES.formSectionLabel)} style={{ color: 'rgb(153, 27, 27)' }}>Publisher Costs</div>
                            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'rgb(254, 226, 226)', color: 'rgb(153, 27, 27)' }}>
                              <TrendingDown className="w-3.5 h-3.5" />
                            </div>
                          </div>
                          <div className="text-base font-bold" style={{ color: 'rgb(185, 28, 28)' }}>
                            {formatCurrencyChart(totalPublisherRevenue)}
                          </div>
                        </div>

                        <div className="p-3 rounded-lg border" style={{ backgroundColor: 'rgb(239, 246, 255)', borderColor: 'rgb(191, 219, 254)' }}>
                          <div className="flex items-start justify-between mb-1">
                            <div className={cn(TAILWIND_CLASSES.formSectionLabel)} style={{ color: 'rgb(30, 64, 175)' }}>ADY Margin</div>
                            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'rgb(219, 234, 254)', color: 'rgb(30, 64, 175)' }}>
                              <PieChart className="w-3.5 h-3.5" />
                            </div>
                          </div>
                          <div className="text-base font-bold" style={{ color: 'rgb(29, 78, 216)' }}>
                            {formatCurrencyChart(totalMargin)}
                          </div>
                        </div>

                        <div className="p-3 rounded-lg border" style={{ backgroundColor: 'rgb(250, 245, 255)', borderColor: 'rgb(221, 214, 254)' }}>
                          <div className="flex items-start justify-between mb-1">
                            <div className={cn(TAILWIND_CLASSES.formSectionLabel)} style={{ color: 'rgb(88, 28, 135)' }}>Avg Margin</div>
                            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'rgb(243, 232, 255)', color: 'rgb(88, 28, 135)' }}>
                              <Percent className="w-3.5 h-3.5" />
                            </div>
                          </div>
                          <div className="text-base font-bold" style={{ color: 'rgb(109, 40, 217)' }}>
                            {formatPercentage(Number(avgMarginPercentage))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className={cn(TAILWIND_CLASSES.formSectionLabel, 'mb-3')}>Performance Metrics</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg border" style={{ backgroundColor: 'rgb(255, 251, 235)', borderColor: 'rgb(254, 240, 138)' }}>
                          <div className="flex items-start justify-between mb-1">
                            <div className={cn(TAILWIND_CLASSES.formSectionLabel)} style={{ color: 'rgb(113, 63, 18)' }}>Impressions</div>
                            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'rgb(254, 240, 138)', color: 'rgb(113, 63, 18)' }}>
                              <BarChart3 className="w-3.5 h-3.5" />
                            </div>
                          </div>
                          <div className="text-base font-bold" style={{ color: 'rgb(146, 64, 14)' }}>
                            {formatLargeNumber(
                              analyticsData.reduce((sum, item) => sum + (item.network_operations_impressions || 0), 0)
                            )}
                          </div>
                        </div>

                        <div className="p-3 rounded-lg border" style={{ backgroundColor: 'rgb(255, 247, 237)', borderColor: 'rgb(253, 186, 116)' }}>
                          <div className="flex items-start justify-between mb-1">
                            <div className={cn(TAILWIND_CLASSES.formSectionLabel)} style={{ color: 'rgb(154, 52, 18)' }}>RPBR/M</div>
                            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'rgb(255, 237, 213)', color: 'rgb(154, 52, 18)' }}>
                              <Gauge className="w-3.5 h-3.5" />
                            </div>
                          </div>
                          <div className="text-base font-bold" style={{ color: 'rgb(234, 88, 12)' }}>
                            {(() => {
                              const totalBidRequests = analyticsData.reduce((sum, item) => sum + (item.network_operations_bid_requests || 0), 0);
                              const totalDSPRevenue = analyticsData.reduce((sum, item) => sum + (item.PriceAdvertiser_PublisherSide || 0), 0);
                              if (totalBidRequests > 0) {
                                return formatRpbr(((totalDSPRevenue / 1000000) / totalBidRequests) * 1000000);
                              }
                              return '$0.00';
                            })()}
                          </div>
                        </div>

                        <div className="p-3 rounded-lg border" style={{ backgroundColor: 'rgb(240, 249, 255)', borderColor: 'rgb(186, 230, 253)' }}>
                          <div className="flex items-start justify-between mb-1">
                            <div className={cn(TAILWIND_CLASSES.formSectionLabel)} style={{ color: 'rgb(7, 89, 133)' }}>eCPM Advertiser</div>
                            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'rgb(224, 242, 254)', color: 'rgb(7, 89, 133)' }}>
                              <Activity className="w-3.5 h-3.5" />
                            </div>
                          </div>
                          <div className="text-base font-bold" style={{ color: 'rgb(14, 116, 144)' }}>
                            {(() => {
                              const totalImpressions = analyticsData.reduce((sum, item) => sum + (item.network_operations_impressions || 0), 0);
                              const totalAdvertiserRevenue = analyticsData.reduce((sum, item) => sum + (item.PriceAdvertiser_PublisherSide || 0), 0);
                              if (totalImpressions > 0) {
                                return formatEcpm((totalAdvertiserRevenue / 1000000) / (totalImpressions / 1000));
                              }
                              return '$0.00';
                            })()}
                          </div>
                        </div>

                        <div className="p-3 rounded-lg border" style={{ backgroundColor: 'rgb(240, 253, 250)', borderColor: 'rgb(153, 246, 228)' }}>
                          <div className="flex items-start justify-between mb-1">
                            <div className={cn(TAILWIND_CLASSES.formSectionLabel)} style={{ color: 'rgb(15, 118, 110)' }}>eCPM Publisher</div>
                            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'rgb(204, 251, 241)', color: 'rgb(15, 118, 110)' }}>
                              <Activity className="w-3.5 h-3.5" />
                            </div>
                          </div>
                          <div className="text-base font-bold" style={{ color: 'rgb(13, 148, 136)' }}>
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

                        <div className="p-3 rounded-lg border" style={{ backgroundColor: 'rgb(238, 242, 255)', borderColor: 'rgb(199, 210, 254)' }}>
                          <div className="flex items-start justify-between mb-1">
                            <div className={cn(TAILWIND_CLASSES.formSectionLabel)} style={{ color: 'rgb(49, 46, 129)' }}>Win Rate</div>
                            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'rgb(224, 231, 255)', color: 'rgb(49, 46, 129)' }}>
                              <Percent className="w-3.5 h-3.5" />
                            </div>
                          </div>
                          <div className="text-base font-bold" style={{ color: 'rgb(67, 56, 202)' }}>
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

                        <div className="p-3 rounded-lg border" style={{ backgroundColor: 'rgb(241, 245, 249)', borderColor: 'rgb(203, 213, 225)' }}>
                          <div className="flex items-start justify-between mb-1">
                            <div className={cn(TAILWIND_CLASSES.formSectionLabel)} style={{ color: 'rgb(51, 65, 85)' }}>Fill Rate</div>
                            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'rgb(226, 232, 240)', color: 'rgb(51, 65, 85)' }}>
                              <Percent className="w-3.5 h-3.5" />
                            </div>
                          </div>
                          <div className="text-base font-bold" style={{ color: 'rgb(30, 41, 59)' }}>
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
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

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
                <div className="h-40 lg:h-48 min-h-[150px] min-w-[250px]">
                  <ResponsiveContainer width="100%" height="100%" minHeight={150} minWidth={250}>
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
                        domain={[0, 'auto']}
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
                        dot={false}
                        activeDot={false}
                        name="DSP Revenue"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="PricePublisher" 
                        stroke="#ef4444" 
                        strokeWidth={2}
                        dot={false}
                        activeDot={false}
                        name="Publisher Costs"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Impressions & RPBR/M Chart */}
            {networkOperationsData && networkOperationsData.length > 0 && (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3 pt-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <BarChart3 className="w-4 h-4" />
                    Impressions & RPBR/M
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-40 lg:h-48 min-h-[150px] min-w-[250px]">
                    <ResponsiveContainer width="100%" height="100%" minHeight={150} minWidth={250}>
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
                          yAxisId="left"
                          tick={{ fontSize: 10, fill: '#6b7280' }}
                          tickFormatter={(value) => formatLargeNumber(value)}
                          width={60}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={{ fontSize: 10, fill: '#6b7280' }}
                          tickFormatter={(value) => formatRpbr(value)}
                          width={60}
                        />
                        <RechartsTooltip 
                          formatter={(value, name, props) => {
                            if (props.dataKey === 'network_operations_impressions') {
                              return [formatLargeNumber(value), 'Impressions'];
                            }
                            if (props.dataKey === 'rpbr') {
                              return [formatRpbr(value), 'RPBR/M'];
                            }
                            return [value, name];
                          }}
                          labelFormatter={(label) => `Date: ${label}`}
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px' }}
                        />
                        <Legend 
                          wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                          iconType="line"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="network_operations_impressions" 
                          yAxisId="left"
                          stroke="rgb(146, 64, 14)" 
                          strokeWidth={2}
                          dot={false}
                          activeDot={false}
                          name="Impressions"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="rpbr" 
                          yAxisId="right"
                          stroke="rgb(234, 88, 12)" 
                          strokeWidth={2}
                          dot={false}
                          activeDot={false}
                          name="RPBR/M"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {networkOperationsData && networkOperationsData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* eCPM Advertiser & Publisher */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3 pt-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <BarChart3 className="w-4 h-4" />
                    eCPM Advertiser & Publisher
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-40 lg:h-48 min-h-[150px] min-w-[250px]">
                    <ResponsiveContainer width="100%" height="100%" minHeight={150} minWidth={250}>
                      <LineChart data={ecpmChartData}>
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
                          tickFormatter={(value) => formatEcpm(value)}
                          width={60}
                        />
                        <RechartsTooltip 
                          formatter={(value, name, props) => [
                            formatEcpm(value),
                            props.dataKey === 'ecpmAdvertiser' ? 'eCPM Advertiser' : 'eCPM Publisher'
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
                          dataKey="ecpmAdvertiser" 
                          stroke="rgb(14, 116, 144)" 
                          strokeWidth={2}
                          dot={false}
                          activeDot={false}
                          name="eCPM Advertiser"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="ecpmPublisher" 
                          stroke="rgb(13, 148, 136)" 
                          strokeWidth={2}
                          dot={false}
                          activeDot={false}
                          name="eCPM Publisher"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Win Rate & Fill Rate */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3 pt-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <BarChart3 className="w-4 h-4" />
                    Win Rate & Fill Rate
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-40 lg:h-48 min-h-[150px] min-w-[250px]">
                    <ResponsiveContainer width="100%" height="100%" minHeight={150} minWidth={250}>
                      <LineChart data={ecpmChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis 
                          dataKey="formattedDate" 
                          tick={{ fontSize: 10, fill: '#6b7280' }}
                          angle={-45}
                          textAnchor="end"
                          height={50}
                        />
                        <YAxis
                          scale="log"
                          domain={[0.01, 100]}
                          allowDataOverflow
                          tick={{ fontSize: 10, fill: '#6b7280' }}
                          tickFormatter={(value) => `${Number(value).toFixed(2)}%`}
                          width={60}
                        />
                        <RechartsTooltip 
                          formatter={(value, name, props) => [
                            `${Number(value).toFixed(2)}%`,
                            props.dataKey === 'winRate' ? 'Win Rate' : 'Fill Rate'
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
                          dataKey="winRate" 
                          stroke="rgb(67, 56, 202)" 
                          strokeWidth={2}
                          dot={false}
                          activeDot={false}
                          name="Win Rate"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="fillRate" 
                          stroke="rgb(30, 41, 59)" 
                          strokeWidth={2}
                          dot={false}
                          activeDot={false}
                          name="Fill Rate"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      );
    }

    return null;
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
            const yesterday = item.yesterdayData ? item.yesterdayData.PriceAdvertiser_PublisherSide || 0 : 0;
            return (
                          <TableCell className="text-center text-green-600 opacity-60">
                {formatCurrency(yesterday)}
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
            const yesterday = item.yesterdayData ? item.yesterdayData.PricePublisher || 0 : 0;
            return (
                          <TableCell className="text-center text-red-600 opacity-60">
                {formatCurrency(yesterday)}
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
            const marginPercentage = dspRevenue > 0 ? (margin / dspRevenue) * 100 : 0;
            return (
                          <TableCell className="text-center">
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
          id: 'profitYesterday',
          header: <TableHead className="text-center">Yesterday Profit %</TableHead>,
          cell: ({ item }) => {
            const yesterdayRevenue = item.yesterdayData ? item.yesterdayData.PriceAdvertiser_PublisherSide || 0 : 0;
            const yesterdayPublisher = item.yesterdayData ? item.yesterdayData.PricePublisher || 0 : 0;
            const yesterdayMargin = yesterdayRevenue - yesterdayPublisher;
            const marginPercentage = yesterdayRevenue > 0 ? (yesterdayMargin / yesterdayRevenue) * 100 : 0;
            return (
                          <TableCell className="text-center">
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
            const marginPercentage = dspRevenue > 0 ? (margin / dspRevenue) * 100 : 0;
            return (
                          <TableCell className="text-center">
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
      defaultEntityName="Realm Analytics"
      buildPayload={buildPayload}
      processAnalyticsData={processAnalyticsData}
      calculateSummaryStats={calculateSummaryStats}
      pageTitle="Realm Analytics"
      backButtonPath="/RealmDashboard"
      backButtonLabel="Back to Realm Dashboard"
      tableConfig={enhancedTableConfig}
      formatCurrency={formatCurrency}
      getAuthToken={getToken}
      networkOperationsConfig={networkOperationsMetrics}
      useNetworkOpsOnlyDaily
    />
  );
}
