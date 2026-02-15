"use client";

import { useState } from 'react';

interface HierarchyViewProps {
  campaigns: any[];
  adSets: any[];
  ads: any[];
  onItemClick: (item: any, type: 'campaign' | 'adset' | 'ad') => void;
  loading?: boolean;
}

export default function HierarchyView({
  campaigns,
  adSets,
  ads,
  onItemClick,
  loading = false,
}: HierarchyViewProps) {
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set());

  const toggleCampaign = (campaignId: string) => {
    const newExpanded = new Set(expandedCampaigns);
    if (newExpanded.has(campaignId)) {
      newExpanded.delete(campaignId);
    } else {
      newExpanded.add(campaignId);
    }
    setExpandedCampaigns(newExpanded);
  };

  const toggleAdSet = (adsetId: string) => {
    const newExpanded = new Set(expandedAdSets);
    if (newExpanded.has(adsetId)) {
      newExpanded.delete(adsetId);
    } else {
      newExpanded.add(adsetId);
    }
    setExpandedAdSets(newExpanded);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-gray-500">
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading hierarchy...
        </div>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        No campaigns found. Click "Sync Data" to fetch from Meta.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {campaigns.map((campaign) => {
        const campaignAdSets = adSets.filter(as => as.campaignId === campaign.campaignId);
        const isExpanded = expandedCampaigns.has(campaign.campaignId);

        return (
          <div key={campaign.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {/* Campaign Level */}
            <div className="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <div className="flex items-center gap-3 p-4">
                <button
                  onClick={() => toggleCampaign(campaign.campaignId)}
                  className="flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                >
                  <svg
                    className={`h-4 w-4 text-gray-500 transition-transform ${isExpanded ? 'transform rotate-90' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <div className="flex-1 cursor-pointer" onClick={() => onItemClick(campaign, 'campaign')}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📊</span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{campaign.name}</h3>
                      <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                        <span className={`px-2 py-0.5 rounded-full ${
                          campaign.effectiveStatus === 'ACTIVE'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {campaign.effectiveStatus || campaign.status}
                        </span>
                        <span>Spend: ${campaign.metrics?.spend?.toFixed(2) || '0.00'}</span>
                        <span>Leads: {campaign.metrics?.leads || 0}</span>
                        <span>CTR: {campaign.metrics?.ctr?.toFixed(2) || '0.00'}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Ad Sets Level */}
            {isExpanded && campaignAdSets.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-900/50">
                {campaignAdSets.map((adSet) => {
                  const adSetAds = ads.filter(ad => ad.adsetId === adSet.adsetId);
                  const isAdSetExpanded = expandedAdSets.has(adSet.adsetId);

                  return (
                    <div key={adSet.id} className="border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-3 p-4 pl-12 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors">
                        <button
                          onClick={() => toggleAdSet(adSet.adsetId)}
                          className="flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                        >
                          <svg
                            className={`h-4 w-4 text-gray-500 transition-transform ${isAdSetExpanded ? 'transform rotate-90' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>

                        <div className="flex-1 cursor-pointer" onClick={() => onItemClick(adSet, 'adset')}>
                          <div className="flex items-center gap-3">
                            <span className="text-xl">🎯</span>
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 dark:text-white text-sm">{adSet.name}</h4>
                              <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                <span className={`px-2 py-0.5 rounded-full ${
                                  adSet.effectiveStatus === 'ACTIVE'
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                }`}>
                                  {adSet.effectiveStatus || adSet.status}
                                </span>
                                <span>Spend: ${adSet.metrics?.spend?.toFixed(2) || '0.00'}</span>
                                <span>Leads: {adSet.metrics?.leads || 0}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Ads Level */}
                      {isAdSetExpanded && adSetAds.length > 0 && (
                        <div className="bg-gray-100 dark:bg-gray-900">
                          {adSetAds.map((ad) => (
                            <div
                              key={ad.id}
                              onClick={() => onItemClick(ad, 'ad')}
                              className="flex items-center gap-3 p-4 pl-20 border-t border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                            >
                              <span className="text-lg">📱</span>
                              <div className="flex-1">
                                <h5 className="text-sm text-gray-900 dark:text-white">{ad.name}</h5>
                                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  <span className={`px-2 py-0.5 rounded-full ${
                                    ad.effectiveStatus === 'ACTIVE'
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                                  }`}>
                                    {ad.effectiveStatus || ad.status}
                                  </span>
                                  <span>Spend: ${ad.metrics?.spend?.toFixed(2) || '0.00'}</span>
                                  <span>Leads: {ad.metrics?.leads || 0}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
