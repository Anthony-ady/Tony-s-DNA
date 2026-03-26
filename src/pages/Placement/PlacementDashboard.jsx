/**
 * Placement Dashboard Page Component
 * 
 * Uses the DashboardTemplate to display placement analytics
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardTemplate from "../Dashboard/DashboardTemplate";
import { useAuth } from "@/hooks/useAuth";
import { cachedFetch } from "@/utils/apiCache";
import { EntityPerformanceCard } from "@/components/dashboard/EntityPerformanceCard";
import { API_ENDPOINTS } from "@/config/api";
import { formatCurrency, formatCurrencyDetailed } from "@/utils/formatters";

export default function PlacementDashboard() {
  const { getToken } = useAuth();
  const [placementMapping, setPlacementMapping] = useState({});
  
  // State to force re-render when realm/company changes
  const [selectedRealmId, setSelectedRealmId] = useState(() => {
    return localStorage.getItem('selected-realm-id') || '';
  });
  const [selectedCompanyId, setSelectedCompanyId] = useState(() => {
    return localStorage.getItem('selected-company-id') || '';
  });
  const [renderKey, setRenderKey] = useState(0);
  const [cardDailyCache, setCardDailyCache] = useState({});
  const navigate = useNavigate();

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

  
  // Listen for realm/company changes from header
  useEffect(() => {
    const handleRealmChange = () => {
      const newRealmId = localStorage.getItem('selected-realm-id') || '';
      setSelectedRealmId(newRealmId);
      setSelectedCompanyId(''); // Reset company when realm changes
      setRenderKey(prev => prev + 1); // Force re-render
    };
    
    const handleCompanyChange = () => {
      const newCompanyId = localStorage.getItem('selected-company-id') || '';
      setSelectedCompanyId(newCompanyId);
      setRenderKey(prev => prev + 1); // Force re-render
    };
    
    window.addEventListener('realmChanged', handleRealmChange);
    window.addEventListener('companyChanged', handleCompanyChange);
    
    window.addEventListener('storage', (e) => {
      if (e.key === 'selected-realm-id') {
        handleRealmChange();
      } else if (e.key === 'selected-company-id') {
        handleCompanyChange();
      }
    });
    
    return () => {
      window.removeEventListener('realmChanged', handleRealmChange);
      window.removeEventListener('companyChanged', handleCompanyChange);
    };
  }, []);
  
  // Read selected realm and company from localStorage (managed by Layout header)
  const getSelectedRealmId = () => {
    return selectedRealmId;
  };
  
  const getSelectedCompanyId = () => {
    return selectedCompanyId;
  };

  useEffect(() => {
    let cancelled = false;
    let retryTimer;

    const fetchPlacementMapping = async (attempt = 0) => {
      const token = getToken();
      if (!token) {
        if (attempt < 10) {
          retryTimer = setTimeout(() => fetchPlacementMapping(attempt + 1), 200);
        }
        return;
      }

      try {
        const filters = [];
        if (selectedRealmId) {
          filters.push({ Field: "Realm_uid", Operator: "match", Value: selectedRealmId });
        }
        if (selectedCompanyId) {
          filters.push({ Field: "Company_uid", Operator: "match", Value: selectedCompanyId });
        }

        const payload = {
          Filters: filters,
          From: 0,
          Order: [{ Field: "UpdatedAt", Operator: "desc" }],
          Size: 1000
        };

        const response = await cachedFetch(API_ENDPOINTS.PLACEMENTS_SEARCH, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-ayl-auth-token': token
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok || cancelled) return;
        const data = await response.json();
        const mapping = {};
        (data?.Data || []).forEach((placement) => {
          if (placement?.Uid) {
            mapping[placement.Uid] = placement.Name || placement.Name_Placement || placement.PlacementName || placement.Uid;
          }
        });
        if (!cancelled) {
          setPlacementMapping(mapping);
        }
      } catch (err) {
        console.error('Error fetching placement mapping:', err);
      }
    };

    fetchPlacementMapping();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [selectedRealmId, selectedCompanyId]);

  // Generate payload for top placements with optional Realm and Company filter
  const topPlacementPayload = (startDate, endDate) => {
    const storedViewMode = typeof window !== 'undefined'
      ? (localStorage.getItem('dashboard-view-mode') || viewMode)
      : viewMode;
    const useNetworkOpsOnly = storedViewMode === 'daily';

    // Format dates in UTC
    const beginDate = new Date(startDate + 'T00:00:00Z').toISOString().replace('Z', '+00:00');
    const endDateValue = new Date(endDate + 'T23:59:59Z').toISOString().replace('Z', '+00:00');

    if (useNetworkOpsOnly) {
      const now = new Date();
      const todayYear = now.getUTCFullYear();
      const todayMonth = now.getUTCMonth();
      const todayDate = now.getUTCDate();
      const todayStart = new Date(Date.UTC(todayYear, todayMonth, todayDate, 0, 0, 0, 0));
      const yesterdayEnd = new Date(Date.UTC(todayYear, todayMonth, todayDate - 1, 23, 59, 59, 999));
      const yesterdayStart = new Date(Date.UTC(todayYear, todayMonth, todayDate - 1, 0, 0, 0, 0));

      const networkOpsEndDate = new Date(endDateValue) >= todayStart ? yesterdayEnd : new Date(endDateValue);
      const networkOpsBeginDate = new Date(beginDate) >= todayStart ? yesterdayStart : new Date(beginDate);

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
          "PlacementName"
        ],
        "Dimensions": ["PlacementId"],
        "TimeZone": "Etc/GMT",
        "Granularity": "all",
        "Intervals": [{ "Begin": networkOpsBeginDate.toISOString(), "End": networkOpsEndDate.toISOString() }],
        "OrderBy": "network_operations_price_publisher",
        "OrderOp": "DESC",
        "Size": 500,
        "AddTotalRow": true
      };

      // Add filters if a realm or company is selected
      const selectedRealmId = getSelectedRealmId();
      const selectedCompanyId = getSelectedCompanyId();
      const filters = {};

      if (selectedRealmId) {
        filters.realmId = {
          Value: [selectedRealmId],
          Operator: "in"
        };
      }

      if (selectedCompanyId) {
        filters.publisherId = {
          Value: [selectedCompanyId],
          Operator: "in"
        };
      }

      if (Object.keys(filters).length > 0) {
        payload.Filters = filters;
      }

      return payload;
    }

    const payload = {
      "Intervals": [{"Begin": beginDate, "End": endDateValue}],
      "OrderBy": "PricePublisher",
      "OrderOp": "DESC",
      "Dimensions": ["Placement"],
      "Size": 500,
      "Metrics": ["PricePublisher", "PriceAdvertiser_PublisherSide", "PlacementName"],
      "Datasource": "adserver_stats",
      "AddTotalRow": true,
      "TimeZone": "Etc/GMT",
      "Granularity": "all"
    };
    
    // Add filters if a realm or company is selected
    const selectedRealmId = getSelectedRealmId();
    const selectedCompanyId = getSelectedCompanyId();
    const filters = {};
    
    if (selectedRealmId) {
      filters.RealmPublisher = {
        Value: [selectedRealmId],
        Operator: "in"
      };
    }
    
    if (selectedCompanyId) {
      filters.Publisher = {
        Value: [selectedCompanyId],
        Operator: "in"
      };
    }
    
    if (Object.keys(filters).length > 0) {
      payload.Filters = filters;
    }

    return payload;
  };

  // Process top placements response
  const processTopPlacementResponse = (data) => {
    const entities = data.Data || [];
    const normalizedEntities = entities.map((item) => {
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
    });
    
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
  const getPlacementId = (item) => item.Placement || item.PlacementId || item.placement;

  // Get entity name with fallback
  const getPlacementName = (item) => {
    const id = item.Placement || item.PlacementId || item.placement;
    return item.Name_Placement || item.PlacementName || item.Name || (id && placementMapping[id]) || id || 'Unknown Placement';
  };

  // Fetch daily/hourly data for a placement
  const fetchDailyDataForPlacement = async (placementId, placementName, startDate, endDate) => {
    const token = getToken();
    if (!token) return [];

    try {
      // Determine dashboard view mode (daily or hourly) from localStorage
      let currentViewMode = 'daily';
      if (typeof window !== 'undefined') {
        currentViewMode = localStorage.getItem('dashboard-view-mode') || 'daily';
      }

      // Format dates in UTC
      let beginDate;
      let endDateFormatted;

      if (currentViewMode === 'hourly') {
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
      if (currentViewMode === 'daily') {
        const now = new Date();
        const todayYear = now.getUTCFullYear();
        const todayMonth = now.getUTCMonth();
        const todayDate = now.getUTCDate();
        const todayStart = new Date(Date.UTC(todayYear, todayMonth, todayDate, 0, 0, 0, 0));
        const yesterdayEnd = new Date(Date.UTC(todayYear, todayMonth, todayDate - 1, 23, 59, 59, 999));
        const yesterdayStart = new Date(Date.UTC(todayYear, todayMonth, todayDate - 1, 0, 0, 0, 0));

        const networkOpsEndDate = new Date(endDateFormatted) >= todayStart ? yesterdayEnd : new Date(endDateFormatted);
        const networkOpsBeginDate = new Date(beginDate) >= todayStart ? yesterdayStart : new Date(beginDate);

        const selectedRealmId = getSelectedRealmId();
        const dailyFilters = {};
        if (selectedRealmId) {
          dailyFilters.realmId = {
            "Value": [selectedRealmId],
            "Operator": "in"
          };
        }
        dailyFilters.PlacementId = {
          "Value": [placementId],
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
          "Intervals": [{"Begin": beginDate, "End": endDateFormatted}],
          "Filters": {
            "Placement": {
              "Value": [placementId],
              "Operator": "in"
            }
          },
          "Metrics": ["PriceAdvertiser_PublisherSide", "PricePublisher", "CLICK", "IMPRESSION"],
          "Granularity": {
            "type": "period",
            "period": "PT1H"
          },
          "View": "SIMPLE_PUBLISHER",
          "Datasource": "adserver_stats",
          "TimeZone": "Etc/GMT"
        };
      }

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
      const rawData = (data.Data || data);
      
      // Process time-series data
      if (currentViewMode === 'hourly') {
        // Filter and sort data
        const filteredData = rawData.filter(item => 
          item.PricePublisher !== undefined || item.PriceAdvertiser_PublisherSide !== undefined
        );
        const sortedData = filteredData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        // Group data by day (using UTC+0 timezone)
        const dataByDay = {};
        sortedData.forEach((item) => {
          let cleanTimestamp = item.timestamp;
          if (typeof cleanTimestamp === 'string') {
            cleanTimestamp = cleanTimestamp.replace(/\.\d{6}/, '');
            if (!cleanTimestamp.endsWith('Z') && !cleanTimestamp.includes('+')) {
              cleanTimestamp += 'Z';
            }
          }
          
          const date = new Date(cleanTimestamp);
          const adjustedDate = new Date(date.getTime());
          const dayKey = adjustedDate.toISOString().slice(0, 10);
          
          if (!dataByDay[dayKey]) {
            dataByDay[dayKey] = [];
          }
          
          dataByDay[dayKey].push({
            ...item,
            cleanDate: adjustedDate,
            hour: adjustedDate.getUTCHours()
          });
        });
        
        // Create comparison rows: Today vs Yesterday hour by hour
        const processedData = [];
        const today = new Date();
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        const adjustedToday = new Date(today.getTime());
        const adjustedYesterday = new Date(yesterday.getTime());
        const todayData = dataByDay[adjustedToday.toISOString().slice(0, 10)] || [];
        const yesterdayData = dataByDay[adjustedYesterday.toISOString().slice(0, 10)] || [];
        
        const yesterdayMap = {};
        yesterdayData.forEach(item => {
          yesterdayMap[item.hour] = item;
        });
        
        todayData.forEach(todayItem => {
          const yesterdayItem = yesterdayMap[todayItem.hour];
          const clicks = todayItem.CLICK ?? todayItem.Click ?? 0;
          const impressions = todayItem.IMPRESSION ?? todayItem.Impression ?? 0;
          const ctr = impressions ? (clicks / impressions) * 100 : 0;
          const visibleImpressions = todayItem.network_operations_visible_impressions ?? 0;
          const viewabilityRate = typeof todayItem.network_operations_viewability_rate === 'number'
            ? todayItem.network_operations_viewability_rate * 100
            : 0;

          const yesterdayClicks = yesterdayItem ? (yesterdayItem.CLICK ?? yesterdayItem.Click ?? 0) : 0;
          const yesterdayImpressions = yesterdayItem ? (yesterdayItem.IMPRESSION ?? yesterdayItem.Impression ?? 0) : 0;
          const yesterdayCtr = yesterdayImpressions ? (yesterdayClicks / yesterdayImpressions) * 100 : 0;
          const yesterdayVisibleImpressions = yesterdayItem?.network_operations_visible_impressions ?? 0;
          const yesterdayViewabilityRate = typeof yesterdayItem?.network_operations_viewability_rate === 'number'
            ? yesterdayItem.network_operations_viewability_rate * 100
            : 0;
          
          // Format label with hour
          const label = todayItem.cleanDate.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          });
          
          processedData.push({
            day: label,
            entityRevenue: todayItem.PriceAdvertiser_PublisherSide || 0,
            publisherCost: todayItem.PricePublisher || 0,
            margin: (todayItem.PriceAdvertiser_PublisherSide || 0) - (todayItem.PricePublisher || 0),
            click: clicks,
            impression: impressions,
            visibleImpressions,
            viewabilityRate,
            ctr,
            // Include yesterday data for comparison
            yesterdayData: yesterdayItem ? {
              entityRevenue: yesterdayItem.PriceAdvertiser_PublisherSide || 0,
              publisherCost: yesterdayItem.PricePublisher || 0,
              margin: (yesterdayItem.PriceAdvertiser_PublisherSide || 0) - (yesterdayItem.PricePublisher || 0),
              click: yesterdayClicks,
              impression: yesterdayImpressions,
              visibleImpressions: yesterdayVisibleImpressions,
              viewabilityRate: yesterdayViewabilityRate,
              ctr: yesterdayCtr
            } : null,
            hour: todayItem.hour
          });
        });
        
        return processedData;
      } else {
        // Daily mode: process with trends compared to previous day
        const normalized = rawData.map((item) => ({
          ...item,
          PriceAdvertiser_PublisherSide: (item.network_operations_price_advertiser || 0) * 1_000_000,
          PricePublisher: (item.network_operations_price_publisher || 0) * 1_000_000,
          CLICK: item.network_operations_click ?? item.network_operations_clicks ?? item.CLICK ?? 0,
          IMPRESSION: item.network_operations_impressions ?? item.IMPRESSION ?? 0,
          VISIBLE_IMPRESSION: item.network_operations_visible_impressions ?? item.VISIBLE_IMPRESSION ?? 0,
          VIEWABILITY_RATE: item.network_operations_viewability_rate ?? item.VIEWABILITY_RATE ?? 0
        }));

        return normalized.map((item, index, array) => {
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

          const marginChangePercent = previousItem && (previousItem.PriceAdvertiser_PublisherSide - previousItem.PricePublisher) !== 0 ? 
            ((((item.PriceAdvertiser_PublisherSide - item.PricePublisher) - (previousItem.PriceAdvertiser_PublisherSide - previousItem.PricePublisher)) / Math.abs(previousItem.PriceAdvertiser_PublisherSide - previousItem.PricePublisher)) * 100).toFixed(1) : 0;

          // Clean timestamp
          let cleanTimestamp = item.timestamp;
          cleanTimestamp = cleanTimestamp.replace(/\.\d{6}/, '');
          if (!cleanTimestamp.endsWith('Z') && !cleanTimestamp.includes('+')) {
            cleanTimestamp += 'Z';
          }
          
          const date = new Date(cleanTimestamp);
          
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
    } catch (error) {
      console.error('Error fetching daily data for placement:', placementId, error);
      return [];
    }
  };

  const renderPlacementCard = (item, { globalIndex, entityId, entityName, startDate, endDate }) => (
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
      fetchDailyData={fetchDailyDataForPlacement}
      viewMode={viewMode}
      onClick={(id, name) => {
        const encodedName = encodeURIComponent(name);
        navigate(`/PlacementAnalytics?id=${id}&name=${encodedName}`);
      }}
      getDetailUrl={(id, name) => `/PlacementAnalytics?id=${id}&name=${encodeURIComponent(name)}`}
      cache={cardDailyCache}
      setCache={setCardDailyCache}
      formatCurrency={formatCurrency}
      formatCurrencyDetailed={formatCurrencyDetailed}
      showImpressionsAndCtr
    />
  );

  return (
    <DashboardTemplate
      key={`${selectedRealmId}-${selectedCompanyId}-${renderKey}`}
      title="Placement Analytics"
      searchPlaceholder="Search placements..."
      entityNameSingular="placement"
      entityNamePlural="placements"
      apiEndpoint={API_ENDPOINTS.DRUID_SEARCH}
      topEntitiesPayload={topPlacementPayload}
      processTopEntitiesResponse={processTopPlacementResponse}
      getEntityId={getPlacementId}
      getEntityName={getPlacementName}
      fetchDailyDataForEntity={fetchDailyDataForPlacement}
      analyticsPagePath="/PlacementAnalytics"
      getAuthToken={getToken}
      filterRealmId={selectedRealmId || null}
      filterCompanyId={selectedCompanyId || null}
      hideSummaryMetrics
      cardLayout
      pageSize={12}
      renderEntityCard={renderPlacementCard}
    />
  );
}

