import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET /api/connections/[id]/events - Get recent webhook events for a connection
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
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const events = await prisma.webhookEvent.findMany({
      where: { connectionId: id },
      orderBy: { receivedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        eventId: true,
        eventType: true,
        signatureValid: true,
        processed: true,
        processedAt: true,
        error: true,
        retryCount: true,
        receivedAt: true,
      },
    });

    return NextResponse.json({ success: true, events });
  } catch (error: any) {
    console.error('[Connection Events API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch events', details: error.message },
      { status: 500 }
    );
  }
}
