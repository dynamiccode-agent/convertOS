import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getDateRangeFilter } from '@/lib/dateRangeHelper';

export async function GET(request: Request) {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const dateRange = searchParams.get('dateRange') || 'last_7d';

    // Build where clause
    const where = accountId && accountId !== 'all' ? { accountId } : {};

    // Fetch campaigns
    const campaigns = await prisma.metaCampaign.findMany({
      where,
      orderBy: { createdTime: 'desc' },
    });

    // Get date range filter
    const { start, end } = getDateRangeFilter(dateRange);

    // Fetch insights within date range
    const campaignIds = campaigns.map(c => c.campaignId);
    const insights = await prisma.metaInsight.findMany({
      where: {
        entityId: { in: campaignIds },
        entityType: 'campaign',
        dateStart: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { dateStart: 'desc' },
    });

    // Group insights by entityId and take the latest
    const latestInsights = new Map();
    insights.forEach(insight => {
      if (!latestInsights.has(insight.entityId)) {
        latestInsights.set(insight.entityId, insight);
      }
    });

    // Combine campaigns with their insights (convert Decimals to numbers)
    const campaignsWithMetrics = campaigns.map(campaign => {
      const insight = latestInsights.get(campaign.campaignId);
      return {
        id: campaign.id,
        campaignId: campaign.campaignId,
        accountId: campaign.accountId,
        name: campaign.name,
        objective: campaign.objective,
        status: campaign.status,
        effectiveStatus: campaign.effectiveStatus,
        dailyBudget: campaign.dailyBudget,
        lifetimeBudget: campaign.lifetimeBudget,
        budgetRemaining: campaign.budgetRemaining,
        createdTime: campaign.createdTime,
        startTime: campaign.startTime,
        stopTime: campaign.stopTime,
        metrics: insight ? {
          spend: insight.spend ? Number(insight.spend) : 0,
          impressions: insight.impressions || 0,
          clicks: insight.clicks || 0,
          reach: insight.reach || 0,
          frequency: insight.frequency ? Number(insight.frequency) : 0,
          ctr: insight.ctr ? Number(insight.ctr) : 0,
          cpc: insight.cpc ? Number(insight.cpc) : 0,
          cpm: insight.cpm ? Number(insight.cpm) : 0,
          leads: insight.leads || 0,
          purchases: insight.purchases || 0,
          costPerLead: insight.costPerLead ? Number(insight.costPerLead) : 0,
          costPerPurchase: insight.costPerPurchase ? Number(insight.costPerPurchase) : 0,
        } : null,
      };
    });

    return NextResponse.json({
      success: true,
      campaigns: campaignsWithMetrics,
      count: campaignsWithMetrics.length,
    });
  } catch (error: any) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaigns', details: error.message },
      { status: 500 }
    );
  }
}
