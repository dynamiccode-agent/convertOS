"use client";

import { useState, useEffect } from "react";
import CampaignTabs from "./CampaignTabs";
import CampaignFilters from "./CampaignFilters";
import MetricsBar from "./MetricsBar";
import SortableTable from "./SortableTable";
import DraggableColumnManager, { ColumnConfig } from "./DraggableColumnManager";
import InsightsDrawer from "./InsightsDrawer";
import HierarchyView from "./HierarchyView";

interface CampaignsPageProps {
  selectedAccount: string;
  accounts: Array<{ id: string; name: string }>;
  onAccountChange: (accountId: string) => void;
}

// Define default columns for each view
const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'name', label: 'Name', visible: true, order: 0, sortable: true, type: 'text' },
  { id: 'effectiveStatus', label: 'Status', visible: true, order: 1, sortable: true, type: 'text' },
  { id: 'dailyBudget', label: 'Daily Budget', visible: true, order: 2, sortable: true, type: 'currency' },
  { id: 'lifetimeBudget', label: 'Lifetime Budget', visible: false, order: 3, sortable: true, type: 'currency' },
  { id: 'metrics.spend', label: 'Spend', visible: true, order: 4, sortable: true, type: 'currency' },
  { id: 'metrics.impressions', label: 'Impressions', visible: true, order: 5, sortable: true, type: 'number' },
  { id: 'metrics.clicks', label: 'Clicks', visible: true, order: 6, sortable: true, type: 'number' },
  { id: 'metrics.ctr', label: 'CTR', visible: true, order: 7, sortable: true, type: 'percentage' },
  { id: 'metrics.leads', label: 'Leads', visible: true, order: 8, sortable: true, type: 'number' },
  { id: 'metrics.costPerLead', label: 'Cost/Lead', visible: true, order: 9, sortable: true, type: 'currency' },
  { id: 'metrics.purchases', label: 'Purchases', visible: true, order: 10, sortable: true, type: 'number' },
  { id: 'metrics.costPerPurchase', label: 'Cost/Purchase', visible: true, order: 11, sortable: true, type: 'currency' },
  { id: 'metrics.registrations', label: 'Registrations', visible: false, order: 12, sortable: true, type: 'number' },
  { id: 'metrics.reach', label: 'Reach', visible: false, order: 13, sortable: true, type: 'number' },
  { id: 'metrics.frequency', label: 'Frequency', visible: false, order: 14, sortable: true, type: 'number' },
  { id: 'metrics.cpc', label: 'CPC', visible: false, order: 15, sortable: true, type: 'currency' },
  { id: 'metrics.cpm', label: 'CPM', visible: false, order: 16, sortable: true, type: 'currency' },
];

