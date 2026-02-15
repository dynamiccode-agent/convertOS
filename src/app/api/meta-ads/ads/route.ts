import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const campaignId = searchParams.get('campaignId');
    const adsetId = searchParams.get('adsetId');

    // Build where clause
    const where: any = {};
    if (accountId && accountId !== 'all') {
      where.accountId = accountId;
    }
    if (campaignId) {
      where.campaignId = campaignId;
    }
    if (adsetId) {
      where.adsetId = adsetId;
    }

    // Fetch ads
    const ads = await prisma.metaAd.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    // Get latest insights for each ad
    const adIds = ads.map(ad => ad.adId);
    const insights = await prisma.metaInsight.findMany({
      where: {
        entityId: { in: adIds },
        entityType: 'ad',
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

    // Combine ads with their insights (convert Decimals to numbers)
    const adsWithMetrics = ads.map(ad => {
      const insight = latestInsights.get(ad.adId);
      return {
        id: ad.id,
        adId: ad.adId,
        adsetId: ad.adsetId,
        campaignId: ad.campaignId,
        accountId: ad.accountId,
        name: ad.name,
        status: ad.status,
        effectiveStatus: ad.effectiveStatus,
        creativeId: ad.creativeId,
        creativeTitle: ad.creativeTitle,
        creativeBody: ad.creativeBody,
        creativeImageUrl: ad.creativeImageUrl,
        createdTime: ad.createdTime,
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
      ads: adsWithMetrics,
      count: adsWithMetrics.length,
    });

  } catch (error: any) {
    console.error('[Ads API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ads', details: error.message },
      { status: 500 }
    );
  }
}
