import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_API_VERSION = process.env.META_API_VERSION || 'v24.0';

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

export async function POST(request: Request) {
  try {
    console.log('[Sync] POST request received');
    
    const session = await auth();
    console.log('[Sync] Session check:', session ? 'Authenticated' : 'Not authenticated');
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!META_ACCESS_TOKEN) {
      console.error('[Sync] META_ACCESS_TOKEN not found in environment');
      return NextResponse.json({ error: 'Meta API not configured - ACCESS_TOKEN missing' }, { status: 500 });
    }

    console.log('[Sync] META_ACCESS_TOKEN present:', META_ACCESS_TOKEN.substring(0, 20) + '...');

    const { datePreset = 'last_7d' } = await request.json();

    console.log(`[Sync] Starting sync with date preset: ${datePreset}`);

    // Fetch ad accounts
    console.log('[Sync] Fetching ad accounts from Meta API...');
    const accountsResponse = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/me/adaccounts?fields=id,name,account_status,currency,timezone_name&access_token=${META_ACCESS_TOKEN}`
    );

    console.log('[Sync] Meta API response status:', accountsResponse.status);

    if (!accountsResponse.ok) {
      const errorText = await accountsResponse.text();
      console.error('[Sync] Meta API error response:', errorText);
      throw new Error(`Failed to fetch ad accounts: ${accountsResponse.statusText} - ${errorText}`);
    }

    const accountsData = await accountsResponse.json();
    
    if (accountsData.error) {
      console.error('[Sync] Meta API returned error:', accountsData.error);
      throw new Error(`Meta API error: ${accountsData.error.message || JSON.stringify(accountsData.error)}`);
    }
    
    const accounts: MetaAccount[] = accountsData.data || [];

    console.log(`[Sync] Found ${accounts.length} ad accounts`, accounts.map(a => a.name));

    let totalAdSetsSynced = 0;
    let totalAdsSynced = 0;

    // Sync each account
    for (const account of accounts) {
      const accountId = account.id;

      // Store account in database
      await prisma.metaAdAccount.upsert({
        where: { accountId },
        update: {
          name: account.name,
          currency: account.currency,
          timezone: account.timezone_name,
          accountStatus: account.account_status,
          lastSyncedAt: new Date(),
        },
        create: {
          accountId,
          name: account.name,
          currency: account.currency,
          timezone: account.timezone_name,
          accountStatus: account.account_status,
          lastSyncedAt: new Date(),
        },
      });

      // ──────────────────────────────────────────────────
      // STEP 1: Sync campaigns (account-level)
      // ──────────────────────────────────────────────────
      const campaigns = await fetchAllPages<MetaCampaign>(
        `https://graph.facebook.com/${META_API_VERSION}/${accountId}/campaigns?fields=id,name,objective,status,effective_status,daily_budget,lifetime_budget,budget_remaining,created_time,start_time,stop_time&access_token=${META_ACCESS_TOKEN}&limit=500`
      );

      console.log(`[Sync] Account ${account.name} (${accountId}): ${campaigns.length} campaigns`);

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

        // Campaign insights
        try {
          await upsertInsight(campaign.id, 'campaign', datePreset);
        } catch (error) {
          console.error(`[Sync] Failed to fetch insights for campaign ${campaign.id}:`, error);
        }
      }

      // ──────────────────────────────────────────────────
      // STEP 2: Sync ad sets (account-level fetch)
      // Fetches ALL ad sets including Advantage+, ASC, and
      // other automated campaign types that don't return
      // ad sets via the per-campaign endpoint.
      // ──────────────────────────────────────────────────
      const adSets = await fetchAllPages<MetaAdSet>(
        `https://graph.facebook.com/${META_API_VERSION}/${accountId}/adsets?fields=id,name,campaign_id,status,effective_status,optimization_goal,bid_strategy,daily_budget,lifetime_budget,created_time,start_time,end_time&access_token=${META_ACCESS_TOKEN}&limit=500`
      );

      console.log(`[Sync] Account ${account.name}: ${adSets.length} ad sets (account-level)`);

      for (const adSet of adSets) {
        const adSetCampaignId = adSet.campaign_id || 'unknown';

        await prisma.metaAdSet.upsert({
          where: { adsetId: adSet.id },
          update: {
            name: adSet.name,
            campaignId: adSetCampaignId,
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
            campaignId: adSetCampaignId,
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

        // Ad set insights
        try {
          await upsertInsight(adSet.id, 'adset', datePreset);
        } catch (error) {
          console.error(`[Sync] Failed to fetch insights for ad set ${adSet.id}:`, error);
        }

        totalAdSetsSynced++;
      }

      // ──────────────────────────────────────────────────
      // STEP 3: Sync ads (account-level fetch)
      // Same rationale: account-level catches all ads
      // regardless of campaign type.
      // ──────────────────────────────────────────────────
      const ads = await fetchAllPages<MetaAd>(
        `https://graph.facebook.com/${META_API_VERSION}/${accountId}/ads?fields=id,name,adset_id,campaign_id,status,effective_status,creative{id,title,body,image_url,thumbnail_url},created_time&access_token=${META_ACCESS_TOKEN}&limit=500`
      );

      console.log(`[Sync] Account ${account.name}: ${ads.length} ads (account-level)`);

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

        // Ad insights
        try {
          await upsertInsight(ad.id, 'ad', datePreset);
        } catch (error) {
          console.error(`[Sync] Failed to fetch insights for ad ${ad.id}:`, error);
        }

        totalAdsSynced++;
      }
    }

    console.log(`[Sync] Sync completed: ${accounts.length} accounts, ${totalAdSetsSynced} ad sets, ${totalAdsSynced} ads`);

    return NextResponse.json({
      success: true,
      message: 'Data synced successfully',
      accountsSynced: accounts.length,
      adSetsSynced: totalAdSetsSynced,
      adsSynced: totalAdsSynced,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Sync] Error during sync:', error);
    console.error('[Sync] Error stack:', error.stack);
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
