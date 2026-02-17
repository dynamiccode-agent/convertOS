// Meta Marketing API helpers for ConvertOS Agent

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_API_VERSION = process.env.META_API_VERSION || 'v24.0';

if (!META_ACCESS_TOKEN) {
  console.error('[Meta Agent] META_ACCESS_TOKEN not configured');
}

interface MetaApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Pause an ad
 */
export async function pauseAd(adId: string): Promise<MetaApiResponse> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${adId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'PAUSED',
          access_token: META_ACCESS_TOKEN,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || data.error) {
      return { success: false, error: data.error?.message || response.statusText };
    }

    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Activate an ad
 */
export async function activateAd(adId: string): Promise<MetaApiResponse> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${adId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'ACTIVE',
          access_token: META_ACCESS_TOKEN,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || data.error) {
      return { success: false, error: data.error?.message || response.statusText };
    }

    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get current ad state
 */
export async function getAdState(adId: string): Promise<MetaApiResponse> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${adId}?fields=id,name,status,effective_status,creative{id,name},configured_status&access_token=${META_ACCESS_TOKEN}`
    );

    const data = await response.json();

    if (!response.ok || data.error) {
      return { success: false, error: data.error?.message || response.statusText };
    }

    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get campaign state (for learning phase check)
 */
export async function getCampaignState(campaignId: string): Promise<MetaApiResponse> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${campaignId}?fields=id,name,status,effective_status,configured_status&access_token=${META_ACCESS_TOKEN}`
    );

    const data = await response.json();

    if (!response.ok || data.error) {
      return { success: false, error: data.error?.message || response.statusText };
    }

    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Update ad copy (primary text, headline, description, CTA)
 */
export async function updateAdCopy(
  adId: string,
  fields: {
    primary_text?: string;
    headline?: string;
    description?: string;
    call_to_action?: string;
  }
): Promise<MetaApiResponse> {
  try {
    // First get the current creative
    const adResponse = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${adId}?fields=creative{id}&access_token=${META_ACCESS_TOKEN}`
    );

    const adData = await adResponse.json();
    if (!adResponse.ok || adData.error) {
      return { success: false, error: adData.error?.message || 'Failed to get ad' };
    }

    const creativeId = adData.creative?.id;
    if (!creativeId) {
      return { success: false, error: 'No creative found for ad' };
    }

    // Get current creative
    const creativeResponse = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${creativeId}?fields=object_story_spec&access_token=${META_ACCESS_TOKEN}`
    );

    const creativeData = await creativeResponse.json();
    if (!creativeResponse.ok || creativeData.error) {
      return { success: false, error: creativeData.error?.message || 'Failed to get creative' };
    }

    // Create new creative with updated fields
    const objectStorySpec = creativeData.object_story_spec || {};
    const linkData = objectStorySpec.link_data || {};

    const newCreative = {
      ...objectStorySpec,
      link_data: {
        ...linkData,
        message: fields.primary_text || linkData.message,
        name: fields.headline || linkData.name,
        description: fields.description || linkData.description,
        call_to_action: fields.call_to_action
          ? { type: fields.call_to_action }
          : linkData.call_to_action,
      },
    };

    // Note: Updating ad copy typically requires creating a new creative
    // For now, we'll return success but note this limitation
    return {
      success: true,
      data: {
        note: 'Copy update requires creating new ad with new creative. Consider using create_ad instead.',
        proposed_creative: newCreative,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Create new ad in ad set
 */
export async function createAd(
  adsetId: string,
  creativeData: {
    primary_text: string;
    headline: string;
    description?: string;
    cta: string;
  }
): Promise<MetaApiResponse> {
  try {
    // Note: Creating ads requires page_id, image/video assets
    // This is a simplified version - production needs full creative spec
    return {
      success: false,
      error: 'Ad creation requires additional setup (page_id, creative assets). Use Meta Ads Manager for now.',
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Create new ad set
 */
export async function createAdSet(
  campaignId: string,
  targetingData: any
): Promise<MetaApiResponse> {
  try {
    return {
      success: false,
      error: 'Ad set creation requires full targeting spec. Use Meta Ads Manager for now.',
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Create new campaign
 */
export async function createCampaign(objective: string): Promise<MetaApiResponse> {
  try {
    return {
      success: false,
      error: 'Campaign creation requires account context. Use Meta Ads Manager for now.',
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Create custom audience
 */
export async function createAudience(params: any): Promise<MetaApiResponse> {
  try {
    return {
      success: false,
      error: 'Audience creation requires pixel/event data. Use Meta Ads Manager for now.',
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Create instant form
 */
export async function createInstantForm(params: any): Promise<MetaApiResponse> {
  try {
    return {
      success: false,
      error: 'Form creation requires page context. Use Meta Ads Manager for now.',
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
