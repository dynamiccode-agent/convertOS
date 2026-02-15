import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const campaignName = searchParams.get('campaignName');

    // Get all campaigns
    const campaigns = await prisma.metaCampaign.findMany({
      select: {
        id: true,
        campaignId: true,
        accountId: true,
        name: true,
        status: true,
        effectiveStatus: true,
      },
      orderBy: { name: 'asc' },
    });

    // Get all ad sets
    const adSets = await prisma.metaAdSet.findMany({
      select: {
        id: true,
        adsetId: true,
        campaignId: true,
        accountId: true,
        name: true,
        status: true,
        effectiveStatus: true,
      },
      orderBy: { name: 'asc' },
    });

    // If campaign name provided, filter results
    let filteredCampaign: typeof campaigns[0] | undefined = undefined;
    let filteredAdSets: typeof adSets | undefined = undefined;

    if (campaignName) {
      filteredCampaign = campaigns.find(c => 
        c.name.toLowerCase().includes(campaignName.toLowerCase())
      );

      if (filteredCampaign) {
        const campaign = filteredCampaign; // For TypeScript
        filteredAdSets = adSets.filter(as => as.campaignId === campaign.campaignId);
        
        return NextResponse.json({
          success: true,
          query: { campaignName },
          campaign,
          adSetsForCampaign: filteredAdSets,
          adSetCount: filteredAdSets.length,
          allAdSetsForAccount: adSets.filter(as => as.accountId === campaign.accountId),
        });
      } else {
        return NextResponse.json({
          success: false,
          error: 'Campaign not found',
          availableCampaigns: campaigns.map(c => c.name),
        });
      }
    }

    // Group ad sets by campaign
    const adSetsByCampaign = new Map();
    adSets.forEach(adSet => {
      if (!adSetsByCampaign.has(adSet.campaignId)) {
        adSetsByCampaign.set(adSet.campaignId, []);
      }
      adSetsByCampaign.get(adSet.campaignId).push(adSet);
    });

    // Create campaign summary
    const campaignSummary = campaigns.map(campaign => ({
      ...campaign,
      adSetCount: (adSetsByCampaign.get(campaign.campaignId) || []).length,
      adSets: (adSetsByCampaign.get(campaign.campaignId) || []).map((as: typeof adSets[0]) => ({
        id: as.adsetId,
        name: as.name,
        status: as.effectiveStatus || as.status,
      })),
    }));

    return NextResponse.json({
      success: true,
      summary: {
        totalCampaigns: campaigns.length,
        totalAdSets: adSets.length,
      },
      campaigns: campaignSummary,
    });

  } catch (error: any) {
    console.error('[Debug API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch debug data', details: error.message },
      { status: 500 }
    );
  }
}
