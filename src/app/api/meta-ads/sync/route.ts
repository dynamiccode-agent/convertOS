import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// Allow up to 5 minutes for full sync across all accounts
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_API_VERSION = process.env.META_API_VERSION || 'v24.0';

// Only fetch insights for entities that are currently delivering.
// Paused / stopped entities retain their last-known insight data in the DB.
const ACTIVE_INSIGHT_STATUSES = new Set(['ACTIVE', 'WITH_ISSUES']);

interface MetaAccount {
  id: string;
  name: string;
  account_status?: number;
  currency?: string;
  timezone_name?: string;
}

interface MetaCampaign {
  id: string;
  name: string;
  objective?: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  budget_remaining?: string;
  created_time?: string;
  start_time?: string;
  stop_time?: string;
}

interface MetaAdSet {
  id: string;
  name: string;
  campaign_id: string;
  status?: string;
  effective_status?: string;
  optimization_goal?: string;
  bid_strategy?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  created_time?: string;
  start_time?: string;
  end_time?: string;
}

interface MetaAd {
  id: string;
  name: string;
  adset_id?: string;
  campaign_id?: string;
  status?: string;
  effective_status?: string;
  creative?: {
    id?: string;
    title?: string;
    body?: string;
    image_url?: string;
    thumbnail_url?: string;
  };
  created_time?: string;
}

interface MetaInsightsData {
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  frequency?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: Array<{ action_type: string; value: string }>;
}

// Helper to fetch all pages from a paginated Meta API endpoint
async function fetchAllPages<T>(initialUrl: string): Promise<T[]> {
  const allData: T[] = [];
  let nextUrl: string | undefined = initialUrl;

  while (nextUrl) {
    const currentUrl: string = nextUrl;
    nextUrl = undefined;

    const res: Response = await fetch(currentUrl);
    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[Sync] Paginated fetch failed: ${res.statusText}`, errorText);
      break;
    }

    const json = await res.json();
    if (json.error) {
      console.error(`[Sync] Paginated fetch API error:`, json.error);
      break;
    }

    if (json.data && Array.isArray(json.data)) {
      allData.push(...json.data);
    }

    if (json.paging?.next) {
      nextUrl = json.paging.next as string;
    }
  }

  return allData;
}

// Helper to extract insight metrics and upsert
async function upsertInsight(
  entityId: string,
  entityType: string,
  datePreset: string,
) {
  const insightsResponse = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/${entityId}/insights?fields=spend,impressions,clicks,reach,frequency,ctr,cpc,cpm,actions&date_preset=${datePreset}&access_token=${META_ACCESS_TOKEN}`
  );

  if (!insightsResponse.ok) return;

  const insightsData = await insightsResponse.json();
  const insights: MetaInsightsData[] = insightsData.data || [];

  if (insights.length === 0) return;

  const insight = insights[0];
  const actions = insight.actions || [];
  const leads = actions.find(a => a.action_type === 'lead')?.value || '0';
  const purchases = actions.find(
    a => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase'
  )?.value || '0';

  const spend = parseFloat(insight.spend || '0');
  const leadsCount = parseInt(leads);
  const purchasesCount = parseInt(purchases);

  const dateStart = new Date(insightsData.data[0]?.date_start || new Date());
  const dateStop = new Date(insightsData.data[0]?.date_stop || new Date());

  const metricsPayload = {
    spend,
    impressions: parseInt(insight.impressions || '0'),
    clicks: parseInt(insight.clicks || '0'),
    reach: parseInt(insight.reach || '0'),
    frequency: parseFloat(insight.frequency || '0'),
    ctr: parseFloat(insight.ctr || '0'),
    cpc: parseFloat(insight.cpc || '0'),
    cpm: parseFloat(insight.cpm || '0'),
    leads: leadsCount,
    purchases: purchasesCount,
    costPerLead: leadsCount > 0 ? spend / leadsCount : null,
    costPerPurchase: purchasesCount > 0 ? spend / purchasesCount : null,
  };

  await prisma.metaInsight.upsert({
    where: {
      entityId_entityType_dateStart_dateStop: {
        entityId,
        entityType,
        dateStart,
        dateStop,
      },
    },
    update: metricsPayload,
    create: {
      entityId,
      entityType,
      dateStart,
      dateStop,
      ...metricsPayload,
    },
  });
}

// Helper to run insight fetches in parallel batches
async function fetchInsightsBatch(
  items: Array<{ id: string; effectiveStatus?: string }>,
  entityType: string,
  datePreset: string,
  batchSize: number = 10,
) {
  // Only fetch insights for entities that are actively delivering
  const eligible = items.filter(
    item => ACTIVE_INSIGHT_STATUSES.has(item.effectiveStatus || '')
  );

  console.log(`[Sync] Fetching insights for ${eligible.length}/${items.length} active ${entityType}s`);

  for (let i = 0; i < eligible.length; i += batchSize) {
    const batch = eligible.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map(item =>
        upsertInsight(item.id, entityType, datePreset).catch(err =>
          console.error(`[Sync] Failed insight for ${entityType} ${item.id}:`, err)
        )
      )
    );
  }
}

