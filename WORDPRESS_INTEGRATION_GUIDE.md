# ConvertOS WordPress Integration - Implementation Guide

Complete guide for the multi-tenant WordPress/WooCommerce/FunnelKit data pipeline.

## 🎯 What's Been Built

### ✅ Backend Infrastructure (COMPLETE)

1. **Database Schema**
   - `Client` - Multi-tenant client management
   - `DataSourceConnection` - Manages WordPress/Meta/Klaviyo connections per client
   - `WebhookEvent` - Raw webhook storage with idempotency
   - `Lead` - Normalized lead data
   - `Order` - Normalized order data (WooCommerce)
   - `CheckoutEvent` - Normalized checkout funnel events (FunnelKit)
   - `Contact` - Unified contacts list with aggregation

2. **API Endpoints**
   - `POST /api/clients` - Create new client
   - `GET /api/clients` - List all clients
   - `POST /api/connections` - Create connection (WordPress/Meta/Klaviyo)
   - `GET /api/connections?clientId=xxx` - List connections for client
   - `GET /api/connections/[id]` - Get connection details + stats
   - `DELETE /api/connections/[id]` - Delete connection
   - `POST /api/connections/[id]/rotate-secret` - Rotate HMAC secret
   - `GET /api/connections/[id]/events` - Get recent webhook events
   - `POST /api/webhooks/wordpress` - Webhook ingestion endpoint

3. **Webhook Ingestion System**
   - HMAC SHA-256 signature validation
   - Idempotency via `event_id` (prevents duplicate processing)
   - Raw payload storage (audit trail)
   - Automatic entity normalization (Lead/Order/CheckoutEvent)
   - Contact aggregation (unified contacts with stats)
   - Error tracking & observability
   - Proper HTTP status codes for retry logic

4. **Security Features**
   - HMAC signature validation (current + previous secret)
   - Secret rotation with 24h grace period
   - Encrypted storage (connection secrets)
   - PII handling compliant
   - No plain-text logging of sensitive data

### 📦 WordPress Plugin (TEMPLATE PROVIDED)

Complete plugin template in `WORDPRESS_PLUGIN.md` includes:
- UTM parameter tracking (persistent across session)
- Form submission hooks (Contact Form 7, Gravity Forms, Elementor)
- WooCommerce order hooks (created, paid, refunded)
- FunnelKit checkout hooks (started, abandoned, completed)
- HMAC signature generation
- Admin settings page
- Event logging system

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      CONVERTOS CLOUD                         │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │   Client   │  │   Client   │  │   Client   │           │
│  │    2EZi    │  │   Other    │  │   Other    │           │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘           │
│        │               │               │                    │
│        └───────────────┴───────────────┘                    │
│                        │                                     │
│        ┌───────────────┴────────────────┐                  │
│        │  DataSourceConnection Table    │                  │
│        │  (clientId scoped)             │                  │
│        └───────────────┬────────────────┘                  │
│                        │                                     │
│        ┌───────────────┴────────────────┐                  │
│        │   Webhook Ingestion Engine     │                  │
│        │   - HMAC validation            │                  │
│        │   - Idempotency check          │                  │
│        │   - Raw storage                │                  │
│        │   - Normalization              │                  │
│        └───────────────┬────────────────┘                  │
│                        │                                     │
│        ┌───────────────┴────────────────┐                  │
│        │     Normalized Storage          │                  │
│        │  - Leads (per client)          │                  │
│        │  - Orders (per client)         │                  │
│        │  - CheckoutEvents (per client)  │                  │
│        │  - Contacts (aggregated)       │                  │
│        └────────────────────────────────┘                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                        ▲
                        │ HTTPS POST with HMAC
                        │
