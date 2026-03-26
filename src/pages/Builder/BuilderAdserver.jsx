import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, CalendarDays, BarChart3, Layers, Filter, Plus, X, Loader2, ExternalLink, Copy, ChevronDown, Check, Download, ArrowUp, ArrowDown, ArrowUpDown, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { authService } from '@/services/authService';
import { API_ENDPOINTS } from '@/config/api';

const DEFAULT_ENDPOINT = API_ENDPOINTS.DRUID_SEARCH;
const TIME_ZONE = 'Etc/GMT';
const STORAGE_KEY = 'builder:adserver-config';

// Metric options with permissions (ADMIN, SUPER ADMIN)
// Organized by categories based on adserver_stats datasource reference
const METRIC_OPTIONS = [
  // Identity & Label Metrics (Display category)
  { label: 'Creative Name', value: 'CreativeName', category: 'Display' },
  { label: 'Deal Name', value: 'DealName', category: 'Display' },
  { label: 'Placement Name', value: 'PlacementName', category: 'Display' },
  { label: 'Partner Name', value: 'PartnerName', category: 'Display' },
  { label: 'Placement Match', value: 'PlacementMatch', category: 'Display' },
  { label: 'Placement Match Browser', value: 'PlacementMatchBrowser', category: 'Display' },
  // Delivery & Inventory Metrics
  { label: 'Insertion', value: 'Insertion', category: 'Delivery' },
  { label: 'Impression', value: 'Impression', category: 'Delivery' },
  { label: 'Display Impression', value: 'DisplayImpression', category: 'Delivery' },
  { label: 'Impression Banner', value: 'ImpressionBanner', category: 'Delivery' },
  { label: 'Impression Video', value: 'ImpressionVideo', category: 'Delivery' },
  { label: 'Impression Native Video', value: 'ImpressionNativeVideo', category: 'Delivery' },
  { label: 'Inventory', value: 'Inventory', category: 'Delivery' },
  { label: 'Inventory Passback', value: 'InventoryPassback', category: 'Delivery' },
  { label: 'Visible Impression', value: 'VisibleImpression', category: 'Delivery' },
  { label: 'Visible Insertion', value: 'VisibleInsertion', category: 'Delivery' },
  { label: 'Native Display Visible Impression', value: 'NativeDisplayVisibleImpression', category: 'Delivery' },
  { label: 'Inview Opened', value: 'InviewOpened', category: 'Delivery' },
  { label: 'Unique Visitors', value: 'UniqueVisitors', category: 'Delivery' },
  // Engagement & Interaction Metrics
  { label: 'Click', value: 'Click', permission: 'ADMIN', category: 'Interactions' },
  { label: 'Redirection', value: 'Redirection', category: 'Interactions' },
  // Video & Native Metrics
  { label: 'Complete Video Rate', value: 'CompleteVideoRate', category: 'Delivery' },
  { label: 'Video Click', value: 'VideoClick', category: 'Interactions' },
  { label: 'VTR', value: 'Vtr', category: 'Delivery' },
  { label: 'Native CTR', value: 'NativeCtr', category: 'Delivery' },
  { label: 'Native CTR Impression', value: 'NativeCtrImpression', category: 'Delivery' },
  { label: 'Native Advertiser eCPA', value: 'NativeAdvertiserEcpa', permission: 'SUPER ADMIN', category: 'Financial' },
  { label: 'Native Advertiser eCPC', value: 'NativeAdvertiserEcpc', permission: 'SUPER ADMIN', category: 'Financial' },
  { label: 'Native Advertiser Avg eCPM', value: 'NativeAdvertiserAvgEcpm', permission: 'SUPER ADMIN', category: 'Financial' },
  { label: 'Native Advertiser Display eCPM', value: 'NativeAdvertiserDisplayEcpm', permission: 'SUPER ADMIN', category: 'Financial' },
  { label: 'Native Advertiser Video eCPM', value: 'NativeAdvertiserVideoEcpm', permission: 'SUPER ADMIN', category: 'Financial' },
  { label: 'Native Advertiser Avg eCPM Publisher Side', value: 'NativeAdvertiserAvgEcpmPublisherSide', permission: 'SUPER ADMIN', category: 'Financial' },
  { label: 'Native Advertiser Display eCPM Publisher Side', value: 'NativeAdvertiserDisplayEcpmPublisherSide', permission: 'SUPER ADMIN', category: 'Financial' },
  { label: 'Native Advertiser Video eCPM Publisher Side', value: 'NativeAdvertiserVideoEcpmPublisherSide', permission: 'SUPER ADMIN', category: 'Financial' },
  { label: 'Native Advertiser eCPV', value: 'NativeAdvertiserEcpv', permission: 'SUPER ADMIN', category: 'Financial' },
  { label: 'Native Advertiser Visible Avg eCPM', value: 'NativeAdvertiserVisibleAvgEcpm', permission: 'SUPER ADMIN', category: 'Financial' },
  { label: 'Native Advertiser Visible Display eCPM', value: 'NativeAdvertiserVisibleDisplayEcpm', permission: 'SUPER ADMIN', category: 'Financial' },
  { label: 'Native Advertiser Visible Avg eCPM Publisher Side', value: 'NativeAdvertiserVisibleAvgEcpmPublisherSide', permission: 'SUPER ADMIN', category: 'Financial' },
  { label: 'Native Advertiser Visible Display eCPM Publisher Side', value: 'NativeAdvertiserVisibleDisplayEcpmPublisherSide', permission: 'SUPER ADMIN', category: 'Financial' },
  { label: 'Native Publisher eCPC', value: 'NativePublisherEcpc', category: 'Financial' },
  { label: 'Native Publisher Avg eCPM', value: 'NativePublisherAvgEcpm', category: 'Financial' },
  { label: 'Native Publisher Display eCPM', value: 'NativePublisherDisplayEcpm', category: 'Financial' },
  { label: 'Native Publisher Video eCPM', value: 'NativePublisherVideoEcpm', category: 'Financial' },
  { label: 'Native Publisher Visible Avg eCPM', value: 'NativePublisherVisibleAvgEcpm', category: 'Financial' },
  { label: 'Native Publisher Visible Display eCPM', value: 'NativePublisherVisibleDisplayEcpm', category: 'Financial' },
  // Financial Metrics
  { label: 'Price Publisher', value: 'PricePublisher', category: 'Financial' },
  { label: 'Price Publisher Display', value: 'PricePublisherDisplay', category: 'Financial' },
  { label: 'Price Publisher Video', value: 'PricePublisherVideo', category: 'Financial' },
  { label: 'Price Publisher Native Display', value: 'PricePublisherNativeDisplay', category: 'Financial' },
  { label: 'Price Publisher Advertiser Side', value: 'PricePublisherAdvertiserSide', permission: 'SUPER ADMIN', category: 'Financial' },
  { label: 'Price Advertiser', value: 'PriceAdvertiser', permission: 'SUPER ADMIN', category: 'Financial' },
  { label: 'Price Advertiser Display', value: 'PriceAdvertiserDisplay', permission: 'SUPER ADMIN', category: 'Financial' },
  { label: 'Price Advertiser Video', value: 'PriceAdvertiserVideo', permission: 'SUPER ADMIN', category: 'Financial' },
  { label: 'Price Advertiser Publisher Side', value: 'PriceAdvertiserPublisherSide', permission: 'SUPER ADMIN', category: 'Financial' },
  { label: 'Price Advertiser Native Display', value: 'PriceAdvertiserNativeDisplay', permission: 'SUPER ADMIN', category: 'Financial' },
  { label: 'Price Advertiser Native Video', value: 'PriceAdvertiserNativeVideo', permission: 'SUPER ADMIN', category: 'Financial' },
  { label: 'Margin', value: 'Margin', permission: 'SUPER ADMIN', category: 'Financial' },
  { label: 'Margin Percentage', value: 'MarginPercentage', permission: 'SUPER ADMIN', category: 'Financial' },
  // Viewability, KPI & Misc Metrics
  { label: 'Fill Rate', value: 'FillRate', category: 'Delivery' },
  { label: 'KPI', value: 'Kpi', category: 'Delivery' },
  { label: 'Viewability Rate', value: 'ViewabilityRate', category: 'Delivery' },
  { label: 'Visible CTR', value: 'VisibleCtr', category: 'Delivery' },
  { label: 'Visible CTR Impression', value: 'VisibleCtrImpression', category: 'Delivery' },
];

const DIMENSION_OPTIONS = [
  { label: 'Site', value: 'Site' },
  { label: 'Site Domain', value: 'SiteDomain' },
  { label: 'Placement', value: 'Placement' },
  { label: 'Publisher', value: 'Publisher' },
  { label: 'Realm Publisher', value: 'RealmPublisher' },
  { label: 'Device', value: 'Device' },
  { label: 'Country', value: 'Country' },
  { label: 'Ad Domains', value: 'AdDomains' },
  { label: 'DSP', value: 'Partner' },
];

