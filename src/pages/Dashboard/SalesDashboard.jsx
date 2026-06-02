/**
 * Sales Dashboard Page Component
 * 
 * Displays deals for the selected Sales user
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { cachedFetch } from "@/utils/apiCache";
import DashboardTemplate from "./DashboardTemplate";
import { ArrowDownRight, ArrowUpRight, Loader2 } from "lucide-react";
import { formatError } from "@/utils/errorFormatter";
import { EntityPerformanceCard } from "@/components/dashboard/EntityPerformanceCard";
import { API_ENDPOINTS } from "@/config/api";
import { buildAdserverHourlySummaryPayload, dateRangeToDruidInterval, processEntityHourlySparkFromRaw } from "@/utils/hourlyProjections";

export default function SalesDashboard() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  // React to realm and user selection changes from header
  const [selectedRealmId, setSelectedRealmId] = useState(() => {
    return localStorage.getItem('selected-realm-id') || '';
  });
  const [selectedUserId, setSelectedUserId] = useState(() => {
    const stored = localStorage.getItem('selected-user-id') || '';
    // Treat legacy 'all' value as no specific user filter (All Users)
    return stored === 'all' ? '' : stored;
  });
  const [dealIds, setDealIds] = useState([]);
  const [loadingDeals, setLoadingDeals] = useState(false);
  const [error, setError] = useState(null);
  const [cardDailyCache, setCardDailyCache] = useState({});
  const dailyRequestCacheRef = useRef(new Map());
  const dailyInflightRef = useRef(new Map());

  // Local view mode state (synced with Layout's dashboard-view-mode)
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window === 'undefined') return 'daily';
    return localStorage.getItem('dashboard-view-mode') || 'daily';
  });

  // Sync viewMode with storage events
  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem('dashboard-view-mode') || 'daily';
      setViewMode(stored);
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Poll localStorage periodically to catch same-tab changes
  useEffect(() => {
    const id = setInterval(() => {
      const stored = localStorage.getItem('dashboard-view-mode') || 'daily';
      if (stored !== viewMode) {
        setViewMode(stored);
      }
    }, 200);
    return () => clearInterval(id);
  }, [viewMode]);
  
  // Listen for realm changes from header
  useEffect(() => {
    const handleRealmChange = () => {
      const newRealmId = localStorage.getItem('selected-realm-id') || '';
      setSelectedRealmId(newRealmId);
    };
    
    const handleUserChange = () => {
      const raw = localStorage.getItem('selected-user-id') || '';
      // Normalize legacy 'all' to empty string (All Users => no filter)
      const newUserId = raw === 'all' ? '' : raw;
      setSelectedUserId(newUserId);
    };
    
    window.addEventListener('realmChanged', handleRealmChange);
    window.addEventListener('userChanged', handleUserChange);
    window.addEventListener('storage', (e) => {
      if (e.key === 'selected-realm-id') {
        handleRealmChange();
      }
      if (e.key === 'selected-user-id') {
        handleUserChange();
      }
    });
    
    return () => {
      window.removeEventListener('realmChanged', handleRealmChange);
      window.removeEventListener('userChanged', handleUserChange);
    };
  }, []);

  const getDealIdFromSearch = (deal) => {
    return deal?.Uid || deal?.Id || deal?.DealUid || deal?.Deal_uid || deal?.DealId || '';
  };

  const buildDealIds = (dealsList) => {
    const ids = dealsList
      .map(getDealIdFromSearch)
      .filter(Boolean);
    return Array.from(new Set(ids));
  };

  const topDealsPayload = (startDate, endDate) => {
    const beginDate = new Date(startDate + 'T00:00:00Z').toISOString().replace('Z', '+00:00');
    const endDateValue = new Date(endDate + 'T23:59:59Z').toISOString().replace('Z', '+00:00');

    if (viewMode === 'daily') {
      const now = new Date();
      const todayYear = now.getUTCFullYear();
      const todayMonth = now.getUTCMonth();
      const todayDate = now.getUTCDate();
      const todayStart = new Date(Date.UTC(todayYear, todayMonth, todayDate, 0, 0, 0, 0));
      const yesterdayEnd = new Date(Date.UTC(todayYear, todayMonth, todayDate - 1, 23, 59, 59, 999));
      const yesterdayStart = new Date(Date.UTC(todayYear, todayMonth, todayDate - 1, 0, 0, 0, 0));

      const networkOpsEndDate = new Date(endDateValue) >= todayStart ? yesterdayEnd : new Date(endDateValue);
      networkOpsEndDate.setMilliseconds(999);
      const networkOpsBeginDate = new Date(beginDate) >= todayStart ? yesterdayStart : new Date(beginDate);

      const filters = {};
      if (selectedRealmId) {
        filters.realmId = {
          "Value": [selectedRealmId],
          "Operator": "in"
        };
      }
      if (dealIds.length > 0) {
        filters.DealId = {
          "Value": dealIds,
          "Operator": "in"
        };
      }

      const payload = {
        "Datasource": "network_operations",
        "Metrics": [
          "network_operations_bid_requests",
          "network_operations_bid_responses",
          "network_operations_impressions",
          "network_operations_click",
          "network_operations_visible_impressions",
          "network_operations_viewability_rate",
          "network_operations_price_publisher",
          "network_operations_ecpm_publisher",
          "network_operations_price_advertiser",
          "DealName"
        ],
        "Dimensions": ["DealId"],
        "TimeZone": "Etc/GMT",
        "Granularity": "all",
        "Intervals": [{ "Begin": networkOpsBeginDate.toISOString(), "End": networkOpsEndDate.toISOString() }],
        "Filters": Object.keys(filters).length ? filters : undefined,
        "OrderBy": "network_operations_price_publisher",
        "OrderOp": "DESC",
        "Size": 500,
        "AddTotalRow": true
      };

      return payload;
    }

    const payload = {
      "Intervals": [{ "Begin": beginDate, "End": endDateValue }],
      "Operator": "in",
      "OrderBy": "PricePublisher",
      "OrderOp": "DESC",
      "Dimensions": ["DealId"],
      "Size": 500,
      "Metrics": ["PricePublisher", "PriceAdvertiser_PublisherSide", "DealName", "CLICK", "IMPRESSION"],
      "Datasource": "adserver_stats",
      "AddTotalRow": true,
      "TimeZone": "Etc/GMT",
      "Granularity": "all"
    };

    if (dealIds.length > 0) {
      payload.Filters = {
        DealId: {
          "Value": dealIds,
          "Operator": "in"
        }
      };
    }

    return payload;
  };

  const buildHourlySummaryPayload = useCallback((startDate, endDate) => {
    const { begin, end } = dateRangeToDruidInterval(startDate, endDate);
    const filters = {};
    if (dealIds.length > 0) {
      filters.DealId = { Value: dealIds, Operator: 'in' };
    }
    return buildAdserverHourlySummaryPayload(begin, end, filters);
  }, [dealIds]);

  const processTopDealsResponse = (data) => {
    const entities = (data.Data || []).filter(item => item.DealId || item.dealId);
    const normalizedEntities = entities.map((item) => {
      if (
        item.network_operations_price_publisher !== undefined ||
        item.network_operations_price_advertiser !== undefined
      ) {
        return {
          ...item,
          PriceAdvertiser_PublisherSide: (item.network_operations_price_advertiser || 0) * 1_000_000,
          PricePublisher: (item.network_operations_price_publisher || 0) * 1_000_000,
          IMPRESSION: item.network_operations_impressions ?? item.IMPRESSION ?? 0,
          CLICK: item.network_operations_click ?? item.network_operations_clicks ?? item.CLICK ?? 0
        };
      }
      return item;
    });

    const totalEntityRevenue = normalizedEntities.reduce((sum, item) => sum + (item.PriceAdvertiser_PublisherSide || 0), 0);
    const totalPublisherCosts = normalizedEntities.reduce((sum, item) => sum + (item.PricePublisher || 0), 0);
    const totalMargin = totalEntityRevenue - totalPublisherCosts;
    const avgMarginPercentage = totalEntityRevenue > 0
      ? ((totalMargin / totalEntityRevenue) * 100).toFixed(2)
      : 0;

    return {
      entities: normalizedEntities,
      summary: {
        entityRevenue: totalEntityRevenue,
        publisherCosts: totalPublisherCosts,
        margin: totalMargin,
        avgMarginPercentage
      }
    };
  };

  const getDealId = (item) => item.DealId || item.dealId;

  const getDealName = (item) => item.Name_Deal || item.DealName || item.DealId || 'Unknown Deal';

  // Format currency in millions, without "M" suffix (same style as other dashboards)
  const formatCurrency = (value) => {
    const millions = (value || 0) / 1_000_000;
    return `$${millions.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
  };

  const formatCurrencyDetailed = (value) => {
    const millions = (value || 0) / 1_000_000;
    return `$${millions.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
  };

  const fetchDailyDataForDeal = async (dealId, _dealName, startDate, endDate) => {
    const token = getToken();
    if (!token) return [];

    try {
      // Determine dashboard view mode (daily or hourly) from localStorage
      let viewMode = 'daily';
      if (typeof window !== 'undefined') {
        viewMode = localStorage.getItem('dashboard-view-mode') || 'daily';
      }

      // Format dates in UTC
      let beginDate;
      let endDateFormatted;

      if (viewMode === 'hourly') {
        // Hourly mode: Yesterday 00:00:00 UTC -> Today 23:59:59 UTC
        const now = new Date();
        const todayYear = now.getUTCFullYear();
        const todayMonth = now.getUTCMonth();
        const todayDate = now.getUTCDate();

        const yesterday = new Date(Date.UTC(todayYear, todayMonth, todayDate - 1, 0, 0, 0, 0));
        const todayEnd = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));

        beginDate = yesterday.toISOString().replace('Z', '+00:00');
        endDateFormatted = todayEnd.toISOString().replace('Z', '+00:00');
      } else {
        // Daily mode: use selected start/end dates from header
        beginDate = new Date(startDate + 'T00:00:00Z').toISOString().replace('Z', '+00:00');
        endDateFormatted = new Date(endDate + 'T23:59:59Z').toISOString().replace('Z', '+00:00');
      }

      let payload;
      if (viewMode === 'daily') {
        const now = new Date();
        const todayYear = now.getUTCFullYear();
        const todayMonth = now.getUTCMonth();
        const todayDate = now.getUTCDate();
        const todayStart = new Date(Date.UTC(todayYear, todayMonth, todayDate, 0, 0, 0, 0));
        const yesterdayEnd = new Date(Date.UTC(todayYear, todayMonth, todayDate - 1, 23, 59, 59, 999));
        const yesterdayStart = new Date(Date.UTC(todayYear, todayMonth, todayDate - 1, 0, 0, 0, 0));

        const networkOpsEndDate = new Date(endDateFormatted) >= todayStart ? yesterdayEnd : new Date(endDateFormatted);
        networkOpsEndDate.setMilliseconds(999);
        const networkOpsBeginDate = new Date(beginDate) >= todayStart ? yesterdayStart : new Date(beginDate);

        const dailyFilters = {};
        if (selectedRealmId) {
          dailyFilters.realmId = {
            "Value": [selectedRealmId],
            "Operator": "in"
          };
        }
        dailyFilters.DealId = {
          "Value": [dealId],
          "Operator": "in"
        };

        payload = {
          "Datasource": "network_operations",
          "Metrics": [
            "network_operations_bid_requests",
            "network_operations_bid_responses",
            "network_operations_impressions",
            "network_operations_click",
            "network_operations_visible_impressions",
            "network_operations_viewability_rate",
            "network_operations_price_publisher",
            "network_operations_ecpm_publisher",
            "network_operations_price_advertiser"
          ],
          "Dimensions": [],
          "TimeZone": "Etc/GMT",
          "Granularity": {
            "type": "period",
            "period": "P1D"
          },
          "Intervals": [{ "Begin": networkOpsBeginDate.toISOString(), "End": networkOpsEndDate.toISOString() }],
          "Filters": dailyFilters
        };
      } else {
        payload = {
          "Intervals": [{ "Begin": beginDate, "End": endDateFormatted }],
          "Filters": {
            "DealId": {
              "Value": [dealId],
              "Operator": "in"
            }
          },
          "Metrics": ["PricePublisher", "PriceAdvertiser_PublisherSide", "CLICK", "IMPRESSION"],
          "Granularity": {
            "type": "period",
            "period": "PT1H"
          },
          "Datasource": "adserver_stats",
          "TimeZone": "Etc/GMT"
        };
      }

      const requestKey = `${viewMode}:${JSON.stringify(payload)}`;
      const cached = dailyRequestCacheRef.current.get(requestKey);
      if (cached) {
        return cached;
      }
      const inflight = dailyInflightRef.current.get(requestKey);
      if (inflight) {
        return inflight;
      }

      const loadPromise = (async () => {
        const response = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-ayl-auth-token': token
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const rawData = data.Data || data;
        
        // Process time-series data
        if (viewMode === 'hourly') {
        return processEntityHourlySparkFromRaw(rawData);
      } else {
          // Daily mode: process with trends compared to previous day
          const normalized = rawData.map((item) => {
            if (
              item.network_operations_price_publisher !== undefined ||
              item.network_operations_price_advertiser !== undefined
            ) {
              return {
                ...item,
                PriceAdvertiser_PublisherSide: (item.network_operations_price_advertiser || 0) * 1_000_000,
                PricePublisher: (item.network_operations_price_publisher || 0) * 1_000_000,
                IMPRESSION: item.network_operations_impressions ?? item.IMPRESSION ?? 0,
                VISIBLE_IMPRESSION: item.network_operations_visible_impressions ?? item.VISIBLE_IMPRESSION ?? 0,
                VIEWABILITY_RATE: item.network_operations_viewability_rate ?? item.VIEWABILITY_RATE ?? 0,
                CLICK: item.network_operations_click ?? item.network_operations_clicks ?? item.CLICK ?? 0
              };
            }
            return item;
          });

          return normalized.map((item, index, array) => {
          let cleanTimestamp = item.timestamp;
          cleanTimestamp = cleanTimestamp.replace(/\.\d{6}/, '');
          if (!cleanTimestamp.endsWith('Z') && !cleanTimestamp.includes('+')) {
            cleanTimestamp += 'Z';
          }

          const date = new Date(cleanTimestamp);
          const previousItem = index > 0 ? array[index - 1] : null;

          const revenueTrend = previousItem
            ? (item.PriceAdvertiser_PublisherSide > previousItem.PriceAdvertiser_PublisherSide ? 'up' :
              item.PriceAdvertiser_PublisherSide < previousItem.PriceAdvertiser_PublisherSide ? 'down' : 'same')
            : 'same';

          const revenueChangePercent = previousItem && previousItem.PriceAdvertiser_PublisherSide > 0
            ? (((item.PriceAdvertiser_PublisherSide - previousItem.PriceAdvertiser_PublisherSide) / previousItem.PriceAdvertiser_PublisherSide) * 100).toFixed(1)
            : 0;

          const publisherCostsTrend = previousItem
            ? (item.PricePublisher > previousItem.PricePublisher ? 'up' :
              item.PricePublisher < previousItem.PricePublisher ? 'down' : 'same')
            : 'same';

          const publisherCostsChangePercent = previousItem && previousItem.PricePublisher > 0
            ? (((item.PricePublisher - previousItem.PricePublisher) / previousItem.PricePublisher) * 100).toFixed(1)
            : 0;

          const marginTrend = previousItem
            ? ((item.PriceAdvertiser_PublisherSide - item.PricePublisher) > (previousItem.PriceAdvertiser_PublisherSide - previousItem.PricePublisher) ? 'up' :
              (item.PriceAdvertiser_PublisherSide - item.PricePublisher) < (previousItem.PriceAdvertiser_PublisherSide - previousItem.PricePublisher) ? 'down' : 'same')
            : 'same';

          const marginChangePercent = previousItem && previousItem.PriceAdvertiser_PublisherSide - previousItem.PricePublisher > 0
            ? ((((item.PriceAdvertiser_PublisherSide - item.PricePublisher) - (previousItem.PriceAdvertiser_PublisherSide - previousItem.PricePublisher)) / (previousItem.PriceAdvertiser_PublisherSide - previousItem.PricePublisher)) * 100).toFixed(1)
            : 0;

          const clicks = item.CLICK ?? item.Click ?? 0;
          const impressions = item.IMPRESSION ?? item.Impression ?? 0;
          const visibleImpressions = item.VISIBLE_IMPRESSION ?? item.VisibleImpression ?? item.visibleImpressions ?? 0;
          const viewabilityRate = item.VIEWABILITY_RATE ?? item.viewabilityRate ?? 0;
          const ctr = impressions ? (clicks / impressions) * 100 : 0;

          const previousClicks = previousItem ? (previousItem.CLICK ?? previousItem.Click ?? 0) : 0;
          const previousImpressions = previousItem ? (previousItem.IMPRESSION ?? previousItem.Impression ?? 0) : 0;
          const previousCtr = previousImpressions ? (previousClicks / previousImpressions) * 100 : 0;

          const clickTrend = previousItem
            ? (clicks > previousClicks ? 'up' : clicks < previousClicks ? 'down' : 'same')
            : 'same';
          const clickChangePercent = previousClicks > 0
            ? (((clicks - previousClicks) / previousClicks) * 100).toFixed(1)
            : 0;

          const impressionTrend = previousItem
            ? (impressions > previousImpressions ? 'up' : impressions < previousImpressions ? 'down' : 'same')
            : 'same';
          const impressionChangePercent = previousImpressions > 0
            ? (((impressions - previousImpressions) / previousImpressions) * 100).toFixed(1)
            : 0;

          const ctrTrend = previousItem
            ? (ctr > previousCtr ? 'up' : ctr < previousCtr ? 'down' : 'same')
            : 'same';
          const ctrChangePercent = previousCtr > 0
            ? (((ctr - previousCtr) / previousCtr) * 100).toFixed(1)
            : 0;

            return {
            day: date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            entityRevenue: item.PriceAdvertiser_PublisherSide,
            publisherCost: item.PricePublisher,
            margin: item.PriceAdvertiser_PublisherSide - item.PricePublisher,
            revenueTrend,
            revenueChangePercent,
            publisherCostsTrend,
            publisherCostsChangePercent,
            marginTrend,
            marginChangePercent,
            click: clicks,
            impression: impressions,
            visibleImpressions,
            viewabilityRate,
            ctr,
            clickTrend,
            clickChangePercent,
            impressionTrend,
            impressionChangePercent,
            ctrTrend,
            ctrChangePercent
            };
          });
        }
      })();

      dailyInflightRef.current.set(requestKey, loadPromise);
      try {
        const result = await loadPromise;
        dailyRequestCacheRef.current.set(requestKey, result);
        return result;
      } finally {
        dailyInflightRef.current.delete(requestKey);
      }
    } catch (err) {
      console.error('Error fetching daily data for Deal:', err);
      return [];
    }
  };

  // Adapter to render each deal as a performance card (with Impressions & CTR charts)
  const renderSalesDealCard = (item, { globalIndex, entityId, entityName, startDate, endDate }) => (
    <EntityPerformanceCard
      entityId={entityId}
      entityName={entityName}
      startDate={startDate}
      endDate={endDate}
      revenue={item.PriceAdvertiser_PublisherSide || 0}
      publisherCost={item.PricePublisher || 0}
      margin={(item.PriceAdvertiser_PublisherSide || 0) - (item.PricePublisher || 0)}
      marginPct={
        item.PriceAdvertiser_PublisherSide
          ? (
              (((item.PriceAdvertiser_PublisherSide || 0) - (item.PricePublisher || 0)) /
                item.PriceAdvertiser_PublisherSide) *
              100
            ).toFixed(2)
          : "0.00"
      }
      fetchDailyData={fetchDailyDataForDeal}
      viewMode={viewMode}
      onClick={(id, name) => {
        const encodedName = encodeURIComponent(name);
        navigate(`/DealAnalytics?id=${id}&name=${encodedName}`);
      }}
      getDetailUrl={(id, name) => `/DealAnalytics?id=${id}&name=${encodeURIComponent(name)}`}
      cache={cardDailyCache}
      setCache={setCardDailyCache}
      formatCurrency={formatCurrency}
      formatCurrencyDetailed={formatCurrencyDetailed}
      showImpressionsAndCtr
    />
  );

  const formatCount = (value) => {
    if (value === null || value === undefined) return '-';
    const numericValue = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(numericValue)) return '-';
    return numericValue.toLocaleString('en-US');
  };

  const formatPercent = (value) => {
    if (value === null || value === undefined) return '-';
    const numericValue = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(numericValue)) return '-';
    return `${numericValue.toFixed(2)}%`;
  };

  const getClicks = (item) => item?.CLICK ?? item?.Click ?? 0;
  const getImpressions = (item) => item?.IMPRESSION ?? item?.Impression ?? 0;

  const getCtr = (item) => {
    const clicks = getClicks(item);
    const impressions = getImpressions(item);
    if (!impressions) return 0;
    return (clicks / impressions) * 100;
  };

  const renderTrend = (trend, percent) => {
    if (trend === 'up') {
      return (
        <span className="inline-flex items-center gap-1 text-green-600">
          <ArrowUpRight className="w-3 h-3" />
          <span className="text-xs">{`+${percent}%`}</span>
        </span>
      );
    }
    if (trend === 'down') {
      return (
        <span className="inline-flex items-center gap-1 text-red-600">
          <ArrowDownRight className="w-3 h-3" />
          <span className="text-xs">{`${percent}%`}</span>
        </span>
      );
    }
    return <span className="text-xs text-gray-400">—</span>;
  };

  // Fetch deals when user or realm changes
  // - No realm (or "all realms"): load all deals; with realm: load deals for that realm only
  // - With user selected: load that user's deals (optionally filtered by realm)
  useEffect(() => {
    const fetchDeals = async () => {
      const token = getToken();
      if (!token) {
        setError('Authentication required');
        return;
      }

      setLoadingDeals(true);
      setError(null);

      try {
        const filters = [];

        // Normalize user filter: empty string or legacy 'all' means "All Users" (no user filter)
        const effectiveUserId = selectedUserId && selectedUserId !== 'all' ? selectedUserId : '';

        if (effectiveUserId) {
          filters.push({ Field: "SaleUid", Operator: "match", Value: effectiveUserId });
        }
        if (selectedRealmId) {
          filters.push({ Field: "Realm_uid", Operator: "match", Value: selectedRealmId });
        }

        const payload = {
          Filters: filters,
          From: 0,
          Order: [{ Field: "UpdatedAt", Operator: "desc" }],
          Size: 500
        };

        const response = await cachedFetch(API_ENDPOINTS.DEALS_SEARCH, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-ayl-auth-token': token
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          let errorDetails = `HTTP ${response.status}`;
          try {
            const errorData = await response.json();
            if (errorData?.message || errorData?.error) {
              errorDetails = errorData.message || errorData.error || errorDetails;
            }
          } catch (e) {
            // Ignore JSON parse errors
          }
          const errorMessage = formatError(new Error(`Failed to fetch deals: ${errorDetails}`), response);
          throw new Error(errorMessage);
        }

        const data = await response.json();
        const dealsList = Array.isArray(data) ? data : (data.Data || []);
        setDealIds(buildDealIds(dealsList));
      } catch (err) {
        console.error('Error fetching deals:', err);
        console.error('Payload was:', JSON.stringify(payload, null, 2));
        setError(formatError(err, null));
        setDealIds([]);
      } finally {
        setLoadingDeals(false);
      }
    };

    fetchDeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId, selectedRealmId]);

  return (
    <div className="relative">
      <div className="pr-10 lg:pr-10">
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {loadingDeals ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            <span className="ml-2 text-slate-600">Loading deals...</span>
          </div>
        ) : dealIds.length === 0 ? (
          <p className="text-slate-500 text-center py-8">
            {selectedUserId
              ? 'No deals found for the selected User.'
              : selectedRealmId
                ? 'No deals found in the selected Realm.'
                : 'No deals found.'}
          </p>
        ) : (
          <DashboardTemplate
            key={`${selectedUserId}-${selectedRealmId}-${dealIds.join('|')}`}
            title="Deal Analytics"
            searchPlaceholder="Search deals..."
            entityNameSingular="deal"
            entityNamePlural="deals"
            apiEndpoint={API_ENDPOINTS.DRUID_SEARCH}
            topEntitiesPayload={topDealsPayload}
            buildHourlySummaryPayload={buildHourlySummaryPayload}
            processTopEntitiesResponse={processTopDealsResponse}
            getEntityId={getDealId}
            getEntityName={getDealName}
            fetchDailyDataForEntity={fetchDailyDataForDeal}
            analyticsPagePath="/DealAnalytics"
            getAuthToken={getToken}
            filterRealmId={selectedRealmId || null}
            hideSummaryMetrics
            cardLayout
            renderEntityCard={renderSalesDealCard}
          />
        )}
      </div>
    </div>
  );
}
