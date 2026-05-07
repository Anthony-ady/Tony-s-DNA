import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Building2, Edit, ChevronLeft, ChevronRight, Calendar, BarChart3, AlertCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/authService';
import { API_ENDPOINTS } from '@/config/api';
import { cn } from '@/lib/utils';

const COMPANY_CACHE_STORAGE_KEY = 'ady-companies-search-cache';

export default function Company() {
  const navigate = useNavigate();
  const [allCompanies, setAllCompanies] = useState([]); // Store all data
  const [companies, setCompanies] = useState([]); // Current page data
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(20);

  const authToken = authService.getToken();
  const companyCacheRef = useRef({ key: null, data: [], totalCount: 0 });
  const searchTermRef = useRef('');
  searchTermRef.current = searchTerm;

  // Get selected realm from localStorage (managed by Layout header)
  const getSelectedRealmId = () => {
    return localStorage.getItem('selected-realm-id') || '';
  };

  const applyCachedCompanies = (cachedData, cachedTotal) => {
    setAllCompanies(cachedData);
    setTotalCount(cachedTotal);
    setError('');
    const startIndex = currentPage * pageSize;
    const endIndex = startIndex + pageSize;
    setCompanies(cachedData.slice(startIndex, endIndex));
  };

  const fetchCompanies = async (search = '', forceRefresh = false) => {
    if (!authToken) {
      setError('Authentication required');
      return;
    }

    const selectedRealmId = getSelectedRealmId();
    const cacheKey = JSON.stringify({ realm: selectedRealmId, search });

    if (!forceRefresh) {
      if (companyCacheRef.current.key === cacheKey && Array.isArray(companyCacheRef.current.data)) {
        applyCachedCompanies(companyCacheRef.current.data, companyCacheRef.current.totalCount);
        return;
      }
      try {
        const raw = sessionStorage.getItem(COMPANY_CACHE_STORAGE_KEY);
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached.key === cacheKey && Array.isArray(cached.data)) {
            companyCacheRef.current = { key: cached.key, data: cached.data, totalCount: cached.totalCount ?? 0 };
            applyCachedCompanies(cached.data, cached.totalCount ?? cached.data.length);
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

      const payload = {
        Filters: filters,
        From: 0,
        Order: [{ Field: "UpdatedAt", Operator: "desc" }],
        Size: 1000
      };

      const response = await fetch(API_ENDPOINTS.COMPANIES_SEARCH, {
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
      if (data.Data) {
        const list = data.Data;
        const total = data.TotalCount || list.length;
        companyCacheRef.current = { key: cacheKey, data: list, totalCount: total };
        try {
          sessionStorage.setItem(COMPANY_CACHE_STORAGE_KEY, JSON.stringify({ key: cacheKey, data: list, totalCount: total }));
        } catch (_) {}
        setAllCompanies(list);
        setTotalCount(total);
        updateCurrentPageData(list);
      } else {
        companyCacheRef.current = { key: cacheKey, data: [], totalCount: 0 };
        try {
          sessionStorage.setItem(COMPANY_CACHE_STORAGE_KEY, JSON.stringify({ key: cacheKey, data: [], totalCount: 0 }));
        } catch (_) {}
        setAllCompanies([]);
        setCompanies([]);
        setTotalCount(0);
      }
    } catch (err) {
      console.error('Error fetching companies:', err);
      setError(`Failed to fetch companies: ${err.message}`);
      setAllCompanies([]);
      setCompanies([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  // Update current page data based on pagination
  const updateCurrentPageData = (data = allCompanies) => {
    const startIndex = currentPage * pageSize;
    const endIndex = startIndex + pageSize;
    setCompanies(data.slice(startIndex, endIndex));
  };

  // Track when initial load has completed
  const hasLoadedRef = React.useRef(false);
  const isFirstSearchRef = React.useRef(true);

  // Load companies on component mount
  useEffect(() => {
    const loadInitial = async () => {
      await fetchCompanies();
      hasLoadedRef.current = true;
    };
    loadInitial();
  }, []);

  // Reload companies when realm selection changes in header (use ref so handlers stay stable)
  useEffect(() => {
    const handleRealmChange = () => {
      if (hasLoadedRef.current) {
        fetchCompanies(searchTermRef.current);
      }
    };

    const handleStorage = (event) => {
      if (event.key === 'selected-realm-id' && hasLoadedRef.current) {
        fetchCompanies(searchTermRef.current);
      }
    };

    window.addEventListener('realmChanged', handleRealmChange);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('realmChanged', handleRealmChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  useEffect(() => {
    const prepare = () => {
      searchTermRef.current = '';
    };
    window.addEventListener('companyListPrepareReset', prepare);
    return () => window.removeEventListener('companyListPrepareReset', prepare);
  }, []);

  useEffect(() => {
    const handleSupplyCompanyListReset = () => {
      try {
        sessionStorage.removeItem(COMPANY_CACHE_STORAGE_KEY);
      } catch (_) {}
      companyCacheRef.current = { key: null, data: [], totalCount: 0 };
      setSearchTerm('');
      searchTermRef.current = '';
      setCurrentPage(0);
      fetchCompanies('', true);
    };
    window.addEventListener('supplyCompanyListReset', handleSupplyCompanyListReset);
    return () => window.removeEventListener('supplyCompanyListReset', handleSupplyCompanyListReset);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset listener wired once; fetchCompanies stable enough for this global action
  }, []);

  // Listen for search term changes from Layout header via window event
  useEffect(() => {
    const handleSearchChange = (event) => {
      const term = event.detail || '';
      setSearchTerm(term);
    };
    
    window.addEventListener('companySearchChanged', handleSearchChange);
    
    return () => {
      window.removeEventListener('companySearchChanged', handleSearchChange);
    };
  }, []);
  
  // Handle search with debouncing when searchTerm changes
  useEffect(() => {
    if (isFirstSearchRef.current) {
      isFirstSearchRef.current = false;
      return;
    }

    const timeoutId = setTimeout(() => {
      setCurrentPage(0);
      fetchCompanies(searchTerm);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Update current page data when page changes
  useEffect(() => {
    updateCurrentPageData();
  }, [currentPage, allCompanies]);

  // Handle search
  const handleSearch = () => {
    setCurrentPage(0);
    fetchCompanies(searchTerm);
  };

  // Handle pagination
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  // Format date
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
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold text-slate-900">Companies</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchCompanies(searchTerm, true)}
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
                <p className="text-slate-600 font-medium">Loading companies...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Companies Table */}
        {!loading && companies.length > 0 && (
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-200">
                      <TableHead className="text-slate-700 font-semibold">Name</TableHead>
                      <TableHead className="text-slate-700 font-semibold">Manager</TableHead>
                      <TableHead className="text-slate-700 font-semibold">Last Updated</TableHead>
                      <TableHead className="text-slate-700 font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((company) => (
                      <TableRow 
                        key={company.Uid} 
                        className="border-slate-100 hover:bg-slate-50 cursor-pointer"
                        onClick={() => navigate(`/EditCompany?id=${company.Uid}&name=${encodeURIComponent(company.Name || 'Unnamed Company')}`)}
                      >
                        <TableCell className="max-w-xs">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-[rgb(75,99,226)] to-[rgb(75,99,226)] rounded-lg flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-xs font-bold">
                                {company.Name ? company.Name.charAt(0).toUpperCase() : 'C'}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div 
                                className="font-semibold text-slate-900 truncate"
                                title={company.Name || 'Unnamed Company'}
                              >
                                {company.Name || 'Unnamed Company'}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {company.Manager ? (
                            <div className="text-sm">
                              <div className="font-medium text-slate-900">
                                {company.Manager.FirstName} {company.Manager.LastName}
                              </div>
                              <div className="text-slate-500 text-xs">
                                {company.Manager.Title}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-sm">No manager</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-slate-600">
                            <Calendar className="w-4 h-4 text-[rgb(75,99,226)]" />
                            {formatDate(company.UpdatedAt)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/CompanyAnalytics?id=${company.Uid}&name=${encodeURIComponent(company.Name || 'Unnamed')}`);
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
                                navigate(`/EditCompany?id=${company.Uid}&name=${encodeURIComponent(company.Name || 'Unnamed Company')}`);
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
        {!loading && companies.length === 0 && !error && (
          <Card className="border-slate-200 shadow-sm border-dashed">
            <CardContent className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-500 font-medium text-lg">No companies found</p>
                <p className="text-slate-400 text-sm mt-1">
                  {searchTerm ? 'Try adjusting your search criteria' : 'No companies are available at the moment'}
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
            Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, totalCount)} of {totalCount} companies
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