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
  campaign_id: string; // This should always be present - it's the actual campaign ID from Meta
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

          // Fetch ad sets for this campaign
          try {
            const adSetsResponse = await fetch(
              `https://graph.facebook.com/${META_API_VERSION}/${campaign.id}/adsets?fields=id,name,campaign_id,status,effective_status,optimization_goal,bid_strategy,daily_budget,lifetime_budget,created_time,start_time,end_time&access_token=${META_ACCESS_TOKEN}&limit=500`
            );

            if (adSetsResponse.ok) {
              const adSetsData = await adSetsResponse.json();
              const adSets: MetaAdSet[] = adSetsData.data || [];

              console.log(`[Sync] Campaign ${campaign.id} (${campaign.name}): Found ${adSets.length} ad sets`);
              if (adSets.length > 0) {
                console.log(`[Sync] Campaign ${campaign.id} ad sets:`, adSets.map(as => ({ id: as.id, name: as.name })));
              }

              for (const adSet of adSets) {
                // ALWAYS use parent campaign ID - Meta's campaign_id field is unreliable
                // when fetched via /campaigns/{id}/adsets endpoint
                const adSetCampaignId = campaign.id;
                
                if (adSet.campaign_id && adSet.campaign_id !== campaign.id) {
                  console.log(`[Sync] WARNING: Ad set ${adSet.id} (${adSet.name}) returned campaign_id ${adSet.campaign_id} but parent campaign is ${campaign.id}. Using parent.`);
                }
                
                await prisma.metaAdSet.upsert({
                  where: { adsetId: adSet.id },
                  update: {
                    name: adSet.name,
                    campaignId: adSetCampaignId,
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

                // Fetch insights for ad set
                try {
                  const adSetInsightsResponse = await fetch(
                    `https://graph.facebook.com/${META_API_VERSION}/${adSet.id}/insights?fields=spend,impressions,clicks,reach,frequency,ctr,cpc,cpm,actions&date_preset=${datePreset}&access_token=${META_ACCESS_TOKEN}`
                  );

                  if (adSetInsightsResponse.ok) {
                    const adSetInsightsData = await adSetInsightsResponse.json();
                    const adSetInsights: MetaInsightsData[] = adSetInsightsData.data || [];

                    if (adSetInsights.length > 0) {
                      const insight = adSetInsights[0];
                      const actions = insight.actions || [];
                      const leads = actions.find(a => a.action_type === 'lead')?.value || '0';
                      const purchases = actions.find(a => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase')?.value || '0';

                      const spend = parseFloat(insight.spend || '0');
                      const leadsCount = parseInt(leads);
                      const purchasesCount = parseInt(purchases);

                      await prisma.metaInsight.upsert({
                        where: {
                          entityId_entityType_dateStart_dateStop: {
                            entityId: adSet.id,
                            entityType: 'adset',
                            dateStart: new Date(adSetInsightsData.data[0]?.date_start || new Date()),
                            dateStop: new Date(adSetInsightsData.data[0]?.date_stop || new Date()),
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
                          entityId: adSet.id,
                          entityType: 'adset',
                          dateStart: new Date(adSetInsightsData.data[0]?.date_start || new Date()),
                          dateStop: new Date(adSetInsightsData.data[0]?.date_stop || new Date()),
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
                  console.error(`[Sync] Failed to fetch insights for ad set ${adSet.id}:`, error);
                }

                // Fetch ads for this ad set
                try {
                  const adsResponse = await fetch(
                    `https://graph.facebook.com/${META_API_VERSION}/${adSet.id}/ads?fields=id,name,status,effective_status,creative{id,title,body,image_url,thumbnail_url},created_time&access_token=${META_ACCESS_TOKEN}&limit=500`
                  );

                  if (adsResponse.ok) {
                    const adsData = await adsResponse.json();
                    const ads: MetaAd[] = adsData.data || [];

                    console.log(`[Sync] Ad Set ${adSet.id}: Found ${ads.length} ads`);

                    for (const ad of ads) {
                      await prisma.metaAd.upsert({
                        where: { adId: ad.id },
                        update: {
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
                        create: {
                          adId: ad.id,
                          adsetId: adSet.id,
                          campaignId: campaign.id,
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

                      // Fetch insights for ad
                      try {
                        const adInsightsResponse = await fetch(
                          `https://graph.facebook.com/${META_API_VERSION}/${ad.id}/insights?fields=spend,impressions,clicks,reach,frequency,ctr,cpc,cpm,actions&date_preset=${datePreset}&access_token=${META_ACCESS_TOKEN}`
                        );

                        if (adInsightsResponse.ok) {
                          const adInsightsData = await adInsightsResponse.json();
                          const adInsights: MetaInsightsData[] = adInsightsData.data || [];

                          if (adInsights.length > 0) {
                            const insight = adInsights[0];
                            const actions = insight.actions || [];
                            const leads = actions.find(a => a.action_type === 'lead')?.value || '0';
                            const purchases = actions.find(a => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase')?.value || '0';

                            const spend = parseFloat(insight.spend || '0');
                            const leadsCount = parseInt(leads);
                            const purchasesCount = parseInt(purchases);

                            await prisma.metaInsight.upsert({
                              where: {
                                entityId_entityType_dateStart_dateStop: {
                                  entityId: ad.id,
                                  entityType: 'ad',
                                  dateStart: new Date(adInsightsData.data[0]?.date_start || new Date()),
                                  dateStop: new Date(adInsightsData.data[0]?.date_stop || new Date()),
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
                                entityId: ad.id,
                                entityType: 'ad',
                                dateStart: new Date(adInsightsData.data[0]?.date_start || new Date()),
                                dateStop: new Date(adInsightsData.data[0]?.date_stop || new Date()),
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
                        console.error(`[Sync] Failed to fetch insights for ad ${ad.id}:`, error);
                      }
                    }
                  }
                } catch (error) {
                  console.error(`[Sync] Failed to fetch ads for ad set ${adSet.id}:`, error);
                }
              }
            }
          } catch (error) {
            console.error(`[Sync] Failed to fetch ad sets for campaign ${campaign.id}:`, error);
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
