/**
 * Dashboard Analytics Page Component
 * 
 * This page provides overview analytics using the Druid API endpoint.
 * It displays revenue analytics, margin calculations, and performance metrics
 * with both daily and hourly views.
 * 
 * Features:
 * - Analytics dashboard with Druid API integration
 * - Daily and hourly view modes with automatic date range selection
 * - Revenue tracking (DSP Revenue, Publisher Costs, ADY Margin)
 * - Margin percentage calculations and trends
 * - Interactive charts with Recharts library
 * - Detailed data tables with trend indicators
 * - Yesterday comparison for hourly view
 * - Currency formatting and number formatting
 * - Real-time data refresh functionality
 * - Date range picker for daily view
 * - Error handling and loading states
 * - Responsive design with summary cards
 * - Performance metrics and statistics
 */

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, TrendingDown, DollarSign, Loader2, AlertCircle, ArrowDownRight, ArrowUpRight, RefreshCw, ChevronDown, ChevronUp, Info, BarChart3, X, Download, ArrowUp, ArrowDown, Menu, Calendar, Percent, Gauge, PieChart as PieChartIcon, Activity } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cachedFetch } from "@/utils/apiCache";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import jsPDF from "jspdf";
import BusinessReviewOverview from "@/components/BusinessReviewOverview";
import { formatError } from "@/utils/errorFormatter";
import { API_ENDPOINTS } from "@/config/api";
import { formatCurrency, formatCurrencyChart, formatLargeNumber, formatEcpm, formatRpbr, formatPercentage } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { TAILWIND_CLASSES } from "@/config/theme";

