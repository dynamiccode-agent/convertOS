import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    // Build where clause
    const where = accountId && accountId !== 'all' ? { accountId } : {};

    // Fetch campaigns with insights
    const campaigns = await prisma.metaCampaign.findMany({
      where,
      orderBy: { createdTime: 'desc' },
    });

    // Fetch latest insights for each campaign
    const campaignIds = campaigns.map(c => c.campaignId);
    const insights = await prisma.metaInsight.findMany({
      where: {
        entityId: { in: campaignIds },
        entityType: 'campaign',
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

    // Combine campaigns with their insights
    const campaignsWithMetrics = campaigns.map(campaign => ({
      ...campaign,
      metrics: latestInsights.get(campaign.campaignId) || null,
    }));

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
