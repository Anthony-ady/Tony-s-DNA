import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Loader2, Globe, Calendar, BarChart3, Edit, ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { API_ENDPOINTS } from '@/config/api';
import { cn } from '@/lib/utils';

const REALM_CACHE_STORAGE_KEY = 'ady-realms-search-cache';

export default function Realm() {
  const navigate = useNavigate();
  const [realms, setRealms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(20);

  const authToken = authService.getToken();
  const realmCacheRef = useRef({ key: null, data: [], totalCount: 0, page: 0 });

  // Listen for search term changes from Layout header via window event
  useEffect(() => {
    const handleSearchChange = (event) => {
      const term = event.detail || '';
      setSearchTerm(term);
    };
    
    window.addEventListener('realmSearchChanged', handleSearchChange);
    
    return () => {
      window.removeEventListener('realmSearchChanged', handleSearchChange);
    };
  }, []);

  // Header refresh: clear caches and reload full realm list (Layout clears search input separately)
  useEffect(() => {
    const handleSupplyRealmListReset = () => {
      try {
        sessionStorage.removeItem(REALM_CACHE_STORAGE_KEY);
      } catch (_) {}
      realmCacheRef.current = { key: null, data: [], totalCount: 0, page: 0 };
      setSearchTerm('');
      fetchRealms(0, '', true);
    };
    window.addEventListener('supplyRealmListReset', handleSupplyRealmListReset);
    return () => window.removeEventListener('supplyRealmListReset', handleSupplyRealmListReset);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listener intentionally stable; fetchRealms uses latest closure via re-mount semantics not needed for global UI reset
  }, []);
  
  // Handle search with debouncing when searchTerm changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchRealms(0, searchTerm);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const fetchRealms = async (page = 0, search = '', forceRefresh = false) => {
    if (!authToken) {
      setError('Authentication required');
      return;
    }

    const cacheKey = JSON.stringify({ search, page });

    if (!forceRefresh) {
      if (realmCacheRef.current.key === cacheKey && Array.isArray(realmCacheRef.current.data)) {
        setRealms(realmCacheRef.current.data);
        setTotalCount(realmCacheRef.current.totalCount);
        setCurrentPage(realmCacheRef.current.page);
        setError('');
        return;
      }
      try {
        const raw = sessionStorage.getItem(REALM_CACHE_STORAGE_KEY);
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached.key === cacheKey && Array.isArray(cached.data)) {
            realmCacheRef.current = { key: cached.key, data: cached.data, totalCount: cached.totalCount ?? 0, page: cached.page ?? 0 };
            setRealms(cached.data);
            setTotalCount(cached.totalCount ?? 0);
            setCurrentPage(cached.page ?? 0);
            setError('');
            return;
          }
        }
      } catch (_) {}
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        Filters: search ? [{ Field: "Name", Operator: "contains", Value: search }] : [],
        From: page * pageSize,
        Order: [{ Field: "UpdatedAt", Operator: "desc" }],
        Size: pageSize
      };

      const response = await fetch(API_ENDPOINTS.REALMS_SEARCH, {
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
      const list = data.Data || [];
      const total = data.Total || 0;
      realmCacheRef.current = { key: cacheKey, data: list, totalCount: total, page };
      try {
        sessionStorage.setItem(REALM_CACHE_STORAGE_KEY, JSON.stringify({ key: cacheKey, data: list, totalCount: total, page }));
      } catch (_) {}
      setRealms(list);
      setTotalCount(total);
      setCurrentPage(page);
    } catch (err) {
      console.error('Error fetching realms:', err);
      setError(err.message || 'Failed to fetch realms data');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchRealms();
  }, [authToken]);

  const handleSearch = () => {
    fetchRealms(0, searchTerm);
  };

  const handlePageChange = (newPage) => {
    fetchRealms(newPage, searchTerm);
  };

  const handleRefresh = () => {
    fetchRealms(currentPage, searchTerm, true);
  };

  // Format date
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get visibility badge
  const getVisibilityBadge = (visibility) => {
    switch (visibility) {
      case 0:
        return <Badge variant="secondary" className="bg-slate-100 text-slate-700">Private</Badge>;
      case 1:
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700">Public</Badge>;
      default:
        return <Badge variant="secondary" className="bg-gray-100 text-gray-700">Unknown</Badge>;
    }
  };

  return (
    <div className="min-h-full bg-slate-50 flex flex-col">
      <div className="flex flex-col p-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold text-slate-900">Realms</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
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
                <p className="text-slate-600 font-medium">Loading realms...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Realms Table */}
        {!loading && realms.length > 0 && (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200">
                      <TableHead className="text-slate-700 font-semibold">Name</TableHead>
                      <TableHead className="text-slate-700 font-semibold">Updated At</TableHead>
                      <TableHead className="text-slate-700 font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {realms.map((realm) => (
                      <TableRow 
                        key={realm.Uid} 
                        className="border-slate-100 hover:bg-slate-50 cursor-pointer"
                        onClick={() => navigate(`/EditRealm?id=${realm.Uid}&name=${encodeURIComponent(realm.Name || 'Unnamed Realm')}`)}
                      >
                        <TableCell className="font-medium text-slate-900">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-[rgb(75,99,226)] to-[rgb(75,99,226)] rounded-lg flex items-center justify-center">
                              <Globe className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex flex-col">
                              <span className="hover:text-[rgb(75,99,226)] transition-colors">
                                {realm.Name || 'Unnamed Realm'}
                              </span>
                              <span className="text-xs text-slate-400 font-mono">{realm.Uid}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-600">
                          <div className="flex items-center space-x-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <span>{formatDate(realm.UpdatedAt)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/RealmAnalytics?id=${realm.Uid}&name=${encodeURIComponent(realm.Name || 'Unnamed Realm')}`);
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
                                navigate(`/EditRealm?id=${realm.Uid}&name=${encodeURIComponent(realm.Name || 'Unnamed Realm')}`);
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
        {!loading && realms.length === 0 && !error && (
          <Card className="border-slate-200 shadow-sm border-dashed">
            <CardContent className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Globe className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-500 font-medium text-lg">No realms found</p>
                <p className="text-slate-400 text-sm mt-1">
                  {searchTerm ? 'Try adjusting your search criteria' : 'No realms are available at the moment'}
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
            Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, totalCount)} of {totalCount} realms
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