/**
 * Broker Management Page Component
 * 
 * Modern interface for managing Brokers with a clean table design
 * similar to the DSP Management interface.
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
  Download,
  Plus
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { API_ENDPOINTS } from "@/config/api";

export default function BrokerManagement() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [allBrokers, setAllBrokers] = useState([]); // All Brokers loaded from API (max 250)
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
    production: true,  // visibility: 0
    disabled: true     // visibility: -1
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
    
    window.addEventListener('brokerManagementSearchChanged', handleSearchChange);
    
    return () => {
      window.removeEventListener('brokerManagementSearchChanged', handleSearchChange);
    };
  }, []);

  /**
   * Fetches all Brokers data from the broker partners API (max 250) - only called once on mount
   */
  const fetchAllBrokers = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const token = getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }
      
      // Prepare the request body - only visibility filters, no search/pagination
      const filters = [];
      
      // Add visibility filters based on selected status
      const visibilityValues = [];
      if (statusFilters.production) {
        visibilityValues.push(0);
      }
      if (statusFilters.disabled) {
        visibilityValues.push(-1);
      }
      
      if (visibilityValues.length > 0) {
        filters.push({
          "Field": "Visibility",
          "Operator": "in",
          "Value": visibilityValues
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
      
      const response = await fetch(API_ENDPOINTS.BROKER_PARTNERS_SEARCH, {
        method: 'POST',
        headers: {
          'x-ayl-auth-token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Transform API data to match our table structure
      const transformedBrokers = data.Data.map(broker => ({
        id: broker.uid,
        name: broker.name,
        connectorKind: broker.connector_kind || 'Unknown',
        visibility: broker.visibility,
        contents: broker.contents || {},
        lastUpdate: formatLastUpdate(broker.updated_at),
        updatedAt: broker.updated_at // Keep original date for sorting
      }));

      setAllBrokers(transformedBrokers);
      setCurrentPage(0); // Reset to first page when data loads
    } catch (err) {
      console.error('Error fetching Brokers:', err);
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

  // Fetch all Brokers only once on mount and when status filters change
  useEffect(() => {
    fetchAllBrokers();
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
  const filteredAndSortedBrokers = React.useMemo(() => {
    let filtered = [...allBrokers];

    // Apply search filter (client-side)
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const isLikelyId = /^[a-f0-9]{32}$/i.test(q);
      
      filtered = filtered.filter(broker => {
        if (isLikelyId) {
          return broker.id.toLowerCase().includes(q);
        } else {
          return broker.name.toLowerCase().includes(q) || broker.id.toLowerCase().includes(q);
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
  }, [allBrokers, searchQuery, sortField, sortDirection]);

  // Client-side pagination
  const paginatedBrokers = React.useMemo(() => {
    const startIndex = currentPage * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedBrokers.slice(startIndex, endIndex);
  }, [filteredAndSortedBrokers, currentPage, itemsPerPage]);

  const totalFilteredBrokers = filteredAndSortedBrokers.length;
  const totalPages = Math.ceil(totalFilteredBrokers / itemsPerPage);

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
    // fetchAllBrokers will be called automatically via useEffect
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
   * Exports filtered brokers data to CSV file (uses client-side filtered data)
   */
  const exportToCSV = () => {
    try {
      // Use the filtered and sorted data that's already in memory
      const csvData = filteredAndSortedBrokers.map(broker => ({
        Name: broker.name || '',
        ID: broker.id || '',
        ConnectorKind: broker.connectorKind || 'Unknown',
        Visibility: broker.visibility === -1 ? 'DISABLED' : broker.visibility === 0 ? 'PRODUCTION' : broker.visibility,
        Banner: broker.contents?.AD_BANNER ? 'Yes' : 'No',
        Instream: broker.contents?.AD_INSTREAM ? 'Yes' : 'No',
        Outstream: broker.contents?.AD_OUTSTREAM ? 'Yes' : 'No',
        Native: (broker.contents?.AD_TRAFFIC || broker.contents?.AD_VIDEO) ? 'Yes' : 'No',
        LastUpdate: broker.lastUpdate
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
      link.setAttribute('download', `brokers_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error exporting to CSV:', err);
      alert('Error exporting to CSV: ' + err.message);
    }
  };

  // Get visibility status badge
  const getVisibilityBadge = (visibility) => {
    if (visibility === -1) {
      return (
        <Badge className="text-xs bg-red-100 text-red-800 border-red-200">
          DISABLED
        </Badge>
      );
    } else if (visibility === 0) {
      return (
        <Badge className="text-xs bg-green-100 text-green-800 border-green-200">
          PRODUCTION
        </Badge>
      );
    } else {
      return (
        <Badge className="text-xs bg-gray-100 text-gray-800 border-gray-200">
          {visibility}
        </Badge>
      );
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
              variant="default" 
              size="sm" 
              className="h-8 bg-[rgb(75,99,226)] hover:bg-[rgb(75,99,226)]/90"
              onClick={() => navigate('/CreateBroker')}
              title="Create New Broker"
            >
              <Plus className="w-4 h-4 mr-1" />
              Create
            </Button>
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
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      Loading Brokers...
                    </td>
                  </tr>
                ) : paginatedBrokers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      No Brokers found
                    </td>
                  </tr>
                ) : (
                  paginatedBrokers.map((broker) => (
                    <tr key={broker.id} className="border-b hover:bg-[rgb(75,99,226)]/10">
                      <td className="p-3 font-medium text-slate-900 text-sm">
                        <div 
                          className="flex flex-col cursor-pointer hover:text-[rgb(75,99,226)] transition-colors"
                          onClick={() => navigate(`/Broker?id=${broker.id}&name=${encodeURIComponent(broker.name)}`)}
                        >
                          <div>{broker.name}</div>
                          <div className="text-xs text-slate-400 font-mono">{broker.id}</div>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        {broker.contents.AD_BANNER && <Check className="w-4 h-4 text-[rgb(75,99,226)] mx-auto" />}
                      </td>
                      <td className="p-3 text-center">
                        {broker.contents.AD_INSTREAM && <Check className="w-4 h-4 text-[rgb(75,99,226)] mx-auto" />}
                      </td>
                      <td className="p-3 text-center">
                        {broker.contents.AD_OUTSTREAM && <Check className="w-4 h-4 text-[rgb(75,99,226)] mx-auto" />}
                      </td>
                      <td className="p-3 text-center">
                        {(broker.contents.AD_TRAFFIC || broker.contents.AD_VIDEO) && <Check className="w-4 h-4 text-[rgb(75,99,226)] mx-auto" />}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/BrokerAnalytics?id=${broker.id}&name=${encodeURIComponent(broker.name)}`)}
                            className="h-8 w-8 p-0"
                            title="View Analytics"
                          >
                            <BarChart3 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/Broker?id=${broker.id}&name=${encodeURIComponent(broker.name)}`)}
                            className="h-8 w-8 p-0"
                            title="Edit Broker"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                      <td className="p-3 text-center hover:bg-transparent">
                        {getVisibilityBadge(broker.visibility)}
                      </td>
                      <td className="p-3 text-slate-600 text-sm text-center">{broker.lastUpdate}</td>
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
      {totalFilteredBrokers > 0 && (
        <div className="border-t border-slate-200 bg-white px-3 flex items-center justify-between flex-shrink-0 sticky bottom-0 z-10 shadow-sm w-full left-0 right-0" style={{ height: '80px' }}>
          <div className="text-sm text-slate-600">
            Showing {currentPage * itemsPerPage + 1} to {Math.min((currentPage + 1) * itemsPerPage, totalFilteredBrokers)} of {totalFilteredBrokers} brokers
            {allBrokers.length >= 250 && (
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