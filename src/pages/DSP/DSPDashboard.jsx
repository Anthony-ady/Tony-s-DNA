/**
 * DSP Dashboard Page Component
 * 
 * Uses the DashboardTemplate to display DSP analytics
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import DashboardTemplate from "../Dashboard/DashboardTemplate";
import AnalyticsFilterMenu from "@/components/AnalyticsFilterMenu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, Calendar, BarChart3, DollarSign, TrendingUp, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { cachedFetch } from '@/utils/apiCache';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { EntityPerformanceCard } from "@/components/dashboard/EntityPerformanceCard";
import { API_ENDPOINTS } from "@/config/api";
import { formatCurrency as formatCurrencyNoM, formatCurrencyDetailed, formatCurrencyRaw, formatLargeNumber, formatPercentage } from "@/utils/formatters";
import { Badge } from "@/components/ui/badge";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function DSPDashboard() {
  const { getToken } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Menu state
  const [selectedFilter, setSelectedFilter] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  
  // Business Review data state
  const [businessReviewData, setBusinessReviewData] = useState(null);
  const [loadingBusinessReview, setLoadingBusinessReview] = useState(false);
  const [businessReviewError, setBusinessReviewError] = useState(null);
  
  // Trend data state
  const [trendData, setTrendData] = useState(null);
  const [loadingTrend, setLoadingTrend] = useState(false);
  const [trendError, setTrendError] = useState(null);
  const [trendViewMode, setTrendViewMode] = useState('month'); // 'month' or 'year'
  const [trendSelectedMonth, setTrendSelectedMonth] = useState(null);
  const [trendSelectedYear, setTrendSelectedYear] = useState(null);
  
  // Filter state for month/year view
  const [viewMode, setViewMode] = useState('month'); // 'month' or 'year'
  const [selectedMonth, setSelectedMonth] = useState(null); // Format: '2024-11'
  const [selectedYear, setSelectedYear] = useState(null); // Format: '2024'
  
  // In-memory cache for per-DSP daily data (for card mini-curves)
  // Key: `${partnerId}_${startDate}_${endDate}`
  const [cardDailyCache, setCardDailyCache] = useState({});

  // Local view mode state (synced with Layout's dashboard-view-mode)
  const [dashboardViewMode, setDashboardViewMode] = useState(() => {
    if (typeof window === 'undefined') return 'daily';
    return localStorage.getItem('dashboard-view-mode') || 'daily';
  });

  // Sync viewMode with storage events
  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem('dashboard-view-mode') || 'daily';
      setDashboardViewMode(stored);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Poll localStorage periodically to catch same-tab changes
  useEffect(() => {
    const id = setInterval(() => {
      const stored = localStorage.getItem('dashboard-view-mode') || 'daily';
      if (stored !== dashboardViewMode) {
        setDashboardViewMode(stored);
      }
    }, 200);
    return () => clearInterval(id);
  }, [dashboardViewMode]);
  
  // Menu items configuration - same as RealmAnalytics/CompanyAnalytics
  const menuItems = [
    { id: 'device', label: 'DEVICE' },
    { id: 'ad-kind', label: 'AD KIND' },
    { id: 'seat', label: 'SEAT' },
    { id: 'ad-domain', label: 'AD DOMAIN' },
    { id: 'site-domain', label: 'SITE DOMAIN' },
    { id: 'geo', label: 'GEO' },
    { id: 'business-review', label: 'OVERVIEW' }
  ];

  // Filter panel data states
  const [deviceData, setDeviceData] = useState([]);
  const [loadingDeviceData, setLoadingDeviceData] = useState(false);
  const [dspData, setDspData] = useState([]);
  const [loadingDspData, setLoadingDspData] = useState(false);
  const [seatData, setSeatData] = useState([]);
  const [loadingSeatData, setLoadingSeatData] = useState(false);
  const [adDomainData, setAdDomainData] = useState([]);
  const [loadingAdDomainData, setLoadingAdDomainData] = useState(false);
  const [siteDomainData, setSiteDomainData] = useState([]);
  const [loadingSiteDomainData, setLoadingSiteDomainData] = useState(false);
  const [geoData, setGeoData] = useState([]);
  const [loadingGeoData, setLoadingGeoData] = useState(false);
  const [adKindData, setAdKindData] = useState([]);
  const [loadingAdKindData, setLoadingAdKindData] = useState(false);
  const [kpiProgData, setKpiProgData] = useState([]);
  const [loadingKpiProgData, setLoadingKpiProgData] = useState(false);
  
  // Sort state for filter panels (matching AnalyticsTemplate)
  const [deviceSortConfig, setDeviceSortConfig] = useState({ key: null, direction: 'asc' });
  const [dspSortConfig, setDspSortConfig] = useState({ key: null, direction: 'asc' });
  const [seatSortConfig, setSeatSortConfig] = useState({ key: null, direction: 'asc' });
  const [adDomainSortConfig, setAdDomainSortConfig] = useState({ key: null, direction: 'asc' });
  const [siteDomainSortConfig, setSiteDomainSortConfig] = useState({ key: null, direction: 'asc' });
  const [geoSortConfig, setGeoSortConfig] = useState({ key: null, direction: 'asc' });
  const [adKindSortConfig, setAdKindSortConfig] = useState({ key: null, direction: 'asc' });
  const [kpiProgSortConfig, setKpiProgSortConfig] = useState({ key: null, direction: 'asc' });
  
  // State to track selected partner ID from table
  const [selectedPartnerId, setSelectedPartnerId] = useState(null);
  
  // Get partner ID from URL, selected table row, or use a default for testing
  const getPartnerId = () => {
    const partnerIdFromUrl = searchParams.get('id');
    if (partnerIdFromUrl) return partnerIdFromUrl;
    if (selectedPartnerId) return selectedPartnerId;
    return '2a62ca3297af454b8f19eb7922ed945f';
  };

  // Date helpers for filter panels (from Layout header time range)
  const getTimeRange = () => localStorage.getItem('selected-time-range') || '7d';
  const calculateDatesFromTimeRange = (range) => {
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDate = now.getDate();
    let startDateValue, endDateValue;
    const days = { '5d': 5, '7d': 7, '14d': 14, '20d': 20, '30d': 30 }[range] || 7;
    const start = new Date(todayYear, todayMonth, todayDate - days);
    startDateValue = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0, 0));
    endDateValue = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
    return { start: startDateValue.toISOString().split('T')[0], end: endDateValue.toISOString().split('T')[0] };
  };

  // Effective dates for filter panels: Real-time (hourly) = Today only, sinon = plage sélectionnée (5d, 7d...)
  const getEffectiveDatesForFilters = () => {
    if (dashboardViewMode === 'hourly') {
      const now = new Date();
      const todayYear = now.getUTCFullYear();
      const todayMonth = now.getUTCMonth();
      const todayDate = now.getUTCDate();
      const todayStart = new Date(Date.UTC(todayYear, todayMonth, todayDate, 0, 0, 0, 0));
      const todayEnd = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
      const todayStr = todayStart.toISOString().split('T')[0];
      return { start: todayStr, end: todayStr };
    }
    return calculateDatesFromTimeRange(getTimeRange());
  };

  // Fetch filter panel data - DSP Dashboard shows ALL DSPs, no Partner filter
  const fetchFilterData = async (type) => {
    const token = getToken();
    if (!token) return;
    const { start, end } = getEffectiveDatesForFilters();
    const startDateValue = new Date(start + 'T00:00:00.000Z');
    const endDateValue = new Date(end + 'T23:59:59.000Z');

    const basePayload = {
      Intervals: [{ Begin: startDateValue.toISOString(), End: endDateValue.toISOString() }],
      Datasource: 'adserver_stats',
      TimeZone: 'Etc/GMT',
      Granularity: 'all'
    };

    try {
      if (type === 'device') {
        setLoadingDeviceData(true);
        const res = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-ayl-auth-token': token },
          body: JSON.stringify({ ...basePayload, Metrics: ['PricePublisher', 'PriceAdvertiser_PublisherSide', 'CLICK', 'IMPRESSION'], Dimensions: ['DEVICE'] })
        });
        const data = (await res.json())?.Data || [];
        setDeviceData(data.map((i) => {
          const impressions = i.IMPRESSION ?? i.Impression ?? 0;
          const clicks = i.CLICK ?? i.Click ?? 0;
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          return {
            device: i.Device || i.DEVICE || 'Unknown',
            PriceAdvertiser_PublisherSide: i.PriceAdvertiser_PublisherSide || 0,
            PricePublisher: i.PricePublisher || 0,
            margin: (i.PriceAdvertiser_PublisherSide || 0) - (i.PricePublisher || 0),
            marginPercentage: ((i.PriceAdvertiser_PublisherSide || 0) - (i.PricePublisher || 0)) / (i.PriceAdvertiser_PublisherSide || 1) * 100,
            impressions,
            clicks,
            ctr
          };
        }).sort((a, b) => b.PriceAdvertiser_PublisherSide - a.PriceAdvertiser_PublisherSide));
      } else if (type === 'dsp') {
        setLoadingDspData(true);
        const res = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-ayl-auth-token': token },
          body: JSON.stringify({
            ...basePayload,
            Dimensions: ['Partner'],
            Metrics: ['PricePublisher', 'PriceAdvertiser_PublisherSide', 'PartnerName', 'CLICK', 'IMPRESSION'],
            Size: 500,
            OrderBy: 'PriceAdvertiser_PublisherSide',
            OrderOp: 'DESC'
          })
        });
        const data = (await res.json())?.Data || [];
        setDspData(data.map((i) => {
          const impressions = i.IMPRESSION ?? i.Impression ?? 0;
          const clicks = i.CLICK ?? i.Click ?? 0;
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          return {
            partnerId: i.Partner || 'Unknown',
            partnerName: i.PartnerName || i.Name_Partner || 'Unknown',
            PriceAdvertiser_PublisherSide: i.PriceAdvertiser_PublisherSide || 0,
            PricePublisher: i.PricePublisher || 0,
            margin: (i.PriceAdvertiser_PublisherSide || 0) - (i.PricePublisher || 0),
            marginPercentage: ((i.PriceAdvertiser_PublisherSide || 0) - (i.PricePublisher || 0)) / (i.PriceAdvertiser_PublisherSide || 1) * 100,
            impressions,
            clicks,
            ctr
          };
        }));
      } else if (type === 'seat') {
        setLoadingSeatData(true);
        const res = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-ayl-auth-token': token },
          body: JSON.stringify({
            ...basePayload,
            Dimensions: ['SeatId'],
            Metrics: ['PricePublisher', 'PriceAdvertiser_PublisherSide', 'SeatName', 'partner_name', 'CLICK', 'IMPRESSION'],
            Size: 250,
            OrderBy: 'PriceAdvertiser_PublisherSide',
            OrderOp: 'DESC'
          })
        });
        const data = (await res.json())?.Data || [];
        setSeatData(data.map((i) => {
          const impressions = i.IMPRESSION ?? i.Impression ?? 0;
          const clicks = i.CLICK ?? i.Click ?? 0;
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          return {
            seatName: i.SeatName || 'Unknown',
            partnerName: i.partner_name || i.PartnerName || 'Unknown',
            PriceAdvertiser_PublisherSide: i.PriceAdvertiser_PublisherSide || 0,
            PricePublisher: i.PricePublisher || 0,
            margin: (i.PriceAdvertiser_PublisherSide || 0) - (i.PricePublisher || 0),
            marginPercentage: ((i.PriceAdvertiser_PublisherSide || 0) - (i.PricePublisher || 0)) / (i.PriceAdvertiser_PublisherSide || 1) * 100,
            impressions,
            clicks,
            ctr
          };
        }));
      } else if (type === 'ad-domain') {
        setLoadingAdDomainData(true);
        const res = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-ayl-auth-token': token },
          body: JSON.stringify({
            ...basePayload,
            Dimensions: ['AdDomains'],
            Metrics: ['PricePublisher', 'PriceAdvertiser_PublisherSide', 'partner_name', 'CLICK', 'IMPRESSION'],
            Size: 250,
            OrderBy: 'PriceAdvertiser_PublisherSide',
            OrderOp: 'DESC'
          })
        });
        const data = (await res.json())?.Data || [];
        setAdDomainData(data.map((i) => {
          const impressions = i.IMPRESSION ?? i.Impression ?? 0;
          const clicks = i.CLICK ?? i.Click ?? 0;
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          return {
            adDomain: i.AdDomains || i.adDomains || 'Unknown',
            partnerName: i.partner_name || 'Unknown',
            PriceAdvertiser_PublisherSide: i.PriceAdvertiser_PublisherSide || 0,
            PricePublisher: i.PricePublisher || 0,
            margin: (i.PriceAdvertiser_PublisherSide || 0) - (i.PricePublisher || 0),
            marginPercentage: ((i.PriceAdvertiser_PublisherSide || 0) - (i.PricePublisher || 0)) / (i.PriceAdvertiser_PublisherSide || 1) * 100,
            impressions,
            clicks,
            ctr
          };
        }));
      } else if (type === 'site-domain') {
        setLoadingSiteDomainData(true);
        const res = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-ayl-auth-token': token },
          body: JSON.stringify({
            ...basePayload,
            Dimensions: ['SiteDomain'],
            Metrics: ['PricePublisher', 'PriceAdvertiser_PublisherSide', 'CLICK', 'IMPRESSION'],
            Size: 250,
            OrderBy: 'PriceAdvertiser_PublisherSide',
            OrderOp: 'DESC'
          })
        });
        const data = (await res.json())?.Data || [];
        setSiteDomainData(data.map((i) => {
          const impressions = i.IMPRESSION ?? i.Impression ?? 0;
          const clicks = i.CLICK ?? i.Click ?? 0;
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          return {
            siteDomain: i.SiteDomain || 'Unknown',
            siteName: i.SiteDomain || 'Unknown',
            PriceAdvertiser_PublisherSide: i.PriceAdvertiser_PublisherSide || 0,
            PricePublisher: i.PricePublisher || 0,
            margin: (i.PriceAdvertiser_PublisherSide || 0) - (i.PricePublisher || 0),
            marginPercentage: ((i.PriceAdvertiser_PublisherSide || 0) - (i.PricePublisher || 0)) / (i.PriceAdvertiser_PublisherSide || 1) * 100,
            impressions,
            clicks,
            ctr
          };
        }));
      } else if (type === 'geo') {
        setLoadingGeoData(true);
        const res = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-ayl-auth-token': token },
          body: JSON.stringify({
            ...basePayload,
            Dimensions: ['Country'],
            Metrics: ['PricePublisher', 'PriceAdvertiser_PublisherSide', 'CLICK', 'IMPRESSION'],
            Size: 250,
            OrderBy: 'PriceAdvertiser_PublisherSide',
            OrderOp: 'DESC'
          })
        });
        const data = (await res.json())?.Data || [];
        setGeoData(data.map((i) => ({
          country: i.Country || 'Unknown',
          PriceAdvertiser_PublisherSide: i.PriceAdvertiser_PublisherSide || 0,
          PricePublisher: i.PricePublisher || 0,
          impressions: i.IMPRESSION ?? i.Impression ?? 0,
          clicks: i.CLICK ?? i.Click ?? 0,
          ctr: (i.IMPRESSION ?? i.Impression ?? 0) > 0 ? ((i.CLICK ?? i.Click ?? 0) / (i.IMPRESSION ?? i.Impression ?? 0)) * 100 : 0,
          margin: (i.PriceAdvertiser_PublisherSide || 0) - (i.PricePublisher || 0),
          marginPercentage: ((i.PriceAdvertiser_PublisherSide || 0) - (i.PricePublisher || 0)) / (i.PriceAdvertiser_PublisherSide || 1) * 100
        })).sort((a, b) => b.PriceAdvertiser_PublisherSide - a.PriceAdvertiser_PublisherSide));
      } else if (type === 'ad-kind') {
        setLoadingAdKindData(true);
        const res = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-ayl-auth-token': token },
          body: JSON.stringify({
            Intervals: basePayload.Intervals,
            Datasource: 'network_operations',
            TimeZone: 'Etc/GMT',
            Granularity: 'all',
            Dimensions: ['adKind'],
            Metrics: ['network_operations_impressions', 'network_operations_click', 'network_operations_price_publisher', 'network_operations_price_advertiser']
          })
        });
        const data = (await res.json())?.Data || [];
        setAdKindData(data.filter((i) => i.adKind && i.adKind !== 'Unknown').map((i) => {
          const impressions = i.network_operations_impressions || 0;
          const clicks = i.network_operations_click || i.network_operations_clicks || 0;
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          return {
            adKind: i.adKind,
            adKindDisplay: getAdKindDisplayName(i.adKind),
            PriceAdvertiser_PublisherSide: i.network_operations_price_advertiser || 0,
            PricePublisher: i.network_operations_price_publisher || 0,
            impressions,
            clicks,
            ctr,
            margin: (i.network_operations_price_advertiser || 0) - (i.network_operations_price_publisher || 0),
            marginPercentage: ((i.network_operations_price_advertiser || 0) - (i.network_operations_price_publisher || 0)) / (i.network_operations_price_advertiser || 1) * 100
          };
        }).sort((a, b) => b.PriceAdvertiser_PublisherSide - a.PriceAdvertiser_PublisherSide));
      } else if (type === 'kpi-prog') {
        setLoadingKpiProgData(true);
        // KPI PROG = network_operations (ad operations), pas adserver_stats
        const beginDate = new Date(start + 'T00:00:00.000Z');
        const endDateFormatted = new Date(end + 'T23:59:59.000Z');
        const partnerId = getPartnerId();
        const payload = {
          Datasource: 'network_operations',
          Metrics: [
            'network_operations_bid_requests',
            'network_operations_bid_responses',
            'network_operations_impressions',
            'network_operations_price_publisher',
            'network_operations_price_advertiser'
          ],
          Dimensions: [],
          Granularity: { type: 'period', period: 'P1D' },
          Intervals: [{ Begin: beginDate.toISOString(), End: endDateFormatted.toISOString() }],
          TimeZone: 'Etc/GMT',
          ...(partnerId && {
            Filters: {
              partnerId: { Value: [partnerId], Operator: 'in' }
            }
          })
        };
        const res = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-ayl-auth-token': token },
          body: JSON.stringify(payload)
        });
        const resp = await res.json();
        const rawData = Array.isArray(resp) ? resp : (resp?.Data || []);
        const filtered = rawData.filter((i) => i.network_operations_price_advertiser !== undefined || i.network_operations_price_publisher !== undefined);
        setKpiProgData(filtered.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)).map((i) => {
          const dspRev = i.network_operations_price_advertiser || 0;
          const pubCost = i.network_operations_price_publisher || 0;
          const margin = dspRev - pubCost;
          return {
            date: i.timestamp ? new Date(i.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A',
            PriceAdvertiser_PublisherSide: dspRev,
            PricePublisher: pubCost,
            margin,
            marginPercentage: dspRev > 0 ? (margin / dspRev) * 100 : 0
          };
        }));
      }
    } catch (err) {
      console.error('Error fetching filter data:', err);
    } finally {
      if (type === 'device') setLoadingDeviceData(false);
      if (type === 'dsp') setLoadingDspData(false);
      if (type === 'seat') setLoadingSeatData(false);
      if (type === 'ad-domain') setLoadingAdDomainData(false);
      if (type === 'site-domain') setLoadingSiteDomainData(false);
      if (type === 'geo') setLoadingGeoData(false);
      if (type === 'ad-kind') setLoadingAdKindData(false);
      if (type === 'kpi-prog') setLoadingKpiProgData(false);
    }
  };

  // Map adKind display names
  const getAdKindDisplayName = (adKind) => {
    const mapping = {
      'AD_TRAFFIC': 'NATIVE DISPLAY',
      'AD_OUTSTREAM': 'OUTSTREAM',
      'AD_INSTREAM': 'INSTREAM',
      'AD_RAW_VIDEO': 'VIDEO IN BANNER',
      'AD_VIDEO': 'NATIVE VIDEO',
      'AD_BANNER': 'DISPLAY'
    };
    return mapping[adKind] || adKind || 'Unknown';
  };

  // Get available months and years from data
  const getAvailableMonthsAndYears = (processedData) => {
    if (!processedData || processedData.length === 0) return { months: [], years: [] };
    
    const monthsSet = new Set();
    const yearsSet = new Set();
    
    processedData.forEach(item => {
      if (item.date) {
        const date = new Date(item.date);
        const year = date.getFullYear();
        const month = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthsSet.add(month);
        yearsSet.add(year.toString());
      }
    });
    
    return {
      months: Array.from(monthsSet).sort().reverse(),
      years: Array.from(yearsSet).sort().reverse()
    };
  };

  // Filter processed data by month or year
  const filterDataByPeriod = (processedData, viewMode, selectedMonth, selectedYear) => {
    if (!processedData || processedData.length === 0) return [];
    
    if (viewMode === 'month' && selectedMonth) {
      return processedData.filter(item => {
        if (!item.date) return false;
        const date = new Date(item.date);
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return month === selectedMonth;
      });
    } else if (viewMode === 'year' && selectedYear) {
      return processedData.filter(item => {
        if (!item.date) return false;
        const date = new Date(item.date);
        return date.getFullYear().toString() === selectedYear;
      });
    }
    
    return processedData;
  };

  // Calculate KPI metrics
  const calculateKPIs = (filteredData) => {
    const totals = filteredData.reduce((acc, item) => {
      acc.bidRequests += item.bidRequests || 0;
      acc.bidResponses += item.bidResponses || 0;
      acc.impressions += item.impressions || 0;
      acc.clicks += item.clicks || 0;
      acc.pricePublisher += item.pricePublisher || 0;
      acc.priceAdvertiser += item.priceAdvertiser || 0;
      return acc;
    }, {
      bidRequests: 0,
      bidResponses: 0,
      impressions: 0,
      clicks: 0,
      pricePublisher: 0,
      priceAdvertiser: 0
    });

    const avgCPM = totals.impressions > 0 
      ? (totals.priceAdvertiser / totals.impressions) * 1000 
      : 0;

    return {
      bidRequests: totals.bidRequests,
      bidResponses: totals.bidResponses,
      clicks: totals.clicks,
      impressions: totals.impressions,
      revenue: totals.priceAdvertiser,
      publisherPayout: totals.pricePublisher,
      avgCPM: avgCPM
    };
  };

  // Prepare daily trend data for chart (or monthly if viewMode is 'year')
  const prepareDailyTrendData = (filteredData, viewMode) => {
    const aggregatedData = {};
    
    filteredData.forEach(item => {
      if (!item.date) return;
      const date = new Date(item.date);
      
      let key, label;
      
      if (viewMode === 'year') {
        // Aggregate by month for year view
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        key = month;
        label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      } else {
        // Aggregate by day for month view
        key = item.date;
        label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
      
      if (!aggregatedData[key]) {
        aggregatedData[key] = {
          date: key,
          bidRequests: 0,
          bidResponses: 0,
          revenue: 0,
          clicks: 0,
          impressions: 0
        };
      }
      
      aggregatedData[key].bidRequests += item.bidRequests || 0;
      aggregatedData[key].bidResponses += item.bidResponses || 0;
      aggregatedData[key].revenue += item.priceAdvertiser || 0;
      aggregatedData[key].clicks += item.clicks || 0;
      aggregatedData[key].impressions += item.impressions || 0;
    });
    
    return Object.values(aggregatedData)
      .sort((a, b) => {
        // Sort by date string (works for both YYYY-MM-DD and YYYY-MM formats)
        return a.date.localeCompare(b.date);
      })
      .map(item => ({
        ...item,
        dateLabel: viewMode === 'year' 
          ? new Date(item.date + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
          : new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }));
  };

  // Prepare pie chart data for ad type distribution (using impressions)
  const preparePieChartData = (filteredData) => {
    const adKindTotals = {};
    
    filteredData.forEach(item => {
      if (!item.adKind) return;
      const adKind = item.adKind;
      
      if (!adKindTotals[adKind]) {
        adKindTotals[adKind] = 0;
      }
      
      adKindTotals[adKind] += item.impressions || 0;
    });
    
    const total = Object.values(adKindTotals).reduce((sum, val) => sum + val, 0);
    
    return Object.entries(adKindTotals)
      .map(([adKind, value]) => ({
        name: getAdKindDisplayName(adKind),
        value: value,
        percentage: total > 0 ? ((value / total) * 100).toFixed(0) : 0
      }))
      .sort((a, b) => b.value - a.value);
  };

  // Prepare bar chart data for revenue by ad type
  const prepareBarChartData = (filteredData) => {
    const adKindRevenue = {};
    
    filteredData.forEach(item => {
      if (!item.adKind) return;
      const adKind = item.adKind;
      
      if (!adKindRevenue[adKind]) {
        adKindRevenue[adKind] = 0;
      }
      
      adKindRevenue[adKind] += item.priceAdvertiser || 0;
    });
    
    return Object.entries(adKindRevenue)
      .map(([adKind, revenue]) => ({
        name: getAdKindDisplayName(adKind),
        revenue: revenue / 1000 // Convert to thousands
      }))
      .sort((a, b) => b.revenue - a.revenue);
  };

  // Get available months and years from data
  const { months, years } = useMemo(() => {
    const processedData = businessReviewData?.processedData || [];
    return getAvailableMonthsAndYears(processedData);
  }, [businessReviewData]);
  
  // Initialize selected month/year when data loads
  useEffect(() => {
    if (businessReviewData?.processedData && businessReviewData.processedData.length > 0) {
      if (viewMode === 'month' && !selectedMonth && months.length > 0) {
        setSelectedMonth(months[0]);
      } else if (viewMode === 'year' && !selectedYear && years.length > 0) {
        setSelectedYear(years[0]);
      }
    }
  }, [businessReviewData, viewMode, months, years, selectedMonth, selectedYear]);
  
  // Filter data based on selected period
  const filteredData = useMemo(() => {
    const processedData = businessReviewData?.processedData || [];
    return filterDataByPeriod(processedData, viewMode, selectedMonth, selectedYear);
  }, [businessReviewData, viewMode, selectedMonth, selectedYear]);
  
  // Calculate KPIs
  const kpis = useMemo(() => {
    return calculateKPIs(filteredData);
  }, [filteredData]);
  
  // Prepare chart data
  const dailyTrendData = useMemo(() => {
    return prepareDailyTrendData(filteredData, viewMode);
  }, [filteredData, viewMode]);
  
  const pieChartData = useMemo(() => {
    return preparePieChartData(filteredData);
  }, [filteredData]);
  
  const barChartData = useMemo(() => {
    return prepareBarChartData(filteredData);
  }, [filteredData]);

  // Fetch Business Review data from JSON file
  const fetchBusinessReviewData = async (partnerId) => {
    setLoadingBusinessReview(true);
    setBusinessReviewError(null);
    
    try {
      // Load general business review data (not partner-specific)
      const response = await fetch(`/data/DSP/business-review-general.json`);
      
      if (!response.ok) {
        throw new Error(`Failed to load Business Review data: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Process and aggregate data by adKind and date
      const processedData = processBusinessReviewData(data.data || []);
      
      setBusinessReviewData({
        ...data,
        processedData
      });
    } catch (error) {
      console.error('Error loading Business Review data:', error);
      setBusinessReviewError(error.message);
      setBusinessReviewData(null);
    } finally {
      setLoadingBusinessReview(false);
    }
  };

  // Normalize timestamp format (fix invalid formats like "2023-10-31T00:00:00.000000.000Z")
  const normalizeTimestamp = (timestamp) => {
    if (!timestamp) return null;
    
    try {
      let normalized = timestamp.toString().trim();
      
      // Handle invalid format with double microseconds: "2023-10-31T00:00:00.000000.000Z"
      // Replace .000000.000Z with .000Z (standard ISO format)
      normalized = normalized.replace(/\.(\d{6})\.(\d{3})Z$/i, '.$2Z');
      
      // Try to parse the date
      const date = new Date(normalized);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        // Fallback: try to extract date part directly from string (YYYY-MM-DD)
        const dateMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          return dateMatch[1];
        }
        console.warn('Invalid timestamp format:', timestamp);
        return null;
      }
      
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error('Error normalizing timestamp:', timestamp, error);
      // Fallback: try to extract date part directly
      const dateMatch = timestamp.toString().match(/^(\d{4}-\d{2}-\d{2})/);
      return dateMatch ? dateMatch[1] : null;
    }
  };

  // Process and aggregate Business Review data
  const processBusinessReviewData = (rawData) => {
    // Group by adKind and date
    const grouped = {};
    
    rawData.forEach(item => {
      if (!item.adKind) return; // Skip items without adKind
      
      const adKind = item.adKind;
      const date = normalizeTimestamp(item.timestamp);
      
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
          priceAdvertiser: 0
        };
      }
      
      grouped[key].bidRequests += item.network_operations_bid_requests || 0;
      grouped[key].bidResponses += item.network_operations_bid_responses || 0;
      grouped[key].impressions += item.network_operations_impressions || 0;
      grouped[key].clicks += item.network_operations_click || 0;
      grouped[key].pricePublisher += item.network_operations_price_publisher || 0;
      grouped[key].priceAdvertiser += item.network_operations_price_advertiser || 0;
    });
    
    // Convert to array and sort by date
    return Object.values(grouped).sort((a, b) => {
      return new Date(a.date) - new Date(b.date);
    });
  };

  // Colors for pie chart - vibrant colors
  const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

  // Aggregate by adKind (total)
  const aggregateByAdKind = (processedData) => {
    const aggregated = {};
    
    processedData.forEach(item => {
      const adKind = item.adKind;
      
      if (!aggregated[adKind]) {
        aggregated[adKind] = {
          adKind,
          bidRequests: 0,
          bidResponses: 0,
          impressions: 0,
          clicks: 0,
          pricePublisher: 0,
          priceAdvertiser: 0
        };
      }
      
      aggregated[adKind].bidRequests += item.bidRequests;
      aggregated[adKind].bidResponses += item.bidResponses;
      aggregated[adKind].impressions += item.impressions;
      aggregated[adKind].clicks += item.clicks;
      aggregated[adKind].pricePublisher += item.pricePublisher;
      aggregated[adKind].priceAdvertiser += item.priceAdvertiser;
    });
    
    return Object.values(aggregated).map(item => ({
      ...item,
      margin: item.priceAdvertiser - item.pricePublisher,
      marginPercentage: item.priceAdvertiser > 0 
        ? ((item.priceAdvertiser - item.pricePublisher) / item.priceAdvertiser * 100).toFixed(2)
        : '0.00',
      fillRate: item.bidRequests > 0 
        ? ((item.bidResponses / item.bidRequests) * 100).toFixed(2)
        : '0.00',
      winRate: item.bidResponses > 0
        ? ((item.impressions / item.bidResponses) * 100).toFixed(2)
        : '0.00',
      ctr: item.impressions > 0
        ? ((item.clicks / item.impressions) * 100).toFixed(2)
        : '0.00'
    })).sort((a, b) => b.priceAdvertiser - a.priceAdvertiser);
  };

  // Export Business Review data to PDF
  const exportBusinessReviewToPDF = async () => {
    if (!businessReviewData || !businessReviewData.processedData || filteredData.length === 0) return;
    
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
      
      // Title
      pdf.setFontSize(20);
      pdf.setTextColor(30, 58, 138); // Dark blue
      pdf.setFont(undefined, 'bold');
      pdf.text('DSP Performance Dashboard', margin, yPosition);
      yPosition += 10;
      
      // Period label
      pdf.setFontSize(12);
      pdf.setTextColor(100, 100, 100);
      pdf.setFont(undefined, 'normal');
      const getPeriodLabel = () => {
        if (viewMode === 'month' && selectedMonth) {
          const date = new Date(selectedMonth + '-01');
          return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        } else if (viewMode === 'year' && selectedYear) {
          return selectedYear;
        }
        return 'All Time';
      };
      pdf.text(`Business Review • ${getPeriodLabel()}`, margin, yPosition);
      yPosition += 15;
      
      // KPI Cards Section
      pdf.setFontSize(16);
      pdf.setTextColor(30, 58, 138); // Blue color for section title
      pdf.setFont(undefined, 'bold');
      pdf.text('Key Performance Indicators', margin, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(10);
      const kpiData = [
        { 
          label: 'BID REQUESTS', 
          value: formatBidResponses(kpis.bidRequests), 
          subtitle: 'Total requests',
          borderColor: [245, 158, 11], // Amber
          bgColor: [255, 251, 235], // Light amber
          textColor: [146, 64, 14] // Dark amber
        },
        { 
          label: 'IMPRESSIONS', 
          value: formatBidResponses(kpis.impressions), 
          subtitle: 'Total impressions',
          borderColor: [59, 130, 246], // Blue
          bgColor: [239, 246, 255], // Light blue
          textColor: [30, 64, 175] // Dark blue
        },
        { 
          label: 'CLICKS', 
          value: formatBidResponses(kpis.clicks), 
          subtitle: 'Total clicks',
          borderColor: [239, 68, 68], // Red
          bgColor: [254, 242, 242], // Light red
          textColor: [153, 27, 27] // Dark red
        },
        { 
          label: 'REVENUE', 
          value: formatCurrency(kpis.revenue), 
          subtitle: 'Advertiser spend',
          borderColor: [16, 185, 129], // Green
          bgColor: [236, 253, 245], // Light green
          textColor: [5, 122, 85] // Dark green
        }
      ];
      
      const kpiBoxWidth = (pageWidth - 2 * margin - 3 * 5) / 4; // 4 KPIs with 5mm spacing
      const kpiBoxHeight = 25;
      
      checkNewPage(kpiBoxHeight + 10);
      
      kpiData.forEach((kpi, index) => {
        const xPos = margin + index * (kpiBoxWidth + 5);
        
        // Draw box with colored border and background
        pdf.setDrawColor(kpi.borderColor[0], kpi.borderColor[1], kpi.borderColor[2]);
        pdf.setFillColor(kpi.bgColor[0], kpi.bgColor[1], kpi.bgColor[2]);
        pdf.rect(xPos, yPosition, kpiBoxWidth, kpiBoxHeight, 'FD');
        
        // Draw left border accent
        pdf.setFillColor(kpi.borderColor[0], kpi.borderColor[1], kpi.borderColor[2]);
        pdf.rect(xPos, yPosition, 2, kpiBoxHeight, 'F');
        
        // Label
        pdf.setFontSize(8);
        pdf.setTextColor(kpi.textColor[0], kpi.textColor[1], kpi.textColor[2]);
        pdf.setFont(undefined, 'normal');
        pdf.text(kpi.label, xPos + 4, yPosition + 5);
        
        // Value
        pdf.setFontSize(12);
        pdf.setTextColor(kpi.textColor[0], kpi.textColor[1], kpi.textColor[2]);
        pdf.setFont(undefined, 'bold');
        pdf.text(kpi.value, xPos + 4, yPosition + 12);
        
        // Subtitle
        pdf.setFontSize(7);
        pdf.setTextColor(kpi.textColor[0] - 20, kpi.textColor[1] - 20, kpi.textColor[2] - 20);
        pdf.setFont(undefined, 'normal');
        pdf.text(kpi.subtitle, xPos + 4, yPosition + 17);
      });
      
      yPosition += kpiBoxHeight + 15;
      
      // Monthly Performance Trend Section
      checkNewPage(80);
      pdf.setFontSize(16);
      pdf.setTextColor(30, 58, 138); // Blue color for section title
      pdf.setFont(undefined, 'bold');
      pdf.text('Monthly Performance Trend', margin, yPosition);
      yPosition += 8;
      
      // Create a simple table representation of the trend data
      pdf.setFontSize(9);
      
      // Table header
      const tableHeaders = ['Period', 'Bid Requests', 'Impressions', 'Clicks', 'Revenue ($)'];
      const colWidths = [35, 35, 35, 35, 40];
      let xPos = margin;
      
      // Header background with blue color
      pdf.setFillColor(59, 130, 246);
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F');
      
      // Header text in white
      pdf.setTextColor(255, 255, 255);
      pdf.setFont(undefined, 'bold');
      tableHeaders.forEach((header, i) => {
        pdf.text(header, xPos + 2, yPosition + 6);
        xPos += colWidths[i];
      });
      
      yPosition += 8;
      
      // Table rows with alternating colors
      let rowIndex = 0;
      dailyTrendData.forEach((item) => {
        checkNewPage(8);
        
        // Alternate row colors
        if (rowIndex % 2 === 0) {
          pdf.setFillColor(249, 250, 251); // Light gray
        } else {
          pdf.setFillColor(255, 255, 255); // White
        }
        pdf.rect(margin, yPosition, pageWidth - 2 * margin, 8, 'F');
        
        pdf.setDrawColor(220, 220, 220);
        pdf.line(margin, yPosition, pageWidth - margin, yPosition);
        
        xPos = margin;
        const rowData = [
          item.dateLabel,
          formatBidResponses(item.bidRequests),
          formatBidResponses(item.impressions),
          formatBidResponses(item.clicks),
          formatCurrencyDetailed(item.revenue)
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
      pdf.setTextColor(30, 58, 138); // Blue color for section title
      pdf.setFont(undefined, 'bold');
      pdf.text('Impression by Ad Type', margin, yPosition);
      yPosition += 8;
      
      pdf.setFontSize(10);
      // PIE_COLORS: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316']
      const pieColorsRGB = [
        [59, 130, 246],   // Blue
        [16, 185, 129],   // Green
        [245, 158, 11],   // Amber
        [239, 68, 68],    // Red
        [139, 92, 246],   // Purple
        [236, 72, 153],   // Pink
        [6, 182, 212],    // Cyan
        [249, 115, 22]    // Orange
      ];
      
      pieChartData.forEach((item, index) => {
        checkNewPage(8);
        const color = pieColorsRGB[index % pieColorsRGB.length];
        
        // Draw colored square indicator
        pdf.setFillColor(color[0], color[1], color[2]);
        pdf.rect(margin + 5, yPosition - 2, 3, 3, 'F');
        
        // Text with color
        pdf.setTextColor(color[0], color[1], color[2]);
        pdf.setFont(undefined, 'bold');
        pdf.text(`${item.name} ${item.percentage}%`, margin + 10, yPosition);
        yPosition += 8;
      });
      
      yPosition += 5;
      
      // Revenue by Ad Type Section
      checkNewPage(60);
      pdf.setFontSize(16);
      pdf.setTextColor(30, 58, 138); // Blue color for section title
      pdf.setFont(undefined, 'bold');
      pdf.text('Revenue by Ad Type', margin, yPosition);
      yPosition += 8;
      
      pdf.setFontSize(10);
      barChartData.forEach((item, index) => {
        checkNewPage(8);
        const fullRevenue = item.revenue * 1000; // Convert from thousands
        const color = pieColorsRGB[index % pieColorsRGB.length];
        
        // Draw colored square indicator
        pdf.setFillColor(color[0], color[1], color[2]);
        pdf.rect(margin + 5, yPosition - 2, 3, 3, 'F');
        
        // Ad type name with color
        pdf.setTextColor(color[0], color[1], color[2]);
        pdf.setFont(undefined, 'bold');
        pdf.text(`${item.name}`, margin + 10, yPosition);
        
        // Revenue value
        pdf.setTextColor(0, 0, 0);
        pdf.setFont(undefined, 'normal');
        pdf.text(formatCurrencyDetailed(fullRevenue), pageWidth - margin - 50, yPosition);
        yPosition += 8;
      });
      
      // Save PDF
      const fileName = `Business_Review_${getPartnerId()}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF: ' + error.message);
    }
  };

  // Fetch Trend data from API
  const fetchTrendData = async (partnerId, startDate, endDate) => {
    setLoadingTrend(true);
    setTrendError(null);
    
    try {
      const token = getToken();
      if (!token) {
        throw new Error('No authentication token');
      }

      // Format dates in UTC
      const beginDate = new Date(startDate + 'T00:00:00Z').toISOString().replace('Z', '+00:00');
      const endDateFormatted = new Date(endDate + 'T23:59:59Z').toISOString().replace('Z', '+00:00');

      const effectiveMode = typeof window !== 'undefined'
        ? (localStorage.getItem('dashboard-view-mode') || dashboardViewMode)
        : dashboardViewMode;

      let payload;
      if (effectiveMode !== 'hourly') {
        const now = new Date();
        const todayYear = now.getUTCFullYear();
        const todayMonth = now.getUTCMonth();
        const todayDate = now.getUTCDate();
        const todayStart = new Date(Date.UTC(todayYear, todayMonth, todayDate, 0, 0, 0, 0));
        const yesterdayEnd = new Date(Date.UTC(todayYear, todayMonth, todayDate - 1, 23, 59, 59, 999));
        const yesterdayStart = new Date(Date.UTC(todayYear, todayMonth, todayDate - 1, 0, 0, 0, 0));

        const networkOpsEndDate = new Date(endDateFormatted) >= todayStart ? yesterdayEnd : new Date(endDateFormatted);
        const networkOpsBeginDate = new Date(beginDate) >= todayStart ? yesterdayStart : new Date(beginDate);

        payload = {
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
          "TimeZone": "Etc/GMT",
          "Granularity": { "type": "period", "period": "P1D" },
          "Intervals": [{ "Begin": networkOpsBeginDate.toISOString(), "End": networkOpsEndDate.toISOString() }],
          "Filters": {
            "partnerId": {
              "Value": [partnerId],
              "Operator": "in"
            }
          }
        };
      } else {
        payload = {
          "Intervals": [{"Begin": beginDate, "End": endDateFormatted}],
          "Filters": {
            "Partner": {
              "Value": [partnerId],
              "Operator": "in"
            }
          },
          "Metrics": ["PricePublisher", "PriceAdvertiser_PublisherSide", "CLICK", "IMPRESSION"],
          "Granularity": {"type": "period", "period": "P1D"},
          "Datasource": "adserver_stats",
          "TimeZone": "Etc/GMT"
        };
      }

      const response = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ayl-auth-token': token
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Process trend data
      const sourceData = Array.isArray(data?.Data) ? data.Data : (Array.isArray(data) ? data : []);
      const normalizedData = dashboardViewMode === 'daily'
        ? sourceData.map((item) => ({
            ...item,
            PriceAdvertiser_PublisherSide: (item.network_operations_price_advertiser || 0) * 1_000_000,
            PricePublisher: (item.network_operations_price_publisher || 0) * 1_000_000,
            IMPRESSION: item.network_operations_impressions ?? 0,
            CLICK: item.network_operations_click ?? item.network_operations_clicks ?? 0
          }))
        : sourceData;

      const processedData = normalizedData.map((item, index, array) => {
        const previousItem = index > 0 ? array[index - 1] : null;
        
        const clicks = item.CLICK || 0;
        const impressions = item.IMPRESSION || 0;
        const ctr = impressions > 0 ? (clicks / impressions * 100) : 0;
        
        const revenue = item.PriceAdvertiser_PublisherSide || 0;
        const publisherCost = item.PricePublisher || 0;
        const margin = revenue - publisherCost;
        
        // Calculate trends
        const revenueTrend = previousItem ? 
          (revenue > (previousItem.PriceAdvertiser_PublisherSide || 0) ? 'up' : 
           revenue < (previousItem.PriceAdvertiser_PublisherSide || 0) ? 'down' : 'same') : 'same';
        
        const revenueChangePercent = previousItem && previousItem.PriceAdvertiser_PublisherSide ? 
          (((revenue - previousItem.PriceAdvertiser_PublisherSide) / previousItem.PriceAdvertiser_PublisherSide) * 100).toFixed(1) : 0;
        
        const clicksTrend = previousItem ? 
          (clicks > (previousItem.CLICK || 0) ? 'up' : 
           clicks < (previousItem.CLICK || 0) ? 'down' : 'same') : 'same';
        
        const clicksChangePercent = previousItem && previousItem.CLICK ? 
          (((clicks - previousItem.CLICK) / previousItem.CLICK) * 100).toFixed(1) : 0;
        
        const impressionsTrend = previousItem ? 
          (impressions > (previousItem.IMPRESSION || 0) ? 'up' : 
           impressions < (previousItem.IMPRESSION || 0) ? 'down' : 'same') : 'same';
        
        const impressionsChangePercent = previousItem && previousItem.IMPRESSION ? 
          (((impressions - previousItem.IMPRESSION) / previousItem.IMPRESSION) * 100).toFixed(1) : 0;
        
        const ctrTrend = previousItem ? 
          (ctr > (previousItem.IMPRESSION > 0 ? (previousItem.CLICK || 0) / previousItem.IMPRESSION * 100 : 0) ? 'up' : 
           ctr < (previousItem.IMPRESSION > 0 ? (previousItem.CLICK || 0) / previousItem.IMPRESSION * 100 : 0) ? 'down' : 'same') : 'same';
        
        // Clean timestamp
        let cleanTimestamp = item.timestamp;
        cleanTimestamp = cleanTimestamp.replace(/\.\d{6}/, '');
        if (!cleanTimestamp.endsWith('Z') && !cleanTimestamp.includes('+')) {
          cleanTimestamp += 'Z';
        }
        
        const date = new Date(cleanTimestamp);
        
        return {
          date: date.toISOString().split('T')[0],
          dateLabel: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          clicks,
          impressions,
          ctr,
          revenue,
          publisherCost,
          margin,
          revenueTrend,
          revenueChangePercent,
          clicksTrend,
          clicksChangePercent,
          impressionsTrend,
          impressionsChangePercent,
          ctrTrend
        };
      });
      
      setTrendData(processedData);
    } catch (error) {
      console.error('Error fetching Trend data:', error);
      setTrendError(error.message);
      setTrendData(null);
    } finally {
      setLoadingTrend(false);
    }
  };

  // Helper function to get date range based on view mode
  const getTrendDateRange = (viewMode) => {
    const endDate = new Date();
    const startDate = new Date();
    
    if (viewMode === 'year') {
      startDate.setDate(startDate.getDate() - 90); // Last 90 days
    } else {
      startDate.setDate(startDate.getDate() - 30); // Last 30 days
    }
    
    return {
      startDateStr: startDate.toISOString().split('T')[0],
      endDateStr: endDate.toISOString().split('T')[0]
    };
  };

  // Adapter for DashboardTemplate card rendering
  const renderDSPCard = (item, { globalIndex, entityId, entityName, startDate, endDate }) => (
    <EntityPerformanceCard
      entityId={entityId}
      entityName={entityName}
      startDate={startDate}
      endDate={endDate}
      revenue={item.PriceAdvertiser_PublisherSide || 0}
      publisherCost={item.PricePublisher || 0}
      margin={(item.PriceAdvertiser_PublisherSide || 0) - (item.PricePublisher || 0)}
      marginPct={
        item.PriceAdvertiser_PublisherSide
          ? (
              (((item.PriceAdvertiser_PublisherSide || 0) - (item.PricePublisher || 0)) /
                item.PriceAdvertiser_PublisherSide) *
              100
            ).toFixed(2)
          : "0.00"
      }
      fetchDailyData={fetchDailyDataForDSP}
      viewMode={dashboardViewMode}
      onClick={(id, name) => {
        const encodedName = encodeURIComponent(name);
        navigate(`/DSPAnalytics?id=${id}&name=${encodedName}`);
      }}
      getDetailUrl={(id, name) => `/DSPAnalytics?id=${id}&name=${encodeURIComponent(name)}`}
      cache={cardDailyCache}
      setCache={setCardDailyCache}
      formatCurrency={formatCurrency}
      formatCurrencyDetailed={formatCurrencyDetailed}
      showImpressionsAndCtr
    />
  );

  // Handle menu item click
  const handleMenuItemClick = async (itemId) => {
    if (selectedFilter === itemId) {
      setIsPanelOpen(false);
      setSelectedFilter(null);
      setBusinessReviewData(null);
      setTrendData(null);
    } else {
      setSelectedFilter(itemId);
      setIsPanelOpen(true);
      
      if (itemId === 'business-review') {
        await fetchBusinessReviewData(getPartnerId());
      } else if (itemId === 'trend') {
        const { startDateStr, endDateStr } = getTrendDateRange(trendViewMode);
        await fetchTrendData(getPartnerId(), startDateStr, endDateStr);
      } else if (['kpi-prog', 'device', 'ad-kind', 'dsp', 'seat', 'ad-domain', 'site-domain', 'geo'].includes(itemId)) {
        await fetchFilterData(itemId);
      }
    }
  };
  
  // Handle panel close
  const handleClosePanel = () => {
    setIsPanelOpen(false);
    setSelectedFilter(null);
    setBusinessReviewData(null);
    setTrendData(null);
  };
  
  // Format numbers for display with spaces every 3 digits
  const formatBidResponses = (value) => {
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
  
  // DSP uses "M" suffix for cards/charts; filter panels use formatCurrencyNoM (no M suffix)
  const formatCurrency = formatCurrencyDetailed;
  
  // Sort logic (matching AnalyticsTemplate)
  const handleSort = (sortConfig, setSortConfig, data, setData, sortKey) => {
    const direction = sortConfig.key === sortKey && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    const sortedData = [...data].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      return 0;
    });
    setSortConfig({ key: sortKey, direction });
    setData(sortedData);
  };
  const handleDeviceSort = (k) => handleSort(deviceSortConfig, setDeviceSortConfig, deviceData, setDeviceData, k);
  const handleDspSort = (k) => handleSort(dspSortConfig, setDspSortConfig, dspData, setDspData, k);
  const handleSeatSort = (k) => handleSort(seatSortConfig, setSeatSortConfig, seatData, setSeatData, k);
  const handleAdDomainSort = (k) => handleSort(adDomainSortConfig, setAdDomainSortConfig, adDomainData, setAdDomainData, k);
  const handleSiteDomainSort = (k) => handleSort(siteDomainSortConfig, setSiteDomainSortConfig, siteDomainData, setSiteDomainData, k);
  const handleGeoSort = (k) => handleSort(geoSortConfig, setGeoSortConfig, geoData, setGeoData, k);
  const handleAdKindSort = (k) => handleSort(adKindSortConfig, setAdKindSortConfig, adKindData, setAdKindData, k);
  const handleKpiProgSort = (k) => handleSort(kpiProgSortConfig, setKpiProgSortConfig, kpiProgData, setKpiProgData, k);
  
  const renderSortableHeader = (label, sortKey, sortConfig, onSort) => {
    const isSorted = sortConfig.key === sortKey;
    const direction = sortConfig.direction;
    return (
      <TableHead className="text-center cursor-pointer hover:bg-slate-100 select-none" onClick={() => onSort(sortKey)}>
        <div className="flex items-center justify-center gap-1">
          <span>{label}</span>
          {isSorted ? (direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <div className="w-3 h-3 opacity-30"><ArrowUp className="w-3 h-3" /></div>}
        </div>
      </TableHead>
    );
  };
  
  // Get period label
  const getPeriodLabel = () => {
    if (viewMode === 'month' && selectedMonth) {
      const date = new Date(selectedMonth + '-01');
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (viewMode === 'year' && selectedYear) {
      return selectedYear;
    }
    return 'All Time';
  };

  // Custom Tooltip component for the chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3">
        <p className="font-semibold text-slate-900 mb-2">{label}</p>
        {payload.map((entry, index) => {
          const value = typeof entry.value === 'number' ? entry.value : parseFloat(entry.value);
          let formattedValue = '';
          let label = entry.name || entry.dataKey || '';
          
          if (entry.dataKey === 'bidRequests' || label === 'Bid Requests') {
            formattedValue = formatBidResponses(value);
            label = 'Bid Requests';
          } else if (entry.dataKey === 'impressions' || label === 'Impressions') {
            formattedValue = formatBidResponses(value);
            label = 'Impressions';
          } else if (entry.dataKey === 'clicks' || label === 'Clicks') {
            formattedValue = formatBidResponses(value);
            label = 'Clicks';
          } else if (entry.dataKey === 'revenue' || label === 'Revenue ($)') {
            formattedValue = formatCurrencyDetailed(value);
            label = 'Revenue ($)';
          } else {
            formattedValue = formatBidResponses(value);
          }
          
          return (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              <span className="font-medium">{label}:</span> {formattedValue}
            </p>
          );
        })}
      </div>
    );
  };

  // Prepare trend chart data
  const prepareTrendChartData = (trendData) => {
    if (!trendData || trendData.length === 0) return [];
    
    return trendData.map(item => ({
      date: item.date,
      dateLabel: item.dateLabel,
      clicks: item.clicks,
      impressions: item.impressions,
      ctr: item.ctr,
      revenue: item.revenue,
      margin: item.margin
    }));
  };

  // Export helpers (matching AnalyticsTemplate)
  const getExportFilename = (baseName) => {
    const date = new Date().toISOString().split('T')[0];
    const partnerId = getPartnerId();
    if (partnerId) return `${baseName}_${partnerId.substring(0, 8)}_${date}.csv`;
    return `${baseName}_${date}.csv`;
  };
  const exportToCsv = (headers, rows, filename) => {
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };
  const exportDeviceDataToCSV = () => {
    if (deviceData.length === 0) return;
    exportToCsv(
      ['Device', 'DSP Revenue', 'Publisher Costs', 'ADY Margin', 'Impressions', 'Click', 'CTR', 'Margin %'],
      deviceData.map((i) => [i.device || 'Unknown', ((i.PriceAdvertiser_PublisherSide || 0) / 1000000).toFixed(2), ((i.PricePublisher || 0) / 1000000).toFixed(2), ((i.margin || 0) / 1000000).toFixed(2), i.impressions || 0, i.clicks || 0, (i.ctr || 0).toFixed(2) + '%', i.marginPercentage || '0.00']),
      getExportFilename('Device_Data')
    );
  };
  const exportDspDataToCSV = () => {
    if (dspData.length === 0) return;
    exportToCsv(
      ['Partner ID', 'Partner Name', 'DSP Revenue', 'Publisher Costs', 'ADY Margin', 'Impressions', 'Click', 'CTR', 'Margin %'],
      dspData.map((i) => [i.partnerId || 'Unknown', i.partnerName || 'Unknown', ((i.PriceAdvertiser_PublisherSide || 0) / 1000000).toFixed(2), ((i.PricePublisher || 0) / 1000000).toFixed(2), ((i.margin || 0) / 1000000).toFixed(2), i.impressions || 0, i.clicks || 0, (i.ctr || 0).toFixed(2) + '%', i.marginPercentage || '0.00']),
      getExportFilename('DSP_Data')
    );
  };
  const exportSeatDataToCSV = () => {
    if (seatData.length === 0) return;
    exportToCsv(
      ['Seat Name', 'Partner Name', 'DSP Revenue', 'Publisher Costs', 'ADY Margin', 'Impressions', 'Click', 'CTR', 'Margin %'],
      seatData.map((i) => [i.seatName || 'Unknown', i.partnerName || 'Unknown', ((i.PriceAdvertiser_PublisherSide || 0) / 1000000).toFixed(2), ((i.PricePublisher || 0) / 1000000).toFixed(2), ((i.margin || 0) / 1000000).toFixed(2), i.impressions || 0, i.clicks || 0, (i.ctr || 0).toFixed(2) + '%', i.marginPercentage || '0.00']),
      getExportFilename('SEAT_Data')
    );
  };
  const exportAdDomainDataToCSV = () => {
    if (adDomainData.length === 0) return;
    exportToCsv(
      ['Ad Domain', 'Partner Name', 'DSP Revenue', 'Publisher Costs', 'ADY Margin', 'Impressions', 'Click', 'CTR', 'Margin %'],
      adDomainData.map((i) => [i.adDomain || 'Unknown', i.partnerName || 'Unknown', ((i.PriceAdvertiser_PublisherSide || 0) / 1000000).toFixed(2), ((i.PricePublisher || 0) / 1000000).toFixed(2), ((i.margin || 0) / 1000000).toFixed(2), i.impressions || 0, i.clicks || 0, (i.ctr || 0).toFixed(2) + '%', i.marginPercentage || '0.00']),
      getExportFilename('AD_Domain_Data')
    );
  };
  const exportSiteDomainDataToCSV = () => {
    if (siteDomainData.length === 0) return;
    exportToCsv(
      ['Site Domain', 'DSP Revenue', 'Publisher Costs', 'ADY Margin', 'Impressions', 'Click', 'CTR', 'Margin %'],
      siteDomainData.map((i) => [(i.siteDomain || i.siteName) || 'Unknown', ((i.PriceAdvertiser_PublisherSide || 0) / 1000000).toFixed(2), ((i.PricePublisher || 0) / 1000000).toFixed(2), ((i.margin || 0) / 1000000).toFixed(2), i.impressions || 0, i.clicks || 0, (i.ctr || 0).toFixed(2) + '%', i.marginPercentage || '0.00']),
      getExportFilename('Site_Domain_Data')
    );
  };
  const exportGeoDataToCSV = () => {
    if (geoData.length === 0) return;
    exportToCsv(
      ['Country', 'DSP Revenue', 'Publisher Costs', 'ADY Margin', 'Impressions', 'Click', 'CTR', 'Margin %'],
      geoData.map((i) => [i.country || 'Unknown', ((i.PriceAdvertiser_PublisherSide || 0) / 1000000).toFixed(2), ((i.PricePublisher || 0) / 1000000).toFixed(2), ((i.margin || 0) / 1000000).toFixed(2), i.impressions || 0, i.clicks || 0, (i.ctr || 0).toFixed(2) + '%', i.marginPercentage || '0.00']),
      getExportFilename('GEO_Data')
    );
  };
  const exportAdKindDataToCSV = () => {
    if (adKindData.length === 0) return;
    // AD KIND uses network_operations: values are already in dollars, no /1M
    exportToCsv(
      ['AD Kind', 'DSP Revenue', 'Publisher Costs', 'ADY Margin', 'Impressions', 'Click', 'CTR', 'Margin %'],
      adKindData.map((i) => [i.adKindDisplay || i.adKind || '', (i.PriceAdvertiser_PublisherSide || 0).toFixed(2), (i.PricePublisher || 0).toFixed(2), (i.margin || 0).toFixed(2), i.impressions || 0, i.clicks || 0, (i.ctr || 0).toFixed(2) + '%', i.marginPercentage || '0.00']),
      getExportFilename('AD_Kind_Data')
    );
  };
  const exportKpiProgDataToCSV = () => {
    if (kpiProgData.length === 0) return;
    // network_operations = valeurs déjà en dollars, pas de /1M
    exportToCsv(
      ['Date', 'DSP Revenue', 'Publisher Costs', 'ADY Margin', 'Margin %'],
      kpiProgData.map((i) => [i.date || 'N/A', (i.PriceAdvertiser_PublisherSide || 0).toFixed(2), (i.PricePublisher || 0).toFixed(2), (i.margin || 0).toFixed(2), Number(i.marginPercentage ?? 0).toFixed(2)]),
      getExportFilename('KPI_PROG')
    );
  };

  // Render panel content - explicit panels matching AnalyticsTemplate
  const renderFilterPanelTable = (loading, data, colSpan, emptyMsg, headerRow, bodyRows) => (
    <div className="p-6 pt-0 bg-white h-full overflow-y-auto">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[rgb(75,99,226)]" />
          <span className="ml-2 text-slate-600">Loading...</span>
        </div>
      ) : (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-0">
            <Table className="text-xs sm:text-sm w-full">
              <TableHeader>
                <TableRow>{headerRow}</TableRow>
              </TableHeader>
              <TableBody>
                {data.length > 0 ? bodyRows : (
                  <TableRow>
                    <TableCell colSpan={colSpan} className="text-center py-8 text-slate-500">{emptyMsg}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
  
  const renderMarginBadge = (item) => {
    const pct = Number(item.marginPercentage ?? 0).toFixed(2);
    return item.marginPercentage > 0 ? (
      <span className="px-2 py-0.5 text-xs font-medium transition-colors rounded-md bg-[rgb(75,99,226)] text-white inline-block">{pct}%</span>
    ) : (
      <Badge variant="destructive">{pct}%</Badge>
    );
  };
  
  const renderPanelContent = () => {
    if (selectedFilter === 'kpi-prog') {
      return renderFilterPanelTable(
        loadingKpiProgData, kpiProgData, 5, 'No KPI PROG data',
        <>
          {renderSortableHeader('Date', 'date', kpiProgSortConfig, handleKpiProgSort)}
          {renderSortableHeader('DSP Revenue', 'PriceAdvertiser_PublisherSide', kpiProgSortConfig, handleKpiProgSort)}
          {renderSortableHeader('Publisher Costs', 'PricePublisher', kpiProgSortConfig, handleKpiProgSort)}
          {renderSortableHeader('ADY Margin', 'margin', kpiProgSortConfig, handleKpiProgSort)}
          {renderSortableHeader('Margin %', 'marginPercentage', kpiProgSortConfig, handleKpiProgSort)}
        </>,
        kpiProgData.map((item, i) => (
          <TableRow key={i}>
            <TableCell className="text-center font-medium">{item.date || 'N/A'}</TableCell>
            <TableCell className="text-center text-green-600">{formatCurrencyRaw(item.PriceAdvertiser_PublisherSide || 0)}</TableCell>
            <TableCell className="text-center text-red-600">{formatCurrencyRaw(item.PricePublisher || 0)}</TableCell>
            <TableCell className="text-center text-black">{formatCurrencyRaw(item.margin)}</TableCell>
            <TableCell className="text-center">{renderMarginBadge(item)}</TableCell>
          </TableRow>
        ))
      );
    }
    if (selectedFilter === 'device') {
      return renderFilterPanelTable(
        loadingDeviceData, deviceData, 8, 'No DEVICE data',
        <>
          {renderSortableHeader('Device', 'device', deviceSortConfig, handleDeviceSort)}
          {renderSortableHeader('DSP Revenue', 'PriceAdvertiser_PublisherSide', deviceSortConfig, handleDeviceSort)}
          {renderSortableHeader('Publisher Costs', 'PricePublisher', deviceSortConfig, handleDeviceSort)}
          {renderSortableHeader('ADY Margin', 'margin', deviceSortConfig, handleDeviceSort)}
          {renderSortableHeader('Impressions', 'impressions', deviceSortConfig, handleDeviceSort)}
          {renderSortableHeader('Click', 'clicks', deviceSortConfig, handleDeviceSort)}
          {renderSortableHeader('CTR', 'ctr', deviceSortConfig, handleDeviceSort)}
          {renderSortableHeader('Margin %', 'marginPercentage', deviceSortConfig, handleDeviceSort)}
        </>,
        deviceData.map((item, i) => (
          <TableRow key={i}>
            <TableCell className="text-center font-medium">{item.device}</TableCell>
            <TableCell className="text-center text-green-600">{formatCurrencyNoM(item.PriceAdvertiser_PublisherSide || 0)}</TableCell>
            <TableCell className="text-center text-red-600">{formatCurrencyNoM(item.PricePublisher || 0)}</TableCell>
            <TableCell className="text-center text-black">{formatCurrencyNoM(item.margin)}</TableCell>
            <TableCell className="text-center">{formatLargeNumber(item.impressions || 0)}</TableCell>
            <TableCell className="text-center">{formatLargeNumber(item.clicks || 0)}</TableCell>
            <TableCell className="text-center">{formatPercentage(item.ctr || 0)}</TableCell>
            <TableCell className="text-center">{renderMarginBadge(item)}</TableCell>
          </TableRow>
        ))
      );
    }
    if (selectedFilter === 'ad-kind') {
      return renderFilterPanelTable(
        loadingAdKindData, adKindData, 8, 'No AD KIND data',
        <>
          {renderSortableHeader('AD Kind', 'adKindDisplay', adKindSortConfig, handleAdKindSort)}
          {renderSortableHeader('DSP Revenue', 'PriceAdvertiser_PublisherSide', adKindSortConfig, handleAdKindSort)}
          {renderSortableHeader('Publisher Costs', 'PricePublisher', adKindSortConfig, handleAdKindSort)}
          {renderSortableHeader('ADY Margin', 'margin', adKindSortConfig, handleAdKindSort)}
          {renderSortableHeader('Impressions', 'impressions', adKindSortConfig, handleAdKindSort)}
          {renderSortableHeader('Click', 'clicks', adKindSortConfig, handleAdKindSort)}
          {renderSortableHeader('CTR', 'ctr', adKindSortConfig, handleAdKindSort)}
          {renderSortableHeader('Margin %', 'marginPercentage', adKindSortConfig, handleAdKindSort)}
        </>,
        adKindData.map((item, i) => (
          <TableRow key={i}>
            <TableCell className="text-center font-medium">{item.adKindDisplay || item.adKind || ''}</TableCell>
            <TableCell className="text-center text-green-600">{formatCurrencyRaw(item.PriceAdvertiser_PublisherSide || 0)}</TableCell>
            <TableCell className="text-center text-red-600">{formatCurrencyRaw(item.PricePublisher || 0)}</TableCell>
            <TableCell className="text-center text-black">{formatCurrencyRaw(item.margin)}</TableCell>
            <TableCell className="text-center">{formatLargeNumber(item.impressions || 0)}</TableCell>
            <TableCell className="text-center">{formatLargeNumber(item.clicks || 0)}</TableCell>
            <TableCell className="text-center">{formatPercentage(item.ctr || 0)}</TableCell>
            <TableCell className="text-center">{renderMarginBadge(item)}</TableCell>
          </TableRow>
        ))
      );
    }
    if (selectedFilter === 'dsp') {
      return renderFilterPanelTable(
        loadingDspData, dspData, 9, 'No DSP data',
        <>
          {renderSortableHeader('Partner ID', 'partnerId', dspSortConfig, handleDspSort)}
          {renderSortableHeader('Partner Name', 'partnerName', dspSortConfig, handleDspSort)}
          {renderSortableHeader('DSP Revenue', 'PriceAdvertiser_PublisherSide', dspSortConfig, handleDspSort)}
          {renderSortableHeader('Publisher Costs', 'PricePublisher', dspSortConfig, handleDspSort)}
          {renderSortableHeader('ADY Margin', 'margin', dspSortConfig, handleDspSort)}
          {renderSortableHeader('Impressions', 'impressions', dspSortConfig, handleDspSort)}
          {renderSortableHeader('Click', 'clicks', dspSortConfig, handleDspSort)}
          {renderSortableHeader('CTR', 'ctr', dspSortConfig, handleDspSort)}
          {renderSortableHeader('Margin %', 'marginPercentage', dspSortConfig, handleDspSort)}
        </>,
        dspData.map((item, i) => (
          <TableRow key={i}>
            <TableCell className="text-center font-medium">{item.partnerId}</TableCell>
            <TableCell className="text-center font-medium">{item.partnerName}</TableCell>
            <TableCell className="text-center text-green-600">{formatCurrencyNoM(item.PriceAdvertiser_PublisherSide || 0)}</TableCell>
            <TableCell className="text-center text-red-600">{formatCurrencyNoM(item.PricePublisher || 0)}</TableCell>
            <TableCell className="text-center text-black">{formatCurrencyNoM(item.margin)}</TableCell>
            <TableCell className="text-center">{formatLargeNumber(item.impressions || 0)}</TableCell>
            <TableCell className="text-center">{formatLargeNumber(item.clicks || 0)}</TableCell>
            <TableCell className="text-center">{formatPercentage(item.ctr || 0)}</TableCell>
            <TableCell className="text-center">{renderMarginBadge(item)}</TableCell>
          </TableRow>
        ))
      );
    }
    if (selectedFilter === 'seat') {
      return renderFilterPanelTable(
        loadingSeatData, seatData, 9, 'No SEAT data',
        <>
          {renderSortableHeader('Seat Name', 'seatName', seatSortConfig, handleSeatSort)}
          {renderSortableHeader('Partner Name', 'partnerName', seatSortConfig, handleSeatSort)}
          {renderSortableHeader('DSP Revenue', 'PriceAdvertiser_PublisherSide', seatSortConfig, handleSeatSort)}
          {renderSortableHeader('Publisher Costs', 'PricePublisher', seatSortConfig, handleSeatSort)}
          {renderSortableHeader('ADY Margin', 'margin', seatSortConfig, handleSeatSort)}
          {renderSortableHeader('Impressions', 'impressions', seatSortConfig, handleSeatSort)}
          {renderSortableHeader('Click', 'clicks', seatSortConfig, handleSeatSort)}
          {renderSortableHeader('CTR', 'ctr', seatSortConfig, handleSeatSort)}
          {renderSortableHeader('Margin %', 'marginPercentage', seatSortConfig, handleSeatSort)}
        </>,
        seatData.map((item, i) => (
          <TableRow key={i}>
            <TableCell className="text-center font-medium">{item.seatName}</TableCell>
            <TableCell className="text-center font-medium">{item.partnerName}</TableCell>
            <TableCell className="text-center text-green-600">{formatCurrencyNoM(item.PriceAdvertiser_PublisherSide || 0)}</TableCell>
            <TableCell className="text-center text-red-600">{formatCurrencyNoM(item.PricePublisher || 0)}</TableCell>
            <TableCell className="text-center text-black">{formatCurrencyNoM(item.margin)}</TableCell>
            <TableCell className="text-center">{formatLargeNumber(item.impressions || 0)}</TableCell>
            <TableCell className="text-center">{formatLargeNumber(item.clicks || 0)}</TableCell>
            <TableCell className="text-center">{formatPercentage(item.ctr || 0)}</TableCell>
            <TableCell className="text-center">{renderMarginBadge(item)}</TableCell>
          </TableRow>
        ))
      );
    }
    if (selectedFilter === 'ad-domain') {
      return renderFilterPanelTable(
        loadingAdDomainData, adDomainData, 9, 'No AD DOMAIN data',
        <>
          {renderSortableHeader('Ad Domain', 'adDomain', adDomainSortConfig, handleAdDomainSort)}
          {renderSortableHeader('Partner Name', 'partnerName', adDomainSortConfig, handleAdDomainSort)}
          {renderSortableHeader('DSP Revenue', 'PriceAdvertiser_PublisherSide', adDomainSortConfig, handleAdDomainSort)}
          {renderSortableHeader('Publisher Costs', 'PricePublisher', adDomainSortConfig, handleAdDomainSort)}
          {renderSortableHeader('ADY Margin', 'margin', adDomainSortConfig, handleAdDomainSort)}
          {renderSortableHeader('Impressions', 'impressions', adDomainSortConfig, handleAdDomainSort)}
          {renderSortableHeader('Click', 'clicks', adDomainSortConfig, handleAdDomainSort)}
          {renderSortableHeader('CTR', 'ctr', adDomainSortConfig, handleAdDomainSort)}
          {renderSortableHeader('Margin %', 'marginPercentage', adDomainSortConfig, handleAdDomainSort)}
        </>,
        adDomainData.map((item, i) => (
          <TableRow key={i}>
            <TableCell className="text-center font-medium">{item.adDomain}</TableCell>
            <TableCell className="text-center font-medium">{item.partnerName}</TableCell>
            <TableCell className="text-center text-green-600">{formatCurrencyNoM(item.PriceAdvertiser_PublisherSide || 0)}</TableCell>
            <TableCell className="text-center text-red-600">{formatCurrencyNoM(item.PricePublisher || 0)}</TableCell>
            <TableCell className="text-center text-black">{formatCurrencyNoM(item.margin)}</TableCell>
            <TableCell className="text-center">{formatLargeNumber(item.impressions || 0)}</TableCell>
            <TableCell className="text-center">{formatLargeNumber(item.clicks || 0)}</TableCell>
            <TableCell className="text-center">{formatPercentage(item.ctr || 0)}</TableCell>
            <TableCell className="text-center">{renderMarginBadge(item)}</TableCell>
          </TableRow>
        ))
      );
    }
    if (selectedFilter === 'site-domain') {
      return renderFilterPanelTable(
        loadingSiteDomainData, siteDomainData, 8, 'No SITE DOMAIN data',
        <>
          {renderSortableHeader('Site Domain', 'siteDomain', siteDomainSortConfig, handleSiteDomainSort)}
          {renderSortableHeader('DSP Revenue', 'PriceAdvertiser_PublisherSide', siteDomainSortConfig, handleSiteDomainSort)}
          {renderSortableHeader('Publisher Costs', 'PricePublisher', siteDomainSortConfig, handleSiteDomainSort)}
          {renderSortableHeader('ADY Margin', 'margin', siteDomainSortConfig, handleSiteDomainSort)}
          {renderSortableHeader('Impressions', 'impressions', siteDomainSortConfig, handleSiteDomainSort)}
          {renderSortableHeader('Click', 'clicks', siteDomainSortConfig, handleSiteDomainSort)}
          {renderSortableHeader('CTR', 'ctr', siteDomainSortConfig, handleSiteDomainSort)}
          {renderSortableHeader('Margin %', 'marginPercentage', siteDomainSortConfig, handleSiteDomainSort)}
        </>,
        siteDomainData.map((item, i) => (
          <TableRow key={i}>
            <TableCell className="text-center font-medium">{item.siteDomain || item.siteName}</TableCell>
            <TableCell className="text-center text-green-600">{formatCurrencyNoM(item.PriceAdvertiser_PublisherSide || 0)}</TableCell>
            <TableCell className="text-center text-red-600">{formatCurrencyNoM(item.PricePublisher || 0)}</TableCell>
            <TableCell className="text-center text-black">{formatCurrencyNoM(item.margin)}</TableCell>
            <TableCell className="text-center">{formatLargeNumber(item.impressions || 0)}</TableCell>
            <TableCell className="text-center">{formatLargeNumber(item.clicks || 0)}</TableCell>
            <TableCell className="text-center">{formatPercentage(item.ctr || 0)}</TableCell>
            <TableCell className="text-center">{renderMarginBadge(item)}</TableCell>
          </TableRow>
        ))
      );
    }
    if (selectedFilter === 'geo') {
      return renderFilterPanelTable(
        loadingGeoData, geoData, 8, 'No GEO data',
        <>
          {renderSortableHeader('Country', 'country', geoSortConfig, handleGeoSort)}
          {renderSortableHeader('DSP Revenue', 'PriceAdvertiser_PublisherSide', geoSortConfig, handleGeoSort)}
          {renderSortableHeader('Publisher Costs', 'PricePublisher', geoSortConfig, handleGeoSort)}
          {renderSortableHeader('ADY Margin', 'margin', geoSortConfig, handleGeoSort)}
          {renderSortableHeader('Impressions', 'impressions', geoSortConfig, handleGeoSort)}
          {renderSortableHeader('Click', 'clicks', geoSortConfig, handleGeoSort)}
          {renderSortableHeader('CTR', 'ctr', geoSortConfig, handleGeoSort)}
          {renderSortableHeader('Margin %', 'marginPercentage', geoSortConfig, handleGeoSort)}
        </>,
        geoData.map((item, i) => (
          <TableRow key={i}>
            <TableCell className="text-center font-medium">{item.country || 'Unknown'}</TableCell>
            <TableCell className="text-center text-green-600">{formatCurrencyNoM(item.PriceAdvertiser_PublisherSide || 0)}</TableCell>
            <TableCell className="text-center text-red-600">{formatCurrencyNoM(item.PricePublisher || 0)}</TableCell>
            <TableCell className="text-center text-black">{formatCurrencyNoM(item.margin)}</TableCell>
            <TableCell className="text-center">{formatLargeNumber(item.impressions || 0)}</TableCell>
            <TableCell className="text-center">{formatLargeNumber(item.clicks || 0)}</TableCell>
            <TableCell className="text-center">{formatPercentage(item.ctr || 0)}</TableCell>
            <TableCell className="text-center">{renderMarginBadge(item)}</TableCell>
          </TableRow>
        ))
      );
    }
    if (selectedFilter === 'trend') {
      return (
        <div className="p-6 pt-0 bg-white h-full overflow-y-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">DSP Trend Analysis</h1>
                <p className="text-sm text-slate-600 mt-1">
                  Performance trends over time
                </p>
              </div>
            </div>
            
            {/* Date Range Selector */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">Period:</span>
                <Select value={trendViewMode} onValueChange={async (value) => {
                  setTrendViewMode(value);
                  // Reload data with new period
                  const partnerId = getPartnerId();
                  const { startDateStr, endDateStr } = getTrendDateRange(value);
                  await fetchTrendData(partnerId, startDateStr, endDateStr);
                }}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Last 30 days</SelectItem>
                    <SelectItem value="year">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {loadingTrend ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[rgb(75,99,226)]" />
              <span className="ml-2 text-slate-600">Loading trend data...</span>
            </div>
          ) : trendError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-medium">Error loading data</p>
              <p className="text-red-600 text-sm mt-1">{trendError}</p>
            </div>
          ) : !trendData || trendData.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>No trend data available.</p>
              <p className="text-sm mt-2">Partner ID: {getPartnerId()}</p>
            </div>
          ) : (
            <>
              {/* Trend Charts */}
              <div className="space-y-6">
                {/* Revenue & Margin Trend */}
                <Card className="border-t-4 border-t-green-500 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
                    <CardTitle className="text-lg text-green-900">Revenue & Margin Trend</CardTitle>
                  </CardHeader>
                  <CardContent className="bg-white">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%" style={{ marginTop: '25px' }}>
                        <LineChart data={prepareTrendChartData(trendData)}>
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
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                            tickFormatter={(value) => formatCurrencyDetailed(value)}
                          />
                          <RechartsTooltip content={<CustomTooltip />} />
                          <Legend />
                          <Line 
                            yAxisId="left"
                            type="monotone" 
                            dataKey="revenue" 
                            stroke="#10B981" 
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 4 }}
                            name="Revenue ($)"
                          />
                          <Line 
                            yAxisId="left"
                            type="monotone" 
                            dataKey="margin" 
                            stroke="#3B82F6" 
                            strokeWidth={3}
                            strokeDasharray="5 5"
                            dot={false}
                            activeDot={{ r: 4 }}
                            name="Margin ($)"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Clicks & Impressions Trend */}
                <Card className="border-t-4 border-t-blue-500 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                    <CardTitle className="text-lg text-blue-900">Clicks & Impressions Trend</CardTitle>
                  </CardHeader>
                  <CardContent className="bg-white">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%" style={{ marginTop: '25px' }}>
                        <LineChart data={prepareTrendChartData(trendData)}>
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
                            tickFormatter={(value) => formatBidResponses(value)}
                          />
                          <RechartsTooltip content={<CustomTooltip />} />
                          <Legend />
                          <Line 
                            yAxisId="left"
                            type="monotone" 
                            dataKey="clicks" 
                            stroke="#EF4444" 
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 4 }}
                            name="Clicks"
                          />
                          <Line 
                            yAxisId="left"
                            type="monotone" 
                            dataKey="impressions" 
                            stroke="#3B82F6" 
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 4 }}
                            name="Impressions"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* CTR Trend */}
                <Card className="border-t-4 border-t-purple-500 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
                    <CardTitle className="text-lg text-purple-900">CTR Trend</CardTitle>
                  </CardHeader>
                  <CardContent className="bg-white">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%" style={{ marginTop: '25px' }}>
                        <LineChart data={prepareTrendChartData(trendData)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="dateLabel" 
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                            angle={-45}
                            textAnchor="end"
                            height={60}
                          />
                          <YAxis 
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                            tickFormatter={(value) => `${value.toFixed(2)}%`}
                          />
                          <RechartsTooltip 
                            formatter={(value) => [`${parseFloat(value).toFixed(2)}%`, 'CTR']}
                            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                          />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="ctr" 
                            stroke="#8B5CF6" 
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 4 }}
                            name="CTR (%)"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Trend Table */}
                <Card className="border-t-4 border-t-slate-500 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50">
                    <CardTitle className="text-lg text-slate-900">Daily Trend Details</CardTitle>
                  </CardHeader>
                  <CardContent className="bg-white">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Clicks</TableHead>
                            <TableHead className="text-right">Impressions</TableHead>
                            <TableHead className="text-right">CTR</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                            <TableHead className="text-right">Margin</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {trendData.slice().reverse().map((item, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">{item.dateLabel}</TableCell>
                              <TableCell className="text-right">{formatBidResponses(item.clicks)}</TableCell>
                              <TableCell className="text-right">{formatBidResponses(item.impressions)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {item.ctrTrend === 'up' && <ArrowUp className="w-3 h-3 text-green-600" />}
                                  {item.ctrTrend === 'down' && <ArrowDown className="w-3 h-3 text-red-600" />}
                                  {item.ctr.toFixed(2)}%
                                </div>
                              </TableCell>
                              <TableCell className="text-right">{formatCurrency(item.revenue)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.margin)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      );
    }
    
    if (selectedFilter === 'business-review') {
      // Get period label
      const getPeriodLabel = () => {
        if (viewMode === 'month' && selectedMonth) {
          const date = new Date(selectedMonth + '-01');
          return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        } else if (viewMode === 'year' && selectedYear) {
          return selectedYear;
        }
        return 'All Time';
      };
      
      return (
        <div className="p-6 pt-0 bg-white h-full overflow-y-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">DSP Performance Dashboard</h1>
                <p className="text-sm text-slate-600 mt-1">
                  Business Review • {getPeriodLabel()}
                </p>
              </div>
              {businessReviewData && (
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
            
            {/* Filters */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">View:</span>
                <Select value={viewMode} onValueChange={(value) => {
                  setViewMode(value);
                  if (value === 'month' && months.length > 0) {
                    setSelectedMonth(months[0]);
                  } else if (value === 'year' && years.length > 0) {
                    setSelectedYear(years[0]);
                  }
                }}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">By Month</SelectItem>
                    <SelectItem value="year">By Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {viewMode === 'month' && (
                <Select value={selectedMonth || ''} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(month => {
                      const date = new Date(month + '-01');
                      return (
                        <SelectItem key={month} value={month}>
                          {date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
              
              {viewMode === 'year' && (
                <Select value={selectedYear || ''} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {loadingBusinessReview ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[rgb(75,99,226)]" />
              <span className="ml-2 text-slate-600">Loading Business Review data...</span>
            </div>
          ) : businessReviewError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-medium">Error loading data</p>
              <p className="text-red-600 text-sm mt-1">{businessReviewError}</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>No Business Review data available for the selected period.</p>
              <p className="text-sm mt-2">Partner ID: {getPartnerId()}</p>
            </div>
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Card className="border-l-4 border-l-amber-500 shadow-md hover:shadow-lg transition-shadow">
                  <CardContent className="p-6 bg-gradient-to-br from-amber-50 to-amber-100/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-amber-700">BID REQUESTS</div>
                      <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-amber-900">{formatBidResponses(kpis.bidRequests)}</div>
                    <div className="text-xs text-amber-600 mt-1">Total requests</div>
                  </CardContent>
                </Card>
                
                <Card className="border-l-4 border-l-blue-500 shadow-md hover:shadow-lg transition-shadow">
                  <CardContent className="p-6 bg-gradient-to-br from-blue-50 to-blue-100/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-blue-700">IMPRESSIONS</div>
                      <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-blue-900">{formatBidResponses(kpis.impressions)}</div>
                    <div className="text-xs text-blue-600 mt-1">Total impressions</div>
                  </CardContent>
                </Card>
                
                <Card className="border-l-4 border-l-red-500 shadow-md hover:shadow-lg transition-shadow">
                  <CardContent className="p-6 bg-gradient-to-br from-red-50 to-red-100/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-red-700">CLICKS</div>
                      <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-red-900">{formatBidResponses(kpis.clicks)}</div>
                    <div className="text-xs text-red-600 mt-1">Total clicks</div>
                  </CardContent>
                </Card>
                
                <Card className="border-l-4 border-l-green-500 shadow-md hover:shadow-lg transition-shadow">
                  <CardContent className="p-6 bg-gradient-to-br from-green-50 to-green-100/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-green-700">REVENUE</div>
                      <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-green-900">{formatCurrency(kpis.revenue)}</div>
                    <div className="text-xs text-green-600 mt-1">Advertiser spend</div>
                  </CardContent>
                </Card>
              </div>

              {/* Daily Performance Trend - full width */}
              <Card className="border-t-4 border-t-blue-500 shadow-lg mb-6">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                  <CardTitle className="text-lg text-blue-900">
                    {viewMode === 'year' ? 'Monthly Performance Trend' : 'Daily Performance'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="bg-white">
                  <div className="h-64">
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
                          tickFormatter={(value) => formatBidResponses(value)}
                        />
                        <YAxis 
                          yAxisId="right"
                          orientation="right"
                          tick={{ fontSize: 12, fill: '#6b7280' }}
                          tickFormatter={(value) => formatCurrencyDetailed(value)}
                        />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Legend />
                        <Line 
                          yAxisId="left"
                          type="monotone" 
                          dataKey="bidRequests" 
                          stroke="#F59E0B" 
                          strokeWidth={3}
                          dot={false}
                          activeDot={false}
                          name="Bid Requests"
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
                          name="Revenue ($)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Impression & Revenue by Ad Type Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Impression by Ad Type */}
                <Card className="border-t-4 border-t-purple-500 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
                    <CardTitle className="text-lg text-purple-900">Impression by Ad Type</CardTitle>
                  </CardHeader>
                  <CardContent className="bg-white">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieChartData}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            label={({ name, percentage }) => {
                              // Only show label if percentage is >= 2% to avoid overlap
                              return parseFloat(percentage) >= 2 ? `${name} ${percentage}%` : '';
                            }}
                            outerRadius={70}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {pieChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            formatter={(value, name, props) => {
                              const percentage = props.payload.percentage || 0;
                              return [`${formatBidResponses(value)} (${percentage}%)`, name];
                            }}
                            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                            labelStyle={{ fontWeight: 'bold' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Revenue by Ad Type */}
                <Card className="border-t-4 border-t-green-500 shadow-lg">
                  <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
                    <CardTitle className="text-lg text-green-900">Revenue by Ad Type</CardTitle>
                  </CardHeader>
                  <CardContent className="bg-white">
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%" style={{ marginTop: '45px' }}>
                        <BarChart data={barChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="name" 
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                            interval={0}
                          />
                          <YAxis 
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                            tickFormatter={(value) => {
                              // Value is in thousands, convert to millions
                              const millions = value / 1000;
                              if (millions >= 1) {
                                return `$${millions.toFixed(2)}M`;
                              }
                              return `$${millions.toFixed(3)}M`;
                            }}
                          />
                          <RechartsTooltip
                            formatter={(value) => {
                              // Convert from thousands to full value and format
                              const fullValue = value * 1000;
                              return [formatCurrencyDetailed(fullValue), 'Revenue'];
                            }}
                            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                          />
                          <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
                            {barChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      );
    }
    return null;
  };

  // Generate payload for top DSPs
  const topDSPPayload = (startDate, endDate) => {
    // Format dates in UTC
    const beginDate = new Date(startDate + 'T00:00:00Z').toISOString().replace('Z', '+00:00');
    const endDateValue = new Date(endDate + 'T23:59:59Z').toISOString().replace('Z', '+00:00');

    return {
      "Intervals": [{"Begin": beginDate, "End": endDateValue}],
      "Operator": "in",
      "OrderBy": "PricePublisher",
      "OrderOp": "DESC",
      "Dimensions": ["Partner"],
      "Size": 500,
      "Metrics": ["PricePublisher", "PriceAdvertiser_PublisherSide", "PartnerName"],
      "Datasource": "adserver_stats",
      "AddTotalRow": true,
      "TimeZone": "Etc/GMT",
      "Granularity": "all"
    };
  };

  // Process top DSPs response
  const processTopDSPsResponse = (data) => {
    const entities = data.Data || [];
    
    const totalEntityRevenue = entities.reduce((sum, item) => sum + (item.PriceAdvertiser_PublisherSide || 0), 0);
    const totalPublisherCosts = entities.reduce((sum, item) => sum + (item.PricePublisher || 0), 0);
    const totalMargin = totalEntityRevenue - totalPublisherCosts;
    const avgMarginPercentage = totalEntityRevenue > 0 ? 
      ((totalMargin / totalEntityRevenue) * 100).toFixed(2) : 0;

    return {
      entities,
      summary: {
        entityRevenue: totalEntityRevenue,
        publisherCosts: totalPublisherCosts,
        margin: totalMargin,
        avgMarginPercentage
      }
    };
  };

  // Get entity ID
  const getDSPId = (item) => item.Partner;

  // Get entity name with fallback
  const getDSPName = (item) => item.Name_Partner || item.PartnerName || item.Partner || 'Unknown DSP';

  // Fetch daily/hourly data for a DSP
  const fetchDailyDataForDSP = async (partnerId, dspName, startDate, endDate) => {
    const token = getToken();
    if (!token) return [];

    try {
      // Determine dashboard view mode (daily or hourly) from localStorage
      let viewMode = 'daily';
      if (typeof window !== 'undefined') {
        viewMode = localStorage.getItem('dashboard-view-mode') || 'daily';
      }

      // Format dates in UTC
      let beginDate;
      let endDateFormatted;

      if (viewMode === 'hourly') {
        // Hourly mode: Yesterday 00:00:00 UTC -> Today 23:59:59 UTC
        const now = new Date();
        const todayYear = now.getUTCFullYear();
        const todayMonth = now.getUTCMonth();
        const todayDate = now.getUTCDate();

        const yesterday = new Date(Date.UTC(todayYear, todayMonth, todayDate - 1, 0, 0, 0, 0));
        const todayEnd = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));

        beginDate = yesterday.toISOString().replace('Z', '+00:00');
        endDateFormatted = todayEnd.toISOString().replace('Z', '+00:00');
      } else {
        // Daily mode: use selected start/end dates from header
        beginDate = new Date(startDate + 'T00:00:00Z').toISOString().replace('Z', '+00:00');
        endDateFormatted = new Date(endDate + 'T23:59:59Z').toISOString().replace('Z', '+00:00');
      }

      const effectiveMode = typeof window !== 'undefined'
        ? (localStorage.getItem('dashboard-view-mode') || viewMode)
        : viewMode;

      let payload;
      if (effectiveMode === 'daily') {
        const now = new Date();
        const todayYear = now.getUTCFullYear();
        const todayMonth = now.getUTCMonth();
        const todayDate = now.getUTCDate();
        const todayStart = new Date(Date.UTC(todayYear, todayMonth, todayDate, 0, 0, 0, 0));
        const yesterdayEnd = new Date(Date.UTC(todayYear, todayMonth, todayDate - 1, 23, 59, 59, 999));
        const yesterdayStart = new Date(Date.UTC(todayYear, todayMonth, todayDate - 1, 0, 0, 0, 0));

        const networkOpsEndDate = new Date(endDateFormatted) >= todayStart ? yesterdayEnd : new Date(endDateFormatted);
        const networkOpsBeginDate = new Date(beginDate) >= todayStart ? yesterdayStart : new Date(beginDate);

        payload = {
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
          "TimeZone": "Etc/GMT",
          "Granularity": { "type": "period", "period": "P1D" },
          "Intervals": [{ "Begin": networkOpsBeginDate.toISOString(), "End": networkOpsEndDate.toISOString() }],
          "Filters": {
            "partnerId": {
              "Value": [partnerId],
              "Operator": "in"
            }
          }
        };
      } else {
        payload = {
          "Intervals": [{"Begin": beginDate, "End": endDateFormatted}],
          "Filters": {
            "Partner": {
              "Value": [partnerId],
              "Operator": "in"
            }
          },
          "Metrics": ["PricePublisher", "PriceAdvertiser_PublisherSide", "CLICK", "IMPRESSION"],
          "Granularity": {
            "type": "period",
            "period": "PT1H"
          },
          "Datasource": "adserver_stats",
          "TimeZone": "Etc/GMT"
        };
      }

      const response = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ayl-auth-token': token
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const rawData = data.Data || data;
      
      // Process time-series data
      if (effectiveMode === 'hourly') {
        // Filter and sort data
        const filteredData = rawData.filter(item => 
          item.PricePublisher !== undefined || item.PriceAdvertiser_PublisherSide !== undefined
        );
        const sortedData = filteredData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Group data by day (using UTC+0 timezone)
        const dataByDay = {};
        sortedData.forEach((item) => {
          let cleanTimestamp = item.timestamp;
          if (typeof cleanTimestamp === 'string') {
            cleanTimestamp = cleanTimestamp.replace(/\.\d{6}/, '');
            if (!cleanTimestamp.endsWith('Z') && !cleanTimestamp.includes('+')) {
              cleanTimestamp += 'Z';
            }
          }
          
          const date = new Date(cleanTimestamp);
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
        
        // Create comparison rows: Today vs Yesterday hour by hour
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
        
        todayData.forEach(todayItem => {
          const yesterdayItem = yesterdayMap[todayItem.hour];
          const clicks = todayItem.CLICK ?? todayItem.Click ?? 0;
          const impressions = todayItem.IMPRESSION ?? todayItem.Impression ?? 0;
          const ctr = impressions ? (clicks / impressions) * 100 : 0;
          const visibleImpressions = todayItem.network_operations_visible_impressions ?? 0;
          const viewabilityRate = typeof todayItem.network_operations_viewability_rate === 'number'
            ? todayItem.network_operations_viewability_rate * 100
            : 0;

          const yesterdayClicks = yesterdayItem ? (yesterdayItem.CLICK ?? yesterdayItem.Click ?? 0) : 0;
          const yesterdayImpressions = yesterdayItem ? (yesterdayItem.IMPRESSION ?? yesterdayItem.Impression ?? 0) : 0;
          const yesterdayCtr = yesterdayImpressions ? (yesterdayClicks / yesterdayImpressions) * 100 : 0;
          const yesterdayVisibleImpressions = yesterdayItem?.network_operations_visible_impressions ?? 0;
          const yesterdayViewabilityRate = typeof yesterdayItem?.network_operations_viewability_rate === 'number'
            ? yesterdayItem.network_operations_viewability_rate * 100
            : 0;
          
          // Format label with hour
          const label = todayItem.cleanDate.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          });
          
          processedData.push({
            day: label,
            entityRevenue: todayItem.PriceAdvertiser_PublisherSide || 0,
            publisherCost: todayItem.PricePublisher || 0,
            margin: (todayItem.PriceAdvertiser_PublisherSide || 0) - (todayItem.PricePublisher || 0),
            click: clicks,
            impression: impressions,
            visibleImpressions,
            viewabilityRate,
            ctr,
            // Include yesterday data for comparison
            yesterdayData: yesterdayItem ? {
              entityRevenue: yesterdayItem.PriceAdvertiser_PublisherSide || 0,
              publisherCost: yesterdayItem.PricePublisher || 0,
              margin: (yesterdayItem.PriceAdvertiser_PublisherSide || 0) - (yesterdayItem.PricePublisher || 0),
              click: yesterdayClicks,
              impression: yesterdayImpressions,
              visibleImpressions: yesterdayVisibleImpressions,
              viewabilityRate: yesterdayViewabilityRate,
              ctr: yesterdayCtr
            } : null,
            hour: todayItem.hour
          });
        });
        
        return processedData;
      } else {
        // Daily mode: process with trends compared to previous day
        const normalized = rawData.map((item) => ({
          ...item,
          PriceAdvertiser_PublisherSide: (item.network_operations_price_advertiser || 0) * 1_000_000,
          PricePublisher: (item.network_operations_price_publisher || 0) * 1_000_000,
          CLICK: item.network_operations_click ?? item.network_operations_clicks ?? item.CLICK ?? 0,
          IMPRESSION: item.network_operations_impressions ?? item.IMPRESSION ?? 0,
          VISIBLE_IMPRESSION: item.network_operations_visible_impressions ?? item.VISIBLE_IMPRESSION ?? 0,
          VIEWABILITY_RATE: item.network_operations_viewability_rate ?? item.VIEWABILITY_RATE ?? 0
        }));

        return normalized.map((item, index, array) => {
          const previousItem = index > 0 ? array[index - 1] : null;
          
          const revenueTrend = previousItem ? 
            (item.PriceAdvertiser_PublisherSide > previousItem.PriceAdvertiser_PublisherSide ? 'up' : 
             item.PriceAdvertiser_PublisherSide < previousItem.PriceAdvertiser_PublisherSide ? 'down' : 'same') : 'same';
          
          const revenueChangePercent = previousItem ? 
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
          
          // Clean timestamp
          let cleanTimestamp = item.timestamp;
          cleanTimestamp = cleanTimestamp.replace(/\.\d{6}/, '');
          if (!cleanTimestamp.endsWith('Z') && !cleanTimestamp.includes('+')) {
            cleanTimestamp += 'Z';
          }
          
          const date = new Date(cleanTimestamp);
          
          const clicks = item.CLICK ?? item.Click ?? 0;
          const impressions = item.IMPRESSION ?? item.Impression ?? 0;
          const visibleImpressions = item.VISIBLE_IMPRESSION ?? item.VisibleImpression ?? item.visibleImpressions ?? 0;
          const viewabilityRate = typeof item.VIEWABILITY_RATE === 'number' ? item.VIEWABILITY_RATE * 100 : 0;
          const ctr = impressions ? (clicks / impressions) * 100 : 0;

          return {
            day: date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            entityRevenue: item.PriceAdvertiser_PublisherSide,
            publisherCost: item.PricePublisher,
            margin: item.PriceAdvertiser_PublisherSide - item.PricePublisher,
            revenueTrend,
            revenueChangePercent,
            publisherCostsTrend,
            publisherCostsChangePercent,
            marginTrend,
            marginChangePercent,
            click: clicks,
            impression: impressions,
            visibleImpressions,
            viewabilityRate,
            ctr
          };
        });
      }
    } catch (error) {
      console.error('Error fetching daily data for DSP:', partnerId, error);
      return [];
    }
  };

  return (
    <div className="relative">
      <div className="pr-10 lg:pr-10">
        <DashboardTemplate
          title=""
          searchPlaceholder="Search DSPs..."
          entityNameSingular="DSP"
          entityNamePlural="DSPs"
          apiEndpoint={API_ENDPOINTS.DRUID_SEARCH}
          topEntitiesPayload={topDSPPayload}
          processTopEntitiesResponse={processTopDSPsResponse}
          getEntityId={getDSPId}
          getEntityName={getDSPName}
          fetchDailyDataForEntity={fetchDailyDataForDSP}
          analyticsPagePath="/DSPAnalytics"
          getAuthToken={getToken}
          hideSummaryMetrics
          cardLayout
          pageSize={12}
          renderEntityCard={renderDSPCard}
        />
      </div>
      
      {/* Right-hand menu */}
      <AnalyticsFilterMenu
        partnerId={getPartnerId()}
        menuItems={menuItems}
        selectedFilter={selectedFilter}
        isPanelOpen={isPanelOpen}
        onMenuItemClick={handleMenuItemClick}
        onClosePanel={handleClosePanel}
        panelContent={renderPanelContent()}
        headerActions={
          <>
            {selectedFilter === 'kpi-prog' && kpiProgData.length > 0 && (
              <Button onClick={exportKpiProgDataToCSV} variant="outline" size="sm" className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            )}
            {selectedFilter === 'device' && deviceData.length > 0 && (
              <Button onClick={exportDeviceDataToCSV} variant="outline" size="sm" className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            )}
            {selectedFilter === 'ad-kind' && adKindData.length > 0 && (
              <Button onClick={exportAdKindDataToCSV} variant="outline" size="sm" className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            )}
            {selectedFilter === 'dsp' && dspData.length > 0 && (
              <Button onClick={exportDspDataToCSV} variant="outline" size="sm" className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            )}
            {selectedFilter === 'seat' && seatData.length > 0 && (
              <Button onClick={exportSeatDataToCSV} variant="outline" size="sm" className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            )}
            {selectedFilter === 'ad-domain' && adDomainData.length > 0 && (
              <Button onClick={exportAdDomainDataToCSV} variant="outline" size="sm" className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            )}
            {selectedFilter === 'site-domain' && siteDomainData.length > 0 && (
              <Button onClick={exportSiteDomainDataToCSV} variant="outline" size="sm" className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
            )}
            {selectedFilter === 'geo' && geoData.length > 0 && (
              <Button onClick={exportGeoDataToCSV} variant="outline" size="sm" className="flex items-center gap-2">
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

