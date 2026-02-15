"use client";

interface InsightsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  item: any;
  type: 'campaign' | 'adset' | 'ad';
}

export default function InsightsDrawer({ isOpen, onClose, item, type }: InsightsDrawerProps) {
  if (!isOpen || !item) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-96 bg-white dark:bg-gray-800 shadow-2xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {item.name}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">
              {type} Details
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status Badge */}
          <div>
            <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
              item.effectiveStatus === 'ACTIVE' 
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
            }`}>
              {item.effectiveStatus || item.status}
            </span>
          </div>

          {/* Key Metrics */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Key Metrics
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Spend</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  ${item.metrics?.spend?.toFixed(2) || '0.00'}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Leads</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {item.metrics?.leads || 0}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Cost/Lead</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  ${item.metrics?.costPerLead?.toFixed(2) || '0.00'}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">CTR</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {item.metrics?.ctr?.toFixed(2) || '0.00'}%
                </div>
              </div>
            </div>
          </div>

          {/* Budget Info (if campaign/adset) */}
          {(type === 'campaign' || type === 'adset') && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Budget
              </h3>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {item.dailyBudget 
                    ? `$${(parseFloat(item.dailyBudget) / 100).toFixed(2)}/day`
                    : item.lifetimeBudget
                    ? `$${(parseFloat(item.lifetimeBudget) / 100).toFixed(2)} lifetime`
                    : 'No budget set'}
                </div>
              </div>
            </div>
          )}

          {/* Insights */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              AI Insights
            </h3>
            <div className="space-y-2">
              {item.metrics?.ctr && parseFloat(item.metrics.ctr) > 3 && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-400">✓</span>
                    <div className="text-sm text-green-900 dark:text-green-100">
                      <strong>Strong Performance:</strong> CTR of {item.metrics.ctr.toFixed(2)}% is above average. Consider scaling this {type}.
                    </div>
                  </div>
                </div>
              )}
              {item.metrics?.costPerLead && parseFloat(item.metrics.costPerLead) > 50 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-600 dark:text-yellow-400">⚠</span>
                    <div className="text-sm text-yellow-900 dark:text-yellow-100">
                      <strong>High Cost Per Lead:</strong> At ${item.metrics.costPerLead.toFixed(2)}, consider optimizing targeting or creative.
                    </div>
                  </div>
                </div>
              )}
              {(!item.metrics || item.metrics.leads === 0) && item.metrics?.spend > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-red-600 dark:text-red-400">!</span>
                    <div className="text-sm text-red-900 dark:text-red-100">
                      <strong>No Conversions:</strong> This {type} has spent ${item.metrics.spend.toFixed(2)} with no leads. Consider pausing or testing new creatives.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recommendations */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Recommendations
            </h3>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-start gap-2">
                <span>•</span>
                <span>Monitor frequency to avoid audience fatigue</span>
              </div>
              <div className="flex items-start gap-2">
                <span>•</span>
                <span>A/B test new creative variations</span>
              </div>
              <div className="flex items-start gap-2">
                <span>•</span>
                <span>Review targeting parameters weekly</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
