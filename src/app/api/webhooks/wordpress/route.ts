import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

// POST /api/webhooks/wordpress
export async function POST(request: NextRequest) {
  let connectionId: string | null = null;
  let eventId: string | null = null;

  try {
    // 1. Extract headers
    const signature = request.headers.get('X-ConvertOS-Signature');
    connectionId = request.headers.get('X-ConvertOS-Connection-Id');

    if (!connectionId || !signature) {
      return NextResponse.json(
        { error: 'Missing required headers' },
        { status: 400 }
      );
    }

    // 2. Get connection and validate it exists
    const connection = await prisma.dataSourceConnection.findUnique({
      where: { connectionId },
      include: { client: true },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Invalid connection ID' },
        { status: 401 }
      );
    }

    if (connection.status !== 'active') {
      return NextResponse.json(
        { error: 'Connection is not active' },
        { status: 403 }
      );
    }

    // 3. Read raw body
    const rawBody = await request.text();
    const payload = JSON.parse(rawBody);

    eventId = payload.event_id;

    if (!eventId) {
      return NextResponse.json(
        { error: 'Missing event_id in payload' },
        { status: 400 }
      );
    }

    // 4. Validate HMAC signature
    const isValid = validateSignature(
      rawBody,
      signature,
      connection.connectionSecret,
      connection.previousSecret
    );

    if (!isValid) {
      await logFailedWebhook(
        connection.clientId,
        connection.id,
        eventId,
        payload,
        signature,
        'Invalid signature'
      );

      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // 5. Check idempotency - has this event_id been processed?
    const existing = await prisma.webhookEvent.findUnique({
      where: { eventId },
    });

    if (existing) {
      // Already processed, return 200 to prevent retries
      return NextResponse.json({
        success: true,
        message: 'Event already processed',
        eventId,
      });
    }

    // 6. Store raw webhook event
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        clientId: connection.clientId,
        connectionId: connection.id,
        eventId,
        eventType: payload.event_type,
        rawPayload: payload,
        signature,
        signatureValid: true,
        processed: false,
      },
    });

    // 7. Process event based on type
    try {
      await processWebhookEvent(webhookEvent.id, connection.clientId, connection.id, payload);

      // Mark as processed
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          processed: true,
          processedAt: new Date(),
        },
      });
    } catch (processingError: any) {
      // Log error but return 200 (already stored, will retry processing internally)
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          error: processingError.message,
          retryCount: { increment: 1 },
        },
      });

      console.error('[Webhook Processing] Error:', processingError);
    }

    // 8. Update connection observability
    await prisma.dataSourceConnection.update({
      where: { id: connection.id },
      data: {
        lastSeenAt: new Date(),
        lastError: null,
        lastErrorAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Event received and processed',
      eventId,
    });
  } catch (error: any) {
    console.error('[Webhook Ingestion] Error:', error);

    // Try to log error if we have connection info
    if (connectionId && eventId) {
      try {
        const connection = await prisma.dataSourceConnection.findUnique({
          where: { connectionId },
        });

        if (connection) {
          await prisma.dataSourceConnection.update({
            where: { id: connection.id },
            data: {
              lastError: error.message,
              lastErrorAt: new Date(),
            },
          });
        }
      } catch (logError) {
        console.error('[Webhook Error Logging] Failed:', logError);
      }
    }

    // Return 500 so WordPress will retry
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// Validate HMAC signature
function validateSignature(
  body: string,
  signature: string,
  secret: string | null,
  previousSecret: string | null
): boolean {
  if (!secret) return false;

  // Try current secret
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  if (signature === expectedSignature) {
    return true;
  }

  // If rotation happened recently, try previous secret
  if (previousSecret) {
    const expectedPreviousSignature = crypto
      .createHmac('sha256', previousSecret)
      .update(body)
      .digest('hex');

    if (signature === expectedPreviousSignature) {
      return true;
    }
  }

  return false;
}

// Log failed webhook attempts
async function logFailedWebhook(
  clientId: string,
  connectionId: string,
  eventId: string,
  payload: any,
  signature: string,
  error: string
) {
  try {
    await prisma.webhookEvent.create({
      data: {
        clientId,
        connectionId,
        eventId,
        eventType: payload.event_type || 'unknown',
        rawPayload: payload,
        signature,
        signatureValid: false,
        processed: false,
        error,
      },
    });
  } catch (logError) {
    console.error('[Failed Webhook Logging] Error:', logError);
  }
}

// Process webhook event and create normalized entities
async function processWebhookEvent(
  webhookEventId: string,
  clientId: string,
  connectionId: string,
  payload: any
) {
  const eventType = payload.event_type;

  switch (eventType) {
    case 'lead.created':
      await processLead(clientId, connectionId, payload.data);
      break;

    case 'order.created':
    case 'order.paid':
    case 'order.completed':
      await processOrder(clientId, connectionId, payload.data, eventType);
      break;

    case 'order.refunded':
      await processRefund(clientId, connectionId, payload.data);
      break;

    case 'checkout.started':
    case 'checkout.abandoned':
    case 'checkout.completed':
      await processCheckoutEvent(clientId, connectionId, payload.data, eventType);
      break;

    default:
      console.warn('[Webhook Processing] Unknown event type:', eventType);
  }
}

// Process lead.created event
async function processLead(clientId: string, connectionId: string, data: any) {
  await prisma.lead.create({
    data: {
      clientId,
      connectionId,
      name: data.name,
      email: data.email,
      phone: data.phone,
      registrationType: data.registration_type,
      formName: data.form_name,
      campaignName: data.campaign_name,
      utmSource: data.utm_source,
      utmMedium: data.utm_medium,
      utmCampaign: data.utm_campaign,
      utmContent: data.utm_content,
      utmTerm: data.utm_term,
      referrer: data.referrer,
      landingPage: data.landing_page,
      fbclid: data.fbclid,
      gclid: data.gclid,
      registeredAt: new Date(data.timestamp),
    },
  });

  // Update or create contact
  await upsertContact(clientId, data.email, {
    name: data.name,
    phone: data.phone,
    firstSource: data.utm_source || 'direct',
    contactType: data.registration_type === 'paid' ? 'paid' : 'lead',
  });
}

// Process order events
async function processOrder(
  clientId: string,
  connectionId: string,
  data: any,
  eventType: string
) {
  const orderData: any = {
    clientId,
    connectionId,
    orderId: data.order_id,
    total: parseFloat(data.total),
    currency: data.currency || 'USD',
    status: eventType === 'order.paid' ? 'paid' : data.status,
    paymentMethod: data.payment_method,
    couponCode: data.coupon_code,
    customerEmail: data.customer_email,
    customerName: data.customer_name,
    customerPhone: data.customer_phone,
    utmSource: data.utm_source,
    utmMedium: data.utm_medium,
    utmCampaign: data.utm_campaign,
    utmContent: data.utm_content,
    utmTerm: data.utm_term,
    referrer: data.referrer,
    fbclid: data.fbclid,
    gclid: data.gclid,
    originSource: data.origin_source,
    funnelId: data.funnel_id,
    checkoutId: data.checkout_id,
    orderDate: new Date(data.timestamp),
  };

  if (eventType === 'order.paid') {
    orderData.paidAt = new Date(data.timestamp);
  }

  await prisma.order.upsert({
    where: { orderId: data.order_id },
    update: orderData,
    create: orderData,
  });

  // Update contact
  await upsertContact(clientId, data.customer_email, {
    name: data.customer_name,
    phone: data.customer_phone,
    contactType: 'customer',
    lastSource: data.utm_source || 'direct',
    totalSpent: parseFloat(data.total),
    totalOrders: 1,
  });
}

// Process refund
async function processRefund(clientId: string, connectionId: string, data: any) {
  await prisma.order.update({
    where: { orderId: data.order_id },
    data: {
      status: 'refunded',
      refundedAt: new Date(data.timestamp),
    },
  });
}

// Process checkout events
async function processCheckoutEvent(
  clientId: string,
  connectionId: string,
  data: any,
  eventType: string
) {
  await prisma.checkoutEvent.create({
    data: {
      clientId,
      connectionId,
      eventType: eventType.replace('checkout.', ''),
      funnelId: data.funnel_id,
      checkoutId: data.checkout_id,
      step: data.step,
      email: data.email,
      phone: data.phone,
      utmSource: data.utm_source,
      utmMedium: data.utm_medium,
      utmCampaign: data.utm_campaign,
      utmContent: data.utm_content,
      utmTerm: data.utm_term,
      referrer: data.referrer,
      eventDate: new Date(data.timestamp),
    },
  });
}

// Upsert contact (unified contacts list)
async function upsertContact(clientId: string, email: string, updates: any) {
  const existing = await prisma.contact.findUnique({
    where: {
      clientId_email: {
        clientId,
        email,
      },
    },
  });

  if (existing) {
    // Update existing
    await prisma.contact.update({
      where: { id: existing.id },
      data: {
        name: updates.name || existing.name,
        phone: updates.phone || existing.phone,
        contactType: updates.contactType || existing.contactType,
        lastSource: updates.lastSource || existing.lastSource,
        totalSpent: existing.totalSpent + (updates.totalSpent || 0),
        totalOrders: existing.totalOrders + (updates.totalOrders || 0),
        leadCount: existing.leadCount + (updates.contactType === 'lead' ? 1 : 0),
        lastSeen: new Date(),
      },
    });
  } else {
    // Create new
    await prisma.contact.create({
      data: {
        clientId,
        email,
        name: updates.name,
        phone: updates.phone,
        contactType: updates.contactType || 'lead',
        firstSource: updates.firstSource || 'direct',
        lastSource: updates.lastSource || updates.firstSource || 'direct',
        totalSpent: updates.totalSpent || 0,
        totalOrders: updates.totalOrders || 0,
        leadCount: updates.contactType === 'lead' ? 1 : 0,
        firstSeen: new Date(),
        lastSeen: new Date(),
      },
    });
  }
}