┌───────────────────────┴─────────────────────────────────────┐
│              WORDPRESS SITE (Client's Website)               │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           ConvertOS Connector Plugin                    │ │
│  │                                                          │ │
│  │  ┌─────────────────────────────────────────────────┐  │ │
│  │  │  UTM Tracker                                     │  │ │
│  │  │  - Captures utm_* parameters                     │  │ │
│  │  │  - Stores in session                             │  │ │
│  │  │  - Attaches to orders                            │  │ │
│  │  └─────────────────────────────────────────────────┘  │ │
│  │                                                          │ │
│  │  ┌─────────────────────────────────────────────────┐  │ │
│  │  │  Event Hooks                                     │  │ │
│  │  │  - Form submissions → lead.created               │  │ │
│  │  │  - New orders → order.created                    │  │ │
│  │  │  - Payment complete → order.paid                 │  │ │
│  │  │  - Checkout started → checkout.started           │  │ │
│  │  │  - Cart abandoned → checkout.abandoned           │  │ │
│  │  └─────────────────────────────────────────────────┘  │ │
│  │                                                          │ │
│  │  ┌─────────────────────────────────────────────────┐  │ │
│  │  │  Webhook Sender                                  │  │ │
│  │  │  - Generates HMAC signature                      │  │ │
│  │  │  - Sends POST to ConvertOS                       │  │ │
│  │  │  - Includes Connection-Id header                 │  │ │
│  │  └─────────────────────────────────────────────────┘  │ │
│  │                                                          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  WordPress Core + WooCommerce + FunnelKit                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Setup Guide

### Step 1: Database Migration

Run Prisma migration to create new tables:

```bash
cd /Users/dynamiccode/clawd/convertos
npx prisma migrate dev --name wordpress_integration
```

This will create:
- `Client`
- `DataSourceConnection`
- `WebhookEvent`
- `Lead`
- `Order`
- `CheckoutEvent`
- `Contact`

### Step 2: Create a Client

Use the API or create directly in database:

```bash
curl -X POST https://www.convertos.cloud/api/clients \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "name": "2EZi",
    "domain": "2ezi.com",
    "timezone": "Australia/Brisbane"
  }'
```

Response:
```json
{
  "success": true,
  "client": {
    "id": "clxxx...",
    "name": "2EZi",
    "slug": "2ezi",
    "status": "active"
  }
}
```

### Step 3: Create WordPress Connection

```bash
curl -X POST https://www.convertos.cloud/api/connections \
  -H "Content-Type: application/json" \
  -H "Cookie: your-auth-cookie" \
  -d '{
    "clientId": "clxxx...",
    "type": "wordpress",
    "name": "2EZi WordPress Site",
    "domain": "2ezi.com"
  }'
```

Response:
```json
{
  "success": true,
  "connection": {
    "id": "clyyy...",
    "clientId": "clxxx...",
    "type": "wordpress",
    "name": "2EZi WordPress Site",
    "status": "active",
    "webhookUrl": "https://www.convertos.cloud/api/webhooks/wordpress",
    "connectionId": "wp_abc123def456...",
    "connectionSecret": "secret789xyz..."
  }
}
```

**⚠️ IMPORTANT**: Save the `connectionSecret` - it's only returned once!

### Step 4: Install WordPress Plugin

1. **Build the plugin** from template in `WORDPRESS_PLUGIN.md`
2. **Zip the plugin folder**:
   ```bash
   cd convertos-connector
   zip -r convertos-connector.zip .
   ```
3. **Upload to WordPress**: Plugins → Add New → Upload
4. **Activate** the plugin
5. **Configure** (Settings → ConvertOS):
   - Webhook URL: `https://www.convertos.cloud/api/webhooks/wordpress`
   - Connection ID: `wp_abc123def456...`
   - Connection Secret: `secret789xyz...`
6. **Test Connection**: Click "Send Test Event"

### Step 5: Verify Events

Check recent webhook events:

```bash
curl https://www.convertos.cloud/api/connections/clyyy.../events \
  -H "Cookie: your-auth-cookie"
```

Response:
```json
{
  "success": true,
  "events": [
    {
      "eventId": "uuid-123",
      "eventType": "lead.created",
      "signatureValid": true,
      "processed": true,
      "receivedAt": "2026-02-16T06:00:00Z"
    }
  ]
}
```

---

## 📊 Data Flow Examples

### Example 1: Lead Creation

**Trigger**: User submits Contact Form 7 on WordPress site

**WordPress Plugin**:
1. Captures form data
2. Retrieves UTM parameters from session
3. Generates event payload:
   ```json
   {
     "event_id": "uuid-123",
     "event_type": "lead.created",
     "timestamp": "2026-02-16T06:00:00Z",
     "data": {
       "email": "john@example.com",
       "name": "John Doe",
       "utm_source": "facebook",
       "utm_campaign": "spring_sale",
       "referrer": "https://facebook.com"
     }
   }
   ```
4. Generates HMAC signature: `hash_hmac('sha256', $payload, $secret)`
5. Sends POST to ConvertOS webhook endpoint

**ConvertOS Backend**:
1. Receives webhook
2. Validates HMAC signature
3. Checks idempotency (`event_id` not seen before)
4. Stores raw payload in `WebhookEvent`
5. Creates normalized `Lead` record:
   ```sql
   INSERT INTO Lead (
     clientId, connectionId, email, name,
     utm_source, utm_campaign, referrer, registeredAt
   ) VALUES (...)
   ```
6. Upserts `Contact`:
   ```sql
   INSERT INTO Contact (clientId, email, name, contactType, firstSource)
   VALUES (...)
   ON CONFLICT (clientId, email) DO UPDATE SET
     leadCount = leadCount + 1,
     lastSeen = NOW()
   ```
7. Updates connection: `lastSeenAt = NOW()`
8. Returns `200 OK`

### Example 2: Order Payment

**Trigger**: WooCommerce payment completed

**WordPress Plugin**:
1. `woocommerce_payment_complete` hook fires
2. Retrieves order data
3. Retrieves UTM parameters from order meta
4. Generates `order.paid` event
5. Sends to ConvertOS

**ConvertOS Backend**:
1. Receives webhook
2. Validates & checks idempotency
3. Stores raw payload
4. Creates/updates `Order` record:
   ```sql
   INSERT INTO Order (
     clientId, connectionId, orderId, total, currency,
     customerEmail, utm_source, utm_campaign, paidAt
   ) VALUES (...)
   ON CONFLICT (orderId) DO UPDATE SET
     status = 'paid',
     paidAt = NOW()
   ```
5. Updates `Contact`:
   ```sql
   UPDATE Contact SET
     totalOrders = totalOrders + 1,
     totalSpent = totalSpent + 99.00,
     contactType = 'customer',
     lastSource = 'facebook',
     lastSeen = NOW()
   WHERE clientId = 'clxxx...' AND email = 'john@example.com'
   ```
6. Returns `200 OK`

---

## 🔒 Security Implementation

### HMAC Signature Validation

**WordPress (Sender)**:
```php
$payload = json_encode($event_data);
$signature = hash_hmac('sha256', $payload, $connection_secret);

// Send with headers
headers: {
  'X-ConvertOS-Connection-Id': 'wp_abc123...',
  'X-ConvertOS-Signature': $signature
}
```

**ConvertOS (Receiver)**:
```typescript
const expectedSignature = crypto
  .createHmac('sha256', connection.connectionSecret)
  .update(rawBody)
  .digest('hex');

if (signature === expectedSignature) {
  // Valid
} else if (connection.previousSecret) {
  // Try previous secret (for rotation)
  const previousSignature = crypto
    .createHmac('sha256', connection.previousSecret)
    .update(rawBody)
    .digest('hex');
    
  if (signature === previousSignature) {
    // Valid (using old secret)
  } else {
    // Invalid
  }
}
```

### Secret Rotation

**Initiate rotation**:
```bash
curl -X POST https://www.convertos.cloud/api/connections/clyyy.../rotate-secret \
  -H "Cookie: your-auth-cookie"
```

Response:
```json
{
  "success": true,
  "newSecret": "new-secret-xyz...",
  "message": "Secret rotated. Previous secret valid for 24 hours."
}
```

**Update WordPress**:
1. Go to Settings → ConvertOS
2. Update Connection Secret field
3. Save settings
4. Both old and new secrets valid for 24h
5. After 24h, old secret expires automatically

---

## 📈 Attribution Logic

### Revenue Attribution Example

**Query**:
```sql
SELECT 
  utm_source,
  COUNT(*) as order_count,
  SUM(total) as total_revenue,
  ROUND(SUM(total) * 100.0 / SUM(SUM(total)) OVER(), 2) as revenue_percentage
FROM Order
WHERE clientId = 'clxxx...'
  AND status = 'paid'
  AND paidAt >= NOW() - INTERVAL '30 days'
GROUP BY utm_source
ORDER BY total_revenue DESC;
```

**Result**:
```
| utm_source | order_count | total_revenue | revenue_percentage |
|------------|-------------|---------------|--------------------|
| facebook   | 45          | $12,450.00    | 58.3%             |
| google     | 23          | $5,890.00     | 27.6%             |
| email      | 12          | $2,100.00     | 9.8%              |
| direct     | 8           | $910.00       | 4.3%              |
```

### Attribution Hierarchy

1. **UTM Parameters** (highest priority)
   - `utm_source`, `utm_medium`, `utm_campaign`
2. **FunnelKit Origin** (if available)
   - `origin_source` field from WooCommerce
3. **Click IDs**
   - `fbclid` (Facebook)
   - `gclid` (Google)
4. **Referrer** (fallback)
   - HTTP referrer header
5. **Direct** (no attribution data)

---

## 🎨 Frontend UI (Next Phase)

### Connections Dashboard (To Build)

Located at: `/dashboard/connections`

**Page Structure**:
```tsx
<ConnectionsPage clientId={selectedClient}>
  {/* Meta Ads Card */}
  <ConnectionCard type="meta">
    <Status>Connected</Status>
    <AccountName>2EZi Ad Account</AccountName>
    <LastSync>2 hours ago</LastSync>
    <ReconnectButton />
  </ConnectionCard>

  {/* WordPress Card */}
  <ConnectionCard type="wordpress">
    <Status>Connected</Status>
    <Domain>2ezi.com</Domain>
    <CopyField label="Webhook URL" value="https://..." />
    <CopyField label="Connection ID" value="wp_..." />
    <ShowSecretButton /> {/* Reveals secret on click */}
    <RotateSecretButton />
    <TestConnectionButton />
    
    {/* Recent Events Log */}
    <EventsTable>
      <Event type="lead.created" status="processed" time="2 mins ago" />
      <Event type="order.paid" status="processed" time="5 mins ago" />
      <Event type="checkout.abandoned" status="processed" time="10 mins ago" />
    </EventsTable>
  </ConnectionCard>

  {/* Klaviyo Card (Future) */}
  <ConnectionCard type="klaviyo">
    <Status>Not Connected</Status>
    <ConnectButton />
  </ConnectionCard>
</ConnectionsPage>
```

### Dashboard Data Integration

**Modify existing dashboard to include WordPress data**:

```tsx
// Current: Only Meta Ads
const metaRevenue = await getMetaRevenue(clientId, dateRange);

// New: Combined attribution
const revenue = {
  total: await getTotalRevenue(clientId, dateRange),
  bySource: {
    meta: metaRevenue,
    email: await getEmailRevenue(clientId, dateRange),
    sms: await getSMSRevenue(clientId, dateRange),
    direct: await getDirectRevenue(clientId, dateRange),
  }
};
```

**Attribution Chart Component**:
```tsx
<AttributionChart>
  <PieChart data={[
    { source: 'Meta Ads', value: 58.3, color: '#1877F2' },
    { source: 'Google Ads', value: 27.6, color: '#4285F4' },
    { source: 'Email', value: 9.8, color: '#34A853' },
    { source: 'Direct', value: 4.3, color: '#9AA0A6' },
  ]} />
</AttributionChart>
```

---

## 🧪 Testing Checklist

### Backend Testing

- [ ] Create client via API
- [ ] Create WordPress connection
- [ ] Verify connectionId and secret generated
- [ ] Send test webhook with valid signature
- [ ] Verify webhook stored in `WebhookEvent`
- [ ] Verify Lead/Order/CheckoutEvent created
- [ ] Verify Contact aggregation works
- [ ] Test idempotency (send same event_id twice)
- [ ] Test invalid signature (should reject)
- [ ] Test secret rotation
- [ ] Test webhook with old secret (after rotation)
- [ ] Verify previous secret expires after 24h
- [ ] Query recent events via API
- [ ] Test multiple clients (data isolation)

### WordPress Plugin Testing

- [ ] Install plugin on test site
- [ ] Configure webhook settings
- [ ] Test connection button works
- [ ] Submit Contact Form 7 → verify lead.created sent
- [ ] Create WooCommerce order → verify order.created sent
- [ ] Complete payment → verify order.paid sent
- [ ] Start FunnelKit checkout → verify checkout.started sent
- [ ] Abandon cart → verify checkout.abandoned sent
- [ ] Verify UTM parameters captured
- [ ] Verify UTMs attached to orders
- [ ] Verify fbclid/gclid tracking
- [ ] Check event logs in WordPress
- [ ] Test with multiple form plugins

### Integration Testing

- [ ] Create client "2EZi"
- [ ] Create WordPress connection for 2EZi
- [ ] Install plugin on 2EZi website
- [ ] Configure credentials
- [ ] Send real lead → verify in ConvertOS database
- [ ] Create real order → verify in ConvertOS database
- [ ] Check Contact record created/updated
- [ ] Verify attribution data stored
- [ ] Query revenue by source → verify correct
- [ ] Create another client → verify data isolated

---

## 📝 Next Steps

### Immediate (Required)

1. ✅ **Backend infrastructure** (DONE)
2. ✅ **WordPress plugin template** (DONE)
3. **Run database migration**:
   ```bash
   npx prisma migrate dev --name wordpress_integration
   ```
4. **Deploy backend changes** (already done via git push)
5. **Build WordPress plugin** from template
6. **Test with 2EZi client**

### Short-Term (Frontend UI)

1. **Create Connections page** (`/dashboard/connections`)
2. **Add client selector** to dashboard
3. **Build connection cards** (Meta/WordPress/Klaviyo)
4. **Add copy-to-clipboard** for webhook URL/ID/secret
5. **Add recent events table**
6. **Add test connection button**
7. **Add secret rotation UI**

### Medium-Term (Features)

1. **Attribution dashboard**
   - Revenue by source chart
   - Source comparison over time
   - Campaign performance
2. **Contacts page**
   - List all contacts
   - Filter by type (lead/customer)
   - Show aggregated stats
3. **Klaviyo integration**
   - OAuth flow
   - Email campaign metrics
   - Email attribution
4. **Enhanced analytics**
   - Funnel visualization
   - Cohort analysis
   - LTV by source

### Long-Term (Scale)

1. **Webhook retry logic** (background jobs)
2. **Rate limiting** (per client)
3. **Webhook signing algorithm options** (SHA-512, etc.)
4. **Webhook destination validation** (IP whitelisting)
5. **Event replay** (re-process failed events)
6. **Data export** (CSV, API)
7. **Real-time dashboard updates** (WebSockets)

---

## 🐛 Troubleshooting

### Webhook Not Received

**Check**:
1. WordPress plugin configured correctly?
2. Connection status = "active"?
3. Webhook URL correct?
4. SSL certificate valid?
5. Check WordPress error logs
6. Check ConvertOS API logs

**Debug**:
```bash
# Check recent events
curl https://www.convertos.cloud/api/connections/clyyy.../events

# Check connection status
curl https://www.convertos.cloud/api/connections/clyyy...
```

### Signature Validation Failed

**Check**:
1. Connection secret matches in WordPress settings?
2. Secret recently rotated? (use new secret)
3. Payload encoding correct? (UTF-8, no BOM)
4. Headers sent correctly?

**Debug**:
```php
// In WordPress plugin
error_log('Payload: ' . $payload);
error_log('Signature: ' . $signature);
error_log('Secret: ' . substr($secret, 0, 10) . '...');
```

### Duplicate Events

**Check**:
1. Is `event_id` unique?
2. Is WordPress sending multiple requests?
3. Is retry logic working correctly?

**Fix**:
- Ensure `event_id` is generated with `wp_generate_uuid4()`
- ConvertOS deduplicates automatically via `event_id`

### Data Not Appearing in Dashboard

**Check**:
1. Correct `clientId` used?
2. Events processed successfully? (check `WebhookEvent.processed = true`)
3. Date range filter in dashboard?
4. Any errors in `WebhookEvent.error` field?

**Debug**:
```sql
-- Check raw webhook events
SELECT * FROM WebhookEvent 
WHERE clientId = 'clxxx...'
ORDER BY receivedAt DESC
LIMIT 10;

-- Check processed leads
SELECT * FROM Lead
WHERE clientId = 'clxxx...'
ORDER BY registeredAt DESC
LIMIT 10;

-- Check orders
SELECT * FROM Order
WHERE clientId = 'clxxx...'
ORDER BY orderDate DESC
LIMIT 10;
```

---

## 📖 Reference

### Database Schema Summary

```
Client (id, name, slug, domain, timezone, status)
  ↓ clientId
DataSourceConnection (id, clientId, type, connectionId, connectionSecret, webhookUrl, ...)
  ↓ connectionId
WebhookEvent (id, clientId, connectionId, eventId, eventType, rawPayload, processed)
  ↓ processing
Lead (id, clientId, connectionId, email, name, utm_*, registeredAt)
Order (id, clientId, connectionId, orderId, total, customerEmail, utm_*, paidAt)
CheckoutEvent (id, clientId, connectionId, eventType, funnelId, email, eventDate)
Contact (id, clientId, email, name, totalOrders, totalSpent, contactType)
```

### API Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/clients` | Create new client |
| GET | `/api/clients` | List clients |
| POST | `/api/connections` | Create connection |
| GET | `/api/connections?clientId=xxx` | List connections |
| GET | `/api/connections/[id]` | Get connection details |
| DELETE | `/api/connections/[id]` | Delete connection |
| POST | `/api/connections/[id]/rotate-secret` | Rotate secret |
| GET | `/api/connections/[id]/events` | Get recent events |
| POST | `/api/webhooks/wordpress` | Webhook ingestion |

### Event Types

| Event Type | Trigger | WordPress Hook |
|------------|---------|----------------|
| `lead.created` | Form submission | `wpcf7_mail_sent`, `gform_after_submission`, etc. |
| `order.created` | New order | `woocommerce_new_order` |
| `order.paid` | Payment complete | `woocommerce_payment_complete` |
| `order.refunded` | Refund processed | `woocommerce_order_refunded` |
| `checkout.started` | Checkout page loaded | `wfacp_after_checkout_page_found` |
| `checkout.abandoned` | Cart abandoned | `cartflows_cart_abandoned` |
| `checkout.completed` | Order processed | `wfacp_after_order_processed` |

---

## 📞 Support

For implementation questions or issues:

1. **Review this guide** thoroughly
2. **Check troubleshooting section** above
3. **Review API logs** in Vercel dashboard
4. **Check database** directly via Prisma Studio:
   ```bash
   npx prisma studio
   ```
5. **Discord**: #convert-os channel

---

**Implementation Status**: ✅ Backend Complete | ⏳ Frontend UI Next | ⏳ WordPress Plugin Build

Last Updated: 2026-02-16
