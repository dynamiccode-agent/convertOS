import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// Hardcoded Deckmasters account ID
const DECKMASTERS_ACCOUNT_ID = 'act_2280056309010044';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { accountId = DECKMASTERS_ACCOUNT_ID, datePreset = 'last_7d' } = await request.json();

    // Validate account
    if (accountId !== DECKMASTERS_ACCOUNT_ID) {
      return NextResponse.json({ error: 'Agent only operates on Deckmasters account' }, { status: 403 });
    }

    // Get agent config
    let config = await prisma.agentConfig.findUnique({
      where: { accountId },
    });

    if (!config) {
      // Create default config
      config = await prisma.agentConfig.create({
        data: {
          accountId,
          highSpendThreshold: 150,
          recentLaunchDays: 7,
          frequencyThreshold: 3.5,
          maxChangesPerBatch: 5,
          allowLearningEdits: false,
        },
      });
    }

    // Fetch campaigns
    const campaigns = await prisma.metaCampaign.findMany({
      where: { accountId },
    });

    // Fetch ad sets
    const adSets = await prisma.metaAdSet.findMany({
      where: { accountId },
    });

    // Fetch ads
    const ads = await prisma.metaAd.findMany({
      where: { accountId },
    });

    // Get recent insights (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const insights = await prisma.metaInsight.findMany({
      where: {
        dateStart: { gte: sevenDaysAgo },
        entityId: { in: ads.map(a => a.adId) },
        entityType: 'ad',
      },
    });

    // Group insights by ad
    const insightsByAd = new Map<string, typeof insights>();
    insights.forEach(insight => {
      if (!insightsByAd.has(insight.entityId)) {
        insightsByAd.set(insight.entityId, []);
      }
      insightsByAd.get(insight.entityId)!.push(insight);
    });

    // Calculate account averages
    const totalSpend = insights.reduce((sum, i) => sum + Number(i.spend || 0), 0);
    const totalLeads = insights.reduce((sum, i) => sum + (i.leads || 0), 0);
    const totalClicks = insights.reduce((sum, i) => sum + (i.clicks || 0), 0);
    const totalImpressions = insights.reduce((sum, i) => sum + (i.impressions || 0), 0);

    const accountAvgCPL = totalLeads > 0 ? totalSpend / totalLeads : 0;
    const accountAvgCTR = totalImpressions > 0 ? totalClicks / totalImpressions : 0;

    console.log(`[Agent] Account averages: CPL $${accountAvgCPL.toFixed(2)}, CTR ${(accountAvgCTR * 100).toFixed(2)}%`);

    // Analyze each ad
    const recommendations: any[] = [];

    for (const ad of ads) {
      const adInsights = insightsByAd.get(ad.adId) || [];
      if (adInsights.length === 0) continue;

      // Aggregate metrics
      const adSpend = adInsights.reduce((sum, i) => sum + Number(i.spend || 0), 0);
      const adLeads = adInsights.reduce((sum, i) => sum + (i.leads || 0), 0);
      const adClicks = adInsights.reduce((sum, i) => sum + (i.clicks || 0), 0);
      const adImpressions = adInsights.reduce((sum, i) => sum + (i.impressions || 0), 0);
      const adFrequency = adInsights.length > 0 
        ? adInsights.reduce((sum, i) => sum + Number(i.frequency || 0), 0) / adInsights.length 
        : 0;

      const adCPL = adLeads > 0 ? adSpend / adLeads : 0;
      const adCTR = adImpressions > 0 ? adClicks / adImpressions : 0;

      // Check if recently launched
      const daysSinceLaunch = ad.createdTime 
        ? (Date.now() - ad.createdTime.getTime()) / (24 * 60 * 60 * 1000)
        : 999;

      const isRecentLaunch = daysSinceLaunch < config.recentLaunchDays;

      // Detect underperforming ads
      const isUnderperforming = 
        (adCPL > accountAvgCPL * 1.3 && accountAvgCPL > 0) ||
        (adCTR < accountAvgCTR * 0.5 && accountAvgCTR > 0);

      // Detect frequency fatigue
      const hasFatigue = adFrequency > config.frequencyThreshold;

      // Detect high spend
      const isHighSpend = adSpend > Number(config.highSpendThreshold);

      // Generate recommendations
      if (hasFatigue && ad.effectiveStatus === 'ACTIVE') {
        const riskLevel = isHighSpend ? 'high' : 'medium';
        recommendations.push({
          id: `pause-${ad.adId}`,
          type: 'pause_ad',
          entity_level: 'ad',
          entity_id: ad.adId,
          reason: `Frequency fatigue detected (${adFrequency.toFixed(2)} > ${config.frequencyThreshold}). ${isHighSpend ? `High spend: $${adSpend.toFixed(2)} last 7d.` : ''} CPL: $${adCPL.toFixed(2)} vs account avg $${accountAvgCPL.toFixed(2)}.`,
          risk_level: riskLevel,
          preview: {
            current_state: `ACTIVE, spend: $${adSpend.toFixed(2)}, CPL: $${adCPL.toFixed(2)}, frequency: ${adFrequency.toFixed(2)}`,
            proposed_state: 'PAUSED (preserve learning data)',
          },
        });
      } else if (isUnderperforming && !isRecentLaunch && ad.effectiveStatus === 'ACTIVE') {
        const riskLevel = isHighSpend ? 'high' : 'low';
        const cplDiff = accountAvgCPL > 0 ? ((adCPL - accountAvgCPL) / accountAvgCPL * 100).toFixed(0) : 0;
        const ctrDiff = accountAvgCTR > 0 ? ((adCTR - accountAvgCTR) / accountAvgCTR * 100).toFixed(0) : 0;

        recommendations.push({
          id: `pause-underperform-${ad.adId}`,
          type: 'pause_ad',
          entity_level: 'ad',
          entity_id: ad.adId,
          reason: `Underperforming: CPL $${adCPL.toFixed(2)} (+${cplDiff}% vs avg), CTR ${(adCTR * 100).toFixed(2)}% (${ctrDiff}% vs avg). ${isHighSpend ? `High spend: $${adSpend.toFixed(2)}.` : ''}`,
          risk_level: riskLevel,
          preview: {
            current_state: `ACTIVE, spend: $${adSpend.toFixed(2)}, CPL: $${adCPL.toFixed(2)}`,
            proposed_state: 'PAUSED',
          },
        });
      }
    }

    // Check for ad sets with only 1 active ad (suggest creating variation)
    for (const adSet of adSets) {
      if (adSet.effectiveStatus !== 'ACTIVE') continue;

      const activeAdsInSet = ads.filter(
        a => a.adsetId === adSet.adsetId && a.effectiveStatus === 'ACTIVE'
      );

      if (activeAdsInSet.length === 1) {
        // Check if ad set has good performance
        const adSetInsights = insights.filter(i => 
          activeAdsInSet.map(a => a.adId).includes(i.entityId)
        );

        const adSetSpend = adSetInsights.reduce((sum, i) => sum + Number(i.spend || 0), 0);
        const adSetLeads = adSetInsights.reduce((sum, i) => sum + (i.leads || 0), 0);
        const adSetCPL = adSetLeads > 0 ? adSetSpend / adSetLeads : 0;

        if (adSetCPL > 0 && adSetCPL < accountAvgCPL * 1.2) {
          // Good performing ad set with only 1 ad - suggest variation
          recommendations.push({
            id: `create-ad-${adSet.adsetId}`,
            type: 'create_ad',
            entity_level: 'ad',
            entity_id: null,
            reason: `Top-performing ad set (CPL $${adSetCPL.toFixed(2)}) has only 1 active ad. Create variation to test creative angle.`,
            risk_level: 'medium',
            preview: {
              current_state: `1 ad in ad set "${adSet.name}"`,
              proposed_state: '2 ads (new creative variation)',
            },
            creative_variations: [
              {
                primary_text: 'Stop overpaying for deck repairs. Get 3 quotes in 60 seconds.',
                headline: 'Compare Deck Pros Near You',
                description: 'Free quotes from verified local contractors.',
                cta: 'GET_QUOTE',
              },
              {
                primary_text: 'Your deck deserves better. Find the perfect contractor today.',
                headline: 'Top-Rated Deck Builders',
                description: 'Trusted by 10,000+ homeowners.',
                cta: 'LEARN_MORE',
              },
              {
                primary_text: 'Ready to upgrade your outdoor space? Start here.',
                headline: 'Deck Repair Made Easy',
                description: 'Compare prices and reviews instantly.',
                cta: 'SIGN_UP',
              },
            ],
          });
        }
      }
    }

    // Generate summary
    const summary = `Deckmasters Analysis (${datePreset}): ${recommendations.length} recommendations generated. Account avg CPL: $${accountAvgCPL.toFixed(2)}, CTR: ${(accountAvgCTR * 100).toFixed(2)}%. ${ads.filter(a => a.effectiveStatus === 'ACTIVE').length} active ads analyzed.`;

    return NextResponse.json({
      analysis_summary: summary,
      recommendations: recommendations.slice(0, config.maxChangesPerBatch),
    });
  } catch (error: any) {
    console.error('[Agent] Analysis error:', error);
    return NextResponse.json(
      { error: 'Analysis failed', details: error.message },
      { status: 500 }
    );
  }
}
