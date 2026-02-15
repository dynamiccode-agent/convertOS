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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
        
        // Show success message
        const accountsText = data.accountsSynced === 1 ? 'account' : 'accounts';
        alert(`✅ Data synced successfully!\n\nSynced ${data.accountsSynced} ${accountsText}\n\nRefreshing dashboard...`);
        
        // Refresh the page to load new data
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
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Desktop: always visible, Mobile: overlay when open */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 lg:z-0
        transform transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <AccountSidebar 
          userEmail={userEmail}
          userName={userName}
          selectedAccount={selectedAccount}
          onAccountSelect={(account) => {
            setSelectedAccount(account);
            setMobileMenuOpen(false); // Close menu on mobile after selection
          }}
          onClose={() => setMobileMenuOpen(false)}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col w-full lg:w-auto">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                aria-label="Open menu"
              >
                <svg className="h-6 w-6 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                  Meta Ads Dashboard
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 hidden sm:block">
                  Welcome back, {userName || userEmail?.split('@')[0]}
                  {lastSynced && <span className="ml-3">• Last synced: {lastSynced}</span>}
                </p>
              </div>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm sm:text-base whitespace-nowrap"
            >
              <svg className={`h-4 w-4 sm:h-5 sm:w-5 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">{syncing ? 'Syncing...' : 'Sync Data'}</span>
              <span className="sm:hidden">{syncing ? 'Sync...' : 'Sync'}</span>
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
