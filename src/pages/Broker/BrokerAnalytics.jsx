/**
 * Broker Analytics Page Component
 * 
 * This page provides detailed analytics for a specific broker using the Druid API endpoint.
 * It uses the AnalyticsTemplate for common functionality and provides broker-specific logic.
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { processHourlyTodayWithProjections, computeAnalyticsHourlySummaryStats, computeDailyAnalyticsSummaryStats } from "@/utils/hourlyProjections";
import AnalyticsTemplate from "@/pages/Dashboard/AnalyticsTemplate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, BarChart3, Calendar, Loader2, AlertCircle, Info } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSearchParams } from "react-router-dom";
import { apiUrl, API_ENDPOINTS } from "@/config/api";
import { ChevronUp, ChevronDown } from "lucide-react";
import { formatCurrencyChart, formatEcpm, formatRpbr, formatLargeNumber } from "@/utils/formatters";
import placementBrokerMapping from "./placement-broker-mapping.json";
import { cn } from "@/lib/utils";
import { TAILWIND_CLASSES } from "@/config/theme";

export default function BrokerAnalytics() {
  const formatCurrency = formatCurrencyChart;
  const { getToken } = useAuth();
  const [searchParams] = useSearchParams();
  const [resolvedRealmId, setResolvedRealmId] = useState(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState(null);

  // Hourly expansion states
  const [expandedDates, setExpandedDates] = useState(new Set());
  const [hourlyDataCache, setHourlyDataCache] = useState({});
  const [loadingHourlyData, setLoadingHourlyData] = useState(new Set());
  
  // Use ref to track the last resolved brokerId to prevent duplicate API calls
  const lastResolvedBrokerId = useRef(null);
  
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
        filters.realmId = {
          Value: [entityId],
          Operator: "in"
        };
      }
      return filters;
    }
  }), []);
  
  // Get broker ID from URL
  const brokerId = searchParams.get('id');
  
  // Resolve realm ID from broker ID - only once per brokerId
  useEffect(() => {
    // Skip if no brokerId or already resolved for this brokerId
    if (!brokerId || lastResolvedBrokerId.current === brokerId) {
      return;
    }

    // Prevent concurrent calls
    let cancelled = false;

    const resolveRealmId = async () => {
      setIsResolving(true);
      setResolveError(null);

      try {
        // Step 1: Find placementId from mapping JSON
    const mapping = placementBrokerMapping.find(item => item.brokerId === brokerId);
        if (!mapping || !mapping.placementId) {
          throw new Error(`No placement found for broker ID: ${brokerId}`);
        }

        const placementId = mapping.placementId;
      const token = getToken();
      if (!token) {
          throw new Error('No authentication token available');
      }

        // Step 2: Fetch placement data to get realm ID
        const response = await fetch(
          apiUrl.placement(placementId),
          {
        method: 'GET',
        headers: {
          'x-ayl-auth-token': token,
              'Content-Type': 'application/json',
        }
          }
        );

      if (!response.ok) {
          throw new Error(`Failed to fetch placement: ${response.status}`);
        }

        const placementData = await response.json();
        
        // Step 3: Extract realm ID from response
        const realmId = placementData?.Data?.Realm?.Uid || placementData?.Data?.Company?.Realm;
        if (!realmId) {
          throw new Error('Realm ID not found in placement response');
        }

        if (!cancelled) {
          setResolvedRealmId(realmId);
          lastResolvedBrokerId.current = brokerId; // Mark this brokerId as resolved
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error resolving realm ID:', err);
          setResolveError(err.message || 'Failed to resolve realm ID');
          setResolvedRealmId(null);
          // Don't mark as resolved if error occurred - allow retry
          lastResolvedBrokerId.current = null;
        }
      } finally {
        if (!cancelled) {
          setIsResolving(false);
        }
      }
    };

    resolveRealmId();

    // Cleanup function to cancel if brokerId changes
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brokerId]); // Only depend on brokerId to avoid infinite loops
  
  // Reset resolved state if brokerId changes
  useEffect(() => {
    if (brokerId !== lastResolvedBrokerId.current) {
      setResolvedRealmId(null);
      setResolveError(null);
    }
  }, [brokerId]);
  
  // Build API payload based on realm ID (resolved from broker ID), dates, and view mode
  // entityId parameter will be the resolved realm ID passed from AnalyticsTemplate
  const buildPayload = (entityId, beginDateISO, endDateISO, viewMode) => {
    // entityId is now the resolved realm ID, use it directly
    if (!entityId) {
      return null;
    }

    const granularity = viewMode === 'hourly' ? { type: "period", period: "PT1H" } : { type: "period", period: "P1D" };

    return {
      Filters: {
        RealmPublisher: {
          Value: [entityId], // entityId is the resolved realm ID
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
      View: "SIMPLE_PUBLISHER",
      Datasource: "adserver_stats",
      TimeZone: "Etc/GMT"
    };
  };

  // Process raw API response data - same logic as SiteAnalytics
  const processAnalyticsData = (responseData, viewMode) => {
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
      return sortedData.map((item, index) => {
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
      }
  };

  // Calculate summary statistics - same as SiteAnalytics
    const calculateSummaryStats = (data, viewMode) => {
    if (!data || data.length === 0) {
      return null;
    }

    if (viewMode === 'hourly') {
      return computeAnalyticsHourlySummaryStats(data);
    }

    return computeDailyAnalyticsSummaryStats(data);
  };

  const fetchHourlyDataForDate = async (dateString, brokerId) => {
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
      Filters: { Partner: { Value: [brokerId], Operator: 'in' } },
      Intervals: [{ Begin: date.toISOString(), End: new Date(nextDay.getTime() - 1).toISOString() }],
      Metrics: ['PricePublisher', 'PriceAdvertiser_PublisherSide'],
      Granularity: { type: 'period', period: 'PT1H' },
      View: 'ADVANCED_PUBLISHER',
      Datasource: 'adserver_stats',
      TimeZone: 'Etc/GMT'
    };

    const res = await fetch(API_ENDPOINTS.DRUID_SEARCH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-ayl-auth-token': token },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (Array.isArray(data?.Data) ? data.Data : Array.isArray(data) ? data : [])
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map(item => {
        let ts = item.timestamp.replace(/\.\d{6}/, '');
        if (!ts.endsWith('Z') && !ts.includes('+')) ts += 'Z';
        const d = new Date(ts);
        const dspRev = item.PriceAdvertiser_PublisherSide || 0;
        const pubCost = item.PricePublisher || 0;
        return {
          ...item,
          formattedTime: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'UTC' }),
          margin: dspRev - pubCost,
          marginPercentage: dspRev > 0 ? ((dspRev - pubCost) / dspRev * 100).toFixed(2) : 0,
        };
      });
  };

  const toggleDateExpansion = async (dateString, dateKey, brokerId) => {
    const key = dateKey || dateString;
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
      if (!hourlyDataCache[key] && !loadingHourlyData.has(key)) {
        setLoadingHourlyData(prev => new Set(prev).add(key));
        try {
          const hourly = await fetchHourlyDataForDate(dateString, brokerId);
          setHourlyDataCache(prev => ({ ...prev, [key]: hourly }));
        } catch (e) {
          console.error('Error fetching hourly data:', e);
        } finally {
          setLoadingHourlyData(prev => { const s = new Set(prev); s.delete(key); return s; });
        }
      }
    }
    setExpandedDates(newExpanded);
  };

  // Render table headers - same as SiteAnalytics
  const renderTableHeaders = (viewMode) => {
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
                      </>
                    )}
      </>
    );
  };

  // Render table row - same as SiteAnalytics
  const renderTableRow = (item, index, analyticsData, viewMode, showDetailedColumns, entityId) => {
    const publisherCosts = item.PricePublisher || 0;
    const dspRevenue = item.PriceAdvertiser_PublisherSide || 0;
    const margin = dspRevenue - publisherCosts;
    const marginPercentage = dspRevenue > 0 ? (margin / dspRevenue) * 100 : 0;
    
    const formattedDate = item.formattedDate;
    const isExpanded = viewMode === 'daily' && expandedDates.has(item.dateKey || item.formattedDate);
    const isLoadingHourly = viewMode === 'daily' && loadingHourlyData.has(item.dateKey || item.formattedDate);
    const hourlyData = viewMode === 'daily' ? (hourlyDataCache[item.dateKey || item.formattedDate] || []) : [];
    const COLS = 7; // number of columns in daily mode

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
                    <TableRow
          className={viewMode === 'daily' ? 'cursor-pointer hover:bg-slate-50' : ''}
          onClick={viewMode === 'daily' && entityId ? () => toggleDateExpansion(item.formattedDate, item.dateKey || item.formattedDate, entityId) : undefined}
        >
        <TableCell className="font-medium text-center">
          {viewMode === 'daily' ? (
            <div className="flex items-center justify-center gap-1">
              {isExpanded ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
              <span>{formattedDate}</span>
            </div>
          ) : formattedDate}
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
                        </>
                      )}
                    </TableRow>

        {/* Hourly rows expanded */}
        {viewMode === 'daily' && isExpanded && (
          <>
            {isLoadingHourly ? (
              <TableRow>
                <TableCell colSpan={COLS} className="text-center py-3">
                  <Loader2 className="w-4 h-4 animate-spin inline-block mr-2 text-slate-500" />
                  <span className="text-sm text-slate-500">Loading hourly data...</span>
                </TableCell>
              </TableRow>
            ) : hourlyData.length > 0 ? (
              hourlyData.map((h, hi) => {
                const hDsp = h.PriceAdvertiser_PublisherSide || 0;
                const hPub = h.PricePublisher || 0;
                const hMargin = hDsp - hPub;
                const hPct = hDsp > 0 ? (hMargin / hDsp * 100) : 0;
                return (
                  <TableRow key={`h-${hi}`} className="bg-slate-50/60 text-xs">
                    <TableCell className="text-center text-slate-500 pl-8">{h.formattedTime}</TableCell>
                    <TableCell className="text-center text-green-600">{formatCurrency(hDsp)}</TableCell>
                    <TableCell className="text-center"><span className="text-gray-300">—</span></TableCell>
                    <TableCell className="text-center text-red-600">{formatCurrency(hPub)}</TableCell>
                    <TableCell className="text-center"><span className="text-gray-300">—</span></TableCell>
                    <TableCell className="text-center text-black">{formatCurrency(hMargin)}</TableCell>
                    <TableCell className="text-center"><span className="text-gray-300">—</span></TableCell>
                    <TableCell className="text-center">
                      {hPct > 0 ? (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-[rgb(75,99,226)] text-white">{hPct.toFixed(1)}%</span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-red-500 text-white">{hPct.toFixed(1)}%</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={COLS} className="text-center py-2 text-xs text-slate-400">No hourly data</TableCell>
              </TableRow>
            )}
          </>
        )}
      </React.Fragment>
    );
  };

  // Show loading/error states while resolving realm ID
  if (isResolving || (!resolvedRealmId && brokerId)) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-[rgb(75,99,226)] mx-auto mb-4" />
              <p className="text-slate-600">Resolving broker realm ID...</p>
            </div>
          </div>
      </div>
    </div>
    );
  }

  if (resolveError) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-7xl mx-auto">
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to resolve realm ID: {resolveError}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // If no broker ID, show nothing (or could redirect)
  if (!brokerId) {
    return null;
  }

  return (
    <AnalyticsTemplate
      entityIdParam="id"
      entityNameParam="name"
      // Pass resolved realm ID as entityId by modifying URL params
      // We'll use a workaround: pass resolvedRealmId directly via a custom prop mechanism
      // Since AnalyticsTemplate reads from URL, we need to ensure the fetch happens with the resolved ID
      entityId={resolvedRealmId || brokerId}
      buildPayload={buildPayload}
      processAnalyticsData={processAnalyticsData}
      calculateSummaryStats={calculateSummaryStats}
      pageTitle="Broker Analytics"
      backButtonPath="/BrokerManagement"
      backButtonLabel="Back to Broker Management"
      renderTableHeaders={renderTableHeaders}
      renderTableRow={renderTableRow}
      formatCurrency={formatCurrency}
      getAuthToken={getToken}
      networkOperationsConfig={networkOperationsMetrics}
    />
  );
}
