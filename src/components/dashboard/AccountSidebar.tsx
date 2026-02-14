"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Account {
  id: string;
  name: string;
  account_status?: number;
}

interface AccountSidebarProps {
  userEmail?: string | null;
  userName?: string | null;
  selectedAccount?: string;
  onAccountSelect?: (accountId: string) => void;
}

export default function AccountSidebar({ 
  userEmail, 
  userName,
  selectedAccount = "all",
  onAccountSelect 
}: AccountSidebarProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

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
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
          ConvertOS
        </div>
        <span className="text-xs text-gray-500">Meta Ads Intelligence</span>
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
        
        {/* Ad Accounts */}
        <div>
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Ad Accounts {!loading && `(${accounts.length})`}
          </h3>
          
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
                  {account.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>
      
      {/* User Profile */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 px-4 py-2">
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
      </div>
    </aside>
  );
}
