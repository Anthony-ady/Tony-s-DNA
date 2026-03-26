import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar, DollarSign, TrendingUp, BarChart3, Download } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { Loader2 } from "lucide-react";

/**
 * Reusable Business Review / OVERVIEW panel.
 *
 * Expects processedData: [{ adKind, date (YYYY-MM-DD), bidRequests, impressions, clicks, priceAdvertiser, pricePublisher, ... }, ...]
 * 
 * entityType: 'dsp' | 'realm' | 'company' | 'site' | 'deal'
 * - 'dsp': Use priceAdvertiser (Advertiser revenue)
 * - 'realm' | 'company' | 'site': Use pricePublisher (Publisher revenue)
 * - 'deal': Show both (Advertiser revenue and Publisher revenue)
 */
export default function BusinessReviewOverview({
  processedData = [],
  loading = false,
  error = null,
  title = "DSP Performance Dashboard",
  subtitlePrefix = "Business Review",
  partnerId = null,
  exportToPDF = null, // Function to export to PDF
  entityType = 'dsp', // 'dsp' | 'realm' | 'company' | 'site' | 'deal'
}) {
  const [viewMode, setViewMode] = useState("month"); // 'month' | 'year'
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);

  // Map adKind to display name (shared mapping)
  const getAdKindDisplayName = (adKind) => {
    const mapping = {
      AD_TRAFFIC: "NATIVE DISPLAY",
      AD_OUTSTREAM: "OUTSTREAM",
      AD_INSTREAM: "INSTREAM",
      AD_RAW_VIDEO: "VIDEO IN BANNER",
      AD_VIDEO: "NATIVE VIDEO",
      AD_BANNER: "DISPLAY",
    };
    return mapping[adKind] || adKind || "Unknown";
  };

  // Colors for pie / bar charts
  const PIE_COLORS = [
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#EC4899",
    "#06B6D4",
    "#F97316",
  ];

  const formatBidResponses = (value) => {
    if (value >= 1000000000) {
      const billions = (value / 1000000000).toFixed(2);
      return `${billions.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}B`;
    }
    if (value >= 1000000) {
      const millions = (value / 1000000).toFixed(2);
      return `${millions.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}M`;
    }
    if (value >= 1000) {
      const thousands = (value / 1000).toFixed(2);
      return `${thousands.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}K`;
    }
    return value
      .toLocaleString("fr-FR", { useGrouping: true })
      .replace(/,/g, " ");
  };

  const formatCurrency = (value) => {
    if (value >= 1000000) {
      const millions = (value / 1000000).toFixed(2);
      return `$${millions.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}M`;
    }
    if (value >= 1000) {
      const thousands = (value / 1000).toFixed(2);
      return `$${thousands.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}K`;
    }
    return `$${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;
  };

  const formatCurrencyDetailed = (value) => {
    if (value >= 1000000) {
      const millions = (value / 1000000).toFixed(2);
      return `$${millions.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}M`;
    }
    if (value >= 1000) {
      const thousands = (value / 1000).toFixed(2);
      return `$${thousands.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}K`;
    }
    return `$${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;
  };

  // Months / years from processedData
  const { months, years } = useMemo(() => {
    const monthsSet = new Set();
    const yearsSet = new Set();
    processedData.forEach((item) => {
      if (!item.date) return;
      const d = new Date(item.date);
      if (isNaN(d.getTime())) return;
      const iso = d.toISOString().split("T")[0]; // YYYY-MM-DD
      monthsSet.add(iso.slice(0, 7)); // YYYY-MM
      yearsSet.add(iso.slice(0, 4)); // YYYY
    });
    return {
      months: Array.from(monthsSet).sort().reverse(),
      years: Array.from(yearsSet).sort().reverse(),
    };
  }, [processedData]);

  const effectiveViewMode = viewMode || "month";
  const effectiveMonth =
    effectiveViewMode === "month"
      ? selectedMonth || months[0] || null
      : null;
  const effectiveYear =
    effectiveViewMode === "year" ? selectedYear || years[0] || null : null;

  // Filtered data by period
  const filtered = useMemo(() => {
    return processedData.filter((item) => {
      if (!item.date) return false;
      if (effectiveViewMode === "month" && effectiveMonth) {
        return item.date.startsWith(effectiveMonth);
      }
      if (effectiveViewMode === "year" && effectiveYear) {
        return item.date.startsWith(effectiveYear);
      }
      return true;
    });
  }, [processedData, effectiveViewMode, effectiveMonth, effectiveYear]);

  // Determine which revenue field to use based on entity type
  const getRevenueValue = (item) => {
    if (entityType === 'dsp') {
      return item.priceAdvertiser || 0;
    } else if (['realm', 'company', 'site'].includes(entityType)) {
      return item.pricePublisher || 0;
    } else if (entityType === 'deal') {
      // For deals, we'll calculate both separately
      return item.priceAdvertiser || 0;
    }
    return item.priceAdvertiser || 0; // Default fallback
  };

  const getPublisherRevenueValue = (item) => {
    return item.pricePublisher || 0;
  };

  // KPIs
  const kpis = useMemo(
    () =>
      filtered.reduce(
        (acc, item) => {
          acc.bidRequests += item.bidRequests || 0;
          acc.impressions += item.impressions || 0;
          acc.clicks += item.clicks || 0;
          acc.revenue += getRevenueValue(item);
          if (entityType === 'deal') {
            acc.publisherRevenue = (acc.publisherRevenue || 0) + getPublisherRevenueValue(item);
          }
          return acc;
        },
        { bidRequests: 0, impressions: 0, clicks: 0, revenue: 0, publisherRevenue: 0 }
      ),
    [filtered, entityType]
  );

  // Trend data
  const dailyTrendData = useMemo(() => {
    const trendMap = {};
    filtered.forEach((item) => {
      const date = item.date;
      if (!date) return;
      const key =
        effectiveViewMode === "year" ? date.slice(0, 7) : date; // YYYY-MM or YYYY-MM-DD

      if (!trendMap[key]) {
        trendMap[key] = {
          sortKey: key,
          dateLabel:
            effectiveViewMode === "year"
              ? new Date(key + "-01").toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })
              : key,
          bidRequests: 0,
          impressions: 0,
          clicks: 0,
          revenue: 0,
          publisherRevenue: 0,
        };
      }
      trendMap[key].bidRequests += item.bidRequests || 0;
      trendMap[key].impressions += item.impressions || 0;
      trendMap[key].clicks += item.clicks || 0;
      trendMap[key].revenue += getRevenueValue(item);
      if (entityType === 'deal') {
        trendMap[key].publisherRevenue += getPublisherRevenueValue(item);
      }
    });

    return Object.values(trendMap).sort((a, b) =>
      a.sortKey > b.sortKey ? 1 : a.sortKey < b.sortKey ? -1 : 0
    );
  }, [filtered, effectiveViewMode, entityType]);

  // Pie data (Impression by Ad Type)
  const pieData = useMemo(() => {
    const adKindImpressions = {};
    filtered.forEach((item) => {
      if (!item.adKind) return;
      if (!adKindImpressions[item.adKind]) {
        adKindImpressions[item.adKind] = 0;
      }
      adKindImpressions[item.adKind] += item.impressions || 0;
    });
    const totalImpressions = Object.values(adKindImpressions).reduce(
      (sum, v) => sum + v,
      0
    );
    return Object.entries(adKindImpressions).map(([adKind, value]) => {
      const percentage =
        totalImpressions > 0
          ? ((value / totalImpressions) * 100).toFixed(2)
          : "0.00";
      return {
        name: getAdKindDisplayName(adKind),
        value,
        percentage,
      };
    });
  }, [filtered]);

  // Bar data (Revenue by Ad Type)
  const barData = useMemo(() => {
    const adKindRevenue = {};
    const adKindPublisherRevenue = {};
    filtered.forEach((item) => {
      if (!item.adKind) return;
      if (!adKindRevenue[item.adKind]) {
        adKindRevenue[item.adKind] = 0;
      }
      adKindRevenue[item.adKind] += getRevenueValue(item);
      if (entityType === 'deal') {
        if (!adKindPublisherRevenue[item.adKind]) {
          adKindPublisherRevenue[item.adKind] = 0;
        }
        adKindPublisherRevenue[item.adKind] += getPublisherRevenueValue(item);
      }
    });
    const revenueEntries = Object.entries(adKindRevenue);
    if (entityType === 'deal') {
      // For deals, combine both revenues
      return revenueEntries.map(([adKind, value]) => ({
        name: getAdKindDisplayName(adKind),
        advertiserRevenue: (value || 0) / 1000, // thousands
        publisherRevenue: ((adKindPublisherRevenue[adKind] || 0) / 1000), // thousands
      }));
    }
    return revenueEntries.map(([adKind, value]) => ({
      name: getAdKindDisplayName(adKind),
      revenue: (value || 0) / 1000, // thousands
    }));
  }, [filtered, entityType]);

  const getBRPeriodLabel = () => {
    if (effectiveViewMode === "month" && effectiveMonth) {
      const date = new Date(effectiveMonth + "-01");
      return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    if (effectiveViewMode === "year" && effectiveYear) {
      return effectiveYear;
    }
    return "All Time";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-[rgb(75,99,226)]" />
        <span className="ml-2 text-slate-600 text-sm">
          Loading Business Review data...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
        <p className="text-red-800 font-medium">Error loading data</p>
        <p className="text-red-600 mt-1">{error}</p>
      </div>
    );
  }

  if (!processedData || filtered.length === 0) {
    return (
      <div className="text-center py-10 text-slate-500 text-sm">
        <p>No Business Review data available.</p>
        {partnerId && (
          <p className="text-xs mt-2">Partner ID: {partnerId}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="mb-2 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">{title}</h1>
          <p className="text-xs text-slate-600 mt-0.5">
            {subtitlePrefix} • {getBRPeriodLabel()}
          </p>
          {partnerId && (
            <p className="text-[11px] text-slate-500 mt-0.5">
              Partner ID: {partnerId}
            </p>
          )}
        </div>
        {exportToPDF && filtered.length > 0 && (
          <Button
            onClick={() => exportToPDF(effectiveViewMode, effectiveMonth, effectiveYear)}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-medium text-slate-700">View:</span>
          <Select
            value={effectiveViewMode}
            onValueChange={(value) => {
              setViewMode(value);
              if (value === "month" && months.length > 0) {
                setSelectedMonth(months[0]);
              } else if (value === "year" && years.length > 0) {
                setSelectedYear(years[0]);
              }
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">By Month</SelectItem>
              <SelectItem value="year">By Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {effectiveViewMode === "month" && months.length > 0 && (
          <Select
            value={effectiveMonth || ""}
            onValueChange={(value) => setSelectedMonth(value)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => {
                const date = new Date(month + "-01");
                return (
                  <SelectItem key={month} value={month}>
                    {date.toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}

        {effectiveViewMode === "year" && years.length > 0 && (
          <Select
            value={effectiveYear || ""}
            onValueChange={(value) => setSelectedYear(value)}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Select year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* KPI Cards (compact) */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${entityType === 'deal' ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3 mb-3`}>
        <Card className="border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 bg-gradient-to-br from-amber-50 to-amber-100/50">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[11px] font-medium text-amber-700">
                BID REQUESTS
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="text-xl font-bold text-amber-800">
              {formatBidResponses(kpis.bidRequests)}
            </div>
            <p className="mt-0.5 text-[11px] text-amber-700/80">Total requests</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/50">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[11px] font-medium text-blue-700">
                IMPRESSIONS
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="text-xl font-bold text-blue-800">
              {formatBidResponses(kpis.impressions)}
            </div>
            <p className="mt-0.5 text-[11px] text-blue-700/80">
              Total impressions
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 bg-gradient-to-br from-red-50 to-red-100/50">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[11px] font-medium text-red-700">
                CLICKS
              </div>
              <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="text-xl font-bold text-red-800">
              {formatBidResponses(kpis.clicks)}
            </div>
            <p className="mt-0.5 text-[11px] text-red-700/80">Total clicks</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[11px] font-medium text-emerald-700">
                {entityType === 'deal' ? 'ADVERTISER REVENUE' : entityType === 'dsp' ? 'REVENUE' : 'PUBLISHER REVENUE'}
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="text-xl font-bold text-emerald-800">
              {formatCurrency(kpis.revenue)}
            </div>
            <p className="mt-0.5 text-[11px] text-emerald-700/80">
              {entityType === 'deal' ? 'Advertiser spend' : entityType === 'dsp' ? 'Advertiser spend' : 'Publisher revenue'}
            </p>
          </CardContent>
        </Card>

        {entityType === 'deal' && (
          <Card className="border-l-4 border-l-teal-500 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 bg-gradient-to-br from-teal-50 to-teal-100/50">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[11px] font-medium text-teal-700">
                  PUBLISHER REVENUE
                </div>
                <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="text-xl font-bold text-teal-800">
                {formatCurrency(kpis.publisherRevenue || 0)}
              </div>
              <p className="mt-0.5 text-[11px] text-teal-700/80">
                Publisher revenue
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Trend + distributions (compact) */}
      <div className="space-y-3">
        <Card className="shadow-sm border-t-4 border-t-blue-500">
          <CardHeader className="pb-1.5 pt-2 bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardTitle className="text-xs font-semibold text-blue-900">
              {effectiveViewMode === "year"
                ? "Monthly Performance Trend"
                : "Daily Performance"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-1.5 bg-white">
            <div style={{ height: "30vh", minHeight: "200px" }}>
              <ResponsiveContainer
                width="100%"
                height="100%"
                style={{ marginTop: "25px" }}
              >
                <LineChart data={dailyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 10, fill: "#6b7280" }}
                    angle={-45}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    yAxisId="left"
                    scale="pow"
                    exponent={0.8}
                    tick={{ fontSize: 10, fill: "#6b7280" }}
                    tickFormatter={(value) => formatBidResponses(value)}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 10, fill: "#6b7280" }}
                    tickFormatter={(value) => formatCurrencyDetailed(value)}
                  />
                  <RechartsTooltip
                    formatter={(value, name, props) => {
                      const v =
                        typeof value === "number" ? value : Number(value || 0);
                      let label = name;
                      let formatted = "";
                      if (props.dataKey === "bidRequests") {
                        label = "Bid Requests";
                        formatted = formatBidResponses(v);
                      } else if (props.dataKey === "impressions") {
                        label = "Impressions";
                        formatted = formatBidResponses(v);
                      } else if (props.dataKey === "clicks") {
                        label = "Clicks";
                        formatted = formatBidResponses(v);
                      } else if (props.dataKey === "revenue") {
                        label = entityType === 'deal' ? "Advertiser Revenue ($)" : entityType === 'dsp' ? "Advertiser Revenue ($)" : "Publisher Revenue ($)";
                        formatted = formatCurrencyDetailed(v);
                      } else if (props.dataKey === "publisherRevenue") {
                        label = "Publisher Revenue ($)";
                        formatted = formatCurrencyDetailed(v);
                      } else {
                        formatted = formatBidResponses(v);
                      }
                      return [formatted, label];
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="bidRequests"
                    stroke="#F59E0B"
                    strokeWidth={3}
                    dot={false}
                    activeDot={false}
                    name="Bid Requests"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="impressions"
                    stroke="#3B82F6"
                    strokeWidth={3}
                    dot={false}
                    activeDot={false}
                    name="Impressions"
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="clicks"
                    stroke="#EF4444"
                    strokeWidth={3}
                    strokeDasharray="3 3"
                    dot={false}
                    activeDot={false}
                    name="Clicks"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10B981"
                    strokeWidth={3}
                    strokeDasharray="5 5"
                    dot={false}
                    activeDot={false}
                    name={entityType === 'deal' ? "Advertiser Revenue ($)" : entityType === 'dsp' ? "Advertiser Revenue ($)" : "Publisher Revenue ($)"}
                  />
                  {entityType === 'deal' && (
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="publisherRevenue"
                      stroke="#14B8A6"
                      strokeWidth={3}
                      strokeDasharray="7 7"
                      dot={false}
                      activeDot={false}
                      name="Publisher Revenue ($)"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Impression by Ad Type */}
          <Card className="border-t-4 border-t-purple-500 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
              <CardTitle className="text-sm text-purple-900">
                Impression by Ad Type
              </CardTitle>
            </CardHeader>
            <CardContent className="bg-white">
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, percentage }) =>
                        parseFloat(percentage) >= 2
                          ? `${name} ${percentage}%`
                          : ""
                      }
                      outerRadius={70}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value, name, props) => {
                        const percentage = props.payload.percentage || 0;
                        return [
                          `${formatBidResponses(value)} (${percentage}%)`,
                          name,
                        ];
                      }}
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                      }}
                      labelStyle={{ fontWeight: "bold" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Revenue by Ad Type */}
          <Card className="border-t-4 border-t-green-500 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
              <CardTitle className="text-sm text-green-900">
                {entityType === 'deal' ? 'Revenue by Ad Type' : entityType === 'dsp' ? 'Advertiser Revenue by Ad Type' : 'Publisher Revenue by Ad Type'}
              </CardTitle>
            </CardHeader>
            <CardContent className="bg-white">
              <div className="h-48">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  style={{ marginTop: "30px" }}
                >
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: "#6b7280" }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "#6b7280" }}
                      tickFormatter={(value) => {
                        if (value >= 1000) {
                          return `$${(value / 1000).toFixed(1)}M`;
                        }
                        return `$${value.toFixed(1)}K`;
                      }}
                    />
                    <RechartsTooltip
                      formatter={(value, name) => {
                        const fullValue = value * 1000;
                        return [formatCurrencyDetailed(fullValue), name === 'advertiserRevenue' ? 'Advertiser Revenue' : name === 'publisherRevenue' ? 'Publisher Revenue' : 'Revenue'];
                      }}
                      contentStyle={{
                        backgroundColor: "#fff",
                        border: "1px solid #e5e7eb",
                        borderRadius: "6px",
                      }}
                    />
                    <Legend />
                    {entityType === 'deal' ? (
                      <>
                        <Bar dataKey="advertiserRevenue" radius={[8, 8, 0, 0]} fill="#10B981" name="Advertiser Revenue" />
                        <Bar dataKey="publisherRevenue" radius={[8, 8, 0, 0]} fill="#14B8A6" name="Publisher Revenue" />
                      </>
                    ) : (
                      <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
                        {barData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