const FILTER_FIELDS = [
  { label: 'Realm', value: 'RealmPublisher' },
  { label: 'Company', value: 'Publisher' },
  { label: 'Site', value: 'Site' },
  { label: 'Placement', value: 'Placement' },
];

// Map UI field names to API field names for adserver_stats payload
const FILTER_FIELD_API_MAP = {
  'RealmPublisher': 'RealmPublisher',
  'Publisher': 'Publisher',
  'Site': 'Site',
  'Placement': 'Placement',
};

const DEFAULT_CONFIG = {
  // Default metrics: select metrics without permissions (accessible to all users)
  metrics: METRIC_OPTIONS.filter(m => !m.permission).slice(0, 5),
  dimensions: DIMENSION_OPTIONS.slice(0, 1),
  filters: [],
  granularity: 'all', // 'all' for aggregated data, 'hours' for hourly, 'days' for daily
};

function safeStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
}

function formatInputValue(date) {
  // Format as YYYY-MM-DD for date input (no time displayed)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTimeZoneOffsetMinutes(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  const map = {};
  parts.forEach(({ type, value }) => {
    if (type !== 'literal') {
      map[type] = value;
    }
  });
  const zonedTime = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  const offsetMinutes = (zonedTime - date.getTime()) / 60000;
  return offsetMinutes;
}

