"use client";

interface MetricsBarProps {
  selectedAccount: string;
  accounts: Array<{ id: string; name: string }>;
  onAccountChange: (accountId: string) => void;
  metrics: {
    totalSpend: string;
    totalLeads: number;
    avgCostPerLead: string;
    totalSales: number;
    avgCostPerSale: string;
    avgCTR: string;
  };
  loading?: boolean;
}

export default function MetricsBar({
  selectedAccount,
  accounts,
  onAccountChange,
  metrics,
  loading = false,
}: MetricsBarProps) {
  const selectedAccountName = accounts.find(a => a.id === selectedAccount)?.name || 'All Accounts';

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="px-4 sm:px-6 py-4">
        {/* Account Selector */}
        <div className="mb-4">
          <select
            value={selectedAccount}
            onChange={(e) => onAccountChange(e.target.value)}
            className="text-sm sm:text-lg font-semibold px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-violet-500 focus:border-transparent w-full sm:w-auto sm:min-w-[300px]"
          >
            <option value="all">All Accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* Total Spend */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              Total Spend
            </div>
            <div className="text-lg sm:text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
              {loading ? '...' : `$${metrics.totalSpend}`}
            </div>
          </div>

          {/* Total Leads */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              Total Leads
            </div>
            <div className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
              {loading ? '...' : metrics.totalLeads.toLocaleString()}
            </div>
          </div>

          {/* Avg Cost Per Lead */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              Avg CPL
            </div>
            <div className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
              {loading ? '...' : `$${metrics.avgCostPerLead}`}
            </div>
          </div>

          {/* Total Sales */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              Sales
            </div>
            <div className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
              {loading ? '...' : metrics.totalSales.toLocaleString()}
            </div>
          </div>

          {/* Avg Cost Per Sale */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              Avg CPA
            </div>
            <div className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
              {loading ? '...' : `$${metrics.avgCostPerSale}`}
            </div>
          </div>

          {/* Avg CTR */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 sm:p-4">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
              Avg CTR
            </div>
            <div className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
              {loading ? '...' : `${metrics.avgCTR}%`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