// Sync a single account: campaigns, ad sets, ads + insights
async function syncAccount(accountId: string, datePreset: string) {
  let adSetsSynced = 0;
  let adsSynced = 0;

  // Campaigns
  const campaigns = await fetchAllPages<MetaCampaign>(
    `https://graph.facebook.com/${META_API_VERSION}/${accountId}/campaigns?fields=id,name,objective,status,effective_status,daily_budget,lifetime_budget,budget_remaining,created_time,start_time,stop_time&access_token=${META_ACCESS_TOKEN}&limit=500`
  );

  console.log(`[Sync] Account ${accountId}: ${campaigns.length} campaigns`);

  for (const campaign of campaigns) {
    await prisma.metaCampaign.upsert({
      where: { campaignId: campaign.id },
      update: {
        name: campaign.name,
        objective: campaign.objective,
        status: campaign.status,
        effectiveStatus: campaign.effective_status,
        dailyBudget: campaign.daily_budget,
        lifetimeBudget: campaign.lifetime_budget,
        budgetRemaining: campaign.budget_remaining,
        createdTime: campaign.created_time ? new Date(campaign.created_time) : null,
        startTime: campaign.start_time ? new Date(campaign.start_time) : null,
        stopTime: campaign.stop_time ? new Date(campaign.stop_time) : null,
        lastSyncedAt: new Date(),
      },
      create: {
        campaignId: campaign.id,
        accountId,
        name: campaign.name,
        objective: campaign.objective,
        status: campaign.status,
        effectiveStatus: campaign.effective_status,
        dailyBudget: campaign.daily_budget,
        lifetimeBudget: campaign.lifetime_budget,
        budgetRemaining: campaign.budget_remaining,
        createdTime: campaign.created_time ? new Date(campaign.created_time) : null,
        startTime: campaign.start_time ? new Date(campaign.start_time) : null,
        stopTime: campaign.stop_time ? new Date(campaign.stop_time) : null,
        lastSyncedAt: new Date(),
      },
    });
  }

  await fetchInsightsBatch(
    campaigns.map(c => ({ id: c.id, effectiveStatus: c.effective_status })),
    'campaign',
    datePreset,
  );

  // Ad sets (account-level to catch Advantage+, ASC, etc.)
  const adSets = await fetchAllPages<MetaAdSet>(
    `https://graph.facebook.com/${META_API_VERSION}/${accountId}/adsets?fields=id,name,campaign_id,status,effective_status,optimization_goal,bid_strategy,daily_budget,lifetime_budget,created_time,start_time,end_time&access_token=${META_ACCESS_TOKEN}&limit=500`
  );

  console.log(`[Sync] Account ${accountId}: ${adSets.length} ad sets`);

  for (const adSet of adSets) {
    await prisma.metaAdSet.upsert({
      where: { adsetId: adSet.id },
      update: {
        name: adSet.name,
        campaignId: adSet.campaign_id || 'unknown',
        accountId,
        status: adSet.status,
        effectiveStatus: adSet.effective_status,
        optimizationGoal: adSet.optimization_goal,
        bidStrategy: adSet.bid_strategy,
        dailyBudget: adSet.daily_budget,
        lifetimeBudget: adSet.lifetime_budget,
        createdTime: adSet.created_time ? new Date(adSet.created_time) : null,
        startTime: adSet.start_time ? new Date(adSet.start_time) : null,
        endTime: adSet.end_time ? new Date(adSet.end_time) : null,
        lastSyncedAt: new Date(),
      },
      create: {
        adsetId: adSet.id,
        campaignId: adSet.campaign_id || 'unknown',
        accountId,
        name: adSet.name,
        status: adSet.status,
        effectiveStatus: adSet.effective_status,
        optimizationGoal: adSet.optimization_goal,
        bidStrategy: adSet.bid_strategy,
        dailyBudget: adSet.daily_budget,
        lifetimeBudget: adSet.lifetime_budget,
        createdTime: adSet.created_time ? new Date(adSet.created_time) : null,
        startTime: adSet.start_time ? new Date(adSet.start_time) : null,
        endTime: adSet.end_time ? new Date(adSet.end_time) : null,
        lastSyncedAt: new Date(),
      },
    });
  }

  adSetsSynced = adSets.length;

  await fetchInsightsBatch(
    adSets.map(a => ({ id: a.id, effectiveStatus: a.effective_status })),
    'adset',
    datePreset,
  );

  // Ads (account-level) — lower limit because creative{} expansion makes payloads large
  const ads = await fetchAllPages<MetaAd>(
    `https://graph.facebook.com/${META_API_VERSION}/${accountId}/ads?fields=id,name,adset_id,campaign_id,status,effective_status,creative{id,title,body,image_url,thumbnail_url},created_time&access_token=${META_ACCESS_TOKEN}&limit=200`
  );

  console.log(`[Sync] Account ${accountId}: ${ads.length} ads`);

  for (const ad of ads) {
    await prisma.metaAd.upsert({
      where: { adId: ad.id },
      update: {
        name: ad.name,
        adsetId: ad.adset_id || 'unknown',
        campaignId: ad.campaign_id || 'unknown',
        accountId,
        status: ad.status,
        effectiveStatus: ad.effective_status,
        creativeId: ad.creative?.id,
        creativeTitle: ad.creative?.title,
        creativeBody: ad.creative?.body,
        creativeImageUrl: ad.creative?.image_url || ad.creative?.thumbnail_url,
        createdTime: ad.created_time ? new Date(ad.created_time) : null,
        lastSyncedAt: new Date(),
      },
      create: {
        adId: ad.id,
        adsetId: ad.adset_id || 'unknown',
        campaignId: ad.campaign_id || 'unknown',
        accountId,
        name: ad.name,
        status: ad.status,
        effectiveStatus: ad.effective_status,
        creativeId: ad.creative?.id,
        creativeTitle: ad.creative?.title,
        creativeBody: ad.creative?.body,
        creativeImageUrl: ad.creative?.image_url || ad.creative?.thumbnail_url,
        createdTime: ad.created_time ? new Date(ad.created_time) : null,
        lastSyncedAt: new Date(),
      },
    });
  }

  adsSynced = ads.length;

  await fetchInsightsBatch(
    ads.map(a => ({ id: a.id, effectiveStatus: a.effective_status })),
    'ad',
    datePreset,
  );

  // Update lastSyncedAt on the account
  await prisma.metaAdAccount.update({
    where: { accountId },
    data: { lastSyncedAt: new Date() },
  });

  return { campaigns: campaigns.length, adSetsSynced, adsSynced };
}

