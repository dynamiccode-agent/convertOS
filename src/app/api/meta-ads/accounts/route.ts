import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch ad accounts from database
    const accounts = await prisma.metaAdAccount.findMany({
      select: {
        id: true,
        accountId: true,
        name: true,
        accountStatus: true,
        currency: true,
      },
      orderBy: { name: 'asc' },
    });

    // Format for frontend
    const formattedAccounts = accounts.map(account => ({
      id: account.accountId,
      name: account.name,
      account_status: account.accountStatus,
      currency: account.currency,
    }));

    return NextResponse.json({
      accounts: formattedAccounts,
      success: true
    });
  } catch (error: any) {
    console.error('Error fetching ad accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ad accounts', details: error.message, success: false },
      { status: 500 }
    );
  }
}