export default function CampaignsPage({ selectedAccount, accounts, onAccountChange }: CampaignsPageProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'campaigns' | 'adsets' | 'ads'>('campaigns');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [dateRange, setDateRange] = useState('last_7d');
  const [loading, setLoading] = useState(true);
  
  // Data
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [adSets, setAdSets] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  
  // UI State
  const [columnManagerOpen, setColumnManagerOpen] = useState(false);
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<'campaign' | 'adset' | 'ad'>('campaign');

  useEffect(() => {
    fetchAllData();
  }, [selectedAccount, dateRange]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Fetch campaigns
      const campaignsRes = await fetch(`/api/meta-ads/campaigns?accountId=${selectedAccount}`);
      if (campaignsRes.ok) {
        const campaignsData = await campaignsRes.json();
        setCampaigns(campaignsData.campaigns || []);
      }

      // Fetch ad sets
      const adSetsRes = await fetch(`/api/meta-ads/adsets?accountId=${selectedAccount}`);
      if (adSetsRes.ok) {
        const adSetsData = await adSetsRes.json();
        setAdSets(adSetsData.adSets || []);
      }

      // Fetch ads
      const adsRes = await fetch(`/api/meta-ads/ads?accountId=${selectedAccount}`);
      if (adsRes.ok) {
        const adsData = await adsRes.json();
        setAds(adsData.ads || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter data by status
  const filterByStatus = (data: any[]) => {
    if (statusFilter === 'all') return data;
    if (statusFilter === 'active') {
      return data.filter(item => item.effectiveStatus === 'ACTIVE' || item.status === 'ACTIVE');
    }
    return data.filter(item => item.effectiveStatus !== 'ACTIVE' && item.status !== 'ACTIVE');
  };

  const filteredCampaigns = filterByStatus(campaigns);
  const filteredAdSets = filterByStatus(adSets);
  const filteredAds = filterByStatus(ads);

  // Calculate metrics
  const calculateMetrics = () => {
    const allData = [...campaigns];
    const totalSpend = allData.reduce((sum, item) => sum + (item.metrics?.spend || 0), 0);
    const totalLeads = allData.reduce((sum, item) => sum + (item.metrics?.leads || 0), 0);
    const totalSales = allData.reduce((sum, item) => sum + (item.metrics?.purchases || 0), 0);
    const avgCTR = allData.length > 0
      ? allData.reduce((sum, item) => sum + (item.metrics?.ctr || 0), 0) / allData.length
      : 0;
    const avgCostPerLead = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const avgCostPerSale = totalSales > 0 ? totalSpend / totalSales : 0;

    return {
      totalSpend: totalSpend.toFixed(2),
      totalLeads,
      avgCostPerLead: avgCostPerLead.toFixed(2),
      totalSales,
      avgCostPerSale: avgCostPerSale.toFixed(2),
      avgCTR: avgCTR.toFixed(2),
    };
  };

  const handleRowClick = (item: any) => {
    setSelectedItem(item);
    setSelectedType(activeTab === 'adsets' ? 'adset' : activeTab === 'ads' ? 'ad' : 'campaign');
    setDrawerOpen(true);
  };

  const handleItemClick = (item: any, type: 'campaign' | 'adset' | 'ad') => {
    setSelectedItem(item);
    setSelectedType(type);
    setDrawerOpen(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Metrics Bar */}
      <MetricsBar
        selectedAccount={selectedAccount}
        accounts={accounts}
        onAccountChange={onAccountChange}
        metrics={calculateMetrics()}
        loading={loading}
      />

      {/* Tabs */}
      <CampaignTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Filters */}
      <CampaignFilters
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onColumnSettingsClick={() => setColumnManagerOpen(true)}
      />

      {/* Content Area */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'all' ? (
          <div className="p-6">
            <HierarchyView
              campaigns={filteredCampaigns}
              adSets={filteredAdSets}
              ads={filteredAds}
              onItemClick={handleItemClick}
              loading={loading}
            />
          </div>
        ) : activeTab === 'campaigns' ? (
          <div className="h-full">
            <SortableTable
              columns={columns}
              data={filteredCampaigns}
              onRowClick={handleRowClick}
              loading={loading}
              emptyMessage={
                campaigns.length === 0
                  ? 'No campaigns found. Click "Sync Data" to fetch from Meta.'
                  : 'No campaigns match your filters. Try adjusting the status or date range.'
              }
            />
          </div>
        ) : activeTab === 'adsets' ? (
          <div className="h-full">
            <SortableTable
              columns={columns}
              data={filteredAdSets}
              onRowClick={handleRowClick}
              loading={loading}
              emptyMessage={
                adSets.length === 0
                  ? 'No ad sets found. Click "Sync Data" to fetch from Meta.'
                  : 'No ad sets match your filters. Try adjusting the status or date range.'
              }
            />
          </div>
        ) : (
          <div className="h-full">
            <SortableTable
              columns={columns}
              data={filteredAds}
              onRowClick={handleRowClick}
              loading={loading}
              emptyMessage={
                ads.length === 0
                  ? 'No ads found. Click "Sync Data" to fetch from Meta.'
                  : 'No ads match your filters. Try adjusting the status or date range.'
              }
            />
          </div>
        )}
      </div>

      {/* Column Manager Modal */}
      <DraggableColumnManager
        isOpen={columnManagerOpen}
        onClose={() => setColumnManagerOpen(false)}
        columns={columns}
        onColumnsChange={setColumns}
      />

      {/* Insights Drawer */}
      <InsightsDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        item={selectedItem}
        type={selectedType}
      />
    </div>
  );
}
