/**
 * API endpoints configuration
 * Centralizes all backend API URLs for easier maintenance
 */

export const API_BASE_URL = 'https://back.platform.gcp.omnitagjs.com/bo-api';

export const API_ENDPOINTS = {
  // Druid / analytics
  DRUID_SEARCH: `${API_BASE_URL}/druid/search`,

  // Entities Create
  DEALS: `${API_BASE_URL}/deals`,
  REALMS: `${API_BASE_URL}/realms`,
  USERS: `${API_BASE_URL}/users`,
  COMPANIES: `${API_BASE_URL}/companies`,
  SITES: `${API_BASE_URL}/sites`,
  PLACEMENTS: `${API_BASE_URL}/placements`,
  PARTNERS: `${API_BASE_URL}/partners`,
  BROKER_PARTNERS: `${API_BASE_URL}/broker_partners`,
  COOKIE_SYNC: `${API_BASE_URL}/cookie_sync`,
  BLOCKED_CREATIVE_MANUAL: `${API_BASE_URL}/blocked_creative/manual`,

  // Entities search
  DEALS_SEARCH: `${API_BASE_URL}/deals/search`,
  DEALS_AUDIENCES: `${API_BASE_URL}/deals/audiences`,
  REALMS_SEARCH: `${API_BASE_URL}/realms/search`,
  USERS_SEARCH: `${API_BASE_URL}/users/search`,
  COMPANIES_SEARCH: `${API_BASE_URL}/companies/search`,
  SITES_SEARCH: `${API_BASE_URL}/sites/search`,
  PLACEMENTS_SEARCH: `${API_BASE_URL}/placements/search`,
  PARTNERS_SEARCH: `${API_BASE_URL}/partners/search`,
  BROKER_PARTNERS_SEARCH: `${API_BASE_URL}/broker_partners/search`,
  COOKIE_SYNC_SEARCH: `${API_BASE_URL}/cookie_sync/search`,
  BLOCKED_CREATIVE_SEARCH: `${API_BASE_URL}/blocked_creative/search`,


};

/** Build URL for entity by ID */
export const apiUrl = {
  placement: (id) => `${API_BASE_URL}/placements/${id}`,
  deal: (id) => `${API_BASE_URL}/deals/${id}`,
  realm: (id) => `${API_BASE_URL}/realms/${id}`,
  company: (id) => `${API_BASE_URL}/companies/${id}`,
  site: (id) => `${API_BASE_URL}/sites/${id}`,
  partner: (id) => `${API_BASE_URL}/partners/${id}`,
  brokerPartner: (id) => `${API_BASE_URL}/broker_partners/${id}`,
  cookieSync: (id) => `${API_BASE_URL}/cookie_sync/${id}`,
  user: (id) => `${API_BASE_URL}/users/${id}`,
};