export async function POST(request: Request) {
  try {
    console.log('[Sync] POST request received');
    
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!META_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'Meta API not configured - ACCESS_TOKEN missing' }, { status: 500 });
    }

    const body = await request.json();
    const { datePreset = 'last_7d', accountId } = body;

    // ──────────────────────────────────────────────────
    // Always refresh the accounts list from Meta
    // (lightweight: single API call)
    // ──────────────────────────────────────────────────
    console.log('[Sync] Refreshing accounts list from Meta...');
    const accountsResponse = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/me/adaccounts?fields=id,name,account_status,currency,timezone_name&access_token=${META_ACCESS_TOKEN}`
    );

    if (!accountsResponse.ok) {
      const errorText = await accountsResponse.text();
      throw new Error(`Failed to fetch ad accounts: ${accountsResponse.statusText} - ${errorText}`);
    }

    const accountsData = await accountsResponse.json();
    if (accountsData.error) {
      throw new Error(`Meta API error: ${accountsData.error.message || JSON.stringify(accountsData.error)}`);
    }

    const allAccounts: MetaAccount[] = accountsData.data || [];
    console.log(`[Sync] Found ${allAccounts.length} ad accounts`);

    // Upsert all accounts (quick, no deep sync)
    for (const acct of allAccounts) {
      await prisma.metaAdAccount.upsert({
        where: { accountId: acct.id },
        update: {
          name: acct.name,
          currency: acct.currency,
          timezone: acct.timezone_name,
          accountStatus: acct.account_status,
        },
        create: {
          accountId: acct.id,
          name: acct.name,
          currency: acct.currency,
          timezone: acct.timezone_name,
          accountStatus: acct.account_status,
        },
      });
    }

    // ──────────────────────────────────────────────────
    // If a specific accountId was provided, deep-sync
    // only that account. Otherwise just return the
    // refreshed accounts list.
    // ──────────────────────────────────────────────────
    if (accountId && accountId !== 'all') {
      console.log(`[Sync] Deep-syncing single account: ${accountId}`);
      const result = await syncAccount(accountId, datePreset);

      console.log(`[Sync] Done: ${result.campaigns} campaigns, ${result.adSetsSynced} ad sets, ${result.adsSynced} ads`);

      return NextResponse.json({
        success: true,
        message: `Synced 1 account`,
        accountsSynced: 1,
        campaignsSynced: result.campaigns,
        adSetsSynced: result.adSetsSynced,
        adsSynced: result.adsSynced,
        timestamp: new Date().toISOString(),
      });
    }

    // No specific account: just return refreshed accounts list
    console.log('[Sync] Accounts list refreshed (no deep sync requested)');

    return NextResponse.json({
      success: true,
      message: `Refreshed ${allAccounts.length} accounts`,
      accountsSynced: allAccounts.length,
      accountsOnly: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Sync] Error during sync:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to sync data', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
