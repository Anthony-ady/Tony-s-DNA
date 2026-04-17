import React from "react";
import { DollarSign, TrendingUp, BarChart3, ExternalLink } from "lucide-react";
import { enqueueSparklineFetch } from "@/utils/sparklineFetchQueue";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

/**
 * Generic performance card for an entity (DSP, Deal, Site, etc.)
 * - Shows name + margin %
 * - Shows Revenue / Publisher Costs / Margin on one line
 * - Shows a small daily Revenue & Costs trend curve
 * Spark data loads when the card enters the viewport (IntersectionObserver) and
 * fetches are queued globally (max 3 concurrent) to limit backend load.
 */

export function EntityPerformanceCard({
  entityId,
  entityName,
  startDate,
  endDate,
  revenue,
  publisherCost,
  margin,
  marginPct,
  fetchDailyData, // async (entityId, entityName, startDate, endDate) => daily[]
  onClick, // (entityId, entityName) => void
  cache, // { [cacheKey]: series[] }
  setCache, // setState updater for cache
  formatCurrency, // (value) => string
  formatCurrencyDetailed, // (value) => string
  showImpressionsAndCtr = false,
  viewMode = 'daily',
  getDetailUrl, // optional: (entityId, entityName) => string — if provided, shows icon to open in new tab
}) {
  const isPositive = margin >= 0;
  const [sparkData, setSparkData] = React.useState([]);
  const [loadingSpark, setLoadingSpark] = React.useState(false);
  const [sparkInView, setSparkInView] = React.useState(false);
  const cardRootRef = React.useRef(null);
  const requestIdRef = React.useRef(0);
  const loadingSpinnerDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" fill="none" stroke="#94a3b8" stroke-width="5" stroke-linecap="round" stroke-dasharray="31.4 31.4"><animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite"/></circle></svg>'
  )}`;

  const sparkCacheKey = React.useMemo(
    () => `${entityId}_${startDate}_${endDate}_${viewMode}`,
    [entityId, startDate, endDate, viewMode]
  );

  const hasSparkCacheEntry =
    cache != null && Object.prototype.hasOwnProperty.call(cache, sparkCacheKey);

  React.useLayoutEffect(() => {
    const el = cardRootRef.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setSparkInView(true);
      return undefined;
    }
    let cancelled = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (cancelled) return;
        if (entries.some((e) => e.isIntersecting)) {
          setSparkInView(true);
        }
      },
      { root: null, rootMargin: "120px 0px 280px 0px", threshold: 0.01 }
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [entityId, startDate, endDate, viewMode]);

  React.useEffect(() => {
    let cancelled = false;
    const cacheKey = sparkCacheKey;
    const requestId = ++requestIdRef.current;

    const cached = cache?.[cacheKey];
    if (cached && Array.isArray(cached)) {
      setSparkData(cached);
      setLoadingSpark(false);
      return () => {
        cancelled = true;
      };
    }

    if (!sparkInView) {
      setLoadingSpark(false);
      return () => {
        cancelled = true;
      };
    }

    setLoadingSpark(true);
    const load = async () => {
      try {
        const daily = await enqueueSparklineFetch(() =>
          fetchDailyData(entityId, entityName, startDate, endDate)
        );
        if (cancelled || requestId !== requestIdRef.current) return;
        const chart = (daily || []).map((d) => ({
          dateLabel: d.day,
          revenue: d.entityRevenue || 0,
          costs: d.publisherCost || 0,
          impressions: d.impression ?? d.impressions ?? 0,
          visibleImpressions: d.visibleImpressions ?? 0,
          ctr: typeof d.ctr === "number" ? d.ctr : 0,
          viewability: typeof d.viewabilityRate === "number" ? d.viewabilityRate : 0,
          // Include yesterday revenue & costs for hourly comparison
          yesterdayRevenue: d.yesterdayData?.entityRevenue ?? null,
          yesterdayCosts: d.yesterdayData?.publisherCost ?? null,
          // Include yesterday impressions & CTR for hourly comparison (SalesDashboard)
          yesterdayImpressions: d.yesterdayData?.impression ?? null,
          yesterdayVisibleImpressions: d.yesterdayData?.visibleImpressions ?? null,
          yesterdayCtr: d.yesterdayData?.ctr ?? null,
        }));
        setSparkData(chart);
        setCache((prev) => ({
          ...prev,
          [cacheKey]: chart,
        }));
      } catch (e) {
        if (!cancelled && requestId === requestIdRef.current) {
          setSparkData([]);
        }
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          setLoadingSpark(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [
    entityId,
    entityName,
    startDate,
    endDate,
    cache,
    setCache,
    fetchDailyData,
    viewMode,
    sparkInView,
    sparkCacheKey,
  ]);

  const handleClick = () => {
    if (!entityId || !entityName || !onClick) return;
    onClick(entityId, entityName);
  };

  const handleOpenInNewTab = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!getDetailUrl || !entityId || !entityName) return;
    const url = getDetailUrl(entityId, entityName);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  const stripM = (value) => {
    if (typeof value !== "string") return value;
    return value.replace(/M\b/, "");
  };

  // Calculate today/yesterday totals for hourly mode
  const hourlyStats = React.useMemo(() => {
    if (viewMode !== 'hourly' || !sparkData || sparkData.length === 0) {
      return null;
    }

    const todayRevenue = sparkData.reduce((sum, d) => sum + (d.revenue || 0), 0);
    const yesterdayRevenue = sparkData.reduce((sum, d) => sum + (d.yesterdayRevenue || 0), 0);
    
    const todayCosts = sparkData.reduce((sum, d) => sum + (d.costs || 0), 0);
    const yesterdayCosts = sparkData.reduce((sum, d) => sum + (d.yesterdayCosts || 0), 0);
    
    const todayMargin = todayRevenue - todayCosts;
    const yesterdayMargin = yesterdayRevenue - yesterdayCosts;
    
    const todayMarginPct = todayRevenue > 0 ? ((todayMargin / todayRevenue) * 100).toFixed(2) : "0.00";
    const yesterdayMarginPct = yesterdayRevenue > 0 ? ((yesterdayMargin / yesterdayRevenue) * 100).toFixed(2) : "0.00";

    return {
      todayRevenue,
      yesterdayRevenue,
      todayCosts,
      yesterdayCosts,
      todayMargin,
      yesterdayMargin,
      todayMarginPct,
      yesterdayMarginPct,
    };
  }, [viewMode, sparkData]);

  const [isHovered, setIsHovered] = React.useState(false);

  /** Linear scale + domain focused on data range so daily impression variation stays visible.
   * Log scale was flattening the blue line and breaks when visible impressions are 0. */
  const impressionsChartScale = React.useMemo(() => {
    if (!sparkData?.length) {
      return {
        impDomain: [0, "auto"],
        visDomain: [0, "auto"],
        needDualAxis: false,
        showVisibleLine: false,
      };
    }
    const imps = sparkData.map((d) => Number(d.impressions) || 0);
    const vis = sparkData.map((d) => Number(d.visibleImpressions) || 0);
    const maxVis = Math.max(0, ...vis);
    const minI = Math.min(...imps);
    const maxI = Math.max(...imps);
    let impDomain;
    if (maxI <= 0) {
      impDomain = [0, 1];
    } else {
      const spread = maxI - minI;
      const pad = spread > 0 ? spread * 0.15 : maxI * 0.08;
      impDomain = [Math.max(0, minI - pad), maxI + pad];
    }
    const showVisibleLine = maxVis > 0;
    const needDualAxis =
      showVisibleLine &&
      maxI > 0 &&
      maxVis > 0 &&
      maxI / maxVis >= 10;
    if (!needDualAxis && showVisibleLine && maxI > 0 && maxVis > 0) {
      const minV = Math.min(...vis);
      const maxV = maxVis;
      const minCombined = Math.min(minI, minV);
      const maxCombined = Math.max(maxI, maxV);
      const spread = maxCombined - minCombined;
      const pad = spread > 0 ? spread * 0.12 : maxCombined * 0.08;
      impDomain = [Math.max(0, minCombined - pad), maxCombined + pad];
    }
    let visDomain = [0, "auto"];
    if (needDualAxis) {
      const visPositive = vis.filter((v) => v > 0);
      const minV = visPositive.length ? Math.min(...visPositive) : 0;
      const maxV = Math.max(...vis, 0);
      const vSpread = maxV - minV;
      const vPad = vSpread > 0 ? vSpread * 0.15 : Math.max(maxV * 0.08, 1);
      visDomain = [Math.max(0, minV - vPad * 0.5), maxV + vPad];
    }
    return { impDomain, visDomain, needDualAxis, showVisibleLine };
  }, [sparkData]);

  return (
    <div
      ref={cardRootRef}
      className="relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white text-slate-900 p-5 shadow-sm cursor-pointer hover:border-[rgb(30,47,130)] hover:shadow-md transition"
      style={{ position: "relative", zIndex: isHovered ? 100 : 1 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs font-semibold truncate max-w-[220px] text-[rgb(30,47,130)]">
            {entityName || "Unknown"}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {getDetailUrl && (
            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-[rgb(30,47,130)] transition-colors"
              title="Open in new tab"
              aria-label="Open in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
          {viewMode === 'hourly' && hourlyStats ? (
            <>
              <div className="text-[9px] text-slate-600 mb-1">Avg Margin %</div>
              <div
                className={`px-2 py-1 rounded-full text-[10px] font-semibold ${
                  parseFloat(hourlyStats.todayMarginPct) >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                }`}
              >
                {parseFloat(hourlyStats.todayMarginPct) >= 0 ? "+" : ""}
                {hourlyStats.todayMarginPct}%
              </div>
              <div className="text-[9px] text-slate-500 mt-1">
                Yesterday: {parseFloat(hourlyStats.yesterdayMarginPct) >= 0 ? "+" : ""}{hourlyStats.yesterdayMarginPct}%
              </div>
            </>
          ) : (
            <div
              className={`px-2 py-1 rounded-full text-[10px] font-semibold ${
                isPositive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
              }`}
            >
              {isPositive ? "+" : ""}
              {marginPct}%
            </div>
          )}
        </div>
      </div>

      {/* Revenue / Publisher Costs / Margin on same line */}
      <div className="mt-2 flex items-start justify-between gap-4">
        {/* Revenue */}
        <div className="flex-1">
          <div className="flex items-center gap-1 text-[10px]" style={{ color: "rgb(30, 47, 130)" }}>
            <DollarSign className="w-2.5 h-2.5 text-emerald-500" />
            <span>DSP Revenue</span>
          </div>
          {viewMode === 'hourly' && hourlyStats ? (
            <div className="text-[10px]">
              <div className="font-semibold text-emerald-600">
                {stripM(formatCurrency(hourlyStats.todayRevenue))}
              </div>
              <div className="text-emerald-600 opacity-70 mt-0.5 text-[9px]">
                Yesterday: {stripM(formatCurrency(hourlyStats.yesterdayRevenue))}
              </div>
            </div>
          ) : (
            <div className="text-[10px] font-semibold text-emerald-600">
              {stripM(formatCurrency(revenue))}
            </div>
          )}
        </div>

        {/* Publisher Costs */}
        <div className="flex-1 text-center">
          <div className="flex items-center justify-center gap-1 text-[10px]" style={{ color: "rgb(30, 47, 130)" }}>
            <TrendingUp className="w-2.5 h-2.5 text-red-500" />
            <span>Publisher Costs</span>
          </div>
          {viewMode === 'hourly' && hourlyStats ? (
            <div className="text-[10px]">
              <div className="font-semibold text-red-500">
                {stripM(formatCurrency(hourlyStats.todayCosts))}
              </div>
              <div className="text-red-500 opacity-70 mt-0.5 text-[9px]">
                Yesterday: {stripM(formatCurrency(hourlyStats.yesterdayCosts))}
              </div>
            </div>
          ) : (
            <div className="text-[10px] font-semibold text-red-500">
              {stripM(formatCurrency(publisherCost))}
            </div>
          )}
        </div>

        {/* Margin */}
        <div className="flex-1 text-right">
          <div className="flex items-center justify-end gap-1 text-[10px]" style={{ color: "rgb(30, 47, 130)" }}>
            <BarChart3 className="w-2.5 h-2.5" style={{ color: "rgb(79, 70, 229)" }} />
            <span>Margin</span>
          </div>
          {viewMode === 'hourly' && hourlyStats ? (
            <div className="text-[10px]">
              <div className="font-medium" style={{ color: "rgb(79, 70, 229)" }}>
                {stripM(formatCurrency(hourlyStats.todayMargin))}
              </div>
              <div className="opacity-70 mt-0.5 text-[9px]" style={{ color: "rgb(79, 70, 229)" }}>
                Yesterday: {stripM(formatCurrency(hourlyStats.yesterdayMargin))}
              </div>
            </div>
          ) : (
            <div className="text-[10px] font-medium" style={{ color: "rgb(79, 70, 229)" }}>
              {stripM(formatCurrency(margin))}
            </div>
          )}
        </div>
      </div>

      {/* Mini daily/hourly curve: Revenue & Publisher Costs (+ yesterday in hourly) */}
      <div className="mt-4 pt-3 border-top border-slate-200 h-16 w-full relative" style={{ zIndex: 0 }}>
        {loadingSpark || sparkData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[9px] text-slate-400">
            {loadingSpark ? (
              <img src={loadingSpinnerDataUri} alt="Loading" className="w-4 h-4" />
            ) : !hasSparkCacheEntry && !sparkInView ? (
              <span className="text-slate-300" title="Chart loads when the card is visible">
                ⋯
              </span>
            ) : (
              "No data"
            )}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" style={{ position: "relative", zIndex: 0 }}>
            <LineChart data={sparkData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
              <XAxis dataKey="dateLabel" hide />
              <YAxis hide domain={["auto", "auto"]} />
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
              <RechartsTooltip
                formatter={(value, name) => [
                  stripM(formatCurrencyDetailed(value)),
                  name === "revenue"
                    ? (viewMode === "hourly" ? "DSP Revenue" : "Revenue")
                    : name === "yesterdayRevenue"
                    ? "Yesterday DSP Revenue"
                    : name === "costs"
                    ? "Publisher Costs"
                    : name === "yesterdayCosts"
                    ? "Yesterday Publisher Costs"
                    : name,
                ]}
                labelFormatter={(label) => label}
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  fontSize: 9,
                  color: "#0f172a",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  pointerEvents: "none",
                  zIndex: 99999,
                }}
                wrapperStyle={{
                  outline: "none",
                  zIndex: 99999,
                }}
                allowEscapeViewBox={{ x: false, y: true }}
                offset={-30}
              />
              {/* Today DSP revenue */}
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
              />
              {/* Yesterday DSP revenue (hourly mode only) */}
              {viewMode === "hourly" && sparkData.some((d) => d.yesterdayRevenue !== null) && (
                <Line
                  type="monotone"
                  dataKey="yesterdayRevenue"
                  stroke="#22c55e"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  strokeOpacity={0.6}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              )}
              {/* Today publisher costs */}
              <Line
                type="monotone"
                dataKey="costs"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
              />
              {/* Yesterday publisher costs (hourly mode only) */}
              {viewMode === "hourly" && sparkData.some((d) => d.yesterdayCosts !== null) && (
                <Line
                  type="monotone"
                  dataKey="yesterdayCosts"
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  strokeOpacity={0.6}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Optional extra charts for Impressions and CTR (SalesDashboard) */}
      {showImpressionsAndCtr && !loadingSpark && sparkData.length > 0 && (
        <>
          {/* Impressions chart */}
          <div className="mt-3 w-full">
            <div className="text-[9px] font-semibold text-slate-500 mb-1">
              Impressions / Visible Impressions
            </div>
            <div className="h-12 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData} margin={{ top: 4, right: impressionsChartScale.needDualAxis ? 2 : 4, left: -8, bottom: 0 }}>
                <XAxis dataKey="dateLabel" hide />
                <YAxis yAxisId="imp" hide domain={impressionsChartScale.impDomain} />
                {impressionsChartScale.needDualAxis && (
                  <YAxis yAxisId="vis" orientation="right" hide domain={impressionsChartScale.visDomain} />
                )}
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
                <RechartsTooltip
                  formatter={(value, name) => [
                    name === "impressions" ? (value?.toLocaleString?.() ?? value) : (value?.toLocaleString?.() ?? value),
                    name === "impressions"
                      ? "Impressions"
                      : name === "visibleImpressions"
                        ? "Visible Impressions"
                        : name === "yesterdayImpressions"
                          ? "Yesterday Impressions"
                          : name === "yesterdayVisibleImpressions"
                            ? "Yesterday Visible Impressions"
                            : name
                  ]}
                  labelFormatter={(label) => label}
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    fontSize: 9,
                    color: "#0f172a",
                  }}
                />
                <Line
                  yAxisId="imp"
                  type="monotone"
                  dataKey="impressions"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
                {impressionsChartScale.showVisibleLine && (
                  <Line
                    yAxisId={impressionsChartScale.needDualAxis ? "vis" : "imp"}
                    type="monotone"
                    dataKey="visibleImpressions"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                )}
                {/* Show yesterday impressions line in hourly mode when data is available */}
                {viewMode === 'hourly' && sparkData.some(d => d.yesterdayImpressions !== null) && (
                  <Line
                    yAxisId="imp"
                    type="monotone"
                    dataKey="yesterdayImpressions"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    strokeOpacity={0.6}
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                )}
                {impressionsChartScale.showVisibleLine && viewMode === 'hourly' && sparkData.some(d => d.yesterdayVisibleImpressions !== null) && (
                  <Line
                    yAxisId={impressionsChartScale.needDualAxis ? "vis" : "imp"}
                    type="monotone"
                    dataKey="yesterdayVisibleImpressions"
                    stroke="#f97316"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    strokeOpacity={0.6}
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
            </div>
          </div>

          {/* CTR chart (percentage) */}
          <div className="mt-3 w-full">
            <div className="text-[9px] font-semibold text-slate-500 mb-1">
              CTR
            </div>
            <div className="h-12 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                <XAxis dataKey="dateLabel" hide />
                <YAxis hide domain={["auto", "auto"]} />
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
                <RechartsTooltip
                  formatter={(value, name) => [
                    `${Number(value || 0).toFixed(2)}%`,
                    name === "ctr" ? "CTR" : name === "yesterdayCtr" ? "Yesterday CTR" : name
                  ]}
                  labelFormatter={(label) => label}
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    fontSize: 9,
                    color: "#0f172a",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="ctr"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
                {/* Show yesterday CTR line in hourly mode when data is available */}
                {viewMode === 'hourly' && sparkData.some(d => d.yesterdayCtr !== null) && (
                  <Line
                    type="monotone"
                    dataKey="yesterdayCtr"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    strokeOpacity={0.6}
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* Optional viewability rate chart (Sales/Deal/Realm dashboards) */}
      {showImpressionsAndCtr && !loadingSpark && sparkData.length > 0 && (
        <div className="mt-3 w-full">
          <div className="text-[9px] font-semibold text-slate-500 mb-1">
            Viewability Rate
          </div>
          <div className="h-12 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                <XAxis dataKey="dateLabel" hide />
                <YAxis hide domain={["auto", "auto"]} />
                <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" vertical={false} />
                <RechartsTooltip
                  formatter={(value, name) => [
                    typeof value === "number" ? `${value.toFixed(2)}%` : value,
                    name === "viewability" ? "Viewability Rate" : name,
                  ]}
                  labelFormatter={(label) => label}
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    fontSize: 9,
                    color: "#0f172a",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="viewability"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

