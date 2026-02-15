"use client";

import { useState, useEffect } from "react";
import AccountSidebar from "./AccountSidebar";
import CampaignsPage from "./CampaignsPage";

interface DashboardContentProps {
  userEmail?: string | null;
  userName?: string | null;
}

interface Account {
  id: string;
  name: string;
}

export default function DashboardContent({ userEmail, userName }: DashboardContentProps) {
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/meta-ads/accounts');
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.accounts)) {
          setAccounts(data.accounts);
        }
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/meta-ads/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datePreset: 'last_7d' }),
      });

      const data = await response.json();
      if (data.success) {
        setLastSynced(new Date().toLocaleString());
        await fetchAccounts();
        alert(`✅ Data synced successfully!\n\nSynced ${data.accountsSynced} account(s)`);
        // Trigger refresh by updating state
        window.location.reload();
      } else {
        const errorMsg = data.details || data.error || 'Unknown error';
        console.error('Sync error details:', data);
        alert(`❌ Sync failed:\n\n${errorMsg}\n\nCheck browser console for more details.`);
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      alert(`❌ Sync failed:\n\nNetwork or server error\n\n${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Sidebar */}
      <AccountSidebar 
        userEmail={userEmail}
        userName={userName}
        selectedAccount={selectedAccount}
        onAccountSelect={setSelectedAccount}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Meta Ads Dashboard
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Welcome back, {userName || userEmail?.split('@')[0]}
                {lastSynced && <span className="ml-3">• Last synced: {lastSynced}</span>}
              </p>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {syncing ? 'Syncing...' : 'Sync Data'}
            </button>
          </div>
        </header>

        {/* Campaigns Page */}
        <main className="flex-1 overflow-hidden">
          <CampaignsPage
            selectedAccount={selectedAccount}
            accounts={accounts}
            onAccountChange={setSelectedAccount}
          />
        </main>
      </div>
    </div>
  );
}
