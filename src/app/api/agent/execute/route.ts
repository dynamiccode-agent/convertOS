import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  pauseAd,
  activateAd,
  getAdState,
  getCampaignState,
  updateAdCopy,
  createAd,
  createAdSet,
  createCampaign,
  createAudience,
  createInstantForm,
} from '@/lib/metaAgent';

// Hardcoded Deckmasters account ID
const DECKMASTERS_ACCOUNT_ID = 'act_2280056309010044';

const ALLOWED_TYPES = new Set([
  'pause_ad',
  'activate_ad',
  'modify_copy',
  'create_ad',
  'create_adset',
  'create_campaign',
  'create_audience',
  'create_form',
]);

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { accountId = DECKMASTERS_ACCOUNT_ID, recommendations, approvedBy } = await request.json();

    // Validate account
    if (accountId !== DECKMASTERS_ACCOUNT_ID) {
      return NextResponse.json({ error: 'Agent only operates on Deckmasters account' }, { status: 403 });
    }

    if (!approvedBy) {
      return NextResponse.json({ error: 'approvedBy required' }, { status: 400 });
    }

    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      return NextResponse.json({ error: 'recommendations array required' }, { status: 400 });
    }

    // Get agent config
    const config = await prisma.agentConfig.findUnique({
      where: { accountId },
    });

    if (!config) {
      return NextResponse.json({ error: 'Agent config not found' }, { status: 404 });
    }

    // Validate maxChangesPerBatch
    if (recommendations.length > config.maxChangesPerBatch) {
      return NextResponse.json({
        error: `Max ${config.maxChangesPerBatch} changes per batch`,
      }, { status: 400 });
    }

    const results = [];

    for (const rec of recommendations) {
      const { id, type, entity_id, reason, risk_level } = rec;

      // Validate type
      if (!ALLOWED_TYPES.has(type)) {
        results.push({
          recommendation_id: id,
          status: 'failed',
          error: `Invalid type: ${type}`,
        });
        continue;
      }

      // Validate entity_id for operations that require it
      if (!entity_id && ['pause_ad', 'activate_ad', 'modify_copy'].includes(type)) {
        results.push({
          recommendation_id: id,
          status: 'failed',
          error: 'entity_id required',
        });
        continue;
      }

      let beforeState: any = null;
      let afterState: any = null;
      let executionError: string | null = null;
      let executionStatus = 'pending';

      try {
        // Get before state
        if (entity_id) {
          const stateRes = await getAdState(entity_id);
          if (stateRes.success) {
            beforeState = stateRes.data;
          }
        }

        // Check learning phase (if applicable)
        // Simplified check - in production, check campaign's delivery_info.status_reason
        // For now, allow execution since we don't have campaign relations set up

        // Execute based on type
        let metaResponse: any = null;

        switch (type) {
          case 'pause_ad':
            metaResponse = await pauseAd(entity_id!);
            break;

          case 'activate_ad':
            metaResponse = await activateAd(entity_id!);
            break;

          case 'modify_copy':
            metaResponse = await updateAdCopy(entity_id!, rec.creative_data || {});
            break;

          case 'create_ad':
            metaResponse = await createAd(entity_id!, rec.creative_variations?.[0] || {});
            break;

          case 'create_adset':
            metaResponse = await createAdSet(entity_id!, rec.targeting_data || {});
            break;

          case 'create_campaign':
            metaResponse = await createCampaign(rec.objective || 'OUTCOME_LEADS');
            break;

          case 'create_audience':
            metaResponse = await createAudience(rec.audience_params || {});
            break;

          case 'create_form':
            metaResponse = await createInstantForm(rec.form_params || {});
            break;

          default:
            metaResponse = { success: false, error: 'Unsupported type' };
        }

        if (metaResponse.success) {
          executionStatus = 'executed';

          // Get after state
          if (entity_id && ['pause_ad', 'activate_ad'].includes(type)) {
            const afterRes = await getAdState(entity_id);
            if (afterRes.success) {
              afterState = afterRes.data;
            }
          } else {
            afterState = metaResponse.data;
          }

          results.push({
            recommendation_id: id,
            status: 'success',
            entity_id,
            meta_response: metaResponse.data,
          });
        } else {
          executionStatus = 'failed';
          executionError = metaResponse.error || 'Unknown error';

          results.push({
            recommendation_id: id,
            status: 'failed',
            entity_id,
            error: executionError,
          });
        }
      } catch (error: any) {
        executionStatus = 'failed';
        executionError = error.message;

        results.push({
          recommendation_id: id,
          status: 'failed',
          entity_id,
          error: executionError,
        });
      } finally {
        // Log execution to audit table
        await prisma.agentExecution.create({
          data: {
            accountId,
            executionType: type,
            entityLevel: rec.entity_level || 'unknown',
            entityId: entity_id || null,
            beforeState: beforeState,
            afterState: afterState,
            reason,
            riskLevel: risk_level || 'unknown',
            approvedBy,
            approvedAt: new Date(),
            status: executionStatus,
            executedAt: new Date(),
            executionError,
          },
        });
      }
    }

    const executed = results.filter(r => r.status === 'success').length;

    return NextResponse.json({
      success: true,
      executed,
      results,
    });
  } catch (error: any) {
    console.error('[Agent] Execution error:', error);
    return NextResponse.json(
      { error: 'Execution failed', details: error.message },
      { status: 500 }
    );
  }
}
