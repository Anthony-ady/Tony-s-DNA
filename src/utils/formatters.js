/**
 * Centralized formatting utilities
 * Used across dashboards, analytics pages, and profitability views
 */

/**
 * Format currency for dashboard cards (values in raw units, divide by 1M)
 * Output: "$0.98" or "$1 234.56"
 */
export function formatCurrency(value) {
  const millions = (value || 0) / 1_000_000;
  return `$${millions.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
}

/**
 * Format currency with "M" suffix for charts (better readability)
 * Values >= 1M: 2 decimals. Values < 1M: 3 decimals (e.g. "$0.976M")
 * Output: "$0.976M" or "$1.50 M"
 */
export function formatCurrencyDetailed(value) {
  const millions = (value || 0) / 1_000_000;
  if (millions >= 1) {
    return `$${millions.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}M`;
  }
  return `$${millions.toFixed(3)}M`;
}

/**
 * Format currency for analytics charts (Intl, 0 decimals, divide by 1M)
 */
export function formatCurrencyChart(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format((value || 0) / 1_000_000);
}

/**
 * Format currency without division (for profitability / network_operations)
 */
export function formatCurrencyRaw(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

/**
 * Format large numbers (bid requests, impressions, etc.)
 * Uses Intl for locale-aware grouping
 */
export function formatLargeNumber(value) {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US').format(value);
}

/**
 * Format large numbers in compact form (1.5M, 2.3K)
 */
export function formatLargeNumberCompact(value) {
  if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(2) + 'M';
  }
  if (value >= 1_000) {
    return (value / 1_000).toFixed(2) + 'K';
  }
  return String(value ?? 0);
}

/**
 * Format eCPM (Revenue per Thousand Impressions)
 */
export function formatEcpm(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '$0.00';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

/**
 * Format RPBR (Revenue Per Bid Request)
 */
export function formatRpbr(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '$0.00';
  }
  return `$${Number(value).toFixed(2)}`;
}

/**
 * Format percentage
 */
export function formatPercentage(value) {
  if (value === null || value === undefined) {
    return '0.00%';
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return `${value}%`;
  }
  return `${numeric.toFixed(2)}%`;
}
