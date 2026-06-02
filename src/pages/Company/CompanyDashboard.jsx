/**
 * Company Dashboard Page Component
 * 
 * Uses the DashboardTemplate to display company (publisher) analytics with Realm filter
 */

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DashboardTemplate from "../Dashboard/DashboardTemplate";
import { useAuth } from "@/hooks/useAuth";
import { cachedFetch } from '@/utils/apiCache';
import { EntityPerformanceCard } from "@/components/dashboard/EntityPerformanceCard";
import { API_ENDPOINTS } from "@/config/api";
import { formatCurrency, formatCurrencyDetailed } from "@/utils/formatters";
import { buildAdserverHourlySummaryPayload, dateRangeToDruidInterval, processEntityHourlySparkFromRaw } from "@/utils/hourlyProjections";

export default function CompanyDashboard() {
  const { getToken } = useAuth();
  const [companyMapping, setCompanyMapping] = useState({});
  
  // State to force re-render when realm changes
  const [selectedRealmId, setSelectedRealmId] = useState(() => {
    return localStorage.getItem('selected-realm-id') || '';
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

  
  // Listen for realm changes from header
  useEffect(() => {
    const handleRealmChange = () => {
      const newRealmId = localStorage.getItem('selected-realm-id') || '';
      setSelectedRealmId(newRealmId);
      setRenderKey(prev => prev + 1); // Force re-render
    };
    
    window.addEventListener('realmChanged', handleRealmChange);
    window.addEventListener('storage', (e) => {
      if (e.key === 'selected-realm-id') {
        handleRealmChange();
      }
    });
    
    return () => {
      window.removeEventListener('realmChanged', handleRealmChange);
    };
  }, []);
  
  // Read selected realm from localStorage (managed by Layout header)
  const getSelectedRealmId = () => {
    return selectedRealmId;
  };

  useEffect(() => {
    const fetchCompanyMapping = async () => {
      const token = getToken();
      if (!token) return;

      try {
        const payload = {
          Filters: selectedRealmId ? [{ Field: "Realm_uid", Operator: "match", Value: selectedRealmId }] : [],
          From: 0,
          Order: [{ Field: "Name", Operator: "asc" }],
          Size: 1000
        };

        const response = await cachedFetch(API_ENDPOINTS.COMPANIES_SEARCH, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-ayl-auth-token': token
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) return;
        const data = await response.json();
        const mapping = {};
        (data?.Data || []).forEach((company) => {
          if (company?.Uid) {
            mapping[company.Uid] = company.Name || company.Uid;
          }
        });
        setCompanyMapping(mapping);
      } catch (err) {
        console.error('Error fetching company mapping:', err);
      }
    };

    fetchCompanyMapping();
  }, [selectedRealmId]);

  // Generate payload for top companies with optional Realm filter
  const topCompanyPayload = (startDate, endDate) => {
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
          "PublisherName"
        ],
        "Dimensions": ["publisherId"],
        "TimeZone": "Etc/GMT",
        "Granularity": "all",
        "Intervals": [{ "Begin": networkOpsBeginDate.toISOString(), "End": networkOpsEndDate.toISOString() }],
        "OrderBy": "network_operations_price_publisher",
        "OrderOp": "DESC",
        "Size": 500,
        "AddTotalRow": true
      };

      // Add Realm filter if a realm is selected
      const selectedRealmId = getSelectedRealmId();
      if (selectedRealmId) {
        payload.Filters = {
          "realmId": {
            "Value": [selectedRealmId],
            "Operator": "in"
          }
        };
      }

      return payload;
    }

    const payload = {
      "Intervals": [{"Begin": beginDate, "End": endDateValue}],
      "OrderBy": "PricePublisher",
      "OrderOp": "DESC",
      "Dimensions": ["Publisher"],
      "Size": 500,
      "Metrics": ["PricePublisher", "PriceAdvertiser_PublisherSide", "PublisherName"],
      "Datasource": "adserver_stats",
      "AddTotalRow": true,
      "TimeZone": "Etc/GMT",
      "Granularity": "all"
    };

    // Add Realm filter if a realm is selected
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

  // Process top companies response
  const processTopCompanyResponse = (data) => {
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
  const getCompanyId = (item) => item.Publisher || item.publisherId || item.publisher;

  // Get entity name with fallback  
  const getCompanyName = (item) => {
    const id = item.Publisher || item.publisherId || item.publisher;
    return item.Name_Publisher || item.PublisherName || (id && companyMapping[id]) || id || 'Unknown Company';
  };

  // Fetch daily/hourly data for a company
  const fetchDailyDataForCompany = async (publisherId, companyName, startDate, endDate) => {
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
          "Filters": {
            "publisherId": {
              "Value": [publisherId],
              "Operator": "in"
            }
          }
        };
      } else {
        payload = {
          "Intervals": [{"Begin": beginDate, "End": endDateFormatted}],
          "Filters": {
            "Publisher": {
              "Value": [publisherId],
              "Operator": "in"
            }
          },
          "Metrics": ["PriceAdvertiser_PublisherSide", "PricePublisher", "CLICK", "IMPRESSION"],
          "Granularity": {
            "type": "period",
            "period": "PT1H"
          },
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
      const rawData = data.Data || data;
      
      // Process time-series data
      if (currentViewMode === 'hourly') {
        return processEntityHourlySparkFromRaw(rawData);
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
      console.error('Error fetching daily data for company:', publisherId, error);
      return [];
    }
  };

  const renderCompanyCard = (item, { globalIndex, entityId, entityName, startDate, endDate }) => (
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
      fetchDailyData={fetchDailyDataForCompany}
      viewMode={viewMode}
      onClick={(id, name) => {
        const encodedName = encodeURIComponent(name);
        navigate(`/CompanyAnalytics?id=${id}&name=${encodedName}`);
      }}
      getDetailUrl={(id, name) => `/CompanyAnalytics?id=${id}&name=${encodeURIComponent(name)}`}
      cache={cardDailyCache}
      setCache={setCardDailyCache}
      formatCurrency={formatCurrency}
      formatCurrencyDetailed={formatCurrencyDetailed}
      showImpressionsAndCtr
    />
  );

  return (
    <DashboardTemplate
      key={`${selectedRealmId}-${renderKey}`}
      title="Company Analytics"
      searchPlaceholder="Search companies..."
      entityNameSingular="company"
      entityNamePlural="companies"
      apiEndpoint={API_ENDPOINTS.DRUID_SEARCH}
      topEntitiesPayload={topCompanyPayload}
      buildHourlySummaryPayload={buildHourlySummaryPayload}
      processTopEntitiesResponse={processTopCompanyResponse}
      getEntityId={getCompanyId}
      getEntityName={getCompanyName}
      fetchDailyDataForEntity={fetchDailyDataForCompany}
      analyticsPagePath="/CompanyAnalytics"
      getAuthToken={getToken}
      filterRealmId={selectedRealmId || null}
      hideSummaryMetrics
      cardLayout
      pageSize={12}
      renderEntityCard={renderCompanyCard}
    />
  );
}
