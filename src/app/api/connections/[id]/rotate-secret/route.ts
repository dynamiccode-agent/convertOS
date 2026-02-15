import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

// POST /api/connections/[id]/rotate-secret
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const connection = await prisma.dataSourceConnection.findUnique({
      where: { id },
    });

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    if (connection.type !== 'wordpress') {
      return NextResponse.json(
        { error: 'Secret rotation only supported for WordPress connections' },
        { status: 400 }
      );
    }

    // Generate new secret, move current to previousSecret
    const newSecret = crypto.randomBytes(32).toString('hex');

    const updated = await prisma.dataSourceConnection.update({
      where: { id },
      data: {
        previousSecret: connection.connectionSecret, // Keep old secret valid for 24h
        connectionSecret: newSecret,
        secretRotatedAt: new Date(),
      },
    });

    // Schedule cleanup of previousSecret after 24 hours
    // (In production, use a cron job or background worker)
    setTimeout(async () => {
      try {
        await prisma.dataSourceConnection.update({
          where: { id },
          data: { previousSecret: null },
        });
      } catch (error) {
        console.error('[Secret Rotation] Failed to cleanup previous secret:', error);
      }
    }, 24 * 60 * 60 * 1000);

    return NextResponse.json({
      success: true,
      newSecret,
      message: 'Secret rotated. Previous secret valid for 24 hours.',
    });
  } catch (error: any) {
    console.error('[Secret Rotation API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to rotate secret', details: error.message },
      { status: 500 }
    );
  }
}
