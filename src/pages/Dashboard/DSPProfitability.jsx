/**
 * DSP Profitability Page Component
 * 
 * Displays network operations data grouped by Partner Name
 */

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Download, TrendingUp } from 'lucide-react';
import { authService } from "@/services/authService";
import { cachedFetch } from '@/utils/apiCache';
import { formatError } from '@/utils/errorFormatter';
import { API_ENDPOINTS } from "@/config/api";
import { formatCurrencyRaw, formatEcpm } from "@/utils/formatters";

export default function DSPProfitability() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  
  // Sort state
  const [sortConfig, setSortConfig] = useState({ key: 'network_operations_price_publisher', direction: 'desc' });
  
  // Get time range from localStorage
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
      case 'Today':
        startDateValue = new Date(Date.UTC(todayYear, todayMonth, todayDate, 0, 0, 0, 0));
        endDateValue = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
        break;
      case 'Yesterday':
        const yesterdayDate = new Date(todayYear, todayMonth, todayDate - 1);
        startDateValue = new Date(Date.UTC(yesterdayDate.getFullYear(), yesterdayDate.getMonth(), yesterdayDate.getDate(), 0, 0, 0, 0));
        endDateValue = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
        break;
      case '7d':
        const date7d = new Date(todayYear, todayMonth, todayDate - 7);
        startDateValue = new Date(Date.UTC(date7d.getFullYear(), date7d.getMonth(), date7d.getDate(), 0, 0, 0, 0));
        endDateValue = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
        break;
      case '14d':
        const date14d = new Date(todayYear, todayMonth, todayDate - 14);
        startDateValue = new Date(Date.UTC(date14d.getFullYear(), date14d.getMonth(), date14d.getDate(), 0, 0, 0, 0));
        endDateValue = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
        break;
      case '30d':
        const date30d = new Date(todayYear, todayMonth, todayDate - 30);
        startDateValue = new Date(Date.UTC(date30d.getFullYear(), date30d.getMonth(), date30d.getDate(), 0, 0, 0, 0));
        endDateValue = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
        break;
      default:
        const dateDefault = new Date(todayYear, todayMonth, todayDate - 7);
        startDateValue = new Date(Date.UTC(dateDefault.getFullYear(), dateDefault.getMonth(), dateDefault.getDate(), 0, 0, 0, 0));
        endDateValue = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
    }

    return { startDateValue, endDateValue };
  };

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

  // Initialize dates from time range on mount
  useEffect(() => {
    const timeRange = getTimeRange();
    const { startDateValue, endDateValue } = calculateDatesFromTimeRange(timeRange);
    setStartDate(startDateValue);
    setEndDate(endDateValue);
  }, []);

  // Listen for time range changes from Layout header
  useEffect(() => {
    const handleTimeRangeChange = () => {
      const timeRange = getTimeRange();
      const { startDateValue, endDateValue } = calculateDatesFromTimeRange(timeRange);
      setStartDate(startDateValue);
      setEndDate(endDateValue);
    };

    window.addEventListener('timeRangeChanged', handleTimeRangeChange);
    
    return () => {
      window.removeEventListener('timeRangeChanged', handleTimeRangeChange);
    };
  }, []);

  // Fetch network operations data when dates change
  const fetchData = useCallback(async () => {
    if (!startDate || !endDate) return;
    
    setLoading(true);
    setError('');
    
    try {
      const token = authService.getToken();
      if (!token) {
        throw new Error("No authentication token found");
      }
      
      // Format dates in UTC
      const beginDateISO = startDate.toISOString();
      const endDateISO = endDate.toISOString();

      const payload = {
        "Datasource": "network_operations",
        "Metrics": [
          "network_operations_bid_requests",
          "network_operations_bid_responses",
          "network_operations_impressions",
          "network_operations_price_publisher",
          "network_operations_ecpm_publisher",
          "network_operations_price_advertiser",
          "network_operations_ecpm_advertiser",
          "PartnerName"
        ],
        "OrderBy": "network_operations_price_publisher",
        "OrderOp": "DESC",
        "TimeZone": "Etc/GMT",
        "Size": 10000,
        "Granularity": {
          "type": "period",
          "period": "P1D"
        },
        "Intervals": [
          {
            "Begin": beginDateISO,
            "End": endDateISO
          }
        ]
      };

      let response;
      try {
        response = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-ayl-auth-token": token
          },
          body: JSON.stringify(payload)
        });
      } catch (fetchError) {
        // Network error (CORS, connection failed, etc.)
        throw { error: fetchError, response: null };
      }

      if (!response.ok) {
        throw { error: new Error(`HTTP error! status: ${response.status}`), response };
      }

      const responseData = await response.json();
      
      // Process data - aggregate by partner name (since we use P1D granularity)
      const aggregated = {};
      
      let dataArray = [];
      if (Array.isArray(responseData)) {
        dataArray = responseData;
      } else if (responseData.Data && Array.isArray(responseData.Data)) {
        dataArray = responseData.Data;
      }
      
      dataArray.forEach(item => {
        const partnerName = item.Name_Partner || item.PartnerName || item.partnerName || 'Unknown Partner';
        if (!partnerName || partnerName === 'Unknown Partner') return;
        
        if (!aggregated[partnerName]) {
          aggregated[partnerName] = {
            partnerName: partnerName,
            network_operations_bid_requests: 0,
            network_operations_bid_responses: 0,
            network_operations_impressions: 0,
            network_operations_price_publisher: 0,
            network_operations_price_advertiser: 0
            // eCPM will be calculated from aggregated values, not stored
          };
        }
        
        aggregated[partnerName].network_operations_bid_requests += item.network_operations_bid_requests || 0;
        aggregated[partnerName].network_operations_bid_responses += item.network_operations_bid_responses || 0;
        aggregated[partnerName].network_operations_impressions += item.network_operations_impressions || 0;
        aggregated[partnerName].network_operations_price_publisher += item.network_operations_price_publisher || 0;
        aggregated[partnerName].network_operations_price_advertiser += item.network_operations_price_advertiser || 0;
        // eCPM will be calculated from aggregated values, not summed
      });
      
      // Convert to array and sort by price_publisher descending
      const sortedData = Object.values(aggregated).sort((a, b) => 
        (b.network_operations_price_publisher || 0) - (a.network_operations_price_publisher || 0)
      );
      
      setData(sortedData);
    } catch (err) {
      console.error('Error fetching data:', err);
      const errorMessage = formatError(err.error || err, err.response);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  // Fetch data when dates change
  useEffect(() => {
    if (startDate && endDate) {
      fetchData();
    }
  }, [startDate, endDate, fetchData]);

  // Format number with commas
  const formatNumber = (value) => {
    return new Intl.NumberFormat('en-US').format(value || 0);
  };

  const formatCurrency = formatCurrencyRaw;

  // Calculate eCPM (Revenue per Thousand Impressions)
  // Formula: (PricePublisher / Impressions) * 1000
  const calculateECPM = (pricePublisher, impressions) => {
    if (!impressions || impressions === 0) return 0;
    return (pricePublisher / impressions) * 1000;
  };

  const formatECPM = formatEcpm;

  // Calculate RPBR/M (Revenue Per Million Bid Requests)
  // Formula: (PricePublisher / Bid Requests) * 1,000,000
  const calculateRPBRM = (pricePublisher, bidRequests) => {
    if (!bidRequests || bidRequests === 0) return '0.00';
    return ((pricePublisher / bidRequests) * 1000000).toFixed(2);
  };

  // Get color class for RPBR/M based on value
  const getRPBRMColor = (pricePublisher, bidRequests) => {
    if (!bidRequests || bidRequests === 0) return 'text-slate-900';
    const rpbrValue = (pricePublisher / bidRequests) * 1000000;
    if (rpbrValue > 2) return 'text-green-700 font-semibold'; // Vert foncé
    if (rpbrValue >= 1) return 'text-green-600 font-medium'; // Vert
    if (rpbrValue >= 0.5) return 'text-orange-600 font-medium'; // Orange
    return 'text-red-700 font-semibold'; // Rouge foncé
  };

  // Calculate Fill Rate (Impressions / Bid Requests * 100)
  const calculateFillRate = (impressions, bidRequests) => {
    if (!bidRequests || bidRequests === 0) return '0.00';
    return ((impressions / bidRequests) * 100).toFixed(2);
  };

  // Calculate Win Rate (Bid Responses / Bid Requests * 100)
  const calculateWinRate = (bidResponses, bidRequests) => {
    if (!bidRequests || bidRequests === 0) return '0.00';
    return ((bidResponses / bidRequests) * 100).toFixed(2);
  };

  // Get number of days from time range for QPS calculation
  const getNumberOfDays = () => {
    const timeRange = getTimeRange();
    switch (timeRange) {
      case 'Today':
        return 1;
      case 'Yesterday':
        return 2; // Yesterday includes yesterday and today data
      case '7d':
        return 8;
      case '14d':
        return 15;
      case '30d':
        return 31;
      default:
        return 8; // Default to 7d
    }
  };

  // Calculate QPS (Queries Per Second) = Bid Requests / (86400 * number of days)
  const calculateQPS = (bidRequests) => {
    if (!bidRequests || bidRequests === 0) return '0';
    const numberOfDays = getNumberOfDays();
    const totalSeconds = 86400 * numberOfDays;
    return Math.round(bidRequests / totalSeconds).toFixed(0);
  };

  // Calculate Margin = DSP Revenue - Publisher Cost
  const calculateMargin = (dspRevenue, publisherCost) => {
    return (dspRevenue || 0) - (publisherCost || 0);
  };

  // Calculate % Margin = (Margin / DSP Revenue) * 100
  const calculateMarginPercent = (dspRevenue, publisherCost) => {
    if (!dspRevenue || dspRevenue === 0) return '0.00';
    const margin = calculateMargin(dspRevenue, publisherCost);
    return ((margin / dspRevenue) * 100).toFixed(2);
  };

  // Filter data based on search term
  const filteredData = data.filter(item => {
    if (!searchTerm) return true;
    const partnerName = (item.partnerName || '').toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    return partnerName.includes(searchLower);
  });

  // Sort data
  const sortedData = [...filteredData].sort((a, b) => {
    let aValue, bValue;
    
    switch (sortConfig.key) {
      case 'partnerName':
        aValue = a.partnerName || '';
        bValue = b.partnerName || '';
        break;
      case 'rpbr':
        aValue = parseFloat(calculateRPBRM(a.network_operations_price_publisher, a.network_operations_bid_requests));
        bValue = parseFloat(calculateRPBRM(b.network_operations_price_publisher, b.network_operations_bid_requests));
        break;
      case 'rpbr_adv':
        aValue = parseFloat(calculateRPBRM(a.network_operations_price_advertiser, a.network_operations_bid_requests));
        bValue = parseFloat(calculateRPBRM(b.network_operations_price_advertiser, b.network_operations_bid_requests));
        break;
      case 'fillRate':
        aValue = parseFloat(calculateFillRate(a.network_operations_impressions, a.network_operations_bid_requests));
        bValue = parseFloat(calculateFillRate(b.network_operations_impressions, b.network_operations_bid_requests));
        break;
      case 'winRate':
        aValue = parseFloat(calculateWinRate(a.network_operations_bid_responses, a.network_operations_bid_requests));
        bValue = parseFloat(calculateWinRate(b.network_operations_bid_responses, b.network_operations_bid_requests));
        break;
      case 'ecpm':
        aValue = calculateECPM(a.network_operations_price_publisher, a.network_operations_impressions);
        bValue = calculateECPM(b.network_operations_price_publisher, b.network_operations_impressions);
        break;
      case 'ecpm_adv':
        aValue = calculateECPM(a.network_operations_price_advertiser, a.network_operations_impressions);
        bValue = calculateECPM(b.network_operations_price_advertiser, b.network_operations_impressions);
        break;
      case 'qps':
        aValue = parseFloat(calculateQPS(a.network_operations_bid_requests));
        bValue = parseFloat(calculateQPS(b.network_operations_bid_requests));
        break;
      case 'margin':
        aValue = calculateMargin(a.network_operations_price_advertiser, a.network_operations_price_publisher);
        bValue = calculateMargin(b.network_operations_price_advertiser, b.network_operations_price_publisher);
        break;
      case 'marginPercent':
        aValue = parseFloat(calculateMarginPercent(a.network_operations_price_advertiser, a.network_operations_price_publisher));
        bValue = parseFloat(calculateMarginPercent(b.network_operations_price_advertiser, b.network_operations_price_publisher));
        break;
      default:
        aValue = a[sortConfig.key] || 0;
        bValue = b[sortConfig.key] || 0;
    }
    
    // Handle numeric values
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    // Handle string values
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortConfig.direction === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    
    // Handle null/undefined
    if (aValue == null) return 1;
    if (bValue == null) return -1;
    
    return 0;
  });

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = sortedData.slice(startIndex, endIndex);
  
  // Handle sort
  const handleSort = (sortKey) => {
    const direction = sortConfig.key === sortKey && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key: sortKey, direction });
    setCurrentPage(1); // Reset to first page when sorting
  };
  
  // Render sortable header
  const renderSortableHeader = (label, sortKey, className = '') => {
    const isSorted = sortConfig.key === sortKey;
    const direction = sortConfig.direction;
    
    return (
      <TableHead 
        className={`${className} cursor-pointer hover:bg-slate-100 select-none text-xs`}
        onClick={() => handleSort(sortKey)}
      >
        <div className="flex items-center justify-end gap-1">
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

  // Update total count when data changes
  useEffect(() => {
    setTotalCount(sortedData.length);
  }, [sortedData.length]);

  // Reset to first page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Export table to CSV
  const exportToCSV = () => {
    if (sortedData.length === 0) return;

    const headers = [
      'Rank',
      'Partner Name',
      'Bid Requests',
      'QPS',
      'Bid Responses',
      'Impressions',
      'DSP Revenue',
      'DSP RPBR/M',
      'DSP eCPM',
      'Publisher Cost',
      'Publisher RPBR/M',
      'Publisher eCPM',
      'Margin',
      '% Margin',
      'Fill Rate (%)',
      'Win Rate (%)'
    ];

    const rows = sortedData.map((item, index) => {
      const rpbr = calculateRPBRM(item.network_operations_price_publisher, item.network_operations_bid_requests);
      const rpbrAdv = calculateRPBRM(item.network_operations_price_advertiser, item.network_operations_bid_requests);
      const fillRate = calculateFillRate(item.network_operations_impressions, item.network_operations_bid_requests);
      const winRate = calculateWinRate(item.network_operations_bid_responses, item.network_operations_bid_requests);
      const ecpm = calculateECPM(item.network_operations_price_publisher, item.network_operations_impressions);
      const ecpmAdv = calculateECPM(item.network_operations_price_advertiser, item.network_operations_impressions);
      const qps = calculateQPS(item.network_operations_bid_requests);

      const margin = calculateMargin(item.network_operations_price_advertiser, item.network_operations_price_publisher);
      const marginPercent = calculateMarginPercent(item.network_operations_price_advertiser, item.network_operations_price_publisher);

      return [
        (index + 1).toString(),
        item.partnerName || 'Unknown',
        item.network_operations_bid_requests.toString(),
        qps,
        item.network_operations_bid_responses.toString(),
        item.network_operations_impressions.toString(),
        item.network_operations_price_advertiser.toString(),
        rpbrAdv,
        ecpmAdv.toFixed(2),
        item.network_operations_price_publisher.toString(),
        rpbr,
        ecpm.toFixed(2),
        margin.toFixed(2),
        marginPercent,
        fillRate,
        winRate
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
    link.setAttribute('download', `dsp-profitability-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-50 flex flex-col min-h-screen">
      <div className="flex flex-col p-3 space-y-6">
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2" style={{ color: 'rgb(30, 47, 130)' }}>
              <TrendingUp className="w-5 h-5 text-[rgb(75,99,226)]" />
              Top Entities by Revenue
            </CardTitle>
            {sortedData.length > 0 && (
              <Button
                onClick={exportToCSV}
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
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[rgb(75,99,226)]" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center text-xs">#</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-slate-100 select-none text-xs"
                    onClick={() => handleSort('partnerName')}
                  >
                    <div className="flex items-center gap-1">
                      <span>Partner Name</span>
                      {sortConfig.key === 'partnerName' ? (
                        sortConfig.direction === 'asc' ? (
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
                  {renderSortableHeader('Bid Requests', 'network_operations_bid_requests', 'text-right')}
                  {renderSortableHeader('QPS', 'qps', 'text-right')}
                  {renderSortableHeader('Bid Responses', 'network_operations_bid_responses', 'text-right')}
                  {renderSortableHeader('Impressions', 'network_operations_impressions', 'text-right')}
                  {renderSortableHeader('DSP Revenue', 'network_operations_price_advertiser', 'text-right')}
                  {renderSortableHeader('DSP RPBR/M', 'rpbr_adv', 'text-right')}
                  {renderSortableHeader('DSP eCPM', 'ecpm_adv', 'text-right')}
                  {renderSortableHeader('Publisher Cost', 'network_operations_price_publisher', 'text-right')}
                  {renderSortableHeader('Publisher RPBR/M', 'rpbr', 'text-right')}
                  {renderSortableHeader('Publisher eCPM', 'ecpm', 'text-right')}
                  {renderSortableHeader('Margin', 'margin', 'text-right')}
                  {renderSortableHeader('% Margin', 'marginPercent', 'text-right')}
                  {renderSortableHeader('Fill Rate (%)', 'fillRate', 'text-right')}
                  {renderSortableHeader('Win Rate (%)', 'winRate', 'text-right')}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={16} className="text-center py-8 text-slate-500">
                      {data.length === 0 ? 'No data available' : 'No results match your search'}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map((item, index) => (
                    <TableRow key={item.partnerName} className="hover:bg-[rgb(75,99,226)]/10">
                      <TableCell className="text-center text-xs">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          #{startIndex + index + 1}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-[rgb(75,99,226)] to-[rgb(75,99,226)] rounded-lg flex items-center justify-center">
                            <span className="text-white text-sm font-bold">
                              {(item.partnerName || 'U').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">
                              {item.partnerName || 'Unknown Partner'}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs">
                        {formatNumber(item.network_operations_bid_requests)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs">
                        {calculateQPS(item.network_operations_bid_requests)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs">
                        {formatNumber(item.network_operations_bid_responses)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs">
                        {formatNumber(item.network_operations_impressions)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600 text-xs">
                        {formatCurrency(item.network_operations_price_advertiser)}
                      </TableCell>
                      <TableCell className={`text-right font-medium text-xs ${getRPBRMColor(item.network_operations_price_advertiser, item.network_operations_bid_requests)}`}>
                        ${calculateRPBRM(item.network_operations_price_advertiser, item.network_operations_bid_requests)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs">
                        {formatECPM(calculateECPM(item.network_operations_price_advertiser, item.network_operations_impressions))}
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600 text-xs">
                        {formatCurrency(item.network_operations_price_publisher)}
                      </TableCell>
                      <TableCell className={`text-right font-medium text-xs ${getRPBRMColor(item.network_operations_price_publisher, item.network_operations_bid_requests)}`}>
                        ${calculateRPBRM(item.network_operations_price_publisher, item.network_operations_bid_requests)}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs">
                        {formatECPM(calculateECPM(item.network_operations_price_publisher, item.network_operations_impressions))}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs" style={{ color: 'rgb(79, 70, 229)' }}>
                        {formatCurrency(calculateMargin(item.network_operations_price_advertiser, item.network_operations_price_publisher))}
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs">
                        {calculateMarginPercent(item.network_operations_price_advertiser, item.network_operations_price_publisher)}%
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs">
                        {calculateFillRate(item.network_operations_impressions, item.network_operations_bid_requests)}%
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs">
                        {calculateWinRate(item.network_operations_bid_responses, item.network_operations_bid_requests)}%
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Fixed Footer with Pagination */}
      {totalCount > 0 && (
        <div className="border-t border-slate-200 bg-white px-3 flex items-center justify-between flex-shrink-0 sticky bottom-0 z-10 shadow-sm w-full left-0 right-0" style={{ height: '80px' }}>
          <div className="text-sm text-slate-600">
            Showing {startIndex + 1} to {Math.min(endIndex, totalCount)} of {totalCount} {totalCount === 1 ? 'partner' : 'partners'}
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

