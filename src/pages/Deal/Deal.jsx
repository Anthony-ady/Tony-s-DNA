import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Progress } from '../../components/ui/progress';
import { Loader2, Building2, BarChart3, Edit, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { formatError } from '../../utils/errorFormatter';
import { API_ENDPOINTS } from '@/config/api';

export default function Deal() {
  const navigate = useNavigate();
  const [deals, setDeals] = useState([]);
  const [allDeals, setAllDeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Search term is now managed in Layout header
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(20);

  // Get auth token
  const authToken = authService.getToken();
  
  // Listen for search term changes from Layout header via window event
  useEffect(() => {
    const handleSearchChange = (event) => {
      const term = event.detail || '';
      setSearchTerm(term);
    };
    
    window.addEventListener('dealSearchChanged', handleSearchChange);
    
    return () => {
      window.removeEventListener('dealSearchChanged', handleSearchChange);
    };
  }, []);
  
  // Handle search with debouncing when searchTerm changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSearch();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Get selected realm from localStorage (managed by Layout header)
  const getSelectedRealmId = () => {
    return localStorage.getItem('selected-realm-id') || '';
  };

  // Fetch deals data
  const fetchDeals = async () => {
    if (!authToken) {
      setError('Authentication required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const selectedRealmId = getSelectedRealmId();
      
      // Build filters - include realm filter if one is selected
      const filters = [];
      if (selectedRealmId) {
        filters.push({ Field: "Realm_uid", Operator: "match", Value: selectedRealmId });
      }
      
      const payload = {
        Filters: filters,
        From: 0,
        Order: [{ Field: "UpdatedAt", Operator: "desc" }],
        Size: 250 // Get first 250 deals
      };

      let response;
      try {
        response = await fetch(API_ENDPOINTS.DEALS_SEARCH, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-ayl-auth-token': authToken
          },
          body: JSON.stringify(payload)
        });
      } catch (fetchError) {
        // Network error (CORS, connection failed, etc.)
        throw { error: fetchError, response: null };
      }

      if (!response.ok) {
        if (response.status === 401) {
          setError('Session expired. Please log in again.');
          setLoading(false);
          authService.logout?.();
          navigate('/Login');
          return;
        }
        throw { error: new Error(`HTTP error! status: ${response.status}`), response };
      }

      const data = await response.json();
      console.log('Deals API response:', data); // Debug

      if (data.Data) {
        setAllDeals(data.Data);
        setTotalCount(data.TotalCount || data.Data.length);
        // Update current page data
        updateCurrentPageData(data.Data);
      } else {
        setAllDeals([]);
        setDeals([]);
        setTotalCount(0);
      }
    } catch (err) {
      console.error('Error fetching deals:', err);
      const errorMessage = formatError(err.error || err, err.response);
      setError(errorMessage);
      setAllDeals([]);
      setDeals([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  // Update current page data based on pagination
  const updateCurrentPageData = (data = allDeals, page = currentPage) => {
    const startIndex = page * pageSize;
    const endIndex = startIndex + pageSize;
    setDeals(data.slice(startIndex, endIndex));
  };

  // Load deals on component mount
  useEffect(() => {
    fetchDeals();
  }, []);

  // Reload deals when realm selection changes in header
  useEffect(() => {
    const handleStorageChange = () => {
      fetchDeals();
    };

    // Listen for custom event when realm changes
    window.addEventListener('realmChanged', handleStorageChange);
    
    // Also listen for storage events from other tabs
    window.addEventListener('storage', (e) => {
      if (e.key === 'selected-realm-id') {
        fetchDeals();
      }
    });

    return () => {
      window.removeEventListener('realmChanged', handleStorageChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Handle search
  const handleSearch = () => {
    const filtered = allDeals.filter(deal =>
      deal.Name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deal.Uid?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setTotalCount(filtered.length);
    setCurrentPage(0);
    updateCurrentPageData(filtered, 0);
  };

  // Handle pagination
  const handlePageChange = (newPage) => {
    const clampedPage = Math.max(0, Math.min(newPage, totalPages - 1));
    setCurrentPage(clampedPage);
    updateCurrentPageData(allDeals, clampedPage);
  };

  const getStatusBadgeColor = (access) => {
    switch (access) {
      case 'ALL':
        return 'bg-green-100 text-green-800';
      case 'DISABLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (access) => {
    switch (access) {
      case 'ALL':
        return 'ON';
      case 'DISABLED':
        return 'OFF';
      default:
        return 'Unknown';
    }
  };

  // Format date with time for Started At and Finished At
  const formatDateTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const calculateProgress = (startedAt, finishedAt) => {
    if (!startedAt) {
      return { value: 0, statusLabel: 'Not started', daysLabel: 'No start date', color: getProgressColor(0) };
    }

    const startDate = new Date(startedAt);
    if (Number.isNaN(startDate.getTime())) {
      return { value: 0, statusLabel: 'Not started', daysLabel: 'Invalid start date', color: getProgressColor(0) };
    }

    const now = new Date();
    const msPerDay = 1000 * 60 * 60 * 24;
    const formatDays = (differenceMs) => {
      const days = Math.ceil(differenceMs / msPerDay);
      if (days <= 0) {
        return '0 day left';
      }
      return days === 1 ? '1 day left' : `${days} days left`;
    };

    if (finishedAt) {
      const finishDate = new Date(finishedAt);
      if (!Number.isNaN(finishDate.getTime())) {
        if (now >= finishDate || finishDate <= startDate) {
          return { value: 100, statusLabel: 'Finished', daysLabel: '0 day left', color: getProgressColor(100) };
        }

        const totalDuration = finishDate.getTime() - startDate.getTime();
        const elapsedDuration = Math.max(0, Math.min(now.getTime() - startDate.getTime(), totalDuration));
        const percent = Math.round((elapsedDuration / totalDuration) * 100);
        const remainingMs = finishDate.getTime() - now.getTime();

        return {
          value: percent,
          statusLabel: `${percent}%`,
          daysLabel: formatDays(remainingMs),
          color: getProgressColor(percent)
        };
      }
    }

    if (now < startDate) {
      return {
        value: 0,
        statusLabel: 'Scheduled',
        daysLabel: formatDays(startDate.getTime() - now.getTime()),
        color: getProgressColor(0)
      };
    }

    return {
      value: 0,
      statusLabel: 'In progress',
      daysLabel: finishedAt ? 'No finish date' : 'No finish date',
      color: getProgressColor(0)
    };
  };

  const getProgressColor = (value) => {
    const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
    if (clamped <= 85) {
      return `hsl(120, 85%, 35%)`;
    }

    const ratio = (clamped - 85) / 15; // 0 at 85%, 1 at 100%
    const hue = 120 * (1 - ratio); // transition from green (120) to red (0)
    return `hsl(${hue}, 85%, 35%)`;
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="bg-slate-50 flex flex-col min-h-screen">
      <div className="flex flex-col p-3">
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6 border-red-200 bg-red-50">
            <AlertCircle className="h-5 w-5" />
            <AlertDescription className="text-red-800 font-medium">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="flex items-center justify-center py-16">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-slate-600 mx-auto mb-4" />
                <p className="text-slate-600 font-medium">Loading deals...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Deals Table */}
        {!loading && deals.length > 0 && (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200">
                      <TableHead className="text-slate-700 font-semibold max-w-xs">Name</TableHead>
                      <TableHead className="text-slate-700 font-semibold">Status</TableHead>
                      <TableHead className="text-slate-700 font-semibold w-44">Progress</TableHead>
                      <TableHead className="text-slate-700 font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deals.map((deal) => {
                      const progress = calculateProgress(deal.StartedAt, deal.FinishedAt);
                      return (
                      <TableRow key={deal.Uid} className="border-slate-100 hover:bg-slate-50">
                        <TableCell className="font-medium text-slate-900 max-w-xs">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-[rgb(75,99,226)] to-[rgb(75,99,226)] rounded-lg flex items-center justify-center flex-shrink-0">
                              <Building2 className="w-4 h-4 text-white" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div 
                                className="hover:text-[rgb(75,99,226)] cursor-pointer transition-colors truncate block"
                                title={deal.Name || 'Unnamed Deal'}
                                onClick={() => navigate(`/EditDeal?id=${deal.Uid}&name=${encodeURIComponent(deal.Name || 'Unnamed Deal')}`)}
                              >
                                {deal.Name || 'Unnamed Deal'}
                              </div>
                              <div className="text-xs text-slate-500 font-mono truncate">
                                {deal.Uid}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(deal.Access)}>
                            {getStatusText(deal.Access)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[140px]">
                            <Progress
                              value={progress.value}
                              className="h-2 bg-slate-200"
                              indicatorStyle={{ backgroundColor: progress.color }}
                            />
                            <div className="mt-2 flex items-center justify-between text-xs">
                              <span className="font-medium text-slate-500">
                                {progress.statusLabel}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {progress.daysLabel}
                              </span>
                          </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/DealAnalytics?id=${deal.Uid}&name=${encodeURIComponent(deal.Name || 'Unnamed Deal')}`)}
                              className="hover:bg-slate-50 hover:border-slate-300"
                            >
                              <BarChart3 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/EditDeal?id=${deal.Uid}&name=${encodeURIComponent(deal.Name || 'Unnamed Deal')}`)}
                              className="hover:bg-slate-50 hover:border-slate-300"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!loading && deals.length === 0 && !error && (
          <Card className="border-slate-200 shadow-sm border-dashed">
            <CardContent className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-500 font-medium text-lg">
                  No deals found
                </p>
                <p className="text-slate-400 text-sm mt-1">
                  {searchTerm 
                    ? 'Try adjusting your search criteria' 
                    : 'No deals are available'
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Fixed Footer with Pagination */}
      {totalCount > 0 && (
        <div className="border-t border-slate-200 bg-white px-3 flex items-center justify-between flex-shrink-0 sticky bottom-0 z-10 shadow-sm w-full left-0 right-0" style={{ height: '80px' }}>
          <div className="text-sm text-slate-600">
            Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, totalCount)} of {totalCount} deals
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 0 || loading}
              className="hover:bg-slate-50 hover:border-slate-300"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <span className="text-sm text-slate-600">
              Page {currentPage + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages - 1 || loading}
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
