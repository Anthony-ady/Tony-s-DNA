/**
 * Deal Dashboard Page Component
 * 
 * Uses the DashboardTemplate to display deal analytics
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DashboardTemplate from "./DashboardTemplate";
import { authService } from "@/services/authService";
import { cachedFetch } from '@/utils/apiCache';
import { EntityPerformanceCard } from "@/components/dashboard/EntityPerformanceCard";
import { API_ENDPOINTS } from "@/config/api";
import { formatCurrency, formatCurrencyDetailed } from "@/utils/formatters";
import { buildAdserverHourlySummaryPayload, dateRangeToDruidInterval, processEntityHourlySparkFromRaw } from "@/utils/hourlyProjections";

export default function DealDashboard() {
  const navigate = useNavigate();

  // React to realm selection changes from the global header
  const [selectedRealmId, setSelectedRealmId] = useState(() => {
    return localStorage.getItem('selected-realm-id') || '';
  });
  const [renderKey, setRenderKey] = useState(0);
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

  useEffect(() => {
    const handleRealmChange = () => {
      const newRealmId = localStorage.getItem('selected-realm-id') || '';
      setSelectedRealmId(newRealmId);
      setRenderKey((prev) => prev + 1);
    };

    const handleStorage = (event) => {
      if (event.key === 'selected-realm-id') {
        handleRealmChange();
      }
    };

    window.addEventListener('realmChanged', handleRealmChange);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('realmChanged', handleRealmChange);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const getSelectedRealmId = () => selectedRealmId;


  // Get time range from localStorage and calculate dates
  const getTimeRange = () => {
    return localStorage.getItem('selected-time-range') || '7d';
  };

  const calculateDatesFromTimeRange = (range) => {
    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth();
    const todayDate = now.getDate();
    
    let startDateValue, endDateValue;

    switch (range) {
      case '5d': {
        const date5d = new Date(todayYear, todayMonth, todayDate - 5);
        startDateValue = new Date(Date.UTC(date5d.getFullYear(), date5d.getMonth(), date5d.getDate(), 0, 0, 0, 0));
        endDateValue = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
        break;
      }
      case '7d': {
        const date7d = new Date(todayYear, todayMonth, todayDate - 7);
        startDateValue = new Date(Date.UTC(date7d.getFullYear(), date7d.getMonth(), date7d.getDate(), 0, 0, 0, 0));
        endDateValue = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
        break;
      }
      case '14d': {
        const date14d = new Date(todayYear, todayMonth, todayDate - 14);
        startDateValue = new Date(Date.UTC(date14d.getFullYear(), date14d.getMonth(), date14d.getDate(), 0, 0, 0, 0));
        endDateValue = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
        break;
      }
      case '20d': {
        const date20d = new Date(todayYear, todayMonth, todayDate - 20);
        startDateValue = new Date(Date.UTC(date20d.getFullYear(), date20d.getMonth(), date20d.getDate(), 0, 0, 0, 0));
        endDateValue = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
        break;
      }
      case '30d': {
        const date30d = new Date(todayYear, todayMonth, todayDate - 30);
        startDateValue = new Date(Date.UTC(date30d.getFullYear(), date30d.getMonth(), date30d.getDate(), 0, 0, 0, 0));
        endDateValue = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
        break;
      }
      default: {
        const dateDefault = new Date(todayYear, todayMonth, todayDate - 7);
        startDateValue = new Date(Date.UTC(dateDefault.getFullYear(), dateDefault.getMonth(), dateDefault.getDate(), 0, 0, 0, 0));
        endDateValue = new Date(Date.UTC(todayYear, todayMonth, todayDate, 23, 59, 59, 999));
      }
    }
    
    return {
      start: startDateValue.toISOString().split('T')[0],
      end: endDateValue.toISOString().split('T')[0]
    };
  };

  // Generate payload for top deals
  const topDealsPayload = (startDate, endDate) => {
    // Format dates in UTC (consistent with other dashboards)
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
      const networkOpsBeginDate = new Date(beginDate) >= todayStart ? yesterdayStart : new Date(beginDate);

      // Liste des deals du dashboard : filtrer par realm sélectionné (header).
      // Les séries / détail d’un deal précis utilisent fetchDailyDataForRealm (DealId seul, sans realm).
      const listFilters = {};
      const selectedRealmIdForList = getSelectedRealmId();
      if (selectedRealmIdForList) {
        listFilters.realmId = {
          "Value": [selectedRealmIdForList],
          "Operator": "in"
        };
      }

      const payload = {
        "Datasource": "network_operations",
        "Metrics": [
          "network_operations_price_publisher",
          "network_operations_price_advertiser",
          "DealName"
        ],
        "Dimensions": ["DealId"],
        "TimeZone": "Etc/GMT",
        "Granularity": "all",
        "Intervals": [{ "Begin": networkOpsBeginDate.toISOString(), "End": networkOpsEndDate.toISOString() }],
        "Filters": Object.keys(listFilters).length ? listFilters : undefined,
        "OrderBy": "network_operations_price_publisher",
        "OrderOp": "DESC",
        "Size": 1500,
        "AddTotalRow": true
      };

      return payload;
    }

    const payload = {
      "Intervals": [{"Begin": beginDate, "End": endDateValue}],
      "Operator": "in",
      "OrderBy": "PricePublisher",
      "OrderOp": "DESC",
      "Dimensions": ["DealId"],
      "Size": 1500,
      "Metrics": ["PricePublisher", "PriceAdvertiser_PublisherSide", "DealName"],
      "Datasource": "adserver_stats",
      "AddTotalRow": true,
      "TimeZone": "Etc/GMT",
      "Granularity": "all"
    };

    const selectedRealmId = getSelectedRealmId();
    if (selectedRealmId) {
      payload.Filters = {
        "RealmPublisher": {
          "Value": [selectedRealmId],
          "Operator": "in"
        }
      };
    }

    return payload;
  };

  const buildHourlySummaryPayload = useCallback((startDate, endDate) => {
    const { begin, end } = dateRangeToDruidInterval(startDate, endDate);
    const filters = {};
    if (selectedRealmId) {
      filters.RealmPublisher = { Value: [selectedRealmId], Operator: 'in' };
    }
    return buildAdserverHourlySummaryPayload(begin, end, filters);
  }, [selectedRealmId]);

  const normalizeDealAmounts = (item) => {
    if (
      item.network_operations_price_publisher !== undefined ||
      item.network_operations_price_advertiser !== undefined
    ) {
      return {
        ...item,
        PriceAdvertiser_PublisherSide: (item.network_operations_price_advertiser || 0) * 1_000_000,
        PricePublisher: (item.network_operations_price_publisher || 0) * 1_000_000
      };
    }
    return item;
  };

  // Montants d'un deal sur l'ensemble des realms. La requête de liste est filtrée
  // par realm pour ne retenir que les deals qui y tournent, mais les montants
  // affichés doivent couvrir le deal en entier, pas sa seule part dans ce realm.
  const fetchDealTotalsAcrossRealms = async (dealIds, startDate, endDate) => {
    const token = authService.getToken();
    if (!token || !dealIds.length || !startDate || !endDate) return [];

    const payload = {
      ...topDealsPayload(startDate, endDate),
      Filters: { DealId: { "Value": dealIds, "Operator": "in" } }
    };

    try {
      const response = await cachedFetch(API_ENDPOINTS.DRUID_SEARCH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ayl-auth-token': token
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      return (data.Data || []).filter((item) => item.DealId || item.dealId);
    } catch (err) {
      console.error('Error fetching deal totals across realms:', err);
      return [];
    }
  };

  // Process top deals response
  const processTopDealsResponse = async (data, { startDate, endDate } = {}) => {
    const entities = (data.Data || []).filter(item => item.DealId || item.dealId);

    // Le realm sélectionné ne sert qu'à choisir les deals affichés : on remplace
    // ensuite leurs montants par les totaux tous realms confondus.
    let source = entities;
    if (getSelectedRealmId() && entities.length) {
      const totals = await fetchDealTotalsAcrossRealms(
        entities.map(getDealId).filter(Boolean), startDate, endDate
      );
      if (totals.length) {
        const totalsById = new Map(totals.map((item) => [getDealId(item), item]));
        source = entities.map((item) => {
          const total = totalsById.get(getDealId(item));
          return total ? { ...item, ...total } : item;
        });
      }
    }

    // L'ordre renvoyé par l'API porte sur les montants du realm ; on retrie sur
    // les totaux effectivement affichés.
    const normalizedEntities = source
      .map(normalizeDealAmounts)
      .sort((a, b) => (b.PricePublisher || 0) - (a.PricePublisher || 0));

    const totalEntityRevenue = normalizedEntities.reduce((sum, item) => sum + (item.PriceAdvertiser_PublisherSide || 0), 0);
    const totalPublisherCosts = normalizedEntities.reduce((sum, item) => sum + (item.PricePublisher || 0), 0);
    const totalMargin = totalEntityRevenue - totalPublisherCosts;
    const avgMarginPercentage = totalEntityRevenue > 0 ? 
      ((totalMargin / totalEntityRevenue) * 100).toFixed(2) : 0;

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

  // Get entity ID
  const getDealId = (item) => item.DealId || item.dealId;

  // Get entity name with fallback
  const getDealName = (item) => item.Name_Deal || item.DealName || item.DealId || 'Unknown Deal';

  // Fetch daily/hourly data for a deal
  const fetchDailyDataForDeal = async (dealId, dealName, startDate, endDate) => {
    const token = authService.getToken();
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
        const networkOpsBeginDate = new Date(beginDate) >= todayStart ? yesterdayStart : new Date(beginDate);

        const dailyFilters = {
          DealId: {
            "Value": [dealId],
            "Operator": "in"
          }
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
          "Intervals": [{"Begin": beginDate, "End": endDateFormatted}],
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
              CLICK: item.network_operations_click ?? item.network_operations_clicks ?? item.CLICK ?? 0,
              IMPRESSION: item.network_operations_impressions ?? item.IMPRESSION ?? 0,
              VISIBLE_IMPRESSION: item.network_operations_visible_impressions ?? item.VISIBLE_IMPRESSION ?? 0,
              VIEWABILITY_RATE: item.network_operations_viewability_rate ?? item.VIEWABILITY_RATE ?? 0
            };
          }
          return item;
        });

          return normalized.map((item, index, array) => {
          // Clean timestamp
          let cleanTimestamp = item.timestamp;
          cleanTimestamp = cleanTimestamp.replace(/\.\d{6}/, '');
          if (!cleanTimestamp.endsWith('Z') && !cleanTimestamp.includes('+')) {
            cleanTimestamp += 'Z';
          }
          
          const date = new Date(cleanTimestamp);
          const previousItem = index > 0 ? array[index - 1] : null;

          const revenueTrend = previousItem ?
            (item.PriceAdvertiser_PublisherSide > previousItem.PriceAdvertiser_PublisherSide ? 'up' :
             item.PriceAdvertiser_PublisherSide < previousItem.PriceAdvertiser_PublisherSide ? 'down' : 'same') : 'same';

          const revenueChangePercent = previousItem && previousItem.PriceAdvertiser_PublisherSide > 0 ?
            (((item.PriceAdvertiser_PublisherSide - previousItem.PriceAdvertiser_PublisherSide) / previousItem.PriceAdvertiser_PublisherSide) * 100).toFixed(1) : 0;

          const publisherCostsTrend = previousItem ?
            (item.PricePublisher > previousItem.PricePublisher ? 'up' :
             item.PricePublisher < previousItem.PricePublisher ? 'down' : 'same') : 'same';

          const publisherCostsChangePercent = previousItem && previousItem.PricePublisher > 0 ?
            (((item.PricePublisher - previousItem.PricePublisher) / previousItem.PricePublisher) * 100).toFixed(1) : 0;

          const marginTrend = previousItem ?
            ((item.PriceAdvertiser_PublisherSide - item.PricePublisher) > (previousItem.PriceAdvertiser_PublisherSide - previousItem.PricePublisher) ? 'up' :
             (item.PriceAdvertiser_PublisherSide - item.PricePublisher) < (previousItem.PriceAdvertiser_PublisherSide - previousItem.PricePublisher) ? 'down' : 'same') : 'same';

          const marginChangePercent = previousItem && previousItem.PriceAdvertiser_PublisherSide - previousItem.PricePublisher > 0 ?
            ((((item.PriceAdvertiser_PublisherSide - item.PricePublisher) - (previousItem.PriceAdvertiser_PublisherSide - previousItem.PricePublisher)) / (previousItem.PriceAdvertiser_PublisherSide - previousItem.PricePublisher)) * 100).toFixed(1) : 0;

          const clicks = item.CLICK ?? item.Click ?? 0;
          const impressions = item.IMPRESSION ?? item.Impression ?? 0;
          const visibleImpressions = item.VISIBLE_IMPRESSION ?? item.VisibleImpression ?? item.visibleImpressions ?? 0;
          const viewabilityRate = typeof item.VIEWABILITY_RATE === 'number' ? item.VIEWABILITY_RATE * 100 : 0;
          const ctr = impressions ? (clicks / impressions) * 100 : 0;

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
            ctr
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

  // Adapter for DashboardTemplate to render each deal as a performance card
  const renderDealCard = (item, { globalIndex, entityId, entityName, startDate, endDate }) => (
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


  return (
    <div className="relative">
      <div className="pr-10 lg:pr-10">
        <DashboardTemplate
          key={`${selectedRealmId}-${renderKey}`}
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
          getAuthToken={authService.getToken}
          filterRealmId={selectedRealmId || null}
          hideSummaryMetrics
          cardLayout
          pageSize={12}
          renderEntityCard={renderDealCard}
        />
      </div>
    </div>
  );
}

