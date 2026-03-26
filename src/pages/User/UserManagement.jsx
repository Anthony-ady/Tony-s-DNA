/**
 * User Management Page
 * Table of users from bo-api/users/search with optional realm filter.
 * Columns: Name, Companies, Role, Last connection, Status.
 */

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  X,
  RotateCcw,
  Plus,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { authService } from "@/services/authService";
import { API_ENDPOINTS } from "@/config/api";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function UserManagement() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage] = useState(20);
  const [sortField, setSortField] = useState("lastConnection");
  const [sortDirection, setSortDirection] = useState("desc");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isFilterClosing, setIsFilterClosing] = useState(false);
  const [realmFilter, setRealmFilter] = useState(""); // realm Uid or "" for all
  const [visibilityFilter, setVisibilityFilter] = useState("all"); // "all" | "visible" | "archived"
  const [realmList, setRealmList] = useState([]);
  const [loadingRealms, setLoadingRealms] = useState(false);
  const [realmPopoverOpen, setRealmPopoverOpen] = useState(false);
  const [realmSearchTerm, setRealmSearchTerm] = useState("");

  useEffect(() => {
    const handler = (e) => {
      const q = e.detail || "";
      setSearchQuery(q);
      setCurrentPage(0);
    };
    window.addEventListener("userManagementSearchChanged", handler);
    return () => window.removeEventListener("userManagementSearchChanged", handler);
  }, []);

  const fetchRealms = async () => {
    setLoadingRealms(true);
    try {
      const token = getToken();
      if (!token) return;
      const response = await fetch(API_ENDPOINTS.REALMS_SEARCH, {
        method: "POST",
        headers: { "x-ayl-auth-token": token, "Content-Type": "application/json" },
        body: JSON.stringify({
          From: 0,
          Size: 500,
          Order: [{ Field: "UpdatedAt", Operator: "desc" }],
        }),
      });
      if (!response.ok) return;
      const data = await response.json();
      const raw = Array.isArray(data?.Data) ? data.Data : [];
      setRealmList(raw.map((r) => ({ uid: r.uid ?? r.Uid, name: r.name ?? r.Name ?? r.uid ?? r.Uid })));
    } catch {
      setRealmList([]);
    } finally {
      setLoadingRealms(false);
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getToken();
      if (!token) throw new Error("No authentication token available");

      const body = {
        From: 0,
        Order: [{ Field: "LastSignInAt", Operator: "desc" }],
        Size: 500,
      };
      const filters = [];
      if (realmFilter && realmFilter.trim()) {
        filters.push({ Field: "Realm_uid", Operator: "match", Value: realmFilter.trim() });
      }
      if (visibilityFilter === "archived") {
        filters.push({ Field: "Visibility", Operator: "in", Value: [-1] });
      } else if (visibilityFilter === "visible") {
        filters.push({ Field: "Visibility", Operator: "in", Value: [0] });
      } else {
        // "all" = both visible and archived
        filters.push({ Field: "Visibility", Operator: "in", Value: [0, -1] });
      }
      if (filters.length > 0) body.Filters = filters;

      const response = await fetch(API_ENDPOINTS.USERS_SEARCH, {
        method: "POST",
        headers: { "x-ayl-auth-token": token, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        if (response.status === 401) {
          authService.handleUnauthorized(navigate);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAllUsers(Array.isArray(data?.Data) ? data.Data : []);
      setCurrentPage(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [realmFilter, visibilityFilter]);

  useEffect(() => {
    if (isFilterOpen) fetchRealms();
  }, [isFilterOpen]);

  const formatLastConnection = (user) => {
    const ts = user.LastSignInAt ?? user.UpdatedAt;
    if (!ts) return "—";
    const date = new Date(ts);
    if (isNaN(date.getTime())) return "—";
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };

  const getDisplayName = (user) => {
    const first = (user.FirstName || "").trim();
    const last = (user.LastName || "").trim();
    if (first || last) return `${first} ${last}`.trim();
    return user.Email || user.Uid || "—";
  };

  const getCompanies = (user) => {
    const c = user.Company;
    if (!c) return "—";
    if (Array.isArray(c)) return c.map((x) => x?.Name).filter(Boolean).join(", ") || "—";
    return c.Name || "—";
  };

  /** Status from API: Blocked → "Blocked", Visibility === -1 → "Archived", else → "Active" */
  const getStatus = (user) => {
    if (user.Blocked === true) return "Blocked";
    if (user.Visibility === -1) return "Archived";
    return "Active";
  };

  /** Display label for Rank (API: USER, ADMIN, SUPERADMIN, DISABLED) */
  const getRankLabel = (rank) => {
    if (!rank) return "—";
    const r = String(rank).toUpperCase();
    if (r === "ADMIN") return "Admin";
    if (r === "SUPERADMIN") return "Super Admin";
    if (r === "USER") return "User";
    if (r === "DISABLED") return "Disabled";
    return rank;
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(0);
  };

  const filtered = React.useMemo(() => {
    let list = allUsers.map((u) => ({
      ...u,
      _displayName: getDisplayName(u),
      _companies: getCompanies(u),
      _lastConnectionTs: u.LastSignInAt ?? u.UpdatedAt ?? 0,
      _lastConnectionLabel: formatLastConnection(u),
      _statusLabel: getStatus(u),
      _rankLabel: getRankLabel(u.Rank),
    }));

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (u) =>
          u._displayName.toLowerCase().includes(q) ||
          (u.Email && u.Email.toLowerCase().includes(q)) ||
          u._companies.toLowerCase().includes(q) ||
          (u.Rank && u.Rank.toLowerCase().includes(q)) ||
          getRankLabel(u.Rank).toLowerCase().includes(q) ||
          (u.Uid && u.Uid.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      let av, bv;
      if (sortField === "name") {
        av = a._displayName || "";
        bv = b._displayName || "";
        return sortDirection === "asc" ? (av + "").localeCompare(bv) : (bv + "").localeCompare(av);
      }
      if (sortField === "companies") {
        av = a._companies || "";
        bv = b._companies || "";
        return sortDirection === "asc" ? (av + "").localeCompare(bv) : (bv + "").localeCompare(av);
      }
      if (sortField === "role") {
        av = a._rankLabel || "";
        bv = b._rankLabel || "";
        return sortDirection === "asc" ? (av + "").localeCompare(bv) : (bv + "").localeCompare(av);
      }
      if (sortField === "lastConnection") {
        av = a._lastConnectionTs || 0;
        bv = b._lastConnectionTs || 0;
        return sortDirection === "asc" ? (av > bv ? 1 : av < bv ? -1 : 0) : bv - av;
      }
      if (sortField === "status") {
        av = a._statusLabel || "";
        bv = b._statusLabel || "";
        return sortDirection === "asc" ? (av + "").localeCompare(bv) : (bv + "").localeCompare(av);
      }
      return 0;
    });
    return list;
  }, [allUsers, searchQuery, sortField, sortDirection]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginated = filtered.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  const exportToCSV = () => {
    const headers = ["Name", "Companies", "Role", "Last connection", "Status"];
    const rows = filtered.map((u) => [
      getDisplayName(u),
      getCompanies(u),
      getRankLabel(u.Rank),
      formatLastConnection(u),
      getStatus(u),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => (c.includes(",") ? `"${c}"` : c)).join(","))].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    link.download = `users_export_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const resetFilters = () => {
    setRealmFilter("");
    setVisibilityFilter("all");
    setRealmSearchTerm("");
    setCurrentPage(0);
  };

  const selectedRealmName = realmFilter
    ? realmList.find((r) => r.uid === realmFilter)?.name || realmFilter
    : "All realms";

  const filteredRealmsForDropdown = useMemo(() => {
    const all = [{ uid: "", name: "All realms" }, ...realmList];
    if (!realmSearchTerm.trim()) return all;
    const q = realmSearchTerm.trim().toLowerCase();
    return all.filter((r) => (r.name || r.uid || "").toLowerCase().includes(q));
  }, [realmList, realmSearchTerm]);

  const handleCloseFilter = () => {
    setIsFilterClosing(true);
    setTimeout(() => {
      setIsFilterOpen(false);
      setIsFilterClosing(false);
    }, 300);
  };

  return (
    <div className="bg-slate-50 flex flex-col min-h-screen">
      <div className="flex flex-col p-3">
        <div className="mb-3 flex items-center justify-end gap-2">
          <Button
            size="sm"
            className="h-8 bg-[rgb(75,99,226)] hover:bg-[rgb(60,80,200)]"
            onClick={() => navigate("/CreateUser")}
            disabled={isLoading}
          >
            <Plus className="w-4 h-4 mr-1" />
            Create
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={exportToCSV} disabled={isLoading}>
            <Download className="w-4 h-4 mr-1" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={() => setIsFilterOpen(true)}>
            <Filter className="w-4 h-4 mr-1" />
            Filters
          </Button>
        </div>

        {isFilterOpen && (
          <>
            {!isFilterClosing && (
              <div className="fixed inset-0 bg-black/20 z-40 animate-in fade-in duration-200" onClick={handleCloseFilter} />
            )}
            <div
              className={`fixed right-0 top-0 h-full w-80 bg-white shadow-xl z-50 flex flex-col ${
                isFilterClosing ? "animate-out slide-out-to-right duration-300" : "animate-in slide-in-from-right duration-300"
              }`}
            >
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-slate-700" />
                  <h2 className="text-lg font-semibold text-slate-900">Filters</h2>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={resetFilters} className="h-8 text-[rgb(75,99,226)] border-[rgb(75,99,226)] hover:bg-[rgb(75,99,226)] hover:text-white">
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Reset
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleCloseFilter} className="h-8 w-8 p-0">
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Realm</h3>
                  {loadingRealms ? (
                    <p className="text-sm text-slate-500">Loading realms…</p>
                  ) : (
                    <Popover open={realmPopoverOpen} onOpenChange={setRealmPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={realmPopoverOpen}
                          className="w-full justify-between h-9 text-sm font-normal"
                        >
                          <span className="truncate">{selectedRealmName}</span>
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command>
                          <CommandInput
                            placeholder="Search realm..."
                            value={realmSearchTerm}
                            onValueChange={setRealmSearchTerm}
                            className="h-9"
                          />
                          <CommandList>
                            <CommandEmpty>No realm found.</CommandEmpty>
                            <CommandGroup>
                              {filteredRealmsForDropdown.map((r) => (
                                <CommandItem
                                  key={r.uid || "all"}
                                  value={r.name || r.uid || "All realms"}
                                  onSelect={() => {
                                    setRealmFilter(r.uid || "");
                                    setRealmPopoverOpen(false);
                                    setRealmSearchTerm("");
                                    setCurrentPage(0);
                                  }}
                                  className="text-sm"
                                >
                                  {r.name || r.uid || "All realms"}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Visibility</h3>
                  <select
                    className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white"
                    value={visibilityFilter}
                    onChange={(e) => {
                      setVisibilityFilter(e.target.value);
                      setCurrentPage(0);
                    }}
                  >
                    <option value="all">All</option>
                    <option value="visible">Visible</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="mb-3 p-3 rounded-md bg-red-50 text-red-700 text-sm">
            {error}
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
              <table className="w-full">
                <thead className="bg-slate-50 border-b sticky top-0 z-10">
                  <tr>
                    <th
                      className="text-left p-3 font-medium text-slate-600 text-sm cursor-pointer hover:bg-[rgb(75,99,226)]/10"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center gap-1">
                        Name <SortIcon field="name" />
                      </div>
                    </th>
                    <th
                      className="text-left p-3 font-medium text-slate-600 text-sm cursor-pointer hover:bg-[rgb(75,99,226)]/10"
                      onClick={() => handleSort("companies")}
                    >
                      <div className="flex items-center gap-1">
                        Companies <SortIcon field="companies" />
                      </div>
                    </th>
                    <th
                      className="text-left p-3 font-medium text-slate-600 text-sm cursor-pointer hover:bg-[rgb(75,99,226)]/10"
                      onClick={() => handleSort("role")}
                    >
                      <div className="flex items-center gap-1">
                        Role <SortIcon field="role" />
                      </div>
                    </th>
                    <th
                      className="text-left p-3 font-medium text-slate-600 text-sm cursor-pointer hover:bg-[rgb(75,99,226)]/10"
                      onClick={() => handleSort("lastConnection")}
                    >
                      <div className="flex items-center gap-1">
                        Last connection <SortIcon field="lastConnection" />
                      </div>
                    </th>
                    <th className="text-left p-3 font-medium text-slate-600 text-sm">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        Loading users…
                      </td>
                    </tr>
                  ) : paginated.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    paginated.map((user) => (
                      <tr
                        key={user.Uid}
                        className="border-b hover:bg-[rgb(75,99,226)]/5 cursor-pointer"
                        onClick={() => navigate(`/EditUser?id=${user.Uid}&name=${encodeURIComponent(getDisplayName(user))}`)}
                      >
                        <td className="p-3 text-sm text-slate-900">
                          <span className="hover:text-[rgb(75,99,226)] hover:underline">{getDisplayName(user)}</span>
                        </td>
                        <td className="p-3 text-sm text-slate-700">{getCompanies(user)}</td>
                        <td className="p-3 text-sm text-slate-700">{getRankLabel(user.Rank)}</td>
                        <td className="p-3 text-sm text-slate-600">{formatLastConnection(user)}</td>
                        <td className="p-3">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                              getStatus(user) === "Blocked"
                                ? "bg-red-100 text-red-800"
                                : getStatus(user) === "Archived"
                                  ? "bg-orange-100 text-orange-800"
                                  : "bg-green-100 text-green-800"
                            )}
                          >
                            {getStatus(user)}
                          </span>
                        </td>
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
        <div
          className="border-t border-slate-200 bg-white px-3 flex items-center justify-between flex-shrink-0 sticky bottom-0 z-10 shadow-sm w-full"
          style={{ height: "80px" }}
        >
          <div className="text-sm text-slate-600">
            Showing {currentPage * itemsPerPage + 1} to {Math.min((currentPage + 1) * itemsPerPage, filtered.length)} of {filtered.length} users
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0 || isLoading}
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
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1 || isLoading}
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
