/**
 * Generic Dashboard Template Component
 * 
 * This component provides a reusable template for dashboard pages displaying
 * analytics for different entity types (realms, DSPs, deals, etc.).
 * 
 * Based on RealmDashboard.jsx structure with configurable props.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, DollarSign, ChevronDown, ChevronRight, ChevronLeft, ArrowUpRight, ArrowDownRight, BarChart3, Calendar, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cachedFetch } from '@/utils/apiCache';
import { TAILWIND_CLASSES } from '@/config/theme';
import HourlyAnalyticsSummaryCards from '@/components/analytics/HourlyAnalyticsSummaryCards';
import { computeHourlySummaryFromRawData } from '@/utils/hourlyProjections';

export default function DashboardTemplate({
  // Configuration
  title = "Analytics",
  searchPlaceholder = "Search...",
  entityNameSingular = "item", // For "X items found"
  entityNamePlural = "items",
  
  // API configuration
  apiEndpoint,
  topEntitiesPayload, // Function that returns payload for top entities
  buildHourlySummaryPayload = null, // (startDate, endDate) => PT1H payload for KPI cards in hourly mode
  fetchDailyDataForEntity, // Function that fetches daily data for an entity
  
  // Data processing
  processTopEntitiesResponse, // Function to process API response
  getEntityId, // Function to get entity ID from data item
  getEntityName, // Function to get entity display name
  formatCurrency = (value) => {
    const millions = value / 1000000;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(millions);
  },
  
  // Navigation
  analyticsPagePath,
  
  // Auth
  getAuthToken,
  
  // Daily data field names
  dailyDataFields = {
    revenue: 'entityRevenue',
    publisherCost: 'publisherCost',
    margin: 'margin',
    revenueTrend: 'revenueTrend',
    revenueChangePercent: 'revenueChangePercent',
    publisherCostsTrend: 'publisherCostsTrend',
    publisherCostsChangePercent: 'publisherCostsChangePercent',
    marginTrend: 'marginTrend',
    marginChangePercent: 'marginChangePercent'
  },
  
  // Additional header content
  additionalHeader,
  
  // Optional filter IDs for export filename
  filterRealmId = null,
  filterCompanyId = null,

  // Optional extra columns for top entities table
  extraColumns = [],

  // Optional extra columns for daily breakdown table
  extraDailyColumns = [],
  
  // Optional custom renderer for expanded row content (per-entity view)
  // If provided, replaces the default daily breakdown table.
  // Signature: ({ entityId, entityName, dailyData, loadingDaily, startDate, endDate }) => ReactNode
  renderExpandedContent = null,
  
  // Optional custom renderer for card layout (instead of table)
  // Signature: (item, { index, globalIndex, entityId, entityName, startDate, endDate }) => ReactNode
  renderEntityCard = null,
  
  // Enable card layout (grid of cards) instead of table rows
  cardLayout = false,
  
  // Optional: hide summary metrics columns in the main row (keep only Rank + Name)
  hideSummaryMetrics = false,

  // Optional: override default page size
  pageSize: pageSizeOverride = null,
}) {
  const navigate = useNavigate();
  const [topEntitiesData, setTopEntitiesData] = useState([]);
  const [summaryStats, setSummaryStats] = useState(null);
  const [hourlySummaryStats, setHourlySummaryStats] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [dailyDataCache, setDailyDataCache] = useState({});
  const [loadingDailyData, setLoadingDailyData] = useState(new Set());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const authRetryRef = useRef(null);

  // Dashboard view mode (daily/hourly) - when hourly, summary uses Yesterday+Today
  const [dashboardViewMode, setDashboardViewMode] = useState(() => {
    if (typeof window === 'undefined') return 'daily';
    return localStorage.getItem('dashboard-view-mode') || 'daily';
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem('dashboard-view-mode') || 'daily';
      setDashboardViewMode(stored);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const stored = localStorage.getItem('dashboard-view-mode') || 'daily';
      if (stored !== dashboardViewMode) setDashboardViewMode(stored);
    }, 200);
    return () => clearInterval(id);
  }, [dashboardViewMode]);

  // Effective dates for fetch: hourly = Yesterday+Today, daily = time range
  const effectiveDates = React.useMemo(() => {
    if (dashboardViewMode === 'hourly') {
      const now = new Date();
      const todayYear = now.getUTCFullYear();
      const todayMonth = now.getUTCMonth();
      const todayDate = now.getUTCDate();
      const yesterday = new Date(Date.UTC(todayYear, todayMonth, todayDate - 1, 0, 0, 0, 0));
      const todayEnd = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
      return {
        start: yesterday.toISOString().split('T')[0],
        end: todayEnd.toISOString().split('T')[0]
      };
    }
    return { start: startDate, end: endDate };
  }, [dashboardViewMode, startDate, endDate]);
  
  // Search and pagination states - searchTerm is now managed in Layout header
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(pageSizeOverride || 20);
  const [totalCount, setTotalCount] = useState(0);

  const baseColumnCount = hideSummaryMetrics ? 2 : 6;
  const totalColumnCount = baseColumnCount + extraColumns.length;
  const baseDailyColumnCount = 7;
  const totalDailyColumnCount = baseDailyColumnCount + extraDailyColumns.length;
  
  // Listen for search term changes from Layout header via window event
  useEffect(() => {
    const handleSearchChange = (event) => {
      const term = event.detail || '';
      setSearchTerm(term);
    };
    
    window.addEventListener('dashboardSearchChanged', handleSearchChange);
    
    return () => {
      window.removeEventListener('dashboardSearchChanged', handleSearchChange);
    };
  }, []);

  // Get time range from localStorage (set by Layout header)
  const getTimeRange = () => {
    return localStorage.getItem('selected-time-range') || '7d';
  };

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

  // Initialize default dates from header time range
  useEffect(() => {
    const timeRange = getTimeRange();
    const dates = calculateDatesFromTimeRange(timeRange);
    setStartDate(dates.start);
    setEndDate(dates.end);
  }, []);

  // Listen for time range changes from header
  useEffect(() => {
    const handleTimeRangeChange = () => {
      const timeRange = getTimeRange();
      const dates = calculateDatesFromTimeRange(timeRange);
      // Only update state if dates actually changed to avoid unnecessary re-fetches
      setStartDate((prev) => (prev !== dates.start ? dates.start : prev));
      setEndDate((prev) => (prev !== dates.end ? dates.end : prev));
    };

    window.addEventListener('timeRangeChanged', handleTimeRangeChange);
    window.addEventListener('storage', handleTimeRangeChange);

    return () => {
      window.removeEventListener('timeRangeChanged', handleTimeRangeChange);
      window.removeEventListener('storage', handleTimeRangeChange);
    };
  }, []);

  // Fetch top entities data
  const fetchData = async () => {
    const token = getAuthToken();
    if (!token) {
      // Wait for session/token before showing empty state
      setLoading(true);
      setError('');
      if (!authRetryRef.current) {
        authRetryRef.current = setTimeout(() => {
          authRetryRef.current = null;
          fetchData();
        }, 300);
      }
      return;
    }

    const fetchStart = effectiveDates.start;
    const fetchEnd = effectiveDates.end;
    if (!fetchStart || !fetchEnd) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = topEntitiesPayload(fetchStart, fetchEnd);
      const isHourlySummary = dashboardViewMode === 'hourly' && typeof buildHourlySummaryPayload === 'function';

      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ayl-auth-token': token
        },
      };

      const entitiesPromise = cachedFetch(apiEndpoint, {
        ...fetchOptions,
        body: JSON.stringify(payload)
      });

      const hourlySummaryPromise = isHourlySummary
        ? cachedFetch(apiEndpoint, {
            ...fetchOptions,
            body: JSON.stringify(buildHourlySummaryPayload(fetchStart, fetchEnd)),
          })
        : null;

      const [response, hourlyResponse] = await Promise.all([
        entitiesPromise,
        hourlySummaryPromise ?? Promise.resolve(null),
      ]);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const processed = await processTopEntitiesResponse(data, {
        startDate: fetchStart,
        endDate: fetchEnd,
      });

      setTopEntitiesData(processed.entities || []);
      if (isHourlySummary) {
        setSummaryStats(processed.summary);
        if (hourlyResponse?.ok) {
          const hourlyData = await hourlyResponse.json();
          const rawHourly = hourlyData?.Data ?? hourlyData;
          setHourlySummaryStats(
            computeHourlySummaryFromRawData(Array.isArray(rawHourly) ? rawHourly : [])
          );
        } else {
          setHourlySummaryStats(null);
        }
      } else {
        setSummaryStats(processed.summary);
        setHourlySummaryStats(null);
      }
      
      // Clear daily data cache when fetching new data
      setDailyDataCache({});
      setExpandedRows(new Set());
      setLastRefresh(new Date());

    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (authRetryRef.current) {
        clearTimeout(authRetryRef.current);
        authRetryRef.current = null;
      }
    };
  }, []);

  // Fetch data when dates or view mode change (hourly = Yesterday+Today)
  useEffect(() => {
    if (effectiveDates.start && effectiveDates.end) {
      fetchData();
    }
  }, [effectiveDates.start, effectiveDates.end, dashboardViewMode]);

  // Expose refresh function to window for Layout header refresh button
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.refreshDashboard = () => {
        fetchData();
      };
    }
    return () => {
      if (typeof window !== 'undefined' && window.refreshDashboard) {
        delete window.refreshDashboard;
      }
    };
  }, [effectiveDates.start, effectiveDates.end]);

  // Helper function to sanitize filename
  const sanitizeFilename = (str) => {
    if (!str) return '';
    return str
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50); // Limit length
  };

  // Helper function to generate export filename
  const getExportFilename = () => {
    const date = new Date().toISOString().split('T')[0];
    const titleClean = sanitizeFilename(title || 'Dashboard');
    
    let filename = `${titleClean}`;
    
    // Add filter IDs if available
    if (filterRealmId) {
      const realmIdShort = filterRealmId.substring(0, 8);
      filename += `_Realm_${realmIdShort}`;
    }
    if (filterCompanyId) {
      const companyIdShort = filterCompanyId.substring(0, 8);
      filename += `_Company_${companyIdShort}`;
    }
    
    filename += `_${date}.csv`;
    return filename;
  };

  // Export table to CSV
  const exportTableToCSV = () => {
    if (topEntitiesData.length === 0) return;

    const headers = [
      'Rank',
      'Name',
      'ID',
      'Revenue',
      'Publisher Costs',
      'Margin',
      'Margin %',
      ...extraColumns.map((column) => column.label)
    ];
    const rows = topEntitiesData
      .filter(item => {
        const entityId = getEntityId(item);
        const entityName = getEntityName(item);
        return entityId && entityName && entityName !== 'Unknown' && entityName !== 'Unknown Site' && entityName !== 'Unknown Placement' && entityName !== 'Unknown Company';
      })
      .map((item, index) => {
        const entityId = getEntityId(item);
        const entityName = getEntityName(item);
        const revenue = item.PriceAdvertiser_PublisherSide || 0;
        const publisherCost = item.PricePublisher || 0;
        const margin = revenue - publisherCost;
        const marginPercentage = revenue > 0 ? ((margin / revenue) * 100).toFixed(2) : '0.00';
        
        // Format currency values (remove $ and M, keep number in millions)
        const revenueValue = revenue / 1000000;
        const publisherCostValue = publisherCost / 1000000;
        const marginValue = margin / 1000000;
        
        const extraValues = extraColumns.map((column) => {
          const rawValue = column.valueGetter ? column.valueGetter(item) : item?.[column.key];
          const formatted = column.exportFormatter ? column.exportFormatter(rawValue, item) : rawValue;
          return formatted ?? '';
        });

        return [
          (index + 1).toString(),
          entityName || 'Unknown',
          entityId || 'Unknown',
          revenueValue.toFixed(2),
          publisherCostValue.toFixed(2),
          marginValue.toFixed(2),
          marginPercentage,
          ...extraValues
        ];
      });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', getExportFilename());
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter and paginate data
  const filteredData = topEntitiesData.filter(item => {
    const entityId = getEntityId(item);
    const entityName = getEntityName(item);
    
    // Filter out items without entity ID or name (like total rows from API)
    if (!entityId || !entityName) {
      return false;
    }
    
    // Filter out "Unknown" names
    if (entityName === 'Unknown' || entityName === 'Unknown Site' || 
        entityName === 'Unknown Placement' || entityName === 'Unknown Company') {
      return false;
    }
    
    if (!searchTerm) return true;
    
    // Search in both name and ID
    const q = searchTerm.trim().toLowerCase();
    const isLikelyId = /^[a-f0-9]{32}$/i.test(q);
    
    if (isLikelyId) {
      // If search looks like an ID, search in ID
      return entityId && entityId.toLowerCase().includes(q);
    } else {
      // Otherwise search in both name and ID
      const nameMatch = entityName.toLowerCase().includes(q);
      const idMatch = entityId && entityId.toLowerCase().includes(q);
      return nameMatch || idMatch;
    }
  });

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  // Update total count when data changes
  useEffect(() => {
    setTotalCount(filteredData.length);
  }, [filteredData.length]);

  // Reset to first page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Toggle row expansion and load daily data
  const toggleRowExpansion = async (entityId, entityName) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(entityId)) {
      newExpandedRows.delete(entityId);
    } else {
      newExpandedRows.add(entityId);
      
      // Load daily data if not cached
      if (!dailyDataCache[entityId] && !loadingDailyData.has(entityId)) {
        setLoadingDailyData(prev => new Set(prev).add(entityId));
        
        const dailyData = await fetchDailyDataForEntity(entityId, entityName, effectiveDates.start, effectiveDates.end);
        
        setDailyDataCache(prev => ({
          ...prev,
          [entityId]: dailyData
        }));
        
        setLoadingDailyData(prev => {
          const newSet = new Set(prev);
          newSet.delete(entityId);
          return newSet;
        });
      }
    }
    setExpandedRows(newExpandedRows);
  };

  // Render main table row with daily breakdown
  const renderTableRow = (item, index) => {
    const entityId = getEntityId(item);
    const entityName = getEntityName(item);
    const isExpanded = expandedRows.has(entityId);
    
    return (
      <React.Fragment>
        <TableRow className="hover:bg-[rgb(75,99,226)]/10">
          <TableCell className="font-medium text-center">
            <div className="flex items-center justify-center gap-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:text-blue-800">
                #{startIndex + index + 1}
              </Badge>
              <button
                onClick={() => toggleRowExpansion(entityId, entityName)}
                className="p-1 hover:bg-slate-100 rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-[rgb(75,99,226)]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[rgb(75,99,226)]" />
                )}
              </button>
            </div>
          </TableCell>
          <TableCell className="font-medium">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[rgb(75,99,226)] to-[rgb(75,99,226)] rounded-lg flex items-center justify-center">
                <span className="text-white text-sm font-bold">
                  {entityName && entityName.charAt ? entityName.charAt(0).toUpperCase() : '?'}
                </span>
              </div>
              <div>
                <div
                  className="font-semibold text-slate-900 cursor-pointer hover:text-[rgb(75,99,226)] transition-colors"
                  onClick={() => analyticsPagePath && entityName && navigate(`${analyticsPagePath}?id=${entityId}&name=${encodeURIComponent(entityName)}`)}
                  title={analyticsPagePath ? "Click to view analytics" : ""}
                >
                  {entityName || 'Unknown'}
                </div>
                <div className="text-xs text-slate-400 font-mono">{entityId}</div>
              </div>
            </div>
          </TableCell>
          {!hideSummaryMetrics && (
            <>
              <TableCell className="text-center">
                <div className="text-sm font-medium text-green-600">
                  {formatCurrency(item.PriceAdvertiser_PublisherSide || 0)}
                </div>
              </TableCell>
              <TableCell className="text-center">
                <div className="text-sm font-medium text-red-600">
                  {formatCurrency(item.PricePublisher || 0)}
                </div>
              </TableCell>
              <TableCell className="text-center">
                <div className="text-sm font-medium text-black">
                  {formatCurrency((item.PriceAdvertiser_PublisherSide || 0) - (item.PricePublisher || 0))}
                </div>
              </TableCell>
              <TableCell className="text-center">
                <div className="text-sm font-medium text-black">
                  {item.PriceAdvertiser_PublisherSide > 0 ? 
                    `${(((item.PriceAdvertiser_PublisherSide || 0) - (item.PricePublisher || 0)) / item.PriceAdvertiser_PublisherSide * 100).toFixed(1)}%` : 
                    '0%'
                  }
                </div>
              </TableCell>
            </>
          )}
          {extraColumns.map((column) => {
            const rawValue = column.valueGetter ? column.valueGetter(item) : item?.[column.key];
            const formatted = column.format ? column.format(rawValue, item) : rawValue;
            return (
              <TableCell key={column.key} className="text-center">
                <div className="text-sm font-medium text-black">
                  {formatted ?? '-'}
                </div>
              </TableCell>
            );
          })}
        </TableRow>

        {/* Expanded daily breakdown / custom per-entity view */}
        {isExpanded && (
          <TableRow>
            <TableCell colSpan={totalColumnCount} className="p-0">
              <div className="bg-slate-50 border-t">
                <div className="p-4">
                  {renderExpandedContent ? (
                    renderExpandedContent({
                      entityId,
                      entityName,
                      dailyData: dailyDataCache[entityId] || [],
                      loadingDaily: loadingDailyData.has(entityId),
                      startDate: effectiveDates.start,
                      endDate: effectiveDates.end,
                    })
                  ) : (
                    <>
                      <h4 className="text-sm font-semibold text-slate-700 mb-3">
                        Daily Breakdown - {entityName || 'Unknown'}
                      </h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs text-center">Date</TableHead>
                            <TableHead className="text-xs text-center">Revenue</TableHead>
                            <TableHead className="text-xs text-center">Trend</TableHead>
                            <TableHead className="text-xs text-center">Publisher Cost</TableHead>
                            <TableHead className="text-xs text-center">Trend</TableHead>
                            <TableHead className="text-xs text-center">Margin</TableHead>
                            <TableHead className="text-xs text-center">Trend</TableHead>
                            {extraDailyColumns.map((column) => (
                              <TableHead
                                key={column.key}
                                className={`text-xs text-center ${column.headerClassName || ''}`}
                              >
                                {column.label}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loadingDailyData.has(entityId) ? (
                            <TableRow>
                              <TableCell colSpan={totalDailyColumnCount} className="text-center py-4">
                                <div className="flex items-center justify-center gap-2">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span className="text-sm text-slate-500">Loading daily data...</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            (dailyDataCache[entityId] || []).map((dailyItem) => (
                              <TableRow key={dailyItem.day} className="bg-white">
                                <TableCell className="text-xs font-medium text-center">
                                  {dailyItem.day}
                                </TableCell>
                                <TableCell className="text-xs text-green-600 text-center">
                                  {formatCurrency(dailyItem[dailyDataFields.revenue])}
                                </TableCell>
                                <TableCell className="text-xs text-center border-r-2 border-gray-300">
                                  <div className="flex items-center justify-center gap-1">
                                    {dailyItem[dailyDataFields.revenueTrend] === 'up' && (
                                      <>
                                        <ArrowUpRight className="w-3 h-3 text-green-500" />
                                        <span className="text-green-500 text-xs">+{dailyItem[dailyDataFields.revenueChangePercent]}%</span>
                                      </>
                                    )}
                                    {dailyItem[dailyDataFields.revenueTrend] === 'down' && (
                                      <>
                                        <ArrowDownRight className="w-3 h-3 text-red-500" />
                                        <span className="text-red-500 text-xs">{dailyItem[dailyDataFields.revenueChangePercent]}%</span>
                                      </>
                                    )}
                                    {dailyItem[dailyDataFields.revenueTrend] === 'same' && (
                                      <span className="text-gray-400 text-xs">—</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs text-red-600 text-center">
                                  {formatCurrency(dailyItem[dailyDataFields.publisherCost])}
                                </TableCell>
                                <TableCell className="text-xs text-center border-r-2 border-gray-300">
                                  <div className="flex items-center justify-center gap-1">
                                    {dailyItem[dailyDataFields.publisherCostsTrend] === 'up' && (
                                      <>
                                        <ArrowUpRight className="w-3 h-3 text-red-500" />
                                        <span className="text-red-500 text-xs">+{dailyItem[dailyDataFields.publisherCostsChangePercent]}%</span>
                                      </>
                                    )}
                                    {dailyItem[dailyDataFields.publisherCostsTrend] === 'down' && (
                                      <>
                                        <ArrowDownRight className="w-3 h-3 text-green-500" />
                                        <span className="text-green-500 text-xs">{dailyItem[dailyDataFields.publisherCostsChangePercent]}%</span>
                                      </>
                                    )}
                                    {dailyItem[dailyDataFields.publisherCostsTrend] === 'same' && (
                                      <span className="text-gray-400 text-xs">—</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs text-black text-center">
                                  {formatCurrency(dailyItem[dailyDataFields.margin])}
                                </TableCell>
                                <TableCell className="text-xs text-center border-r-2 border-gray-300">
                                  <div className="flex items-center justify-center gap-1">
                                    {dailyItem[dailyDataFields.marginTrend] === 'up' && (
                                      <>
                                        <ArrowUpRight className="w-3 h-3 text-green-500" />
                                        <span className="text-green-500 text-xs">+{dailyItem[dailyDataFields.marginChangePercent]}%</span>
                                      </>
                                    )}
                                    {dailyItem[dailyDataFields.marginTrend] === 'down' && (
                                      <>
                                        <ArrowDownRight className="w-3 h-3 text-red-500" />
                                        <span className="text-red-500 text-xs">{dailyItem[dailyDataFields.marginChangePercent]}%</span>
                                      </>
                                    )}
                                    {dailyItem[dailyDataFields.marginTrend] === 'same' && (
                                      <span className="text-gray-400 text-xs">—</span>
                                    )}
                                  </div>
                                </TableCell>
                                {extraDailyColumns.map((column) => {
                                  const rawValue = column.valueGetter ? column.valueGetter(dailyItem) : dailyItem?.[column.key];
                                  const formatted = column.format ? column.format(rawValue, dailyItem) : rawValue;
                                  return (
                                    <TableCell
                                      key={column.key}
                                      className={`text-xs text-black text-center ${column.cellClassName || ''}`}
                                    >
                                      {formatted ?? '-'}
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </>
                  )}
                </div>
              </div>
            </TableCell>
          </TableRow>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="bg-slate-50 flex flex-col min-h-screen">
      <div className="flex flex-col p-3 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[rgb(75,99,226)]" />
          <span className="text-sm text-slate-600">{title}</span>
        </div>
        {additionalHeader && (
          <div className="mt-1">
            {additionalHeader}
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {!loading && dashboardViewMode === 'hourly' && hourlySummaryStats && (
        <HourlyAnalyticsSummaryCards
          summaryStats={hourlySummaryStats}
          viewMode="hourly"
          formatCurrencyFn={formatCurrency}
        />
      )}

      {!loading && dashboardViewMode !== 'hourly' && summaryStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className={TAILWIND_CLASSES.formSectionLabel}>DSP Revenue</p>
                  <p className="text-lg lg:text-xl font-bold text-green-600">
                    {formatCurrency(summaryStats.entityRevenue)}
                  </p>
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
                  <p className="text-lg lg:text-xl font-bold text-red-600">
                    {formatCurrency(summaryStats.publisherCosts)}
                  </p>
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
                  <p className="text-lg lg:text-xl font-bold" style={{ color: 'rgb(79, 70, 229)' }}>
                    {formatCurrency(summaryStats.margin)}
                  </p>
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
                  <p className="text-lg lg:text-xl font-bold text-orange-600">
                    {summaryStats.avgMarginPercentage}%
                  </p>
                </div>
                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="font-medium">Error</span>
          </div>
          <p className="text-red-700 mt-1">{error}</p>
        </div>
      )}

      {/* Top Entities Table / Card Grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2" style={{ color: 'rgb(30, 47, 130)' }}>
            <TrendingUp className="w-5 h-5 text-[rgb(75,99,226)]" />
            Top Entities by Revenue
          </CardTitle>
            {filteredData.length > 0 && (
              <Button
                onClick={exportTableToCSV}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[rgb(75,99,226)]" />
              <span className="ml-2 text-slate-600">Loading data...</span>
            </div>
          ) : cardLayout && renderEntityCard ? (
            <>
              {paginatedData.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  {searchTerm ? `No ${entityNamePlural} found matching your search` : 'No data available'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {paginatedData.map((item, index) => {
                    const entityId = getEntityId(item);
                    const entityName = getEntityName(item);
                    const globalIndex = startIndex + index;
                    return (
                      <React.Fragment key={entityId}>
                        {renderEntityCard(item, {
                          index,
                          globalIndex,
                          entityId,
                          entityName,
                          startDate: effectiveDates.start,
                          endDate: effectiveDates.end,
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
              {/* Period and Last Updated Info */}
              {!loading && (
                <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Period: {effectiveDates.start ? new Date(effectiveDates.start + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'} - {effectiveDates.end ? new Date(effectiveDates.end + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}
                    {dashboardViewMode === 'hourly' && ' (Real-time)'}
                  </span>
                  <span>
                    Last updated: {lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center">Rank</TableHead>
                    <TableHead>Name</TableHead>
                    {!hideSummaryMetrics && (
                      <>
                        <TableHead className="text-center">Revenue</TableHead>
                        <TableHead className="text-center">Publisher Costs</TableHead>
                        <TableHead className="text-center">Margin</TableHead>
                        <TableHead className="text-center">Margin %</TableHead>
                      </>
                    )}
                    {extraColumns.map((column) => (
                      <TableHead key={column.key} className="text-center">
                        {column.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={totalColumnCount} className="text-center py-8 text-slate-500">
                        {searchTerm ? `No ${entityNamePlural} found matching your search` : 'No data available'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedData.map((item, index) => {
                      const entityId = getEntityId(item);
                      return <React.Fragment key={entityId}>{renderTableRow(item, index)}</React.Fragment>;
                    })
                  )}
                </TableBody>
              </Table>
              {/* Period and Last Updated Info - Always shown below table */}
              {!loading && (
                <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Period: {effectiveDates.start ? new Date(effectiveDates.start + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'} - {effectiveDates.end ? new Date(effectiveDates.end + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}
                    {dashboardViewMode === 'hourly' && ' (Real-time)'}
                  </span>
                  <span>
                    Last updated: {lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Fixed Footer with Pagination */}
      {totalCount > 0 && (
        <div className="border-t border-slate-200 bg-white px-3 flex items-center justify-between flex-shrink-0 sticky bottom-0 z-10 shadow-sm w-full left-0 right-0" style={{ height: '80px' }}>
          <div className="text-sm text-slate-600">
            Showing {startIndex + 1} to {Math.min(endIndex, totalCount)} of {totalCount} {totalCount === 1 ? entityNameSingular : entityNamePlural}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1 || loading}
              className="hover:bg-slate-50 hover:border-slate-300"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <span className="text-sm text-slate-600">
              Page {currentPage} of {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages || loading}
              className="hover:bg-slate-50 hover:border-slate-300"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
