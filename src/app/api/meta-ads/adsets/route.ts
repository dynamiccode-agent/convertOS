import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const campaignId = searchParams.get('campaignId');

    // Build where clause
    const where: any = {};
    if (accountId && accountId !== 'all') {
      where.accountId = accountId;
    }
    if (campaignId) {
      where.campaignId = campaignId;
    }

    // Fetch ad sets
    const adSets = await prisma.metaAdSet.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    // Get latest insights for each ad set
    const adSetIds = adSets.map(as => as.adsetId);
    const insights = await prisma.metaInsight.findMany({
      where: {
        entityId: { in: adSetIds },
        entityType: 'adset',
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

    // Combine ad sets with their insights (convert Decimals to numbers)
    const adSetsWithMetrics = adSets.map(adSet => {
      const insight = latestInsights.get(adSet.adsetId);
      return {
        id: adSet.id,
        adsetId: adSet.adsetId,
        campaignId: adSet.campaignId,
        accountId: adSet.accountId,
        name: adSet.name,
        status: adSet.status,
        effectiveStatus: adSet.effectiveStatus,
        optimizationGoal: adSet.optimizationGoal,
        bidStrategy: adSet.bidStrategy,
        dailyBudget: adSet.dailyBudget,
        lifetimeBudget: adSet.lifetimeBudget,
        createdTime: adSet.createdTime,
        startTime: adSet.startTime,
        endTime: adSet.endTime,
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
      adSets: adSetsWithMetrics,
      count: adSetsWithMetrics.length,
    });

  } catch (error: any) {
    console.error('[AdSets API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ad sets', details: error.message },
      { status: 500 }
    );
  }
}
