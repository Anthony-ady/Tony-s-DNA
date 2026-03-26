import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, Target, BarChart3, Edit, ChevronLeft, ChevronRight, Monitor, Phone, Tablet, Tv, AlertCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/authService';
import { API_ENDPOINTS } from '@/config/api';
import { cn } from '@/lib/utils';

const PLACEMENT_CACHE_STORAGE_KEY = 'ady-placements-search-cache';

export default function Placement() {
  const navigate = useNavigate();
  const [allPlacements, setAllPlacements] = useState([]); // Store all data
  const [placements, setPlacements] = useState([]); // Current page data
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(20);

  const authToken = authService.getToken();
  const isMountedRef = useRef(false);
  const fetchPlacementsRef = useRef(null);
  const initialLoadDoneRef = useRef(false);
  const placementCacheRef = useRef({ key: null, data: [], totalCount: 0 });
  const paginationRef = useRef({ currentPage: 0, pageSize: 20 });

  // Get selected realm and company from localStorage (managed by Layout header)
  const getSelectedRealmId = () => {
    return localStorage.getItem('selected-realm-id') || '';
  };
  
  const getSelectedCompanyId = () => {
    return localStorage.getItem('selected-company-id') || '';
  };

  const applyCachedPlacements = useCallback((cachedData, cachedTotal) => {
    const { currentPage: page, pageSize: size } = paginationRef.current;
    setAllPlacements(cachedData);
    setTotalCount(cachedTotal);
    setError('');
    const startIndex = page * size;
    const endIndex = startIndex + size;
    setPlacements(cachedData.slice(startIndex, endIndex));
  }, []);

  // Memoize fetchPlacements to avoid recreating it on every render
  const fetchPlacements = useCallback(async (search = '', forceRefresh = false) => {
    if (!authToken) {
      setError('Authentication required');
      return;
    }

    const selectedRealmId = getSelectedRealmId();
    const selectedCompanyId = getSelectedCompanyId();
    const cacheKey = JSON.stringify({ realm: selectedRealmId, company: selectedCompanyId, search });

    if (!forceRefresh) {
      if (placementCacheRef.current.key === cacheKey && Array.isArray(placementCacheRef.current.data)) {
        applyCachedPlacements(placementCacheRef.current.data, placementCacheRef.current.totalCount);
        return;
      }
      try {
        const raw = sessionStorage.getItem(PLACEMENT_CACHE_STORAGE_KEY);
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached.key === cacheKey && Array.isArray(cached.data)) {
            placementCacheRef.current = { key: cached.key, data: cached.data, totalCount: cached.totalCount ?? 0 };
            applyCachedPlacements(cached.data, cached.totalCount ?? cached.data.length);
            return;
          }
        }
      } catch (_) {}
    }

    setLoading(true);
    setError('');

    try {
      const filters = [];
      if (selectedRealmId) {
        filters.push({ Field: "Realm_uid", Operator: "match", Value: selectedRealmId });
      }
      if (search) {
        filters.push({ Field: "Name", Operator: "contains", Value: search });
      }
      if (selectedCompanyId) {
        filters.push({ Field: "Company_uid", Operator: "match", Value: selectedCompanyId });
      }

      const payload = {
        Filters: filters,
        From: 0,
        Order: [{ Field: "UpdatedAt", Operator: "desc" }],
        Size: 1000
      };

      const response = await fetch(API_ENDPOINTS.PLACEMENTS_SEARCH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ayl-auth-token': authToken
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data && data.Data) {
        const list = data.Data;
        const total = data.TotalCount || list.length;
        placementCacheRef.current = { key: cacheKey, data: list, totalCount: total };
        try {
          sessionStorage.setItem(PLACEMENT_CACHE_STORAGE_KEY, JSON.stringify({ key: cacheKey, data: list, totalCount: total }));
        } catch (_) {}
        setAllPlacements(list);
        setTotalCount(total);
        updateCurrentPageData(list);
      } else {
        placementCacheRef.current = { key: cacheKey, data: [], totalCount: 0 };
        try {
          sessionStorage.setItem(PLACEMENT_CACHE_STORAGE_KEY, JSON.stringify({ key: cacheKey, data: [], totalCount: 0 }));
        } catch (_) {}
        setAllPlacements([]);
        setPlacements([]);
        setTotalCount(0);
      }
    } catch (err) {
      console.error('Error fetching placements:', err);
      setError(err.message);
      setAllPlacements([]);
      setPlacements([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [authToken, applyCachedPlacements]);

  // Store the function reference
  fetchPlacementsRef.current = fetchPlacements;

  // Listen for search term changes from Layout header via window event
  useEffect(() => {
    const handleSearchChange = (event) => {
      const term = event.detail || '';
      setSearchTerm(term);
    };
    
    window.addEventListener('placementSearchChanged', handleSearchChange);
    
    return () => {
      window.removeEventListener('placementSearchChanged', handleSearchChange);
    };
  }, []);
  
  // Handle search with debouncing when searchTerm changes
  // Skip initial mount to avoid duplicate call
  useEffect(() => {
    if (!initialLoadDoneRef.current) {
      return;
    }
    
    const timeoutId = setTimeout(() => {
      setCurrentPage(0);
      if (fetchPlacementsRef.current) {
        fetchPlacementsRef.current(searchTerm);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, fetchPlacements]);

  // Update current page data based on pagination
  const updateCurrentPageData = (data = allPlacements) => {
    const startIndex = currentPage * pageSize;
    const endIndex = startIndex + pageSize;
    setPlacements(data.slice(startIndex, endIndex));
  };

  // Load placements on component mount (only once)
  useEffect(() => {
    if (!initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      isMountedRef.current = true;
      fetchPlacements();
    }
  }, [fetchPlacements]);

  // Reload placements when realm or company selection changes in header
  useEffect(() => {
    if (!initialLoadDoneRef.current) {
      return;
    }

    const handleRealmChange = () => {
      if (fetchPlacementsRef.current) {
        fetchPlacementsRef.current(searchTerm);
      }
    };
    
    const handleCompanyChange = () => {
      if (fetchPlacementsRef.current) {
        fetchPlacementsRef.current(searchTerm);
      }
    };

    const handleStorageChange = (e) => {
      if (e.key === 'selected-realm-id' || e.key === 'selected-company-id') {
        if (fetchPlacementsRef.current) {
          fetchPlacementsRef.current(searchTerm);
        }
      }
    };

    // Listen for custom event when realm or company changes
    window.addEventListener('realmChanged', handleRealmChange);
    window.addEventListener('companyChanged', handleCompanyChange);
    
    // Also listen for storage events from other tabs
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('realmChanged', handleRealmChange);
      window.removeEventListener('companyChanged', handleCompanyChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [searchTerm, fetchPlacements]);

  paginationRef.current = { currentPage, pageSize };

  // Update current page data when page changes
  useEffect(() => {
    updateCurrentPageData();
  }, [currentPage, allPlacements]);

  const handleSearch = () => {
    setCurrentPage(0);
    fetchPlacements(searchTerm);
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  const getTrafficBadgeColor = (kind) => {
    switch (kind) {
      case 'SITE':
        return 'bg-blue-100 text-blue-800';
      case 'APP':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDeviceIcon = (device) => {
    switch (device) {
      case 'DESKTOP':
        return <Monitor className="w-4 h-4" />;
      case 'MOBILE':
        return <Phone className="w-4 h-4" />;
      case 'TABLET':
        return <Tablet className="w-4 h-4" />;
      case 'TV':
        return <Tv className="w-4 h-4" />;
      default:
        return <Monitor className="w-4 h-4" />;
    }
  };

  const renderDevices = (enabledDevices) => {
    if (!enabledDevices || !Array.isArray(enabledDevices)) {
      return <span className="text-slate-400">N/A</span>;
    }

    return (
      <div className="flex items-center gap-1">
        {enabledDevices.map((device, index) => (
          <TooltipProvider key={index}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center w-6 h-6 bg-slate-100 rounded text-slate-600 cursor-help">
                  {getDeviceIcon(device)}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{device}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    );
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="min-h-full bg-slate-50 flex flex-col">
      <div className="flex flex-col p-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold text-slate-900">Placements</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchPlacements(searchTerm, true)}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-3 border-red-200 bg-red-50">
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
                <p className="text-slate-600 font-medium">Loading placements...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Placements Table */}
        {!loading && placements.length > 0 && (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200">
                      <TableHead className="text-slate-700 font-semibold">Name</TableHead>
                      <TableHead className="text-slate-700 font-semibold">Status</TableHead>
                      <TableHead className="text-slate-700 font-semibold">Traffic</TableHead>
                      <TableHead className="text-slate-700 font-semibold">Device</TableHead>
                      <TableHead className="text-slate-700 font-semibold">Last Updated</TableHead>
                      <TableHead className="text-slate-700 font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {placements.map((placement, index) => (
                      <TableRow 
                        key={placement.Uid || index} 
                        className="border-slate-100 hover:bg-slate-50 cursor-pointer"
                        onClick={() => navigate(`/EditPlacement?id=${placement.Uid}&name=${encodeURIComponent(placement.Name || 'Unnamed Placement')}`)}
                      >
                        <TableCell className="font-medium max-w-xs">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-[rgb(75,99,226)] to-[rgb(75,99,226)] rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                              {placement.Name ? placement.Name.charAt(0).toUpperCase() : 'P'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div 
                                className="font-medium text-slate-900 truncate"
                                title={placement.Name || 'Unnamed Placement'}
                              >
                                {placement.Name || 'Unnamed Placement'}
                              </div>
                              <div className="text-sm text-slate-500 truncate">{placement.Uid}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(placement.Access)}>
                            {getStatusText(placement.Access)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getTrafficBadgeColor(placement.DistributionChannelKind)}>
                            {placement.DistributionChannelKind || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {renderDevices(placement.EnabledDevices)}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {formatDate(placement.UpdatedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/PlacementAnalytics?id=${placement.Uid}&name=${encodeURIComponent(placement.Name || 'Unnamed Placement')}`);
                              }}
                              className="hover:bg-slate-50 hover:border-slate-300"
                            >
                              <BarChart3 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/EditPlacement?id=${placement.Uid}&name=${encodeURIComponent(placement.Name || 'Unnamed Placement')}`);
                              }}
                              className="hover:bg-slate-50 hover:border-slate-300"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!loading && placements.length === 0 && !error && (
          <Card className="border-slate-200 shadow-sm border-dashed">
            <CardContent className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Target className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-500 font-medium text-lg">No placements found</p>
                <p className="text-slate-400 text-sm mt-1">
                  {searchTerm ? 'Try adjusting your search criteria' : 'No placements are available at the moment'}
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
            Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, totalCount)} of {totalCount} placements
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
              Page {currentPage + 1} of {Math.ceil(totalCount / pageSize)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= Math.ceil(totalCount / pageSize) - 1 || loading}
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
