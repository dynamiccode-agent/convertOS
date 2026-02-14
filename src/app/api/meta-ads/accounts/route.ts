import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_API_VERSION = process.env.META_API_VERSION || 'v24.0';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!META_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'Meta API not configured' }, { status: 500 });
    }

    // Fetch ad accounts from Meta API
    const response = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/me/adaccounts?fields=id,name,account_status,currency,timezone_name&access_token=${META_ACCESS_TOKEN}`,
      { next: { revalidate: 300 } } // Cache for 5 minutes
    );

    if (!response.ok) {
      throw new Error(`Meta API error: ${response.statusText}`);
    }

    const data = await response.json();

    return NextResponse.json({
      accounts: data.data || [],
      success: true
    });
  } catch (error) {
    console.error('Error fetching Meta ad accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ad accounts', success: false },
      { status: 500 }
    );
  }
}
