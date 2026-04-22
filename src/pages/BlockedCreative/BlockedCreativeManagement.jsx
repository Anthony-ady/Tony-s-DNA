import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Download, Plus, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/authService";
import { useNavigate } from "react-router-dom";
import { API_ENDPOINTS } from "@/config/api";
import creativeScanPolicies from "../Realm/creative-scan-policies.json";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip } from "recharts";
import { toast } from "sonner";
import {
  readBlockedCreativesCacheMeta,
  readBlockedCreativesItemsFromIdb,
  writeBlockedCreativesCache,
  BLOCKED_CREATIVES_CACHE_TTL_MS,
} from "@/utils/blockedCreativesCache";

const POLICY_NAME_MAP = (Array.isArray(creativeScanPolicies) ? creativeScanPolicies : []).reduce(
  (acc, p) => {
    if (p?.uid) acc[p.uid] = p.name || p.uid;
    return acc;
  },
  {}
);

function sourceDisplayLabel(source) {
  if (source == null || source === "") return "";
  const s = String(source).trim().toUpperCase();
  if (s === "S2S") return "Server";
  if (s === "RUM") return "Publisher";
  return source;
}

export default function BlockedCreativeManagement() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window === "undefined") return true;
    const m = readBlockedCreativesCacheMeta(BLOCKED_CREATIVES_CACHE_TTL_MS);
    if (m?.kind === "inline") return false;
    return true;
  });
  const [allItems, setAllItems] = useState(() => {
    if (typeof window === "undefined") return [];
    const m = readBlockedCreativesCacheMeta(BLOCKED_CREATIVES_CACHE_TTL_MS);
    if (m?.kind === "inline") return m.items;
    return [];
  });
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage] = useState(20);
  const [sortField, setSortField] = useState("creative_id");
  const [sortDirection, setSortDirection] = useState("asc");

  const [partnerNameMap, setPartnerNameMap] = useState({});

  const fetchPartnersForMapping = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const response = await fetch(API_ENDPOINTS.PARTNERS_SEARCH, {
        method: "POST",
        headers: { "x-ayl-auth-token": token, "Content-Type": "application/json" },
        body: JSON.stringify({
          Filters: [{ Field: "Status", Operator: "in", Value: ["PRODUCTION", "DISABLED"] }],
          From: 0,
          Order: [{ Field: "UpdatedAt", Operator: "desc" }],
          Size: 250,
        }),
      });
      if (!response.ok) return;
      const data = await response.json();
      const list = Array.isArray(data?.Data) ? data.Data : [];
      const map = {};
      list.forEach((p) => {
        if (p.uid) map[p.uid] = p.name || p.uid;
      });
      setPartnerNameMap(map);
    } catch {
      // ignore
    }
  };

  const fetchAllFromNetwork = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const persist = async (items) => {
      const r = await writeBlockedCreativesCache(items);
      if (r === "none" && items.length > 0) {
        toast.warning("Cache navigateur", {
          id: "blocked-creatives-cache-write-fail",
          description:
            "La liste n’a pas pu être enregistrée (quota). Rechargement de la page = nouveaux appels API.",
        });
      }
    };

    try {
      const token = getToken();
      if (!token) throw new Error("No authentication token available");

      const headers = { "x-ayl-auth-token": token, "Content-Type": "application/json" };

      /** Probe: one row to read Total (e.g. "Total": 70716) without loading the full list. */
      const probeRes = await fetch(API_ENDPOINTS.BLOCKED_CREATIVE_SEARCH, {
        method: "POST",
        headers,
        body: JSON.stringify({ From: 0, Size: 1 }),
      });

      if (!probeRes.ok) {
        if (probeRes.status === 401) {
          authService.handleUnauthorized(navigate);
          return;
        }
        throw new Error(`HTTP error! status: ${probeRes.status}`);
      }

      const probeJson = await probeRes.json();
      const totalRaw = probeJson?.Total ?? probeJson?.total;
      const total = typeof totalRaw === "number" ? totalRaw : Number(totalRaw);

      if (!Number.isFinite(total) || total < 0) {
        const fallback = Array.isArray(probeJson?.Data) ? probeJson.Data : [];
        await persist(fallback);
        setAllItems(fallback);
        setCurrentPage(0);
        return;
      }

      if (total === 0) {
        await persist([]);
        setAllItems([]);
        setCurrentPage(0);
        return;
      }

      /** One full fetch: Size = Total (second round-trip only; probe was the first). */
      if (total === 1) {
        const one = Array.isArray(probeJson?.Data) ? probeJson.Data : [];
        await persist(one);
        setAllItems(one);
        setCurrentPage(0);
        return;
      }

      const response = await fetch(API_ENDPOINTS.BLOCKED_CREATIVE_SEARCH, {
        method: "POST",
        headers,
        body: JSON.stringify({ From: 0, Size: total }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          authService.handleUnauthorized(navigate);
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const list = Array.isArray(data?.Data) ? data.Data : [];
      const next = list.length > total ? list.slice(0, total) : list;
      await persist(next);
      setAllItems(next);
      setCurrentPage(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [getToken, navigate]);

  const fetchAllFromNetworkRef = useRef(fetchAllFromNetwork);
  fetchAllFromNetworkRef.current = fetchAllFromNetwork;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const m = readBlockedCreativesCacheMeta(BLOCKED_CREATIVES_CACHE_TTL_MS);
      if (m?.kind === "inline") {
        if (!cancelled) setIsLoading(false);
        return;
      }
      if (m?.kind === "pointer") {
        const fromIdb = await readBlockedCreativesItemsFromIdb();
        if (cancelled) return;
        if (Array.isArray(fromIdb) && fromIdb.length > 0) {
          setAllItems(fromIdb);
          setIsLoading(false);
          return;
        }
      }
      if (!cancelled) {
        await fetchAllFromNetworkRef.current();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      fetchAllFromNetworkRef.current();
    }, BLOCKED_CREATIVES_CACHE_TTL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetchPartnersForMapping();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      setSearchQuery(e.detail || "");
      setCurrentPage(0);
    };
    window.addEventListener("blockedCreativeSearchChanged", handler);
    return () => window.removeEventListener("blockedCreativeSearchChanged", handler);
  }, []);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(0);
  };

  const filtered = React.useMemo(() => {
    let list = [...allItems];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((i) => {
        const match = (s) => s != null && String(s).toLowerCase().includes(q);
        const nameMatch = partnerNameMap[i.partner_id] && partnerNameMap[i.partner_id].toLowerCase().includes(q);
        const policyNameMatch =
          POLICY_NAME_MAP[i.policy_id] && POLICY_NAME_MAP[i.policy_id].toLowerCase().includes(q);
        const rawSource = i.source ?? i.Source;
        const sourceMatch =
          match(rawSource) || (sourceDisplayLabel(rawSource) && sourceDisplayLabel(rawSource).toLowerCase().includes(q));
        return (
          match(i.creative_id) ||
          match(i.partner_id) ||
          nameMatch ||
          match(i.policy_id) ||
          policyNameMatch ||
          match(i.publisher_id) ||
          match(i.realm_id) ||
          sourceMatch ||
          match(i.uid)
        );
      });
    }
    list.sort((a, b) => {
      let av = a[sortField] ?? "";
      let bv = b[sortField] ?? "";
      if (sortField === "policy_id") {
        av = (POLICY_NAME_MAP[av] || av) ?? "";
        bv = (POLICY_NAME_MAP[bv] || bv) ?? "";
      }
      const cmp = typeof av === "string" ? (av + "").localeCompare(bv + "") : (av > bv ? 1 : av < bv ? -1 : 0);
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return list;
  }, [allItems, searchQuery, sortField, sortDirection, partnerNameMap]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);

  const PIE_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"];

  const pieChartDataByDsp = useMemo(() => {
    const byDsp = {};
    filtered.forEach((item) => {
      const dspId = item.partner_id ?? "";
      const label = dspId ? (partnerNameMap[dspId] || dspId) : "—";
      byDsp[label] = (byDsp[label] || 0) + 1;
    });
    const total = filtered.length;
    return Object.entries(byDsp)
      .map(([name, value]) => ({
        name,
        value,
        percentage: total > 0 ? ((value / total) * 100).toFixed(1) : "0",
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filtered, partnerNameMap]);

  const pieChartDataBySource = useMemo(() => {
    const bySource = {};
    filtered.forEach((item) => {
      const raw = item.source ?? item.Source ?? "";
      const label = raw ? sourceDisplayLabel(raw) || raw : "—";
      bySource[label] = (bySource[label] || 0) + 1;
    });
    const total = filtered.length;
    return Object.entries(bySource)
      .map(([name, value]) => ({
        name,
        value,
        percentage: total > 0 ? ((value / total) * 100).toFixed(1) : "0",
      }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const pieChartDataByPolicyId = useMemo(() => {
    const byPolicy = {};
    filtered.forEach((item) => {
      const policyId = item.policy_id ?? "";
      const label = policyId ? (POLICY_NAME_MAP[policyId] || policyId) : "none";
      byPolicy[label] = (byPolicy[label] || 0) + 1;
    });
    const total = filtered.length;
    return Object.entries(byPolicy)
      .map(([name, value]) => ({
        name,
        value,
        percentage: total > 0 ? ((value / total) * 100).toFixed(1) : "0",
      }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const exportToCSV = () => {
    const headers = ["creative_id", "source", "partner_id", "policy_id", "publisher_id", "realm_id"];
    const rows = filtered.map((i) => headers.map((h) => i[h] ?? "").join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    link.download = `blocked_creatives_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />;
  };

  const cell = (v) => (v != null && v !== "" ? String(v) : "—");

  const handlePieSliceClick = (name) => {
    if (name == null) return;
    const value = String(name);
    const isAlreadyFiltered = searchQuery.trim() === value;
    window.dispatchEvent(
      new CustomEvent("blockedCreativeSearchSet", { detail: isAlreadyFiltered ? "" : value })
    );
  };

  return (
    <div className="bg-slate-50 flex flex-col min-h-screen">
      <div className="flex flex-col p-3">
        <div className="mb-3 flex items-center justify-end gap-2">
            <Button
              size="sm"
              className="h-8 bg-[rgb(75,99,226)] hover:bg-[rgb(60,80,200)]"
              onClick={() => navigate("/CreateBlockedCreative")}
              disabled={isLoading}
            >
              <Plus className="w-4 h-4 mr-1" /> Create
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => fetchAllFromNetworkRef.current()}
              disabled={isLoading}
              title="Recharge la liste via l’API (requêtes attendues). Met à jour le cache pour les prochaines visites dans l’heure."
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={exportToCSV} disabled={isLoading}>
              <Download className="w-4 h-4 mr-1" /> Export CSV
            </Button>
          </div>

        {!isLoading && filtered.length > 0 && (pieChartDataByDsp.length > 0 || pieChartDataBySource.length > 0 || pieChartDataByPolicyId.length > 0) && (
          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {pieChartDataByDsp.length > 0 && (
              <Card className="border-t-4 border-t-[rgb(75,99,226)]">
                <CardContent className="pt-4">
                  <h3 className="text-lg font-semibold mb-3" style={{ color: "rgb(75,99,226)" }}>Blocked creatives by DSP</h3>
                  <div className="h-64 text-xs" style={{ fontSize: "11px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartDataByDsp}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          label={({ name, percentage }) =>
                            parseFloat(percentage) >= 5 ? `${name} ${percentage}%` : ""
                          }
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          onClick={(data) => handlePieSliceClick(data?.name)}
                          style={{ cursor: "pointer", fontSize: "11px" }}
                        >
                          {pieChartDataByDsp.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value, name, props) => {
                            const pct = props.payload.percentage || 0;
                            return [`${value} (${pct}%)`, name];
                          }}
                          contentStyle={{
                            backgroundColor: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: "6px",
                            fontSize: "11px",
                          }}
                          labelStyle={{ fontWeight: "bold", fontSize: "11px" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
            {pieChartDataBySource.length > 0 && (
              <Card className="border-t-4 border-t-emerald-500">
                <CardContent className="pt-4">
                  <h3 className="text-lg font-semibold mb-3 text-emerald-600">Blocked creatives by Source</h3>
                  <div className="h-64 text-xs" style={{ fontSize: "11px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartDataBySource}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          label={({ name, percentage }) =>
                            parseFloat(percentage) >= 5 ? `${name} ${percentage}%` : ""
                          }
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          onClick={(data) => handlePieSliceClick(data?.name)}
                          style={{ cursor: "pointer", fontSize: "11px" }}
                        >
                          {pieChartDataBySource.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value, name, props) => {
                            const pct = props.payload.percentage || 0;
                            return [`${value} (${pct}%)`, name];
                          }}
                          contentStyle={{
                            backgroundColor: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: "6px",
                            fontSize: "11px",
                          }}
                          labelStyle={{ fontWeight: "bold", fontSize: "11px" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
            {pieChartDataByPolicyId.length > 0 && (
              <Card className="border-t-4 border-t-amber-500">
                <CardContent className="pt-4">
                  <h3 className="text-lg font-semibold mb-3 text-amber-600">Blocked creatives by Policy ID</h3>
                  <div className="h-64 text-xs" style={{ fontSize: "11px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartDataByPolicyId}
                          cx="50%"
                          cy="50%"
                          labelLine={true}
                          label={({ name, percentage }) =>
                            parseFloat(percentage) >= 5 ? `${name} ${percentage}%` : ""
                          }
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          onClick={(data) => handlePieSliceClick(data?.name)}
                          style={{ cursor: "pointer", fontSize: "11px" }}
                        >
                          {pieChartDataByPolicyId.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value, name, props) => {
                            const pct = props.payload.percentage || 0;
                            return [`${value} (${pct}%)`, name];
                          }}
                          contentStyle={{
                            backgroundColor: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: "6px",
                            fontSize: "11px",
                          }}
                          labelStyle={{ fontWeight: "bold", fontSize: "11px" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
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
                      onClick={() => handleSort("creative_id")}
                    >
                      <div className="flex items-center gap-1">
                        Creative ID <SortIcon field="creative_id" />
                      </div>
                    </th>
                    <th
                      className="text-left p-3 font-medium text-slate-600 text-sm cursor-pointer hover:bg-[rgb(75,99,226)]/10"
                      onClick={() => handleSort("source")}
                    >
                      <div className="flex items-center gap-1">
                        Source <SortIcon field="source" />
                      </div>
                    </th>
                    <th
                      className="text-left p-3 font-medium text-slate-600 text-sm cursor-pointer hover:bg-[rgb(75,99,226)]/10"
                      onClick={() => handleSort("partner_id")}
                    >
                      <div className="flex items-center gap-1">
                        DSP <SortIcon field="partner_id" />
                      </div>
                    </th>
                    <th
                      className="text-left p-3 font-medium text-slate-600 text-sm cursor-pointer hover:bg-[rgb(75,99,226)]/10"
                      onClick={() => handleSort("policy_id")}
                    >
                      <div className="flex items-center gap-1">
                        Policy ID <SortIcon field="policy_id" />
                      </div>
                    </th>
                    <th className="text-left p-3 font-medium text-slate-600 text-sm">Publisher ID</th>
                    <th className="text-left p-3 font-medium text-slate-600 text-sm">Realm ID</th>
                    </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        Loading blocked creatives…
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-red-500">
                        {error}
                      </td>
                    </tr>
                  ) : paginated.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        No blocked creatives found
                      </td>
                    </tr>
                  ) : (
                    paginated.map((item, idx) => (
                      <tr
                        key={item.uid || item.creative_id + item.partner_id + idx}
                        className="border-b hover:bg-[rgb(75,99,226)]/5"
                      >
                        <td className="p-3 font-mono text-sm text-slate-900">{cell(item.creative_id)}</td>
                        <td className="p-3 text-sm text-slate-700">
                          {cell(sourceDisplayLabel(item.source ?? item.Source))}
                        </td>
                        <td className="p-3 text-sm text-slate-700">
                          {item.partner_id ? (
                            partnerNameMap[item.partner_id] ? (
                              <span className="block">
                                <span className="block">{partnerNameMap[item.partner_id]}</span>
                                <span className="block text-xs text-slate-400 font-mono">{item.partner_id}</span>
                              </span>
                            ) : (
                              item.partner_id
                            )
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-3 text-sm text-slate-700">
                          {item.policy_id ? (
                            POLICY_NAME_MAP[item.policy_id] ? (
                              <span className="block">
                                <span className="block">{POLICY_NAME_MAP[item.policy_id]}</span>
                                <span className="block text-xs text-slate-400 font-mono">{item.policy_id}</span>
                              </span>
                            ) : (
                              item.policy_id
                            )
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-3 font-mono text-xs text-slate-500">{cell(item.publisher_id)}</td>
                        <td className="p-3 text-xs text-slate-500">{cell(item.realm_id)}</td>
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
            Showing {currentPage * itemsPerPage + 1} to{" "}
            {Math.min((currentPage + 1) * itemsPerPage, filtered.length)} of {filtered.length} blocked creatives
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => p - 1)}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </Button>
            <span className="text-sm text-slate-600">
              Page {currentPage + 1} of {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage >= totalPages - 1}
            >
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
