/**
 * DSP Management Page Component
 * 
 * Modern interface for managing DSPs (Demand-Side Platform) with a clean table design
 * similar to the Partners interface shown in the reference image.
 */

import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Filter,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  BarChart3,
  Edit,
  X,
  RotateCcw,
  Download
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { authService } from "@/services/authService";
import { API_ENDPOINTS } from "@/config/api";

export default function DSPManagement() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [allDsps, setAllDsps] = useState([]); // All DSPs loaded from API (max 250)
  const [error, setError] = useState(null);
  // Search query is now managed in Layout header
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage] = useState(20); // Items per page for client-side pagination
  const [sortField, setSortField] = useState("lastUpdate");
  const [sortDirection, setSortDirection] = useState("desc");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isFilterClosing, setIsFilterClosing] = useState(false);
  const [statusFilters, setStatusFilters] = useState({
    production: true,  // status: "PRODUCTION"
    disabled: true     // status: "DISABLED"
  });
  
  // Listen for search query changes from Layout header via window event
  useEffect(() => {
    const handleSearchChange = (event) => {
      const query = event.detail || '';
      setSearchQuery(prevQuery => {
        // Reset to first page when search changes
        if (query !== prevQuery) {
          setCurrentPage(0);
        }
        return query;
      });
    };
    
    window.addEventListener('dspManagementSearchChanged', handleSearchChange);
    
    return () => {
      window.removeEventListener('dspManagementSearchChanged', handleSearchChange);
    };
  }, []);

  /**
   * Fetches all DSPs data from the partners API (max 250) - only called once on mount
   */
  const fetchAllDsps = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Prepare the request body - only status filters, no search/pagination
      const filters = [];
      
      // Add status filters based on selected status
      const statusValues = [];
      if (statusFilters.production) {
        statusValues.push("PRODUCTION");
      }
      if (statusFilters.disabled) {
        statusValues.push("DISABLED");
      }
      
      if (statusValues.length > 0) {
        filters.push({
          "Field": "Status",
          "Operator": "in",
          "Value": statusValues
        });
      }

      const requestBody = {
        "Filters": filters,
        "From": 0,
        "Order": [
          {
            "Field": "UpdatedAt",
            "Operator": "desc"
          }
        ],
        "Size": 250 // Load max 250 items in one request
      };
      
      const response = await fetch(API_ENDPOINTS.PARTNERS_SEARCH, {
        method: 'POST',
        headers: {
          'x-ayl-auth-token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        // Handle 401 unauthorized - redirect to login
        if (response.status === 401) {
          authService.handleUnauthorized(navigate);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Transform API data to match our table structure
      const transformedDsps = data.Data.map(dsp => ({
        id: dsp.uid,
        name: dsp.name,
        broker: dsp.inventory_access_broker || false,
        inApp: dsp.inventory_access_in_app || false,
        prebidClient: dsp.inventory_access_prebid || false,
        prebidServer: dsp.inventory_access_prebid_server || false,
        contents: dsp.connector_contents || {},
        status: dsp.status || 'PRODUCTION',
        lastUpdate: formatLastUpdate(dsp.updated_at),
        updatedAt: dsp.updated_at // Keep original date for sorting
      }));

      setAllDsps(transformedDsps);
      setCurrentPage(0); // Reset to first page when data loads
    } catch (err) {
      console.error('Error fetching DSPs:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Formats the last update date to a human-readable format
   */
  const formatLastUpdate = (dateString) => {
    if (!dateString) return 'Unknown';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return `${Math.ceil(diffDays / 30)} months ago`;
  };

  // Fetch all DSPs only once on mount and when status filters change
  useEffect(() => {
    fetchAllDsps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilters]);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(0); // Reset to first page when sorting changes
  };

  // Client-side filtering and sorting
  const filteredAndSortedDsps = React.useMemo(() => {
    let filtered = [...allDsps];

    // Apply search filter (client-side)
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const isLikelyId = /^[a-f0-9]{32}$/i.test(q);
      
      filtered = filtered.filter(dsp => {
        if (isLikelyId) {
          return dsp.id.toLowerCase().includes(q);
        } else {
          return dsp.name.toLowerCase().includes(q) || dsp.id.toLowerCase().includes(q);
        }
      });
    }

    // Apply sorting (client-side)
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      if (sortField === "name") {
        aValue = a.name?.toLowerCase() || '';
        bValue = b.name?.toLowerCase() || '';
      } else if (sortField === "lastUpdate") {
        aValue = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        bValue = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      } else {
        aValue = a[sortField] || '';
        bValue = b[sortField] || '';
      }

      if (sortDirection === "asc") {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    return filtered;
  }, [allDsps, searchQuery, sortField, sortDirection]);

  // Client-side pagination
  const paginatedDsps = React.useMemo(() => {
    const startIndex = currentPage * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedDsps.slice(startIndex, endIndex);
  }, [filteredAndSortedDsps, currentPage, itemsPerPage]);

  const totalFilteredDsps = filteredAndSortedDsps.length;
  const totalPages = Math.ceil(totalFilteredDsps / itemsPerPage);

  // Pagination handlers (client-side)
  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  // Filter management functions (triggers new API call)
  const toggleStatusFilter = (filterType) => {
    setStatusFilters(prev => ({
      ...prev,
      [filterType]: !prev[filterType]
    }));
    setCurrentPage(0); // Reset to first page when filter changes
    // fetchAllDsps will be called automatically via useEffect
  };

  const resetFilters = () => {
    setStatusFilters({
      production: true,
      disabled: true
    });
    setCurrentPage(0);
  };

  const handleCloseFilter = () => {
    setIsFilterClosing(true);
    setTimeout(() => {
      setIsFilterOpen(false);
      setIsFilterClosing(false);
    }, 500); // Match animation duration
  };

  /**
   * Exports filtered DSPs data to CSV file (uses client-side filtered data)
   */
  const exportToCSV = () => {
    try {
      // Use the filtered and sorted data that's already in memory
      const csvData = filteredAndSortedDsps.map(dsp => ({
        Name: dsp.name || '',
        ID: dsp.id || '',
        Broker: dsp.broker ? 'Yes' : 'No',
        InApp: dsp.inApp ? 'Yes' : 'No',
        PrebidClient: dsp.prebidClient ? 'Yes' : 'No',
        PrebidServer: dsp.prebidServer ? 'Yes' : 'No',
        Banner: dsp.contents?.AD_BANNER ? 'Yes' : 'No',
        Instream: dsp.contents?.AD_INSTREAM ? 'Yes' : 'No',
        Outstream: dsp.contents?.AD_OUTSTREAM ? 'Yes' : 'No',
        Native: (dsp.contents?.AD_TRAFFIC || dsp.contents?.AD_VIDEO) ? 'Yes' : 'No',
        Status: dsp.status || 'PRODUCTION',
        LastUpdate: dsp.lastUpdate
      }));

      // Convert to CSV format
      const headers = Object.keys(csvData[0] || {});
      const csvRows = [
        headers.join(','),
        ...csvData.map(row => 
          headers.map(header => {
            const value = row[header];
            // Escape commas and quotes in CSV
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ];

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `dsps_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error exporting to CSV:', err);
      alert('Error exporting to CSV: ' + err.message);
    }
  };

  return (
    <div className="bg-slate-50 flex flex-col min-h-screen">
      <div className="flex flex-col p-3">
      {/* Header */}
      <div className="mb-3">
        {/* Actions */}
        <div className="flex items-center justify-end">
          <div className="flex items-center space-x-1">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8"
              onClick={exportToCSV}
              disabled={isLoading}
              title="Export to CSV"
            >
              <Download className="w-4 h-4 mr-1" />
              Export CSV
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8"
              onClick={() => setIsFilterOpen(true)}
            >
              <Filter className="w-4 h-4 mr-1" />
              Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Filter Sidebar */}
      {isFilterOpen && (
        <>
          {/* Backdrop */}
          {!isFilterClosing && (
            <div 
              className="fixed inset-0 bg-black/20 z-40 animate-in fade-in duration-300"
              onClick={handleCloseFilter}
            />
          )}
          {/* Sidebar */}
          <div className={`fixed right-0 top-0 h-full w-80 bg-white shadow-xl z-50 flex flex-col ${
            isFilterClosing
              ? 'animate-out slide-out-to-right duration-500 ease-out'
              : 'animate-in slide-in-from-right duration-500 ease-out'
          }`}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-slate-700" />
                <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  className="h-8 text-[rgb(75,99,226)] border-[rgb(75,99,226)] hover:bg-[rgb(75,99,226)] hover:text-white"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Reset Filters
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseFilter}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Filter Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Status Filter */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Status</h3>
                <div className="space-y-1">
                  {/* Production Option */}
                  <div
                    onClick={() => toggleStatusFilter('production')}
                    className={`flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors ${
                      statusFilters.production
                        ? 'bg-[rgb(75,99,226)]/10'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-4 h-4 border-2 flex items-center justify-center ${
                      statusFilters.production
                        ? 'bg-[rgb(75,99,226)] border-[rgb(75,99,226)]'
                        : 'border-slate-300 bg-white'
                    }`}>
                      {statusFilters.production && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span className={`text-sm font-medium ${
                      statusFilters.production ? 'text-[rgb(75,99,226)]' : 'text-slate-900'
                    }`}>
                      Production
                    </span>
                  </div>

                  {/* Disabled Option */}
                  <div
                    onClick={() => toggleStatusFilter('disabled')}
                    className={`flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors ${
                      statusFilters.disabled
                        ? 'bg-[rgb(75,99,226)]/10'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className={`w-4 h-4 border-2 flex items-center justify-center ${
                      statusFilters.disabled
                        ? 'bg-[rgb(75,99,226)] border-[rgb(75,99,226)]'
                        : 'border-slate-300 bg-white'
                    }`}>
                      {statusFilters.disabled && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span className={`text-sm font-medium ${
                      statusFilters.disabled ? 'text-[rgb(75,99,226)]' : 'text-slate-900'
                    }`}>
                      Disabled
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            <table className="w-full">
              <thead className="bg-slate-50 border-b sticky top-0 z-10">
                <tr>
                  <th 
                    className="text-left p-3 font-medium text-slate-600 cursor-pointer hover:bg-[rgb(75,99,226)]/10 text-sm"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center">
                      Name
                      <SortIcon field="name" />
                    </div>
                  </th>
                  <th className="text-center p-3 font-medium text-slate-600 text-sm">Broker</th>
                  <th className="text-center p-3 font-medium text-slate-600 text-sm">In-App</th>
                  <th className="text-center p-3 font-medium text-slate-600 text-sm">Prebid Client</th>
                  <th className="text-center p-3 font-medium text-slate-600 text-sm">Prebid Server</th>
                  <th className="text-center p-3 font-medium text-slate-600 text-sm">Banner</th>
                  <th className="text-center p-3 font-medium text-slate-600 text-sm">Instream</th>
                  <th className="text-center p-3 font-medium text-slate-600 text-sm">Outstream</th>
                  <th className="text-center p-3 font-medium text-slate-600 text-sm">Native</th>
                  <th className="text-center p-3 font-medium text-slate-600 text-sm">Actions</th>
                  <th className="text-center p-3 font-medium text-slate-600 text-sm">Status</th>
                  <th 
                    className="text-center p-3 font-medium text-slate-600 cursor-pointer hover:bg-[rgb(75,99,226)]/10 text-sm"
                    onClick={() => handleSort("lastUpdate")}
                  >
                    <div className="flex items-center justify-center">
                      Last update
                      <SortIcon field="lastUpdate" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-slate-500">
                      Loading DSPs...
                    </td>
                  </tr>
                ) : paginatedDsps.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-slate-500">
                      No DSPs found
                    </td>
                  </tr>
                ) : (
                  paginatedDsps.map((dsp) => (
                    <tr key={dsp.id} className="border-b hover:bg-[rgb(75,99,226)]/10">
                      <td className="p-3 font-medium text-slate-900 text-sm">
                        <div className="flex flex-col">
                          <div 
                            className="cursor-pointer hover:text-[rgb(75,99,226)] transition-colors"
                            onClick={() => navigate(`/DSP?id=${dsp.id}&name=${encodeURIComponent(dsp.name)}`)}
                          >
                            {dsp.name}
                          </div>
                          <div className="text-xs text-slate-400 font-mono">{dsp.id}</div>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        {dsp.broker && <Check className="w-4 h-4 text-[rgb(75,99,226)] mx-auto" />}
                      </td>
                      <td className="p-3 text-center">
                        {dsp.inApp && <Check className="w-4 h-4 text-[rgb(75,99,226)] mx-auto" />}
                      </td>
                      <td className="p-3 text-center">
                        {dsp.prebidClient && <Check className="w-4 h-4 text-[rgb(75,99,226)] mx-auto" />}
                      </td>
                      <td className="p-3 text-center">
                        {dsp.prebidServer && <Check className="w-4 h-4 text-[rgb(75,99,226)] mx-auto" />}
                      </td>
                      <td className="p-3 text-center">
                        {dsp.contents.AD_BANNER && <Check className="w-4 h-4 text-[rgb(75,99,226)] mx-auto" />}
                      </td>
                      <td className="p-3 text-center">
                        {dsp.contents.AD_INSTREAM && <Check className="w-4 h-4 text-[rgb(75,99,226)] mx-auto" />}
                      </td>
                      <td className="p-3 text-center">
                        {dsp.contents.AD_OUTSTREAM && <Check className="w-4 h-4 text-[rgb(75,99,226)] mx-auto" />}
                      </td>
                      <td className="p-3 text-center">
                        {(dsp.contents.AD_TRAFFIC || dsp.contents.AD_VIDEO) && <Check className="w-4 h-4 text-[rgb(75,99,226)] mx-auto" />}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/DSPAnalytics?id=${dsp.id}&name=${encodeURIComponent(dsp.name)}`)}
                            className="h-8 w-8 p-0"
                            title="View Analytics"
                          >
                            <BarChart3 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/DSP?id=${dsp.id}&name=${encodeURIComponent(dsp.name)}`)}
                            className="h-8 w-8 p-0"
                            title="Edit DSP"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                      <td className="p-3 text-center hover:bg-transparent">
                        <Badge className={`text-xs ${
                          dsp.status === 'DISABLED' 
                            ? 'bg-red-100 text-red-800 border-red-200' 
                            : 'bg-green-100 text-green-800 border-green-200'
                        }`}>
                          {dsp.status === 'DISABLED' ? 'DISABLED' : 'PRODUCTION'}
                        </Badge>
                      </td>
                      <td className="p-3 text-slate-600 text-sm text-center">{dsp.lastUpdate}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
                          </div>
        </CardContent>
      </Card>
      </div>

      {/* Fixed Footer with Pagination */}
      {totalFilteredDsps > 0 && (
        <div className="border-t border-slate-200 bg-white px-3 flex items-center justify-between flex-shrink-0 sticky bottom-0 z-10 shadow-sm w-full left-0 right-0" style={{ height: '80px' }}>
          <div className="text-sm text-slate-600">
            Showing {currentPage * itemsPerPage + 1} to {Math.min((currentPage + 1) * itemsPerPage, totalFilteredDsps)} of {totalFilteredDsps} DSPs
            {allDsps.length >= 250 && (
              <span className="text-slate-400 ml-2">(max 250 loaded)</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={currentPage === 0 || isLoading}
              className="hover:bg-slate-50 hover:border-slate-300"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <span className="text-sm text-slate-600">
              Page {currentPage + 1} of {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage >= totalPages - 1 || isLoading}
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