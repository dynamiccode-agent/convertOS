import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

// POST /api/connections/[id]/test - Send test ping event
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
        { error: 'Test endpoint only supported for WordPress connections' },
        { status: 400 }
      );
    }

    if (!connection.webhookUrl || !connection.connectionId || !connection.connectionSecret) {
      return NextResponse.json(
        { error: 'Connection not fully configured' },
        { status: 400 }
      );
    }

    // Generate test ping event
    const eventId = crypto.randomUUID();
    const testPayload = {
      event_id: eventId,
      event_type: 'test.ping',
      timestamp: new Date().toISOString(),
      data: {
        message: 'Test ping from ConvertOS dashboard',
        test: true,
      },
    };

    const payloadJson = JSON.stringify(testPayload);
    const payloadBuffer = Buffer.from(payloadJson, 'utf8');

    // Generate HMAC signature using raw bytes
    const signature = crypto
      .createHmac('sha256', connection.connectionSecret)
      .update(payloadBuffer) // Use Buffer for consistency with webhook handler
      .digest('hex');

    // Send to our own webhook endpoint
    const response = await fetch(connection.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ConvertOS-Connection-Id': connection.connectionId,
        'X-ConvertOS-Signature': signature,
      },
      body: payloadJson,
    });

    const responseBody = await response.text();
    let responseJson: any;
    try {
      responseJson = JSON.parse(responseBody);
    } catch {
      responseJson = { raw: responseBody };
    }

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: 'Test ping sent and received successfully',
        eventId,
        response: responseJson,
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Test ping sent but webhook returned error',
        eventId,
        status: response.status,
        response: responseJson,
      }, { status: 200 }); // Return 200 even on test failure so UI can display error
    }
  } catch (error: any) {
    console.error('[Connection Test] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send test ping', details: error.message },
      { status: 500 }
    );
  }
}
