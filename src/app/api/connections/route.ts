import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

// GET /api/connections?clientId=xxx
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ error: 'clientId required' }, { status: 400 });
    }

    const connections = await prisma.dataSourceConnection.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        name: true,
        status: true,
        webhookUrl: true,
        connectionId: true,
        domain: true,
        metaAccountId: true,
        lastSeenAt: true,
        lastSyncAt: true,
        lastError: true,
        lastErrorAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, connections });
  } catch (error: any) {
    console.error('[Connections API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch connections', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/connections - Create new connection
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { clientId, type, name, domain } = body;

    if (!clientId || !type || !name) {
      return NextResponse.json(
        { error: 'clientId, type, and name are required' },
        { status: 400 }
      );
    }

    // For WordPress connections, generate credentials
    if (type === 'wordpress') {
      const connectionId = `wp_${crypto.randomBytes(16).toString('hex')}`;
      const connectionSecret = crypto.randomBytes(32).toString('hex');
      const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.convertos.cloud'}/api/webhooks/wordpress`;

      const connection = await prisma.dataSourceConnection.create({
        data: {
          clientId,
          type,
          name,
          status: 'active',
          webhookUrl,
          connectionId,
          connectionSecret,
          domain,
        },
      });

      return NextResponse.json({
        success: true,
        connection: {
          ...connection,
          // Include secret only on creation
          connectionSecret,
        },
      });
    }

    // For other connection types (Meta, Klaviyo), create placeholder
    const connection = await prisma.dataSourceConnection.create({
      data: {
        clientId,
        type,
        name,
        status: 'disconnected',
        domain,
      },
    });

    return NextResponse.json({ success: true, connection });
  } catch (error: any) {
    console.error('[Connections API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create connection', details: error.message },
      { status: 500 }
    );
  }
}
