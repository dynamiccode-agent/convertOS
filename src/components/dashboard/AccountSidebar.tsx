"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";

interface Account {
  id: string;
  name: string;
  account_status?: number;
  lastSyncedAt?: string | null;
}

interface AccountSidebarProps {
  userEmail?: string | null;
  userName?: string | null;
  selectedAccount?: string;
  onAccountSelect?: (accountId: string) => void;
  onClose?: () => void;
}

export default function AccountSidebar({ 
  userEmail, 
  userName,
  selectedAccount = "all",
  onAccountSelect,
  onClose
}: AccountSidebarProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountsExpanded, setAccountsExpanded] = useState(true);
  const [contactsExpanded, setContactsExpanded] = useState(false);

  const formatTimeAgo = (isoString: string | null | undefined) => {
    if (!isoString) return 'Never synced';
    const diff = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/meta-ads/accounts');
      const data = await response.json();
      
      if (data.success && data.accounts) {
        setAccounts(data.accounts);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="w-64 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm shadow-lg border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            ConvertOS
          </div>
          <span className="text-xs text-gray-500">Meta Ads Intelligence</span>
        </div>
        {/* Close button (mobile only) */}
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Navigation
          </h3>
          <button
            onClick={() => onAccountSelect?.("all")}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
              selectedAccount === "all"
                ? "bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            <span className="text-lg">📊</span>
            <span>Dashboard</span>
          </button>
        </div>
        
        {/* Ad Accounts Section */}
        <div className="mb-4">
          <button
            onClick={() => setAccountsExpanded(!accountsExpanded)}
            className="w-full flex items-center justify-between px-2 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <span>Ad Accounts {!loading && `(${accounts.length})`}</span>
            <svg
              className={`h-4 w-4 transition-transform ${accountsExpanded ? 'transform rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {accountsExpanded && (
            <div className="mt-2">
              {loading ? (
                <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                  Loading accounts...
                </div>
              ) : accounts.length === 0 ? (
                <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                  No accounts found
                </div>
              ) : (
                <div className="space-y-1">
                  {accounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => onAccountSelect?.(account.id)}
                      className={`w-full text-left px-4 py-2 rounded-lg text-sm transition-colors ${
                        selectedAccount === account.id
                          ? "bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 font-medium"
                          : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      <div>{account.name}</div>
                      <div className={`text-[10px] mt-0.5 ${
                        selectedAccount === account.id
                          ? "text-violet-400 dark:text-violet-500"
                          : "text-gray-400 dark:text-gray-500"
                      }`}>
                        {formatTimeAgo(account.lastSyncedAt)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Contacts Section */}
        <div>
          <button
            onClick={() => setContactsExpanded(!contactsExpanded)}
            className="w-full flex items-center justify-between px-2 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            <span>Contacts</span>
            <svg
              className={`h-4 w-4 transition-transform ${contactsExpanded ? 'transform rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {contactsExpanded && (
            <div className="mt-2 px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
              Coming soon...
            </div>
          )}
        </div>
      </nav>
      
      {/* User Profile */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 px-4 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center text-violet-600 dark:text-violet-400 font-semibold">
            {userEmail?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {userName || userEmail}
            </div>
            <div className="text-xs text-gray-500 truncate">
              {userEmail}
            </div>
          </div>
        </div>
        
        {/* Logout Button */}
        <button
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
