"use client";

interface CampaignTabsProps {
  activeTab: 'all' | 'campaigns' | 'adsets' | 'ads';
  onTabChange: (tab: 'all' | 'campaigns' | 'adsets' | 'ads') => void;
}

export default function CampaignTabs({ activeTab, onTabChange }: CampaignTabsProps) {
  const tabs = [
    { id: 'all' as const, label: 'All (Hierarchy)', icon: '🌳' },
    { id: 'campaigns' as const, label: 'Campaigns', icon: '📊' },
    { id: 'adsets' as const, label: 'Ad Sets', icon: '🎯' },
    { id: 'ads' as const, label: 'Ads', icon: '📱' },
  ];

  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      <nav className="flex gap-2 px-6" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
              ${activeTab === tab.id
                ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }
            `}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
