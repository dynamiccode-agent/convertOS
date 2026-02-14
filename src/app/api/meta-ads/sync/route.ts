import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
  campaign_id?: string;
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

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!META_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'Meta API not configured' }, { status: 500 });
    }

    const { datePreset = 'last_7d' } = await request.json();

    console.log(`[Sync] Starting sync with date preset: ${datePreset}`);

    // Fetch ad accounts
    const accountsResponse = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/me/adaccounts?fields=id,name,account_status,currency,timezone_name&access_token=${META_ACCESS_TOKEN}`
    );

    if (!accountsResponse.ok) {
      throw new Error(`Failed to fetch ad accounts: ${accountsResponse.statusText}`);
    }

    const accountsData = await accountsResponse.json();
    const accounts: MetaAccount[] = accountsData.data || [];

    console.log(`[Sync] Found ${accounts.length} ad accounts`);

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

      // Fetch campaigns for this account
      const campaignsResponse = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/${accountId}/campaigns?fields=id,name,objective,status,effective_status,daily_budget,lifetime_budget,budget_remaining,created_time,start_time,stop_time&access_token=${META_ACCESS_TOKEN}&limit=500`
      );

      if (campaignsResponse.ok) {
        const campaignsData = await campaignsResponse.json();
        const campaigns: MetaCampaign[] = campaignsData.data || [];

        console.log(`[Sync] Account ${accountId}: Found ${campaigns.length} campaigns`);

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

          // Fetch insights for campaign
          try {
            const insightsResponse = await fetch(
              `https://graph.facebook.com/${META_API_VERSION}/${campaign.id}/insights?fields=spend,impressions,clicks,reach,frequency,ctr,cpc,cpm,actions&date_preset=${datePreset}&access_token=${META_ACCESS_TOKEN}`
            );

            if (insightsResponse.ok) {
              const insightsData = await insightsResponse.json();
              const insights: MetaInsightsData[] = insightsData.data || [];

              if (insights.length > 0) {
                const insight = insights[0];
                const actions = insight.actions || [];
                const leads = actions.find(a => a.action_type === 'lead')?.value || '0';
                const purchases = actions.find(a => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase')?.value || '0';

                const spend = parseFloat(insight.spend || '0');
                const leadsCount = parseInt(leads);
                const purchasesCount = parseInt(purchases);

                await prisma.metaInsight.upsert({
                  where: {
                    entityId_entityType_dateStart_dateStop: {
                      entityId: campaign.id,
                      entityType: 'campaign',
                      dateStart: new Date(insightsData.data[0]?.date_start || new Date()),
                      dateStop: new Date(insightsData.data[0]?.date_stop || new Date()),
                    },
                  },
                  update: {
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
                  },
                  create: {
                    entityId: campaign.id,
                    entityType: 'campaign',
                    dateStart: new Date(insightsData.data[0]?.date_start || new Date()),
                    dateStop: new Date(insightsData.data[0]?.date_stop || new Date()),
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
                  },
                });
              }
            }
          } catch (error) {
            console.error(`[Sync] Failed to fetch insights for campaign ${campaign.id}:`, error);
          }
        }
      }
    }

    console.log(`[Sync] Sync completed successfully`);

    return NextResponse.json({
      success: true,
      message: 'Data synced successfully',
      accountsSynced: accounts.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Sync] Error during sync:', error);
    return NextResponse.json(
      { error: 'Failed to sync data', details: error.message },
      { status: 500 }
    );
  }
}
