import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/authService";
import { useNavigate } from "react-router-dom";
import { API_ENDPOINTS } from "@/config/api";

const formatLastUpdate = (dateString) => {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.ceil(Math.abs(now - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
  return `${Math.ceil(diffDays / 30)} months ago`;
};

export default function UserSyncManagement() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [allItems, setAllItems] = useState([]);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage] = useState(20);
  const [sortField, setSortField] = useState('updatedAt');
  const [sortDirection, setSortDirection] = useState('desc');

  // Listen for search from Layout header
  useEffect(() => {
    const handler = (e) => {
      setSearchQuery(e.detail || '');
      setCurrentPage(0);
    };
    window.addEventListener('userSyncSearchChanged', handler);
    return () => window.removeEventListener('userSyncSearchChanged', handler);
  }, []);

  const fetchAll = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error('No authentication token available');

      const response = await fetch(API_ENDPOINTS.COOKIE_SYNC_SEARCH, {
        method: 'POST',
        headers: { 'x-ayl-auth-token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ From: 0, Order: [{ Field: 'UpdatedAt', Operator: 'desc' }], Size: 500 })
      });

      if (!response.ok) {
        if (response.status === 401) { authService.handleUnauthorized(navigate); return; }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const list = Array.isArray(data?.Data) ? data.Data : [];
      setAllItems(list.map(item => ({
        uid: item.uid,
        name: item.name,
        updatedAt: item.updated_at,
        lastUpdate: formatLastUpdate(item.updated_at),
      })));
      setCurrentPage(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(0);
  };

  const filtered = React.useMemo(() => {
    let list = [...allItems];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(i => i.name.toLowerCase().includes(q) || i.uid.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      let av = sortField === 'updatedAt' ? new Date(a.updatedAt).getTime() : (a[sortField] || '').toLowerCase();
      let bv = sortField === 'updatedAt' ? new Date(b.updatedAt).getTime() : (b[sortField] || '').toLowerCase();
      return sortDirection === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });
    return list;
  }, [allItems, searchQuery, sortField, sortDirection]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  const exportToCSV = () => {
    const rows = filtered.map(i => ({ Name: i.name, UID: i.uid, LastUpdate: i.lastUpdate }));
    const headers = Object.keys(rows[0] || {});
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => r[h]).join(','))].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `user_sync_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  return (
    <div className="bg-slate-50 flex flex-col min-h-screen">
      <div className="flex flex-col p-3">
        <div className="mb-3 flex items-center justify-end">
          <Button variant="outline" size="sm" className="h-8" onClick={exportToCSV} disabled={isLoading}>
            <Download className="w-4 h-4 mr-1" /> Export CSV
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
              <table className="w-full">
                <thead className="bg-slate-50 border-b sticky top-0 z-10">
                  <tr>
                    <th className="text-left p-3 font-medium text-slate-600 text-sm cursor-pointer hover:bg-[rgb(75,99,226)]/10" onClick={() => handleSort('name')}>
                      <div className="flex items-center gap-1">Name <SortIcon field="name" /></div>
                    </th>
                    <th className="text-left p-3 font-medium text-slate-600 text-sm">UID</th>
                    <th className="text-center p-3 font-medium text-slate-600 text-sm cursor-pointer hover:bg-[rgb(75,99,226)]/10" onClick={() => handleSort('updatedAt')}>
                      <div className="flex items-center justify-center gap-1">Last update <SortIcon field="updatedAt" /></div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={3} className="p-8 text-center text-slate-500">Loading User Syncs…</td></tr>
                  ) : error ? (
                    <tr><td colSpan={3} className="p-8 text-center text-red-500">{error}</td></tr>
                  ) : paginated.length === 0 ? (
                    <tr><td colSpan={3} className="p-8 text-center text-slate-500">No User Syncs found</td></tr>
                  ) : (
                    paginated.map(item => (
                      <tr
                        key={item.uid}
                        className="border-b hover:bg-[rgb(75,99,226)]/10 cursor-pointer"
                        onClick={() => navigate(`/EditUserSync?id=${item.uid}&name=${encodeURIComponent(item.name)}`)}
                      >
                        <td className="p-3 font-medium text-slate-900 text-sm hover:text-[rgb(75,99,226)] transition-colors">{item.name}</td>
                        <td className="p-3 text-xs font-mono text-slate-400">{item.uid}</td>
                        <td className="p-3 text-slate-600 text-sm text-center">{item.lastUpdate}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {filtered.length > 0 && (
        <div className="border-t border-slate-200 bg-white px-3 flex items-center justify-between flex-shrink-0 sticky bottom-0 z-10 shadow-sm w-full" style={{ height: '80px' }}>
          <div className="text-sm text-slate-600">
            Showing {currentPage * itemsPerPage + 1} to {Math.min((currentPage + 1) * itemsPerPage, filtered.length)} of {filtered.length} User Syncs
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 0}>
              <ChevronLeft className="w-4 h-4" /> Previous
            </Button>
            <span className="text-sm text-slate-600">Page {currentPage + 1} of {totalPages || 1}</span>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= totalPages - 1}>
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
