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
                  ${Number(item.metrics?.spend || 0).toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Leads</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {Number(item.metrics?.leads || 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Cost/Lead</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  ${Number(item.metrics?.costPerLead || 0).toFixed(2)}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">CTR</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {Number(item.metrics?.ctr || 0).toFixed(2)}%
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
                  {(() => {
                    try {
                      if (item.dailyBudget && !isNaN(parseFloat(item.dailyBudget))) {
                        return `$${(parseFloat(item.dailyBudget) / 100).toFixed(2)}/day`;
                      } else if (item.lifetimeBudget && !isNaN(parseFloat(item.lifetimeBudget))) {
                        return `$${(parseFloat(item.lifetimeBudget) / 100).toFixed(2)} lifetime`;
                      }
                      return 'No budget set';
                    } catch {
                      return 'No budget set';
                    }
                  })()}
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
              {item.metrics?.ctr && Number(item.metrics.ctr) > 3 && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-400">✓</span>
                    <div className="text-sm text-green-900 dark:text-green-100">
                      <strong>Strong Performance:</strong> CTR of {Number(item.metrics.ctr).toFixed(2)}% is above average. Consider scaling this {type}.
                    </div>
                  </div>
                </div>
              )}
              {item.metrics?.costPerLead && Number(item.metrics.costPerLead) > 50 && Number(item.metrics.leads || 0) > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-600 dark:text-yellow-400">⚠</span>
                    <div className="text-sm text-yellow-900 dark:text-yellow-100">
                      <strong>High Cost Per Lead:</strong> At ${Number(item.metrics.costPerLead).toFixed(2)}, consider optimizing targeting or creative.
                    </div>
                  </div>
                </div>
              )}
              {item.metrics && 
               Number(item.metrics.leads || 0) === 0 && 
               Number(item.metrics.purchases || 0) === 0 && 
               Number(item.metrics.spend || 0) > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-red-600 dark:text-red-400">!</span>
                    <div className="text-sm text-red-900 dark:text-red-100">
                      <strong>No Conversions:</strong> This {type} has spent ${Number(item.metrics.spend).toFixed(2)} with no leads or purchases. Consider pausing or testing new creatives.
                    </div>
                  </div>
                </div>
              )}
              {item.metrics && Number(item.metrics.purchases || 0) > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400">📈</span>
                    <div className="text-sm text-blue-900 dark:text-blue-100">
                      <strong>Generating Sales:</strong> This {type} has {Number(item.metrics.purchases)} purchase{Number(item.metrics.purchases) !== 1 ? 's' : ''} at ${Number(item.metrics.costPerPurchase || 0).toFixed(2)} per sale.
                    </div>
                  </div>
                </div>
              )}
              {(!item.metrics || Object.keys(item.metrics).length === 0) && (
                <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                  <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
                    No insights available yet. Data will appear after the next sync.
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