function formatDateForApi(date, timeZone = TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const map = {};
  parts.forEach(({ type, value }) => {
    if (type !== 'literal') {
      map[type] = value;
    }
  });

  // For Etc/GMT, the offset is always +00:00
  let offset = '+00:00';
  if (timeZone !== 'Etc/GMT') {
    const offsetMinutes = getTimeZoneOffsetMinutes(date, timeZone);
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const abs = Math.abs(Math.round(offsetMinutes)); // Round to avoid decimal issues
    const hours = String(Math.floor(abs / 60)).padStart(2, '0');
    const minutes = String(abs % 60).padStart(2, '0');
    offset = `${sign}${hours}:${minutes}`;
  }

  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}.000${offset}`;
}

function clampDate(date, min, max) {
  if (date < min) return new Date(min);
  if (date > max) return new Date(max);
  return date;
}

function computeRows(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.Data)) return response.Data;
  if (Array.isArray(response.Result)) return response.Result;
  if (Array.isArray(response.results)) return response.results;
  if (response.Totals && typeof response.Totals === 'object') return [response.Totals];
  return [];
}

function computeColumns(rows) {
  const columns = new Set();
  rows.forEach((row) => {
    if (row && typeof row === 'object') {
      Object.keys(row).forEach((key) => columns.add(key));
    }
  });
  return Array.from(columns);
}

function formatValue(value, columnName = '', granularity = 'hours') {
  if (value === null || value === undefined) return '—';
  
  // Check if this looks like a timestamp value and format it
  // This handles timestamps regardless of column name
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
    return formatTimestamp(value, granularity);
  }
  
  if (typeof value === 'number') {
    // Handle MARGIN_PERCENTAGE - format as percentage
    if (columnName && (columnName === 'MARGIN_PERCENTAGE' || columnName === 'MarginPercentage')) {
      return `${value.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2
      })}%`;
    }
    
    // Handle MARGIN - divide by 1,000,000 to convert to dollars
    if (columnName && (columnName === 'MARGIN' || columnName === 'Margin')) {
      const dollarValue = value / 1000000;
      return dollarValue.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2,
        style: 'currency',
        currency: 'USD'
      });
    }
    
    // Check if this is a Price or eCPM column - divide by 1,000,000 to convert to dollars
    // Handle formats: Price*, PRICE_*, price* (case insensitive)
    const columnNameLower = columnName ? columnName.toLowerCase() : '';
    const isPriceColumn = columnName && (
      columnName.startsWith('Price') || 
      columnName.startsWith('PRICE_') || 
      columnNameLower.startsWith('price')
    );
    const isEcpmColumn = columnNameLower.includes('ecpm');
    
    if (isPriceColumn || isEcpmColumn) {
      const dollarValue = value / 1000000;
      return dollarValue.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2,
        style: 'currency',
        currency: 'USD'
      });
    }
    
    if (Number.isInteger(value)) return value.toLocaleString('en-US');
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
  if (typeof value === 'object') return safeStringify(value);
  return String(value);
}

// Format timestamp based on granularity
function formatTimestamp(value, granularity) {
  if (value === null || value === undefined) return '—';
  
  let date;
  
  // Handle different input types
  if (typeof value === 'string') {
    // Handle format: 2025-11-03T00:00:00.000000.000+00:00
    // Extract date (YYYY-MM-DD), time (HH:MM:SS), and timezone
    const dateTimeMatch = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
    const timezoneMatch = value.match(/([\+\-]\d{2}:\d{2}|Z)$/);
    
    if (dateTimeMatch) {
      const datePart = dateTimeMatch[1]; // 2025-11-03
      const timePart = dateTimeMatch[2]; // 00:00:00
      let tzPart = timezoneMatch ? timezoneMatch[1] : 'Z';
      
      // Normalize timezone: if it's Z or +00:00, use Z (UTC)
      if (tzPart === '+00:00') {
        tzPart = 'Z';
      }
      
      // Construct clean ISO string: 2025-11-03T00:00:00Z
      const cleanISO = `${datePart}T${timePart}${tzPart}`;
      date = new Date(cleanISO);
    } else {
      // Fallback: try to parse as-is after cleaning
      let cleaned = value.trim();
      // Remove all decimal parts (microseconds) - handle multiple .digits patterns
      cleaned = cleaned.replace(/\.\d+/g, '');
      // Ensure we have a timezone
      if (!cleaned.match(/[\+\-]\d{2}:\d{2}$/) && !cleaned.endsWith('Z')) {
        cleaned += 'Z';
      }
      date = new Date(cleaned);
    }
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'number') {
    // Assume it's a Unix timestamp in milliseconds
    date = new Date(value);
  } else {
    // Not a recognizable format, return as string
    return String(value);
  }
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    // If still can't parse, return the original value
    console.warn('Unable to parse timestamp:', value);
    return String(value);
  }
  
  // Format based on granularity
  if (granularity === 'days') {
    // Format as YYYY-MM-DD
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } else {
    // Format as YYYY-MM-DD HH:MM:SS (hours granularity)
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
}

function useBuilderState() {
  const [state, setState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_CONFIG;
    try {
      const parsed = JSON.parse(stored);
      return {
        metrics: Array.isArray(parsed.metrics) ? parsed.metrics : DEFAULT_CONFIG.metrics,
        dimensions: Array.isArray(parsed.dimensions) ? parsed.dimensions : DEFAULT_CONFIG.dimensions,
        filters: Array.isArray(parsed.filters) ? parsed.filters : DEFAULT_CONFIG.filters,
        granularity: parsed.granularity || DEFAULT_CONFIG.granularity,
      };
    } catch (error) {
      console.warn('Failed to parse stored builder state, using defaults', error);
      return DEFAULT_CONFIG;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  return [state, setState];
}

export default function BuilderAdserver() {
  const navigate = useNavigate();
  const [state, setState] = useBuilderState();
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [metricDialogOpen, setMetricDialogOpen] = useState(false);
  const [dimensionDialogOpen, setDimensionDialogOpen] = useState(false);
  const [resultsTab, setResultsTab] = useState('table');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rawResponse, setRawResponse] = useState(null);
  const [rows, setRows] = useState([]);
  const [userRank, setUserRank] = useState(null);
  const [isPowerUser, setIsPowerUser] = useState(false);
  const [sortColumn, setSortColumn] = useState(null); // Column name to sort by
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
  const [tableSearchTerm, setTableSearchTerm] = useState(''); // Search term for table filtering

  // Fetch user data for permissions
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const sessionData = await authService.getSessionData();
        if (sessionData?.CurrentUser) {
          setUserRank(sessionData.CurrentUser.Rank);
          setIsPowerUser(sessionData.CurrentUser.PowerUser === true);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };
    fetchUserData();
  }, []);

  // Filter metrics based on user permissions to remove unauthorized metrics
  useEffect(() => {
    if (userRank !== null) {
      const rankIsSuperadmin = typeof userRank === 'string' && userRank.toUpperCase() === 'SUPERADMIN';
      const rankIsAdmin = typeof userRank === 'string' && (userRank.toUpperCase() === 'ADMIN' || rankIsSuperadmin);
      
      const authorizedMetrics = state.metrics.filter(metric => {
        const metricOption = METRIC_OPTIONS.find(m => m.value === metric.value);
        if (!metricOption) return false; // Remove if metric not found in options
        if (!metricOption.permission) return true; // No permission required
        if (metricOption.permission === 'SUPER ADMIN') return rankIsSuperadmin;
        if (metricOption.permission === 'ADMIN') return rankIsAdmin || rankIsSuperadmin;
        return true;
      });

      // Only update if metrics were filtered out
      if (authorizedMetrics.length !== state.metrics.length) {
        setState((prev) => ({ ...prev, metrics: authorizedMetrics }));
      }
    }
  }, [userRank]); // eslint-disable-line react-hooks/exhaustive-deps

  const endLimit = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1); // tomorrow
    date.setHours(23, 59, 59, 999);
    return date;
  }, []);

  const minStart = useMemo(() => {
    const date = new Date(endLimit);
    date.setMonth(date.getMonth() - 1);
    date.setHours(0, 0, 0, 0);
    return date;
  }, [endLimit]);

  const columns = useMemo(() => {
    const allColumns = computeColumns(rows);
    // When granularity is 'all', exclude timestamp column (aggregated data has no timestamp)
    if (state.granularity === 'all') {
      return allColumns.filter(col => col.toLowerCase() !== 'timestamp');
    }
    // Always put timestamp column first if it exists
    const timestampIndex = allColumns.findIndex(col => col.toLowerCase() === 'timestamp');
    if (timestampIndex >= 0) {
      // If timestamp is not already first, move it to first position
      if (timestampIndex !== 0) {
        const timestampCol = allColumns[timestampIndex];
        return [timestampCol, ...allColumns.filter(col => col.toLowerCase() !== 'timestamp')];
      }
      // If timestamp is already first, return as is
      return allColumns;
    }
    return allColumns;
  }, [rows, state.granularity]);

  // Sort rows based on sortColumn and sortDirection
  const sortedRows = useMemo(() => {
    if (!sortColumn || rows.length === 0) return rows;
    
    return [...rows].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];
      
      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      
      // Convert to numbers if both are numeric strings or numbers
      const aNum = typeof aValue === 'number' ? aValue : (typeof aValue === 'string' && !isNaN(aValue) && !isNaN(parseFloat(aValue))) ? parseFloat(aValue) : null;
      const bNum = typeof bValue === 'number' ? bValue : (typeof bValue === 'string' && !isNaN(bValue) && !isNaN(parseFloat(bValue))) ? parseFloat(bValue) : null;
      
      // Compare as numbers if both are numeric
      if (aNum != null && bNum != null) {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }
      
      // Compare as strings
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      if (sortDirection === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
  }, [rows, sortColumn, sortDirection]);

  // Filter sorted rows based on search term
  const filteredRows = useMemo(() => {
    if (!tableSearchTerm.trim()) return sortedRows;
    
    const searchLower = tableSearchTerm.toLowerCase();
    return sortedRows.filter(row => {
      // Search across all column values
      return columns.some(column => {
        const value = row[column];
        if (value == null) return false;
        return String(value).toLowerCase().includes(searchLower);
      });
    });
  }, [sortedRows, tableSearchTerm, columns]);

  // Handle column header click for sorting
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, start with ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Export functions - use filteredRows for exports
  const exportToCSV = () => {
    const rowsToExport = tableSearchTerm ? filteredRows : sortedRows;
    if (rowsToExport.length === 0 || columns.length === 0) return;

    // Create CSV header
    const csvHeader = columns.join(',');
    
    // Create CSV rows
    const csvRows = rowsToExport.map(row => {
      return columns.map(column => {
        const value = row?.[column];
        // Escape quotes and wrap in quotes if contains comma, newline, or quote
        if (value == null) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',');
    });

    // Combine header and rows
    const csvContent = [csvHeader, ...csvRows].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `builder-adserver-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToXML = () => {
    const rowsToExport = tableSearchTerm ? filteredRows : sortedRows;
    if (rowsToExport.length === 0 || columns.length === 0) return;

    // Create XML structure
    let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xmlContent += '<results>\n';
    
    rowsToExport.forEach((row, index) => {
      xmlContent += `  <row id="${index + 1}">\n`;
      columns.forEach(column => {
        const value = row?.[column];
        const escapedValue = value != null ? String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;') : '';
        // Convert column name to valid XML tag name (replace invalid characters)
        const tagName = column.replace(/[^a-zA-Z0-9_]/g, '_');
        xmlContent += `    <${tagName}>${escapedValue}</${tagName}>\n`;
      });
      xmlContent += '  </row>\n';
    });
    
    xmlContent += '</results>';

    // Create blob and download
    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `builder-adserver-${new Date().toISOString().split('T')[0]}.xml`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToJSON = () => {
    const rowsToExport = tableSearchTerm ? filteredRows : sortedRows;
    if (rowsToExport.length === 0) return;

    // Create JSON structure
    const jsonContent = JSON.stringify(rowsToExport, null, 2);

    // Create blob and download
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `builder-adserver-${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [endInput, setEndInput] = useState(() => formatInputValue(endLimit));
  const [startInput, setStartInput] = useState(() => {
    const date = new Date(endLimit);
    date.setDate(date.getDate() - 7);
    date.setHours(0, 0, 0, 0); // Set to 00:00:00 for start date
    if (date < minStart) {
      const minDate = new Date(minStart);
      minDate.setHours(0, 0, 0, 0);
      return formatInputValue(minDate);
    }
    return formatInputValue(date);
  });


  const handleAddDimension = (dimension) => {
    setState((prev) => ({
      ...prev,
      dimensions: prev.dimensions.some((item) => item.value === dimension.value)
        ? prev.dimensions
        : [...prev.dimensions, dimension],
    }));
  };

  const handleRemoveMetric = (value) => {
    setState((prev) => ({
      ...prev,
      metrics: prev.metrics.filter((metric) => metric.value !== value),
    }));
  };

  const handleRemoveDimension = (value) => {
    setState((prev) => ({
      ...prev,
      dimensions: prev.dimensions.filter((dimension) => dimension.value !== value),
    }));
  };

  const handleRemoveFilter = (id) => {
    setState((prev) => ({
      ...prev,
      filters: prev.filters.filter((filter) => filter.id !== id),
    }));
  };

  const runQuery = async () => {
    setError('');

    // Create dates with explicit times from date-only inputs
    const startDateBase = new Date(startInput + 'T00:00:00');
    const endDateBase = new Date(endInput + 'T23:59:59');
    
    let startDate = clampDate(startDateBase, minStart, endDateBase);
    let endDate = clampDate(endDateBase, startDateBase, endLimit);

    // Ensure start date is exactly 00:00:00.000
    startDate.setHours(0, 0, 0, 0);
    
    // Ensure end date is exactly 23:59:59.999
    endDate.setHours(23, 59, 59, 999);

    setStartInput(formatInputValue(startDate));
    setEndInput(formatInputValue(endDate));

    const startApi = formatDateForApi(startDate);
    const endApi = formatDateForApi(endDate);

    if (!startApi || !endApi) {
      setError('Invalid date range.');
      return;
    }

    if (state.metrics.length === 0) {
      setError('Please add at least one metric.');
      return;
    }

    const filters = {};
    state.filters.forEach((filter) => {
      if (!filter.field || !filter.values) return;
      const values = filter.values
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      if (values.length === 0) return;
      // Map UI field name to API field name for adserver_stats
      const apiFieldName = FILTER_FIELD_API_MAP[filter.field] || filter.field;
      filters[apiFieldName] = {
        Value: values,
        Operator: 'in', // Always use 'in' operator
      };
    });

    // Use granularity from state: 'all' for aggregated data, 'hours' for hourly, 'days' for daily
    const granularity = state.granularity === 'all'
      ? 'all'
      : state.granularity === 'hours'
      ? { type: 'period', period: 'PT1H' }
      : { type: 'period', period: 'P1D' };

    const payload = {
      Datasource: 'adserver_stats',
      Metrics: state.metrics.map((metric) => metric.value),
      TimeZone: TIME_ZONE,
      Granularity: granularity,
      Intervals: [{ Begin: startApi, End: endApi }],
      Size: 500, // Request up to 500 results
    };

    // Only include Dimensions if there are dimensions selected
    if (state.dimensions.length > 0) {
      payload.Dimensions = state.dimensions.map((dimension) => dimension.value);
    }

    if (Object.keys(filters).length > 0) {
      payload.Filters = filters;
    }

    const token = authService.getToken();
    if (!token) {
      authService.logout();
      navigate('/Login');
      return;
    }

    setLoading(true);
    setRows([]);
    setRawResponse(null);

    try {
      const res = await fetch(DEFAULT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ayl-auth-token': token,
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        authService.logout();
        navigate('/Login');
        return;
      }

      if (!res.ok) {
        let message = `Request failed with status ${res.status}`;
        try {
          const json = await res.json();
          if (json?.message) {
            message += `: ${json.message}`;
          }
        } catch {
          // ignore
        }
        setError(message);
        return;
      }

      const json = await res.json();
      const dataRows = computeRows(json);
      setRows(dataRows);
      setRawResponse(json);
      setResultsTab(dataRows.length > 0 ? 'table' : 'raw');
    } catch (requestError) {
      console.error('Builder request error:', requestError);
      setError(`Request error: ${(requestError).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen p-4 lg:p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-[rgb(75,99,226)]" />
            Adserver Builder
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Data is available in near real-time, up to one month back and through tomorrow.
          </p>
        </div>
        <Button onClick={runQuery} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Running…
            </>
          ) : (
            <>
              <ExternalLink className="w-4 h-4 mr-2" />
              Run query
            </>
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="flex flex-col">
          <div className="grid grid-cols-[220px_1fr] border-b border-slate-200">
            <div className="flex items-center gap-3 px-5 py-4 bg-slate-50/70">
              <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                <CalendarDays className="w-4 h-4 text-slate-500" />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Settings</span>
              </div>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-2 w-[140px]">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">Start</Label>
                  <Input
                    type="date"
                    value={startInput}
                    min={formatInputValue(minStart)}
                    max={endInput}
                    onChange={(event) => {
                      const date = new Date(event.target.value + 'T00:00:00');
                      const clampedDate = clampDate(date, minStart, new Date(endInput + 'T23:59:59'));
                      // Set to 00:00:00 for start date
                      clampedDate.setHours(0, 0, 0, 0);
                      setStartInput(formatInputValue(clampedDate));
                    }}
                  />
                </div>
                <div className="space-y-2 w-[140px]">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">End</Label>
                  <Input
                    type="date"
                    value={endInput}
                    min={startInput}
                    max={formatInputValue(endLimit)}
                    onChange={(event) => {
                      const date = new Date(event.target.value + 'T23:59:59');
                      const clampedDate = clampDate(date, new Date(startInput + 'T00:00:00'), endLimit);
                      // Set to 23:59:59 for end date
                      clampedDate.setHours(23, 59, 59, 999);
                      setEndInput(formatInputValue(clampedDate));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">Granularity</Label>
                  <div className="flex gap-2">
                    {['all', 'hours', 'days'].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setState((prev) => ({ ...prev, granularity: value }))}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                          state.granularity === value
                            ? 'bg-[rgb(75,99,226)] text-white border-[rgb(75,99,226)]'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-[rgb(75,99,226)] hover:text-[rgb(75,99,226)]'
                        }`}
                      >
                        {value === 'all' ? 'All' : value === 'hours' ? 'Hours' : 'Days'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[220px_1fr] border-b border-slate-200">
            <div className="flex items-center gap-3 px-5 py-4 bg-slate-50/70">
              <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-slate-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Metrics</span>
                <button
                  type="button"
                  onClick={() => setMetricDialogOpen(true)}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[rgb(75,99,226)] hover:text-[rgb(40,62,173)]"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              </div>
            </div>
            <div className="px-5 py-4">
              <div className="flex flex-wrap gap-2">
                {state.metrics.map((metric) => (
                  <Badge key={metric.value} variant="secondary" className="text-sm px-3 py-1 flex items-center gap-2">
                    {metric.label}
                    <button type="button" onClick={() => handleRemoveMetric(metric.value)} className="hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                {state.metrics.length === 0 && <span className="text-xs text-slate-400">No metrics selected yet.</span>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[220px_1fr] border-b border-slate-200">
            <div className="flex items-center gap-3 px-5 py-4 bg-slate-50/70">
              <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                <Layers className="w-4 h-4 text-slate-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Dimensions</span>
                <button
                  type="button"
                  onClick={() => setDimensionDialogOpen(true)}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[rgb(75,99,226)] hover:text-[rgb(40,62,173)]"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              </div>
            </div>
            <div className="px-5 py-4">
              <div className="flex flex-wrap gap-2">
                {state.dimensions.map((dimension) => (
                  <Badge key={dimension.value} variant="outline" className="text-sm px-3 py-1 flex items-center gap-2">
                    {dimension.label}
                    <button type="button" onClick={() => handleRemoveDimension(dimension.value)} className="hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                {state.dimensions.length === 0 && (
                  <span className="text-xs text-slate-400">No dimensions selected yet.</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[220px_1fr] border-b border-slate-200">
            <div className="flex items-center gap-3 px-5 py-4 bg-slate-50/70">
              <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center">
                <Filter className="w-4 h-4 text-slate-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Filters</span>
                <button
                  type="button"
                  onClick={() => setFilterDialogOpen(true)}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[rgb(75,99,226)] hover:text-[rgb(40,62,173)]"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              </div>
            </div>
            <div className="px-5 py-4">
              <div className="flex flex-col gap-2">
                {state.filters.length === 0 && (
                  <span className="text-xs text-slate-400">No filters applied.</span>
                )}
                {state.filters.map((filter) => (
                  <div
                    key={filter.id}
                    className="border border-slate-200 rounded-md px-3 py-2 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-600">{filter.field}</div>
                      <div className="text-[11px] text-slate-500">
                        {filter.values}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-500"
                      onClick={() => handleRemoveFilter(filter.id)}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-base text-slate-900">Results</CardTitle>
              <p className="text-xs text-slate-500 mt-1">
                Browse the result table or inspect the raw JSON returned by the API.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {rows.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToCSV}
                    disabled={filteredRows.length === 0}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToXML}
                    disabled={filteredRows.length === 0}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    XML
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToJSON}
                    disabled={filteredRows.length === 0}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    JSON
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!rawResponse) return;
                  try {
                    await navigator.clipboard.writeText(safeStringify(rawResponse));
                  } catch (clipboardError) {
                    console.error('Copy to clipboard failed:', clipboardError);
                  }
                }}
                disabled={!rawResponse}
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy JSON
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={resultsTab} onValueChange={setResultsTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="table">Table</TabsTrigger>
              <TabsTrigger value="raw">Raw JSON</TabsTrigger>
            </TabsList>
            <TabsContent value="table">
              {rows.length === 0 ? (
                <div className="border border-dashed border-slate-200 rounded-lg p-12 text-center text-sm text-slate-500">
                  Run a query to populate the table.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Search input for table */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      type="text"
                      placeholder="Search in table..."
                      value={tableSearchTerm}
                      onChange={(e) => setTableSearchTerm(e.target.value)}
                      className="pl-10 w-full"
                    />
                  </div>
                  {tableSearchTerm && (
                    <div className="text-sm text-slate-600">
                      Showing {filteredRows.length} of {sortedRows.length} rows
                    </div>
                  )}
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="overflow-y-auto h-[600px] w-full">
                      <Table>
                        <TableHeader className="bg-slate-100/40 sticky top-0 z-10">
                          <TableRow>
                            {columns.map((column) => {
                              const isSorted = sortColumn === column;
                              return (
                                <TableHead 
                                  key={column} 
                                  className="text-xs font-semibold uppercase tracking-wide text-slate-600 bg-slate-100/40 cursor-pointer hover:bg-slate-200/40 select-none"
                                  onClick={() => handleSort(column)}
                                >
                                  <div className="flex items-center gap-2">
                                    <span>{column}</span>
                                    {isSorted ? (
                                      sortDirection === 'asc' ? (
                                        <ArrowUp className="w-3 h-3" />
                                      ) : (
                                        <ArrowDown className="w-3 h-3" />
                                      )
                                    ) : (
                                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                                    )}
                                  </div>
                                </TableHead>
                              );
                            })}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRows.map((row, rowIndex) => (
                          <TableRow key={`row-${rowIndex}`} className="hover:bg-slate-50">
                            {columns.map((column) => (
                              <TableCell
                                key={`${rowIndex}-${column}`}
                                className="align-top text-xs text-slate-700 font-mono whitespace-pre-wrap"
                              >
                                {formatValue(row?.[column], column, state.granularity)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  </div>
                </div>
              )}
            </TabsContent>
            <TabsContent value="raw">
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <ScrollArea className="h-[600px]">
                  <pre className="p-4 text-xs bg-slate-950/90 text-slate-100 font-mono">
                    {rawResponse ? safeStringify(rawResponse) : 'No response yet.'}
                  </pre>
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <MetricSelectionDialog
        open={metricDialogOpen}
        onOpenChange={setMetricDialogOpen}
        selectedMetrics={state.metrics}
        onMetricsChange={(metrics) => setState((prev) => ({ ...prev, metrics }))}
        userRank={userRank}
        isPowerUser={isPowerUser}
      />

      <SimpleListDialog
        open={dimensionDialogOpen}
        onOpenChange={setDimensionDialogOpen}
        title="Add dimension"
        description="Select a dimension to add."
        options={DIMENSION_OPTIONS}
        onSelect={handleAddDimension}
      />

      <FilterDialog
        open={filterDialogOpen}
        onOpenChange={setFilterDialogOpen}
        filters={state.filters}
        onFiltersChange={(filters) => setState((prev) => ({ ...prev, filters }))}
      />
    </div>
  );
}

function MetricSelectionDialog({ open, onOpenChange, selectedMetrics, onMetricsChange, userRank, isPowerUser }) {
  const [localSelectedMetrics, setLocalSelectedMetrics] = useState(selectedMetrics);
  const [metricSearchTerm, setMetricSearchTerm] = useState('');

  // Filter metrics based on user permissions
  const availableMetrics = useMemo(() => {
    const rankIsSuperadmin = typeof userRank === 'string' && userRank.toUpperCase() === 'SUPERADMIN';
    const rankIsAdmin = typeof userRank === 'string' && (userRank.toUpperCase() === 'ADMIN' || rankIsSuperadmin);
    
    return METRIC_OPTIONS.filter(metric => {
      if (!metric.permission) return true; // No permission required
      if (metric.permission === 'SUPER ADMIN') return rankIsSuperadmin;
      if (metric.permission === 'ADMIN') return rankIsAdmin || rankIsSuperadmin;
      return true;
    });
  }, [userRank]);

  // Update local selected metrics when dialog opens, removing any that are no longer available
  useEffect(() => {
    if (open) {
      const availableMetricValues = new Set(availableMetrics.map(m => m.value));
      const filteredMetrics = selectedMetrics.filter(m => availableMetricValues.has(m.value));
      setLocalSelectedMetrics(filteredMetrics);
      setMetricSearchTerm(''); // Reset search when dialog opens
    }
  }, [open, selectedMetrics, availableMetrics]);

  // Filter metrics based on search term
  const filteredAvailableMetrics = useMemo(() => {
    if (!metricSearchTerm.trim()) return availableMetrics;
    
    const searchLower = metricSearchTerm.toLowerCase();
    return availableMetrics.filter(metric => 
      metric.label.toLowerCase().includes(searchLower) ||
      metric.value.toLowerCase().includes(searchLower)
    );
  }, [availableMetrics, metricSearchTerm]);

  // Organize metrics by categories and sort alphabetically within each category
  const metricsByCategory = useMemo(() => {
    const categories = {};
    filteredAvailableMetrics.forEach((metric) => {
      const category = metric.category || 'Other';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(metric);
    });
    // Sort metrics alphabetically by label within each category
    Object.keys(categories).forEach((category) => {
      categories[category].sort((a, b) => a.label.localeCompare(b.label));
    });
    return categories;
  }, [filteredAvailableMetrics]);

  // Get category order
  const categoryOrder = ['Financial', 'Delivery', 'Interactions', 'Display'];

  const handleToggleMetric = (metric) => {
    setLocalSelectedMetrics((prev) => {
      const isSelected = prev.some((m) => m.value === metric.value);
      if (isSelected) {
        return prev.filter((m) => m.value !== metric.value);
      } else {
        return [...prev, metric];
      }
    });
  };

  // Check if all metrics in a category are selected
  const areAllMetricsSelected = (categoryMetrics) => {
    if (categoryMetrics.length === 0) return false;
    return categoryMetrics.every((metric) =>
      localSelectedMetrics.some((m) => m.value === metric.value)
    );
  };

  // Toggle all metrics in a category
  const handleToggleCategory = (categoryMetrics) => {
    const allSelected = areAllMetricsSelected(categoryMetrics);
    if (allSelected) {
      // Deselect all metrics in this category
      const categoryMetricValues = new Set(categoryMetrics.map((m) => m.value));
      setLocalSelectedMetrics((prev) =>
        prev.filter((m) => !categoryMetricValues.has(m.value))
      );
    } else {
      // Select all metrics in this category
      const categoryMetricValues = new Set(
        localSelectedMetrics.map((m) => m.value)
      );
      const newMetrics = categoryMetrics.filter(
        (metric) => !categoryMetricValues.has(metric.value)
      );
      setLocalSelectedMetrics((prev) => [...prev, ...newMetrics]);
    }
  };

  const handleConfirm = () => {
    onMetricsChange(localSelectedMetrics);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setLocalSelectedMetrics(selectedMetrics);
    onOpenChange(false);
  };

  if (!open) return null;

  const handleBackdropClick = (e) => {
    // Close only if clicking directly on the backdrop, not on the modal content
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 !m-0"
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col m-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Columns</h3>
          {/* Search input for metrics */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Search metrics..."
              value={metricSearchTerm}
              onChange={(e) => setMetricSearchTerm(e.target.value)}
              className="pl-10 w-full"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="space-y-6">
            {categoryOrder.map((categoryName, index) => {
              const metrics = metricsByCategory[categoryName];
              if (!metrics || metrics.length === 0) return null;
              
              const allSelected = areAllMetricsSelected(metrics);
              return (
                <div key={categoryName} className={`space-y-2 ${categoryName === 'Financial' ? 'mt-4' : ''}`}>
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
                    <label className="flex items-center gap-2 cursor-pointer flex-1">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => handleToggleCategory(metrics)}
                        className="sr-only"
                      />
                      <div
                        className={`flex h-4 w-4 items-center justify-center rounded-sm border flex-shrink-0 ${
                          allSelected 
                            ? 'bg-[rgb(75,99,226)] border-[rgb(75,99,226)]' 
                            : 'border-slate-300 hover:border-slate-400'
                        } transition-colors`}
                      >
                        {allSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {categoryName}
                      </h4>
                    </label>
                  </div>
                  <div className="grid grid-cols-4 gap-x-6 gap-y-1">
                    {metrics.map((metric) => {
                      const isSelected = localSelectedMetrics.some((m) => m.value === metric.value);
                      return (
                        <label
                          key={metric.value}
                          className="flex items-center gap-2 cursor-pointer py-1.5 px-1 rounded hover:bg-slate-50 group"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleMetric(metric)}
                            className="sr-only"
                          />
                          <div
                            className={`flex h-4 w-4 items-center justify-center rounded-sm border flex-shrink-0 ${
                              isSelected 
                                ? 'bg-[rgb(75,99,226)] border-[rgb(75,99,226)]' 
                                : 'border-slate-300 group-hover:border-slate-400'
                            } transition-colors`}
                          >
                            {isSelected && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <span className="text-sm text-slate-700 flex-1 leading-tight">{metric.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded transition-colors"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-[rgb(75,99,226)] hover:bg-[rgb(40,62,173)] rounded transition-colors"
          >
            CONFIRM
          </button>
        </div>
      </div>
    </div>
  );
}

function SimpleListDialog({ open, onOpenChange, options, onSelect, title, description }) {
  if (!open) return null;

  const handleBackdropClick = (e) => {
    // Close only if clicking directly on the backdrop, not on the modal content
    if (e.target === e.currentTarget) {
      onOpenChange(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 !m-0"
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4 m-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
        <div className="grid gap-2 max-h-[320px] overflow-y-auto">
          {options.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant="outline"
              className="justify-between"
              onClick={() => {
                onSelect(option);
                onOpenChange(false);
              }}
            >
              <span>{option.label}</span>
              <span className="text-xs text-slate-400 font-mono">{option.value}</span>
            </Button>
          ))}
        </div>
        <div className="text-right">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function FilterDialog({ open, onOpenChange, filters, onFiltersChange }) {
  const [localFilters, setLocalFilters] = useState(filters);
  const [realms, setRealms] = useState([]);
  const [selectedRealms, setSelectedRealms] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [selectedCompanies, setSelectedCompanies] = useState([]);
  const [sites, setSites] = useState([]);
  const [selectedSites, setSelectedSites] = useState([]);
  const [placements, setPlacements] = useState([]);
  const [selectedPlacements, setSelectedPlacements] = useState([]);
  const [realmSearchTerms, setRealmSearchTerms] = useState({});
  const [companySearchTerms, setCompanySearchTerms] = useState({});
  const [siteSearchTerms, setSiteSearchTerms] = useState({});
  const [placementSearchTerms, setPlacementSearchTerms] = useState({});
  const [realmPopoverOpen, setRealmPopoverOpen] = useState({});
  const [companyPopoverOpen, setCompanyPopoverOpen] = useState({});
  const [sitePopoverOpen, setSitePopoverOpen] = useState({});
  const [placementPopoverOpen, setPlacementPopoverOpen] = useState({});

  useEffect(() => {
    if (open) {
      setLocalFilters(filters);
    }
  }, [filters, open]);

  // Fetch realms with search term
  const fetchRealms = async (searchTerm = '') => {
    const token = authService.getToken();
    if (!token) return;

    try {
      const filters = [];
      if (searchTerm) {
        filters.push({ Field: "Name", Operator: "contains", Value: searchTerm });
      }

      const payload = {
        Filters: filters,
        From: 0,
        Order: [{ Field: "UpdatedAt", Operator: "desc" }],
        Size: 20
      };

      const response = await fetch(API_ENDPOINTS.REALMS_SEARCH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ayl-auth-token': token
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.Data) {
          const visibleRealms = data.Data.filter(realm => realm.Visibility !== -1);
          setRealms(visibleRealms);
        } else {
          setRealms([]);
        }
      }
    } catch (err) {
      console.error('Error fetching realms:', err);
      setRealms([]);
    }
  };

  const fetchCompanies = async (searchTerm = '') => {
    const token = authService.getToken();
    if (!token) return;

    try {
      const filters = [];
      if (searchTerm) {
        filters.push({ Field: "Name", Operator: "contains", Value: searchTerm });
      }

      const payload = {
        Filters: filters.length > 0 ? filters : [],
        From: 0,
        Order: [{ Field: "UpdatedAt", Operator: "desc" }],
        Size: 20
      };

      const response = await fetch(API_ENDPOINTS.COMPANIES_SEARCH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ayl-auth-token': token
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.Data) {
          const visibleCompanies = data.Data.filter(company => company.Visibility !== -1);
          setCompanies(visibleCompanies);
        } else {
          setCompanies([]);
        }
      }
    } catch (err) {
      console.error('Error fetching companies:', err);
      setCompanies([]);
    }
  };

  const fetchSites = async (searchTerm = '') => {
    const token = authService.getToken();
    if (!token) return;

    try {
      const filters = [];
      if (searchTerm) {
        filters.push({ Field: "Name", Operator: "contains", Value: searchTerm });
      }

      const payload = {
        Filters: filters.length > 0 ? filters : [],
        From: 0,
        Order: [{ Field: "UpdatedAt", Operator: "desc" }],
        Size: 20
      };

      const response = await fetch(API_ENDPOINTS.SITES_SEARCH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ayl-auth-token': token
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.Data) {
          const visibleSites = data.Data.filter(site => site.Visibility !== -1);
          setSites(visibleSites);
        } else {
          setSites([]);
        }
      }
    } catch (err) {
      console.error('Error fetching sites:', err);
      setSites([]);
    }
  };

  const fetchPlacements = async (searchTerm = '') => {
    const token = authService.getToken();
    if (!token) return;

    try {
      const filters = [];
      if (searchTerm) {
        filters.push({ Field: "Name", Operator: "contains", Value: searchTerm });
      }

      const payload = {
        Filters: filters.length > 0 ? filters : [],
        From: 0,
        Order: [{ Field: "UpdatedAt", Operator: "desc" }],
        Size: 20
      };

      const response = await fetch(API_ENDPOINTS.PLACEMENTS_SEARCH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ayl-auth-token': token
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.Data) {
          const visiblePlacements = data.Data.filter(placement => placement.Visibility !== -1);
          setPlacements(visiblePlacements);
        } else {
          setPlacements([]);
        }
      }
    } catch (err) {
      console.error('Error fetching placements:', err);
      setPlacements([]);
    }
  };

  const addFilter = () => {
    setLocalFilters((prev) => [
      ...prev,
      {
        id: `filter-${Date.now()}`,
        field: FILTER_FIELDS[0].value,
        operator: 'in', // Always use 'in' operator
        values: '',
      },
    ]);
  };

  const updateFilter = (id, field, value) => {
    setLocalFilters((prev) => {
      const updatedFilters = prev.map((filter) => {
        if (filter.id === id) {
          // If field is being changed, clear the values and related states
          if (field === 'field' && filter.field !== value) {
            // Clear search terms for the old field
            const oldField = filter.field;
            if (oldField === 'RealmPublisher') {
              setRealmSearchTerms((prev) => {
                const newState = { ...prev };
                delete newState[id];
                return newState;
              });
            } else if (oldField === 'Publisher') {
              setCompanySearchTerms((prev) => {
                const newState = { ...prev };
                delete newState[id];
                return newState;
              });
            } else if (oldField === 'Site') {
              setSiteSearchTerms((prev) => {
                const newState = { ...prev };
                delete newState[id];
                return newState;
              });
            } else if (oldField === 'Placement') {
              setPlacementSearchTerms((prev) => {
                const newState = { ...prev };
                delete newState[id];
                return newState;
              });
            }

            // Clear popover states for the old field
            if (oldField === 'RealmPublisher') {
              setRealmPopoverOpen((prev) => {
                const newState = { ...prev };
                delete newState[id];
                return newState;
              });
            } else if (oldField === 'Publisher') {
              setCompanyPopoverOpen((prev) => {
                const newState = { ...prev };
                delete newState[id];
                return newState;
              });
            } else if (oldField === 'Site') {
              setSitePopoverOpen((prev) => {
                const newState = { ...prev };
                delete newState[id];
                return newState;
              });
            } else if (oldField === 'Placement') {
              setPlacementPopoverOpen((prev) => {
                const newState = { ...prev };
                delete newState[id];
                return newState;
              });
            }

            return { ...filter, [field]: value, values: '' };
          }
          return { ...filter, [field]: value };
        }
        return filter;
      });
      return updatedFilters;
    });
  };

  const removeFilter = (id) => {
    setLocalFilters((prev) => prev.filter((filter) => filter.id !== id));
    // Clean up all popover states
    setRealmPopoverOpen((prev) => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
    setCompanyPopoverOpen((prev) => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
    setSitePopoverOpen((prev) => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
    setPlacementPopoverOpen((prev) => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
    // Clean up all search terms
    setRealmSearchTerms((prev) => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
    setCompanySearchTerms((prev) => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
    setSiteSearchTerms((prev) => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
    setPlacementSearchTerms((prev) => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
  };

  const handleRealmToggle = (filterId, realmId) => {
    const filter = localFilters.find(f => f.id === filterId);
    if (!filter) return;

    const currentValues = filter.values ? filter.values.split(',').map(v => v.trim()).filter(Boolean) : [];
    const realmIds = currentValues;
    
    let newRealmIds;
    if (realmIds.includes(realmId)) {
      newRealmIds = realmIds.filter(id => id !== realmId);
      const stillSelected = localFilters.some(f => {
        if (f.id === filterId) return false;
        const values = f.values ? f.values.split(',').map(v => v.trim()).filter(Boolean) : [];
        return values.includes(realmId);
      });
      if (!stillSelected) {
        setSelectedRealms(prev => prev.filter(r => r.Uid !== realmId));
      }
    } else {
      newRealmIds = [...realmIds, realmId];
      const realm = realms.find(r => r.Uid === realmId);
      if (realm) {
        setSelectedRealms(prev => {
          if (prev.some(r => r.Uid === realmId)) return prev;
          return [...prev, realm];
        });
      }
    }

    updateFilter(filterId, 'values', newRealmIds.join(', '));
  };

  const getSelectedRealmNames = (filterId) => {
    const filter = localFilters.find(f => f.id === filterId);
    if (!filter || !filter.values) return [];
    
    const realmIds = filter.values.split(',').map(v => v.trim()).filter(Boolean);
    return realmIds.map(id => {
      const realm = realms.find(r => r.Uid === id) || selectedRealms.find(r => r.Uid === id);
      return realm ? realm.Name : id;
    });
  };

  const handleCompanyToggle = (filterId, companyId) => {
    const filter = localFilters.find(f => f.id === filterId);
    if (!filter) return;

    const currentValues = filter.values ? filter.values.split(',').map(v => v.trim()).filter(Boolean) : [];
    const companyIds = currentValues;
    
    let newCompanyIds;
    if (companyIds.includes(companyId)) {
      newCompanyIds = companyIds.filter(id => id !== companyId);
      const stillSelected = localFilters.some(f => {
        if (f.id === filterId) return false;
        const values = f.values ? f.values.split(',').map(v => v.trim()).filter(Boolean) : [];
        return values.includes(companyId);
      });
      if (!stillSelected) {
        setSelectedCompanies(prev => prev.filter(c => c.Uid !== companyId));
      }
    } else {
      newCompanyIds = [...companyIds, companyId];
      const company = companies.find(c => c.Uid === companyId);
      if (company) {
        setSelectedCompanies(prev => {
          if (prev.some(c => c.Uid === companyId)) return prev;
          return [...prev, company];
        });
      }
    }

    updateFilter(filterId, 'values', newCompanyIds.join(', '));
  };

  const getSelectedCompanyNames = (filterId) => {
    const filter = localFilters.find(f => f.id === filterId);
    if (!filter || !filter.values) return [];
    
    const companyIds = filter.values.split(',').map(v => v.trim()).filter(Boolean);
    return companyIds.map(id => {
      const company = companies.find(c => c.Uid === id) || selectedCompanies.find(c => c.Uid === id);
      return company ? company.Name : id;
    });
  };

  const handleSiteToggle = (filterId, siteId) => {
    const filter = localFilters.find(f => f.id === filterId);
    if (!filter) return;

    const currentValues = filter.values ? filter.values.split(',').map(v => v.trim()).filter(Boolean) : [];
    const siteIds = currentValues;
    
    let newSiteIds;
    if (siteIds.includes(siteId)) {
      newSiteIds = siteIds.filter(id => id !== siteId);
      const stillSelected = localFilters.some(f => {
        if (f.id === filterId) return false;
        const values = f.values ? f.values.split(',').map(v => v.trim()).filter(Boolean) : [];
        return values.includes(siteId);
      });
      if (!stillSelected) {
        setSelectedSites(prev => prev.filter(s => s.Uid !== siteId));
      }
    } else {
      newSiteIds = [...siteIds, siteId];
      const site = sites.find(s => s.Uid === siteId);
      if (site) {
        setSelectedSites(prev => {
          if (prev.some(s => s.Uid === siteId)) return prev;
          return [...prev, site];
        });
      }
    }

    updateFilter(filterId, 'values', newSiteIds.join(', '));
  };

  const getSelectedSiteNames = (filterId) => {
    const filter = localFilters.find(f => f.id === filterId);
    if (!filter || !filter.values) return [];
    
    const siteIds = filter.values.split(',').map(v => v.trim()).filter(Boolean);
    return siteIds.map(id => {
      const site = sites.find(s => s.Uid === id) || selectedSites.find(s => s.Uid === id);
      return site ? site.Name : id;
    });
  };

  const getFilteredRealms = (filterId) => {
    const filter = localFilters.find(f => f.id === filterId);
    const selectedIds = filter && filter.values ? filter.values.split(',').map(v => v.trim()).filter(Boolean) : [];
    const selectedRealmsList = selectedRealms.filter(r => selectedIds.includes(r.Uid));
    const allRealms = [...realms, ...selectedRealmsList];
    const uniqueRealms = Array.from(
      new Map(allRealms.map(realm => [realm.Uid, realm])).values()
    );
    return uniqueRealms;
  };

  const getFilteredCompanies = (filterId) => {
    const filter = localFilters.find(f => f.id === filterId);
    const selectedIds = filter && filter.values ? filter.values.split(',').map(v => v.trim()).filter(Boolean) : [];
    const selectedCompaniesList = selectedCompanies.filter(c => selectedIds.includes(c.Uid));
    const allCompanies = [...companies, ...selectedCompaniesList];
    const uniqueCompanies = Array.from(
      new Map(allCompanies.map(company => [company.Uid, company])).values()
    );
    return uniqueCompanies;
  };

  const getFilteredSites = (filterId) => {
    const filter = localFilters.find(f => f.id === filterId);
    const selectedIds = filter && filter.values ? filter.values.split(',').map(v => v.trim()).filter(Boolean) : [];
    const selectedSitesList = selectedSites.filter(s => selectedIds.includes(s.Uid));
    const allSites = [...sites, ...selectedSitesList];
    const uniqueSites = Array.from(
      new Map(allSites.map(site => [site.Uid, site])).values()
    );
    return uniqueSites;
  };

  // Placement functions
  const handlePlacementToggle = (filterId, placementId) => {
    const filter = localFilters.find(f => f.id === filterId);
    if (!filter) return;

    const currentValues = filter.values ? filter.values.split(',').map(v => v.trim()).filter(Boolean) : [];
    const placementIds = currentValues;
    
    let newPlacementIds;
    if (placementIds.includes(placementId)) {
      newPlacementIds = placementIds.filter(id => id !== placementId);
      // Remove from selectedPlacements if no longer selected in any filter
      const stillSelected = localFilters.some(f => {
        if (f.id === filterId) return false;
        const values = f.values ? f.values.split(',').map(v => v.trim()).filter(Boolean) : [];
        return values.includes(placementId);
      });
      if (!stillSelected) {
        setSelectedPlacements(prev => prev.filter(p => p.Uid !== placementId));
      }
    } else {
      newPlacementIds = [...placementIds, placementId];
      // Add to selectedPlacements if not already there
      const placement = placements.find(p => p.Uid === placementId);
      if (placement) {
        setSelectedPlacements(prev => {
          if (prev.some(p => p.Uid === placementId)) return prev;
          return [...prev, placement];
        });
      }
    }

    updateFilter(filterId, 'values', newPlacementIds.join(', '));
  };

  const getSelectedPlacementNames = (filterId) => {
    const filter = localFilters.find(f => f.id === filterId);
    if (!filter || !filter.values) return [];
    
    const placementIds = filter.values.split(',').map(v => v.trim()).filter(Boolean);
    return placementIds.map(id => {
      // Check in both placements (search results) and selectedPlacements (previously selected)
      const placement = placements.find(p => p.Uid === id) || selectedPlacements.find(p => p.Uid === id);
      return placement ? placement.Name : id;
    });
  };

  const getFilteredPlacements = (filterId) => {
    // Merge search results with selected placements to ensure selected ones are always visible
    const filter = localFilters.find(f => f.id === filterId);
    const selectedIds = filter && filter.values ? filter.values.split(',').map(v => v.trim()).filter(Boolean) : [];
    
    // Get selected placements that might not be in current search results
    const selectedPlacementsList = selectedPlacements.filter(p => selectedIds.includes(p.Uid));
    
    // Merge and remove duplicates
    const allPlacements = [...placements, ...selectedPlacementsList];
    const uniquePlacements = Array.from(
      new Map(allPlacements.map(placement => [placement.Uid, placement])).values()
    );
    
    return uniquePlacements;
  };

  // Debounced search for realms
  useEffect(() => {
    const timeouts = {};
    Object.keys(realmPopoverOpen).forEach((filterId) => {
      if (realmPopoverOpen[filterId]) {
        const searchTerm = realmSearchTerms[filterId] || '';
        clearTimeout(timeouts[filterId]);
        timeouts[filterId] = setTimeout(() => {
          fetchRealms(searchTerm);
        }, 300);
      }
    });
    return () => {
      Object.values(timeouts).forEach(timeout => clearTimeout(timeout));
    };
  }, [realmSearchTerms, realmPopoverOpen]);

  useEffect(() => {
    Object.keys(realmPopoverOpen).forEach((filterId) => {
      if (realmPopoverOpen[filterId]) {
        const currentSearchTerm = realmSearchTerms[filterId] || '';
        fetchRealms(currentSearchTerm);
      }
    });
  }, [realmPopoverOpen]);

  // Debounced search for companies
  useEffect(() => {
    const timeouts = {};
    Object.keys(companyPopoverOpen).forEach((filterId) => {
      if (companyPopoverOpen[filterId]) {
        const searchTerm = companySearchTerms[filterId] || '';
        clearTimeout(timeouts[filterId]);
        timeouts[filterId] = setTimeout(() => {
          fetchCompanies(searchTerm);
        }, 300);
      }
    });
    return () => {
      Object.values(timeouts).forEach(timeout => clearTimeout(timeout));
    };
  }, [companySearchTerms, companyPopoverOpen]);

  useEffect(() => {
    Object.keys(companyPopoverOpen).forEach((filterId) => {
      if (companyPopoverOpen[filterId]) {
        const currentSearchTerm = companySearchTerms[filterId] || '';
        fetchCompanies(currentSearchTerm);
      }
    });
  }, [companyPopoverOpen]);

  // Debounced search for sites
  useEffect(() => {
    const timeouts = {};
    Object.keys(sitePopoverOpen).forEach((filterId) => {
      if (sitePopoverOpen[filterId]) {
        const searchTerm = siteSearchTerms[filterId] || '';
        clearTimeout(timeouts[filterId]);
        timeouts[filterId] = setTimeout(() => {
          fetchSites(searchTerm);
        }, 300);
      }
    });
    return () => {
      Object.values(timeouts).forEach(timeout => clearTimeout(timeout));
    };
  }, [siteSearchTerms, sitePopoverOpen]);

  useEffect(() => {
    Object.keys(sitePopoverOpen).forEach((filterId) => {
      if (sitePopoverOpen[filterId]) {
        const currentSearchTerm = siteSearchTerms[filterId] || '';
        fetchSites(currentSearchTerm);
      }
    });
  }, [sitePopoverOpen]);

  // Debounced search for placements
  useEffect(() => {
    const timeouts = {};
    Object.keys(placementPopoverOpen).forEach((filterId) => {
      if (placementPopoverOpen[filterId]) {
        const searchTerm = placementSearchTerms[filterId] || '';
        clearTimeout(timeouts[filterId]);
        timeouts[filterId] = setTimeout(() => {
          fetchPlacements(searchTerm);
        }, 300); // 300ms debounce
      }
    });
    return () => {
      Object.values(timeouts).forEach(timeout => clearTimeout(timeout));
    };
  }, [placementSearchTerms, placementPopoverOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize search when popover opens for placement
  useEffect(() => {
    Object.keys(placementPopoverOpen).forEach((filterId) => {
      if (placementPopoverOpen[filterId]) {
        // Load initial results when popover opens (empty search to get first 20)
        const currentSearchTerm = placementSearchTerms[filterId] || '';
        fetchPlacements(currentSearchTerm);
      }
    });
  }, [placementPopoverOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    onOpenChange(false);
    onFiltersChange(localFilters);
  };

  const handleCancel = () => {
    // Reset to original filters and close
    setLocalFilters(filters);
    onOpenChange(false);
  };

  const handleBackdropClick = (e) => {
    // Close only if clicking directly on the backdrop, not on the modal content
    if (e.target === e.currentTarget) {
      handleCancel();
    }
  };

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 !m-0"
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4 m-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Filters</h3>
            <p className="text-sm text-slate-500">Manage the filters applied to your query.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addFilter}>
            <Plus className="w-4 h-4 mr-1" />
            Add filter
          </Button>
        </div>

        {localFilters.length === 0 ? (
          <div className="border border-dashed border-slate-200 rounded-md px-4 py-8 text-center text-sm text-slate-500">
            No filters yet.
          </div>
        ) : (
          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {localFilters.map((filter) => (
              <div key={filter.id} className="border border-slate-200 rounded-md px-3 py-3 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">Field</Label>
                  <Button type="button" variant="ghost" size="sm" className="text-red-500" onClick={() => removeFilter(filter.id)}>
                    <X className="w-3 h-3 mr-1" />
                    Remove
                  </Button>
                </div>
                <Select value={filter.field} onValueChange={(value) => updateFilter(filter.id, 'field', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTER_FIELDS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wide text-slate-500">
                    {filter.field === 'RealmPublisher' ? 'Select Realms' :
                     filter.field === 'Publisher' ? 'Select Companies' :
                     filter.field === 'Site' ? 'Select Sites' :
                     filter.field === 'Placement' ? 'Select Placements' :
                     'Values (comma-separated)'}
                  </Label>
                  {filter.field === 'RealmPublisher' ? (
                    <Popover 
                      open={realmPopoverOpen[filter.id] || false} 
                      onOpenChange={(open) => setRealmPopoverOpen(prev => ({ ...prev, [filter.id]: open }))}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between text-left font-normal min-h-[80px] h-auto py-2"
                        >
                          <div className="flex flex-wrap gap-1 flex-1">
                            {getSelectedRealmNames(filter.id).length > 0 ? (
                              getSelectedRealmNames(filter.id).map((name, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-slate-500 text-xs">Select realms...</span>
                            )}
                          </div>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput
                            placeholder="Search realms..."
                            value={realmSearchTerms[filter.id] || ''}
                            onValueChange={(value) => setRealmSearchTerms(prev => ({ ...prev, [filter.id]: value }))}
                            className="h-9"
                          />
                          <CommandList>
                            <CommandEmpty>No realm found.</CommandEmpty>
                            <CommandGroup>
                              {getFilteredRealms(filter.id).map((realm) => {
                                const isSelected = filter.values && filter.values.split(',').map(v => v.trim()).includes(realm.Uid);
                                return (
                                  <CommandItem
                                    key={realm.Uid}
                                    value={realm.Name}
                                    onSelect={() => handleRealmToggle(filter.id, realm.Uid)}
                                    className="text-xs"
                                  >
                                    <div className="flex items-center gap-2 flex-1">
                                      <div
                                        className={`flex h-4 w-4 items-center justify-center rounded-sm border ${
                                          isSelected ? 'bg-[rgb(75,99,226)] border-[rgb(75,99,226)]' : 'border-slate-200'
                                        }`}
                                      >
                                        {isSelected && <Check className="h-3 w-3 text-white" />}
                                      </div>
                                      <span>{realm.Name}</span>
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  ) : filter.field === 'Publisher' ? (
                    <Popover 
                      open={companyPopoverOpen[filter.id] || false} 
                      onOpenChange={(open) => setCompanyPopoverOpen(prev => ({ ...prev, [filter.id]: open }))}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between text-left font-normal min-h-[80px] h-auto py-2"
                        >
                          <div className="flex flex-wrap gap-1 flex-1">
                            {getSelectedCompanyNames(filter.id).length > 0 ? (
                              getSelectedCompanyNames(filter.id).map((name, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-slate-500 text-xs">Select companies...</span>
                            )}
                          </div>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput
                            placeholder="Search companies..."
                            value={companySearchTerms[filter.id] || ''}
                            onValueChange={(value) => setCompanySearchTerms(prev => ({ ...prev, [filter.id]: value }))}
                            className="h-9"
                          />
                          <CommandList>
                            <CommandEmpty>No company found.</CommandEmpty>
                            <CommandGroup>
                              {getFilteredCompanies(filter.id).map((company) => {
                                const isSelected = filter.values && filter.values.split(',').map(v => v.trim()).includes(company.Uid);
                                return (
                                  <CommandItem
                                    key={company.Uid}
                                    value={company.Name}
                                    onSelect={() => handleCompanyToggle(filter.id, company.Uid)}
                                    className="text-xs"
                                  >
                                    <div className="flex items-center gap-2 flex-1">
                                      <div
                                        className={`flex h-4 w-4 items-center justify-center rounded-sm border ${
                                          isSelected ? 'bg-[rgb(75,99,226)] border-[rgb(75,99,226)]' : 'border-slate-200'
                                        }`}
                                      >
                                        {isSelected && <Check className="h-3 w-3 text-white" />}
                                      </div>
                                      <span>{company.Name}</span>
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  ) : filter.field === 'Site' ? (
                    <Popover 
                      open={sitePopoverOpen[filter.id] || false} 
                      onOpenChange={(open) => setSitePopoverOpen(prev => ({ ...prev, [filter.id]: open }))}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between text-left font-normal min-h-[80px] h-auto py-2"
                        >
                          <div className="flex flex-wrap gap-1 flex-1">
                            {getSelectedSiteNames(filter.id).length > 0 ? (
                              getSelectedSiteNames(filter.id).map((name, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-slate-500 text-xs">Select sites...</span>
                            )}
                          </div>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput
                            placeholder="Search sites..."
                            value={siteSearchTerms[filter.id] || ''}
                            onValueChange={(value) => setSiteSearchTerms(prev => ({ ...prev, [filter.id]: value }))}
                            className="h-9"
                          />
                          <CommandList>
                            <CommandEmpty>No site found.</CommandEmpty>
                            <CommandGroup>
                              {getFilteredSites(filter.id).map((site) => {
                                const isSelected = filter.values && filter.values.split(',').map(v => v.trim()).includes(site.Uid);
                                return (
                                  <CommandItem
                                    key={site.Uid}
                                    value={site.Name}
                                    onSelect={() => handleSiteToggle(filter.id, site.Uid)}
                                    className="text-xs"
                                  >
                                    <div className="flex items-center gap-2 flex-1">
                                      <div
                                        className={`flex h-4 w-4 items-center justify-center rounded-sm border ${
                                          isSelected ? 'bg-[rgb(75,99,226)] border-[rgb(75,99,226)]' : 'border-slate-200'
                                        }`}
                                      >
                                        {isSelected && <Check className="h-3 w-3 text-white" />}
                                      </div>
                                      <span>{site.Name}</span>
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  ) : filter.field === 'Placement' ? (
                    <Popover 
                      open={placementPopoverOpen[filter.id] || false} 
                      onOpenChange={(open) => setPlacementPopoverOpen(prev => ({ ...prev, [filter.id]: open }))}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between text-left font-normal min-h-[80px] h-auto py-2"
                        >
                          <div className="flex flex-wrap gap-1 flex-1">
                            {getSelectedPlacementNames(filter.id).length > 0 ? (
                              getSelectedPlacementNames(filter.id).map((name, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {name}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-slate-500 text-xs">Select placements...</span>
                            )}
                          </div>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput
                            placeholder="Search placements..."
                            value={placementSearchTerms[filter.id] || ''}
                            onValueChange={(value) => setPlacementSearchTerms(prev => ({ ...prev, [filter.id]: value }))}
                            className="h-9"
                          />
                          <CommandList>
                            <CommandEmpty>No placement found.</CommandEmpty>
                            <CommandGroup>
                              {getFilteredPlacements(filter.id).map((placement) => {
                                const isSelected = filter.values && filter.values.split(',').map(v => v.trim()).includes(placement.Uid);
                                return (
                                  <CommandItem
                                    key={placement.Uid}
                                    value={placement.Name}
                                    onSelect={() => handlePlacementToggle(filter.id, placement.Uid)}
                                    className="text-xs"
                                  >
                                    <div className="flex items-center gap-2 flex-1">
                                      <div
                                        className={`flex h-4 w-4 items-center justify-center rounded-sm border ${
                                          isSelected ? 'bg-[rgb(75,99,226)] border-[rgb(75,99,226)]' : 'border-slate-200'
                                        }`}
                                      >
                                        {isSelected && <Check className="h-3 w-3 text-white" />}
                                      </div>
                                      <span>{placement.Name}</span>
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Textarea
                      value={filter.values}
                      onChange={(event) => updateFilter(filter.id, 'values', event.target.value)}
                      placeholder="value1, value2, value3"
                      className="min-h-[80px] font-mono text-xs"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="button" onClick={handleClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

