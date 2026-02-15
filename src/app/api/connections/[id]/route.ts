import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

// GET /api/connections/[id]
export async function GET(
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
      include: {
        _count: {
          select: {
            webhookEvents: true,
            leads: true,
            orders: true,
            checkoutEvents: true,
          },
        },
      },
    });

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Don't return connectionSecret in GET (security)
    const { connectionSecret, previousSecret, ...safeConnection } = connection as any;

    return NextResponse.json({ success: true, connection: safeConnection });
  } catch (error: any) {
    console.error('[Connection API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch connection', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/connections/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await prisma.dataSourceConnection.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Connection API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete connection', details: error.message },
      { status: 500 }
    );
  }
}
