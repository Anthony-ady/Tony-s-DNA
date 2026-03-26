import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Globe, BarChart3, Edit, ChevronLeft, ChevronRight, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/authService';
import { API_ENDPOINTS } from '@/config/api';
import { cn } from '@/lib/utils';

const SITES_CACHE_STORAGE_KEY = 'ady-sites-search-cache';

export default function Site() {
  const navigate = useNavigate();
  const [allSites, setAllSites] = useState([]); // Store all data
  const [sites, setSites] = useState([]); // Current page data
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(20);

  const authToken = authService.getToken();

  // In-memory cache (same session) + sessionStorage (survives page refresh in same tab)
  const sitesCacheRef = useRef({ key: null, data: [], totalCount: 0 });

  // Listen for search term changes from Layout header via window event
  useEffect(() => {
    const handleSearchChange = (event) => {
      const term = event.detail || '';
      setSearchTerm(term);
    };
    
    window.addEventListener('siteSearchChanged', handleSearchChange);
    
    return () => {
      window.removeEventListener('siteSearchChanged', handleSearchChange);
    };
  }, []);
  
  // Handle search with debouncing when searchTerm changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(0);
      fetchSites(searchTerm);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Get selected realm and company from localStorage (managed by Layout header)
  const getSelectedRealmId = () => {
    return localStorage.getItem('selected-realm-id') || '';
  };
  
  const getSelectedCompanyId = () => {
    return localStorage.getItem('selected-company-id') || '';
  };

  const fetchSites = async (search = '', forceRefresh = false) => {
    if (!authToken) {
      setError('Authentication required');
      return;
    }

    const selectedRealmId = getSelectedRealmId();
    const selectedCompanyId = getSelectedCompanyId();
    const cacheKey = JSON.stringify({ realm: selectedRealmId, company: selectedCompanyId, search });

    const applyCachedData = (cachedData, cachedTotal) => {
      setAllSites(cachedData);
      setTotalCount(cachedTotal);
      setError('');
      const startIndex = currentPage * pageSize;
      const endIndex = startIndex + pageSize;
      setSites(cachedData.slice(startIndex, endIndex));
    };

    // Use cache if same params and not forcing refresh (memory first, then sessionStorage for page refresh)
    if (!forceRefresh) {
      if (sitesCacheRef.current.key === cacheKey && Array.isArray(sitesCacheRef.current.data)) {
        applyCachedData(sitesCacheRef.current.data, sitesCacheRef.current.totalCount);
        return;
      }
      try {
        const raw = sessionStorage.getItem(SITES_CACHE_STORAGE_KEY);
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached.key === cacheKey && Array.isArray(cached.data)) {
            sitesCacheRef.current = { key: cached.key, data: cached.data, totalCount: cached.totalCount ?? 0 };
            applyCachedData(cached.data, cached.totalCount ?? cached.data.length);
            return;
          }
        }
      } catch (_) {
        // ignore invalid or missing cache
      }
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

      const response = await fetch(API_ENDPOINTS.SITES_SEARCH, {
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
        const total = data.TotalCount ?? list.length;
        sitesCacheRef.current = { key: cacheKey, data: list, totalCount: total };
        try {
          sessionStorage.setItem(SITES_CACHE_STORAGE_KEY, JSON.stringify({ key: cacheKey, data: list, totalCount: total }));
        } catch (_) {
          // quota or disabled; keep in-memory only
        }
        setAllSites(list);
        setTotalCount(total);
        updateCurrentPageData(list);
      } else {
        sitesCacheRef.current = { key: cacheKey, data: [], totalCount: 0 };
        try {
          sessionStorage.setItem(SITES_CACHE_STORAGE_KEY, JSON.stringify({ key: cacheKey, data: [], totalCount: 0 }));
        } catch (_) {}
        setAllSites([]);
        setSites([]);
        setTotalCount(0);
      }
    } catch (err) {
      console.error('Error fetching sites:', err);
      setError(err.message);
      setAllSites([]);
      setSites([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  // Update current page data based on pagination
  const updateCurrentPageData = (data = allSites) => {
    const startIndex = currentPage * pageSize;
    const endIndex = startIndex + pageSize;
    setSites(data.slice(startIndex, endIndex));
  };

  // Load sites on component mount
  useEffect(() => {
    fetchSites();
  }, []);

  // Reload sites when realm or company selection changes in header
  useEffect(() => {
    const handleRealmChange = () => {
      fetchSites(searchTerm);
    };
    
    const handleCompanyChange = () => {
      fetchSites(searchTerm);
    };

    // Listen for custom event when realm or company changes
    window.addEventListener('realmChanged', handleRealmChange);
    window.addEventListener('companyChanged', handleCompanyChange);
    
    // Also listen for storage events from other tabs
    window.addEventListener('storage', (e) => {
      if (e.key === 'selected-realm-id' || e.key === 'selected-company-id') {
        fetchSites(searchTerm);
      }
    });

    return () => {
      window.removeEventListener('realmChanged', handleRealmChange);
      window.removeEventListener('companyChanged', handleCompanyChange);
      window.removeEventListener('storage', handleRealmChange);
    };
  }, [searchTerm]);


  // Update current page data when page changes
  useEffect(() => {
    updateCurrentPageData();
  }, [currentPage, allSites]);

  const handleSearch = () => {
    setCurrentPage(0);
    fetchSites(searchTerm);
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

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="min-h-full bg-slate-50 flex flex-col">
      <div className="flex flex-col p-3">
        {/* Header with Refresh */}
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold text-slate-900">Sites</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchSites(searchTerm, true)}
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
                <p className="text-slate-600 font-medium">Loading sites...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sites Table */}
        {!loading && sites.length > 0 && (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200">
                      <TableHead className="text-slate-700 font-semibold">Name</TableHead>
                      <TableHead className="text-slate-700 font-semibold">Access</TableHead>
                      <TableHead className="text-slate-700 font-semibold">Publisher Manager</TableHead>
                      <TableHead className="text-slate-700 font-semibold">Last Updated</TableHead>
                      <TableHead className="text-slate-700 font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sites.map((site, index) => (
                      <TableRow 
                        key={site.Uid || index} 
                        className="border-slate-100 hover:bg-slate-50 cursor-pointer"
                        onClick={() => navigate(`/EditSite?id=${site.Uid}&name=${encodeURIComponent(site.Name || 'Unnamed Site')}`)}
                      >
                        <TableCell className="font-medium max-w-xs">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-[rgb(75,99,226)] to-[rgb(75,99,226)] rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                              {site.Name ? site.Name.charAt(0).toUpperCase() : 'S'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div 
                                className="font-medium text-slate-900 truncate"
                                title={site.Name || 'Unnamed Site'}
                              >
                                {site.Name || 'Unnamed Site'}
                              </div>
                              <div className="text-sm text-slate-500 truncate">{site.Uid}</div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 flex-shrink-0 text-slate-500 hover:text-slate-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                const path = `/EditSite?id=${site.Uid}&name=${encodeURIComponent(site.Name || 'Unnamed Site')}`;
                                window.open(path, '_blank', 'noopener,noreferrer');
                              }}
                              title="Open site edition in new tab"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {site.Access === 'ALL' ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">ON</Badge>
                          ) : site.Access === 'DISABLED' ? (
                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-100">OFF</Badge>
                          ) : (
                            <span className="text-slate-600">{site.Access ?? '—'}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {site.PublisherManager
                            ? [site.PublisherManager.FirstName, site.PublisherManager.LastName].filter(Boolean).join(' ') || site.PublisherManager.Uid || '—'
                            : '—'}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {formatDate(site.UpdatedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/SiteAnalytics?id=${site.Uid}&name=${encodeURIComponent(site.Name || 'Unnamed Site')}`);
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
                                navigate(`/EditSite?id=${site.Uid}&name=${encodeURIComponent(site.Name || 'Unnamed Site')}`);
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
        {!loading && sites.length === 0 && !error && (
          <Card className="border-slate-200 shadow-sm border-dashed">
            <CardContent className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Globe className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-500 font-medium text-lg">No sites found</p>
                <p className="text-slate-400 text-sm mt-1">
                  {searchTerm ? 'Try adjusting your search criteria' : 'No sites are available at the moment'}
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
            Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, totalCount)} of {totalCount} sites
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