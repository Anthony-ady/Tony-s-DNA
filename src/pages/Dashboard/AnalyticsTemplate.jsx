/**
 * Generic Analytics Template Component
 * 
 * This component provides a reusable template for analytics pages displaying
 * detailed analytics for different entity types (companies, deals, placements, etc.).
 * 
 * Common features:
 * - Time range management from header
 * - Daily and hourly view modes
 * - Data fetching with Druid API
 * - Summary cards, charts, and detailed tables
 * - Period and last updated info below tables
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Legend, Tooltip as RechartsTooltip, LineChart, Line, CartesianGrid } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, Loader2, AlertCircle, DollarSign, TrendingUp, TrendingDown, Calendar, ChevronDown, ChevronUp, ChevronRight, ArrowUp, ArrowDown, Download, X, Info, ArrowUpRight, ArrowDownRight, Percent, Gauge, PieChart as PieChartIcon, Activity } from "lucide-react";
import { cachedFetch } from '@/utils/apiCache';
import { formatError } from '@/utils/errorFormatter';
import { API_ENDPOINTS } from '@/config/api';
import { formatLargeNumberCompact as formatLargeNumber, formatPercentage, formatEcpm, formatRpbr } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { TAILWIND_CLASSES } from '@/config/theme';
import AnalyticsFilterMenu from "@/components/AnalyticsFilterMenu";
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function AnalyticsTemplate({
  // Entity configuration
  entityIdParam = 'id',
  entityNameParam = 'name',
  defaultEntityName = 'Analytics',
  entityId: entityIdOverride = null, // Optional prop to override entityId from URL
  
  // API configuration
  buildPayload, // Function(entityId, startDate, endDate, viewMode) => payload
  apiEndpoint = API_ENDPOINTS.DRUID_SEARCH,
  
  // Data processing
  processAnalyticsData, // Function(responseData, viewMode, networkOpsData) => processedData
  calculateSummaryStats, // Function(processedData, viewMode) => summaryStats
  networkOperationsConfig = null,
  
  // UI customization
  pageTitle,
  backButtonPath,
  backButtonLabel = "Back",
  
  // Chart customization
  renderChart, // Function(analyticsData, viewMode) => JSX chart component
  
  // Table customization
  renderTableHeaders, // Function(viewMode, showDetailedColumns) => JSX table headers
  renderTableRow, // Function(item, index, analyticsData, viewMode, showDetailedColumns) => JSX table row
  tableConfig = null,
  
  // Summary cards customization
  renderSummaryCards, // Function(summaryStats, viewMode, formatCurrency) => JSX summary cards
  
  // Formatting
  formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value / 1000000) + 'M';
  },

  // Data source preferences
  useNetworkOpsOnlyDaily = false,

  /** When true, AD DOMAIN panel rows expand to daily breakdown (client-filtered P1D query). */
  enableAdDomainDailyDrillDown = false,

  /** When true, SEAT panel rows expand to daily breakdown (client-filtered P1D query). */
  enableSeatDailyDrillDown = false,
  
  // Auth
  getAuthToken,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  const [entityId, setEntityId] = useState("");
  const [entityName, setEntityName] = useState("");
  const [analyticsData, setAnalyticsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [summaryStats, setSummaryStats] = useState(null);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('analytics-view-mode') || 'daily'); // 'daily' or 'hourly'
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showDetailedColumns, setShowDetailedColumns] = useState(false); // State to toggle detailed network operations columns
  const [networkOperationsData, setNetworkOperationsData] = useState(null); // State for network operations data
  const exportPageRef = useRef(null);
  const [hiddenSeries, setHiddenSeries] = useState({});

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
  
  // Filter menu states
  const [selectedFilter, setSelectedFilter] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  // Business Review (DSP) states
  const [businessReviewData, setBusinessReviewData] = useState(null);
  const [loadingBusinessReview, setLoadingBusinessReview] = useState(false);
  const [businessReviewError, setBusinessReviewError] = useState(null);
  const [brViewMode, setBrViewMode] = useState('month'); // 'month' | 'year'
  const [brSelectedMonth, setBrSelectedMonth] = useState(null);
  const [brSelectedYear, setBrSelectedYear] = useState(null);
  
  // Device data states
  const [deviceData, setDeviceData] = useState([]);
  const [loadingDeviceData, setLoadingDeviceData] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [deviceDetailData, setDeviceDetailData] = useState([]);
  const [loadingDeviceDetail, setLoadingDeviceDetail] = useState(false);
  
  // DSP data states
  const [dspData, setDspData] = useState([]);
  const [loadingDspData, setLoadingDspData] = useState(false);
  const [selectedDsp, setSelectedDsp] = useState(null);
  const [dspDetailData, setDspDetailData] = useState([]);
  const [loadingDspDetail, setLoadingDspDetail] = useState(false);
  
  // SEAT data states
  const [seatData, setSeatData] = useState([]);
  const [loadingSeatData, setLoadingSeatData] = useState(false);
  const [selectedSeatRowKey, setSelectedSeatRowKey] = useState(null);
  const [seatDetailData, setSeatDetailData] = useState([]);
  const [loadingSeatDetail, setLoadingSeatDetail] = useState(false);
  
  // AD DOMAIN data states
  const [adDomainData, setAdDomainData] = useState([]);
  const [loadingAdDomainData, setLoadingAdDomainData] = useState(false);
  
  // SITE DOMAIN data states
  const [siteDomainData, setSiteDomainData] = useState([]);
  const [loadingSiteDomainData, setLoadingSiteDomainData] = useState(false);
  
  // GEO data states
  const [geoData, setGeoData] = useState([]);
  const [loadingGeoData, setLoadingGeoData] = useState(false);
  
  // AD KIND data states
  const [adKindData, setAdKindData] = useState([]);
  const [loadingAdKindData, setLoadingAdKindData] = useState(false);
  const [selectedAdKind, setSelectedAdKind] = useState(null);
  const [adKindDetailData, setAdKindDetailData] = useState([]);
  const [loadingAdKindDetail, setLoadingAdKindDetail] = useState(false);

  const [selectedSiteDomain, setSelectedSiteDomain] = useState(null);
  const [siteDomainDetailData, setSiteDomainDetailData] = useState([]);
  const [loadingSiteDomainDetail, setLoadingSiteDomainDetail] = useState(false);

  const [selectedAdDomainRowKey, setSelectedAdDomainRowKey] = useState(null);
  const [adDomainDetailData, setAdDomainDetailData] = useState([]);
  const [loadingAdDomainDetail, setLoadingAdDomainDetail] = useState(false);
  
  // Sorting states
  const [dspSortConfig, setDspSortConfig] = useState({ key: null, direction: 'asc' });
  const [seatSortConfig, setSeatSortConfig] = useState({ key: null, direction: 'asc' });
  const [adDomainSortConfig, setAdDomainSortConfig] = useState({ key: null, direction: 'asc' });
  const [siteDomainSortConfig, setSiteDomainSortConfig] = useState({ key: null, direction: 'asc' });
  /** Uid -> Name for SITE DOMAIN table (from REALMS_SEARCH). */
  const [realmNameById, setRealmNameById] = useState({});
  const [geoSortConfig, setGeoSortConfig] = useState({ key: null, direction: 'asc' });
  const [adKindSortConfig, setAdKindSortConfig] = useState({ key: null, direction: 'asc' });
  const [deviceSortConfig, setDeviceSortConfig] = useState({ key: null, direction: 'asc' });
  const [kpiProgSortConfig, setKpiProgSortConfig] = useState({ key: null, direction: 'asc' });
  
  // Determine entity type and extract IDs from URL and localStorage
  const getEntityFilters = () => {
    const pathname = location.pathname;
    const filters = {};
    
    // Extract IDs based on URL path
    // Always prioritize searchParams.get('id') from URL as it's the source of truth
    if (pathname.includes('/realm/') || pathname.includes('/Realm/') || pathname.includes('RealmAnalytics')) {
      filters.realmId = searchParams.get('id') || entityId;
    } else if (pathname.includes('/company/') || pathname.includes('/Company/') || pathname.includes('CompanyAnalytics')) {
      filters.companyId = searchParams.get('id') || entityId;
      // Do NOT load realmId from localStorage for CompanyAnalytics - only use companyId
    } else if (pathname.includes('/site/') || pathname.includes('/Site/') || pathname.includes('SiteAnalytics')) {
      filters.siteId = searchParams.get('id') || entityId;
      // Get companyId and realmId from localStorage if available
      if (typeof window !== 'undefined') {
        const companyId = localStorage.getItem('selected-company-id');
        const realmId = localStorage.getItem('selected-realm-id');
        if (companyId) filters.companyId = companyId;
        if (realmId) filters.realmId = realmId;
      }
    } else if (pathname.includes('/placement/') || pathname.includes('/Placement/') || pathname.includes('PlacementAnalytics')) {
      filters.placementId = searchParams.get('id') || entityId;
      // Get companyId and realmId from localStorage if available
      if (typeof window !== 'undefined') {
        const companyId = localStorage.getItem('selected-company-id');
        const realmId = localStorage.getItem('selected-realm-id');
        if (companyId) filters.companyId = companyId;
        if (realmId) filters.realmId = realmId;
      }
    } else if (pathname.includes('/deal/') || pathname.includes('/Deal/') || pathname.includes('DealAnalytics')) {
      filters.dealId = searchParams.get('id') || entityId;
    } else if (pathname.includes('/dsp/') || pathname.includes('/DSP/') || pathname.includes('DSPAnalytics')) {
      // For DSP, the entityId is the partner ID
      filters.partnerId = searchParams.get('id') || entityId;
    } else if (pathname.includes('/broker/') || pathname.includes('/Broker/') || pathname.includes('BrokerAnalytics')) {
      // Broker: entityId is resolvedRealmId (passed from BrokerAnalytics), required for API filter
      if (entityId) {
        filters.realmId = entityId;
      }
    }
    
    return filters;
  };
  
  // Menu items configuration
  // Determine if we should show OVERVIEW menu item
  // Show it for DSPAnalytics, RealmAnalytics and CompanyAnalytics, hide it for SiteAnalytics, PlacementAnalytics
  const shouldShowOverview = !location.pathname.includes('/SiteAnalytics') &&
    !location.pathname.includes('/PlacementAnalytics') &&
    (location.pathname.includes('/DSPAnalytics') ||
     location.pathname.includes('/RealmAnalytics') ||
     location.pathname.includes('/CompanyAnalytics') ||
     location.pathname.includes('/DealAnalytics'));

  const menuItems = [
    { id: 'kpi-prog', label: 'KPI PROG' },
    { id: 'device', label: 'DEVICE' },
    { id: 'ad-kind', label: 'AD KIND' },
    { id: 'dsp', label: 'DSP' },
    { id: 'seat', label: 'SEAT' },
    { id: 'ad-domain', label: 'AD DOMAIN' },
    { id: 'site-domain', label: 'SITE DOMAIN' },
    { id: 'geo', label: 'GEO' },
    // Business Review entry (for DSPAnalytics and future use)
    ...(shouldShowOverview ? [{ id: 'business-review', label: 'OVERVIEW' }] : [])
  ];

  // Helpers for Business Review (copied from DSPDashboard, adapted)
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

  // Colors for Business Review pie / bar charts (same palette as DSPDashboard)
  const PIE_COLORS = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#F97316', // Orange
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

  // Fetch Business Review data for a specific DSP partner from static JSON
  const fetchBusinessReviewForPartner = async (partnerId) => {
    if (!partnerId) {
      setBusinessReviewError('No partnerId available for Business Review.');
      setBusinessReviewData(null);
      return;
    }

    setLoadingBusinessReview(true);
    setBusinessReviewError(null);

    try {
      const response = await fetch(`/data/DSP/business-review-${partnerId}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load Business Review data: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      const processedData = processBusinessReviewDataBR(data.data || []);
      setBusinessReviewData({ ...data, processedData });
    } catch (err) {
      console.error('Error loading Business Review data for partner:', partnerId, err);
      setBusinessReviewError(err.message || 'Unknown error while loading Business Review data.');
      setBusinessReviewData(null);
    } finally {
      setLoadingBusinessReview(false);
    }
  };

  // Fetch Business Review data for a specific Realm from static JSON
  const fetchBusinessReviewForRealm = async (realmId) => {
    if (!realmId) {
      setBusinessReviewError('No realmId available for Business Review.');
      setBusinessReviewData(null);
      return;
    }

    setLoadingBusinessReview(true);
    setBusinessReviewError(null);

    try {
      const response = await fetch(`/data/REALM/business-review-${realmId}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load Business Review data: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      const processedData = processBusinessReviewDataBR(data.data || []);
      setBusinessReviewData({ ...data, processedData });
    } catch (err) {
      console.error('Error loading Business Review data for realm:', realmId, err);
      setBusinessReviewError(err.message || 'Unknown error while loading Business Review data.');
      setBusinessReviewData(null);
    } finally {
      setLoadingBusinessReview(false);
    }
  };

  // Fetch Business Review data for a specific Company from static JSON
  const fetchBusinessReviewForCompany = async (companyId) => {
    if (!companyId) {
      setBusinessReviewError('No companyId available for Business Review.');
      setBusinessReviewData(null);
      return;
    }

    setLoadingBusinessReview(true);
    setBusinessReviewError(null);

    try {
      const response = await fetch(`/data/COMPANY/business-review-${companyId}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load Business Review data: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      const processedData = processBusinessReviewDataBR(data.data || []);
      setBusinessReviewData({ ...data, processedData });
    } catch (err) {
      console.error('Error loading Business Review data for company:', companyId, err);
      setBusinessReviewError(err.message || 'Unknown error while loading Business Review data.');
      setBusinessReviewData(null);
    } finally {
      setLoadingBusinessReview(false);
    }
  };

  // Fetch Business Review data for a specific Deal from static JSON
  const fetchBusinessReviewForDeal = async (dealId) => {
    if (!dealId) {
      setBusinessReviewError('No dealId available for Business Review.');
      setBusinessReviewData(null);
      return;
    }

    setLoadingBusinessReview(true);
    setBusinessReviewError(null);

    try {
      const response = await fetch(`/data/DEAL/business-review-${dealId}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load Business Review data: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      const processedData = processBusinessReviewDataBR(data.data || []);
      setBusinessReviewData({ ...data, processedData });
    } catch (err) {
      console.error('Error loading Business Review data for deal:', dealId, err);
      setBusinessReviewError(err.message || 'Unknown error while loading Business Review data.');
      setBusinessReviewData(null);
    } finally {
      setLoadingBusinessReview(false);
    }
  };

  // Export Business Review data to PDF (Partner, Realm, Company or Deal-specific)
  const exportBusinessReviewToPDF = async () => {
    const entityFilters = getEntityFilters();
    const partnerId = entityFilters.partnerId;
    const realmId = entityFilters.realmId;
    const companyId = entityFilters.companyId;
    const dealId = entityFilters.dealId;
    if (!businessReviewData || !businessReviewData.processedData || businessReviewData.processedData.length === 0) return;
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = margin;
      
      const checkNewPage = (requiredHeight) => {
        if (yPosition + requiredHeight > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
      };
      
      const allProcessed = businessReviewData.processedData || [];
      const effectiveViewMode = brViewMode || 'month';
      let effectiveMonth = brSelectedMonth;
      let effectiveYear = brSelectedYear;
      
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
      
      // Determine entity type for PDF export (same logic as renderPanelContent)
      const entityFiltersForPDF = getEntityFilters();
      const partnerIdForPDF = entityFiltersForPDF.partnerId;
      const realmIdForPDF = entityFiltersForPDF.realmId;
      const companyIdForPDF = entityFiltersForPDF.companyId;
      const dealIdForPDF = entityFiltersForPDF.dealId;
      
      let entityTypeForPDF = 'dsp';
      if (partnerIdForPDF || location.pathname.includes('/DSP') || location.pathname.includes('DSPAnalytics')) {
        entityTypeForPDF = 'dsp';
      } else if (dealIdForPDF || location.pathname.includes('/Deal') || location.pathname.includes('DealAnalytics')) {
        entityTypeForPDF = 'deal';
      } else if (companyIdForPDF || location.pathname.includes('/Company') || location.pathname.includes('CompanyAnalytics')) {
        entityTypeForPDF = 'company';
      } else if (realmIdForPDF || location.pathname.includes('/Realm') || location.pathname.includes('RealmAnalytics')) {
        entityTypeForPDF = 'realm';
      } else if (location.pathname.includes('/Site') || location.pathname.includes('SiteAnalytics')) {
        entityTypeForPDF = 'site';
      }
      
      const getRevenueValueForPDF = (item) => {
        if (entityTypeForPDF === 'dsp') {
          return item.priceAdvertiser || 0;
        } else if (['realm', 'company', 'site'].includes(entityTypeForPDF)) {
          return item.pricePublisher || 0;
        } else if (entityTypeForPDF === 'deal') {
          return item.priceAdvertiser || 0;
        }
        return item.priceAdvertiser || 0;
      };
      
      const kpis = filtered.reduce(
        (acc, item) => {
          acc.bidRequests += item.bidRequests || 0;
          acc.impressions += item.impressions || 0;
          acc.clicks += item.clicks || 0;
          acc.revenue += getRevenueValueForPDF(item);
          return acc;
        },
        { bidRequests: 0, impressions: 0, clicks: 0, revenue: 0 }
      );
      
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
        trendMap[key].revenue += getRevenueValueForPDF(item);
      });
      const dailyTrendData = Object.values(trendMap).sort((a, b) => a.sortKey > b.sortKey ? 1 : a.sortKey < b.sortKey ? -1 : 0);
      
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
        return {
          name: getAdKindDisplayName(adKind),
          value,
          percentage,
        };
      });
      
      const adKindRevenue = {};
      filtered.forEach((item) => {
        if (!item.adKind) return;
        if (!adKindRevenue[item.adKind]) {
          adKindRevenue[item.adKind] = 0;
        }
        adKindRevenue[item.adKind] += getRevenueValueForPDF(item);
      });
      const barChartData = Object.entries(adKindRevenue).map(([adKind, value]) => ({
        name: getAdKindDisplayName(adKind),
        revenue: (value || 0) / 1000,
      }));
      
      pdf.setFontSize(20);
      pdf.setTextColor(30, 58, 138);
      pdf.setFont(undefined, 'bold');
      const dashboardTitle = realmId
        ? 'Realm Performance Dashboard'
        : companyId
          ? 'Company Performance Dashboard'
          : dealId
            ? 'Deal Performance Dashboard'
            : 'DSP Performance Dashboard';
      pdf.text(dashboardTitle, margin, yPosition);
      yPosition += 10;
      
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
      
      const entityId = partnerId || realmId || companyId || dealId || 'Unknown';
      const entityType = partnerId ? 'Partner' : realmId ? 'Realm' : companyId ? 'Company' : dealId ? 'Deal' : 'Unknown';
      const fileName = `Business_Review_${entityType}_${entityId.substring(0, 8)}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF: ' + error.message);
    }
  };

  // Handle menu item click
  const handleMenuItemClick = async (itemId, filters) => {
    console.log('🔵 Menu item clicked:', itemId, 'with filters:', filters);
    if (selectedFilter === itemId) {
      setIsPanelOpen(false);
      setSelectedFilter(null);
      if (itemId === 'business-review') {
        setBusinessReviewData(null);
        setBusinessReviewError(null);
      }
    } else {
      setSelectedFilter(itemId);
      setIsPanelOpen(true);
      
      // Fetch data based on the selected filter
      if (itemId === 'device') {
        await fetchDeviceData(filters);
      } else if (itemId === 'ad-kind') {
        await fetchAdKindData(filters);
      } else if (itemId === 'dsp') {
        await fetchDspData(filters);
      } else if (itemId === 'seat') {
        await fetchSeatData(filters);
      } else if (itemId === 'ad-domain') {
        await fetchAdDomainData(filters);
      } else if (itemId === 'site-domain') {
        await fetchSiteDomainData(filters);
      } else if (itemId === 'geo') {
        await fetchGeoData(filters);
      } else if (itemId === 'business-review') {
        // Determine if this is a DSP, Realm, Company or Deal based on filters
        // Priority: partnerId > dealId > companyId > realmId
        // IMPORTANT: For CompanyAnalytics, NEVER load realmId, even if companyId is not available
        const entityFilters = getEntityFilters();
        const pathname = location.pathname;
        const isCompanyAnalytics = pathname.includes('CompanyAnalytics');
        
        if (filters.partnerId || entityFilters.partnerId) {
          await fetchBusinessReviewForPartner(filters.partnerId || entityFilters.partnerId);
        } else if (filters.dealId || entityFilters.dealId) {
          await fetchBusinessReviewForDeal(filters.dealId || entityFilters.dealId);
        } else if (isCompanyAnalytics) {
          // For CompanyAnalytics, ONLY use companyId, never realmId
          const companyId = filters.companyId || entityFilters.companyId;
          if (companyId) {
            await fetchBusinessReviewForCompany(companyId);
          } else {
            setBusinessReviewError('No companyId available for Business Review.');
            setBusinessReviewData(null);
          }
        } else if (filters.companyId || entityFilters.companyId) {
          await fetchBusinessReviewForCompany(filters.companyId || entityFilters.companyId);
        } else if (!isCompanyAnalytics && (filters.realmId || entityFilters.realmId)) {
          // Only load realmId if NOT on CompanyAnalytics page
          await fetchBusinessReviewForRealm(filters.realmId || entityFilters.realmId);
        }
      }
      // KPI PROG uses analyticsData which is already loaded
    }
  };
  
  // Handle panel close
  const handleClosePanel = () => {
    setIsPanelOpen(false);
    setSelectedFilter(null);
  };
  
  // Get time range helper
  const getTimeRange = () => {
    return localStorage.getItem('selected-time-range') || '7d';
  };

  // Calculate dates from time range
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

  // formatLargeNumber, formatPercentage, formatEcpm, formatRpbr from @/utils/formatters

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

  const handleGeoSort = (sortKey) => {
    handleSort(geoSortConfig, setGeoSortConfig, geoData, setGeoData, sortKey);
  };

  const handleDeviceSort = (sortKey) => {
    handleSort(deviceSortConfig, setDeviceSortConfig, deviceData, setDeviceData, sortKey);
  };

  const handleAdKindSort = (sortKey) => {
    handleSort(adKindSortConfig, setAdKindSortConfig, adKindData, setAdKindData, sortKey);
  };

  const handleKpiProgSort = (sortKey) => {
    handleSort(kpiProgSortConfig, setKpiProgSortConfig, analyticsData, setAnalyticsData, sortKey);
  };

  // Helper function to render sortable header
  const renderSortableHeader = (label, sortKey, sortConfig, onSort) => {
    const isSorted = sortConfig.key === sortKey;
    const direction = sortConfig.direction;
    
    return (
      <TableHead 
        className="text-center cursor-pointer hover:bg-slate-100 select-none"
        onClick={() => onSort(sortKey)}
      >
        <div className="flex items-center justify-center gap-1">
          <span>{label}</span>
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

  // Helper function to build filters for API requests
  const buildFiltersForRequest = (filters) => {
    const apiFilters = {};
    
    if (filters.realmId) {
      apiFilters.RealmPublisher = {
        Value: [filters.realmId],
        Operator: "in"
      };
      console.log('🔵 Adding RealmPublisher filter:', apiFilters.RealmPublisher);
    }
    if (filters.companyId) {
      apiFilters.Publisher = {
        Value: [filters.companyId],
        Operator: "in"
      };
    }
    if (filters.siteId) {
      apiFilters.Site = {
        Value: [filters.siteId],
        Operator: "in"
      };
    }
    if (filters.placementId) {
      apiFilters.Placement = {
        Value: [filters.placementId],
        Operator: "in"
      };
    }
    if (filters.dealId) {
      apiFilters.dealId = {
        Value: [filters.dealId],
        Operator: "in"
      };
      console.log('🔵 Adding dealId filter for network_operations:', apiFilters.dealId);
    }
    if (filters.partnerId) {
      // For adserver_stats datasource, use "Partner" instead of "partnerId"
      apiFilters.Partner = {
        Value: [filters.partnerId],
        Operator: "in"
      };
      console.log('🔵 Adding Partner filter for adserver_stats:', apiFilters.Partner);
    }
    
    return Object.keys(apiFilters).length > 0 ? apiFilters : undefined;
  };

  /** Entity filters plus optional SiteDomain (adserver_stats / DRUID). Optional rowRealmId narrows drill-down to (realm, domain). */
  const buildFiltersForRequestWithSiteDomain = (filters, siteDomain, rowRealmPublisher = null) => {
    const merged = { ...(buildFiltersForRequest(filters) || {}) };
    if (rowRealmPublisher) {
      merged.RealmPublisher = {
        Value: [rowRealmPublisher],
        Operator: 'in',
      };
    }
    if (siteDomain && siteDomain !== 'Unknown') {
      merged.SiteDomain = {
        Value: [siteDomain],
        Operator: 'in'
      };
    }
    return Object.keys(merged).length > 0 ? merged : undefined;
  };

  const getSiteDomainRowKey = (item) => {
    const d = item?.siteDomain || item?.siteName || '';
    const r = item?.realmPublisherId || '';
    return r && d ? `${r}::${d}` : d;
  };

  const getAdDomainRowKey = (item) =>
    `${item.adDomain || ''}::${item.partnerName || ''}`;

  const getSeatRowKey = (item) =>
    `${item.seatId != null ? String(item.seatId) : ''}::${item.partnerName || ''}`;

  // Helper function to build filters for network_operations datasource
  // Uses publisherId instead of Publisher for companyId
  // Uses SiteId instead of Site for siteId
  // Uses realmId instead of RealmPublisher for realmId
  // Uses PlacementId instead of Placement for placementId
  // Uses dealId instead of Dealid for dealId
  // Uses partnerId instead of Partner for partnerId
  const buildFiltersForNetworkOperations = (filters) => {
    const apiFilters = {};
    
    if (filters.realmId) {
      apiFilters.realmId = {
        Value: [filters.realmId],
        Operator: "in"
      };
      console.log('🔵 Adding realmId filter for network_operations:', apiFilters.realmId);
    }
    if (filters.companyId) {
      apiFilters.publisherId = {
        Value: [filters.companyId],
        Operator: "in"
      };
      console.log('🔵 Adding publisherId filter for network_operations:', apiFilters.publisherId);
    }
    if (filters.siteId) {
      apiFilters.SiteId = {
        Value: [filters.siteId],
        Operator: "in"
      };
      console.log('🔵 Adding SiteId filter for network_operations:', apiFilters.SiteId);
    }
    if (filters.placementId) {
      apiFilters.PlacementId = {
        Value: [filters.placementId],
        Operator: "in"
      };
      console.log('🔵 Adding PlacementId filter for network_operations:', apiFilters.PlacementId);
    }
    if (filters.dealId) {
      apiFilters.dealId = {
        Value: [filters.dealId],
        Operator: "in"
      };
      console.log('🔵 Adding dealId filter for network_operations:', apiFilters.dealId);
    }
    if (filters.partnerId) {
      apiFilters.partnerId = {
        Value: [filters.partnerId],
        Operator: "in"
      };
      console.log('🔵 Adding partnerId filter for network_operations:', apiFilters.partnerId);
    }
    
    return Object.keys(apiFilters).length > 0 ? apiFilters : undefined;
  };

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

  // Fetch AD KIND data from Druid API
  const fetchAdKindData = async (filters = {}) => {
    setLoadingAdKindData(true);
    setSelectedAdKind(null);
    setAdKindDetailData([]);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const startDateValue = new Date(startDate + 'T00:00:00.000Z');
      const endDateValue = new Date(endDate + 'T23:59:59.000Z');

      // Use buildFiltersForNetworkOperations for network_operations datasource
      // which uses publisherId instead of Publisher for companyId
      const apiFilters = buildFiltersForNetworkOperations(filters);
      console.log('🔵 fetchAdKindData - filters received:', filters);
      console.log('🔵 fetchAdKindData - apiFilters built (network_operations):', apiFilters);
      const payload = {
        "Intervals": [{
          "Begin": startDateValue.toISOString(),
          "End": endDateValue.toISOString()
        }],
        "Metrics": ["network_operations_impressions", "network_operations_click", "network_operations_price_publisher", "network_operations_price_advertiser"],
        "Dimensions": ["adKind"],
        "Granularity": "all",
        "Datasource": "network_operations",
        "TimeZone": "Etc/GMT",
        ...(apiFilters && { Filters: apiFilters })
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
        const errorMessage = formatError(new Error(`HTTP error! status: ${response.status}`), response);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const dataArray = Array.isArray(result?.Data) ? result.Data : Array.isArray(result) ? result : [];

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
          const clicks = item.network_operations_click || item.network_operations_clicks || 0;
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          const margin = dspRevenue - publisherCosts;
          const marginPercentage = dspRevenue > 0 ? ((margin / dspRevenue) * 100).toFixed(2) : '0.00';
          
          return {
            ...item,
            adKind: adKind,
            adKindDisplay: getAdKindDisplayName(adKind),
            PriceAdvertiser_PublisherSide: dspRevenue,
            PricePublisher: publisherCosts,
            impressions: impressions,
            clicks: clicks,
            ctr: ctr,
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

  // Fetch AD KIND detail data by date
  const fetchAdKindDetailData = async (adKindName, filters = {}) => {
    setLoadingAdKindDetail(true);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const startDateValue = new Date(startDate + 'T00:00:00.000Z');
      const endDateValue = new Date(endDate + 'T23:59:59.999Z');

      const apiFilters = buildFiltersForNetworkOperations(filters);
      // Add adKind filter
      if (adKindName) {
        apiFilters.adKind = {
          Value: [adKindName],
          Operator: "in"
        };
      }

      const payload = {
        "Intervals": [{
          "Begin": startDateValue.toISOString(),
          "End": endDateValue.toISOString()
        }],
        "Metrics": ["network_operations_impressions", "network_operations_click", "network_operations_price_publisher", "network_operations_price_advertiser"],
        "Dimensions": ["adKind"],
        "Granularity": { "type": "period", "period": viewMode === 'hourly' ? "PT1H" : "P1D" },
        "Datasource": "network_operations",
        "TimeZone": "Etc/GMT",
        "Size": 500,
        ...(apiFilters && { Filters: apiFilters })
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
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const dataArray = Array.isArray(result?.Data) ? result.Data : Array.isArray(result) ? result : [];

      const filteredData = dataArray.filter((item) => {
        const itemAdKind = item.adKind || '';
        return itemAdKind === adKindName;
      });

      const processedData = filteredData
        .map((item) => {
          const dspRevenue = item.network_operations_price_advertiser || 0;
          const publisherCosts = item.network_operations_price_publisher || 0;
          const impressions = item.network_operations_impressions || 0;
          const clicks = item.network_operations_click || item.network_operations_clicks || 0;
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          const margin = dspRevenue - publisherCosts;
          const marginPercentage = dspRevenue > 0 ? ((margin / dspRevenue) * 100).toFixed(2) : '0.00';
          
          let formattedDate = 'N/A';
          if (item.timestamp) {
            try {
              let cleanTimestamp = item.timestamp;
              cleanTimestamp = cleanTimestamp.replace(/\.\d{6}(\.\d{3})?/g, '');
              if (!cleanTimestamp.endsWith('Z') && !cleanTimestamp.includes('+') && !cleanTimestamp.includes('-', 10)) {
                cleanTimestamp += 'Z';
              }
              cleanTimestamp = cleanTimestamp.replace(/\.(\d{3})?Z$/, 'Z');
              
              const date = new Date(cleanTimestamp);
              if (!isNaN(date.getTime())) {
                formattedDate = viewMode === 'hourly'
                  ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                  : date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
              }
            } catch (e) {
              console.error('Error formatting date:', item.timestamp, e);
            }
          }
          
          return {
            ...item,
            adKind: adKindName,
            date: formattedDate,
            timestamp: item.timestamp,
            PriceAdvertiser_PublisherSide: dspRevenue,
            PricePublisher: publisherCosts,
            impressions: impressions,
            clicks: clicks,
            ctr: ctr,
            margin: margin,
            marginPercentage: marginPercentage
          };
        })
        .sort((a, b) => {
          if (a.timestamp && b.timestamp) {
            return new Date(a.timestamp) - new Date(b.timestamp);
          }
          return 0;
        });

      setAdKindDetailData(processedData);
    } catch (err) {
      console.error('Error fetching AD KIND detail data:', err);
      setError(`Error fetching AD KIND detail data: ${err.message}`);
      setAdKindDetailData([]);
    } finally {
      setLoadingAdKindDetail(false);
    }
  };

  // Handle AD KIND row click
  const handleAdKindRowClick = async (adKindName, filters = {}) => {
    if (selectedAdKind === adKindName) {
      setSelectedAdKind(null);
      setAdKindDetailData([]);
    } else {
      setSelectedAdKind(adKindName);
      await fetchAdKindDetailData(adKindName, filters);
    }
  };

  // Fetch device data from Druid API
  const fetchDeviceData = async (filters = {}) => {
    setLoadingDeviceData(true);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const startDateValue = new Date(startDate + 'T00:00:00.000Z');
      const endDateValue = new Date(endDate + 'T23:59:59.000Z');

      const apiFilters = buildFiltersForRequest(filters);
      console.log('🔵 fetchDeviceData - filters received:', filters);
      console.log('🔵 fetchDeviceData - apiFilters built:', apiFilters);
      const payload = {
        "Intervals": [{
          "Begin": startDateValue.toISOString(),
          "End": endDateValue.toISOString()
        }],
        "Metrics": ["PricePublisher", "PriceAdvertiser_PublisherSide", "CLICK", "IMPRESSION"],
        "Dimensions": ["DEVICE"],
        "Granularity": "all",
        "Datasource": "adserver_stats",
        "TimeZone": "Etc/GMT",
        ...(apiFilters && { Filters: apiFilters })
      };
      console.log('🔵 fetchDeviceData - final payload:', JSON.stringify(payload, null, 2));

      const response = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ayl-auth-token": token
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorMessage = formatError(new Error(`HTTP error! status: ${response.status}`), response);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const dataArray = Array.isArray(result?.Data) ? result.Data : Array.isArray(result) ? result : [];

      const processedData = dataArray
        .map((item) => {
          const deviceName = item.Device || item.DEVICE || 'Unknown';
          const dspRevenue = item.PriceAdvertiser_PublisherSide || 0;
          const publisherCosts = item.PricePublisher || 0;
          const impressions = item.IMPRESSION ?? item.Impression ?? 0;
          const clicks = item.CLICK ?? item.Click ?? 0;
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          const margin = dspRevenue - publisherCosts;
          const marginPercentage = dspRevenue > 0 ? ((margin / dspRevenue) * 100).toFixed(2) : '0.00';
          
          return {
            ...item,
            device: deviceName,
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
  const fetchDeviceDetailData = async (deviceName, filters = {}) => {
    setLoadingDeviceDetail(true);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const startDateValue = new Date(startDate + 'T00:00:00.000Z');
      const endDateValue = new Date(endDate + 'T23:59:59.999Z');

      const apiFilters = buildFiltersForRequest(filters);
      const payload = {
        "Intervals": [{
          "Begin": startDateValue.toISOString(),
          "End": endDateValue.toISOString()
        }],
        "Metrics": ["PricePublisher", "PriceAdvertiser_PublisherSide", "CLICK", "IMPRESSION"],
        "Dimensions": ["DEVICE"],
        "Granularity": { "type": "period", "period": viewMode === 'hourly' ? "PT1H" : "P1D" },
        "Datasource": "adserver_stats",
        "TimeZone": "Etc/GMT",
        "Size": 500,
        ...(apiFilters && { Filters: apiFilters })
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
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const dataArray = Array.isArray(result?.Data) ? result.Data : Array.isArray(result) ? result : [];

      const filteredData = dataArray.filter((item) => {
        const itemDevice = item.Device || item.DEVICE || '';
        return itemDevice === deviceName;
      });

      const processedData = filteredData
        .map((item) => {
          const dspRevenue = item.PriceAdvertiser_PublisherSide || 0;
          const publisherCosts = item.PricePublisher || 0;
          const margin = dspRevenue - publisherCosts;
          const marginPercentage = dspRevenue > 0 ? ((margin / dspRevenue) * 100).toFixed(2) : '0.00';
          
          let formattedDate = 'N/A';
          if (item.timestamp) {
            try {
              let cleanTimestamp = item.timestamp;
              cleanTimestamp = cleanTimestamp.replace(/\.\d{6}(\.\d{3})?/g, '');
              if (!cleanTimestamp.endsWith('Z') && !cleanTimestamp.includes('+') && !cleanTimestamp.includes('-', 10)) {
                cleanTimestamp += 'Z';
              }
              cleanTimestamp = cleanTimestamp.replace(/\.(\d{3})?Z$/, 'Z');
              
              const date = new Date(cleanTimestamp);
              if (!isNaN(date.getTime())) {
                formattedDate = viewMode === 'hourly'
                  ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                  : date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
          if (a.timestamp && b.timestamp) {
            return new Date(a.timestamp) - new Date(b.timestamp);
          }
          return 0;
        });

      setDeviceDetailData(processedData);
    } catch (err) {
      console.error('Error fetching device detail data:', err);
      setError(`Error fetching device detail data: ${err.message}`);
      setDeviceDetailData([]);
    } finally {
      setLoadingDeviceDetail(false);
    }
  };

  // Handle device row click
  const handleDeviceRowClick = async (deviceName, filters = {}) => {
    if (selectedDevice === deviceName) {
      setSelectedDevice(null);
      setDeviceDetailData([]);
    } else {
      setSelectedDevice(deviceName);
      await fetchDeviceDetailData(deviceName, filters);
    }
  };

  // Fetch DSP data from Druid API
  const fetchDspData = async (filters = {}) => {
    setLoadingDspData(true);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const startDateValue = new Date(startDate + 'T00:00:00.000Z');
      const endDateValue = new Date(endDate + 'T23:59:59.000Z');

      const beginDate = new Date(startDateValue.toISOString()).toISOString().replace('Z', '+00:00');
      const endDateFormatted = new Date(endDateValue.toISOString()).toISOString().replace('Z', '+00:00');

      const apiFilters = buildFiltersForRequest(filters);
      const payload = {
        "Intervals": [{"Begin": beginDate, "End": endDateFormatted}],
        "Operator": "in",
        "OrderBy": "PricePublisher",
        "OrderOp": "DESC",
        "Dimensions": ["Partner"],
        "Size": 500,
        "Metrics": ["PricePublisher", "PriceAdvertiser_PublisherSide", "PartnerName", "CLICK", "IMPRESSION"],
        "View": "ADVANCED_PUBLISHER",
        "Datasource": "adserver_stats",
        "AddTotalRow": true,
        "TimeZone": "Etc/GMT",
        "Granularity": "all",
        ...(apiFilters && { Filters: apiFilters })
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
        const errorMessage = formatError(new Error(`HTTP error! status: ${response.status}`), response);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const dataArray = Array.isArray(result?.Data) ? result.Data : Array.isArray(result) ? result : [];

      const processedData = dataArray
        .map((item) => {
          const partnerId = item.Partner || item.partnerId || 'Unknown';
          const partnerName = item.Name_Partner || item.PartnerName || item.partnerName || 'Unknown DSP';
          const dspRevenue = item.PriceAdvertiser_PublisherSide || 0;
          const publisherCosts = item.PricePublisher || 0;
          const impressions = item.IMPRESSION ?? item.Impression ?? 0;
          const clicks = item.CLICK ?? item.Click ?? 0;
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          const margin = dspRevenue - publisherCosts;
          const marginPercentage = dspRevenue > 0 ? ((margin / dspRevenue) * 100).toFixed(2) : '0.00';
          
          return {
            ...item,
            partnerId: partnerId,
            partnerName: partnerName,
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
  const fetchDspDetailData = async (partnerId, filters = {}) => {
    setLoadingDspDetail(true);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const startDateValue = new Date(startDate + 'T00:00:00.000Z');
      const endDateValue = new Date(endDate + 'T23:59:59.999Z');

      const beginDate = startDateValue.toISOString();
      const endDateFormatted = endDateValue.toISOString();

      const apiFilters = buildFiltersForRequest(filters);
      const payload = {
        "Filters": {
          "Partner": {
            "Value": [partnerId],
            "Operator": "in"
          },
          ...(apiFilters || {})
        },
        "Intervals": [{
          "Begin": beginDate,
          "End": endDateFormatted
        }],
        "Metrics": ["PricePublisher", "PriceAdvertiser_PublisherSide", "CLICK", "IMPRESSION"],
        "Granularity": {
          "type": "period",
          "period": "P1D"
        },
        "View": "ADVANCED_PUBLISHER",
        "Datasource": "adserver_stats",
        "TimeZone": "Etc/GMT",
        "Size": 500
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
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const dataArray = Array.isArray(result?.Data) ? result.Data : Array.isArray(result) ? result : [];

      const processedData = dataArray
        .map((item) => {
          const dspRevenue = item.PriceAdvertiser_PublisherSide || 0;
          const publisherCosts = item.PricePublisher || 0;
          const margin = dspRevenue - publisherCosts;
          const marginPercentage = dspRevenue > 0 ? ((margin / dspRevenue) * 100).toFixed(2) : '0.00';
          
          let dateStr = 'Unknown';
          if (item.timestamp) {
            try {
              let cleanTimestamp = item.timestamp;
              cleanTimestamp = cleanTimestamp.replace(/\.\d{6}(\.\d{3})?/g, '');
              if (!cleanTimestamp.endsWith('Z') && !cleanTimestamp.includes('+') && !cleanTimestamp.includes('-', 10)) {
                cleanTimestamp += 'Z';
              }
              cleanTimestamp = cleanTimestamp.replace(/\.(\d{3})?Z$/, 'Z');
              
              const date = new Date(cleanTimestamp);
              if (!isNaN(date.getTime())) {
                dateStr = date.toISOString().split('T')[0];
              }
            } catch (e) {
              console.error('Error formatting date:', item.timestamp, e);
            }
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
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      setDspDetailData(processedData);
    } catch (err) {
      console.error('Error fetching DSP detail data:', err);
      setError(`Error fetching DSP detail data: ${err.message}`);
      setDspDetailData([]);
    } finally {
      setLoadingDspDetail(false);
    }
  };

  // Handle DSP row click
  const handleDspRowClick = async (partnerId, partnerName, filters = {}) => {
    if (selectedDsp === partnerId) {
      setSelectedDsp(null);
      setDspDetailData([]);
    } else {
      setSelectedDsp(partnerId);
      await fetchDspDetailData(partnerId, filters);
    }
  };

  // Fetch SEAT data from Druid API
  const fetchSeatData = async (filters = {}) => {
    setLoadingSeatData(true);
    if (enableSeatDailyDrillDown) {
      setSelectedSeatRowKey(null);
      setSeatDetailData([]);
    }
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const startDateValue = new Date(startDate + 'T00:00:00.000Z');
      const endDateValue = new Date(endDate + 'T23:59:59.000Z');

      const apiFilters = buildFiltersForRequest(filters);
      const payload = {
        "Intervals": [{
          "Begin": startDateValue.toISOString(),
          "End": endDateValue.toISOString()
        }],
        "Metrics": ["PricePublisher", "PriceAdvertiser_PublisherSide", "SeatName", "partner_name", "CLICK", "IMPRESSION"],
        "Dimensions": ["SeatId"],
        "Granularity": "all",
        "Datasource": "adserver_stats",
        "TimeZone": "Etc/GMT",
        "Size": 250,
        "OrderBy": "PriceAdvertiser_PublisherSide",
        "OrderOp": "DESC",
        ...(apiFilters && { Filters: apiFilters })
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
        const errorMessage = formatError(new Error(`HTTP error! status: ${response.status}`), response);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const dataArray = Array.isArray(result?.Data) ? result.Data : Array.isArray(result) ? result : [];

      const processedData = dataArray
        .map((item) => {
          const seatId = item.SeatId || 'Unknown';
          const seatName = item.SeatName || item.Name_Seat || item.seatName || null;
          const partnerName = item.Name_Partner || item.partner_name || item.PartnerName || item.partnerName || 'Unknown';
          const dspRevenue = item.PriceAdvertiser_PublisherSide || 0;
          const publisherCosts = item.PricePublisher || 0;
          const impressions = item.IMPRESSION ?? item.Impression ?? 0;
          const clicks = item.CLICK ?? item.Click ?? 0;
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          const margin = dspRevenue - publisherCosts;
          const marginPercentage = dspRevenue > 0 ? ((margin / dspRevenue) * 100).toFixed(2) : '0.00';
          
          return {
            ...item,
            seatId: seatId,
            seatName: seatName,
            partnerName: partnerName,
            PriceAdvertiser_PublisherSide: dspRevenue,
            PricePublisher: publisherCosts,
            impressions,
            clicks,
            ctr,
            margin: margin,
            marginPercentage: marginPercentage
          };
        })
        .filter((item) => {
          return item.seatName && item.seatName !== 'Unknown' && item.seatName.trim() !== '';
        })
        .sort((a, b) => (b.PriceAdvertiser_PublisherSide || 0) - (a.PriceAdvertiser_PublisherSide || 0));

      setSeatData(processedData);
    } catch (err) {
      console.error('Error fetching SEAT data:', err);
      setError(formatError(err, null));
      setSeatData([]);
    } finally {
      setLoadingSeatData(false);
    }
  };

  /** P1D × SeatId under entity filters, then filter client-side to one seat + partner. */
  const fetchSeatDetailData = async (seatId, partnerName, filters = {}) => {
    setLoadingSeatDetail(true);
    setSeatDetailData([]);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const startDateValue = new Date(startDate + 'T00:00:00.000Z');
      const endDateValue = new Date(endDate + 'T23:59:59.999Z');

      const apiFilters = buildFiltersForRequest(filters);
      const payload = {
        Intervals: [{
          Begin: startDateValue.toISOString(),
          End: endDateValue.toISOString()
        }],
        Metrics: ['PricePublisher', 'PriceAdvertiser_PublisherSide', 'SeatName', 'partner_name', 'CLICK', 'IMPRESSION'],
        Dimensions: ['SeatId'],
        Granularity: { type: 'period', period: 'P1D' },
        Datasource: 'adserver_stats',
        TimeZone: 'Etc/GMT',
        Size: 10000,
        ...(enableSeatDailyDrillDown && { View: 'ADVANCED_PUBLISHER' }),
        ...(apiFilters && { Filters: apiFilters })
      };

      const response = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ayl-auth-token': token
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorMessage = formatError(new Error(`HTTP error! status: ${response.status}`), response);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const dataArray = Array.isArray(result?.Data) ? result.Data : Array.isArray(result) ? result : [];

      const rowMatchesSelection = (item) => {
        const rowSeatId = item.SeatId ?? item.seatId;
        if (String(rowSeatId) !== String(seatId)) return false;
        if (!partnerName || partnerName === 'Unknown') return true;
        const rowPartner =
          item.Name_Partner || item.partner_name || item.PartnerName || item.partnerName || '';
        return String(rowPartner).trim() === String(partnerName).trim();
      };

      const processedData = dataArray
        .filter(rowMatchesSelection)
        .map((item) => {
          const dspRevenue = item.PriceAdvertiser_PublisherSide || 0;
          const publisherCosts = item.PricePublisher || 0;
          const impressions = item.IMPRESSION ?? item.Impression ?? 0;
          const clicks = item.CLICK ?? item.Click ?? 0;
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          const margin = dspRevenue - publisherCosts;
          const marginPercentage = dspRevenue > 0 ? ((margin / dspRevenue) * 100).toFixed(2) : '0.00';

          const rawTs = item.timestamp ?? item.__time;
          let formattedDate = 'N/A';
          if (rawTs) {
            try {
              let cleanTimestamp = rawTs;
              cleanTimestamp = cleanTimestamp.replace(/\.\d{6}(\.\d{3})?/g, '');
              if (!cleanTimestamp.endsWith('Z') && !cleanTimestamp.includes('+') && !cleanTimestamp.includes('-', 10)) {
                cleanTimestamp += 'Z';
              }
              cleanTimestamp = cleanTimestamp.replace(/\.(\d{3})?Z$/, 'Z');
              const date = new Date(cleanTimestamp);
              if (!isNaN(date.getTime())) {
                formattedDate = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
              }
            } catch (e) {
              console.error('Error formatting date:', rawTs, e);
            }
          }

          const seatName =
            item.SeatName || item.Name_Seat || item.seatName || null;

          return {
            ...item,
            seatId,
            seatName,
            partnerName,
            date: formattedDate,
            timestamp: rawTs,
            PriceAdvertiser_PublisherSide: dspRevenue,
            PricePublisher: publisherCosts,
            impressions,
            clicks,
            ctr,
            margin,
            marginPercentage
          };
        })
        .sort((a, b) => {
          if (a.timestamp && b.timestamp) {
            return new Date(a.timestamp) - new Date(b.timestamp);
          }
          return 0;
        });

      setSeatDetailData(processedData);
    } catch (err) {
      console.error('Error fetching SEAT detail data:', err);
      setError(formatError(err, null));
      setSeatDetailData([]);
    } finally {
      setLoadingSeatDetail(false);
    }
  };

  const handleSeatRowClick = async (item, filters = {}) => {
    if (!enableSeatDailyDrillDown) return;
    const sid = item.seatId;
    const rowKey = getSeatRowKey(item);
    if (sid == null || sid === 'Unknown') return;
    if (selectedSeatRowKey === rowKey) {
      setSelectedSeatRowKey(null);
      setSeatDetailData([]);
    } else {
      setSelectedSeatRowKey(rowKey);
      await fetchSeatDetailData(sid, item.partnerName || 'Unknown', filters);
    }
  };

  // Fetch AD DOMAIN data from Druid API
  const fetchAdDomainData = async (filters = {}) => {
    setLoadingAdDomainData(true);
    if (enableAdDomainDailyDrillDown) {
      setSelectedAdDomainRowKey(null);
      setAdDomainDetailData([]);
    }
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const startDateValue = new Date(startDate + 'T00:00:00.000Z');
      const endDateValue = new Date(endDate + 'T23:59:59.000Z');

      const apiFilters = buildFiltersForRequest(filters);
      const payload = {
        "Intervals": [{
          "Begin": startDateValue.toISOString(),
          "End": endDateValue.toISOString()
        }],
        "Metrics": ["PricePublisher", "PriceAdvertiser_PublisherSide", "partner_name", "CLICK", "IMPRESSION"],
        "Dimensions": ["AdDomains"],
        "Granularity": "all",
        "Datasource": "adserver_stats",
        "TimeZone": "Etc/GMT",
        "Size": 250,
        "OrderBy": "PriceAdvertiser_PublisherSide",
        "OrderOp": "DESC",
        ...(apiFilters && { Filters: apiFilters })
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
        const errorMessage = formatError(new Error(`HTTP error! status: ${response.status}`), response);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const dataArray = Array.isArray(result?.Data) ? result.Data : Array.isArray(result) ? result : [];

      const processedData = dataArray
        .map((item) => {
          const adDomain = item.AdDomains || item.adDomains || 'Unknown';
          const partnerName = item.Name_Partner || item.partner_name || item.PartnerName || item.partnerName || 'Unknown';
          const dspRevenue = item.PriceAdvertiser_PublisherSide || 0;
          const publisherCosts = item.PricePublisher || 0;
          const impressions = item.IMPRESSION ?? item.Impression ?? 0;
          const clicks = item.CLICK ?? item.Click ?? 0;
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          const margin = dspRevenue - publisherCosts;
          const marginPercentage = dspRevenue > 0 ? ((margin / dspRevenue) * 100).toFixed(2) : '0.00';
          
          return {
            ...item,
            adDomain: adDomain,
            partnerName: partnerName,
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

      setAdDomainData(processedData);
    } catch (err) {
      console.error('Error fetching AD DOMAIN data:', err);
      setError(formatError(err, null));
      setAdDomainData([]);
    } finally {
      setLoadingAdDomainData(false);
    }
  };

  /**
   * Daily rows per AdDomains: query P1D × AdDomains under entity filters, then filter client-side
   * (avoids server-side AdDomains filter which is not supported the same way).
   */
  const fetchAdDomainDetailData = async (adDomain, partnerName, filters = {}) => {
    setLoadingAdDomainDetail(true);
    setAdDomainDetailData([]);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const startDateValue = new Date(startDate + 'T00:00:00.000Z');
      const endDateValue = new Date(endDate + 'T23:59:59.999Z');

      const apiFilters = buildFiltersForRequest(filters);
      const payload = {
        Intervals: [{
          Begin: startDateValue.toISOString(),
          End: endDateValue.toISOString()
        }],
        Metrics: ['PricePublisher', 'PriceAdvertiser_PublisherSide', 'partner_name', 'CLICK', 'IMPRESSION'],
        Dimensions: ['AdDomains'],
        Granularity: { type: 'period', period: 'P1D' },
        Datasource: 'adserver_stats',
        TimeZone: 'Etc/GMT',
        Size: 10000,
        ...(enableAdDomainDailyDrillDown && { View: 'ADVANCED_PUBLISHER' }),
        ...(apiFilters && { Filters: apiFilters })
      };

      const response = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ayl-auth-token': token
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorMessage = formatError(new Error(`HTTP error! status: ${response.status}`), response);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const dataArray = Array.isArray(result?.Data) ? result.Data : Array.isArray(result) ? result : [];

      const rowMatchesSelection = (item) => {
        const rowDomain = item.AdDomains || item.adDomains || '';
        if (rowDomain !== adDomain) return false;
        if (!partnerName || partnerName === 'Unknown') return true;
        const rowPartner =
          item.Name_Partner || item.partner_name || item.PartnerName || item.partnerName || '';
        return String(rowPartner).trim() === String(partnerName).trim();
      };

      const processedData = dataArray
        .filter(rowMatchesSelection)
        .map((item) => {
          const dspRevenue = item.PriceAdvertiser_PublisherSide || 0;
          const publisherCosts = item.PricePublisher || 0;
          const impressions = item.IMPRESSION ?? item.Impression ?? 0;
          const clicks = item.CLICK ?? item.Click ?? 0;
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          const margin = dspRevenue - publisherCosts;
          const marginPercentage = dspRevenue > 0 ? ((margin / dspRevenue) * 100).toFixed(2) : '0.00';

          const rawTs = item.timestamp ?? item.__time;
          let formattedDate = 'N/A';
          if (rawTs) {
            try {
              let cleanTimestamp = rawTs;
              cleanTimestamp = cleanTimestamp.replace(/\.\d{6}(\.\d{3})?/g, '');
              if (!cleanTimestamp.endsWith('Z') && !cleanTimestamp.includes('+') && !cleanTimestamp.includes('-', 10)) {
                cleanTimestamp += 'Z';
              }
              cleanTimestamp = cleanTimestamp.replace(/\.(\d{3})?Z$/, 'Z');
              const date = new Date(cleanTimestamp);
              if (!isNaN(date.getTime())) {
                formattedDate = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
              }
            } catch (e) {
              console.error('Error formatting date:', rawTs, e);
            }
          }

          return {
            ...item,
            adDomain,
            partnerName,
            date: formattedDate,
            timestamp: rawTs,
            PriceAdvertiser_PublisherSide: dspRevenue,
            PricePublisher: publisherCosts,
            impressions,
            clicks,
            ctr,
            margin,
            marginPercentage
          };
        })
        .sort((a, b) => {
          if (a.timestamp && b.timestamp) {
            return new Date(a.timestamp) - new Date(b.timestamp);
          }
          return 0;
        });

      setAdDomainDetailData(processedData);
    } catch (err) {
      console.error('Error fetching AD DOMAIN detail data:', err);
      setError(formatError(err, null));
      setAdDomainDetailData([]);
    } finally {
      setLoadingAdDomainDetail(false);
    }
  };

  const handleAdDomainRowClick = async (item, filters = {}) => {
    if (!enableAdDomainDailyDrillDown) return;
    const domain = item.adDomain || '';
    const rowKey = getAdDomainRowKey(item);
    if (!domain || domain === 'Unknown') return;
    if (selectedAdDomainRowKey === rowKey) {
      setSelectedAdDomainRowKey(null);
      setAdDomainDetailData([]);
    } else {
      setSelectedAdDomainRowKey(rowKey);
      await fetchAdDomainDetailData(domain, item.partnerName || 'Unknown', filters);
    }
  };

  // Fetch SITE DOMAIN data from Druid API
  const fetchSiteDomainData = async (filters = {}) => {
    setLoadingSiteDomainData(true);
    setSelectedSiteDomain(null);
    setSiteDomainDetailData([]);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      let nameLookup = { ...realmNameById };
      if (Object.keys(nameLookup).length === 0) {
        try {
          const res = await cachedFetch(API_ENDPOINTS.REALMS_SEARCH, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-ayl-auth-token': token,
            },
            body: JSON.stringify({
              From: 0,
              Size: 500,
              Order: [{ Field: 'Name', Operator: 'asc' }],
              Filters: [],
            }),
          });
          if (res.ok) {
            const j = await res.json();
            const m = {};
            (j.Data || []).forEach((realm) => {
              if (realm?.Uid) m[realm.Uid] = realm.Name;
            });
            nameLookup = m;
            setRealmNameById(m);
          }
        } catch (e) {
          console.warn('Could not load realm names for SITE DOMAIN panel:', e);
        }
      }

      const startDateValue = new Date(startDate + 'T00:00:00.000Z');
      const endDateValue = new Date(endDate + 'T23:59:59.000Z');

      const apiFilters = buildFiltersForRequest(filters);
      const base = {
        Intervals: [
          {
            Begin: startDateValue.toISOString(),
            End: endDateValue.toISOString(),
          },
        ],
        Metrics: [
          'PricePublisher',
          'PriceAdvertiser_PublisherSide',
          'CLICK',
          'IMPRESSION',
        ],
        Granularity: 'all',
        Datasource: 'adserver_stats',
        TimeZone: 'Etc/GMT',
        Size: 500,
        OrderBy: 'PriceAdvertiser_PublisherSide',
        OrderOp: 'DESC',
        ...(apiFilters && { Filters: apiFilters }),
      };

      // Prefer realm × site (single query). Some backends may reject multiple dimensions; fall back to SiteDomain only.
      const try2d = { ...base, Dimensions: ['RealmPublisher', 'SiteDomain'] };
      const try1d = { ...base, Dimensions: ['SiteDomain'] };

      const post = (body) =>
        cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-ayl-auth-token': token,
          },
          body: JSON.stringify(body),
        });

      let response = await post(try2d);
      if (!response.ok) {
        const errText = await response.text();
        console.warn('SITE DOMAIN: 2D query failed, using SiteDomain only:', response.status, errText);
        response = await post(try1d);
      }
      if (!response.ok) {
        const errorMessage = formatError(new Error(`HTTP error! status: ${response.status}`), response);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const dataArray = Array.isArray(result?.Data) ? result.Data : Array.isArray(result) ? result : [];

      const contextRealmId = typeof window !== 'undefined' ? localStorage.getItem('selected-realm-id') : null;
      const contextRealmName = contextRealmId && nameLookup[contextRealmId] ? nameLookup[contextRealmId] : null;

      const processedData = dataArray
        .map((item) => {
          const siteDomain = item.SiteDomain || 'Unknown';
          const realmPublisherId =
            item.RealmPublisher ?? item.realmPublisher ?? item.realmId ?? null;
          const realmName = realmPublisherId
            ? nameLookup[realmPublisherId] || null
            : contextRealmName;
          const dspRevenue = item.PriceAdvertiser_PublisherSide || 0;
          const publisherCosts = item.PricePublisher || 0;
          const impressions = item.IMPRESSION ?? item.Impression ?? 0;
          const clicks = item.CLICK ?? item.Click ?? 0;
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          const margin = dspRevenue - publisherCosts;
          const marginPercentage = dspRevenue > 0 ? ((margin / dspRevenue) * 100).toFixed(2) : '0.00';

          return {
            ...item,
            siteDomain,
            siteName: siteDomain,
            realmPublisherId: realmPublisherId || null,
            realmName: realmName || '—',
            PriceAdvertiser_PublisherSide: dspRevenue,
            PricePublisher: publisherCosts,
            impressions,
            clicks,
            ctr,
            margin,
            marginPercentage,
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

  // Daily breakdown for one site domain (adserver_stats, P1D)
  const fetchSiteDomainDetailData = async (siteDomain, filters = {}, rowRealmPublisher = null) => {
    setLoadingSiteDomainDetail(true);
    setSiteDomainDetailData([]);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const startDateValue = new Date(startDate + 'T00:00:00.000Z');
      const endDateValue = new Date(endDate + 'T23:59:59.999Z');

      const apiFilters = buildFiltersForRequestWithSiteDomain(filters, siteDomain, rowRealmPublisher);
      const payload = {
        Intervals: [{
          Begin: startDateValue.toISOString(),
          End: endDateValue.toISOString()
        }],
        Metrics: ['PricePublisher', 'PriceAdvertiser_PublisherSide', 'CLICK', 'IMPRESSION'],
        Granularity: { type: 'period', period: 'P1D' },
        Datasource: 'adserver_stats',
        TimeZone: 'Etc/GMT',
        ...(apiFilters && { Filters: apiFilters })
      };

      const response = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ayl-auth-token': token
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorMessage = formatError(new Error(`HTTP error! status: ${response.status}`), response);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      const dataArray = Array.isArray(result?.Data) ? result.Data : Array.isArray(result) ? result : [];

      const processedData = dataArray
        .map((item) => {
          const dspRevenue = item.PriceAdvertiser_PublisherSide || 0;
          const publisherCosts = item.PricePublisher || 0;
          const impressions = item.IMPRESSION ?? item.Impression ?? 0;
          const clicks = item.CLICK ?? item.Click ?? 0;
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          const margin = dspRevenue - publisherCosts;
          const marginPercentage = dspRevenue > 0 ? ((margin / dspRevenue) * 100).toFixed(2) : '0.00';

          const rawTs = item.timestamp ?? item.__time;
          let formattedDate = 'N/A';
          if (rawTs) {
            try {
              let cleanTimestamp = rawTs;
              cleanTimestamp = cleanTimestamp.replace(/\.\d{6}(\.\d{3})?/g, '');
              if (!cleanTimestamp.endsWith('Z') && !cleanTimestamp.includes('+') && !cleanTimestamp.includes('-', 10)) {
                cleanTimestamp += 'Z';
              }
              cleanTimestamp = cleanTimestamp.replace(/\.(\d{3})?Z$/, 'Z');
              const date = new Date(cleanTimestamp);
              if (!isNaN(date.getTime())) {
                formattedDate = date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
              }
            } catch (e) {
              console.error('Error formatting date:', rawTs, e);
            }
          }

          return {
            ...item,
            siteDomain,
            date: formattedDate,
            timestamp: rawTs,
            PriceAdvertiser_PublisherSide: dspRevenue,
            PricePublisher: publisherCosts,
            impressions,
            clicks,
            ctr,
            margin,
            marginPercentage
          };
        })
        .sort((a, b) => {
          if (a.timestamp && b.timestamp) {
            return new Date(a.timestamp) - new Date(b.timestamp);
          }
          return 0;
        });

      setSiteDomainDetailData(processedData);
    } catch (err) {
      console.error('Error fetching SITE DOMAIN detail data:', err);
      setError(formatError(err, null));
      setSiteDomainDetailData([]);
    } finally {
      setLoadingSiteDomainDetail(false);
    }
  };

  const handleSiteDomainRowClick = async (item, filters = {}) => {
    const siteDomain = item?.siteDomain || item?.siteName || '';
    const key = getSiteDomainRowKey(item);
    if (!key || (siteDomain || '') === 'Unknown') return;
    if (selectedSiteDomain === key) {
      setSelectedSiteDomain(null);
      setSiteDomainDetailData([]);
    } else {
      setSelectedSiteDomain(key);
      await fetchSiteDomainDetailData(siteDomain, filters, item?.realmPublisherId || null);
    }
  };

  // Fetch GEO data from Druid API
  const fetchGeoData = async (filters = {}) => {
    setLoadingGeoData(true);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const startDateValue = new Date(startDate + 'T00:00:00.000Z');
      const endDateValue = new Date(endDate + 'T23:59:59.000Z');

      const apiFilters = buildFiltersForRequest(filters);
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
        "OrderOp": "DESC",
        ...(apiFilters && { Filters: apiFilters })
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
        const errorMessage = formatError(new Error(`HTTP error! status: ${response.status}`), response);
        throw new Error(errorMessage);
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

  // Helper function to sanitize filename
  const sanitizeFilename = (str) => {
    return str
      .replace(/[^a-z0-9]/gi, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50); // Limit length
  };

  // Helper function to generate filename with entity info
  const getExportFilename = (baseName) => {
    const date = new Date().toISOString().split('T')[0];
    if (entityName && entityId) {
      const cleanName = sanitizeFilename(entityName);
      const cleanId = entityId.substring(0, 8); // Use first 8 chars of ID
      return `${baseName}_${cleanName}_${cleanId}_${date}.csv`;
    } else if (entityId) {
      const cleanId = entityId.substring(0, 8);
      return `${baseName}_${cleanId}_${date}.csv`;
    }
    return `${baseName}_${date}.csv`;
  };

  const exportCurrentPageToPDF = async () => {
    if (!exportPageRef.current || exportingPdf) return;
    setExportingPdf(true);
    const exportRoot = exportPageRef.current;
    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-export-style', 'true');
    styleEl.textContent = `
      .pdf-exporting table td,
      .pdf-exporting table th {
        padding-top: 10px !important;
        padding-bottom: 10px !important;
        line-height: 1.4 !important;
      }
      .pdf-exporting td.export-margin-cell,
      .pdf-exporting td.export-margin-cell * {
        background: transparent !important;
        color: #000000 !important;
        box-shadow: none !important;
        border-color: #000000 !important;
      }
    `;
    document.head.appendChild(styleEl);
    exportRoot.classList.add('pdf-exporting');
    const marginCells = [];
    try {
      const tables = Array.from(exportRoot.querySelectorAll('table'));
      tables.forEach((table) => {
        const headerRow = table.querySelector('thead tr');
        if (!headerRow) return;
        const headerCells = Array.from(headerRow.querySelectorAll('th'));
        const marginIndexes = headerCells
          .map((th, index) => ({ text: (th.textContent || '').trim().toLowerCase(), index }))
          .filter(({ text }) => text === 'profit %' || text === 'margin %')
          .map(({ index }) => index);
        if (marginIndexes.length === 0) return;
        const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
        bodyRows.forEach((row) => {
          const cells = Array.from(row.querySelectorAll('td'));
          marginIndexes.forEach((idx) => {
            const cell = cells[idx];
            if (cell) {
              cell.classList.add('export-margin-cell');
              marginCells.push(cell);
            }
          });
        });
      });
    } catch (e) {
      // Ignore DOM scan issues during export
    }
    try {
      const canvas = await html2canvas(exportPageRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f8fafc',
        ignoreElements: (element) => element?.classList?.contains('export-ignore'),
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginMm = 5.3; // ~20px at 96 DPI
      const availableWidth = pageWidth - marginMm * 2;
      const availableHeight = pageHeight - marginMm * 2;
      const imgWidth = availableWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const pxPerMm = canvas.width / imgWidth;
      const sliceHeightPx = Math.floor(availableHeight * pxPerMm);
      const overlapPx = Math.floor(8 * pxPerMm); // ~8mm overlap
      const stepPx = Math.max(sliceHeightPx - overlapPx, 1);
      const pageCount = Math.ceil(canvas.height / stepPx);

      for (let page = 0; page < pageCount; page += 1) {
        if (page > 0) {
          pdf.addPage();
        }
        const sourceY = page * stepPx;
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = Math.min(sliceHeightPx, canvas.height - sourceY);
        const ctx = sliceCanvas.getContext('2d');
        ctx.drawImage(
          canvas,
          0,
          sourceY,
          canvas.width,
          sliceCanvas.height,
          0,
          0,
          sliceCanvas.width,
          sliceCanvas.height
        );

        const sliceImg = sliceCanvas.toDataURL('image/png');
        const sliceHeightMm = (sliceCanvas.height / canvas.width) * imgWidth;
        pdf.addImage(sliceImg, 'PNG', marginMm, marginMm, imgWidth, sliceHeightMm);
      }

      const safeName = sanitizeFilename(entityName || defaultEntityName || 'Analytics');
      const date = new Date().toISOString().split('T')[0];
      pdf.save(`${safeName}_${date}.pdf`);
    } catch (error) {
      console.error('Error generating page PDF:', error);
      alert('Error generating PDF: ' + (error?.message || 'Unknown error'));
    } finally {
      marginCells.forEach((cell) => cell.classList.remove('export-margin-cell'));
      exportRoot.classList.remove('pdf-exporting');
      if (styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
      setExportingPdf(false);
    }
  };

  // Export functions
  const exportKPIPROGToCSV = () => {
    if (analyticsData.length === 0) return;

    const headers = [
      'Date', 'Bid Requests', 'Bid Requests Trend', 'Bid Responses', 'Bid Responses Trend',
      'Impressions', 'Impressions Trend', 'Publisher Revenue', 'Publisher Revenue Trend',
      'eCPM Publisher', 'eCPM Publisher Trend',
      'RPBR/M', 'RPBR/M Trend', 'Fill Rate', 'Fill Rate Trend', 'Win Rate', 'Win Rate Trend'
    ];

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
      const pricePublisher = item.network_operations_price_publisher !== null && item.network_operations_price_publisher !== undefined 
        ? new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }).format(item.network_operations_price_publisher) : 'N/A';
      const pricePublisherTrend = item.pricePublisherTrend === 'up' ? `+${item.pricePublisherChangePercent}%` :
        item.pricePublisherTrend === 'down' ? `${item.pricePublisherChangePercent}%` : '—';
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
        date, bidRequests, bidRequestsTrend, bidResponses, bidResponsesTrend,
        impressions, impressionsTrend, pricePublisher, pricePublisherTrend,
        ecpm, ecpmTrend,
        rpbr, rpbrTrend, fillRate, fillRateTrend, winRate, winRateTrend
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', getExportFilename('KPI_PROG'));
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export main analytics table to CSV
  const exportAnalyticsTableToCSV = () => {
    if (analyticsData.length === 0) return;

    // Get all unique keys from the data to create headers
    const allKeys = new Set();
    analyticsData.forEach(item => {
      Object.keys(item).forEach(key => {
        // Exclude internal/UI keys
        if (!key.includes('Trend') && !key.includes('ChangePercent') && 
            key !== 'dateKey' && key !== 'formattedDate' && key !== 'formattedTime') {
          allKeys.add(key);
        }
      });
    });

    // Order headers: put common ones first
    const commonHeaders = ['date', 'formattedDate', 'timestamp', 'PriceAdvertiser_PublisherSide', 
      'PricePublisher', 'margin', 'marginPercentage', 'profitPercentage'];
    const orderedHeaders = [
      ...commonHeaders.filter(h => allKeys.has(h)),
      ...Array.from(allKeys).filter(h => !commonHeaders.includes(h)).sort()
    ];

    const headers = orderedHeaders.map(key => {
      // Format header names
      return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
    });

    const rows = analyticsData.map((item) => {
      return orderedHeaders.map(key => {
        const value = item[key];
        if (value === null || value === undefined) return 'N/A';
        if (typeof value === 'number') {
          // Format large numbers
          if (key.includes('Price') || key.includes('Revenue') || key.includes('Cost') || key.includes('Margin')) {
            return (value / 1000000).toFixed(2);
          }
          return value.toString();
        }
        if (typeof value === 'object') return JSON.stringify(value);
        return value.toString();
      });
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', getExportFilename('Analytics_Table'));
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportDeviceDataToCSV = () => {
    if (deviceData.length === 0) return;

    const headers = ['Device', 'DSP Revenue', 'Publisher Costs', 'ADY Margin', 'Margin %'];
    const rows = deviceData.map((item) => [
      item.device || 'Unknown',
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
    link.setAttribute('download', getExportFilename('Device_Data'));
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportDspDataToCSV = () => {
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
    link.setAttribute('download', getExportFilename('DSP_Data'));
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportSeatDataToCSV = () => {
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
    link.setAttribute('download', getExportFilename('SEAT_Data'));
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportAdDomainDataToCSV = () => {
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
    link.setAttribute('download', getExportFilename('AD_Domain_Data'));
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportAdKindDataToCSV = () => {
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
    link.setAttribute('download', getExportFilename('AD_Kind_Data'));
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportSiteDomainDataToCSV = () => {
    if (siteDomainData.length === 0) return;
    const headers = ['Realm', 'Site Domain', 'DSP Revenue', 'Publisher Costs', 'ADY Margin', 'Impressions', 'Click', 'CTR', 'Margin %'];
    const rows = siteDomainData.map((item) => [
      item.realmName || '—',
      item.siteDomain || 'Unknown',
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
    link.setAttribute('download', getExportFilename('Site_Domain_Data'));
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
    link.setAttribute('download', getExportFilename('GEO_Data'));
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const currentTableConfig = tableConfig ? tableConfig[viewMode] ?? null : null;
  const hasTableConfig = Boolean(currentTableConfig);
  const baseColumnsConfig = hasTableConfig && Array.isArray(currentTableConfig.columns) ? currentTableConfig.columns : [];
  const detailedColumnsConfig = hasTableConfig && Array.isArray(currentTableConfig.detailedColumns) ? currentTableConfig.detailedColumns : [];
  const hasConfigDetailedColumns = viewMode === 'daily' && detailedColumnsConfig.length > 0;
  const shouldShowDetailedToggle = viewMode === 'daily' && ((hasTableConfig && detailedColumnsConfig.length > 0) || (!hasTableConfig && renderTableHeaders && renderTableRow));
  const shouldRenderDetailedColumns = hasTableConfig && viewMode === 'daily' && showDetailedColumns && detailedColumnsConfig.length > 0;

  const renderHeaderFromConfig = (columns) =>
    columns.map((column, idx) => {
      const headerContent = typeof column.header === 'function'
        ? column.header({ viewMode, showDetailedColumns })
        : column.header;

      if (React.isValidElement(headerContent)) {
        return React.cloneElement(headerContent, {
          key: column.id || column.key || `header-${idx}`,
        });
      }

      return (
        <TableHead key={column.id || column.key || `header-${idx}`}>
          {headerContent}
        </TableHead>
      );
    });

  const renderCellsFromConfig = (columns, item, rowIndex, entityId = null) =>
    columns.map((column, idx) => {
      const cellContent = typeof column.cell === 'function'
        ? column.cell({ item, index: rowIndex, analyticsData, viewMode, showDetailedColumns, entityId })
        : column.cell;

      if (React.isValidElement(cellContent)) {
        return React.cloneElement(cellContent, {
          key: `${column.id || column.key || `cell-${idx}`}-${rowIndex}`,
        });
      }

      return (
        <TableCell key={`${column.id || column.key || `cell-${idx}`}-${rowIndex}`}>
          {cellContent}
        </TableCell>
      );
    });
  
  // Listen for view mode changes from localStorage
  useEffect(() => {
    const handleStorageChange = () => {
      setViewMode(localStorage.getItem('analytics-view-mode') || 'daily');
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);
  
  // Watch for view mode changes in current window
  useEffect(() => {
    const checkViewMode = setInterval(() => {
      const storedMode = localStorage.getItem('analytics-view-mode') || 'daily';
      if (storedMode !== viewMode) {
        setViewMode(storedMode);
      }
    }, 100);
    return () => clearInterval(checkViewMode);
  }, [viewMode]);



  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Ref to prevent duplicate fetches (e.g. from rapid useEffect runs or double event dispatch)
  const lastFetchKeyRef = useRef(null);
  const isFetchingRef = useRef(false);

  // Load Entity ID from URL params or override prop on component mount
  useEffect(() => {
    // Use override prop if provided, otherwise use URL params
    const entityIdFromSource = entityIdOverride || searchParams.get(entityIdParam);
    const entityNameFromUrl = searchParams.get(entityNameParam);
    
    if (entityIdFromSource) {
      setEntityId(entityIdFromSource);
      setEntityName(entityNameFromUrl || defaultEntityName);
      
      // Initialize dates from header time range
      const dates = getEffectiveDatesForFilterPanels();
      setStartDate(dates.start);
      setEndDate(dates.end);
    }
  }, [searchParams, entityIdParam, entityNameParam, defaultEntityName, entityIdOverride]);

  // Fetch analytics data when Entity ID or view mode changes
  useEffect(() => {
    if (entityId && startDate && endDate) {
      fetchAnalyticsData();
    }
  }, [entityId, viewMode, startDate, endDate]);

  // Listen for time range changes from header
  useEffect(() => {
    const handleTimeRangeChange = () => {
      if (entityId) {
        const dates = getEffectiveDatesForFilterPanels();
        // Only update state if dates actually changed to avoid unnecessary re-fetches
        setStartDate((prev) => (prev !== dates.start ? dates.start : prev));
        setEndDate((prev) => (prev !== dates.end ? dates.end : prev));
      }
    };

    window.addEventListener('timeRangeChanged', handleTimeRangeChange);
    window.addEventListener('storage', handleTimeRangeChange);

    return () => {
      window.removeEventListener('timeRangeChanged', handleTimeRangeChange);
      window.removeEventListener('storage', handleTimeRangeChange);
    };
  }, [entityId, viewMode]);

  // Ensure daily view picks up current time range on mode switch
  useEffect(() => {
    if (!entityId || viewMode !== 'daily') return;
    const dates = getEffectiveDatesForFilterPanels();
    setStartDate((prev) => (prev !== dates.start ? dates.start : prev));
    setEndDate((prev) => (prev !== dates.end ? dates.end : prev));
  }, [entityId, viewMode]);

  // Fetch network operations data
  const fetchNetworkOperationsData = async (startDateValue, endDateValue) => {
    try {
      const authToken = getAuthToken();
      if (!authToken) {
        throw new Error("No authentication token found");
      }

      // Format dates in UTC for network operations API
      const beginDateISO = startDateValue.toISOString();
      const endDateForPayload = new Date(endDateValue);
      endDateForPayload.setMilliseconds(999);
      const endDateISO = endDateForPayload.toISOString();

      const baseMetrics = networkOperationsConfig?.metricList || [
        "network_operations_bid_requests",
        "network_operations_bid_responses",
        "network_operations_impressions",
        "network_operations_click",
        "network_operations_visible_impressions",
        "network_operations_viewability_rate",
        "network_operations_price_publisher",
        "network_operations_ecpm_publisher"
      ];
      const metrics = baseMetrics.includes("network_operations_price_advertiser")
        ? baseMetrics
        : [...baseMetrics, "network_operations_price_advertiser"];

      const payload = {
        "Datasource": "network_operations",
        "Metrics": metrics,
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

      if (networkOperationsConfig?.filtersBuilder && payload) {
        const extraFilters = networkOperationsConfig.filtersBuilder({ entityId });
        if (extraFilters && Object.keys(extraFilters).length > 0) {
          payload.Filters = extraFilters;
        }
      }

      console.log('🟢 NETWORK OPERATIONS API Call (Daily mode only):');
      console.log('  📅 Date Range:', beginDateISO, 'to', endDateISO);
      console.log('  📤 Payload:', JSON.stringify(payload, null, 2));
      console.log('  🌐 Endpoint:', API_ENDPOINTS.DRUID_SEARCH);

      const response = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ayl-auth-token": authToken
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
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

  const fetchAnalyticsData = async () => {
    if (!entityId) return;

    // Build fetch key for deduplication
    const fetchKey = `${entityId}|${startDate}|${endDate}|${viewMode}`;
    if (isFetchingRef.current && lastFetchKeyRef.current === fetchKey) {
      return; // Skip duplicate in-flight request
    }
    lastFetchKeyRef.current = fetchKey;
    isFetchingRef.current = true;

    setLoading(true);
    setError(null);

    try {
      const authToken = getAuthToken();
      if (!authToken) {
        throw new Error('Authentication token not found');
      }

      // Format dates for API
      // For hourly view, always use Yesterday and Today for comparison (ignore selected time range)
      let beginDate, endDateFormatted;
      
      if (viewMode === 'hourly') {
        const now = new Date();
        const todayYear = now.getUTCFullYear();
        const todayMonth = now.getUTCMonth();
        const todayDate = now.getUTCDate();
        
        // Yesterday: start at 00:00:00 UTC
        beginDate = new Date(Date.UTC(todayYear, todayMonth, todayDate - 1, 0, 0, 0, 0));
        
        // Today: end at 23:59:59 UTC
        endDateFormatted = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
      } else {
        // For daily view, use selected dates
        beginDate = new Date(startDate + 'T00:00:00.000+00:00');
        endDateFormatted = new Date(endDate + 'T23:59:59.000+00:00');
      }

      // Build payload using provided function
      const payload = buildPayload(entityId, beginDate.toISOString(), endDateFormatted.toISOString(), viewMode);

      // If payload is null, it means the entity ID is not yet resolved (e.g., for brokers)
      // Skip the fetch in this case
      if (!payload) {
        setLoading(false);
        return;
      }

      console.log('Analytics Payload:', payload);

      const useNetworkOpsOnly = useNetworkOpsOnlyDaily && viewMode === 'daily';

      // Make API calls - network operations only for daily view and exclude Today
      const apiCalls = [];
      if (!useNetworkOpsOnly) {
        apiCalls.push({
          key: 'adserver',
          promise: cachedFetch(apiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-ayl-auth-token': authToken
            },
            body: JSON.stringify(payload)
          })
        });
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
        let networkOpsEndDate = endDateFormatted;
        if (endDateFormatted >= todayStart) {
          // Use yesterday 23:59:59 UTC as end date (network operations data is aggregated nightly)
          networkOpsEndDate = new Date(Date.UTC(todayYear, todayMonth, todayDate - 1, 23, 59, 59, 999));
          
          // If startDate is also today, skip network operations call (no data available)
          if (beginDate >= todayStart) {
            console.log('⚠️ Network Operations: Skipping call - selected period is Today only (data aggregated nightly, no real-time data)');
          } else {
            console.log('⚠️ Network Operations: Excluding Today (data aggregated nightly). Using end date:', networkOpsEndDate.toISOString());
            apiCalls.push({ key: 'networkOps', promise: fetchNetworkOperationsData(beginDate, networkOpsEndDate) });
          }
        } else {
          // End date is before today, safe to use as-is
          apiCalls.push({ key: 'networkOps', promise: fetchNetworkOperationsData(beginDate, networkOpsEndDate) });
        }
      }

      let responses;
      let response;
      let networkOpsData = null;
      try {
        responses = await Promise.all(apiCalls.map((call) => call.promise));
        apiCalls.forEach((call, index) => {
          if (call.key === 'adserver') {
            response = responses[index];
          }
          if (call.key === 'networkOps') {
            networkOpsData = responses[index];
          }
        });
      } catch (fetchError) {
        // Network error (CORS, connection failed, etc.)
        throw { error: fetchError, response: null };
      }
      
      let responseData = [];
      if (useNetworkOpsOnly) {
        const rawNetworkOps = Array.isArray(networkOpsData)
          ? networkOpsData
          : (networkOpsData?.Data || []);
        responseData = rawNetworkOps.map((item) => ({
          ...item,
          PriceAdvertiser_PublisherSide: (item.network_operations_price_advertiser || 0) * 1_000_000,
          PricePublisher: (item.network_operations_price_publisher || 0) * 1_000_000,
          IMPRESSION: item.network_operations_impressions ?? 0,
          CLICK: item.network_operations_click ?? item.network_operations_clicks ?? 0
        }));
      } else {
        if (!response || !response.ok) {
          throw { error: new Error(`HTTP error! status: ${response?.status ?? 'unknown'}`), response };
        }

        const data = await response.json();
        console.log('Analytics Response:', data);

        // Handle both array response and object with Data property
        if (Array.isArray(data)) {
          responseData = data;
        } else if (data && data.Data) {
          responseData = data.Data;
        }
      }

      if (responseData.length > 0 && processAnalyticsData) {
        // Process data using provided function, passing network operations data
        const processedData = processAnalyticsData(responseData, viewMode, networkOpsData);
        setAnalyticsData(processedData);
        
        if (calculateSummaryStats) {
          const stats = calculateSummaryStats(processedData, viewMode);
          const normalizedStats = stats
            ? {
                ...stats,
                totalDSP: stats.totalDSP ?? stats.entityRevenue ?? stats.totalDspRevenue ?? stats.totalAdvertiserSpend ?? 0,
                totalPublisher: stats.totalPublisher ?? stats.publisherCosts ?? stats.totalPublisherRevenue ?? 0,
                totalMargin: stats.totalMargin ?? stats.margin ?? (stats.totalDSP ?? stats.totalDspRevenue ?? stats.entityRevenue ?? 0) - (stats.totalPublisher ?? stats.totalPublisherRevenue ?? stats.publisherCosts ?? 0),
                marginPercentage: stats.marginPercentage ?? stats.avgMarginPercentage ?? 0
              }
            : stats;
          setSummaryStats(normalizedStats);
        }
        
        setLastRefresh(new Date());
      } else {
        setAnalyticsData([]);
        setSummaryStats(null);
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
      const errorMessage = formatError(err.error || err, err.response);
      setError(errorMessage);
      setAnalyticsData([]);
      setSummaryStats(null);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  const fetchAnalyticsDataRef = useRef(fetchAnalyticsData);
  fetchAnalyticsDataRef.current = fetchAnalyticsData;
  useEffect(() => {
    const onDruidCacheCleared = () => {
      try {
        void fetchAnalyticsDataRef.current();
      } catch (e) {
        console.warn('Analytics refetch after druidCacheCleared:', e);
      }
    };
    window.addEventListener('druidCacheCleared', onDruidCacheCleared);
    return () => window.removeEventListener('druidCacheCleared', onDruidCacheCleared);
  }, []);

  // Default summary cards renderer matching DashboardTemplate colors
  const defaultRenderSummaryCards = (summaryStatsArg, viewModeArg) => {
    if (viewModeArg !== 'hourly') {
      return null;
    }
    return (
      <>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={TAILWIND_CLASSES.formSectionLabel}>DSP Revenue</p>
                <p className="text-lg lg:text-xl font-bold text-green-600">{formatCurrency(summaryStatsArg?.totalDSP || summaryStatsArg?.entityRevenue || summaryStatsArg?.totalDspRevenue || 0)}</p>
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
                <p className="text-lg lg:text-xl font-bold text-red-600">{formatCurrency(summaryStatsArg?.totalPublisher || summaryStatsArg?.publisherCosts || summaryStatsArg?.totalPublisherRevenue || 0)}</p>
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
                <p className="text-lg lg:text-xl font-bold" style={{ color: 'rgb(79, 70, 229)' }}>{formatCurrency((summaryStatsArg?.totalMargin ?? summaryStatsArg?.margin ?? summaryStatsArg?.totalMargin) || 0)}</p>
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
                <p className="text-lg lg:text-xl font-bold text-orange-600">{(summaryStatsArg?.marginPercentage ?? summaryStatsArg?.avgMarginPercentage ?? summaryStatsArg?.avgMarginPercentage ?? 0).toFixed ? (summaryStatsArg?.marginPercentage ?? summaryStatsArg?.avgMarginPercentage ?? summaryStatsArg?.avgMarginPercentage ?? 0).toFixed(2) : (summaryStatsArg?.marginPercentage ?? summaryStatsArg?.avgMarginPercentage ?? summaryStatsArg?.avgMarginPercentage ?? 0)}%</p>
              </div>
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <Calendar className="w-4 h-4 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </>
    );
  };

  const defaultRenderChart = (analyticsDataArg, viewModeArg, networkOperationsDataArg) => {
    if (viewModeArg === 'hourly') {
      const xAxisKey = analyticsDataArg?.[0]?.hourOnly ? 'hourOnly' : 'formattedDate';
      const hasYesterday = analyticsDataArg.some((item) => item.yesterdayDspRevenue !== undefined);
      return (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analyticsDataArg}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey={xAxisKey} 
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
                  props.dataKey === 'PriceAdvertiser_PublisherSide' ? 'DSP Revenue' : 
                  props.dataKey === 'yesterdayDspRevenue' ? 'Yesterday DSP Revenue' : name
                ]}
                labelFormatter={(label) => `Time: ${label}`}
              />
              <Legend onClick={(e) => toggleSeries('hourly_revenue', e.dataKey)} wrapperStyle={{ cursor: 'pointer' }} />
              <Line 
                type="monotone" 
                dataKey="PriceAdvertiser_PublisherSide" 
                stroke="#10b981" 
                strokeWidth={2}
                name="DSP Revenue"
                dot={false}
                activeDot={false}
                hide={isSeriesHidden('hourly_revenue', 'PriceAdvertiser_PublisherSide')}
              />
              {hasYesterday && (
                <Line 
                  type="monotone" 
                  dataKey="yesterdayDspRevenue" 
                  stroke="#6b7280" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Yesterday DSP Revenue"
                  dot={false}
                  activeDot={false}
                  hide={isSeriesHidden('hourly_revenue', 'yesterdayDspRevenue')}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (viewModeArg === 'daily' && analyticsDataArg.length > 0) {
      const totalAdvertiserSpend = analyticsDataArg.reduce((sum, item) => sum + (item.PriceAdvertiser_PublisherSide || 0), 0);
      const totalPublisherRevenue = analyticsDataArg.reduce((sum, item) => sum + (item.PricePublisher || 0), 0);
      const totalMargin = totalAdvertiserSpend - totalPublisherRevenue;
      const avgMarginPercentage = totalAdvertiserSpend > 0 ? ((totalMargin / totalAdvertiserSpend) * 100).toFixed(2) : '0.00';
      const totalImpressions = analyticsDataArg.reduce((sum, item) => sum + (item.network_operations_impressions || 0), 0);
      const totalVisibleImpressions = analyticsDataArg.reduce((sum, item) => sum + (item.network_operations_visible_impressions || 0), 0);
      const avgViewabilityRate = (() => {
        const rates = analyticsDataArg
          .map((item) => item.network_operations_viewability_rate)
          .filter((rate) => typeof rate === 'number');
        if (rates.length === 0) return 0;
        const avgRate = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
        return avgRate * 100;
      })();

      const ecpmChartData = analyticsDataArg.map((item) => {
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

      const clickCtrChartData = analyticsDataArg.map((item) => {
        const impressions = item.network_operations_impressions ?? item.IMPRESSION ?? item.impression ?? 0;
        const clicks = item.network_operations_click ?? item.CLICK ?? item.click ?? 0;
        const ctr = typeof item.ctr === 'number' ? item.ctr : (impressions > 0 ? (clicks / impressions) * 100 : 0);
        return {
          ...item,
          clicks,
          ctr
        };
      });

      return (
        <>
          {networkOperationsDataArg && networkOperationsDataArg.length > 0 && (
            <div className="mb-4">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3 pt-3" />
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      {!location.pathname.includes('DealAnalytics') && (
                        <div className={cn(TAILWIND_CLASSES.formSectionLabel, 'mb-3')}>Revenue Snapshot</div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg border" style={{ backgroundColor: 'rgb(240, 253, 244)', borderColor: 'rgb(187, 247, 208)' }}>
                          <div className="flex items-start justify-between mb-1">
                            <div className={cn(TAILWIND_CLASSES.formSectionLabel)} style={{ color: 'rgb(20, 83, 45)' }}>DSP Revenue</div>
                            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'rgb(220, 252, 231)', color: 'rgb(20, 83, 45)' }}>
                              <DollarSign className="w-3.5 h-3.5" />
                            </div>
                          </div>
                          <div className="text-base font-bold" style={{ color: 'rgb(22, 101, 52)' }}>
                            {formatCurrency(totalAdvertiserSpend)}
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
                            {formatCurrency(totalPublisherRevenue)}
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
                            {formatCurrency(totalMargin)}
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

                        <div className="p-3 rounded-lg border" style={{ backgroundColor: 'rgb(255, 251, 235)', borderColor: 'rgb(254, 240, 138)' }}>
                          <div className="flex items-start justify-between mb-1">
                            <div className={cn(TAILWIND_CLASSES.formSectionLabel)} style={{ color: 'rgb(113, 63, 18)' }}>Impressions</div>
                            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'rgb(254, 240, 138)', color: 'rgb(113, 63, 18)' }}>
                              <BarChart3 className="w-3.5 h-3.5" />
                            </div>
                          </div>
                          <div className="text-base font-bold" style={{ color: 'rgb(146, 64, 14)' }}>
                            {formatLargeNumber(totalImpressions)}
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
                            {formatLargeNumber(totalVisibleImpressions)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      {!location.pathname.includes('DealAnalytics') && (
                        <div className={cn(TAILWIND_CLASSES.formSectionLabel, 'mb-3')}>Performance Metrics</div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg border" style={{ backgroundColor: 'rgb(220, 252, 231)', borderColor: 'rgb(134, 239, 172)' }}>
                          <div className="flex items-start justify-between mb-1">
                            <div className={cn(TAILWIND_CLASSES.formSectionLabel)} style={{ color: 'rgb(22, 101, 52)' }}>Viewability Rate</div>
                            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'rgb(187, 247, 208)', color: 'rgb(22, 101, 52)' }}>
                              <Percent className="w-3.5 h-3.5" />
                            </div>
                          </div>
                          <div className="text-base font-bold" style={{ color: 'rgb(22, 101, 52)' }}>
                            {formatPercentage(avgViewabilityRate)}
                          </div>
                        </div>

                        <div className="p-3 rounded-lg border" style={{ backgroundColor: 'rgb(255, 251, 235)', borderColor: 'rgb(254, 240, 138)' }}>
                          <div className="flex items-start justify-between mb-1">
                            <div className={cn(TAILWIND_CLASSES.formSectionLabel)} style={{ color: 'rgb(113, 63, 18)' }}>RPBR/M</div>
                            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: 'rgb(254, 240, 138)', color: 'rgb(113, 63, 18)' }}>
                              <Gauge className="w-3.5 h-3.5" />
                            </div>
                          </div>
                          <div className="text-base font-bold" style={{ color: 'rgb(146, 64, 14)' }}>
                            {(() => {
                              const totalBidRequests = analyticsDataArg.reduce((sum, item) => sum + (item.network_operations_bid_requests || 0), 0);
                              const totalDSPRevenue = analyticsDataArg.reduce((sum, item) => sum + (item.PriceAdvertiser_PublisherSide || 0), 0);
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
                              const totalImpressions = analyticsDataArg.reduce((sum, item) => sum + (item.network_operations_impressions || 0), 0);
                              const totalAdvertiserRevenue = analyticsDataArg.reduce((sum, item) => sum + (item.PriceAdvertiser_PublisherSide || 0), 0);
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
                              const totalImpressions = analyticsDataArg.reduce((sum, item) => sum + (item.network_operations_impressions || 0), 0);
                              const totalPublisherRevenue = analyticsDataArg.reduce((sum, item) => sum + (item.PricePublisher || 0), 0);
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
                              const totalBidResponses = analyticsDataArg.reduce((sum, item) => sum + (item.network_operations_bid_responses || 0), 0);
                              const totalImpressions = analyticsDataArg.reduce((sum, item) => sum + (item.network_operations_impressions || 0), 0);
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
                              const totalBidRequests = analyticsDataArg.reduce((sum, item) => sum + (item.network_operations_bid_requests || 0), 0);
                              const totalImpressions = analyticsDataArg.reduce((sum, item) => sum + (item.network_operations_impressions || 0), 0);
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
                    <LineChart data={analyticsDataArg}>
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
                          tickFormatter={(value) =>
                            new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: 'USD',
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 0
                            }).format((value || 0) / 1_000_000)
                          }
                          width={60}
                          domain={[0, 'auto']}
                        />
                      <RechartsTooltip 
                        formatter={(value, name, props) => [
                          formatCurrency(value),
                          props.dataKey === 'PriceAdvertiser_PublisherSide' ? 'DSP Revenue' : 'Publisher Costs'
                        ]}
                        labelFormatter={(label) => `Date: ${label}`}
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px' }}
                      />
                      <Legend 
                        wrapperStyle={{ fontSize: '11px', paddingTop: '10px', cursor: 'pointer' }}
                        iconType="line"
                        onClick={(e) => toggleSeries('revenue_costs', e.dataKey)}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="PriceAdvertiser_PublisherSide" 
                        stroke="#10b981" 
                        strokeWidth={2}
                        dot={false}
                        activeDot={false}
                        name="DSP Revenue"
                        hide={isSeriesHidden('revenue_costs', 'PriceAdvertiser_PublisherSide')}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="PricePublisher" 
                        stroke="#ef4444" 
                        strokeWidth={2}
                        dot={false}
                        activeDot={false}
                        name="Publisher Costs"
                        hide={isSeriesHidden('revenue_costs', 'PricePublisher')}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {networkOperationsDataArg && networkOperationsDataArg.length > 0 && (
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
                      <LineChart data={analyticsDataArg}>
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
                          onClick={(e) => toggleSeries('impressions_visible', e.dataKey)}
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
                          hide={isSeriesHidden('impressions_visible', 'network_operations_impressions')}
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
                          hide={isSeriesHidden('impressions_visible', 'network_operations_visible_impressions')}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {networkOperationsDataArg && networkOperationsDataArg.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
                          domain={[0, 'auto']}
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
                          onClick={(e) => toggleSeries('ecpm', e.dataKey)}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="ecpmAdvertiser" 
                          stroke="rgb(14, 116, 144)" 
                          strokeWidth={2}
                          dot={false}
                          activeDot={false}
                          name="eCPM Advertiser"
                          hide={isSeriesHidden('ecpm', 'ecpmAdvertiser')}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="ecpmPublisher" 
                          stroke="rgb(13, 148, 136)" 
                          strokeWidth={2}
                          dot={false}
                          activeDot={false}
                          name="eCPM Publisher"
                          hide={isSeriesHidden('ecpm', 'ecpmPublisher')}
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
                          onClick={(e) => toggleSeries('win_fill', e.dataKey)}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="winRate" 
                          stroke="rgb(67, 56, 202)" 
                          strokeWidth={2}
                          dot={false}
                          activeDot={false}
                          name="Win Rate"
                          hide={isSeriesHidden('win_fill', 'winRate')}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="fillRate" 
                          stroke="rgb(30, 41, 59)" 
                          strokeWidth={2}
                          dot={false}
                          activeDot={false}
                          name="Fill Rate"
                          hide={isSeriesHidden('win_fill', 'fillRate')}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="viewabilityRate" 
                          stroke="rgb(234, 88, 12)" 
                          strokeWidth={2}
                          dot={false}
                          activeDot={false}
                          name="Viewability Rate"
                          hide={isSeriesHidden('win_fill', 'viewabilityRate')}
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
                    Clicks & CTR
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-40 lg:h-48 min-h-[150px] min-w-[250px]">
                    <ResponsiveContainer width="100%" height="100%" minHeight={150} minWidth={250}>
                      <LineChart data={clickCtrChartData}>
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
                          onClick={(e) => toggleSeries('clicks_ctr', e.dataKey)}
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
                          hide={isSeriesHidden('clicks_ctr', 'clicks')}
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
                          hide={isSeriesHidden('clicks_ctr', 'ctr')}
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
                      <LineChart data={analyticsDataArg}>
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
                          onClick={(e) => toggleSeries('bids', e.dataKey)}
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
                          hide={isSeriesHidden('bids', 'network_operations_bid_requests')}
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
                          hide={isSeriesHidden('bids', 'network_operations_bid_responses')}
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
                          hide={isSeriesHidden('bids', 'rpbr')}
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

  // Render panel content based on selected filter
  const renderPanelContent = () => {
    const entityFilters = getEntityFilters();
    
    if (selectedFilter === 'business-review') {
      const partnerId = entityFilters.partnerId;
      const realmId = entityFilters.realmId;
      const companyId = entityFilters.companyId;
      const dealId = entityFilters.dealId;

      // Base processed data from JSON
      const allProcessed = businessReviewData?.processedData || [];

      // Build months / years from allProcessed
      const monthsSet = new Set();
      const yearsSet = new Set();
      allProcessed.forEach((item) => {
        const d = item.date ? new Date(item.date) : null;
        if (!d || isNaN(d.getTime())) return;
        const iso = d.toISOString().split('T')[0];
        monthsSet.add(iso.slice(0, 7)); // YYYY-MM
        yearsSet.add(iso.slice(0, 4));  // YYYY
      });
      const brMonths = Array.from(monthsSet).sort().reverse();
      const brYears = Array.from(yearsSet).sort().reverse();

      // Initialize default selections
      const effectiveViewMode = brViewMode || 'month';
      let effectiveMonth = brSelectedMonth;
      let effectiveYear = brSelectedYear;

      if (effectiveViewMode === 'month' && !effectiveMonth && brMonths.length > 0) {
        effectiveMonth = brMonths[0];
      }
      if (effectiveViewMode === 'year' && !effectiveYear && brYears.length > 0) {
        effectiveYear = brYears[0];
      }

      // Filtered processed data based on view/filter
      const processed = allProcessed.filter((item) => {
        if (!item.date) return false;
        if (effectiveViewMode === 'month' && effectiveMonth) {
          return item.date.startsWith(effectiveMonth);
        }
        if (effectiveViewMode === 'year' && effectiveYear) {
          return item.date.startsWith(effectiveYear);
        }
        return true;
      });

      // Determine entity type and which revenue to use
      // Priority order: DSP > Deal > Company > Realm > Site
      let entityType = 'dsp'; // Default fallback
      if (partnerId || location.pathname.includes('/DSP') || location.pathname.includes('DSPAnalytics')) {
        entityType = 'dsp';
      } else if (dealId || location.pathname.includes('/Deal') || location.pathname.includes('DealAnalytics')) {
        entityType = 'deal';
      } else if (companyId || location.pathname.includes('/Company') || location.pathname.includes('CompanyAnalytics')) {
        entityType = 'company';
      } else if (realmId || location.pathname.includes('/Realm') || location.pathname.includes('RealmAnalytics')) {
        entityType = 'realm';
      } else if (location.pathname.includes('/Site') || location.pathname.includes('SiteAnalytics')) {
        entityType = 'site';
      }

      // Helper to get revenue value based on entity type
      const getRevenueValue = (item) => {
        if (entityType === 'dsp') {
          return item.priceAdvertiser || 0;
        } else if (['realm', 'company', 'site'].includes(entityType)) {
          return item.pricePublisher || 0;
        } else if (entityType === 'deal') {
          return item.priceAdvertiser || 0; // For deals, we'll track both separately
        }
        return item.priceAdvertiser || 0;
      };

      // KPI aggregates
      const kpis = processed.reduce(
        (acc, item) => {
          acc.bidRequests += item.bidRequests || 0;
          acc.impressions += item.impressions || 0;
          acc.clicks += item.clicks || 0;
          acc.revenue += getRevenueValue(item);
          if (entityType === 'deal') {
            acc.publisherRevenue = (acc.publisherRevenue || 0) + (item.pricePublisher || 0);
          }
          return acc;
        },
        { bidRequests: 0, impressions: 0, clicks: 0, revenue: 0, publisherRevenue: 0 }
      );
      const impressionsForCpm = kpis.impressions || 0;
      const avgCPM =
        impressionsForCpm > 0
          ? (kpis.revenue / impressionsForCpm) * 1000 / 1000000
          : 0;

      // Daily / Monthly Performance Trend
      const trendMap = {};
      processed.forEach((item) => {
        const date = item.date;
        if (!date) return;
        // si vue année, on agrège par mois (YYYY-MM), sinon par jour
        const key =
          effectiveViewMode === 'year'
            ? date.slice(0, 7) // YYYY-MM
            : date;           // YYYY-MM-DD

        if (!trendMap[key]) {
          trendMap[key] = {
            sortKey: key,
            dateLabel:
              effectiveViewMode === 'year'
                ? new Date(key + '-01').toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })
                : key,
            bidRequests: 0,
            impressions: 0,
            clicks: 0,
            revenue: 0,
            publisherRevenue: 0,
          };
        }
        trendMap[key].bidRequests += item.bidRequests || 0;
        trendMap[key].impressions += item.impressions || 0;
        trendMap[key].clicks += item.clicks || 0;
        trendMap[key].revenue += getRevenueValue(item);
        if (entityType === 'deal') {
          trendMap[key].publisherRevenue += (item.pricePublisher || 0);
        }
      });
      const dailyTrendData = Object.values(trendMap).sort((a, b) =>
        a.sortKey > b.sortKey ? 1 : a.sortKey < b.sortKey ? -1 : 0
      );

      // Impression by Ad Type
      const adKindImpressions = {};
      processed.forEach((item) => {
        if (!item.adKind) return;
        if (!adKindImpressions[item.adKind]) {
          adKindImpressions[item.adKind] = 0;
        }
        adKindImpressions[item.adKind] += item.impressions || 0;
      });
      const totalImpressions = Object.values(adKindImpressions).reduce(
        (sum, v) => sum + v,
        0
      );
      const pieData = Object.entries(adKindImpressions).map(
        ([adKind, value]) => {
          const percentage =
            totalImpressions > 0
              ? ((value / totalImpressions) * 100).toFixed(2)
              : '0.00';
          return {
            name: getAdKindDisplayName(adKind),
            value,
            percentage,
          };
        }
      );

      // Revenue by Ad Type
      const adKindRevenue = {};
      const adKindPublisherRevenue = {};
      processed.forEach((item) => {
        if (!item.adKind) return;
        if (!adKindRevenue[item.adKind]) {
          adKindRevenue[item.adKind] = 0;
        }
        adKindRevenue[item.adKind] += getRevenueValue(item);
        if (entityType === 'deal') {
          if (!adKindPublisherRevenue[item.adKind]) {
            adKindPublisherRevenue[item.adKind] = 0;
          }
          adKindPublisherRevenue[item.adKind] += (item.pricePublisher || 0);
        }
      });
      const barData = entityType === 'deal' 
        ? Object.entries(adKindRevenue).map(([adKind, value]) => ({
        name: getAdKindDisplayName(adKind),
            advertiserRevenue: (value || 0) / 1000,
            publisherRevenue: ((adKindPublisherRevenue[adKind] || 0) / 1000),
          }))
        : Object.entries(adKindRevenue).map(([adKind, value]) => ({
            name: getAdKindDisplayName(adKind),
            revenue: (value || 0) / 1000,
      }));

      const getBRPeriodLabel = () => {
        if (effectiveViewMode === 'month' && effectiveMonth) {
          const date = new Date(effectiveMonth + '-01');
          return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
        if (effectiveViewMode === 'year' && effectiveYear) {
          return effectiveYear;
        }
        return 'All Time';
      };

      return (
        <div className="w-full h-full bg-white">
          <div className="p-4 pb-2 border-b">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h1 className="text-lg font-bold text-slate-900">
                  {realmId
                    ? 'Realm Performance Dashboard'
                    : companyId
                      ? 'Company Performance Dashboard'
                      : dealId
                        ? 'Deal Performance Dashboard'
                        : 'DSP Performance Dashboard'}
                </h1>
                <p className="text-xs text-slate-600 mt-0.5">
                  Business Review • {getBRPeriodLabel()}
                </p>
                {partnerId && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Partner ID: {partnerId}
                  </p>
                )}
                {realmId && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Realm ID: {realmId}
                  </p>
                )}
                {companyId && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Company ID: {companyId}
                  </p>
                )}
                {dealId && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Deal ID: {dealId}
                  </p>
                )}
              </div>
              {businessReviewData && processed.length > 0 && (
                <Button
                  onClick={exportBusinessReviewToPDF}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export PDF
                </Button>
              )}
            </div>
          </div>

          <div className="p-4 pt-3 overflow-y-auto h-[calc(100%-64px)]">
            {loadingBusinessReview ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-[rgb(75,99,226)]" />
                <span className="ml-2 text-slate-600 text-sm">
                  Loading Business Review data...
                </span>
              </div>
            ) : businessReviewError ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
                <p className="text-red-800 font-medium">Error loading data</p>
                <p className="text-red-600 mt-1">{businessReviewError}</p>
              </div>
            ) : !businessReviewData || processed.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">
                <p>No Business Review data available.</p>
                {partnerId && (
                  <p className="text-xs mt-2">Partner ID: {partnerId}</p>
                )}
                {realmId && (
                  <p className="text-xs mt-2">Realm ID: {realmId}</p>
                )}
                {companyId && (
                  <p className="text-xs mt-2">Company ID: {companyId}</p>
                )}
                {dealId && (
                  <p className="text-xs mt-2">Deal ID: {dealId}</p>
                )}
              </div>
            ) : (
              <>
                {/* Filters (View + Month/Year, same logique que DSPDashboard) */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">View:</span>
                    <Select
                      value={effectiveViewMode}
                      onValueChange={(value) => {
                        setBrViewMode(value);
                        if (value === 'month' && brMonths.length > 0) {
                          setBrSelectedMonth(brMonths[0]);
                        } else if (value === 'year' && brYears.length > 0) {
                          setBrSelectedYear(brYears[0]);
                        }
                      }}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="month">By Month</SelectItem>
                        <SelectItem value="year">By Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {effectiveViewMode === 'month' && brMonths.length > 0 && (
                    <Select
                      value={effectiveMonth || ''}
                      onValueChange={(value) => setBrSelectedMonth(value)}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Select month" />
                      </SelectTrigger>
                      <SelectContent>
                        {brMonths.map((month) => {
                          const date = new Date(month + '-01');
                          return (
                            <SelectItem key={month} value={month}>
                              {date.toLocaleDateString('en-US', {
                                month: 'long',
                                year: 'numeric',
                              })}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  )}

                  {effectiveViewMode === 'year' && brYears.length > 0 && (
                    <Select
                      value={effectiveYear || ''}
                      onValueChange={(value) => setBrSelectedYear(value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {brYears.map((year) => (
                          <SelectItem key={year} value={year}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* KPI Cards (same style as DSPDashboard) */}
                <div className={`grid grid-cols-1 md:grid-cols-2 ${entityType === 'deal' ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4 mb-6`}>
                  <Card className="border-l-4 border-l-amber-500 shadow-md hover:shadow-lg transition-shadow">
                    <CardContent className="p-6 bg-gradient-to-br from-amber-50 to-amber-100/50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-amber-700">
                          BID REQUESTS
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                          <BarChart3 className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-amber-800">
                        {formatBidResponsesBR(kpis.bidRequests)}
                      </div>
                      <p className="mt-1 text-xs text-amber-700/80">
                        Total requests
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-blue-500 shadow-md hover:shadow-lg transition-shadow">
                    <CardContent className="p-6 bg-gradient-to-br from-blue-50 to-blue-100/50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-blue-700">
                          IMPRESSIONS
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                          <BarChart3 className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-blue-800">
                        {formatBidResponsesBR(kpis.impressions)}
                      </div>
                      <p className="mt-1 text-xs text-blue-700/80">
                        Total impressions
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-red-500 shadow-md hover:shadow-lg transition-shadow">
                    <CardContent className="p-6 bg-gradient-to-br from-red-50 to-red-100/50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-red-700">
                          CLICKS
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center">
                          <BarChart3 className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-red-800">
                        {formatBidResponsesBR(kpis.clicks)}
                      </div>
                      <p className="mt-1 text-xs text-red-700/80">
                        Total clicks
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-emerald-500 shadow-md hover:shadow-lg transition-shadow">
                    <CardContent className="p-6 bg-gradient-to-br from-emerald-50 to-emerald-100/50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-emerald-700">
                          {entityType === 'deal' ? 'ADVERTISER REVENUE' : entityType === 'dsp' ? 'REVENUE' : 'PUBLISHER REVENUE'}
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                          <DollarSign className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-emerald-800">
                        {formatCurrencyBR(kpis.revenue)}
                      </div>
                      <p className="mt-1 text-xs text-emerald-700/80">
                        {entityType === 'deal' ? 'Advertiser spend' : entityType === 'dsp' ? 'Advertiser spend' : 'Publisher revenue'}
                      </p>
                    </CardContent>
                  </Card>

                  {entityType === 'deal' && (
                    <Card className="border-l-4 border-l-teal-500 shadow-md hover:shadow-lg transition-shadow">
                      <CardContent className="p-6 bg-gradient-to-br from-teal-50 to-teal-100/50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium text-teal-700">
                            PUBLISHER REVENUE
                          </div>
                          <div className="w-10 h-10 rounded-lg bg-teal-500 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-white" />
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-teal-800">
                          {formatCurrencyBR(kpis.publisherRevenue || 0)}
                        </div>
                        <p className="mt-1 text-xs text-teal-700/80">
                          Publisher revenue
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Trend + distributions */}
                <div className="space-y-4">
                  <Card className="shadow-sm border-t-4 border-t-blue-500">
                    <CardHeader className="pb-2 pt-3 bg-gradient-to-r from-blue-50 to-indigo-50">
                      <CardTitle className="text-sm font-semibold text-blue-900">
                        {effectiveViewMode === 'year' ? 'Monthly Performance Trend' : 'Daily Performance'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-2 bg-white">
                      <div style={{ height: '40vh', minHeight: '260px' }}>
                        <ResponsiveContainer width="100%" height="100%" style={{ marginTop: '25px' }}>
                          <LineChart data={dailyTrendData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                              dataKey="dateLabel"
                              tick={{ fontSize: 12, fill: '#6b7280' }}
                              angle={-45}
                              textAnchor="end"
                              height={60}
                            />
                            <YAxis
                              yAxisId="left"
                              scale="pow"
                              exponent={0.8}
                              tick={{ fontSize: 12, fill: '#6b7280' }}
                              tickFormatter={(value) => formatBidResponsesBR(value)}
                            />
                            <YAxis
                              yAxisId="right"
                              orientation="right"
                              tick={{ fontSize: 12, fill: '#6b7280' }}
                              tickFormatter={(value) => formatCurrencyDetailedBR(value)}
                            />
                            <RechartsTooltip
                              formatter={(value, name, props) => {
                                const v = typeof value === 'number' ? value : Number(value || 0);
                                let label = name;
                                let formatted = '';
                                if (props.dataKey === 'bidRequests') {
                                  label = 'Bid Requests';
                                  formatted = formatBidResponsesBR(v);
                                } else if (props.dataKey === 'impressions') {
                                  label = 'Impressions';
                                  formatted = formatBidResponsesBR(v);
                                } else if (props.dataKey === 'clicks') {
                                  label = 'Clicks';
                                  formatted = formatBidResponsesBR(v);
                                } else if (props.dataKey === 'revenue') {
                                  label = entityType === 'deal' ? 'Advertiser Revenue ($)' : entityType === 'dsp' ? 'Advertiser Revenue ($)' : 'Publisher Revenue ($)';
                                  formatted = formatCurrencyDetailedBR(v);
                                } else if (props.dataKey === 'publisherRevenue') {
                                  label = 'Publisher Revenue ($)';
                                  formatted = formatCurrencyDetailedBR(v);
                                } else {
                                  formatted = formatBidResponsesBR(v);
                                }
                                return [formatted, label];
                              }}
                            />
                            <Legend onClick={(e) => toggleSeries('business_review_trends', e.dataKey)} wrapperStyle={{ cursor: 'pointer' }} />
                            <Line
                              yAxisId="left"
                              type="monotone"
                              dataKey="bidRequests"
                              stroke="#F59E0B"
                              strokeWidth={3}
                              dot={false}
                              activeDot={false}
                              name="Bid Requests"
                              hide={isSeriesHidden('business_review_trends', 'bidRequests')}
                            />
                            <Line
                              yAxisId="left"
                              type="monotone"
                              dataKey="impressions"
                              stroke="#3B82F6"
                              strokeWidth={3}
                              dot={false}
                              activeDot={false}
                              name="Impressions"
                              hide={isSeriesHidden('business_review_trends', 'impressions')}
                            />
                            <Line
                              yAxisId="left"
                              type="monotone"
                              dataKey="clicks"
                              stroke="#EF4444"
                              strokeWidth={3}
                              strokeDasharray="3 3"
                              dot={false}
                              activeDot={false}
                              name="Clicks"
                              hide={isSeriesHidden('business_review_trends', 'clicks')}
                            />
                            <Line
                              yAxisId="right"
                              type="monotone"
                              dataKey="revenue"
                              stroke="#10B981"
                              strokeWidth={3}
                              strokeDasharray="5 5"
                              dot={false}
                              activeDot={false}
                              name={entityType === 'deal' ? 'Advertiser Revenue ($)' : entityType === 'dsp' ? 'Advertiser Revenue ($)' : 'Publisher Revenue ($)'}
                              hide={isSeriesHidden('business_review_trends', 'revenue')}
                            />
                            {entityType === 'deal' && (
                              <Line
                                yAxisId="right"
                                type="monotone"
                                dataKey="publisherRevenue"
                                stroke="#14B8A6"
                                strokeWidth={3}
                                strokeDasharray="7 7"
                                dot={false}
                                activeDot={false}
                                name="Publisher Revenue ($)"
                                hide={isSeriesHidden('business_review_trends', 'publisherRevenue')}
                              />
                            )}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card className="shadow-sm">
                      <CardHeader className="pb-2 pt-3">
                        <CardTitle className="text-sm font-semibold text-slate-800">
                          Impression by Ad Type
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div style={{ height: '40vh', minHeight: '260px' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                labelLine
                                label={({ name, percentage }) =>
                                  parseFloat(percentage) >= 2
                                    ? `${name} ${percentage}%`
                                    : ''
                                }
                                outerRadius={70}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {pieData.map((entry, index) => (
                                  <Cell
                                    key={`cell-br-${index}`}
                                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                                  />
                                ))}
                              </Pie>
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-sm">
                      <CardHeader className="pb-2 pt-3">
                        <CardTitle className="text-sm font-semibold text-slate-800">
                          {entityType === 'deal' ? 'Revenue by Ad Type' : entityType === 'dsp' ? 'Advertiser Revenue by Ad Type' : 'Publisher Revenue by Ad Type'}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div style={{ height: '40vh', minHeight: '260px' }}>
                          <ResponsiveContainer
                            width="100%"
                            height="100%"
                            style={{ marginTop: '45px' }}
                          >
                            <BarChart data={barData}>
                              <XAxis
                                dataKey="name"
                                tick={{ fontSize: 10, fill: '#6b7280' }}
                                angle={-45}
                                textAnchor="end"
                                height={80}
                                interval={0}
                              />
                              <YAxis
                                tick={{ fontSize: 10, fill: '#6b7280' }}
                                tickFormatter={(value) => {
                                  if (value >= 1000) {
                                    return `$${(value / 1000).toFixed(1)}M`;
                                  }
                                  return `$${value.toFixed(1)}K`;
                                }}
                              />
                              <RechartsTooltip
                                formatter={(value, name) => {
                                  const fullValue = value * 1000;
                                  return [
                                    formatCurrencyDetailedBR(fullValue),
                                    name === 'advertiserRevenue' ? 'Advertiser Revenue' : name === 'publisherRevenue' ? 'Publisher Revenue' : 'Revenue',
                                  ];
                                }}
                                contentStyle={{
                                  backgroundColor: '#fff',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '6px',
                                }}
                              />
                              <Legend />
                              {entityType === 'deal' ? (
                                <>
                                  <Bar dataKey="advertiserRevenue" radius={[8, 8, 0, 0]} fill="#10B981" name="Advertiser Revenue" />
                                  <Bar dataKey="publisherRevenue" radius={[8, 8, 0, 0]} fill="#14B8A6" name="Publisher Revenue" />
                                </>
                              ) : (
                              <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
                                {barData.map((entry, index) => (
                                  <Cell
                                    key={`cell-bar-br-${index}`}
                                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                                  />
                                ))}
                              </Bar>
                              )}
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      );
    }
    
    if (selectedFilter === 'kpi-prog') {
      return (
        <div className="w-full">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-0">
              <Table className="text-xs sm:text-sm w-full">
                <TableHeader>
                  <TableRow>
                    {renderSortableHeader("Date", "date", kpiProgSortConfig, handleKpiProgSort)}
                    {renderSortableHeader("Bid Requests", "network_operations_bid_requests", kpiProgSortConfig, handleKpiProgSort)}
                    <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>
                    {renderSortableHeader("Bid Responses", "network_operations_bid_responses", kpiProgSortConfig, handleKpiProgSort)}
                    <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>
                    {renderSortableHeader("Impressions", "network_operations_impressions", kpiProgSortConfig, handleKpiProgSort)}
                    <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>
                    {renderSortableHeader("Publisher Revenue", "network_operations_price_publisher", kpiProgSortConfig, handleKpiProgSort)}
                    <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>
                    {renderSortableHeader("eCPM Publisher", "network_operations_ecpm_publisher", kpiProgSortConfig, handleKpiProgSort)}
                    <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>
                    {renderSortableHeader("RPBR/M", "rpbr", kpiProgSortConfig, handleKpiProgSort)}
                    <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>
                    {renderSortableHeader("Fill Rate", "fillRate", kpiProgSortConfig, handleKpiProgSort)}
                    <TableHead className="text-center border-r-2 border-gray-300">Trend</TableHead>
                    {renderSortableHeader("Win Rate", "winRate", kpiProgSortConfig, handleKpiProgSort)}
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
                        <TableCell className="text-center">
                          {item.network_operations_bid_requests !== null && item.network_operations_bid_requests !== undefined ? (
                            <span className="text-black">{formatLargeNumber(item.network_operations_bid_requests)}</span>
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
                            <span className="text-black">{formatLargeNumber(item.network_operations_bid_responses)}</span>
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
                            <span className="text-black">{formatLargeNumber(item.network_operations_impressions)}</span>
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
                        <TableCell className="text-center">
                          {item.network_operations_price_publisher !== null && item.network_operations_price_publisher !== undefined ? (
                            <span className="text-black">{new Intl.NumberFormat('en-US', {
                              style: 'currency',
                              currency: 'USD',
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            }).format(item.network_operations_price_publisher)}</span>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center border-r-2 border-gray-300">
                          <div className="flex items-center justify-center gap-1">
                            {item.pricePublisherTrend === 'up' && (
                              <>
                                <ArrowUpRight className="w-4 h-4 text-green-500" />
                                <span className="text-green-500 text-xs font-medium">+{item.pricePublisherChangePercent}%</span>
                              </>
                            )}
                            {item.pricePublisherTrend === 'down' && (
                              <>
                                <ArrowDownRight className="w-4 h-4 text-red-500" />
                                <span className="text-red-500 text-xs font-medium">{item.pricePublisherChangePercent}%</span>
                              </>
                            )}
                            {(!item.pricePublisherTrend || item.pricePublisherTrend === 'same') && (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {item.network_operations_ecpm_publisher !== null && item.network_operations_ecpm_publisher !== undefined ? (
                            <span className="text-black">{formatEcpm(item.network_operations_ecpm_publisher)}</span>
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
                        <TableCell className="text-center">
                          {item.rpbr !== null && item.rpbr !== undefined ? (
                            <span className="text-black">{formatRpbr(item.rpbr)}</span>
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
                            <span className="text-black">{item.fillRate.toFixed(2)}%</span>
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
                            <span className="text-black">{item.winRate.toFixed(2)}%</span>
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
      );
    }

    if (selectedFilter === 'ad-kind') {
      return (
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
                      {renderSortableHeader("DSP Revenue", "PriceAdvertiser_PublisherSide", adKindSortConfig, handleAdKindSort)}
                      {renderSortableHeader("Publisher Costs", "PricePublisher", adKindSortConfig, handleAdKindSort)}
                      {renderSortableHeader("ADY Margin", "margin", adKindSortConfig, handleAdKindSort)}
                      {renderSortableHeader("Impressions", "impressions", adKindSortConfig, handleAdKindSort)}
                      {renderSortableHeader("Click", "clicks", adKindSortConfig, handleAdKindSort)}
                      {renderSortableHeader("CTR", "ctr", adKindSortConfig, handleAdKindSort)}
                      {renderSortableHeader("Margin %", "marginPercentage", adKindSortConfig, handleAdKindSort)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adKindData.length > 0 ? (
                      adKindData.map((item, index) => (
                        <React.Fragment key={index}>
                          <TableRow 
                            className={`cursor-pointer hover:bg-slate-50 ${selectedAdKind === item.adKind ? 'bg-blue-50' : ''}`}
                            onClick={() => handleAdKindRowClick(item.adKind, entityFilters)}
                          >
                            <TableCell className="text-center font-medium">
                              {item.adKindDisplay || item.adKind || ''}
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
                              {item.impressions?.toLocaleString() || '0'}
                            </TableCell>
                            <TableCell className="text-center">
                              {item.clicks?.toLocaleString() || '0'}
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
                                <Badge variant="destructive">{item.marginPercentage}%</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                          {selectedAdKind === item.adKind && (
                            <TableRow>
                              <TableCell colSpan={8} className="p-0 bg-slate-50">
                                {loadingAdKindDetail ? (
                                  <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-5 h-5 animate-spin text-[rgb(75,99,226)]" />
                                    <span className="ml-2 text-slate-600">Loading detail data...</span>
                                  </div>
                                ) : adKindDetailData.length > 0 ? (
                                  <div className="p-4">
                                    <h3 className="text-sm font-semibold mb-3 text-slate-700">{item.adKindDisplay || item.adKind} - Detail by {viewMode === 'hourly' ? 'Hour' : 'Date'}</h3>
                                    <Table className="text-xs w-full">
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="text-center">{viewMode === 'hourly' ? 'Hour' : 'Date'}</TableHead>
                                          <TableHead className="text-center">DSP Revenue</TableHead>
                                          <TableHead className="text-center">Publisher Costs</TableHead>
                                          <TableHead className="text-center">ADY Margin</TableHead>
                                          <TableHead className="text-center">Impressions</TableHead>
                                          <TableHead className="text-center">Click</TableHead>
                                          <TableHead className="text-center">CTR</TableHead>
                                          <TableHead className="text-center">Margin %</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {adKindDetailData.map((detailItem, detailIndex) => (
                                          <TableRow key={detailIndex}>
                                            <TableCell className="text-center font-medium">{detailItem.date}</TableCell>
                                            <TableCell className="text-center text-green-600">
                                              {new Intl.NumberFormat('en-US', {
                                                style: 'currency',
                                                currency: 'USD',
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2
                                              }).format(detailItem.PriceAdvertiser_PublisherSide || 0)}
                                            </TableCell>
                                            <TableCell className="text-center text-red-600">
                                              {new Intl.NumberFormat('en-US', {
                                                style: 'currency',
                                                currency: 'USD',
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2
                                              }).format(detailItem.PricePublisher || 0)}
                                            </TableCell>
                                            <TableCell className="text-center text-black">
                                              {new Intl.NumberFormat('en-US', {
                                                style: 'currency',
                                                currency: 'USD',
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2
                                              }).format(detailItem.margin || 0)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                              {detailItem.impressions?.toLocaleString() || '0'}
                                            </TableCell>
                                            <TableCell className="text-center">
                                              {detailItem.clicks?.toLocaleString() || '0'}
                                            </TableCell>
                                            <TableCell className="text-center">
                                              {formatPercentage(detailItem.ctr || 0)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                              {detailItem.marginPercentage > 0 ? (
                                                <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                                                  {detailItem.marginPercentage}%
                                                </span>
                                              ) : (
                                                <Badge variant="destructive">{detailItem.marginPercentage}%</Badge>
                                              )}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center py-8 text-slate-500">
                                    No detail data available
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-slate-500">
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
      );
    }

    if (selectedFilter === 'device') {
      return (
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
                      {renderSortableHeader("Impressions", "impressions", deviceSortConfig, handleDeviceSort)}
                      {renderSortableHeader("Click", "clicks", deviceSortConfig, handleDeviceSort)}
                      {renderSortableHeader("CTR", "ctr", deviceSortConfig, handleDeviceSort)}
                      {renderSortableHeader("Margin %", "marginPercentage", deviceSortConfig, handleDeviceSort)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deviceData.length > 0 ? (
                      deviceData.map((item, index) => (
                        <React.Fragment key={index}>
                          <TableRow 
                            className={`cursor-pointer hover:bg-slate-50 ${selectedDevice === item.device ? 'bg-blue-50' : ''}`}
                            onClick={() => handleDeviceRowClick(item.device, entityFilters)}
                          >
                            <TableCell className="text-center font-medium">{item.device}</TableCell>
                            <TableCell className="text-center text-green-600">{formatCurrency(item.PriceAdvertiser_PublisherSide || 0)}</TableCell>
                            <TableCell className="text-center text-red-600">{formatCurrency(item.PricePublisher || 0)}</TableCell>
                            <TableCell className="text-center text-black">{formatCurrency(item.margin)}</TableCell>
                            <TableCell className="text-center">{formatLargeNumber(item.impressions || 0)}</TableCell>
                            <TableCell className="text-center">{formatLargeNumber(item.clicks || 0)}</TableCell>
                            <TableCell className="text-center">{formatPercentage(item.ctr || 0)}</TableCell>
                            <TableCell className="text-center">
                              {item.marginPercentage > 0 ? (
                                <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                                  {item.marginPercentage}%
                                </span>
                              ) : (
                                <Badge variant="destructive">{item.marginPercentage}%</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                          {selectedDevice === item.device && (
                            <TableRow>
                              <TableCell colSpan={8} className="p-0 bg-slate-50">
                                {loadingDeviceDetail ? (
                                  <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-5 h-5 animate-spin text-[rgb(75,99,226)]" />
                                    <span className="ml-2 text-slate-600">Loading detail data...</span>
                                  </div>
                                ) : deviceDetailData.length > 0 ? (
                                  <div className="p-4">
                                    <h3 className="text-sm font-semibold mb-3 text-slate-700">{item.device} - Detail by {viewMode === 'hourly' ? 'Hour' : 'Date'}</h3>
                                    <Table className="text-xs w-full">
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="text-center">{viewMode === 'hourly' ? 'Hour' : 'Date'}</TableHead>
                                          <TableHead className="text-center">DSP Revenue</TableHead>
                                          <TableHead className="text-center">Publisher Costs</TableHead>
                                          <TableHead className="text-center">ADY Margin</TableHead>
                                          <TableHead className="text-center">Margin %</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {deviceDetailData.map((detailItem, detailIndex) => (
                                          <TableRow key={detailIndex}>
                                            <TableCell className="text-center font-medium">{detailItem.date}</TableCell>
                                            <TableCell className="text-center text-green-600">{formatCurrency(detailItem.PriceAdvertiser_PublisherSide || 0)}</TableCell>
                                            <TableCell className="text-center text-red-600">{formatCurrency(detailItem.PricePublisher || 0)}</TableCell>
                                            <TableCell className="text-center text-black">{formatCurrency(detailItem.margin)}</TableCell>
                                            <TableCell className="text-center">
                                              {detailItem.marginPercentage > 0 ? (
                                                <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                                                  {detailItem.marginPercentage}%
                                                </span>
                                              ) : (
                                                <Badge variant="destructive">{detailItem.marginPercentage}%</Badge>
                                              )}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                ) : (
                                  <div className="text-center py-8 text-slate-500 text-sm">No detail data available for this device</div>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-slate-500">No device data available</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      );
    }

    if (selectedFilter === 'dsp') {
      return (
        <div className="w-full">
          {loadingDspData ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[rgb(75,99,226)]" />
              <span className="ml-2 text-slate-600">Loading DSP data...</span>
            </div>
          ) : (
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-0">
                <Table className="text-xs sm:text-sm w-full">
                  <TableHeader>
                    <TableRow>
                      {renderSortableHeader("Partner ID", "partnerId", dspSortConfig, handleDspSort)}
                      {renderSortableHeader("Partner Name", "partnerName", dspSortConfig, handleDspSort)}
                      {renderSortableHeader("DSP Revenue", "PriceAdvertiser_PublisherSide", dspSortConfig, handleDspSort)}
                      {renderSortableHeader("Publisher Costs", "PricePublisher", dspSortConfig, handleDspSort)}
                      {renderSortableHeader("ADY Margin", "margin", dspSortConfig, handleDspSort)}
                      {renderSortableHeader("Impressions", "impressions", dspSortConfig, handleDspSort)}
                      {renderSortableHeader("Click", "clicks", dspSortConfig, handleDspSort)}
                      {renderSortableHeader("CTR", "ctr", dspSortConfig, handleDspSort)}
                      {renderSortableHeader("Margin %", "marginPercentage", dspSortConfig, handleDspSort)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dspData.length > 0 ? (
                      dspData.map((item, index) => (
                        <React.Fragment key={index}>
                          <TableRow
                            className={`cursor-pointer hover:bg-slate-50 ${selectedDsp === item.partnerId ? 'bg-blue-50' : ''}`}
                            onClick={() => handleDspRowClick(item.partnerId, item.partnerName, entityFilters)}
                          >
                            <TableCell className="text-center font-medium">{item.partnerId}</TableCell>
                            <TableCell className="text-center font-medium">{item.partnerName}</TableCell>
                            <TableCell className="text-center text-green-600">{formatCurrency(item.PriceAdvertiser_PublisherSide || 0)}</TableCell>
                            <TableCell className="text-center text-red-600">{formatCurrency(item.PricePublisher || 0)}</TableCell>
                            <TableCell className="text-center text-black">{formatCurrency(item.margin)}</TableCell>
                            <TableCell className="text-center">{formatLargeNumber(item.impressions || 0)}</TableCell>
                            <TableCell className="text-center">{formatLargeNumber(item.clicks || 0)}</TableCell>
                            <TableCell className="text-center">{formatPercentage(item.ctr || 0)}</TableCell>
                            <TableCell className="text-center">
                              {item.marginPercentage > 0 ? (
                                <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                                  {item.marginPercentage}%
                                </span>
                              ) : (
                                <Badge variant="destructive">{item.marginPercentage}%</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                          {selectedDsp === item.partnerId && (
                            <TableRow>
                              <TableCell colSpan={9} className="p-0 bg-slate-50">
                                {loadingDspDetail ? (
                                  <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-[rgb(75,99,226)]" />
                                    <span className="ml-2 text-slate-600 text-sm">Loading detail data...</span>
                                  </div>
                                ) : dspDetailData.length > 0 ? (
                                  <div className="p-4">
                                    <h3 className="text-sm font-semibold mb-3 text-slate-700">{item.partnerName} - Detail by Date</h3>
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
                                            <TableCell className="text-center font-medium">{detailItem.date}</TableCell>
                                            <TableCell className="text-center text-green-600">{formatCurrency(detailItem.PriceAdvertiser_PublisherSide || 0)}</TableCell>
                                            <TableCell className="text-center text-red-600">{formatCurrency(detailItem.PricePublisher || 0)}</TableCell>
                                            <TableCell className="text-center text-black">{formatCurrency(detailItem.margin)}</TableCell>
                                            <TableCell className="text-center">
                                              {detailItem.marginPercentage > 0 ? (
                                                <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                                                  {detailItem.marginPercentage}%
                                                </span>
                                              ) : (
                                                <Badge variant="destructive">{detailItem.marginPercentage}%</Badge>
                                              )}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                ) : (
                                  <div className="p-4 text-center text-slate-500 text-sm">No detail data available for this DSP</div>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-slate-500">No DSP data available</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      );
    }

    if (selectedFilter === 'seat') {
      return (
        <div className="w-full">
          {loadingSeatData ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[rgb(75,99,226)]" />
              <span className="ml-2 text-slate-600">Loading SEAT data...</span>
            </div>
          ) : (
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-0">
                <Table className="text-xs sm:text-sm w-full">
                  <TableHeader>
                    <TableRow>
                      {renderSortableHeader("Seat Name", "seatName", seatSortConfig, handleSeatSort)}
                      {renderSortableHeader("Partner Name", "partnerName", seatSortConfig, handleSeatSort)}
                      {renderSortableHeader("DSP Revenue", "PriceAdvertiser_PublisherSide", seatSortConfig, handleSeatSort)}
                      {renderSortableHeader("Publisher Costs", "PricePublisher", seatSortConfig, handleSeatSort)}
                      {renderSortableHeader("ADY Margin", "margin", seatSortConfig, handleSeatSort)}
                      {renderSortableHeader("Impressions", "impressions", seatSortConfig, handleSeatSort)}
                      {renderSortableHeader("Click", "clicks", seatSortConfig, handleSeatSort)}
                      {renderSortableHeader("CTR", "ctr", seatSortConfig, handleSeatSort)}
                      {renderSortableHeader("Margin %", "marginPercentage", seatSortConfig, handleSeatSort)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {seatData.length > 0 ? (
                      seatData.map((item, index) => {
                        if (!enableSeatDailyDrillDown) {
                          return (
                            <TableRow key={index}>
                              <TableCell className="text-center font-medium">{item.seatName}</TableCell>
                              <TableCell className="text-center font-medium">{item.partnerName}</TableCell>
                              <TableCell className="text-center text-green-600">{formatCurrency(item.PriceAdvertiser_PublisherSide || 0)}</TableCell>
                              <TableCell className="text-center text-red-600">{formatCurrency(item.PricePublisher || 0)}</TableCell>
                              <TableCell className="text-center text-black">{formatCurrency(item.margin)}</TableCell>
                              <TableCell className="text-center">{formatLargeNumber(item.impressions || 0)}</TableCell>
                              <TableCell className="text-center">{formatLargeNumber(item.clicks || 0)}</TableCell>
                              <TableCell className="text-center">{formatPercentage(item.ctr || 0)}</TableCell>
                              <TableCell className="text-center">
                                {item.marginPercentage > 0 ? (
                                  <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                                    {item.marginPercentage}%
                                  </span>
                                ) : (
                                  <Badge variant="destructive">{item.marginPercentage}%</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        }
                        const rowKey = getSeatRowKey(item);
                        const isOpen = selectedSeatRowKey === rowKey;
                        return (
                          <React.Fragment key={`seat-${index}-${rowKey}`}>
                            <TableRow
                              className={`cursor-pointer hover:bg-slate-50 ${isOpen ? 'bg-blue-50' : ''}`}
                              onClick={() => handleSeatRowClick(item, entityFilters)}
                            >
                              <TableCell className="text-center font-medium">
                                <span className="inline-flex items-center justify-center gap-1.5">
                                  {isOpen ? (
                                    <ChevronDown className="w-4 h-4 shrink-0 text-[rgb(75,99,226)]" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />
                                  )}
                                  {item.seatName || '—'}
                                </span>
                              </TableCell>
                              <TableCell className="text-center font-medium">{item.partnerName}</TableCell>
                              <TableCell className="text-center text-green-600">{formatCurrency(item.PriceAdvertiser_PublisherSide || 0)}</TableCell>
                              <TableCell className="text-center text-red-600">{formatCurrency(item.PricePublisher || 0)}</TableCell>
                              <TableCell className="text-center text-black">{formatCurrency(item.margin)}</TableCell>
                              <TableCell className="text-center">{formatLargeNumber(item.impressions || 0)}</TableCell>
                              <TableCell className="text-center">{formatLargeNumber(item.clicks || 0)}</TableCell>
                              <TableCell className="text-center">{formatPercentage(item.ctr || 0)}</TableCell>
                              <TableCell className="text-center">
                                {parseFloat(item.marginPercentage) > 0 ? (
                                  <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                                    {item.marginPercentage}%
                                  </span>
                                ) : (
                                  <Badge variant="destructive">{item.marginPercentage}%</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                            {isOpen && (
                              <TableRow>
                                <TableCell colSpan={9} className="p-0 bg-slate-50">
                                  {loadingSeatDetail ? (
                                    <div className="flex items-center justify-center py-8">
                                      <Loader2 className="w-5 h-5 animate-spin text-[rgb(75,99,226)]" />
                                      <span className="ml-2 text-slate-600">Loading daily breakdown…</span>
                                    </div>
                                  ) : seatDetailData.length > 0 ? (
                                    <div className="p-4">
                                      <h3 className="text-sm font-semibold mb-3 text-slate-700">
                                        {item.seatName || item.seatId} — {item.partnerName} — by day
                                      </h3>
                                      <Table className="text-xs w-full">
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="text-center">Date</TableHead>
                                            <TableHead className="text-center">DSP Revenue</TableHead>
                                            <TableHead className="text-center">Publisher Costs</TableHead>
                                            <TableHead className="text-center">ADY Margin</TableHead>
                                            <TableHead className="text-center">Impressions</TableHead>
                                            <TableHead className="text-center">Click</TableHead>
                                            <TableHead className="text-center">CTR</TableHead>
                                            <TableHead className="text-center">Margin %</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {seatDetailData.map((detailItem, detailIndex) => (
                                            <TableRow key={detailIndex}>
                                              <TableCell className="text-center font-medium">{detailItem.date}</TableCell>
                                              <TableCell className="text-center text-green-600">{formatCurrency(detailItem.PriceAdvertiser_PublisherSide || 0)}</TableCell>
                                              <TableCell className="text-center text-red-600">{formatCurrency(detailItem.PricePublisher || 0)}</TableCell>
                                              <TableCell className="text-center text-black">{formatCurrency(detailItem.margin)}</TableCell>
                                              <TableCell className="text-center">{formatLargeNumber(detailItem.impressions || 0)}</TableCell>
                                              <TableCell className="text-center">{formatLargeNumber(detailItem.clicks || 0)}</TableCell>
                                              <TableCell className="text-center">{formatPercentage(detailItem.ctr || 0)}</TableCell>
                                              <TableCell className="text-center">
                                                {parseFloat(detailItem.marginPercentage) > 0 ? (
                                                  <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                                                    {detailItem.marginPercentage}%
                                                  </span>
                                                ) : (
                                                  <Badge variant="destructive">{detailItem.marginPercentage}%</Badge>
                                                )}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center py-8 text-slate-500">
                                      No daily data available
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-slate-500">No SEAT data available</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      );
    }

    if (selectedFilter === 'ad-domain') {
      return (
        <div className="w-full">
          {loadingAdDomainData ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[rgb(75,99,226)]" />
              <span className="ml-2 text-slate-600">Loading AD DOMAIN data...</span>
            </div>
          ) : (
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-0">
                <Table className="text-xs sm:text-sm w-full">
                  <TableHeader>
                    <TableRow>
                      {renderSortableHeader("Ad Domain", "adDomain", adDomainSortConfig, handleAdDomainSort)}
                      {renderSortableHeader("Partner Name", "partnerName", adDomainSortConfig, handleAdDomainSort)}
                      {renderSortableHeader("DSP Revenue", "PriceAdvertiser_PublisherSide", adDomainSortConfig, handleAdDomainSort)}
                      {renderSortableHeader("Publisher Costs", "PricePublisher", adDomainSortConfig, handleAdDomainSort)}
                      {renderSortableHeader("ADY Margin", "margin", adDomainSortConfig, handleAdDomainSort)}
                      {renderSortableHeader("Impressions", "impressions", adDomainSortConfig, handleAdDomainSort)}
                      {renderSortableHeader("Click", "clicks", adDomainSortConfig, handleAdDomainSort)}
                      {renderSortableHeader("CTR", "ctr", adDomainSortConfig, handleAdDomainSort)}
                      {renderSortableHeader("Margin %", "marginPercentage", adDomainSortConfig, handleAdDomainSort)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adDomainData.length > 0 ? (
                      adDomainData.map((item, index) => {
                        if (!enableAdDomainDailyDrillDown) {
                          return (
                            <TableRow key={index}>
                              <TableCell className="text-center font-medium">{item.adDomain}</TableCell>
                              <TableCell className="text-center font-medium">{item.partnerName}</TableCell>
                              <TableCell className="text-center text-green-600">{formatCurrency(item.PriceAdvertiser_PublisherSide || 0)}</TableCell>
                              <TableCell className="text-center text-red-600">{formatCurrency(item.PricePublisher || 0)}</TableCell>
                              <TableCell className="text-center text-black">{formatCurrency(item.margin)}</TableCell>
                              <TableCell className="text-center">{formatLargeNumber(item.impressions || 0)}</TableCell>
                              <TableCell className="text-center">{formatLargeNumber(item.clicks || 0)}</TableCell>
                              <TableCell className="text-center">{formatPercentage(item.ctr || 0)}</TableCell>
                              <TableCell className="text-center">
                                {item.marginPercentage > 0 ? (
                                  <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                                    {item.marginPercentage}%
                                  </span>
                                ) : (
                                  <Badge variant="destructive">{item.marginPercentage}%</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        }
                        const rowKey = getAdDomainRowKey(item);
                        const isOpen = selectedAdDomainRowKey === rowKey;
                        return (
                          <React.Fragment key={`ad-${index}-${rowKey}`}>
                            <TableRow
                              className={`cursor-pointer hover:bg-slate-50 ${isOpen ? 'bg-blue-50' : ''}`}
                              onClick={() => handleAdDomainRowClick(item, entityFilters)}
                            >
                              <TableCell className="text-center font-medium">
                                <span className="inline-flex items-center justify-center gap-1.5">
                                  {isOpen ? (
                                    <ChevronDown className="w-4 h-4 shrink-0 text-[rgb(75,99,226)]" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />
                                  )}
                                  {item.adDomain || '—'}
                                </span>
                              </TableCell>
                              <TableCell className="text-center font-medium">{item.partnerName}</TableCell>
                              <TableCell className="text-center text-green-600">{formatCurrency(item.PriceAdvertiser_PublisherSide || 0)}</TableCell>
                              <TableCell className="text-center text-red-600">{formatCurrency(item.PricePublisher || 0)}</TableCell>
                              <TableCell className="text-center text-black">{formatCurrency(item.margin)}</TableCell>
                              <TableCell className="text-center">{formatLargeNumber(item.impressions || 0)}</TableCell>
                              <TableCell className="text-center">{formatLargeNumber(item.clicks || 0)}</TableCell>
                              <TableCell className="text-center">{formatPercentage(item.ctr || 0)}</TableCell>
                              <TableCell className="text-center">
                                {parseFloat(item.marginPercentage) > 0 ? (
                                  <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                                    {item.marginPercentage}%
                                  </span>
                                ) : (
                                  <Badge variant="destructive">{item.marginPercentage}%</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                            {isOpen && (
                              <TableRow>
                                <TableCell colSpan={9} className="p-0 bg-slate-50">
                                  {loadingAdDomainDetail ? (
                                    <div className="flex items-center justify-center py-8">
                                      <Loader2 className="w-5 h-5 animate-spin text-[rgb(75,99,226)]" />
                                      <span className="ml-2 text-slate-600">Loading daily breakdown…</span>
                                    </div>
                                  ) : adDomainDetailData.length > 0 ? (
                                    <div className="p-4">
                                      <h3 className="text-sm font-semibold mb-3 text-slate-700">
                                        {item.adDomain} — {item.partnerName} — by day
                                      </h3>
                                      <Table className="text-xs w-full">
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="text-center">Date</TableHead>
                                            <TableHead className="text-center">DSP Revenue</TableHead>
                                            <TableHead className="text-center">Publisher Costs</TableHead>
                                            <TableHead className="text-center">ADY Margin</TableHead>
                                            <TableHead className="text-center">Impressions</TableHead>
                                            <TableHead className="text-center">Click</TableHead>
                                            <TableHead className="text-center">CTR</TableHead>
                                            <TableHead className="text-center">Margin %</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {adDomainDetailData.map((detailItem, detailIndex) => (
                                            <TableRow key={detailIndex}>
                                              <TableCell className="text-center font-medium">{detailItem.date}</TableCell>
                                              <TableCell className="text-center text-green-600">{formatCurrency(detailItem.PriceAdvertiser_PublisherSide || 0)}</TableCell>
                                              <TableCell className="text-center text-red-600">{formatCurrency(detailItem.PricePublisher || 0)}</TableCell>
                                              <TableCell className="text-center text-black">{formatCurrency(detailItem.margin)}</TableCell>
                                              <TableCell className="text-center">{formatLargeNumber(detailItem.impressions || 0)}</TableCell>
                                              <TableCell className="text-center">{formatLargeNumber(detailItem.clicks || 0)}</TableCell>
                                              <TableCell className="text-center">{formatPercentage(detailItem.ctr || 0)}</TableCell>
                                              <TableCell className="text-center">
                                                {parseFloat(detailItem.marginPercentage) > 0 ? (
                                                  <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                                                    {detailItem.marginPercentage}%
                                                  </span>
                                                ) : (
                                                  <Badge variant="destructive">{detailItem.marginPercentage}%</Badge>
                                                )}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center py-8 text-slate-500">
                                      No daily data available
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-slate-500">No AD DOMAIN data available</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      );
    }

    if (selectedFilter === 'site-domain') {
      return (
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
                      {renderSortableHeader("Realm", "realmName", siteDomainSortConfig, handleSiteDomainSort)}
                      {renderSortableHeader("Site Domain", "siteDomain", siteDomainSortConfig, handleSiteDomainSort)}
                      {renderSortableHeader("DSP Revenue", "PriceAdvertiser_PublisherSide", siteDomainSortConfig, handleSiteDomainSort)}
                      {renderSortableHeader("Publisher Costs", "PricePublisher", siteDomainSortConfig, handleSiteDomainSort)}
                      {renderSortableHeader("ADY Margin", "margin", siteDomainSortConfig, handleSiteDomainSort)}
                      {renderSortableHeader("Impressions", "impressions", siteDomainSortConfig, handleSiteDomainSort)}
                      {renderSortableHeader("Click", "clicks", siteDomainSortConfig, handleSiteDomainSort)}
                      {renderSortableHeader("CTR", "ctr", siteDomainSortConfig, handleSiteDomainSort)}
                      {renderSortableHeader("Margin %", "marginPercentage", siteDomainSortConfig, handleSiteDomainSort)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {siteDomainData.length > 0 ? (
                      siteDomainData.map((item, index) => {
                        const rowKey = getSiteDomainRowKey(item);
                        const domainKey = item.siteDomain || item.siteName || '';
                        const isOpen = selectedSiteDomain === rowKey;
                        return (
                          <React.Fragment key={`sd-${index}-${rowKey || 'unknown'}`}>
                            <TableRow
                              className={`cursor-pointer hover:bg-slate-50 ${isOpen ? 'bg-blue-50' : ''}`}
                              onClick={() => handleSiteDomainRowClick(item, entityFilters)}
                            >
                              <TableCell className="text-center font-medium text-slate-800 max-w-[10rem] truncate" title={item.realmName || '—'}>
                                {item.realmName || '—'}
                              </TableCell>
                              <TableCell className="text-center font-medium">
                                <span className="inline-flex items-center justify-center gap-1.5">
                                  {isOpen ? (
                                    <ChevronDown className="w-4 h-4 shrink-0 text-[rgb(75,99,226)]" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />
                                  )}
                                  {domainKey || '—'}
                                </span>
                              </TableCell>
                              <TableCell className="text-center text-green-600">{formatCurrency(item.PriceAdvertiser_PublisherSide || 0)}</TableCell>
                              <TableCell className="text-center text-red-600">{formatCurrency(item.PricePublisher || 0)}</TableCell>
                              <TableCell className="text-center text-black">{formatCurrency(item.margin)}</TableCell>
                              <TableCell className="text-center">{formatLargeNumber(item.impressions || 0)}</TableCell>
                              <TableCell className="text-center">{formatLargeNumber(item.clicks || 0)}</TableCell>
                              <TableCell className="text-center">{formatPercentage(item.ctr || 0)}</TableCell>
                              <TableCell className="text-center">
                                {parseFloat(item.marginPercentage) > 0 ? (
                                  <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                                    {item.marginPercentage}%
                                  </span>
                                ) : (
                                  <Badge variant="destructive">{item.marginPercentage}%</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                            {isOpen && (
                              <TableRow>
                                <TableCell colSpan={9} className="p-0 bg-slate-50">
                                  {loadingSiteDomainDetail ? (
                                    <div className="flex items-center justify-center py-8">
                                      <Loader2 className="w-5 h-5 animate-spin text-[rgb(75,99,226)]" />
                                      <span className="ml-2 text-slate-600">Loading daily breakdown…</span>
                                    </div>
                                  ) : siteDomainDetailData.length > 0 ? (
                                    <div className="p-4">
                                      <h3 className="text-sm font-semibold mb-3 text-slate-700">
                                        {item.realmName ? `${item.realmName} · ` : ''}{domainKey} — by day
                                      </h3>
                                      <Table className="text-xs w-full">
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="text-center">Date</TableHead>
                                            <TableHead className="text-center">DSP Revenue</TableHead>
                                            <TableHead className="text-center">Publisher Costs</TableHead>
                                            <TableHead className="text-center">ADY Margin</TableHead>
                                            <TableHead className="text-center">Impressions</TableHead>
                                            <TableHead className="text-center">Click</TableHead>
                                            <TableHead className="text-center">CTR</TableHead>
                                            <TableHead className="text-center">Margin %</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {siteDomainDetailData.map((detailItem, detailIndex) => (
                                            <TableRow key={detailIndex}>
                                              <TableCell className="text-center font-medium">{detailItem.date}</TableCell>
                                              <TableCell className="text-center text-green-600">{formatCurrency(detailItem.PriceAdvertiser_PublisherSide || 0)}</TableCell>
                                              <TableCell className="text-center text-red-600">{formatCurrency(detailItem.PricePublisher || 0)}</TableCell>
                                              <TableCell className="text-center text-black">{formatCurrency(detailItem.margin)}</TableCell>
                                              <TableCell className="text-center">{formatLargeNumber(detailItem.impressions || 0)}</TableCell>
                                              <TableCell className="text-center">{formatLargeNumber(detailItem.clicks || 0)}</TableCell>
                                              <TableCell className="text-center">{formatPercentage(detailItem.ctr || 0)}</TableCell>
                                              <TableCell className="text-center">
                                                {parseFloat(detailItem.marginPercentage) > 0 ? (
                                                  <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                                                    {detailItem.marginPercentage}%
                                                  </span>
                                                ) : (
                                                  <Badge variant="destructive">{detailItem.marginPercentage}%</Badge>
                                                )}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center py-8 text-slate-500">
                                      No daily data available
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-slate-500">No SITE DOMAIN data available</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      );
    }

    if (selectedFilter === 'geo') {
      return (
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
                          <TableCell className="text-center font-medium">{item.country || 'Unknown'}</TableCell>
                          <TableCell className="text-center text-green-600">{formatCurrency(item.PriceAdvertiser_PublisherSide || 0)}</TableCell>
                          <TableCell className="text-center text-red-600">{formatCurrency(item.PricePublisher || 0)}</TableCell>
                          <TableCell className="text-center text-black">{formatCurrency(item.margin)}</TableCell>
                          <TableCell className="text-center">{formatLargeNumber(item.impressions || 0)}</TableCell>
                          <TableCell className="text-center">{formatLargeNumber(item.clicks || 0)}</TableCell>
                          <TableCell className="text-center">{formatPercentage(item.ctr || 0)}</TableCell>
                          <TableCell className="text-center">
                            {item.marginPercentage > 0 ? (
                              <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">
                                {item.marginPercentage}%
                              </span>
                            ) : (
                              <Badge variant="destructive">{item.marginPercentage}%</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-slate-500">No GEO data available</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      );
    }

    return null;
  };

  const summaryCardsContent = summaryStats
    ? (renderSummaryCards || defaultRenderSummaryCards)(summaryStats, viewMode, formatCurrency)
    : null;

  return (
    <div className="bg-slate-50 p-6">
      <div ref={exportPageRef} className="max-w-7xl mx-auto space-y-6">
        {/* Page Header */}
        {(pageTitle || entityName || entityId) && (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900 md:text-2xl">
                {entityName || defaultEntityName}
              </h1>
              {entityId && (
                <p className="text-sm text-slate-500">
                  ID&nbsp;:&nbsp;<span className="font-mono text-slate-600">{entityId}</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 export-ignore">
              <Button
                onClick={exportCurrentPageToPDF}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                disabled={exportingPdf}
              >
                <Download className="w-4 h-4" />
                {exportingPdf ? 'Exporting...' : 'Export PDF'}
              </Button>
            </div>
          </div>
        )}

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
        {summaryStats && !loading && summaryCardsContent && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {summaryCardsContent}
          </div>
        )}

        {/* Chart */}
        {analyticsData.length > 0 && !loading && (renderChart || defaultRenderChart) && (
          <div>
            {(renderChart || defaultRenderChart)(analyticsData, viewMode, networkOperationsData)}
          </div>
        )}


        {/* Detailed Table */}
        {!loading && ((hasTableConfig && baseColumnsConfig.length > 0) || (!hasTableConfig && renderTableHeaders && renderTableRow)) && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle>Analytics Data</CardTitle>
              {analyticsData.length > 0 && (
                      <Button
                  onClick={exportAnalyticsTableToCSV}
                        variant="outline"
                        size="sm"
                  className="flex items-center gap-2"
                      >
                  <Download className="w-4 h-4" />
                  Export CSV
                      </Button>
                  )}
            </CardHeader>
            <CardContent>
              {analyticsData.length > 0 ? (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {hasTableConfig ? (
                          <>
                            {renderHeaderFromConfig(baseColumnsConfig)}
                            {shouldRenderDetailedColumns && renderHeaderFromConfig(detailedColumnsConfig)}
                          </>
                        ) : (
                          renderTableHeaders(viewMode, showDetailedColumns)
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analyticsData.map((item, index) => {
                        const isExpanded = hasTableConfig && viewMode === 'daily' && tableConfig?.expandedDates?.has?.(item.dateKey || item.formattedDate);
                        const isLoading = hasTableConfig && viewMode === 'daily' && tableConfig?.loadingHourlyData?.has?.(item.dateKey || item.formattedDate);
                        const hourlyData = hasTableConfig && viewMode === 'daily' ? (tableConfig?.hourlyDataCache?.[item.dateKey || item.formattedDate] || []) : [];
                        
                        return (
                        <React.Fragment key={index}>
                            {hasTableConfig ? (
                              <TableRow
                                className={viewMode === 'daily' ? 'cursor-pointer hover:bg-slate-50' : ''}
                                onClick={viewMode === 'daily' && tableConfig?.onRowClick ? () => tableConfig.onRowClick(item, entityId) : undefined}
                              >
                                {renderCellsFromConfig(baseColumnsConfig, item, index, entityId)}
                                {shouldRenderDetailedColumns && renderCellsFromConfig(detailedColumnsConfig, item, index)}
                              </TableRow>
                        ) : (
                          <React.Fragment>
                            {renderTableRow(item, index, analyticsData, viewMode, showDetailedColumns, entityId)}
                          </React.Fragment>
                        )}
                            
                            {/* Hourly data rows (only in daily mode when expanded) */}
                            {hasTableConfig && viewMode === 'daily' && isExpanded && (
                              <>
                                {isLoading ? (
                                  <TableRow>
                                    <TableCell colSpan={shouldRenderDetailedColumns ? baseColumnsConfig.length + detailedColumnsConfig.length : baseColumnsConfig.length} className="text-center py-4">
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
                                      {baseColumnsConfig.slice(1).map((column, colIdx) => {
                                        const cellContent = typeof column.cell === 'function'
                                          ? column.cell({ item: hourItem, index: hourIndex, analyticsData: hourlyData, viewMode, showDetailedColumns })
                                          : column.cell;
                                        
                                        // For trend columns, show dash
                                        if (column.id?.includes('Trend')) {
                                          return (
                                            <TableCell key={`hour-cell-${colIdx}`} className="text-center">
                                              <span className="text-gray-400 text-xs">—</span>
                                            </TableCell>
                                          );
                                        }
                                        
                                        // For other columns, try to render the cell or show N/A
                                        if (React.isValidElement(cellContent)) {
                                          return React.cloneElement(cellContent, {
                                            key: `hour-cell-${colIdx}`,
                                          });
                                        }
                                        
                                        return (
                                          <TableCell key={`hour-cell-${colIdx}`} className="text-center">
                                            {cellContent || <span className="text-gray-400">N/A</span>}
                                          </TableCell>
                                        );
                                      })}
                                      {shouldRenderDetailedColumns && detailedColumnsConfig.map((column, colIdx) => (
                                        <TableCell key={`hour-detailed-${colIdx}`} className="text-center">
                                          <span className="text-gray-400">N/A</span>
                                        </TableCell>
                                      ))}
                                    </TableRow>
                                  ))
                                ) : (
                                  <TableRow>
                                    <TableCell colSpan={shouldRenderDetailedColumns ? baseColumnsConfig.length + detailedColumnsConfig.length : baseColumnsConfig.length} className="text-center py-4 text-sm text-slate-500">
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
                  <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Period: {startDate ? new Date(startDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'} - {endDate ? new Date(endDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}
                    </span>
                    <span>
                      Last updated: {lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  {/* Empty Table Message */}
                  <div className="py-12 text-center text-slate-500">
                    <BarChart3 className="w-12 h-12 text-slate-400 mb-4 mx-auto" />
                    <p className="text-lg font-medium text-slate-700 mb-2">No data available</p>
                    <p className="text-sm text-slate-500">There is no analytics data for the selected period.</p>
                  </div>
                  {/* Period and Last Updated Info (even when no data) */}
                  <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Period: {startDate ? new Date(startDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'} - {endDate ? new Date(endDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A'}
                    </span>
                    <span>
                      Last updated: {lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Analytics Filter Menu */}
      <AnalyticsFilterMenu
        {...getEntityFilters()}
        menuItems={menuItems}
        selectedFilter={selectedFilter}
        isPanelOpen={isPanelOpen}
        onMenuItemClick={handleMenuItemClick}
        onClosePanel={handleClosePanel}
        panelContent={renderPanelContent()}
        headerActions={
          <>
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
            {selectedFilter === 'ad-kind' && adKindData.length > 0 && (
              <Button
                onClick={exportAdKindDataToCSV}
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
                onClick={exportDspDataToCSV}
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
                onClick={exportSeatDataToCSV}
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
                onClick={exportAdDomainDataToCSV}
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
                onClick={exportSiteDomainDataToCSV}
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
          </>
        }
      />
    </div>
  );
}


