"use client";

import { useState } from 'react';

interface CampaignFiltersProps {
  statusFilter: 'all' | 'active' | 'inactive';
  onStatusChange: (status: 'all' | 'active' | 'inactive') => void;
  dateRange: string;
  onDateRangeChange: (range: string) => void;
  onColumnSettingsClick: () => void;
  activeTab?: 'all' | 'campaigns' | 'adsets' | 'ads';
  campaigns?: Array<{ id: string; campaignId: string; name: string; status?: string; effectiveStatus?: string }>;
  adSets?: Array<{ id: string; adsetId: string; campaignId: string; name: string }>;
  selectedCampaign?: string;
  selectedAdSet?: string;
  onCampaignChange?: (campaignId: string) => void;
  onAdSetChange?: (adsetId: string) => void;
  hidePaused?: boolean;
  onHidePausedChange?: (hidden: boolean) => void;
}

export default function CampaignFilters({
  statusFilter,
  onStatusChange,
  dateRange,
  onDateRangeChange,
  onColumnSettingsClick,
  activeTab = 'campaigns',
  campaigns = [],
  adSets = [],
  selectedCampaign = 'all',
  selectedAdSet = 'all',
  onCampaignChange,
  onAdSetChange,
  hidePaused = false,
  onHidePausedChange,
}: CampaignFiltersProps) {
  // Filter campaigns based on status filter
  const filteredCampaigns = campaigns.filter(campaign => {
    // Apply status filter
    if (statusFilter === 'active') {
      if (campaign.effectiveStatus !== 'ACTIVE' && campaign.status !== 'ACTIVE') {
        return false;
      }
    } else if (statusFilter === 'inactive') {
      if (campaign.effectiveStatus === 'ACTIVE' || campaign.status === 'ACTIVE') {
        return false;
      }
    }
    
    // Apply hide paused filter
    if (hidePaused) {
      const status = (campaign.effectiveStatus || campaign.status || '').toUpperCase();
      if (status.includes('PAUSED')) {
        return false;
      }
    }
    
    return true;
  });

  console.log('[Campaign Filter Debug] Status filter:', statusFilter);
  console.log('[Campaign Filter Debug] Hide paused:', hidePaused);
  console.log('[Campaign Filter Debug] Total campaigns:', campaigns.length);
  console.log('[Campaign Filter Debug] Filtered campaigns:', filteredCampaigns.length);
  console.log('[Campaign Filter Debug] Campaign details:', filteredCampaigns.map(c => ({ name: c.name, id: c.campaignId, status: c.effectiveStatus || c.status })));

  // Filter ad sets based on selected campaign
  const filteredAdSets = selectedCampaign === 'all' 
    ? adSets 
    : adSets.filter(as => as.campaignId === selectedCampaign);

  return (
    <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
              Status:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => onStatusChange(e.target.value as any)}
              className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            >
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
              <option value="all">All</option>
            </select>
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
              Date:
            </label>
            <select
              value={dateRange}
              onChange={(e) => onDateRangeChange(e.target.value)}
              className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last_3d">Last 3 Days</option>
              <option value="last_7d">Last 7 Days</option>
              <option value="last_14d">Last 14 Days</option>
              <option value="last_30d">Last 30 Days</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_year">Year to Date</option>
              <option value="last_year">Last Year</option>
              <option value="lifetime">All Time</option>
            </select>
          </div>

          {/* Campaign Filter (for Ad Sets and Ads tabs) */}
          {(activeTab === 'adsets' || activeTab === 'ads') && onCampaignChange && (
            <div className="flex items-center gap-2">
              <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Campaign:
              </label>
              <select
                value={selectedCampaign}
                onChange={(e) => {
                  onCampaignChange(e.target.value);
                  // Reset ad set filter when campaign changes
                  if (onAdSetChange) onAdSetChange('all');
                }}
                className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              >
                <option value="all">All Campaigns</option>
                {filteredCampaigns.map((campaign) => (
                  <option key={campaign.campaignId} value={campaign.campaignId}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Ad Set Filter (for Ads tab only) */}
          {activeTab === 'ads' && onAdSetChange && (
            <div className="flex items-center gap-2">
              <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Ad Set:
              </label>
              <select
                value={selectedAdSet}
                onChange={(e) => onAdSetChange(e.target.value)}
                className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              >
                <option value="all">All Ad Sets</option>
                {filteredAdSets.map((adSet) => (
                  <option key={adSet.adsetId} value={adSet.adsetId}>
                    {adSet.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Hide Paused Toggle */}
          {onHidePausedChange && (
            <label className="flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={hidePaused}
                onChange={(e) => onHidePausedChange(e.target.checked)}
                className="h-4 w-4 text-violet-600 focus:ring-violet-500 border-gray-300 rounded"
              />
              <span className="hidden sm:inline">Hide Paused</span>
              <span className="sm:hidden">Paused</span>
            </label>
          )}

          {/* Column Settings */}
          <button
            onClick={onColumnSettingsClick}
            className="flex items-center justify-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors whitespace-nowrap"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span className="hidden sm:inline">Columns</span>
            <span className="sm:hidden">Cols</span>
          </button>
        </div>
      </div>
    </div>
  );
}