export default function Dashboard({ useNetworkOpsForDaily = true }) {
  const navigate = useNavigate();
  const { getToken } = useAuth();
  
  const [analyticsData, setAnalyticsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summaryStats, setSummaryStats] = useState(null);
  const [networkOperationsData, setNetworkOperationsData] = useState(null); // New state for network operations data
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('dashboard-view-mode') || 'daily');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [showDetailedColumns, setShowDetailedColumns] = useState(false); // State to toggle detailed network operations columns
  const [expandedDates, setExpandedDates] = useState(new Set()); // Track which dates are expanded
  const [hourlyDataCache, setHourlyDataCache] = useState({}); // Cache hourly data by date
  const [loadingHourlyData, setLoadingHourlyData] = useState(new Set()); // Track which dates are loading hourly data
  const [selectedFilter, setSelectedFilter] = useState(null); // Track selected filter from right menu
  const [isPanelOpen, setIsPanelOpen] = useState(false); // Track if the side panel is open
  const [hiddenSeries, setHiddenSeries] = useState({});
  const [deviceData, setDeviceData] = useState([]); // Store device data
  const [loadingDeviceData, setLoadingDeviceData] = useState(false); // Loading state for device data
  const [dspData, setDspData] = useState([]); // Store DSP data
  const [loadingDspData, setLoadingDspData] = useState(false); // Loading state for DSP data
  const [seatData, setSeatData] = useState([]); // Store SEAT data
  const [loadingSeatData, setLoadingSeatData] = useState(false); // Loading state for SEAT data
  const [adDomainData, setAdDomainData] = useState([]); // Store AD DOMAIN data
  const [loadingAdDomainData, setLoadingAdDomainData] = useState(false); // Loading state for AD DOMAIN data
  const [siteDomainData, setSiteDomainData] = useState([]); // Store SITE DOMAIN data
  const [loadingSiteDomainData, setLoadingSiteDomainData] = useState(false); // Loading state for SITE DOMAIN data
  const [adKindData, setAdKindData] = useState([]); // Store AD KIND data
  const [loadingAdKindData, setLoadingAdKindData] = useState(false); // Loading state for AD KIND data
  const [geoData, setGeoData] = useState([]); // Store GEO data
  const [loadingGeoData, setLoadingGeoData] = useState(false); // Loading state for GEO data
  const [selectedDevice, setSelectedDevice] = useState(null); // Track selected device for detailed view
  const [deviceDetailData, setDeviceDetailData] = useState([]); // Store detailed device data by date
  const [loadingDeviceDetail, setLoadingDeviceDetail] = useState(false); // Loading state for device detail
  const [selectedDsp, setSelectedDsp] = useState(null); // Track selected DSP for detailed view
  const [dspDetailData, setDspDetailData] = useState([]); // Store detailed DSP data by date
  const [loadingDspDetail, setLoadingDspDetail] = useState(false); // Loading state for DSP detail

  const toggleSeries = useCallback((chartId, dataKey) => {
    if (!dataKey) return;
    setHiddenSeries((prev) => {
      const chartState = prev[chartId] || {};
      return {
        ...prev,
        [chartId]: {
          ...chartState,
          [dataKey]: !chartState[dataKey],
        },
      };
    });
  }, []);

  const isSeriesHidden = useCallback(
    (chartId, dataKey) => !!hiddenSeries?.[chartId]?.[dataKey],
    [hiddenSeries]
  );
  
  // Sorting states for each table
  const [dspSortConfig, setDspSortConfig] = useState({ key: null, direction: 'asc' });
  const [seatSortConfig, setSeatSortConfig] = useState({ key: null, direction: 'asc' });
  const [adDomainSortConfig, setAdDomainSortConfig] = useState({ key: null, direction: 'asc' });
  const [siteDomainSortConfig, setSiteDomainSortConfig] = useState({ key: null, direction: 'asc' });
  const [adKindSortConfig, setAdKindSortConfig] = useState({ key: null, direction: 'asc' });
  const [geoSortConfig, setGeoSortConfig] = useState({ key: null, direction: 'asc' });
  const [deviceSortConfig, setDeviceSortConfig] = useState({ key: null, direction: 'asc' });
  const [kpiProgSortConfig, setKpiProgSortConfig] = useState({ key: null, direction: 'asc' });

  // Business Review (global OVERVIEW) states
  const [businessReviewData, setBusinessReviewData] = useState(null);
  const [loadingBusinessReview, setLoadingBusinessReview] = useState(false);
  const [businessReviewError, setBusinessReviewError] = useState(null);

  // Generic sort function
  const handleSort = (sortConfig, setSortConfig, data, setData, sortKey) => {
    const direction = sortConfig.key === sortKey && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    const sortedData = [...data].sort((a, b) => {
      let aValue = a[sortKey];
      let bValue = b[sortKey];
      
      // Handle numeric values
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      // Handle string values
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return direction === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      // Handle null/undefined
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      
      return 0;
    });
    
    setSortConfig({ key: sortKey, direction });
    setData(sortedData);
  };

  // Sort handlers for each table
  const handleDspSort = (sortKey) => {
    handleSort(dspSortConfig, setDspSortConfig, dspData, setDspData, sortKey);
  };

  const handleSeatSort = (sortKey) => {
    handleSort(seatSortConfig, setSeatSortConfig, seatData, setSeatData, sortKey);
  };

  const handleAdDomainSort = (sortKey) => {
    handleSort(adDomainSortConfig, setAdDomainSortConfig, adDomainData, setAdDomainData, sortKey);
  };

  const handleSiteDomainSort = (sortKey) => {
    handleSort(siteDomainSortConfig, setSiteDomainSortConfig, siteDomainData, setSiteDomainData, sortKey);
  };

  const handleDeviceSort = (sortKey) => {
    handleSort(deviceSortConfig, setDeviceSortConfig, deviceData, setDeviceData, sortKey);
  };

  const handleAdKindSort = (sortKey) => {
    handleSort(adKindSortConfig, setAdKindSortConfig, adKindData, setAdKindData, sortKey);
  };

  const handleGeoSort = (sortKey) => {
    handleSort(geoSortConfig, setGeoSortConfig, geoData, setGeoData, sortKey);
  };

  const handleKpiProgSort = (sortKey) => {
    handleSort(kpiProgSortConfig, setKpiProgSortConfig, analyticsData, setAnalyticsData, sortKey);
  };

  // Helper function to render sortable header
  const renderSortableHeader = (label, sortKey, sortConfig, onSort, customContent = null) => {
    const isSorted = sortConfig.key === sortKey;
    const direction = sortConfig.direction;
    
    return (
      <TableHead 
        className="text-center cursor-pointer hover:bg-slate-100 select-none"
        onClick={() => onSort(sortKey)}
      >
        <div className="flex items-center justify-center gap-1">
          {customContent || <span>{label}</span>}
          {isSorted ? (
            direction === 'asc' ? (
              <ArrowUp className="w-3 h-3" />
            ) : (
              <ArrowDown className="w-3 h-3" />
            )
          ) : (
            <div className="w-3 h-3 opacity-30">
              <ArrowUp className="w-3 h-3" />
            </div>
          )}
        </div>
      </TableHead>
    );
  };
  
  // Listen for view mode changes from localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      setViewMode(localStorage.getItem('dashboard-view-mode') || 'daily');
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
  
  // Watch for view mode changes in current window
  useEffect(() => {
    const checkViewMode = setInterval(() => {
      const storedMode = localStorage.getItem('dashboard-view-mode') || 'daily';
      if (storedMode !== viewMode) {
        setViewMode(storedMode);
      }
    }, 100);
    return () => clearInterval(checkViewMode);
  }, [viewMode]);

  // Fonction pour calculer les dates à partir de la plage de temps sélectionnée (from header)
  const calculateDatesFromTimeRange = (range) => {
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDate = now.getDate();
    
    let startDateValue, endDateValue;

    switch (range) {
      case '5d': {
        const date5d = new Date(todayYear, todayMonth, todayDate - 5);
        startDateValue = new Date(Date.UTC(date5d.getFullYear(), date5d.getMonth(), date5d.getDate(), 0, 0, 0, 0));
        endDateValue = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
        break;
      }
      case '7d': {
        const date7d = new Date(todayYear, todayMonth, todayDate - 7);
        startDateValue = new Date(Date.UTC(date7d.getFullYear(), date7d.getMonth(), date7d.getDate(), 0, 0, 0, 0));
        endDateValue = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
        break;
      }
      case '14d': {
        const date14d = new Date(todayYear, todayMonth, todayDate - 14);
        startDateValue = new Date(Date.UTC(date14d.getFullYear(), date14d.getMonth(), date14d.getDate(), 0, 0, 0, 0));
        endDateValue = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
        break;
      }
      case '20d': {
        const date20d = new Date(todayYear, todayMonth, todayDate - 20);
        startDateValue = new Date(Date.UTC(date20d.getFullYear(), date20d.getMonth(), date20d.getDate(), 0, 0, 0, 0));
        endDateValue = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
        break;
      }
      case '30d': {
        const date30d = new Date(todayYear, todayMonth, todayDate - 30);
        startDateValue = new Date(Date.UTC(date30d.getFullYear(), date30d.getMonth(), date30d.getDate(), 0, 0, 0, 0));
        endDateValue = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
        break;
      }
      default: {
        const dateDefault = new Date(todayYear, todayMonth, todayDate - 7);
        startDateValue = new Date(Date.UTC(dateDefault.getFullYear(), dateDefault.getMonth(), dateDefault.getDate(), 0, 0, 0, 0));
        endDateValue = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
      }
    }
    
    return {
      start: startDateValue.toISOString().split('T')[0],
      end: endDateValue.toISOString().split('T')[0]
    };
  };

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Get time range from localStorage (set by Layout header)
  const getTimeRange = () => {
    return localStorage.getItem('selected-time-range') || '7d';
  };

  // Effective dates for filter panels: Real-time (hourly) = Today only, sinon = plage sélectionnée
  const getEffectiveDatesForFilterPanels = () => {
    if (viewMode === 'hourly') {
      const now = new Date();
      const todayYear = now.getUTCFullYear();
      const todayMonth = now.getUTCMonth();
      const todayDate = now.getUTCDate();
      const todayStr = new Date(Date.UTC(todayYear, todayMonth, todayDate, 0, 0, 0, 0)).toISOString().split('T')[0];
      return { start: todayStr, end: todayStr };
    }
    return calculateDatesFromTimeRange(getTimeRange());
  };

  // Initialiser les dates par défaut au montage du composant
  useEffect(() => {
    const dates = getEffectiveDatesForFilterPanels();
    setStartDate(dates.start);
    setEndDate(dates.end);
  }, [viewMode]);

  // Fetch analytics data when dates or view mode changes
  useEffect(() => {
    if (startDate && endDate) {
      fetchAnalyticsData();
    }
  }, [viewMode, startDate, endDate]);

  // Listen for time range changes from header
  useEffect(() => {
    const handleTimeRangeChange = () => {
      const dates = getEffectiveDatesForFilterPanels();
      // Only update state if dates actually changed to avoid unnecessary re-fetches
      setStartDate((prev) => (prev !== dates.start ? dates.start : prev));
      setEndDate((prev) => (prev !== dates.end ? dates.end : prev));
    };

    // Listen to custom event from Layout header
    window.addEventListener('timeRangeChanged', handleTimeRangeChange);
    
    // Also listen to storage events (for cross-tab sync)
    window.addEventListener('storage', handleTimeRangeChange);

    return () => {
      window.removeEventListener('timeRangeChanged', handleTimeRangeChange);
      window.removeEventListener('storage', handleTimeRangeChange);
    };
  }, [viewMode]);
  
  // Expose refresh function to window for Layout header to use
  useEffect(() => {
    window.refreshDashboard = fetchAnalyticsData;
    window.dashboardLoading = loading;
    return () => {
      delete window.refreshDashboard;
      delete window.dashboardLoading;
    };
  }, [loading]);


  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = getToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const useNetworkOpsOnly = useNetworkOpsForDaily && viewMode === 'daily';

      // Calculate date range based on view mode and selected dates
      let startDateValue, endDateValue;
      
      // For hourly view, always use Yesterday and Today for comparison (ignore selected time range)
      if (viewMode === 'hourly') {
        const now = new Date();
        const todayYear = now.getUTCFullYear();
        const todayMonth = now.getUTCMonth();
        const todayDate = now.getUTCDate();
        
        // Yesterday: start at 00:00:00 UTC
        const yesterday = new Date(Date.UTC(todayYear, todayMonth, todayDate - 1, 0, 0, 0, 0));
        startDateValue = yesterday;
        
        // Today: end at 23:59:59 UTC
        endDateValue = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
      } else if (startDate && endDate) {
        // For daily view, use selected dates - start at 00:00:00 and end at 23:59:59
        startDateValue = new Date(startDate + 'T00:00:00.000Z');
        endDateValue = new Date(endDate + 'T23:59:59.000Z');
      } else {
        // Default behavior for daily view
        const now = new Date();
        startDateValue = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDateValue.setUTCHours(0, 0, 0, 0); // Set to 00:00:00
        endDateValue = new Date(now);
        endDateValue.setUTCHours(23, 59, 59, 999); // Set to 23:59:59
      }

      const payload = {
        "Intervals": [{
          "Begin": startDateValue.toISOString(),
          "End": endDateValue.toISOString()
        }],
        "Metrics": ["PricePublisher", "PriceAdvertiser_PublisherSide", "CLICK", "IMPRESSION"],
        "Granularity": {
          "type": "period",
          "period": viewMode === 'daily' ? "P1D" : "PT1H"
        },
        "Datasource": "adserver_stats",
        "TimeZone": "Etc/GMT"
      };

      // Log full payload for hourly mode
      if (viewMode === 'hourly') {
        console.log('📤 API Payload:', JSON.stringify(payload, null, 2));
        console.log('🌐 API Endpoint:', API_ENDPOINTS.DRUID_SEARCH);
      }

      // Make API calls - network operations only for daily view and exclude Today
      const apiCalls = [];
      if (!useNetworkOpsOnly) {
        apiCalls.push(
        cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-ayl-auth-token": token
          },
          body: JSON.stringify(payload)
        })
        );
      }

      // Add network operations call only for daily view
      if (viewMode === 'daily') {
        // Check if endDate includes Today - if so, exclude Today for network operations
        const now = new Date();
        const todayYear = now.getUTCFullYear();
        const todayMonth = now.getUTCMonth();
        const todayDate = now.getUTCDate();
        const todayStart = new Date(Date.UTC(todayYear, todayMonth, todayDate, 0, 0, 0, 0));
        
        // If endDate is today or later, use yesterday as end date for network operations
        let networkOpsEndDate = endDateValue;
        if (endDateValue >= todayStart) {
          // Use yesterday 23:59:59 UTC as end date (network operations data is aggregated nightly)
          networkOpsEndDate = new Date(Date.UTC(todayYear, todayMonth, todayDate - 1, 23, 59, 59, 999));
          
          // If startDate is also today, skip network operations call (no data available)
          if (startDateValue >= todayStart) {
            console.log('⚠️ Network Operations: Skipping call - selected period is Today only (data aggregated nightly, no real-time data)');
          } else {
            console.log('⚠️ Network Operations: Excluding Today (data aggregated nightly). Using end date:', networkOpsEndDate.toISOString());
            apiCalls.push(fetchNetworkOperationsData(startDateValue, networkOpsEndDate));
          }
        } else {
          // End date is before today, safe to use as-is
          apiCalls.push(fetchNetworkOperationsData(startDateValue, networkOpsEndDate));
        }
      }

      const responses = await Promise.all(apiCalls);
      const response = useNetworkOpsOnly ? null : responses[0];
      
      // Get network operations data if available (only for daily mode)
      let networkOpsData = null;
      if (viewMode === 'daily') {
        const networkOpsIndex = useNetworkOpsOnly ? 0 : 1;
        if (responses.length > networkOpsIndex) {
          networkOpsData = responses[networkOpsIndex]; // fetchNetworkOperationsData returns the data directly
        }
      }

      let data = [];
      if (useNetworkOpsOnly) {
        const rawNetworkOps = Array.isArray(networkOpsData)
          ? networkOpsData
          : (networkOpsData?.Data || []);
        data = rawNetworkOps.map((item) => ({
          ...item,
          PriceAdvertiser_PublisherSide: (item.network_operations_price_advertiser || 0) * 1_000_000,
          PricePublisher: (item.network_operations_price_publisher || 0) * 1_000_000,
          IMPRESSION: item.network_operations_impressions ?? 0,
          CLICK: item.network_operations_click ?? item.network_operations_clicks ?? 0
        }));
      } else {
      if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        setError(formatError(error, response));
        setLoading(false);
        return;
        }
        data = await response.json();
      }
      
      // Debug: log raw data
      console.log('Raw API response:', data);
      
      // Process data for charts and calculations
      // Sort data by timestamp to ensure correct trend calculation
      const sortedData = data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      let processedData;
      
      if (viewMode === 'hourly') {
        // For hourly view, group data by day and create comparison rows
        const today = new Date();
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        
        // Group data by day (using UTC+0 timezone - no adjustment)
        const dataByDay = {};
        sortedData.forEach((item) => {
          // Clean timestamp by removing microseconds and fixing format
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
        
        // Create comparison rows for each hour
        processedData = [];
        // Use UTC+0 timezone (no adjustment)
        const adjustedToday = new Date(today.getTime());
        const adjustedYesterday = new Date(yesterday.getTime());
        const todayData = dataByDay[adjustedToday.toISOString().slice(0, 10)] || [];
        const yesterdayData = dataByDay[adjustedYesterday.toISOString().slice(0, 10)] || [];
        
        // Create a map for quick lookup
        const yesterdayMap = {};
        yesterdayData.forEach(item => {
          yesterdayMap[item.hour] = item;
        });
        
        // Process today's data and compare with yesterday
        todayData.forEach((todayItem, index) => {
          const yesterdayItem = yesterdayMap[todayItem.hour];
          
          // Calculate trends compared to same hour yesterday
          const dspRevenueTrend = yesterdayItem ? 
            (todayItem.PriceAdvertiser_PublisherSide > yesterdayItem.PriceAdvertiser_PublisherSide ? 'up' : 
             todayItem.PriceAdvertiser_PublisherSide < yesterdayItem.PriceAdvertiser_PublisherSide ? 'down' : 'same') : 'same';
          
          const dspRevenueChangePercent = yesterdayItem ? 
            (((todayItem.PriceAdvertiser_PublisherSide - yesterdayItem.PriceAdvertiser_PublisherSide) / yesterdayItem.PriceAdvertiser_PublisherSide) * 100).toFixed(1) : 0;
          
          const publisherCostsTrend = yesterdayItem ? 
            (todayItem.PricePublisher > yesterdayItem.PricePublisher ? 'up' : 
             todayItem.PricePublisher < yesterdayItem.PricePublisher ? 'down' : 'same') : 'same';
          
          const publisherCostsChangePercent = yesterdayItem ? 
            (((todayItem.PricePublisher - yesterdayItem.PricePublisher) / yesterdayItem.PricePublisher) * 100).toFixed(1) : 0;
          
          const marginTrend = yesterdayItem ? 
            ((todayItem.PriceAdvertiser_PublisherSide - todayItem.PricePublisher) > (yesterdayItem.PriceAdvertiser_PublisherSide - yesterdayItem.PricePublisher) ? 'up' : 
             (todayItem.PriceAdvertiser_PublisherSide - todayItem.PricePublisher) < (yesterdayItem.PriceAdvertiser_PublisherSide - yesterdayItem.PricePublisher) ? 'down' : 'same') : 'same';
          
          const marginChangePercent = yesterdayItem ? 
            ((((todayItem.PriceAdvertiser_PublisherSide - todayItem.PricePublisher) - (yesterdayItem.PriceAdvertiser_PublisherSide - yesterdayItem.PricePublisher)) / (yesterdayItem.PriceAdvertiser_PublisherSide - yesterdayItem.PricePublisher)) * 100).toFixed(1) : 0;
          
          processedData.push({
            ...todayItem,
            date: `${todayItem.cleanDate.toLocaleDateString('fr-FR', { timeZone: 'UTC' })} ${todayItem.cleanDate.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: true,
              timeZone: 'UTC'
            })}`,
            formattedDate: `${todayItem.cleanDate.toLocaleDateString('fr-FR', { timeZone: 'UTC' })} ${todayItem.cleanDate.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: true,
              timeZone: 'UTC'
            })}`,
            margin: todayItem.PriceAdvertiser_PublisherSide - todayItem.PricePublisher,
            marginPercentage: ((todayItem.PriceAdvertiser_PublisherSide - todayItem.PricePublisher) / todayItem.PriceAdvertiser_PublisherSide * 100).toFixed(2),
            dspRevenueTrend,
            dspRevenueChangePercent,
            publisherCostsTrend,
            publisherCostsChangePercent,
            marginTrend,
            marginChangePercent,
            // Add yesterday's data for comparison and chart
            yesterdayData: yesterdayItem ? {
              PriceAdvertiser_PublisherSide: yesterdayItem.PriceAdvertiser_PublisherSide,
              PricePublisher: yesterdayItem.PricePublisher,
              margin: yesterdayItem.PriceAdvertiser_PublisherSide - yesterdayItem.PricePublisher,
              marginPercentage: ((yesterdayItem.PriceAdvertiser_PublisherSide - yesterdayItem.PricePublisher) / yesterdayItem.PriceAdvertiser_PublisherSide * 100).toFixed(2)
            } : null,
            // Add yesterday's revenue for chart (flattened for Recharts)
            yesterdayDSPRevenue: yesterdayItem ? yesterdayItem.PriceAdvertiser_PublisherSide : null,
            // Add hour-only format for chart
            hourOnly: todayItem.cleanDate.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: true,
              timeZone: 'UTC'
            })
          });
        });
      } else {
        // For daily view, use the original logic
        processedData = sortedData.map((item, index) => {
        // Clean timestamp by removing microseconds and fixing format
      let cleanTimestamp = item.timestamp;
      
      // Remove microseconds (.000000) if present
      cleanTimestamp = cleanTimestamp.replace(/\.\d{6}/, '');
      
      // Ensure proper ISO format
      if (!cleanTimestamp.endsWith('Z') && !cleanTimestamp.includes('+')) {
        cleanTimestamp += 'Z';
      }
      
      const date = new Date(cleanTimestamp);
      
      // Debug: log if date is invalid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date after cleaning:', cleanTimestamp, 'Original:', item.timestamp);
      }
      
        // Calculate trend compared to previous day
        const previousItem = index > 0 ? sortedData[index - 1] : null;
        const dspRevenueTrend = previousItem ? 
          (item.PriceAdvertiser_PublisherSide > previousItem.PriceAdvertiser_PublisherSide ? 'up' : 
           item.PriceAdvertiser_PublisherSide < previousItem.PriceAdvertiser_PublisherSide ? 'down' : 'same') : 'same';
        
        const dspRevenueChangePercent = previousItem ? 
          (((item.PriceAdvertiser_PublisherSide - previousItem.PriceAdvertiser_PublisherSide) / previousItem.PriceAdvertiser_PublisherSide) * 100).toFixed(1) : 0;
        
        const publisherCostsTrend = previousItem ? 
          (item.PricePublisher > previousItem.PricePublisher ? 'up' : 
           item.PricePublisher < previousItem.PricePublisher ? 'down' : 'same') : 'same';
        
        const publisherCostsChangePercent = previousItem ? 
          (((item.PricePublisher - previousItem.PricePublisher) / previousItem.PricePublisher) * 100).toFixed(1) : 0;
        
        const marginTrend = previousItem ? 
          ((item.PriceAdvertiser_PublisherSide - item.PricePublisher) > (previousItem.PriceAdvertiser_PublisherSide - previousItem.PricePublisher) ? 'up' : 
           (item.PriceAdvertiser_PublisherSide - item.PricePublisher) < (previousItem.PriceAdvertiser_PublisherSide - previousItem.PricePublisher) ? 'down' : 'same') : 'same';
        
        const marginChangePercent = previousItem ? 
          ((((item.PriceAdvertiser_PublisherSide - item.PricePublisher) - (previousItem.PriceAdvertiser_PublisherSide - previousItem.PricePublisher)) / (previousItem.PriceAdvertiser_PublisherSide - previousItem.PricePublisher)) * 100).toFixed(1) : 0;
      
      return {
          ...item,
          date: date.toLocaleDateString('fr-FR'),
          dateKey: date.toISOString().slice(0, 10), // Add date key for merging with network operations
          margin: item.PriceAdvertiser_PublisherSide - item.PricePublisher,
          marginPercentage: ((item.PriceAdvertiser_PublisherSide - item.PricePublisher) / item.PriceAdvertiser_PublisherSide * 100).toFixed(2),
        dspRevenueTrend,
        dspRevenueChangePercent,
          publisherCostsTrend,
          publisherCostsChangePercent,
        marginTrend,
        marginChangePercent
      };
    });
      }

      // Merge network operations data with analytics data for daily view
      if (viewMode === 'daily' && networkOpsData && Array.isArray(networkOpsData) && networkOpsData.length > 0) {
        // Create a map of network operations data by date
        const networkOpsMap = {};
        networkOpsData.forEach((networkItem) => {
          // Clean timestamp and extract date key
          let cleanTimestamp = networkItem.timestamp;
          // Remove microseconds (.000000) if present - handle multiple occurrences
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
          
          if (networkOpsItem) {
            return {
              ...item,
              network_operations_bid_requests: networkOpsItem.network_operations_bid_requests,
              network_operations_bid_responses: networkOpsItem.network_operations_bid_responses,
              network_operations_impressions: networkOpsItem.network_operations_impressions,
              network_operations_ecpm_publisher: networkOpsItem.network_operations_ecpm_publisher,
              network_operations_click: networkOpsItem.network_operations_click,
              network_operations_visible_impressions: networkOpsItem.network_operations_visible_impressions,
              network_operations_viewability_rate: networkOpsItem.network_operations_viewability_rate
            };
          } else {
            // No network operations data for this date
            return {
              ...item,
              network_operations_bid_requests: null,
              network_operations_bid_responses: null,
              network_operations_impressions: null,
              network_operations_ecpm_publisher: null,
              network_operations_click: null,
              network_operations_visible_impressions: null,
              network_operations_viewability_rate: null
            };
          }
        });
        
        // Calculate derived metrics: RPBR, Fill Rate, Win Rate (first pass)
        processedData = processedData.map((item) => {
          // Calculate derived metrics: RPBR, Fill Rate, Win Rate
          let rpbr = null;
          let fillRate = null;
          let winRate = null;
          
          if (item.network_operations_bid_requests !== null && item.network_operations_bid_requests > 0) {
            // RPBR (Revenue per Bid Request) = (Publisher Revenue / Bid Requests) * 1,000,000
            // Convert PriceAdvertiser_PublisherSide from micro-dollars to dollars, then calculate per 1,000,000 bid requests
            if (item.PriceAdvertiser_PublisherSide !== null && item.PriceAdvertiser_PublisherSide !== undefined) {
              rpbr = (item.PriceAdvertiser_PublisherSide / 1000000 / item.network_operations_bid_requests) * 1000000; // Convert to dollars per 1,000,000 bid requests
            }
            
            // Fill Rate = (Impressions / Bid Requests) * 100
            if (item.network_operations_impressions !== null) {
              fillRate = (item.network_operations_impressions / item.network_operations_bid_requests) * 100;
            }
            
            // Win Rate = (Bid Responses / Bid Requests) * 100
            if (item.network_operations_bid_responses !== null && item.network_operations_bid_responses > 0 && item.network_operations_impressions !== null) {
              winRate = (item.network_operations_impressions / item.network_operations_bid_responses) * 100;
            }
          }
          
          return {
            ...item,
            rpbr,
            fillRate,
            winRate
          };
        });
        
        // Calculate trends for network operations after merging all data (second pass)
        processedData = processedData.map((item, index) => {
          const previousItem = index > 0 ? processedData[index - 1] : null;
          
          // Calculate trends for network operations metrics
          let bidRequestsTrend = 'same';
          let bidRequestsChangePercent = 0;
          let bidResponsesTrend = 'same';
          let bidResponsesChangePercent = 0;
          let impressionsTrend = 'same';
          let impressionsChangePercent = 0;
          let ecpmTrend = 'same';
          let ecpmChangePercent = 0;
          
          if (item.network_operations_bid_requests !== null && previousItem && previousItem.network_operations_bid_requests !== null) {
            // Bid Requests trend
            if (item.network_operations_bid_requests > previousItem.network_operations_bid_requests) {
              bidRequestsTrend = 'up';
              bidRequestsChangePercent = (((item.network_operations_bid_requests - previousItem.network_operations_bid_requests) / previousItem.network_operations_bid_requests) * 100).toFixed(1);
            } else if (item.network_operations_bid_requests < previousItem.network_operations_bid_requests) {
              bidRequestsTrend = 'down';
              bidRequestsChangePercent = (((item.network_operations_bid_requests - previousItem.network_operations_bid_requests) / previousItem.network_operations_bid_requests) * 100).toFixed(1);
            }
          }
          
          if (item.network_operations_bid_responses !== null && previousItem && previousItem.network_operations_bid_responses !== null) {
            // Bid Responses trend
            if (item.network_operations_bid_responses > previousItem.network_operations_bid_responses) {
              bidResponsesTrend = 'up';
              bidResponsesChangePercent = (((item.network_operations_bid_responses - previousItem.network_operations_bid_responses) / previousItem.network_operations_bid_responses) * 100).toFixed(1);
            } else if (item.network_operations_bid_responses < previousItem.network_operations_bid_responses) {
              bidResponsesTrend = 'down';
              bidResponsesChangePercent = (((item.network_operations_bid_responses - previousItem.network_operations_bid_responses) / previousItem.network_operations_bid_responses) * 100).toFixed(1);
            }
          }
          
          if (item.network_operations_impressions !== null && previousItem && previousItem.network_operations_impressions !== null) {
            // Impressions trend
            if (item.network_operations_impressions > previousItem.network_operations_impressions) {
              impressionsTrend = 'up';
              impressionsChangePercent = (((item.network_operations_impressions - previousItem.network_operations_impressions) / previousItem.network_operations_impressions) * 100).toFixed(1);
            } else if (item.network_operations_impressions < previousItem.network_operations_impressions) {
              impressionsTrend = 'down';
              impressionsChangePercent = (((item.network_operations_impressions - previousItem.network_operations_impressions) / previousItem.network_operations_impressions) * 100).toFixed(1);
            }
          }
          
          if (item.network_operations_ecpm_publisher !== null && previousItem && previousItem.network_operations_ecpm_publisher !== null) {
            // eCPM trend
            if (item.network_operations_ecpm_publisher > previousItem.network_operations_ecpm_publisher) {
              ecpmTrend = 'up';
              ecpmChangePercent = (((item.network_operations_ecpm_publisher - previousItem.network_operations_ecpm_publisher) / previousItem.network_operations_ecpm_publisher) * 100).toFixed(1);
            } else if (item.network_operations_ecpm_publisher < previousItem.network_operations_ecpm_publisher) {
              ecpmTrend = 'down';
              ecpmChangePercent = (((item.network_operations_ecpm_publisher - previousItem.network_operations_ecpm_publisher) / previousItem.network_operations_ecpm_publisher) * 100).toFixed(1);
            }
          }
          
          // Calculate trends for derived metrics
          let rpbrTrend = 'same';
          let rpbrChangePercent = 0;
          let fillRateTrend = 'same';
          let fillRateChangePercent = 0;
          let winRateTrend = 'same';
          let winRateChangePercent = 0;
          
          if (previousItem) {
            // RPBR trend
            if (item.rpbr !== null && previousItem.rpbr !== null && previousItem.rpbr !== 0) {
              if (item.rpbr > previousItem.rpbr) {
                rpbrTrend = 'up';
                rpbrChangePercent = (((item.rpbr - previousItem.rpbr) / previousItem.rpbr) * 100).toFixed(1);
              } else if (item.rpbr < previousItem.rpbr) {
                rpbrTrend = 'down';
                rpbrChangePercent = (((item.rpbr - previousItem.rpbr) / previousItem.rpbr) * 100).toFixed(1);
              }
            }
            
            // Fill Rate trend
            if (item.fillRate !== null && previousItem.fillRate !== null && previousItem.fillRate !== 0) {
              if (item.fillRate > previousItem.fillRate) {
                fillRateTrend = 'up';
                fillRateChangePercent = (((item.fillRate - previousItem.fillRate) / previousItem.fillRate) * 100).toFixed(1);
              } else if (item.fillRate < previousItem.fillRate) {
                fillRateTrend = 'down';
                fillRateChangePercent = (((item.fillRate - previousItem.fillRate) / previousItem.fillRate) * 100).toFixed(1);
              }
            }
            
            // Win Rate trend
            if (item.winRate !== null && previousItem.winRate !== null && previousItem.winRate !== 0) {
              if (item.winRate > previousItem.winRate) {
                winRateTrend = 'up';
                winRateChangePercent = (((item.winRate - previousItem.winRate) / previousItem.winRate) * 100).toFixed(1);
              } else if (item.winRate < previousItem.winRate) {
                winRateTrend = 'down';
                winRateChangePercent = (((item.winRate - previousItem.winRate) / previousItem.winRate) * 100).toFixed(1);
              }
            }
          }
          
          return {
            ...item,
            bidRequestsTrend,
            bidRequestsChangePercent,
            bidResponsesTrend,
            bidResponsesChangePercent,
            impressionsTrend,
            impressionsChangePercent,
            ecpmTrend,
            ecpmChangePercent,
            rpbrTrend,
            rpbrChangePercent,
            fillRateTrend,
            fillRateChangePercent,
            winRateTrend,
            winRateChangePercent
          };
        });
      } else if (viewMode === 'daily') {
        // No network operations data available, set all to null
        processedData = processedData.map((item) => ({
          ...item,
          network_operations_bid_requests: null,
          network_operations_bid_responses: null,
          network_operations_impressions: null,
          network_operations_ecpm_publisher: null,
          bidRequestsTrend: 'same',
          bidRequestsChangePercent: 0,
          bidResponsesTrend: 'same',
          bidResponsesChangePercent: 0,
          impressionsTrend: 'same',
          impressionsChangePercent: 0,
          ecpmTrend: 'same',
          ecpmChangePercent: 0,
          rpbr: null,
          fillRate: null,
          winRate: null,
          rpbrTrend: 'same',
          rpbrChangePercent: 0,
          fillRateTrend: 'same',
          fillRateChangePercent: 0,
          winRateTrend: 'same',
          winRateChangePercent: 0
        }));
      }

      console.log('Processed data with trends:', processedData);
      setAnalyticsData(processedData);

      // Calculate summary statistics
      const totalAdvertiserSpend = processedData.reduce((sum, item) => sum + item.PriceAdvertiser_PublisherSide, 0);
      const totalPublisherRevenue = processedData.reduce((sum, item) => sum + item.PricePublisher, 0);
      const totalMargin = totalAdvertiserSpend - totalPublisherRevenue;
      const avgMarginPercentage = (totalMargin / totalAdvertiserSpend * 100).toFixed(2);

      // Calculate yesterday's statistics for hourly view (full day totals)
      let yesterdayStats = {};
      if (viewMode === 'hourly') {
        // Calculate totals for the entire yesterday from all data
        const yesterdayTotalAdvertiserSpend = sortedData.reduce((sum, item) => {
          // Clean timestamp (using UTC+0 timezone)
          let cleanTimestamp = item.timestamp;
          cleanTimestamp = cleanTimestamp.replace(/\.\d{6}/, '');
          if (!cleanTimestamp.endsWith('Z') && !cleanTimestamp.includes('+')) {
            cleanTimestamp += 'Z';
          }
          
          const date = new Date(cleanTimestamp);
          // Use UTC+0 timezone (no adjustment)
          const adjustedDate = new Date(date.getTime());
          const yesterday = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
          const adjustedYesterday = new Date(yesterday.getTime());
          
          // Check if this item is from yesterday (full day)
          if (adjustedDate.toISOString().slice(0, 10) === adjustedYesterday.toISOString().slice(0, 10)) {
            return sum + item.PriceAdvertiser_PublisherSide;
          }
          return sum;
        }, 0);

        const yesterdayTotalPublisherRevenue = sortedData.reduce((sum, item) => {
          // Clean timestamp (using UTC+0 timezone)
          let cleanTimestamp = item.timestamp;
          cleanTimestamp = cleanTimestamp.replace(/\.\d{6}/, '');
          if (!cleanTimestamp.endsWith('Z') && !cleanTimestamp.includes('+')) {
            cleanTimestamp += 'Z';
          }
          
          const date = new Date(cleanTimestamp);
          // Use UTC+0 timezone (no adjustment)
          const adjustedDate = new Date(date.getTime());
          const yesterday = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
          const adjustedYesterday = new Date(yesterday.getTime());
          
          // Check if this item is from yesterday (full day)
          if (adjustedDate.toISOString().slice(0, 10) === adjustedYesterday.toISOString().slice(0, 10)) {
            return sum + item.PricePublisher;
          }
          return sum;
        }, 0);

        const yesterdayTotalMargin = yesterdayTotalAdvertiserSpend - yesterdayTotalPublisherRevenue;
        const yesterdayAvgMarginPercentage = yesterdayTotalAdvertiserSpend > 0 ? 
          (yesterdayTotalMargin / yesterdayTotalAdvertiserSpend * 100).toFixed(2) : 0;

        yesterdayStats = {
          yesterdayTotalAdvertiserSpend,
          yesterdayTotalPublisherRevenue,
          yesterdayTotalMargin,
          yesterdayAvgMarginPercentage
        };
      }

      setSummaryStats({
        totalAdvertiserSpend,
        totalPublisherRevenue,
        totalMargin,
        avgMarginPercentage,
        dataPoints: processedData.length,
        ...yesterdayStats
      });

      setLastRefresh(new Date());

    } catch (err) {
      setError(formatError(err, null));
    } finally {
      setLoading(false);
    }
  };

  // Fetch network operations data
  const fetchNetworkOperationsData = async (startDateValue, endDateValue) => {
    try {
      const token = getToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      // Format dates in UTC for network operations API
      // The API expects dates in ISO format with UTC timezone
      const beginDateISO = startDateValue.toISOString();
      const endDateISO = endDateValue.toISOString();

      const payload = {
        "Datasource": "network_operations",
        "Metrics": [
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
        "Dimensions": [],
        "TimeZone": "Etc/GMT", // UTC timezone
        "Granularity": {
          "type": "period",
          "period": "P1D"
        },
        "Intervals": [{
          "Begin": beginDateISO,
          "End": endDateISO
        }]
      };

      // Log API call details for daily mode
      console.log('🟢 NETWORK OPERATIONS API Call (Daily mode only):');
      console.log('  📅 Date Range:', beginDateISO, 'to', endDateISO);
      console.log('  📤 Payload:', JSON.stringify(payload, null, 2));
      console.log('  🌐 Endpoint:', API_ENDPOINTS.DRUID_SEARCH);

      const response = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ayl-auth-token": token
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        console.error('Error fetching network operations data:', formatError(error, response));
        setNetworkOperationsData(null);
        return null;
      }

      const data = await response.json();
      
      console.log('  📥 Network Operations Response:', data);

      setNetworkOperationsData(data);
      return data;
    } catch (err) {
      console.error('Error fetching network operations data:', err);
      // Don't set error state here, just log it so it doesn't break the main flow
      setNetworkOperationsData(null);
      return null;
    }
  };

  const formatCurrency = formatCurrencyChart;

  const formatNumber = (value) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format((value || 0) / 1000000);
  };

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
    const viewabilityRate = typeof item.network_operations_viewability_rate === 'number'
      ? item.network_operations_viewability_rate * 100
      : 0;

    return {
      ...item,
      ecpmAdvertiser,
      ecpmPublisher,
      winRate,
      fillRate,
      viewabilityRate
    };
  });

  const clickCtrChartData = analyticsData.map((item) => {
    const impressions = item.network_operations_impressions ?? item.IMPRESSION ?? item.impression ?? 0;
    const clicks = item.network_operations_click ?? item.CLICK ?? item.click ?? 0;
    const ctr = typeof item.ctr === 'number' ? item.ctr : (impressions > 0 ? (clicks / impressions) * 100 : 0);
    return {
      ...item,
      clicks,
      ctr
    };
  });

  // Fetch hourly data for a specific date
  const fetchHourlyDataForDate = async (dateString) => {
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
      "Intervals": [{
        "Begin": startDateValue.toISOString(),
        "End": endDateValue.toISOString()
      }],
      "Metrics": ["PricePublisher", "PriceAdvertiser_PublisherSide"],
      "Granularity": {
        "type": "period",
        "period": "PT1H"
      },
      "Datasource": "adserver_stats",
      "TimeZone": "Etc/GMT"
    };

    const response = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ayl-auth-token": token
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = new Error(`HTTP error! status: ${response.status}`);
      throw error;
    }

    const data = await response.json();
    
    // Process hourly data similar to hourly view
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
        marginPercentage: ((item.PriceAdvertiser_PublisherSide - item.PricePublisher) / item.PriceAdvertiser_PublisherSide * 100).toFixed(2)
      };
    });
  };

  // Fetch device data from Druid API
  const fetchDeviceData = async () => {
    setLoadingDeviceData(true);
    try {
      const token = getToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      // Use the same date range as the main analytics
      let startDateValue, endDateValue;
      
      if (startDate && endDate) {
        startDateValue = new Date(startDate + 'T00:00:00.000Z');
        endDateValue = new Date(endDate + 'T23:59:59.000Z');
      } else {
        const now = new Date();
        startDateValue = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDateValue.setUTCHours(0, 0, 0, 0);
        endDateValue = new Date(now);
        endDateValue.setUTCHours(23, 59, 59, 999);
      }

      // Use DEVICE dimension with granularity "all"
      const payload = {
        "Intervals": [{
          "Begin": startDateValue.toISOString(),
          "End": endDateValue.toISOString()
        }],
        "Metrics": ["PricePublisher", "PriceAdvertiser_PublisherSide"],
        "Dimensions": ["DEVICE"],
        "Granularity": "all",
        "Datasource": "adserver_stats",
        "TimeZone": "Etc/GMT"
      };

      console.log('📤 Fetching device data with dimension: DEVICE');
      console.log('📤 API Payload:', JSON.stringify(payload, null, 2));

      const response = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ayl-auth-token": token
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        setError(formatError(error, response));
        setLoadingDeviceDetail(false);
        return;
      }

      const deviceDataResult = await response.json();
      console.log('✅ Device data fetched successfully', deviceDataResult);
      console.log('📊 Full device data response:', JSON.stringify(deviceDataResult, null, 2));

      // Extract the Data array from the response object
      const dataArray = Array.isArray(deviceDataResult?.Data) 
        ? deviceDataResult.Data 
        : Array.isArray(deviceDataResult) 
          ? deviceDataResult 
          : [];

      console.log('📊 Device data array:', dataArray);
      console.log('📊 Number of items:', dataArray.length);

      // Process and sort data
      const processedData = dataArray
        .map((item) => {
          // Use Device (with capital D) as shown in the API response
          const deviceName = item.Device || item.DEVICE || 'Unknown';
          const dspRevenue = item.PriceAdvertiser_PublisherSide || 0;
          const publisherCosts = item.PricePublisher || 0;
          const margin = dspRevenue - publisherCosts;
          const marginPercentage = dspRevenue > 0 
            ? ((margin / dspRevenue) * 100).toFixed(2)
            : '0.00';
          
          return {
            ...item,
            device: deviceName,
            date: item.timestamp ? new Date(item.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A',
            PriceAdvertiser_PublisherSide: dspRevenue,
            PricePublisher: publisherCosts,
            margin: margin,
            marginPercentage: marginPercentage
          };
        })
        .sort((a, b) => {
          // Sort by DSP Revenue (descending)
          return (b.PriceAdvertiser_PublisherSide || 0) - (a.PriceAdvertiser_PublisherSide || 0);
        });

      setDeviceData(processedData);
    } catch (err) {
      console.error('Error fetching device data:', err);
      setError(formatError(err, null));
      setDeviceData([]);
    } finally {
      setLoadingDeviceData(false);
    }
  };

  // Fetch detailed device data by date for a specific device
  const fetchDeviceDetailData = async (deviceName) => {
    setLoadingDeviceDetail(true);
    try {
      const token = getToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      // Use effective dates (Today when Real-time, else selected range)
      const dates = getEffectiveDatesForFilterPanels();
      const startDateValue = new Date(dates.start + 'T00:00:00.000Z');
      const endDateValue = new Date(dates.end + 'T23:59:59.999Z');
      
      console.log('📅 Device detail date range:', {
        start: dates.start,
        end: dates.end,
        startDateValue: startDateValue.toISOString(),
        endDateValue: endDateValue.toISOString()
      });

      // Fetch data with DEVICE dimension and daily granularity
      const payload = {
        "Intervals": [{
          "Begin": startDateValue.toISOString(),
          "End": endDateValue.toISOString()
        }],
        "Metrics": ["PricePublisher", "PriceAdvertiser_PublisherSide"],
        "Dimensions": ["DEVICE"],
        "Granularity": {
          "type": "period",
          "period": "P1D"
        },
        "Datasource": "adserver_stats",
        "TimeZone": "Etc/GMT",
        "Size": 500
      };

      console.log('📤 Fetching device detail data for:', deviceName);
      console.log('📤 API Payload:', JSON.stringify(payload, null, 2));

      const response = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ayl-auth-token": token
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        setError(formatError(error, response));
        setLoadingDeviceDetail(false);
        return;
      }

      const result = await response.json();
      console.log('✅ Device detail data fetched successfully', result);
      console.log('📊 Full device detail response:', JSON.stringify(result, null, 2));

      // Extract the Data array from the response object
      const dataArray = Array.isArray(result?.Data) 
        ? result.Data 
        : Array.isArray(result) 
          ? result 
          : [];

      console.log('📊 Device detail data array (before filter):', dataArray);
      console.log('📊 Number of items before filter:', dataArray.length);
      console.log('📊 Looking for device:', deviceName);

      // Filter by device name and process data
      const filteredData = dataArray.filter((item) => {
        const itemDevice = item.Device || item.DEVICE || '';
        console.log('📊 Comparing:', itemDevice, '===', deviceName, '?', itemDevice === deviceName);
        return itemDevice === deviceName;
      });

      console.log('📊 Filtered data:', filteredData);
      console.log('📊 Number of items after filter:', filteredData.length);

      const processedData = filteredData
        .map((item) => {
          const dspRevenue = item.PriceAdvertiser_PublisherSide || 0;
          const publisherCosts = item.PricePublisher || 0;
          const margin = dspRevenue - publisherCosts;
          const marginPercentage = dspRevenue > 0 
            ? ((margin / dspRevenue) * 100).toFixed(2)
            : '0.00';
          
          // Format date properly
          let formattedDate = 'N/A';
          if (item.timestamp) {
            try {
              // Clean timestamp - handle various formats like '2025-11-20T00:00:00.000000.000Z'
              let cleanTimestamp = item.timestamp;
              // Remove all microseconds patterns (e.g., .000000.000 or .000000)
              cleanTimestamp = cleanTimestamp.replace(/\.\d{6}(\.\d{3})?/g, '');
              // Ensure it ends with Z if it doesn't have timezone info
              if (!cleanTimestamp.endsWith('Z') && !cleanTimestamp.includes('+') && !cleanTimestamp.includes('-', 10)) {
                cleanTimestamp += 'Z';
              }
              // If there's still a dot before Z, remove it (e.g., .000Z -> Z)
              cleanTimestamp = cleanTimestamp.replace(/\.(\d{3})?Z$/, 'Z');
              
              const date = new Date(cleanTimestamp);
              if (!isNaN(date.getTime())) {
                formattedDate = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
              } else {
                console.warn('Invalid date after cleaning:', cleanTimestamp, 'Original:', item.timestamp);
              }
            } catch (e) {
              console.error('Error formatting date:', item.timestamp, e);
            }
          }
          
          return {
            ...item,
            device: deviceName,
            date: formattedDate,
            timestamp: item.timestamp,
            PriceAdvertiser_PublisherSide: dspRevenue,
            PricePublisher: publisherCosts,
            margin: margin,
            marginPercentage: marginPercentage
          };
        })
        .sort((a, b) => {
          // Sort by date (ascending)
          if (a.timestamp && b.timestamp) {
            return new Date(a.timestamp) - new Date(b.timestamp);
          }
          return 0;
        });

      setDeviceDetailData(processedData);
    } catch (err) {
      console.error('Error fetching device detail data:', err);
      setError(formatError(err, null));
      setDeviceDetailData([]);
    } finally {
      setLoadingDeviceDetail(false);
    }
  };

  // Fetch DSP data from Druid API
  const fetchDspData = async () => {
    setLoadingDspData(true);
    try {
      const token = getToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      // Use the same date range as the main analytics
      let startDateValue, endDateValue;
      
      if (startDate && endDate) {
        startDateValue = new Date(startDate + 'T00:00:00.000Z');
        endDateValue = new Date(endDate + 'T23:59:59.000Z');
      } else {
        const now = new Date();
        startDateValue = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDateValue.setUTCHours(0, 0, 0, 0);
        endDateValue = new Date(now);
        endDateValue.setUTCHours(23, 59, 59, 999);
      }

      // Use the same payload structure as DSPDashboard
      // Format dates in UTC like DSPDashboard
      const beginDate = new Date(startDateValue.toISOString()).toISOString().replace('Z', '+00:00');
      const endDateFormatted = new Date(endDateValue.toISOString()).toISOString().replace('Z', '+00:00');

      const payload = {
        "Intervals": [{"Begin": beginDate, "End": endDateFormatted}],
        "Operator": "in",
        "OrderBy": "PricePublisher",
        "OrderOp": "DESC",
        "Dimensions": ["Partner"],
        "Size": 500,
        "Metrics": ["PricePublisher", "PriceAdvertiser_PublisherSide", "PartnerName"],
        "View": "ADVANCED_PUBLISHER",
        "Datasource": "adserver_stats",
        "AddTotalRow": true,
        "TimeZone": "Etc/GMT",
        "Granularity": "all"
      };

      console.log('📤 Fetching DSP data with dimension: PartnerName');
      console.log('📤 API Payload:', JSON.stringify(payload, null, 2));

      const response = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ayl-auth-token": token
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        setError(formatError(error, response));
        setLoadingDeviceDetail(false);
        return;
      }

      const dspDataResult = await response.json();
      console.log('✅ DSP data fetched successfully', dspDataResult);
      console.log('📊 Full DSP data response:', JSON.stringify(dspDataResult, null, 2));

      // Extract the Data array from the response object
      const dataArray = Array.isArray(dspDataResult?.Data) 
        ? dspDataResult.Data 
        : Array.isArray(dspDataResult) 
          ? dspDataResult 
          : [];

      console.log('📊 DSP data array:', dataArray);
      console.log('📊 Number of items:', dataArray.length);
      console.log('📊 First item sample:', dataArray[0]);

      // Process data using the same logic as DSPDashboard
      const processedData = dataArray
        .map((item) => {
          // Partner is the dimension (ID), PartnerName is in metrics
          const partnerId = item.Partner || item.partnerId || 'Unknown';
          const partnerName = item.Name_Partner || item.PartnerName || item.partnerName || 'Unknown DSP';
          const dspRevenue = item.PriceAdvertiser_PublisherSide || 0;
          const publisherCosts = item.PricePublisher || 0;
          const margin = dspRevenue - publisherCosts;
          const marginPercentage = dspRevenue > 0 
            ? ((margin / dspRevenue) * 100).toFixed(2)
            : '0.00';
          
          console.log('📊 Processing DSP item:', {
            original: item,
            partnerId,
            partnerName,
            dspRevenue,
            publisherCosts
          });
          
          return {
            ...item,
            partnerId: partnerId,
            partnerName: partnerName,
            PriceAdvertiser_PublisherSide: dspRevenue,
            PricePublisher: publisherCosts,
            margin: margin,
            marginPercentage: marginPercentage
          };
        })
        .sort((a, b) => {
          // Sort by DSP Revenue (descending) - data should already be sorted by API but we ensure it
          return (b.PriceAdvertiser_PublisherSide || 0) - (a.PriceAdvertiser_PublisherSide || 0);
        });

      console.log('📊 Processed DSP data:', processedData);
      console.log('📊 Number of processed items:', processedData.length);
      setDspData(processedData);
    } catch (err) {
      console.error('Error fetching DSP data:', err);
      setError(formatError(err, null));
      setDspData([]);
    } finally {
      setLoadingDspData(false);
    }
  };

  // Fetch detailed DSP data by date for a specific DSP
  const fetchDspDetailData = async (partnerId) => {
    setLoadingDspDetail(true);
    try {
      const token = getToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      // Use effective dates (Today when Real-time, else selected range)
      const dates = getEffectiveDatesForFilterPanels();
      const startDateValue = new Date(dates.start + 'T00:00:00.000Z');
      const endDateValue = new Date(dates.end + 'T23:59:59.000Z');
      const beginDate = startDateValue.toISOString();
      const endDateFormatted = endDateValue.toISOString();
      
      console.log('📅 DSP detail date range:', {
        start: dates.start,
        end: dates.end,
        beginDate,
        endDateFormatted,
        partnerId
      });

      // Fetch data with Partner dimension (using Partner ID) and daily granularity
      const payload = {
        "Filters": {
          "Partner": {
            "Value": [partnerId],
            "Operator": "in"
          }
        },
        "Intervals": [{
          "Begin": beginDate,
          "End": endDateFormatted
        }],
        "Metrics": ["PricePublisher", "PriceAdvertiser_PublisherSide"],
        "Granularity": {
          "type": "period",
          "period": "P1D"
        },
        "View": "ADVANCED_PUBLISHER",
        "Datasource": "adserver_stats",
        "TimeZone": "Etc/GMT"
      };

      console.log('📤 Fetching DSP detail data for Partner ID:', partnerId);
      console.log('📤 API Payload:', JSON.stringify(payload, null, 2));

      const response = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ayl-auth-token": token
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        setError(formatError(error, response));
        setLoadingDeviceDetail(false);
        return;
      }

      const dspDetailResult = await response.json();
      console.log('✅ DSP detail data fetched successfully', dspDetailResult);

      // Extract the Data array from the response object
      const dataArray = Array.isArray(dspDetailResult?.Data) 
        ? dspDetailResult.Data 
        : Array.isArray(dspDetailResult) 
          ? dspDetailResult 
          : [];

      // Process data and format dates
      const processedData = dataArray
        .map((item) => {
          const dspRevenue = item.PriceAdvertiser_PublisherSide || 0;
          const publisherCosts = item.PricePublisher || 0;
          const margin = dspRevenue - publisherCosts;
          const marginPercentage = dspRevenue > 0 
            ? ((margin / dspRevenue) * 100).toFixed(2)
            : '0.00';
          
          // Extract date from timestamp (handle format like "2025-11-20T00:00:00.000000.000Z")
          let dateStr = 'Unknown';
          if (item.timestamp) {
            try {
              // Clean timestamp - handle various formats like '2025-11-20T00:00:00.000000.000Z'
              let cleanTimestamp = item.timestamp;
              // Remove all microseconds patterns (e.g., .000000.000 or .000000)
              cleanTimestamp = cleanTimestamp.replace(/\.\d{6}(\.\d{3})?/g, '');
              // Ensure it ends with Z if it doesn't have timezone info
              if (!cleanTimestamp.endsWith('Z') && !cleanTimestamp.includes('+') && !cleanTimestamp.includes('-', 10)) {
                cleanTimestamp += 'Z';
              }
              // If there's still a dot before Z, remove it (e.g., .000Z -> Z)
              cleanTimestamp = cleanTimestamp.replace(/\.(\d{3})?Z$/, 'Z');
              
              const date = new Date(cleanTimestamp);
              if (!isNaN(date.getTime())) {
                dateStr = date.toISOString().split('T')[0];
              } else {
                console.warn('Invalid date after cleaning:', cleanTimestamp, 'Original:', item.timestamp);
              }
            } catch (e) {
              console.error('Error formatting date:', item.timestamp, e);
            }
          } else if (item.date) {
            dateStr = item.date;
          }
          
          return {
            ...item,
            date: dateStr,
            PriceAdvertiser_PublisherSide: dspRevenue,
            PricePublisher: publisherCosts,
            margin: margin,
            marginPercentage: marginPercentage
          };
        })
        .sort((a, b) => {
          // Sort by date ascending
          return new Date(a.date) - new Date(b.date);
        });

      console.log('📊 Processed DSP detail data:', processedData);
      setDspDetailData(processedData);
    } catch (err) {
      console.error('Error fetching DSP detail data:', err);
      setError(formatError(err, null));
      setDspDetailData([]);
    } finally {
      setLoadingDspDetail(false);
    }
  };

  // Handle DSP row click
  const handleDspRowClick = async (partnerId, partnerName) => {
    if (selectedDsp === partnerId) {
      // If already selected, deselect
      setSelectedDsp(null);
      setDspDetailData([]);
    } else {
      // Select new DSP and fetch detail data
      setSelectedDsp(partnerId);
      await fetchDspDetailData(partnerId);
    }
  };

  // Fetch SEAT data from Druid API
  const fetchSeatData = async () => {
    setLoadingSeatData(true);
    try {
      const token = getToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      // Use the same date range as the main analytics
      let startDateValue, endDateValue;
      
      if (startDate && endDate) {
        startDateValue = new Date(startDate + 'T00:00:00.000Z');
        endDateValue = new Date(endDate + 'T23:59:59.000Z');
      } else {
        const now = new Date();
        startDateValue = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDateValue.setUTCHours(0, 0, 0, 0);
        endDateValue = new Date(now);
        endDateValue.setUTCHours(23, 59, 59, 999);
      }

      // Use SeatId dimension with SeatName and partner_name in metrics and granularity "all"
      const payload = {
        "Intervals": [{
          "Begin": startDateValue.toISOString(),
          "End": endDateValue.toISOString()
        }],
        "Metrics": ["PricePublisher", "PriceAdvertiser_PublisherSide", "SeatName", "partner_name"],
        "Dimensions": ["SeatId"],
        "Granularity": "all",
        "Datasource": "adserver_stats",
        "TimeZone": "Etc/GMT",
        "Size": 250,
        "OrderBy": "PriceAdvertiser_PublisherSide",
        "OrderOp": "DESC"
      };

      console.log('📤 Fetching SEAT data with dimension: SeatId');
      console.log('📤 API Payload:', JSON.stringify(payload, null, 2));

      const response = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ayl-auth-token": token
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        setError(formatError(error, response));
        setLoadingDeviceDetail(false);
        return;
      }

      const seatDataResult = await response.json();
      console.log('✅ SEAT data fetched successfully', seatDataResult);
      console.log('📊 Full SEAT data response:', JSON.stringify(seatDataResult, null, 2));

      // Extract the Data array from the response object
      const dataArray = Array.isArray(seatDataResult?.Data) 
        ? seatDataResult.Data 
        : Array.isArray(seatDataResult) 
          ? seatDataResult 
          : [];

      console.log('📊 SEAT data array:', dataArray);
      console.log('📊 Number of items:', dataArray.length);

      // Process and sort data
      const processedData = dataArray
        .map((item) => {
          const seatId = item.SeatId || 'Unknown';
          const seatName = item.Name_Seat || item.SeatName || item.seatName || null;
          const partnerName = item.Name_Partner || item.partner_name || item.PartnerName || item.partnerName || 'Unknown';
          const dspRevenue = item.PriceAdvertiser_PublisherSide || 0;
          const publisherCosts = item.PricePublisher || 0;
          const margin = dspRevenue - publisherCosts;
          const marginPercentage = dspRevenue > 0 
            ? ((margin / dspRevenue) * 100).toFixed(2)
            : '0.00';
          
          console.log('📊 Processing SEAT item:', {
            original: item,
            seatId,
            seatName,
            partnerName,
            dspRevenue,
            publisherCosts
          });
          
          return {
            ...item,
            seatId: seatId,
            seatName: seatName,
            partnerName: partnerName,
            PriceAdvertiser_PublisherSide: dspRevenue,
            PricePublisher: publisherCosts,
            margin: margin,
            marginPercentage: marginPercentage
          };
        })
        .filter((item) => {
          // Filter out items without seatName
          return item.seatName && item.seatName !== 'Unknown' && item.seatName.trim() !== '';
        })
        .sort((a, b) => {
          // Sort by DSP Revenue (descending)
          return (b.PriceAdvertiser_PublisherSide || 0) - (a.PriceAdvertiser_PublisherSide || 0);
        });

      console.log('📊 Processed SEAT data:', processedData);
      console.log('📊 Number of processed items:', processedData.length);
      setSeatData(processedData);
    } catch (err) {
      console.error('Error fetching SEAT data:', err);
      setError(formatError(err, null));
      setSeatData([]);
    } finally {
      setLoadingSeatData(false);
    }
  };

  // Fetch AD DOMAIN data from Druid API
  const fetchAdDomainData = async () => {
    setLoadingAdDomainData(true);
    try {
      const token = getToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      // Use the same date range as the main analytics
      let startDateValue, endDateValue;
      
      if (startDate && endDate) {
        startDateValue = new Date(startDate + 'T00:00:00.000Z');
        endDateValue = new Date(endDate + 'T23:59:59.000Z');
      } else {
        const now = new Date();
        startDateValue = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDateValue.setUTCHours(0, 0, 0, 0);
        endDateValue = new Date(now);
        endDateValue.setUTCHours(23, 59, 59, 999);
      }

      // Use AdDomains dimension with granularity "all"
      const payload = {
        "Intervals": [{
          "Begin": startDateValue.toISOString(),
          "End": endDateValue.toISOString()
        }],
        "Metrics": ["PricePublisher", "PriceAdvertiser_PublisherSide", "partner_name"],
        "Dimensions": ["AdDomains"],
        "Granularity": "all",
        "Datasource": "adserver_stats",
        "TimeZone": "Etc/GMT",
        "Size": 250,
        "OrderBy": "PriceAdvertiser_PublisherSide",
        "OrderOp": "DESC"
      };

      console.log('📤 Fetching AD DOMAIN data with dimension: AdDomains');
      console.log('📤 API Payload:', JSON.stringify(payload, null, 2));

      const response = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ayl-auth-token": token
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        setError(formatError(error, response));
        setLoadingDeviceDetail(false);
        return;
      }

      const adDomainDataResult = await response.json();
      console.log('✅ AD DOMAIN data fetched successfully', adDomainDataResult);
      console.log('📊 Full AD DOMAIN data response:', JSON.stringify(adDomainDataResult, null, 2));

      // Extract the Data array from the response object
      const dataArray = Array.isArray(adDomainDataResult?.Data) 
        ? adDomainDataResult.Data 
        : Array.isArray(adDomainDataResult) 
          ? adDomainDataResult 
          : [];

      console.log('📊 AD DOMAIN data array:', dataArray);
      console.log('📊 Number of items:', dataArray.length);

      // Process and sort data
      const processedData = dataArray
        .map((item) => {
          const adDomain = item.AdDomains || item.adDomains || 'Unknown';
          const partnerName = item.Name_Partner || item.partner_name || item.PartnerName || item.partnerName || 'Unknown';
          const dspRevenue = item.PriceAdvertiser_PublisherSide || 0;
          const publisherCosts = item.PricePublisher || 0;
          const margin = dspRevenue - publisherCosts;
          const marginPercentage = dspRevenue > 0 
            ? ((margin / dspRevenue) * 100).toFixed(2)
            : '0.00';
          
          console.log('📊 Processing AD DOMAIN item:', {
            original: item,
            adDomain,
            partnerName,
            dspRevenue,
            publisherCosts
          });
          
          return {
            ...item,
            adDomain: adDomain,
            partnerName: partnerName,
            PriceAdvertiser_PublisherSide: dspRevenue,
            PricePublisher: publisherCosts,
            margin: margin,
            marginPercentage: marginPercentage
          };
        })
        .sort((a, b) => {
          // Sort by DSP Revenue (descending)
          return (b.PriceAdvertiser_PublisherSide || 0) - (a.PriceAdvertiser_PublisherSide || 0);
        });

      console.log('📊 Processed AD DOMAIN data:', processedData);
      console.log('📊 Number of processed items:', processedData.length);
      setAdDomainData(processedData);
    } catch (err) {
      console.error('Error fetching AD DOMAIN data:', err);
      setError(formatError(err, null));
      setAdDomainData([]);
    } finally {
      setLoadingAdDomainData(false);
    }
  };

  // Fetch SITE DOMAIN data from Druid API
  // Fetch AD KIND data from Druid API
  // Helper function to map adKind values to display names
  const getAdKindDisplayName = (adKind) => {
    const adKindMap = {
      'AD_TRAFFIC': 'NATIVE DISPLAY',
      'AD_OUTSTREAM': 'OUTSTREAM',
      'AD_INSTREAM': 'INSTREAM',
      'AD_RAW_VIDEO': 'VIDEO IN BANNER',
      'AD_VIDEO': 'NATIVE VIDEO',
      'AD_BANNER': 'DISPLAY'
    };
    return adKindMap[adKind] || adKind;
  };

  const fetchAdKindData = async () => {
    setLoadingAdKindData(true);
    try {
      const token = getToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      // Use the same date range as the main analytics
      let startDateValue, endDateValue;
      
      if (startDate && endDate) {
        startDateValue = new Date(startDate + 'T00:00:00.000Z');
        endDateValue = new Date(endDate + 'T23:59:59.000Z');
      } else {
        const now = new Date();
        startDateValue = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDateValue.setUTCHours(0, 0, 0, 0);
        endDateValue = new Date(now);
        endDateValue.setUTCHours(23, 59, 59, 999);
      }

      const payload = {
        "Intervals": [{
          "Begin": startDateValue.toISOString(),
          "End": endDateValue.toISOString()
        }],
        "Metrics": ["network_operations_impressions", "network_operations_price_publisher", "network_operations_price_advertiser"],
        "Dimensions": ["adKind"],
        "Granularity": "all",
        "Datasource": "network_operations",
        "TimeZone": "Etc/GMT"
      };

      console.log('📤 Fetching AD KIND data with dimension: adKind');
      console.log('📤 API Payload:', JSON.stringify(payload, null, 2));

      const response = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ayl-auth-token": token
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        setError(formatError(error, response));
        setLoadingDeviceDetail(false);
        return;
      }

      const adKindDataResult = await response.json();
      console.log('✅ AD KIND data fetched successfully', adKindDataResult);

      // Extract the Data array from the response object
      const dataArray = Array.isArray(adKindDataResult?.Data) 
        ? adKindDataResult.Data 
        : Array.isArray(adKindDataResult) 
          ? adKindDataResult 
          : [];

      // Process and sort data
      const processedData = dataArray
        .filter((item) => {
          // Remove items with Unknown adKind
          const adKind = item.adKind;
          return adKind && adKind !== 'Unknown' && adKind !== 'unknown';
        })
        .map((item) => {
          const adKind = item.adKind;
          const dspRevenue = item.network_operations_price_advertiser || 0;
          const publisherCosts = item.network_operations_price_publisher || 0;
          const impressions = item.network_operations_impressions || 0;
          const margin = dspRevenue - publisherCosts;
          const marginPercentage = dspRevenue > 0 
            ? ((margin / dspRevenue) * 100).toFixed(2)
            : '0.00';
          
          return {
            ...item,
            adKind: adKind,
            adKindDisplay: getAdKindDisplayName(adKind),
            PriceAdvertiser_PublisherSide: dspRevenue,
            PricePublisher: publisherCosts,
            impressions: impressions,
            margin: margin,
            marginPercentage: marginPercentage
          };
        })
        .sort((a, b) => (b.PriceAdvertiser_PublisherSide || 0) - (a.PriceAdvertiser_PublisherSide || 0));

      setAdKindData(processedData);
    } catch (err) {
      console.error('Error fetching AD KIND data:', err);
      setError(formatError(err, null));
      setAdKindData([]);
    } finally {
      setLoadingAdKindData(false);
    }
  };

  // Fetch GEO data from Druid API
  const fetchGeoData = async () => {
    setLoadingGeoData(true);
    try {
      const token = getToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      // Use the same date range as the main analytics
      let startDateValue, endDateValue;

      if (startDate && endDate) {
        startDateValue = new Date(startDate + 'T00:00:00.000Z');
        endDateValue = new Date(endDate + 'T23:59:59.000Z');
      } else {
        const now = new Date();
        startDateValue = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDateValue.setUTCHours(0, 0, 0, 0);
        endDateValue = new Date(now);
        endDateValue.setUTCHours(23, 59, 59, 999);
      }

      const payload = {
        "Intervals": [{
          "Begin": startDateValue.toISOString(),
          "End": endDateValue.toISOString()
        }],
        "Metrics": ["PricePublisher", "PriceAdvertiser_PublisherSide", "CLICK", "IMPRESSION"],
        "Dimensions": ["Country"],
        "Granularity": "all",
        "Datasource": "adserver_stats",
        "TimeZone": "Etc/GMT",
        "Size": 250,
        "OrderBy": "PriceAdvertiser_PublisherSide",
        "OrderOp": "DESC"
      };

      const response = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ayl-auth-token": token
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        setError(formatError(error, response));
        setGeoData([]);
        return;
      }

      const result = await response.json();
      const dataArray = Array.isArray(result?.Data) ? result.Data : Array.isArray(result) ? result : [];

      const processedData = dataArray
        .map((item) => {
          const country = item.Country || 'Unknown';
          const dspRevenue = item.PriceAdvertiser_PublisherSide || 0;
          const publisherCosts = item.PricePublisher || 0;
          const impressions = item.IMPRESSION ?? item.Impression ?? 0;
          const clicks = item.CLICK ?? item.Click ?? 0;
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          const margin = dspRevenue - publisherCosts;
          const marginPercentage = dspRevenue > 0 ? ((margin / dspRevenue) * 100).toFixed(2) : '0.00';

          return {
            ...item,
            country: country,
            PriceAdvertiser_PublisherSide: dspRevenue,
            PricePublisher: publisherCosts,
            impressions,
            clicks,
            ctr,
            margin: margin,
            marginPercentage: marginPercentage
          };
        })
        .sort((a, b) => (b.PriceAdvertiser_PublisherSide || 0) - (a.PriceAdvertiser_PublisherSide || 0));

      setGeoData(processedData);
    } catch (err) {
      console.error('Error fetching GEO data:', err);
      setError(formatError(err, null));
      setGeoData([]);
    } finally {
      setLoadingGeoData(false);
    }
  };

  // --- Business Review (global OVERVIEW) helpers (copied/adapted from DSPDashboard / AnalyticsTemplate) ---

  const normalizeTimestampForBR = (timestamp) => {
    if (!timestamp) return null;
    try {
      let normalized = timestamp.toString().trim();
      // Fix invalid formats like "2023-10-31T00:00:00.000000.000Z"
      normalized = normalized.replace(/\.(\d{6})\.(\d{3})Z$/i, '.$2Z');
      const date = new Date(normalized);
      if (isNaN(date.getTime())) {
        const match = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
        return match ? match[1] : null;
      }
      return date.toISOString().split('T')[0];
    } catch {
      const match = timestamp.toString().match(/^(\d{4}-\d{2}-\d{2})/);
      return match ? match[1] : null;
    }
  };

  const processBusinessReviewDataBR = (rawData) => {
    const grouped = {};
    rawData.forEach((item) => {
      if (!item.adKind) return;
      const adKind = item.adKind;
      const date = normalizeTimestampForBR(item.timestamp);
      if (!date) return;
      const key = `${adKind}_${date}`;
      if (!grouped[key]) {
        grouped[key] = {
          adKind,
          date,
          bidRequests: 0,
          bidResponses: 0,
          impressions: 0,
          clicks: 0,
          pricePublisher: 0,
          priceAdvertiser: 0,
        };
      }
      grouped[key].bidRequests += item.network_operations_bid_requests || 0;
      grouped[key].bidResponses += item.network_operations_bid_responses || 0;
      grouped[key].impressions += item.network_operations_impressions || 0;
      grouped[key].clicks += item.network_operations_click || 0;
      grouped[key].pricePublisher += item.network_operations_price_publisher || 0;
      grouped[key].priceAdvertiser += item.network_operations_price_advertiser || 0;
    });
    return Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const PIE_COLORS_BR = [
    '#3B82F6',
    '#10B981',
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
    '#EC4899',
    '#06B6D4',
    '#F97316',
  ];

  const formatBidResponsesBR = (value) => {
    if (value >= 1000000000) {
      const billions = (value / 1000000000).toFixed(2);
      return `${billions.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}B`;
    }
    if (value >= 1000000) {
      const millions = (value / 1000000).toFixed(2);
      return `${millions.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}M`;
    }
    if (value >= 1000) {
      const thousands = (value / 1000).toFixed(2);
      return `${thousands.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}K`;
    }
    return value.toLocaleString('fr-FR', { useGrouping: true }).replace(/,/g, ' ');
  };

  const formatCurrencyBR = (value) => {
    if (value >= 1000000) {
      const millions = (value / 1000000).toFixed(2);
      return `$${millions.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}M`;
    }
    if (value >= 1000) {
      const thousands = (value / 1000).toFixed(2);
      return `$${thousands.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}K`;
    }
    return `$${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
  };

  const formatCurrencyDetailedBR = (value) => {
    if (value >= 1000000) {
      const millions = (value / 1000000).toFixed(2);
      return `$${millions.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}M`;
    }
    if (value >= 1000) {
      const thousands = (value / 1000).toFixed(2);
      return `$${thousands.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}K`;
    }
    return `$${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
  };

  const fetchBusinessReviewGlobal = async () => {
    setLoadingBusinessReview(true);
    setBusinessReviewError(null);

    try {
      const response = await fetch('/data/DSP/business-review-general.json');
      if (!response.ok) {
        const error = new Error(`Failed to load Business Review data: ${response.status} ${response.statusText}`);
        setBusinessReviewError(formatError(error, response));
        setBusinessReviewData(null);
        return;
      }
      const data = await response.json();
      const processedData = processBusinessReviewDataBR(data.data || []);
      setBusinessReviewData({ ...data, processedData });
    } catch (err) {
      console.error('Error loading global Business Review data:', err);
      setBusinessReviewError(formatError(err, null));
      setBusinessReviewData(null);
    } finally {
      setLoadingBusinessReview(false);
    }
  };

  // Export Business Review data to PDF (Global)
  const exportBusinessReviewGlobalToPDF = async (viewMode = 'month', selectedMonth = null, selectedYear = null) => {
    if (!businessReviewData || !businessReviewData.processedData || businessReviewData.processedData.length === 0) return;
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = margin;
      
      // Helper function to add a new page if needed
      const checkNewPage = (requiredHeight) => {
        if (yPosition + requiredHeight > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
      };
      
      // Get filtered data based on current view mode
      const allProcessed = businessReviewData.processedData || [];
      const effectiveViewMode = viewMode || 'month';
      let effectiveMonth = selectedMonth;
      let effectiveYear = selectedYear;
      
      // Get available months/years
      const monthsSet = new Set();
      const yearsSet = new Set();
      allProcessed.forEach((item) => {
        const d = item.date ? new Date(item.date) : null;
        if (!d || isNaN(d.getTime())) return;
        const iso = d.toISOString().split('T')[0];
        monthsSet.add(iso.slice(0, 7));
        yearsSet.add(iso.slice(0, 4));
      });
      const brMonths = Array.from(monthsSet).sort().reverse();
      const brYears = Array.from(yearsSet).sort().reverse();
      
      if (effectiveViewMode === 'month' && !effectiveMonth && brMonths.length > 0) {
        effectiveMonth = brMonths[0];
      }
      if (effectiveViewMode === 'year' && !effectiveYear && brYears.length > 0) {
        effectiveYear = brYears[0];
      }
      
      const filtered = allProcessed.filter((item) => {
        if (!item.date) return false;
        if (effectiveViewMode === 'month' && effectiveMonth) {
          return item.date.startsWith(effectiveMonth);
        }
        if (effectiveViewMode === 'year' && effectiveYear) {
          return item.date.startsWith(effectiveYear);
        }
        return true;
      });
      
      if (filtered.length === 0) return;
      
      // Calculate KPIs
      const kpis = filtered.reduce(
        (acc, item) => {
          acc.bidRequests += item.bidRequests || 0;
          acc.impressions += item.impressions || 0;
          acc.clicks += item.clicks || 0;
          acc.revenue += item.priceAdvertiser || 0;
          return acc;
        },
        { bidRequests: 0, impressions: 0, clicks: 0, revenue: 0 }
      );
      
      // Get trend data
      const trendMap = {};
      filtered.forEach((item) => {
        const date = item.date;
        if (!date) return;
        const key = effectiveViewMode === 'year' ? date.slice(0, 7) : date;
        if (!trendMap[key]) {
          trendMap[key] = {
            sortKey: key,
            dateLabel: effectiveViewMode === 'year'
              ? new Date(key + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              : key,
            bidRequests: 0,
            impressions: 0,
            clicks: 0,
            revenue: 0,
          };
        }
        trendMap[key].bidRequests += item.bidRequests || 0;
        trendMap[key].impressions += item.impressions || 0;
        trendMap[key].clicks += item.clicks || 0;
        trendMap[key].revenue += item.priceAdvertiser || 0;
      });
      const dailyTrendData = Object.values(trendMap).sort((a, b) => a.sortKey > b.sortKey ? 1 : a.sortKey < b.sortKey ? -1 : 0);
      
      // Get pie chart data
      const adKindImpressions = {};
      filtered.forEach((item) => {
        if (!item.adKind) return;
        if (!adKindImpressions[item.adKind]) {
          adKindImpressions[item.adKind] = 0;
        }
        adKindImpressions[item.adKind] += item.impressions || 0;
      });
      const totalImpressions = Object.values(adKindImpressions).reduce((sum, v) => sum + v, 0);
      const pieChartData = Object.entries(adKindImpressions).map(([adKind, value]) => {
        const percentage = totalImpressions > 0 ? ((value / totalImpressions) * 100).toFixed(2) : '0.00';
        const getAdKindDisplayName = (adKind) => {
          const mapping = {
            AD_TRAFFIC: "NATIVE DISPLAY",
            AD_OUTSTREAM: "OUTSTREAM",
            AD_INSTREAM: "INSTREAM",
            AD_RAW_VIDEO: "VIDEO IN BANNER",
            AD_VIDEO: "NATIVE VIDEO",
            AD_BANNER: "DISPLAY",
          };
          return mapping[adKind] || adKind || "Unknown";
        };
        return {
          name: getAdKindDisplayName(adKind),
          value,
          percentage,
        };
      });
      
      // Get bar chart data
      const adKindRevenue = {};
      filtered.forEach((item) => {
        if (!item.adKind) return;
        if (!adKindRevenue[item.adKind]) {
          adKindRevenue[item.adKind] = 0;
        }
        adKindRevenue[item.adKind] += item.priceAdvertiser || 0;
      });
      const barChartData = Object.entries(adKindRevenue).map(([adKind, value]) => {
        const getAdKindDisplayName = (adKind) => {
          const mapping = {
            AD_TRAFFIC: "NATIVE DISPLAY",
            AD_OUTSTREAM: "OUTSTREAM",
            AD_INSTREAM: "INSTREAM",
            AD_RAW_VIDEO: "VIDEO IN BANNER",
            AD_VIDEO: "NATIVE VIDEO",
            AD_BANNER: "DISPLAY",
          };
          return mapping[adKind] || adKind || "Unknown";
        };
        return {
          name: getAdKindDisplayName(adKind),
          revenue: (value || 0) / 1000,
        };
      });
      
      // Title
      pdf.setFontSize(20);
      pdf.setTextColor(30, 58, 138);
      pdf.setFont(undefined, 'bold');
      pdf.text('DSP Performance Dashboard', margin, yPosition);
      yPosition += 10;
      
      // Period label
      pdf.setFontSize(12);
      pdf.setTextColor(100, 100, 100);
      pdf.setFont(undefined, 'normal');
      const getPeriodLabel = () => {
        if (effectiveViewMode === 'month' && effectiveMonth) {
          const date = new Date(effectiveMonth + '-01');
          return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        } else if (effectiveViewMode === 'year' && effectiveYear) {
          return effectiveYear;
        }
        return 'All Time';
      };
      pdf.text(`Business Review • ${getPeriodLabel()}`, margin, yPosition);
      yPosition += 15;
      
      // KPI Cards Section
      pdf.setFontSize(16);
      pdf.setTextColor(30, 58, 138);
      pdf.setFont(undefined, 'bold');
      pdf.text('Key Performance Indicators', margin, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(10);
      const kpiData = [
        { label: 'BID REQUESTS', value: formatBidResponsesBR(kpis.bidRequests), subtitle: 'Total requests', borderColor: [245, 158, 11], bgColor: [255, 251, 235], textColor: [146, 64, 14] },
        { label: 'IMPRESSIONS', value: formatBidResponsesBR(kpis.impressions), subtitle: 'Total impressions', borderColor: [59, 130, 246], bgColor: [239, 246, 255], textColor: [30, 64, 175] },
        { label: 'CLICKS', value: formatBidResponsesBR(kpis.clicks), subtitle: 'Total clicks', borderColor: [239, 68, 68], bgColor: [254, 242, 242], textColor: [153, 27, 27] },
        { label: 'REVENUE', value: formatCurrencyBR(kpis.revenue), subtitle: 'Advertiser spend', borderColor: [16, 185, 129], bgColor: [236, 253, 245], textColor: [5, 122, 85] }
      ];
      
      const kpiBoxWidth = (pageWidth - 2 * margin - 3 * 5) / 4;
      const kpiBoxHeight = 25;
      checkNewPage(kpiBoxHeight + 10);
      
      kpiData.forEach((kpi, index) => {
        const xPos = margin + index * (kpiBoxWidth + 5);
        pdf.setDrawColor(kpi.borderColor[0], kpi.borderColor[1], kpi.borderColor[2]);
        pdf.setFillColor(kpi.bgColor[0], kpi.bgColor[1], kpi.bgColor[2]);
        pdf.rect(xPos, yPosition, kpiBoxWidth, kpiBoxHeight, 'FD');
        pdf.setFillColor(kpi.borderColor[0], kpi.borderColor[1], kpi.borderColor[2]);
        pdf.rect(xPos, yPosition, 2, kpiBoxHeight, 'F');
        pdf.setFontSize(8);
        pdf.setTextColor(kpi.textColor[0], kpi.textColor[1], kpi.textColor[2]);
        pdf.setFont(undefined, 'normal');
        pdf.text(kpi.label, xPos + 4, yPosition + 5);
        pdf.setFontSize(12);
        pdf.setFont(undefined, 'bold');
        pdf.text(kpi.value, xPos + 4, yPosition + 12);
        pdf.setFontSize(7);
        pdf.setTextColor(kpi.textColor[0] - 20, kpi.textColor[1] - 20, kpi.textColor[2] - 20);
        pdf.setFont(undefined, 'normal');
        pdf.text(kpi.subtitle, xPos + 4, yPosition + 17);
      });
      
      yPosition += kpiBoxHeight + 15;
      
      // Monthly Performance Trend Section
      checkNewPage(80);
      pdf.setFontSize(16);
      pdf.setTextColor(30, 58, 138);
      pdf.setFont(undefined, 'bold');
      pdf.text(effectiveViewMode === 'year' ? 'Monthly Performance Trend' : 'Daily Performance Trend', margin, yPosition);
      yPosition += 8;
      
      pdf.setFontSize(9);
      const tableHeaders = ['Period', 'Bid Requests', 'Impressions', 'Clicks', 'Revenue ($)'];
      const colWidths = [35, 35, 35, 35, 40];
      let xPos = margin;
      pdf.setFillColor(59, 130, 246);
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont(undefined, 'bold');
      tableHeaders.forEach((header, i) => {
        pdf.text(header, xPos + 2, yPosition + 6);
        xPos += colWidths[i];
      });
      yPosition += 8;
      
      let rowIndex = 0;
      dailyTrendData.forEach((item) => {
        checkNewPage(8);
        if (rowIndex % 2 === 0) {
          pdf.setFillColor(249, 250, 251);
        } else {
          pdf.setFillColor(255, 255, 255);
        }
        pdf.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F');
        pdf.setDrawColor(220, 220, 220);
        pdf.line(margin, yPosition, pageWidth - margin, yPosition);
        xPos = margin;
        const rowData = [
          item.dateLabel,
          formatBidResponsesBR(item.bidRequests),
          formatBidResponsesBR(item.impressions),
          formatBidResponsesBR(item.clicks),
          formatCurrencyDetailedBR(item.revenue)
        ];
        pdf.setTextColor(0, 0, 0);
        pdf.setFont(undefined, 'normal');
        rowData.forEach((data, i) => {
          pdf.text(data, xPos + 2, yPosition + 6);
          xPos += colWidths[i];
        });
        yPosition += 8;
        rowIndex++;
      });
      
      yPosition += 10;
      
      // Impression by Ad Type Section
      checkNewPage(60);
      pdf.setFontSize(16);
      pdf.setTextColor(30, 58, 138);
      pdf.setFont(undefined, 'bold');
      pdf.text('Impression by Ad Type', margin, yPosition);
      yPosition += 8;
      pdf.setFontSize(10);
      const pieColorsRGB = [
        [59, 130, 246], [16, 185, 129], [245, 158, 11], [239, 68, 68],
        [139, 92, 246], [236, 72, 153], [6, 182, 212], [249, 115, 22]
      ];
      pieChartData.forEach((item, index) => {
        checkNewPage(8);
        const color = pieColorsRGB[index % pieColorsRGB.length];
        pdf.setFillColor(color[0], color[1], color[2]);
        pdf.rect(margin + 5, yPosition - 2, 3, 3, 'F');
        pdf.setTextColor(color[0], color[1], color[2]);
        pdf.setFont(undefined, 'bold');
        pdf.text(`${item.name} ${item.percentage}%`, margin + 10, yPosition);
        yPosition += 8;
      });
      
      yPosition += 5;
      
      // Revenue by Ad Type Section
      checkNewPage(60);
      pdf.setFontSize(16);
      pdf.setTextColor(30, 58, 138);
      pdf.setFont(undefined, 'bold');
      pdf.text('Revenue by Ad Type', margin, yPosition);
      yPosition += 8;
      pdf.setFontSize(10);
      barChartData.forEach((item, index) => {
        checkNewPage(8);
        const fullRevenue = item.revenue * 1000;
        const color = pieColorsRGB[index % pieColorsRGB.length];
        pdf.setFillColor(color[0], color[1], color[2]);
        pdf.rect(margin + 5, yPosition - 2, 3, 3, 'F');
        pdf.setTextColor(color[0], color[1], color[2]);
        pdf.setFont(undefined, 'bold');
        pdf.text(`${item.name}`, margin + 10, yPosition);
        pdf.setTextColor(0, 0, 0);
        pdf.setFont(undefined, 'normal');
        pdf.text(formatCurrencyDetailedBR(fullRevenue), pageWidth - margin - 50, yPosition);
        yPosition += 8;
      });
      
      // Save PDF
      const fileName = `Business_Review_Global_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF: ' + error.message);
    }
  };

  const fetchSiteDomainData = async () => {
    setLoadingSiteDomainData(true);
    try {
      const token = getToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      // Use the same date range as the main analytics
      let startDateValue, endDateValue;
      
      if (startDate && endDate) {
        startDateValue = new Date(startDate + 'T00:00:00.000Z');
        endDateValue = new Date(endDate + 'T23:59:59.000Z');
      } else {
        const now = new Date();
        startDateValue = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDateValue.setUTCHours(0, 0, 0, 0);
        endDateValue = new Date(now);
        endDateValue.setUTCHours(23, 59, 59, 999);
      }

      // Use Site dimension with SiteName metric
      const payload = {
        "Intervals": [{
          "Begin": startDateValue.toISOString(),
          "End": endDateValue.toISOString()
        }],
        "Metrics": ["PricePublisher", "PriceAdvertiser_PublisherSide"],
        "Dimensions": ["SiteDomain"],
        "Granularity": "all",
        "Datasource": "adserver_stats",
        "TimeZone": "Etc/GMT",
        "Size": 250,
        "OrderBy": "PriceAdvertiser_PublisherSide",
        "OrderOp": "DESC"
      };

      console.log('📤 Fetching SITE DOMAIN data with dimension: SiteDomain');
      console.log('📤 API Payload:', JSON.stringify(payload, null, 2));

      const response = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ayl-auth-token": token
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = new Error(`HTTP error! status: ${response.status}`);
        setError(formatError(error, response));
        setLoadingDeviceDetail(false);
        return;
      }

      const siteDomainDataResult = await response.json();
      console.log('✅ SITE DOMAIN data fetched successfully', siteDomainDataResult);

      // Extract the Data array from the response object
      const dataArray = Array.isArray(siteDomainDataResult?.Data) 
        ? siteDomainDataResult.Data 
        : Array.isArray(siteDomainDataResult) 
          ? siteDomainDataResult 
          : [];

      // Process and sort data
      const processedData = dataArray
        .map((item) => {
          const siteDomain = item.SiteDomain || 'Unknown';
          const dspRevenue = item.PriceAdvertiser_PublisherSide || 0;
          const publisherCosts = item.PricePublisher || 0;
          const margin = dspRevenue - publisherCosts;
          const marginPercentage = dspRevenue > 0 
            ? ((margin / dspRevenue) * 100).toFixed(2)
            : '0.00';
          
          return {
            ...item,
            siteDomain: siteDomain,
            siteName: siteDomain, // Use siteDomain for display
            dspRevenue: dspRevenue,
            publisherCosts: publisherCosts,
            margin: margin,
            marginPercentage: marginPercentage
          };
        })
        .sort((a, b) => (b.PriceAdvertiser_PublisherSide || 0) - (a.PriceAdvertiser_PublisherSide || 0));

      setSiteDomainData(processedData);
    } catch (err) {
      console.error('Error fetching SITE DOMAIN data:', err);
      setError(formatError(err, null));
      setSiteDomainData([]);
    } finally {
      setLoadingSiteDomainData(false);
    }
  };

  // Handle device row click
  const handleDeviceRowClick = async (deviceName) => {
    if (selectedDevice === deviceName) {
      // If already selected, deselect
      setSelectedDevice(null);
      setDeviceDetailData([]);
    } else {
      // Select and fetch detail data
      setSelectedDevice(deviceName);
      await fetchDeviceDetailData(deviceName);
    }
  };

  // Toggle date expansion and fetch hourly data
  const toggleDateExpansion = async (dateString, dateKey) => {
    const key = dateKey || dateString; // Use dateKey if available, otherwise use dateString
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
          // Use dateKey (YYYY-MM-DD) if available, otherwise use dateString (DD/MM/YYYY)
          const dateToFetch = dateKey || dateString;
          const hourlyData = await fetchHourlyDataForDate(dateToFetch);
          setHourlyDataCache(prev => ({
            ...prev,
            [key]: hourlyData
          }));
        } catch (err) {
          console.error(`Error fetching hourly data for ${dateString}:`, err);
          setError(formatError(err, null));
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

  // Export function for Device data
  const exportDeviceDataToCSV = () => {
    if (deviceData.length === 0) return;

    // Define headers
    const headers = [
      'Device',
      'DSP Revenue',
      'Publisher Costs',
      'ADY Margin',
      'Margin %'
    ];

    // Convert data to CSV rows (divide by 1M to match display format)
    const rows = deviceData.map((item) => {
      return [
        item.device || 'Unknown',
        ((item.PriceAdvertiser_PublisherSide || 0) / 1000000).toFixed(2),
        ((item.PricePublisher || 0) / 1000000).toFixed(2),
        ((item.margin || 0) / 1000000).toFixed(2),
        item.marginPercentage || '0.00'
      ];
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Device_Data_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export function for GEO data
  const exportGeoDataToCSV = () => {
    if (geoData.length === 0) return;
    const headers = ['Country', 'DSP Revenue', 'Publisher Costs', 'ADY Margin', 'Impressions', 'Click', 'CTR', 'Margin %'];
    const rows = geoData.map((item) => [
      item.country || 'Unknown',
      ((item.PriceAdvertiser_PublisherSide || 0) / 1000000).toFixed(2),
      ((item.PricePublisher || 0) / 1000000).toFixed(2),
      ((item.margin || 0) / 1000000).toFixed(2),
      item.impressions || 0,
      item.clicks || 0,
      (item.ctr || 0).toFixed(2) + '%',
      item.marginPercentage || '0.00'
    ]);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `GEO_Data_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export function for KPI PROG table
  const exportKPIPROGToCSV = () => {
    if (analyticsData.length === 0) return;

    // Define headers
    const headers = [
      'Date',
      'Bid Requests',
      'Bid Requests Trend',
      'Bid Responses',
      'Bid Responses Trend',
      'Impressions',
      'Impressions Trend',
      'eCPM Publisher',
      'eCPM Publisher Trend',
      'RPBR/M',
      'RPBR/M Trend',
      'Fill Rate',
      'Fill Rate Trend',
      'Win Rate',
      'Win Rate Trend'
    ];

    // Convert data to CSV rows
    const rows = analyticsData.map((item) => {
      const date = item.date || item.formattedDate || 'N/A';
      const bidRequests = item.network_operations_bid_requests !== null && item.network_operations_bid_requests !== undefined 
        ? item.network_operations_bid_requests.toString() : 'N/A';
      const bidRequestsTrend = item.bidRequestsTrend === 'up' ? `+${item.bidRequestsChangePercent}%` :
        item.bidRequestsTrend === 'down' ? `${item.bidRequestsChangePercent}%` : '—';
      const bidResponses = item.network_operations_bid_responses !== null && item.network_operations_bid_responses !== undefined 
        ? item.network_operations_bid_responses.toString() : 'N/A';
      const bidResponsesTrend = item.bidResponsesTrend === 'up' ? `+${item.bidResponsesChangePercent}%` :
        item.bidResponsesTrend === 'down' ? `${item.bidResponsesChangePercent}%` : '—';
      const impressions = item.network_operations_impressions !== null && item.network_operations_impressions !== undefined 
        ? item.network_operations_impressions.toString() : 'N/A';
      const impressionsTrend = item.impressionsTrend === 'up' ? `+${item.impressionsChangePercent}%` :
        item.impressionsTrend === 'down' ? `${item.impressionsChangePercent}%` : '—';
      const ecpm = item.network_operations_ecpm_publisher !== null && item.network_operations_ecpm_publisher !== undefined 
        ? item.network_operations_ecpm_publisher.toString() : 'N/A';
      const ecpmTrend = item.ecpmTrend === 'up' ? `+${item.ecpmChangePercent}%` :
        item.ecpmTrend === 'down' ? `${item.ecpmChangePercent}%` : '—';
      const rpbr = item.rpbr !== null && item.rpbr !== undefined ? item.rpbr.toString() : 'N/A';
      const rpbrTrend = item.rpbrTrend === 'up' ? `+${item.rpbrChangePercent}%` :
        item.rpbrTrend === 'down' ? `${item.rpbrChangePercent}%` : '—';
      const fillRate = item.fillRate !== null && item.fillRate !== undefined ? item.fillRate.toFixed(2) : 'N/A';
      const fillRateTrend = item.fillRateTrend === 'up' ? `+${item.fillRateChangePercent}%` :
        item.fillRateTrend === 'down' ? `${item.fillRateChangePercent}%` : '—';
      const winRate = item.winRate !== null && item.winRate !== undefined ? item.winRate.toFixed(2) : 'N/A';
      const winRateTrend = item.winRateTrend === 'up' ? `+${item.winRateChangePercent}%` :
        item.winRateTrend === 'down' ? `${item.winRateChangePercent}%` : '—';

      return [
        date,
        bidRequests,
        bidRequestsTrend,
        bidResponses,
        bidResponsesTrend,
        impressions,
        impressionsTrend,
        ecpm,
        ecpmTrend,
        rpbr,
        rpbrTrend,
        fillRate,
        fillRateTrend,
        winRate,
        winRateTrend
      ];
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `KPI_PROG_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export main analytics table to CSV
  const exportAnalyticsTableToCSV = () => {
    if (analyticsData.length === 0) return;

    let headers = [];
    let rows = [];

    if (viewMode === 'hourly') {
      headers = [
        'Date',
        'DSP Revenue',
        'Yesterday DSP Revenue',
        'DSP Revenue Trend',
        'Publisher Costs',
        'Yesterday Publisher Costs',
        'Publisher Costs Trend',
        'ADY Margin',
        'Yesterday ADY Margin',
        'ADY Margin Trend',
        'Today Profit %',
        'Yesterday Profit %'
      ];

      rows = analyticsData.map((item) => {
        const date = item.date || item.formattedDate || item.formattedTime || 'N/A';
        const dspRevenue = item.PriceAdvertiser_PublisherSide !== null && item.PriceAdvertiser_PublisherSide !== undefined 
          ? (item.PriceAdvertiser_PublisherSide / 1000000).toFixed(2) : 'N/A';
        const yesterdayDspRevenue = item.yesterdayPriceAdvertiser_PublisherSide !== null && item.yesterdayPriceAdvertiser_PublisherSide !== undefined 
          ? (item.yesterdayPriceAdvertiser_PublisherSide / 1000000).toFixed(2) : 'N/A';
        const dspRevenueTrend = item.dspRevenueTrend === 'up' ? `+${item.dspRevenueChangePercent}%` :
          item.dspRevenueTrend === 'down' ? `${item.dspRevenueChangePercent}%` : '—';
        const publisherCosts = item.PricePublisher !== null && item.PricePublisher !== undefined 
          ? (item.PricePublisher / 1000000).toFixed(2) : 'N/A';
        const yesterdayPublisherCosts = item.yesterdayPricePublisher !== null && item.yesterdayPricePublisher !== undefined 
          ? (item.yesterdayPricePublisher / 1000000).toFixed(2) : 'N/A';
        const publisherCostsTrend = item.publisherCostsTrend === 'up' ? `+${item.publisherCostsChangePercent}%` :
          item.publisherCostsTrend === 'down' ? `${item.publisherCostsChangePercent}%` : '—';
        const adyMargin = item.margin !== null && item.margin !== undefined 
          ? (item.margin / 1000000).toFixed(2) : 'N/A';
        const yesterdayAdyMargin = item.yesterdayMargin !== null && item.yesterdayMargin !== undefined 
          ? (item.yesterdayMargin / 1000000).toFixed(2) : 'N/A';
        const adyMarginTrend = item.marginTrend === 'up' ? `+${item.marginChangePercent}%` :
          item.marginTrend === 'down' ? `${item.marginChangePercent}%` : '—';
        const todayProfit = item.profitPercentage !== null && item.profitPercentage !== undefined 
          ? item.profitPercentage.toFixed(2) : 'N/A';
        const yesterdayProfit = item.yesterdayProfitPercentage !== null && item.yesterdayProfitPercentage !== undefined 
          ? item.yesterdayProfitPercentage.toFixed(2) : 'N/A';

        return [
          date,
          dspRevenue,
          yesterdayDspRevenue,
          dspRevenueTrend,
          publisherCosts,
          yesterdayPublisherCosts,
          publisherCostsTrend,
          adyMargin,
          yesterdayAdyMargin,
          adyMarginTrend,
          todayProfit,
          yesterdayProfit
        ];
      });
    } else {
      // Daily mode
      headers = [
        'Date',
        'DSP Revenue',
        'DSP Revenue Trend',
        'Publisher Costs',
        'Publisher Costs Trend',
        'ADY Margin',
        'ADY Margin Trend',
        'Profit %'
      ];

      rows = analyticsData.map((item) => {
        const date = item.date || item.formattedDate || 'N/A';
        const dspRevenue = item.PriceAdvertiser_PublisherSide !== null && item.PriceAdvertiser_PublisherSide !== undefined 
          ? (item.PriceAdvertiser_PublisherSide / 1000000).toFixed(2) : 'N/A';
        const dspRevenueTrend = item.dspRevenueTrend === 'up' ? `+${item.dspRevenueChangePercent}%` :
          item.dspRevenueTrend === 'down' ? `${item.dspRevenueChangePercent}%` : '—';
        const publisherCosts = item.PricePublisher !== null && item.PricePublisher !== undefined 
          ? (item.PricePublisher / 1000000).toFixed(2) : 'N/A';
        const publisherCostsTrend = item.publisherCostsTrend === 'up' ? `+${item.publisherCostsChangePercent}%` :
          item.publisherCostsTrend === 'down' ? `${item.publisherCostsChangePercent}%` : '—';
        const adyMargin = item.margin !== null && item.margin !== undefined 
          ? (item.margin / 1000000).toFixed(2) : 'N/A';
        const adyMarginTrend = item.marginTrend === 'up' ? `+${item.marginChangePercent}%` :
          item.marginTrend === 'down' ? `${item.marginChangePercent}%` : '—';
        const profit = item.profitPercentage !== null && item.profitPercentage !== undefined 
          ? item.profitPercentage.toFixed(2) : 'N/A';

        return [
          date,
          dspRevenue,
          dspRevenueTrend,
          publisherCosts,
          publisherCostsTrend,
          adyMargin,
          adyMarginTrend,
          profit
        ];
      });
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Analytics_Table_${viewMode}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Menu items configuration (right sidebar)
  const menuItems = [
    { id: 'kpi-prog', label: 'KPI PROG' },
    { id: 'device', label: 'DEVICE' },
    { id: 'ad-kind', label: 'AD KIND' },
    { id: 'geo', label: 'GEO' },
    { id: 'dsp', label: 'DSP' },
    { id: 'seat', label: 'SEAT' },
    { id: 'ad-domain', label: 'AD DOMAIN' },
    { id: 'site-domain', label: 'SITE DOMAIN' },
    // Global overview, mirroring the style of DSPDashboard Business Review / OVERVIEW
    { id: 'overview', label: 'OVERVIEW' },
  ];

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="bg-white w-full max-w-full flex">
      {/* Mobile/Tablet Menu Toggle Button */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="lg:hidden fixed bottom-6 right-6 z-50 bg-[rgb(75,99,226)] text-white p-4 rounded-full shadow-lg hover:bg-[rgb(40,62,173)] transition-colors"
        aria-label="Toggle filter menu"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Main Content */}
      <div className="flex-1 min-w-0 lg:pr-10">
      <div className="p-3 lg:p-12 w-full">
        {/* Error Message */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[rgb(75,99,226)]" />
            <span className="ml-2 text-slate-600">Loading analytics data...</span>
          </div>
        )}

        {/* Summary Cards */}
        {summaryStats && !loading && (!useNetworkOpsForDaily || viewMode === 'hourly') && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {viewMode === 'hourly' ? (
              <>
        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-3 lg:p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className={TAILWIND_CLASSES.formSectionLabel}>DSP Revenue</p>
                <p className="text-lg lg:text-xl font-bold text-green-600 mt-1">
                  {formatCurrency(summaryStats.totalAdvertiserSpend)}
                </p>
                        <div className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          Yesterday: {formatCurrency(summaryStats.yesterdayTotalAdvertiserSpend || 0)}
                        </div>
              </div>
              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-4 h-4 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-3 lg:p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className={TAILWIND_CLASSES.formSectionLabel}>Publisher Costs</p>
                <p className="text-lg lg:text-xl font-bold text-red-600 mt-1">
                  {formatCurrency(summaryStats.totalPublisherRevenue)}
                </p>
                        <div className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          Yesterday: {formatCurrency(summaryStats.yesterdayTotalPublisherRevenue || 0)}
                        </div>
              </div>
              <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-3 lg:p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className={TAILWIND_CLASSES.formSectionLabel}>ADY Margin</p>
                <p className="text-lg lg:text-xl font-bold mt-1" style={{ color: 'rgb(79, 70, 229)' }}>
                  {formatCurrency(summaryStats.totalMargin)}
                </p>
                        <div className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          Yesterday: {formatCurrency(summaryStats.yesterdayTotalMargin || 0)}
              </div>
              </div>
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-4 h-4 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-3 lg:p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                        <p className={TAILWIND_CLASSES.formSectionLabel}>Avg Margin %</p>
                        <p className="text-lg lg:text-xl font-bold text-orange-600 mt-1">
                          {summaryStats.avgMarginPercentage}%
                        </p>
                        <div className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          Yesterday: {(summaryStats.yesterdayAvgMarginPercentage || 0)}%
                        </div>
              </div>
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-white">
                  <path d="M8 2v4"></path>
                  <path d="M16 2v4"></path>
                  <rect width="18" height="18" x="3" y="4" rx="2"></rect>
                  <path d="M3 10h18"></path>
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
              </>
            ) : (
              <>
                <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-3 lg:p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className={TAILWIND_CLASSES.formSectionLabel}>DSP Revenue</p>
                        <p className="text-lg lg:text-xl font-bold text-green-600 mt-1">
                          {formatCurrency(summaryStats.totalAdvertiserSpend)}
                        </p>
                      </div>
                      <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <DollarSign className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-3 lg:p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className={TAILWIND_CLASSES.formSectionLabel}>Publisher Costs</p>
                        <p className="text-lg lg:text-xl font-bold text-red-600 mt-1">
                          {formatCurrency(summaryStats.totalPublisherRevenue)}
                        </p>
                      </div>
                      <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-3 lg:p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className={TAILWIND_CLASSES.formSectionLabel}>ADY Margin</p>
                        <p className="text-lg lg:text-xl font-bold mt-1" style={{ color: 'rgb(79, 70, 229)' }}>
                          {formatCurrency(summaryStats.totalMargin)}
                        </p>
                      </div>
                      <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <DollarSign className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-3 lg:p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className={TAILWIND_CLASSES.formSectionLabel}>Avg Margin %</p>
                        <p className="text-lg lg:text-xl font-bold text-orange-600 mt-1">
                          {summaryStats.avgMarginPercentage}%
                        </p>
                      </div>
                      <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-white">
                          <path d="M8 2v4"></path>
                          <path d="M16 2v4"></path>
                          <rect width="18" height="18" x="3" y="4" rx="2"></rect>
                          <path d="M3 10h18"></path>
                        </svg>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* Chart for Hourly View */}
        {viewMode === 'hourly' && analyticsData.length > 0 && !loading && (
          <Card className="border-slate-200 shadow-sm mb-4">
        <CardHeader className="pb-6 pt-6">
              <CardTitle className="flex items-center gap-3 text-lg font-bold" style={{ color: 'rgb(30, 47, 130)' }}>
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[rgb(75,99,226)] to-[rgb(40,62,173)] flex items-center justify-center shadow-sm">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <span>DSP Revenue vs Yesterday DSP Revenue</span>
              </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
              <div className="h-48 lg:h-80 min-h-[200px] min-w-[300px]">
                <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={300}>
                  <LineChart data={analyticsData}>
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
                      formatter={(value, name) => [
                        formatCurrencyChart(value), 
                        name === 'PriceAdvertiser_PublisherSide' ? 'DSP Revenue' : 
                        name === 'yesterdayDSPRevenue' ? 'Yesterday DSP Revenue' : name
                      ]}
                      labelFormatter={(label) => `Time: ${label}`}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                    />
                    <Legend onClick={(e) => toggleSeries('hourly_revenue', e.dataKey)} wrapperStyle={{ cursor: 'pointer' }} />
                    <Line 
                      type="monotone" 
                      dataKey="PriceAdvertiser_PublisherSide" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      name="DSP Revenue"
                      dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                      hide={isSeriesHidden('hourly_revenue', 'PriceAdvertiser_PublisherSide')}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="yesterdayDSPRevenue" 
                      stroke="#6b7280" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      name="Yesterday DSP Revenue"
                      dot={{ fill: '#6b7280', strokeWidth: 2, r: 4 }}
                      hide={isSeriesHidden('hourly_revenue', 'yesterdayDSPRevenue')}
                    />
                  </LineChart>
                </ResponsiveContainer>
            </div>
            </CardContent>
          </Card>
        )}

        {/* Charts for Daily View - 2 per row */}
        {viewMode === 'daily' && analyticsData.length > 0 && !loading && (
          <>
            {useNetworkOpsForDaily ? (
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
                                  {summaryStats ? formatCurrencyChart(summaryStats.totalAdvertiserSpend) : '—'}
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
                                  {summaryStats ? formatCurrencyChart(summaryStats.totalPublisherRevenue) : '—'}
                                </div>
                              </div>

                              <div className="p-3 rounded-lg border" style={{ backgroundColor: 'rgb(239, 246, 255)', borderColor: 'rgb(191, 219, 254)' }}>
                                <div className="flex items-start justify-between mb-1">
                                  <div className={cn(TAILWIND_CLASSES.formSectionLabel)} style={{ color: 'rgb(30, 64, 175)' }}>ADY Margin</div>
                                  <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'rgb(219, 234, 254)', color: 'rgb(30, 64, 175)' }}>
                                    <PieChartIcon className="w-3.5 h-3.5" />
                                  </div>
                                </div>
                                <div className="text-base font-bold" style={{ color: 'rgb(29, 78, 216)' }}>
                                  {summaryStats ? formatCurrencyChart(summaryStats.totalMargin) : '—'}
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
                                  {summaryStats ? formatPercentage(Number(summaryStats.avgMarginPercentage)) : '—'}
                                </div>
                              </div>

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

                              <div className="p-3 rounded-lg border" style={{ backgroundColor: 'rgb(243, 232, 255)', borderColor: 'rgb(221, 214, 254)' }}>
                                <div className="flex items-start justify-between mb-1">
                                  <div className={cn(TAILWIND_CLASSES.formSectionLabel)} style={{ color: 'rgb(88, 28, 135)' }}>Visible Impressions</div>
                                  <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'rgb(237, 233, 254)', color: 'rgb(88, 28, 135)' }}>
                                    <Activity className="w-3.5 h-3.5" />
                                  </div>
                                </div>
                                <div className="text-base font-bold" style={{ color: 'rgb(109, 40, 217)' }}>
                                  {formatLargeNumber(
                                    analyticsData.reduce((sum, item) => sum + (item.network_operations_visible_impressions || 0), 0)
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <div className={cn(TAILWIND_CLASSES.formSectionLabel, 'mb-3')}>Performance Metrics</div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-3 rounded-lg border" style={{ backgroundColor: 'rgb(220, 252, 231)', borderColor: 'rgb(134, 239, 172)' }}>
                                <div className="flex items-start justify-between mb-1">
                                  <div className={cn(TAILWIND_CLASSES.formSectionLabel)} style={{ color: 'rgb(22, 101, 52)' }}>Viewability Rate</div>
                                  <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'rgb(187, 247, 208)', color: 'rgb(22, 101, 52)' }}>
                                    <Percent className="w-3.5 h-3.5" />
                                  </div>
                                </div>
                                <div className="text-base font-bold" style={{ color: 'rgb(22, 101, 52)' }}>
                                  {formatPercentage((() => {
                                    const rates = analyticsData
                                      .map((item) => item.network_operations_viewability_rate)
                                      .filter((rate) => typeof rate === 'number');
                                    if (rates.length === 0) return 0;
                                    const avgRate = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
                                    return avgRate * 100;
                                  })())}
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
                  {/* Combined DSP Revenue & Publisher Costs Chart */}
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
                              dataKey="date" 
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
                              wrapperStyle={{ fontSize: '11px', paddingTop: '10px', cursor: 'pointer' }}
                              iconType="line"
                              onClick={(e) => toggleSeries('daily_revenue_costs', e.dataKey)}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="PriceAdvertiser_PublisherSide" 
                              stroke="#10b981" 
                              strokeWidth={2}
                              dot={false}
                              activeDot={false}
                              name="DSP Revenue"
                              hide={isSeriesHidden('daily_revenue_costs', 'PriceAdvertiser_PublisherSide')}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="PricePublisher" 
                              stroke="#ef4444" 
                              strokeWidth={2}
                              dot={false}
                              activeDot={false}
                              name="Publisher Costs"
                              hide={isSeriesHidden('daily_revenue_costs', 'PricePublisher')}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Impressions & Visible Impressions Chart */}
                  <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-3 pt-3">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <BarChart3 className="w-4 h-4" />
                        Impressions & Visible Impressions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="h-40 lg:h-48 min-h-[150px] min-w-[250px]">
                        <ResponsiveContainer width="100%" height="100%" minHeight={150} minWidth={250}>
                          <LineChart data={analyticsData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                              dataKey="date" 
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
                            <RechartsTooltip 
                              formatter={(value, name, props) => {
                                if (props.dataKey === 'network_operations_impressions') {
                                  return [formatLargeNumber(value), 'Impressions'];
                                }
                                if (props.dataKey === 'network_operations_visible_impressions') {
                                  return [formatLargeNumber(value), 'Visible Impressions'];
                                }
                                return [value, name];
                              }}
                              labelFormatter={(label) => `Date: ${label}`}
                              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px' }}
                            />
                            <Legend 
                              wrapperStyle={{ fontSize: '11px', paddingTop: '10px', cursor: 'pointer' }}
                              iconType="line"
                              onClick={(e) => toggleSeries('daily_impressions_visible', e.dataKey)}
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
                              hide={isSeriesHidden('daily_impressions_visible', 'network_operations_impressions')}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="network_operations_visible_impressions" 
                              yAxisId="left"
                              stroke="rgb(109, 40, 217)" 
                              strokeWidth={2}
                              dot={false}
                              activeDot={false}
                              name="Visible Impressions"
                              hide={isSeriesHidden('daily_impressions_visible', 'network_operations_visible_impressions')}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

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
                              dataKey="date" 
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
                              wrapperStyle={{ fontSize: '11px', paddingTop: '10px', cursor: 'pointer' }}
                              iconType="line"
                              onClick={(e) => toggleSeries('daily_ecpm', e.dataKey)}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="ecpmAdvertiser" 
                              stroke="rgb(14, 116, 144)" 
                              strokeWidth={2}
                              dot={false}
                              activeDot={false}
                              name="eCPM Advertiser"
                              hide={isSeriesHidden('daily_ecpm', 'ecpmAdvertiser')}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="ecpmPublisher" 
                              stroke="rgb(13, 148, 136)" 
                              strokeWidth={2}
                              dot={false}
                              activeDot={false}
                              name="eCPM Publisher"
                              hide={isSeriesHidden('daily_ecpm', 'ecpmPublisher')}
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
                              dataKey="date" 
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
                                props.dataKey === 'winRate'
                                  ? 'Win Rate'
                                  : props.dataKey === 'fillRate'
                                    ? 'Fill Rate'
                                    : 'Viewability Rate'
                              ]}
                              labelFormatter={(label) => `Date: ${label}`}
                              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px' }}
                            />
                            <Legend 
                              wrapperStyle={{ fontSize: '11px', paddingTop: '10px', cursor: 'pointer' }}
                              iconType="line"
                              onClick={(e) => toggleSeries('daily_win_fill', e.dataKey)}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="winRate" 
                              stroke="rgb(67, 56, 202)" 
                              strokeWidth={2}
                              dot={false}
                              activeDot={false}
                              name="Win Rate"
                              hide={isSeriesHidden('daily_win_fill', 'winRate')}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="fillRate" 
                              stroke="rgb(30, 41, 59)" 
                              strokeWidth={2}
                              dot={false}
                              activeDot={false}
                              name="Fill Rate"
                              hide={isSeriesHidden('daily_win_fill', 'fillRate')}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="viewabilityRate" 
                              stroke="rgb(234, 88, 12)" 
                              strokeWidth={2}
                              dot={false}
                              activeDot={false}
                              name="Viewability Rate"
                              hide={isSeriesHidden('daily_win_fill', 'viewabilityRate')}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-3 pt-3">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <BarChart3 className="w-4 h-4" />
                        Clicks & CTR
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="h-40 lg:h-48 min-h-[150px] min-w-[250px]">
                        <ResponsiveContainer width="100%" height="100%" minHeight={150} minWidth={250}>
                          <LineChart data={clickCtrChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                              dataKey="date" 
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
                              tickFormatter={(value) => formatPercentage(value)}
                              width={60}
                            />
                            <RechartsTooltip 
                              formatter={(value, name, props) => {
                                if (props.dataKey === 'clicks') {
                                  return [formatLargeNumber(value), 'Clicks'];
                                }
                                if (props.dataKey === 'ctr') {
                                  return [formatPercentage(value), 'CTR'];
                                }
                                return [value, name];
                              }}
                              labelFormatter={(label) => `Date: ${label}`}
                              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px' }}
                            />
                            <Legend 
                              wrapperStyle={{ fontSize: '11px', paddingTop: '10px', cursor: 'pointer' }}
                              iconType="line"
                              onClick={(e) => toggleSeries('daily_clicks_ctr', e.dataKey)}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="clicks" 
                              yAxisId="left"
                              stroke="rgb(59, 130, 246)" 
                              strokeWidth={2}
                              dot={false}
                              activeDot={false}
                              name="Clicks"
                              hide={isSeriesHidden('daily_clicks_ctr', 'clicks')}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="ctr" 
                              yAxisId="right"
                              stroke="rgb(22, 163, 74)" 
                              strokeWidth={2}
                              dot={false}
                              activeDot={false}
                              name="CTR"
                              hide={isSeriesHidden('daily_clicks_ctr', 'ctr')}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-3 pt-3">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <BarChart3 className="w-4 h-4" />
                        Bid Requests & Responses
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="h-40 lg:h-48 min-h-[150px] min-w-[250px]">
                        <ResponsiveContainer width="100%" height="100%" minHeight={150} minWidth={250}>
                          <LineChart data={analyticsData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis 
                              dataKey="date" 
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
                                if (props.dataKey === 'network_operations_bid_requests') {
                                  return [formatLargeNumber(value), 'Bid Requests'];
                                }
                                if (props.dataKey === 'network_operations_bid_responses') {
                                  return [formatLargeNumber(value), 'Bid Responses'];
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
                              wrapperStyle={{ fontSize: '11px', paddingTop: '10px', cursor: 'pointer' }}
                              iconType="line"
                              onClick={(e) => toggleSeries('daily_bids', e.dataKey)}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="network_operations_bid_requests" 
                              yAxisId="left"
                              stroke="rgb(59, 130, 246)" 
                              strokeWidth={2}
                              dot={false}
                              activeDot={false}
                              name="Bid Requests"
                              hide={isSeriesHidden('daily_bids', 'network_operations_bid_requests')}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="network_operations_bid_responses" 
                              yAxisId="left"
                              stroke="rgb(99, 102, 241)" 
                              strokeWidth={2}
                              dot={false}
                              activeDot={false}
                              name="Bid Responses"
                              hide={isSeriesHidden('daily_bids', 'network_operations_bid_responses')}
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
                              hide={isSeriesHidden('daily_bids', 'rpbr')}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Combined DSP Revenue & Publisher Costs Chart */}
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
                          dataKey="date" 
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
                          wrapperStyle={{ fontSize: '11px', paddingTop: '10px', cursor: 'pointer' }}
                          iconType="line"
                          onClick={(e) => toggleSeries('daily_revenue_costs_fallback', e.dataKey)}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="PriceAdvertiser_PublisherSide" 
                          stroke="#10b981" 
                          strokeWidth={2}
                          dot={{ fill: '#10b981', strokeWidth: 2, r: 2 }}
                          activeDot={{ r: 4 }}
                          name="DSP Revenue"
                          hide={isSeriesHidden('daily_revenue_costs_fallback', 'PriceAdvertiser_PublisherSide')}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="PricePublisher" 
                          stroke="#ef4444" 
                          strokeWidth={2}
                          dot={{ fill: '#ef4444', strokeWidth: 2, r: 2 }}
                          activeDot={{ r: 4 }}
                          name="Publisher Costs"
                          hide={isSeriesHidden('daily_revenue_costs_fallback', 'PricePublisher')}
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
                        <div className={cn(TAILWIND_CLASSES.formSectionLabel, 'mb-2')} style={{ color: 'rgb(30, 64, 175)' }}>Impressions</div>
                        <div className="text-lg font-bold" style={{ color: 'rgb(29, 78, 216)' }}>
                          {formatLargeNumber(
                            analyticsData.reduce((sum, item) => sum + (item.network_operations_impressions || 0), 0)
                          )}
                        </div>
                      </div>

                      {/* eCPM Publisher */}
                      <div className="p-4 rounded-lg border" style={{ backgroundColor: 'rgb(240, 253, 244)', borderColor: 'rgb(187, 247, 208)' }}>
                        <div className={cn(TAILWIND_CLASSES.formSectionLabel, 'mb-2')} style={{ color: 'rgb(20, 83, 45)' }}>eCPM Publisher</div>
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
                        <div className={cn(TAILWIND_CLASSES.formSectionLabel, 'mb-2')} style={{ color: 'rgb(88, 28, 135)' }}>RPBR/M</div>
                        <div className="text-lg font-bold" style={{ color: 'rgb(109, 40, 217)' }}>
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

                      {/* Win Rate */}
                      <div className="p-4 rounded-lg border" style={{ backgroundColor: 'rgb(255, 251, 235)', borderColor: 'rgb(254, 240, 138)' }}>
                        <div className={cn(TAILWIND_CLASSES.formSectionLabel, 'mb-2')} style={{ color: 'rgb(113, 63, 18)' }}>Win Rate</div>
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
                        <div className={cn(TAILWIND_CLASSES.formSectionLabel, 'mb-2')} style={{ color: 'rgb(153, 27, 27)' }}>Fill Rate</div>
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
            )}
          </>
        )}

        {/* Detailed Table */}
        {analyticsData.length > 0 && !loading && (
          <Card className="border-slate-200 shadow-sm w-full max-w-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 px-4 pt-4">
              <CardTitle>Analytics Data</CardTitle>
                  <Button
                onClick={exportAnalyticsTableToCSV}
                    variant="outline"
                    size="sm"
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
                  </Button>
            </CardHeader>
            <CardContent className="p-2 sm:p-4 w-full">
                <Table className="text-xs sm:text-sm w-full min-w-0">
                  <TableHeader>
                    <TableRow>
                    {renderSortableHeader("Date", "date", kpiProgSortConfig, handleKpiProgSort)}
                    {viewMode === 'hourly' && (
                      <>
                      {renderSortableHeader("DSP Revenue", "PriceAdvertiser_PublisherSide", kpiProgSortConfig, handleKpiProgSort)}
                        <TableHead className="text-center">Yesterday DSP Revenue</TableHead>
                        <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>
                      {renderSortableHeader("Publisher Costs", "PricePublisher", kpiProgSortConfig, handleKpiProgSort)}
                        <TableHead className="text-center">Yesterday Publisher Costs</TableHead>
                        <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>
                        {renderSortableHeader("ADY Margin", "margin", kpiProgSortConfig, handleKpiProgSort)}
                        <TableHead className="text-center">Yesterday ADY Margin</TableHead>
                        <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>
                        {renderSortableHeader("Today Profit %", "marginPercentage", kpiProgSortConfig, handleKpiProgSort)}
                        <TableHead className="text-center">Yesterday Profit %</TableHead>
                      </>
                    )}
                    {viewMode === 'daily' && (
                      <>
                        {renderSortableHeader("DSP Revenue", "PriceAdvertiser_PublisherSide", kpiProgSortConfig, handleKpiProgSort)}
                        <TableHead className="text-center">Trend</TableHead>
                        {renderSortableHeader("Publisher Costs", "PricePublisher", kpiProgSortConfig, handleKpiProgSort)}
                        <TableHead className="text-center">Trend</TableHead>
                        {renderSortableHeader("ADY Margin", "margin", kpiProgSortConfig, handleKpiProgSort)}
                        <TableHead className="text-center">Trend</TableHead>
                        {renderSortableHeader("Profit %", "marginPercentage", kpiProgSortConfig, handleKpiProgSort)}
                        {/* Detailed columns - conditionally rendered */}
                        {showDetailedColumns && (
                          <>
                            {renderSortableHeader("Bid Requests", "network_operations_bid_requests", kpiProgSortConfig, handleKpiProgSort, <span className="border-l-2 border-gray-300 pl-2">Bid Requests</span>)}
                            <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>
                            {renderSortableHeader("Bid Responses", "network_operations_bid_responses", kpiProgSortConfig, handleKpiProgSort)}
                            <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>
                            {renderSortableHeader("Impressions", "network_operations_impressions", kpiProgSortConfig, handleKpiProgSort)}
                            <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>
                            {renderSortableHeader("eCPM Publisher", "ecpmPublisher", kpiProgSortConfig, handleKpiProgSort, 
                              <TooltipProvider delayDuration={200}>
                                <UiTooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center justify-center gap-1 cursor-help text-center border-l-2 border-gray-300 pl-2">
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
                            )}
                            <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>
                            {renderSortableHeader("RPBR/M", "rpbrPerMillion", kpiProgSortConfig, handleKpiProgSort,
                              <TooltipProvider delayDuration={200}>
                                <UiTooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center justify-center gap-1 cursor-help text-center border-l-2 border-gray-300 pl-2">
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
                            )}
                            <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>
                            {renderSortableHeader("Fill Rate", "fillRate", kpiProgSortConfig, handleKpiProgSort,
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
                            )}
                            <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>
                            {renderSortableHeader("Win Rate", "winRate", kpiProgSortConfig, handleKpiProgSort,
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
                            )}
                            <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>
                           
                          </>
                        )}
                      </>
                    )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                  {analyticsData.map((item, index) => {
                    const isExpanded = expandedDates.has(item.dateKey || item.date);
                    const isLoading = loadingHourlyData.has(item.dateKey || item.date);
                    const hourlyData = hourlyDataCache[item.dateKey || item.date] || [];
                    
                    return (
                      <React.Fragment key={index}>
                        <TableRow className={viewMode === 'daily' ? 'cursor-pointer hover:bg-slate-50' : ''}>
                          <TableCell 
                            className={`font-medium text-center ${viewMode === 'daily' ? 'cursor-pointer' : ''}`}
                            onClick={viewMode === 'daily' ? () => toggleDateExpansion(item.date, item.dateKey || item.date) : undefined}
                          >
                            <div className="flex items-center justify-center gap-2">
                              {viewMode === 'daily' && (
                                isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-slate-500" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-slate-500" />
                                )
                              )}
                              <span>{item.date}</span>
                            </div>
                          </TableCell>
                      {viewMode === 'hourly' ? (
                        <>
                          <TableCell className="text-center text-green-600">
                            {formatCurrency(item.PriceAdvertiser_PublisherSide)}
                        </TableCell>
                          <TableCell className="text-center text-green-600 opacity-60">
                            {item.yesterdayData ? formatCurrency(item.yesterdayData.PriceAdvertiser_PublisherSide) : '—'}
                          </TableCell>
                          <TableCell className="text-center border-r-2 border-gray-300">
                            <div className="flex items-center justify-center gap-1">
                              {item.dspRevenueTrend === 'up' && (
                                <>
                                  <ArrowUpRight className="w-4 h-4 text-green-500" />
                                  <span className="text-green-500 text-xs font-medium">+{item.dspRevenueChangePercent}%</span>
                                </>
                              )}
                              {item.dspRevenueTrend === 'down' && (
                                <>
                                  <ArrowDownRight className="w-4 h-4 text-red-500" />
                                  <span className="text-red-500 text-xs font-medium">{item.dspRevenueChangePercent}%</span>
                                </>
                              )}
                              {item.dspRevenueTrend === 'same' && (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                              </div>
                            </TableCell>
                          <TableCell className="text-center text-red-600">
                            {formatCurrency(item.PricePublisher)}
                            </TableCell>
                          <TableCell className="text-center text-red-600 opacity-60">
                            {item.yesterdayData ? formatCurrency(item.yesterdayData.PricePublisher) : '—'}
                          </TableCell>
                          <TableCell className="text-center border-r-2 border-gray-300">
                            <div className="flex items-center justify-center gap-1">
                              {item.publisherCostsTrend === 'up' && (
                                <>
                                  <ArrowUpRight className="w-4 h-4 text-red-500" />
                                  <span className="text-red-500 text-xs font-medium">+{item.publisherCostsChangePercent}%</span>
                                </>
                              )}
                              {item.publisherCostsTrend === 'down' && (
                                <>
                                  <ArrowDownRight className="w-4 h-4 text-green-500" />
                                  <span className="text-green-500 text-xs font-medium">{item.publisherCostsChangePercent}%</span>
                                </>
                              )}
                              {item.publisherCostsTrend === 'same' && (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                              </div>
                            </TableCell>
                          <TableCell className="text-center text-black">
                            {formatCurrency(item.margin)}
                          </TableCell>
                          <TableCell className="text-center text-black opacity-60">
                            {item.yesterdayData ? formatCurrency(item.yesterdayData.margin) : '—'}
                          </TableCell>
                          <TableCell className="text-center border-r-2 border-gray-300">
                            <div className="flex items-center justify-center gap-1">
                              {item.marginTrend === 'up' && (
                                <>
                                  <ArrowUpRight className="w-4 h-4 text-green-500" />
                                  <span className="text-green-500 text-xs font-medium">+{item.marginChangePercent}%</span>
                                </>
                              )}
                              {item.marginTrend === 'down' && (
                                <>
                                  <ArrowDownRight className="w-4 h-4 text-red-500" />
                                  <span className="text-red-500 text-xs font-medium">{item.marginChangePercent}%</span>
                                </>
                              )}
                              {item.marginTrend === 'same' && (
                                <span className="text-gray-400 text-xs">—</span>
                              )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                            {item.marginPercentage > 0 ? (
                              <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                                {item.marginPercentage}%
                              </span>
                            ) : (
                              <Badge variant="destructive">
                                {item.marginPercentage}%
                              </Badge>
                            )}
                            </TableCell>
                            <TableCell className="text-center">
                            {item.yesterdayData ? (
                              item.yesterdayData.marginPercentage > 0 ? (
                                <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white opacity-60 inline-block">
                                  {item.yesterdayData.marginPercentage}%
                                </span>
                              ) : (
                                <Badge variant="destructive" className="opacity-60">
                                  {item.yesterdayData.marginPercentage}%
                                </Badge>
                              )
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                            </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-center text-green-600">
                            {formatCurrency(item.PriceAdvertiser_PublisherSide)}
                                            </TableCell>
                          <TableCell className="text-center border-r-2 border-gray-300">
                                              <div className="flex items-center justify-center gap-1">
                              {item.dspRevenueTrend === 'up' && (
                                                  <>
                                  <ArrowUpRight className="w-4 h-4 text-green-500" />
                                  <span className="text-green-500 text-xs font-medium">+{item.dspRevenueChangePercent}%</span>
                                                  </>
                                                )}
                              {item.dspRevenueTrend === 'down' && (
                                                  <>
                                  <ArrowDownRight className="w-4 h-4 text-red-500" />
                                  <span className="text-red-500 text-xs font-medium">{item.dspRevenueChangePercent}%</span>
                                                  </>
                                                )}
                              {item.dspRevenueTrend === 'same' && (
                                                  <span className="text-gray-400 text-xs">—</span>
                                                )}
                                              </div>
                                            </TableCell>
                          <TableCell className="text-center text-red-600">
                            {formatCurrency(item.PricePublisher)}
                                            </TableCell>
                          <TableCell className="text-center border-r-2 border-gray-300">
                                              <div className="flex items-center justify-center gap-1">
                              {item.publisherCostsTrend === 'up' && (
                                                  <>
                                  <ArrowUpRight className="w-4 h-4 text-red-500" />
                                  <span className="text-red-500 text-xs font-medium">+{item.publisherCostsChangePercent}%</span>
                                                  </>
                                                )}
                              {item.publisherCostsTrend === 'down' && (
                                                  <>
                                  <ArrowDownRight className="w-4 h-4 text-green-500" />
                                  <span className="text-green-500 text-xs font-medium">{item.publisherCostsChangePercent}%</span>
                                                  </>
                                                )}
                              {item.publisherCostsTrend === 'same' && (
                                                  <span className="text-gray-400 text-xs">—</span>
                                                )}
                                              </div>
                                            </TableCell>
                          <TableCell className="text-center text-black">
                            {formatCurrency(item.margin)}
                                            </TableCell>
                          <TableCell className="text-center border-r-2 border-gray-300">
                                              <div className="flex items-center justify-center gap-1">
                              {item.marginTrend === 'up' && (
                                                  <>
                                  <ArrowUpRight className="w-4 h-4 text-green-500" />
                                  <span className="text-green-500 text-xs font-medium">+{item.marginChangePercent}%</span>
                                                  </>
                                                )}
                              {item.marginTrend === 'down' && (
                                                  <>
                                  <ArrowDownRight className="w-4 h-4 text-red-500" />
                                  <span className="text-red-500 text-xs font-medium">{item.marginChangePercent}%</span>
                                                  </>
                                                )}
                              {item.marginTrend === 'same' && (
                                                  <span className="text-gray-400 text-xs">—</span>
                                                )}
                                              </div>
                                            </TableCell>
                          <TableCell className="text-center">
                            {item.marginPercentage > 0 ? (
                              <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                                {item.marginPercentage}%
                              </span>
                            ) : (
                              <Badge variant="destructive">
                                {item.marginPercentage}%
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
                  })}
                  </TableBody>
                </Table>
                {/* Period and Last Updated Info */}
                {!loading && analyticsData.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Period: {startDate ? new Date(startDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'} - {endDate ? new Date(endDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}
                    </span>
                    <span>
                      Last updated: {lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                )}
            </CardContent>
          </Card>
        )}

      </div>
      </div>

      {/* Right Sidebar Menu */}
      <div className={`${isMenuOpen ? 'flex' : 'hidden'} md:flex flex-col w-8 bg-white border-l border-slate-200 fixed right-0 top-[70px] bottom-0 z-40 lg:z-10`}>
        {/* Menu Items */}
        <div className="flex flex-col items-center py-8 space-y-1">
          {menuItems.map((item) => {
            const isSelected = selectedFilter === item.id;
            const isLongLabel = item.id === 'kpi-prog' || item.id === 'ad-kind';
            const isExtraLongLabel = item.id === 'ad-domain' || item.id === 'site-domain';
            const isOverview = item.id === 'overview';
            return (
              <button
                key={item.id}
                onClick={async () => {
                  if (isSelected) {
                    setIsPanelOpen(false);
                    setSelectedFilter(null);
                  } else {
                    setSelectedFilter(item.id);
                    setIsPanelOpen(true);
                    setIsMenuOpen(false); // Close mobile menu after selection
                    // Fetch data when filter is selected
                    if (item.id === 'overview') {
                      await fetchBusinessReviewGlobal();
                    } else if (item.id === 'device') {
                      await fetchDeviceData();
                    } else if (item.id === 'ad-kind') {
                      await fetchAdKindData();
                    } else if (item.id === 'geo') {
                      await fetchGeoData();
                    } else if (item.id === 'dsp') {
                      await fetchDspData();
                    } else if (item.id === 'seat') {
                      await fetchSeatData();
                    } else if (item.id === 'ad-domain') {
                      await fetchAdDomainData();
                    } else if (item.id === 'site-domain') {
                      await fetchSiteDomainData();
                    }
                  }
                }}
                className={`relative flex items-center justify-center w-full transition-all rounded-lg ${
                  isExtraLongLabel ? 'py-10' : isLongLabel ? 'py-8' : isOverview ? 'py-10' : 'py-6'
                } ${
                  isSelected
                    ? 'text-[rgb(75,99,226)]'
                    : 'text-slate-600 hover:bg-[rgb(40,62,173)] hover:text-white'
                }`}
              >
                {/* Vertical indicator bar for selected item */}
                {isSelected && (
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[rgb(75,99,226)] rounded-r-lg" />
                )}
                <span 
                  className="font-semibold text-[10px] whitespace-nowrap"
                  style={{ transform: 'rotate(90deg)' }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Side Panel - Opens from right */}
      {isPanelOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 z-30 transition-opacity duration-1000"
            onClick={() => {
              setIsPanelOpen(false);
              setSelectedFilter(null);
            }}
          />
          
          {/* Panel */}
          <div className="fixed right-0 md:right-12 top-[70px] w-full md:w-[90%] min-h-[650px] max-h-[650px] bg-white border-l border-slate-200 shadow-2xl z-50 animate-in slide-in-from-right duration-1000 ease-in-out flex flex-col">
            {/* Panel Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-800">
                  {menuItems.find(item => item.id === selectedFilter)?.label || 'Filter'}
                </h2>
                <div className="flex items-center gap-2">
                  {selectedFilter === 'kpi-prog' && analyticsData.length > 0 && (
                    <Button
                      onClick={exportKPIPROGToCSV}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export CSV
                    </Button>
                  )}
                  {selectedFilter === 'device' && deviceData.length > 0 && (
                    <Button
                      onClick={exportDeviceDataToCSV}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export CSV
                    </Button>
                  )}
                  {selectedFilter === 'geo' && geoData.length > 0 && (
                    <Button
                      onClick={exportGeoDataToCSV}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export CSV
                    </Button>
                  )}
                  {selectedFilter === 'ad-kind' && adKindData.length > 0 && (
                    <Button
                      onClick={() => {
                        // Export AD KIND data to CSV
                        if (adKindData.length === 0) return;
                        const headers = ['AD Kind', 'Impressions', 'DSP Revenue', 'Publisher Costs', 'ADY Margin', 'Margin %'];
                        const rows = adKindData.map((item) => [
                          item.adKindDisplay || item.adKind || '',
                          (item.impressions || 0).toString(),
                          (item.PriceAdvertiser_PublisherSide || 0).toFixed(2),
                          (item.PricePublisher || 0).toFixed(2),
                          (item.margin || 0).toFixed(2),
                          item.marginPercentage || '0.00'
                        ]);
                        const csvContent = [
                          headers.join(','),
                          ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
                        ].join('\n');
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement('a');
                        const url = URL.createObjectURL(blob);
                        link.setAttribute('href', url);
                        link.setAttribute('download', `AD_Kind_Data_${new Date().toISOString().split('T')[0]}.csv`);
                        link.style.visibility = 'hidden';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export CSV
                    </Button>
                  )}
                  {selectedFilter === 'dsp' && dspData.length > 0 && (
                    <Button
                      onClick={() => {
                        // Export DSP data to CSV
                        if (dspData.length === 0) return;
                        const headers = ['Partner ID', 'Partner Name', 'DSP Revenue', 'Publisher Costs', 'ADY Margin', 'Margin %'];
                        const rows = dspData.map((item) => [
                          item.partnerId || 'Unknown',
                          item.partnerName || 'Unknown',
                          ((item.PriceAdvertiser_PublisherSide || 0) / 1000000).toFixed(2),
                          ((item.PricePublisher || 0) / 1000000).toFixed(2),
                          ((item.margin || 0) / 1000000).toFixed(2),
                          item.marginPercentage || '0.00'
                        ]);
                        const csvContent = [
                          headers.join(','),
                          ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
                        ].join('\n');
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement('a');
                        const url = URL.createObjectURL(blob);
                        link.setAttribute('href', url);
                        link.setAttribute('download', `DSP_Data_${new Date().toISOString().split('T')[0]}.csv`);
                        link.style.visibility = 'hidden';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export CSV
                    </Button>
                  )}
                  {selectedFilter === 'seat' && seatData.length > 0 && (
                    <Button
                      onClick={() => {
                        // Export SEAT data to CSV
                        if (seatData.length === 0) return;
                        const headers = ['Seat Name', 'Partner Name', 'DSP Revenue', 'Publisher Costs', 'ADY Margin', 'Margin %'];
                        const rows = seatData.map((item) => [
                          item.seatName || 'Unknown',
                          item.partnerName || 'Unknown',
                          ((item.PriceAdvertiser_PublisherSide || 0) / 1000000).toFixed(2),
                          ((item.PricePublisher || 0) / 1000000).toFixed(2),
                          ((item.margin || 0) / 1000000).toFixed(2),
                          item.marginPercentage || '0.00'
                        ]);
                        const csvContent = [
                          headers.join(','),
                          ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
                        ].join('\n');
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement('a');
                        const url = URL.createObjectURL(blob);
                        link.setAttribute('href', url);
                        link.setAttribute('download', `SEAT_Data_${new Date().toISOString().split('T')[0]}.csv`);
                        link.style.visibility = 'hidden';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export CSV
                    </Button>
                  )}
                  {selectedFilter === 'ad-domain' && adDomainData.length > 0 && (
                    <Button
                      onClick={() => {
                        // Export AD DOMAIN data to CSV
                        if (adDomainData.length === 0) return;
                        const headers = ['Ad Domain', 'Partner Name', 'DSP Revenue', 'Publisher Costs', 'ADY Margin', 'Margin %'];
                        const rows = adDomainData.map((item) => [
                          item.adDomain || 'Unknown',
                          item.partnerName || 'Unknown',
                          ((item.PriceAdvertiser_PublisherSide || 0) / 1000000).toFixed(2),
                          ((item.PricePublisher || 0) / 1000000).toFixed(2),
                          ((item.margin || 0) / 1000000).toFixed(2),
                          item.marginPercentage || '0.00'
                        ]);
                        const csvContent = [
                          headers.join(','),
                          ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
                        ].join('\n');
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement('a');
                        const url = URL.createObjectURL(blob);
                        link.setAttribute('href', url);
                        link.setAttribute('download', `AD_Domain_Data_${new Date().toISOString().split('T')[0]}.csv`);
                        link.style.visibility = 'hidden';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export CSV
                    </Button>
                  )}
                  {selectedFilter === 'site-domain' && siteDomainData.length > 0 && (
                    <Button
                      onClick={() => {
                        // Export SITE DOMAIN data to CSV
                        if (siteDomainData.length === 0) return;
                        const headers = ['Site Name', 'DSP Revenue', 'Publisher Costs', 'ADY Margin', 'Margin %'];
                        const rows = siteDomainData.map((item) => [
                          item.siteDomain || item.siteName || 'Unknown',
                          ((item.PriceAdvertiser_PublisherSide || 0) / 1000000).toFixed(2),
                          ((item.PricePublisher || 0) / 1000000).toFixed(2),
                          ((item.margin || 0) / 1000000).toFixed(2),
                          item.marginPercentage || '0.00'
                        ]);
                        const csvContent = [
                          headers.join(','),
                          ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
                        ].join('\n');
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement('a');
                        const url = URL.createObjectURL(blob);
                        link.setAttribute('href', url);
                        link.setAttribute('download', `Site_Domain_Data_${new Date().toISOString().split('T')[0]}.csv`);
                        link.style.visibility = 'hidden';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Export CSV
                    </Button>
                  )}
                  <button
                    onClick={() => {
                      setIsPanelOpen(false);
                      setSelectedFilter(null);
                    }}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-6 pb-4">
                  {selectedFilter === 'overview' && (
                    <BusinessReviewOverview
                      processedData={businessReviewData?.processedData || []}
                      loading={loadingBusinessReview}
                      error={businessReviewError}
                      title="DSP Performance Dashboard"
                      subtitlePrefix="Business Review"
                      exportToPDF={exportBusinessReviewGlobalToPDF}
                      entityType="realm"
                    />
                  )}
                {selectedFilter === 'ad-kind' && (
                  <div className="w-full">
                    {loadingAdKindData ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-[rgb(75,99,226)]" />
                        <span className="ml-2 text-slate-600">Loading AD KIND data...</span>
                      </div>
                    ) : (
                      <Card className="border-slate-200 shadow-sm">
                        <CardContent className="p-0">
                          <Table className="text-xs sm:text-sm w-full">
                            <TableHeader>
                              <TableRow>
                                {renderSortableHeader("AD Kind", "adKind", adKindSortConfig, handleAdKindSort)}
                                {renderSortableHeader("Impressions", "impressions", adKindSortConfig, handleAdKindSort)}
                                {renderSortableHeader("DSP Revenue", "PriceAdvertiser_PublisherSide", adKindSortConfig, handleAdKindSort)}
                                {renderSortableHeader("Publisher Costs", "PricePublisher", adKindSortConfig, handleAdKindSort)}
                                {renderSortableHeader("ADY Margin", "margin", adKindSortConfig, handleAdKindSort)}
                                {renderSortableHeader("Margin %", "marginPercentage", adKindSortConfig, handleAdKindSort)}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {adKindData.length > 0 ? (
                                adKindData.map((item, index) => (
                                  <TableRow key={index}>
                                    <TableCell className="text-center font-medium">
                                      {item.adKindDisplay || item.adKind || ''}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {item.impressions?.toLocaleString() || '0'}
                                    </TableCell>
                                    <TableCell className="text-center text-green-600">
                                      {new Intl.NumberFormat('en-US', {
                                        style: 'currency',
                                        currency: 'USD',
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                      }).format(item.PriceAdvertiser_PublisherSide || 0)}
                                    </TableCell>
                                    <TableCell className="text-center text-red-600">
                                      {new Intl.NumberFormat('en-US', {
                                        style: 'currency',
                                        currency: 'USD',
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                      }).format(item.PricePublisher || 0)}
                                    </TableCell>
                                    <TableCell className="text-center text-black">
                                      {new Intl.NumberFormat('en-US', {
                                        style: 'currency',
                                        currency: 'USD',
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                      }).format(item.margin || 0)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {item.marginPercentage > 0 ? (
                                        <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                                          {item.marginPercentage}%
                                        </span>
                                      ) : (
                                        <Badge variant="destructive">
                                          {item.marginPercentage}%
                                        </Badge>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))
                              ) : (
                                <TableRow>
                                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                                    No AD KIND data available
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {selectedFilter === 'site-domain' && (
                  <div className="w-full">
                    {loadingSiteDomainData ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-[rgb(75,99,226)]" />
                        <span className="ml-2 text-slate-600">Loading SITE DOMAIN data...</span>
                      </div>
                    ) : (
                      <Card className="border-slate-200 shadow-sm">
                        <CardContent className="p-0">
                          <Table className="text-xs sm:text-sm w-full">
                            <TableHeader>
                              <TableRow>
                                {renderSortableHeader("Site Name", "siteName", siteDomainSortConfig, handleSiteDomainSort)}
                                {renderSortableHeader("DSP Revenue", "PriceAdvertiser_PublisherSide", siteDomainSortConfig, handleSiteDomainSort)}
                                {renderSortableHeader("Publisher Costs", "PricePublisher", siteDomainSortConfig, handleSiteDomainSort)}
                                {renderSortableHeader("ADY Margin", "margin", siteDomainSortConfig, handleSiteDomainSort)}
                                {renderSortableHeader("Margin %", "marginPercentage", siteDomainSortConfig, handleSiteDomainSort)}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {siteDomainData.length > 0 ? (
                                siteDomainData.map((item, index) => (
                                  <TableRow key={index}>
                                    <TableCell className="text-center font-medium">
                                      {item.siteName}
                                    </TableCell>
                                    <TableCell className="text-center text-green-600">
                                      {formatCurrency(item.PriceAdvertiser_PublisherSide || 0)}
                                    </TableCell>
                                    <TableCell className="text-center text-red-600">
                                      {formatCurrency(item.PricePublisher || 0)}
                                    </TableCell>
                                    <TableCell className="text-center text-black">
                                      {formatCurrency(item.margin)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {item.marginPercentage > 0 ? (
                                        <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                                          {item.marginPercentage}%
                                        </span>
                                      ) : (
                                        <Badge variant="destructive">
                                          {item.marginPercentage}%
                                        </Badge>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))
                              ) : (
                                <TableRow>
                                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                    No SITE DOMAIN data available
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {selectedFilter === 'geo' && (
                  <div className="w-full">
                    {loadingGeoData ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-[rgb(75,99,226)]" />
                        <span className="ml-2 text-slate-600">Loading GEO data...</span>
                      </div>
                    ) : (
                      <Card className="border-slate-200 shadow-sm">
                        <CardContent className="p-0">
                          <Table className="text-xs sm:text-sm w-full">
                            <TableHeader>
                              <TableRow>
                                {renderSortableHeader("Country", "country", geoSortConfig, handleGeoSort)}
                                {renderSortableHeader("DSP Revenue", "PriceAdvertiser_PublisherSide", geoSortConfig, handleGeoSort)}
                                {renderSortableHeader("Publisher Costs", "PricePublisher", geoSortConfig, handleGeoSort)}
                                {renderSortableHeader("ADY Margin", "margin", geoSortConfig, handleGeoSort)}
                                {renderSortableHeader("Impressions", "impressions", geoSortConfig, handleGeoSort)}
                                {renderSortableHeader("Click", "clicks", geoSortConfig, handleGeoSort)}
                                {renderSortableHeader("CTR", "ctr", geoSortConfig, handleGeoSort)}
                                {renderSortableHeader("Margin %", "marginPercentage", geoSortConfig, handleGeoSort)}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {geoData.length > 0 ? (
                                geoData.map((item, index) => (
                                  <TableRow key={index}>
                                    <TableCell className="text-center font-medium">
                                      {item.country || 'Unknown'}
                                    </TableCell>
                                    <TableCell className="text-center text-green-600">
                                      {formatCurrency(item.PriceAdvertiser_PublisherSide || 0)}
                                    </TableCell>
                                    <TableCell className="text-center text-red-600">
                                      {formatCurrency(item.PricePublisher || 0)}
                                    </TableCell>
                                    <TableCell className="text-center text-black">
                                      {formatCurrency(item.margin)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {formatLargeNumber(item.impressions || 0)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {formatLargeNumber(item.clicks || 0)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {formatPercentage(item.ctr || 0)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {item.marginPercentage > 0 ? (
                                        <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                                          {item.marginPercentage}%
                                        </span>
                                      ) : (
                                        <Badge variant="destructive">
                                          {item.marginPercentage}%
                                        </Badge>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))
                              ) : (
                                <TableRow>
                                  <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                                    No GEO data available
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {selectedFilter === 'kpi-prog' && (
                  <div className="w-full">
                    <Card className="border-slate-200 shadow-sm">
                      <CardContent className="p-0">
                        <Table className="text-xs sm:text-sm w-full">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-center">Date</TableHead>
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
                                      eCPM Publisher represents the effective cost per thousand impressions from the publisher's perspective.
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
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {analyticsData.length > 0 ? (
                              analyticsData.map((item, index) => (
                                <TableRow key={index}>
                                  <TableCell className="text-center font-medium">
                                    {item.date || item.formattedDate || 'N/A'}
                                  </TableCell>
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
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={15} className="text-center py-8 text-slate-500">
                                  No data available
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </div>
                )}
                {selectedFilter === 'device' && (
                  <div className="w-full">
                    {loadingDeviceData ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-[rgb(75,99,226)]" />
                        <span className="ml-2 text-slate-600">Loading device data...</span>
                      </div>
                    ) : (
                      <Card className="border-slate-200 shadow-sm">
                        <CardContent className="p-0">
                          <Table className="text-xs sm:text-sm w-full">
                            <TableHeader>
                              <TableRow>
                                {renderSortableHeader("Device", "device", deviceSortConfig, handleDeviceSort)}
                                {renderSortableHeader("DSP Revenue", "PriceAdvertiser_PublisherSide", deviceSortConfig, handleDeviceSort)}
                                {renderSortableHeader("Publisher Costs", "PricePublisher", deviceSortConfig, handleDeviceSort)}
                                {renderSortableHeader("ADY Margin", "margin", deviceSortConfig, handleDeviceSort)}
                                {renderSortableHeader("Margin %", "marginPercentage", deviceSortConfig, handleDeviceSort)}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {deviceData.length > 0 ? (
                                deviceData.map((item, index) => (
                                  <React.Fragment key={index}>
                                    <TableRow 
                                      className={`cursor-pointer hover:bg-slate-50 ${selectedDevice === item.device ? 'bg-blue-50' : ''}`}
                                      onClick={() => handleDeviceRowClick(item.device)}
                                    >
                                      <TableCell className="text-center font-medium">
                                        {item.device}
                                      </TableCell>
                                      <TableCell className="text-center text-green-600">
                                        {formatCurrency(item.PriceAdvertiser_PublisherSide || 0)}
                                      </TableCell>
                                      <TableCell className="text-center text-red-600">
                                        {formatCurrency(item.PricePublisher || 0)}
                                      </TableCell>
                                      <TableCell className="text-center text-black">
                                        {formatCurrency(item.margin)}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {item.marginPercentage > 0 ? (
                                          <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                                            {item.marginPercentage}%
                                          </span>
                                        ) : (
                                          <Badge variant="destructive">
                                            {item.marginPercentage}%
                                          </Badge>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                    {/* Detailed view for selected device */}
                                    {selectedDevice === item.device && (
                                      <TableRow>
                                        <TableCell colSpan={5} className="p-0 bg-slate-50">
                                          {loadingDeviceDetail ? (
                                            <div className="flex items-center justify-center py-8">
                                              <Loader2 className="w-5 h-5 animate-spin text-[rgb(75,99,226)]" />
                                              <span className="ml-2 text-slate-600">Loading detail data...</span>
                                            </div>
                                          ) : deviceDetailData.length > 0 ? (
                                            <div className="p-4">
                                              <h3 className="text-sm font-semibold mb-3 text-slate-700">
                                                {item.device} - Detail by Date
                                              </h3>
                                              <Table className="text-xs w-full">
                                                <TableHeader>
                                                  <TableRow>
                                                    <TableHead className="text-center">Date</TableHead>
                                                    <TableHead className="text-center">DSP Revenue</TableHead>
                                                    <TableHead className="text-center">Publisher Costs</TableHead>
                                                    <TableHead className="text-center">ADY Margin</TableHead>
                                                    <TableHead className="text-center">Margin %</TableHead>
                                                  </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                  {deviceDetailData.map((detailItem, detailIndex) => (
                                                    <TableRow key={detailIndex}>
                                                      <TableCell className="text-center font-medium">
                                                        {detailItem.date}
                                                      </TableCell>
                                                      <TableCell className="text-center text-green-600">
                                                        {formatCurrency(detailItem.PriceAdvertiser_PublisherSide || 0)}
                                                      </TableCell>
                                                      <TableCell className="text-center text-red-600">
                                                        {formatCurrency(detailItem.PricePublisher || 0)}
                                                      </TableCell>
                                                      <TableCell className="text-center text-black">
                                                        {formatCurrency(detailItem.margin)}
                                                      </TableCell>
                                                      <TableCell className="text-center">
                                                        {detailItem.marginPercentage > 0 ? (
                                                          <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                                                            {detailItem.marginPercentage}%
                                                          </span>
                                                        ) : (
                                                          <Badge variant="destructive">
                                                            {detailItem.marginPercentage}%
                                                          </Badge>
                                                        )}
                                                      </TableCell>
                                                    </TableRow>
                                                  ))}
                                                </TableBody>
                                              </Table>
                                            </div>
                                          ) : (
                                            <div className="text-center py-8 text-slate-500 text-sm">
                                              No detail data available for this device
                                            </div>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </React.Fragment>
                                ))
                              ) : (
                                <TableRow>
                                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                                    No device data available
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
                {selectedFilter === 'dsp' && (
                  <div className="w-full">
                    {loadingDspData ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-[rgb(75,99,226)]" />
                        <span className="ml-2 text-slate-600">Loading DSP data...</span>
                      </div>
                    ) : (
                      <Card className="border-slate-200 shadow-sm">
                        <CardContent className="p-0">
                          {console.log('🔍 Rendering DSP table, dspData:', dspData, 'length:', dspData.length)}
                          <Table className="text-xs sm:text-sm w-full">
                            <TableHeader>
                              <TableRow>
                                {renderSortableHeader("Partner ID", "partnerId", dspSortConfig, handleDspSort)}
                                {renderSortableHeader("Partner Name", "partnerName", dspSortConfig, handleDspSort)}
                                {renderSortableHeader("DSP Revenue", "PriceAdvertiser_PublisherSide", dspSortConfig, handleDspSort)}
                                {renderSortableHeader("Publisher Costs", "PricePublisher", dspSortConfig, handleDspSort)}
                                {renderSortableHeader("ADY Margin", "margin", dspSortConfig, handleDspSort)}
                                {renderSortableHeader("Margin %", "marginPercentage", dspSortConfig, handleDspSort)}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {dspData.length > 0 ? (
                                dspData.map((item, index) => (
                                  <React.Fragment key={index}>
                                    <TableRow
                                      className={`cursor-pointer hover:bg-slate-50 ${selectedDsp === item.partnerId ? 'bg-blue-50' : ''}`}
                                      onClick={() => handleDspRowClick(item.partnerId, item.partnerName)}
                                    >
                                      <TableCell className="text-center font-medium">
                                        {item.partnerId}
                                      </TableCell>
                                      <TableCell className="text-center font-medium">
                                        {item.partnerName}
                                      </TableCell>
                                      <TableCell className="text-center text-green-600">
                                        {formatCurrency(item.PriceAdvertiser_PublisherSide || 0)}
                                      </TableCell>
                                      <TableCell className="text-center text-red-600">
                                        {formatCurrency(item.PricePublisher || 0)}
                                      </TableCell>
                                      <TableCell className="text-center text-black">
                                        {formatCurrency(item.margin)}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {item.marginPercentage > 0 ? (
                                          <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                                            {item.marginPercentage}%
                                          </span>
                                        ) : (
                                          <Badge variant="destructive">
                                            {item.marginPercentage}%
                                          </Badge>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                    {/* Detailed view for selected DSP */}
                                    {selectedDsp === item.partnerId && (
                                      <TableRow>
                                        <TableCell colSpan={6} className="p-0 bg-slate-50">
                                          {loadingDspDetail ? (
                                            <div className="flex items-center justify-center py-8">
                                              <Loader2 className="w-6 h-6 animate-spin text-[rgb(75,99,226)]" />
                                              <span className="ml-2 text-slate-600 text-sm">Loading detail data...</span>
                                            </div>
                                          ) : dspDetailData.length > 0 ? (
                                            <div className="p-4">
                                              <h3 className="text-sm font-semibold mb-3 text-slate-700">
                                                {item.partnerName} - Detail by Date
                                              </h3>
                                              <Table className="text-xs w-full">
                                                <TableHeader>
                                                  <TableRow>
                                                    <TableHead className="text-center">Date</TableHead>
                                                    <TableHead className="text-center">DSP Revenue</TableHead>
                                                    <TableHead className="text-center">Publisher Costs</TableHead>
                                                    <TableHead className="text-center">ADY Margin</TableHead>
                                                    <TableHead className="text-center">Margin %</TableHead>
                                                  </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                  {dspDetailData.map((detailItem, detailIndex) => (
                                                    <TableRow key={detailIndex}>
                                                      <TableCell className="text-center font-medium">
                                                        {detailItem.date}
                                                      </TableCell>
                                                      <TableCell className="text-center text-green-600">
                                                        {formatCurrency(detailItem.PriceAdvertiser_PublisherSide || 0)}
                                                      </TableCell>
                                                      <TableCell className="text-center text-red-600">
                                                        {formatCurrency(detailItem.PricePublisher || 0)}
                                                      </TableCell>
                                                      <TableCell className="text-center text-black">
                                                        {formatCurrency(detailItem.margin)}
                                                      </TableCell>
                                                      <TableCell className="text-center">
                                                        {detailItem.marginPercentage > 0 ? (
                                                          <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                                                            {detailItem.marginPercentage}%
                                                          </span>
                                                        ) : (
                                                          <Badge variant="destructive">
                                                            {detailItem.marginPercentage}%
                                                          </Badge>
                                                        )}
                                                      </TableCell>
                                                    </TableRow>
                                                  ))}
                                                </TableBody>
                                              </Table>
                                            </div>
                                          ) : (
                                            <div className="p-4 text-center text-slate-500 text-sm">
                                              No detail data available for this DSP
                                            </div>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </React.Fragment>
                                ))
                              ) : (
                                <TableRow>
                                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                                    No DSP data available
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
                {selectedFilter === 'seat' && (
                  <div className="w-full">
                    {loadingSeatData ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-[rgb(75,99,226)]" />
                        <span className="ml-2 text-slate-600">Loading SEAT data...</span>
                      </div>
                    ) : (
                      <Card className="border-slate-200 shadow-sm">
                        <CardContent className="p-0">
                          {console.log('🔍 Rendering SEAT table, seatData:', seatData, 'length:', seatData.length)}
                          <Table className="text-xs sm:text-sm w-full">
                            <TableHeader>
                              <TableRow>
                                {renderSortableHeader("Seat Name", "seatName", seatSortConfig, handleSeatSort)}
                                {renderSortableHeader("Partner Name", "partnerName", seatSortConfig, handleSeatSort)}
                                {renderSortableHeader("DSP Revenue", "PriceAdvertiser_PublisherSide", seatSortConfig, handleSeatSort)}
                                {renderSortableHeader("Publisher Costs", "PricePublisher", seatSortConfig, handleSeatSort)}
                                {renderSortableHeader("ADY Margin", "margin", seatSortConfig, handleSeatSort)}
                                {renderSortableHeader("Margin %", "marginPercentage", seatSortConfig, handleSeatSort)}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {seatData.length > 0 ? (
                                seatData.map((item, index) => (
                                  <TableRow key={index}>
                                    <TableCell className="text-center font-medium">
                                      {item.seatName}
                                    </TableCell>
                                    <TableCell className="text-center font-medium">
                                      {item.partnerName}
                                    </TableCell>
                                    <TableCell className="text-center text-green-600">
                                      {formatCurrency(item.PriceAdvertiser_PublisherSide || 0)}
                                    </TableCell>
                                    <TableCell className="text-center text-red-600">
                                      {formatCurrency(item.PricePublisher || 0)}
                                    </TableCell>
                                    <TableCell className="text-center text-black">
                                      {formatCurrency(item.margin)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {item.marginPercentage > 0 ? (
                                        <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                                          {item.marginPercentage}%
                                        </span>
                                      ) : (
                                        <Badge variant="destructive">
                                          {item.marginPercentage}%
                                        </Badge>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))
                              ) : (
                                <TableRow>
                                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                                    No SEAT data available
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
                {selectedFilter === 'ad-domain' && (
                  <div className="w-full">
                    {loadingAdDomainData ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-[rgb(75,99,226)]" />
                        <span className="ml-2 text-slate-600">Loading AD DOMAIN data...</span>
                      </div>
                    ) : (
                      <Card className="border-slate-200 shadow-sm">
                        <CardContent className="p-0">
                          {console.log('🔍 Rendering AD DOMAIN table, adDomainData:', adDomainData, 'length:', adDomainData.length)}
                          <Table className="text-xs sm:text-sm w-full">
                            <TableHeader>
                              <TableRow>
                                {renderSortableHeader("Ad Domain", "adDomain", adDomainSortConfig, handleAdDomainSort)}
                                {renderSortableHeader("Partner Name", "partnerName", adDomainSortConfig, handleAdDomainSort)}
                                {renderSortableHeader("DSP Revenue", "PriceAdvertiser_PublisherSide", adDomainSortConfig, handleAdDomainSort)}
                                {renderSortableHeader("Publisher Costs", "PricePublisher", adDomainSortConfig, handleAdDomainSort)}
                                {renderSortableHeader("ADY Margin", "margin", adDomainSortConfig, handleAdDomainSort)}
                                {renderSortableHeader("Margin %", "marginPercentage", adDomainSortConfig, handleAdDomainSort)}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {adDomainData.length > 0 ? (
                                adDomainData.map((item, index) => (
                                  <TableRow key={index}>
                                    <TableCell className="text-center font-medium">
                                      {item.adDomain}
                                    </TableCell>
                                    <TableCell className="text-center font-medium">
                                      {item.partnerName}
                                    </TableCell>
                                    <TableCell className="text-center text-green-600">
                                      {formatCurrency(item.PriceAdvertiser_PublisherSide || 0)}
                                    </TableCell>
                                    <TableCell className="text-center text-red-600">
                                      {formatCurrency(item.PricePublisher || 0)}
                                    </TableCell>
                                    <TableCell className="text-center text-black">
                                      {formatCurrency(item.margin)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {item.marginPercentage > 0 ? (
                                        <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                                          {item.marginPercentage}%
                                        </span>
                                      ) : (
                                        <Badge variant="destructive">
                                          {item.marginPercentage}%
                                        </Badge>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))
                              ) : (
                                <TableRow>
                                  <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                                    No AD DOMAIN data available
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
                </div>
              </div>
          </div>
        </>
      )}
    </div>
  );
}
