import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    // Build where clause for campaigns
    const campaignWhere = accountId && accountId !== 'all' ? { accountId } : {};

    // Fetch all campaigns for the account(s)
    const campaigns = await prisma.metaCampaign.findMany({
      where: campaignWhere,
      select: { campaignId: true, accountId: true },
    });

    const campaignIds = campaigns.map(c => c.campaignId);

    // Fetch latest insights
    const insights = await prisma.metaInsight.findMany({
      where: {
        entityId: { in: campaignIds },
        entityType: 'campaign',
      },
      orderBy: { dateStart: 'desc' },
    });

    // Calculate summary metrics
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalLeads = 0;
    let totalPurchases = 0;

    const seenCampaigns = new Set();
    insights.forEach(insight => {
      // Only count the latest insight per campaign
      if (!seenCampaigns.has(insight.entityId)) {
        seenCampaigns.add(insight.entityId);
        totalSpend += Number(insight.spend || 0);
        totalImpressions += insight.impressions || 0;
        totalClicks += insight.clicks || 0;
        totalLeads += insight.leads || 0;
        totalPurchases += insight.purchases || 0;
      }
    });

    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const costPerLead = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const costPerPurchase = totalPurchases > 0 ? totalSpend / totalPurchases : 0;

    return NextResponse.json({
      success: true,
      summary: {
        totalSpend: totalSpend.toFixed(2),
        totalLeads,
        totalPurchases,
        totalCampaigns: campaigns.length,
        avgCTR: avgCTR.toFixed(2),
        costPerLead: costPerLead.toFixed(2),
        costPerPurchase: costPerPurchase.toFixed(2),
        totalImpressions,
        totalClicks,
      },
    });
  } catch (error: any) {
    console.error('Error fetching summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch summary', details: error.message },
      { status: 500 }
    );
  }
}
