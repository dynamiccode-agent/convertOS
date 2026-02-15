import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_API_VERSION = process.env.META_API_VERSION || 'v24.0';

export async function GET() {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Test Meta API connection
    const testResults = {
      hasAccessToken: !!META_ACCESS_TOKEN,
      tokenPreview: META_ACCESS_TOKEN ? META_ACCESS_TOKEN.substring(0, 20) + '...' : null,
      apiVersion: META_API_VERSION,
      envVars: {
        META_ACCESS_TOKEN: !!process.env.META_ACCESS_TOKEN,
        META_API_VERSION: !!process.env.META_API_VERSION,
        META_APP_ID: !!process.env.META_APP_ID,
        META_APP_SECRET: !!process.env.META_APP_SECRET,
        DATABASE_URL: !!process.env.DATABASE_URL,
      }
    };

    if (!META_ACCESS_TOKEN) {
      return NextResponse.json({
        success: false,
        error: 'META_ACCESS_TOKEN not configured',
        ...testResults
      });
    }

    // Try to fetch user info from Meta
    const response = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/me?access_token=${META_ACCESS_TOKEN}`
    );

    const data = await response.json();

    if (data.error) {
      return NextResponse.json({
        success: false,
        error: 'Meta API token invalid',
        metaError: data.error,
        ...testResults
      });
    }

    // Try to fetch ad accounts
    const accountsResponse = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/me/adaccounts?fields=id,name&limit=5&access_token=${META_ACCESS_TOKEN}`
    );

    const accountsData = await accountsResponse.json();

    if (accountsData.error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch ad accounts',
        metaError: accountsData.error,
        userData: data,
        ...testResults
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Meta API connection successful',
      userData: data,
      accountsFound: accountsData.data?.length || 0,
      accounts: accountsData.data?.map((a: any) => ({ id: a.id, name: a.name })),
      ...testResults
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
