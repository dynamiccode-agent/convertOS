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
    <div className="bg-gray-50 dark:bg-gray-800 border-b-2 border-gray-200 dark:border-gray-700 overflow-x-auto">
      <nav className="flex w-full min-w-max px-4 sm:px-6" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex-1 flex items-center justify-center gap-2 sm:gap-3 px-3 sm:px-6 py-3 sm:py-4 text-sm sm:text-base font-semibold border-b-4 transition-all whitespace-nowrap
              ${activeTab === tab.id
                ? 'border-violet-600 bg-white dark:bg-gray-900 text-violet-600 dark:text-violet-400 shadow-sm'
                : 'border-transparent bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
              }
            `}
          >
            <span className="text-lg sm:text-xl">{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.id === 'all' ? 'All' : tab.id === 'campaigns' ? 'Campaigns' : tab.id === 'adsets' ? 'Sets' : 'Ads'}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
