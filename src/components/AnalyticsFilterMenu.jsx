/**
 * Analytics Filter Menu Component
 * 
 * A reusable right-side menu component for analytics dashboards.
 * Supports filtering by realmId, companyId, siteId, placementId, or dealId.
 * 
 * @param {Object} props
 * @param {string} props.realmId - Optional realm ID filter
 * @param {string} props.companyId - Optional company ID filter
 * @param {string} props.siteId - Optional site ID filter
 * @param {string} props.placementId - Optional placement ID filter
 * @param {string} props.dealId - Optional deal ID filter
 * @param {string} props.partnerId - Optional partner ID filter
 * @param {Array} props.menuItems - Array of menu items with {id, label}
 * @param {Function} props.onMenuItemClick - Callback when menu item is clicked (itemId, filters)
 * @param {string} props.selectedFilter - Currently selected filter ID
 * @param {boolean} props.isPanelOpen - Whether the side panel is open
 * @param {Function} props.onClosePanel - Callback to close the panel
 * @param {ReactNode} props.panelContent - Content to display in the side panel
 * 
 * @example
 * // Basic usage without filters
 * <AnalyticsFilterMenu
 *   menuItems={[
 *     { id: 'kpi-prog', label: 'KPI PROG' },
 *     { id: 'device', label: 'DEVICE' },
 *     { id: 'dsp', label: 'DSP' }
 *   ]}
 *   selectedFilter={selectedFilter}
 *   isPanelOpen={isPanelOpen}
 *   onMenuItemClick={(itemId, filters) => {
 *     setSelectedFilter(itemId);
 *     setIsPanelOpen(true);
 *   }}
 *   onClosePanel={() => {
 *     setIsPanelOpen(false);
 *     setSelectedFilter(null);
 *   }}
 *   panelContent={<div>Panel content here</div>}
 * />
 * 
 * @example
 * // Usage with realmId filter
 * <AnalyticsFilterMenu
 *   realmId="realm-123"
 *   menuItems={menuItems}
 *   selectedFilter={selectedFilter}
 *   isPanelOpen={isPanelOpen}
 *   onMenuItemClick={handleMenuItemClick}
 *   onClosePanel={handleClosePanel}
 *   panelContent={panelContent}
 * />
 * 
 * @example
 * // Usage with companyId and siteId filters
 * <AnalyticsFilterMenu
 *   companyId="company-456"
 *   siteId="site-789"
 *   menuItems={menuItems}
 *   selectedFilter={selectedFilter}
 *   isPanelOpen={isPanelOpen}
 *   onMenuItemClick={handleMenuItemClick}
 *   onClosePanel={handleClosePanel}
 *   panelContent={panelContent}
 * />
 */

import React, { useState } from "react";
import { X, Menu } from "lucide-react";

export default function AnalyticsFilterMenu({
  realmId = null,
  companyId = null,
  siteId = null,
  placementId = null,
  dealId = null,
  partnerId = null,
  menuItems = [],
  onMenuItemClick = () => {},
  selectedFilter = null,
  isPanelOpen = false,
  onClosePanel = () => {},
  panelContent = null,
  headerActions = null
}) {
  // Build filter object from props
  const filters = {
    ...(realmId && { realmId }),
    ...(companyId && { companyId }),
    ...(siteId && { siteId }),
    ...(placementId && { placementId }),
    ...(dealId && { dealId }),
    ...(partnerId && { partnerId })
  };

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleMenuItemClick = (itemId) => {
    onMenuItemClick(itemId, filters);
    // Close mobile menu after selection
    setIsMenuOpen(false);
  };

  return (
    <>
      {/* Mobile/Tablet Menu Toggle Button */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="lg:hidden fixed bottom-6 right-6 z-50 bg-[rgb(75,99,226)] text-white p-4 rounded-full shadow-lg hover:bg-[rgb(40,62,173)] transition-colors"
        aria-label="Toggle filter menu"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Right Sidebar Menu - Visible on tablet and desktop */}
      <div className={`${isMenuOpen ? 'flex' : 'hidden'} md:flex flex-col w-8 bg-white border-l border-slate-200 fixed right-0 top-[70px] bottom-0 z-40 lg:z-0 overflow-hidden`}>
        <div className="flex flex-col items-center py-8 space-y-1 w-full">
          {menuItems.map((item) => {
            const isSelected = selectedFilter === item.id;
            const isLongLabel = item.id === 'kpi-prog' || item.id === 'ad-kind';
            const isExtraLongLabel = item.id === 'ad-domain' || item.id === 'site-domain';
            const isBusinessReview = item.id === 'business-review';
            const isShortLabel = item.id === 'dsp' || item.id === 'seat' || item.id === 'geo';
            return (
              <button
                key={item.id}
                onClick={() => handleMenuItemClick(item.id)}
                className={`relative flex items-center justify-center w-full transition-all rounded-lg overflow-hidden ${
                  isExtraLongLabel || isBusinessReview ? 'py-9' : isShortLabel ? 'py-5' : 'py-7'
                } ${
                  isSelected
                    ? 'text-[rgb(75,99,226)]'
                    : 'text-slate-600 hover:bg-[rgb(40,62,173)] hover:text-white'
                }`}
              >
                {isSelected && (
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[rgb(75,99,226)] rounded-r-lg" />
                )}
                <span
                  className="text-[10px] font-semibold whitespace-nowrap"
                  style={{ transform: 'rotate(90deg)' }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Side Panel - Opens from right */}
      {isPanelOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/20 z-[40] transition-opacity duration-200"
            onClick={onClosePanel}
          />
          
          {/* Panel */}
          <div className="fixed right-0 md:right-12 top-[70px] bottom-[80px] w-full md:w-[90%] bg-white border-l border-slate-200 shadow-2xl z-[50] animate-in slide-in-from-right duration-200 ease-out flex flex-col">
            {/* Panel Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-800">
                {menuItems.find(item => item.id === selectedFilter)?.label || 'Filter'}
              </h2>
              <div className="flex items-center gap-2">
                {headerActions}
                <button
                  onClick={onClosePanel}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 pb-4">
                {panelContent}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

