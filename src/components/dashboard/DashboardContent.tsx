"use client";

import { useState } from "react";
import AccountSidebar from "./AccountSidebar";

interface DashboardContentProps {
  userEmail?: string | null;
  userName?: string | null;
}

export default function DashboardContent({ userEmail, userName }: DashboardContentProps) {
  const [selectedAccount, setSelectedAccount] = useState<string>("all");

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
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              {selectedAccount === "all" ? "Dashboard" : "Account Dashboard"}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {selectedAccount === "all" 
                ? `Welcome back, ${userName || userEmail?.split('@')[0]}`
                : "Viewing selected account metrics"
              }
            </p>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Spend</dt>
                        <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                          {selectedAccount === "all" ? "$26,001.46" : "$8,366.88"}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Leads</dt>
                        <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                          {selectedAccount === "all" ? "1,270" : "82"}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Avg CTR</dt>
                        <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                          {selectedAccount === "all" ? "3.03%" : "3.12%"}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Campaigns</dt>
                        <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                          {selectedAccount === "all" ? "175" : "68"}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Coming Soon Section */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Coming Soon</h2>
              <p className="text-gray-600 dark:text-gray-400">
                Full Meta Ads dashboard with campaigns, ad sets, and ads tables will be integrated here.
                The intelligence layer from the original dashboard will be migrated to this production environment.
              </p>
              {selectedAccount !== "all" && (
                <p className="mt-4 text-sm text-violet-600 dark:text-violet-400">
                  Currently viewing: Account {selectedAccount}
                </p>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
