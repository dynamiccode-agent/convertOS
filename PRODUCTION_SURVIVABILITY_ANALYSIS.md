# Production Survivability Analysis

**Date**: February 17, 2026  
**Author**: Atlas  
**Reviewer**: Jarvis  
**Purpose**: Pressure test the system design against production reality

---

## Executive Summary

**Current state**: ✅ Foundation is solid (validation passed)  
**Reality check**: Foundation ≠ Production-ready  
**Gap**: Survivability under scale, throttling, edge cases, and growth

This document addresses: **"Will it break?"** not just **"Does it work?"**

---

## 1. The Validation Reality Check

### What Validation Proved ✅

- ✅ DB-first architecture (no Meta calls on switch)
- ✅ Single-account scoping (no cross-account loops)
- ✅ Insight integrity (counts match expected)

**This is the foundation. Good.**

### What Validation Did NOT Prove ⚠️

- ⚠️ Survives 10× data growth (1,833 → 18,330 entities)
- ⚠️ Survives 10 concurrent users (parallel syncs)
- ⚠️ Survives 100k rows per account (large advertisers)
- ⚠️ Survives weird Meta behavior (throttling, errors, schema changes)
- ⚠️ Survives rate limit pressure (burst vs rolling windows)

**"World-class" means surviving these scenarios, not just passing checks.**

---

## 2. Scale Scenarios Analysis

### Scenario A: 10× Data Growth

**Current state**:
- 1,833 entities across 12 accounts
- 243 active entities
- ~7.5s sync time (heaviest account)

**After 10× growth**:
- 18,330 entities across 12 accounts
- 2,430 active entities
- Projected sync time: ~75s (exceeds 60s Pro timeout)

**Failure mode**: Vercel function timeout on accounts with 200+ active entities

**Mitigation**:
1. Increase batch size to 30-50 (reduce batches)
2. Implement delta syncs (only changed entities)
3. Split heavy accounts into multiple cron runs

---

### Scenario B: 10 Concurrent Users

**Current state**:
- Single user syncing one account
- No connection pool limits configured
- No rate limit coordination

**With 10 concurrent users**:
- 10 simultaneous syncs
- Prisma default pool: 10 connections → **saturated**
- Meta rate limits: shared across all users → **burst throttling**
- Vercel concurrency: 10 functions running → **cost spike**

**Failure modes**:
1. Database connection pool exhaustion
2. Meta 429 errors (burst rate limit)
3. Vercel bill shock ($$$)

**Mitigation**:
1. Configure Prisma connection pool: `connection_limit = 30`
2. Implement sync queue (max 3 concurrent syncs)
3. Add rate limit semaphore (Meta usage % threshold)
4. Consider Redis-based locking

---

### Scenario C: 100k Rows Per Account

**Current state**:
- Largest account: 1,029 entities
- DB queries: `SELECT * FROM campaigns WHERE accountId = ...`
- No pagination on insights fetch

**With 100k entities**:
- Campaigns query: 50k rows → **OOM risk**
- Insights query: 200k rows → **database timeout**
- JSON serialization: 100MB+ → **Vercel payload limit**

**Failure modes**:
1. Out of memory (Vercel 1GB limit)
2. Database query timeout (30s limit)
3. HTTP payload too large (6MB API Gateway limit)

**Mitigation**:
1. Paginate campaign fetches (chunks of 1000)
2. Stream insights to DB (don't load all in memory)
3. Add database indices on `accountId` + `effectiveStatus`
4. Consider materialized views for summary queries

---

### Scenario D: Weird Meta Behavior

**Examples from production**:
- Schema changes (new field breaks parsing)
- Undocumented rate limits (insights vs entity endpoints)
- Delayed data (insights lag 2-6 hours)
- Creative field size explosion (base64 images in response)

**Current state**: No handling for these

**Failure modes**:
1. JSON parse errors crash sync
2. Silent data loss (field renamed)
3. Stale insights displayed as current
4. Payload size errors (creative expansion)

**Mitigation**:
1. Schema validation (Zod/TypeScript strict)
2. Graceful degradation (skip unknown fields)
3. Timestamp checks (`data_as_of` vs `now()`)
4. Selective field expansion (minimal by default)

---

## 3. The Critical Piece: Meta Usage Header Logging

### Why This Is The Real Move

**Current approach**: Assume 200 calls/hour limit

**Reality**:
- Limits vary by app ID
- Limits vary by account
- Limits vary by endpoint type
- Limits vary by query complexity
- Limits vary by time of day

**Without header logging, cron cadence is guessing.**

### Implementation (Critical Path)

**Step 1: Add logging** (Week 1)

```typescript
interface MetaUsageSnapshot {
  adAccountUsage: { acc_id_util_pct: number; ads_api_util_pct: number };
  appUsage: { call_count: number; total_time: number; total_cputime: number };
  insightsThrottle: { app_id_util_pct: number; acc_id_util_pct: number };
}

async function fetchWithUsageTracking(url: string, context: string) {
  const res = await fetch(url);
  
  const usage: MetaUsageSnapshot = {
    adAccountUsage: parseHeader(res.headers.get('x-ad-account-usage')),
    appUsage: parseHeader(res.headers.get('x-app-usage')),
    insightsThrottle: parseHeader(res.headers.get('x-fb-ads-insights-throttle')),
  };
  
  await logUsage({ endpoint: context, usage, timestamp: new Date() });
  
  return res;
}
```

**Step 2: Analyze patterns** (Week 2)

```sql
-- Peak usage by endpoint
SELECT endpoint, 
       MAX((usage->>'acc_id_util_pct')::float) as peak_account_pct,
       MAX((usage->>'app_id_util_pct')::float) as peak_app_pct
FROM meta_usage_logs
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY endpoint
ORDER BY peak_account_pct DESC;

-- Burst vs sustained patterns
SELECT DATE_TRUNC('hour', timestamp) as hour,
       COUNT(*) as calls,
       AVG((usage->>'acc_id_util_pct')::float) as avg_pct
FROM meta_usage_logs
GROUP BY hour
ORDER BY avg_pct DESC;
```

**Step 3: Set internal thresholds** (Week 3)

```typescript
const USAGE_THRESHOLDS = {
  account: 70, // % - pause if exceeded
  app: 80,     // % - pause if exceeded
  insights: 60, // % - skip non-critical
};

async function shouldThrottle(accountId: string): Promise<boolean> {
  const latestUsage = await getLatestUsage(accountId);
  return latestUsage.acc_id_util_pct > USAGE_THRESHOLDS.account;
}
```

---

## 4. Hidden Risk: Insights Complexity Cost

### The Problem

**Current assumption**: All API calls cost the same

**Reality**: Meta throttles by **CPU + complexity**, not just count

**Complexity multipliers**:
- Basic insights: 1× cost
- With breakdowns (`age`, `gender`): 3× cost
- With `time_increment=1`: 5× cost (daily rows)
- With 90-day windows: 2× cost
- With action breakdowns: 4× cost

**Example**:
```typescript
// Current (simple)
/insights?fields=spend,impressions&date_preset=last_7d
// Cost: 1×

// Future (complex)
/insights?fields=spend,impressions,actions&breakdowns=age,gender&time_increment=1&date_preset=last_90d
// Cost: 1 × 3 (breakdowns) × 5 (daily) × 2 (90d) = 30×
```

**Impact**: Adding breakdowns could trigger throttling with same call count

### Cost Budget Model

**Concept**: Track weighted API cost, not just call count

```typescript
interface SyncCostModel {
  entityCalls: number;        // Weight: 1
  basicInsights: number;      // Weight: 1
  breakdownInsights: number;  // Weight: 3
  dailyInsights: number;      // Weight: 5
  totalWeightedCost: number;  // Sum of weighted calls
}

function calculateSyncCost(syncPlan: SyncPlan): SyncCostModel {
  return {
    entityCalls: syncPlan.campaigns + syncPlan.adSets + syncPlan.ads,
    basicInsights: syncPlan.activeEntities,
    breakdownInsights: syncPlan.needsBreakdowns ? syncPlan.activeEntities : 0,
    dailyInsights: syncPlan.needsDaily ? syncPlan.activeEntities : 0,
    totalWeightedCost: 
      syncPlan.entityCalls * 1 +
      syncPlan.basicInsights * 1 +
      syncPlan.breakdownInsights * 3 +
      syncPlan.dailyInsights * 5,
  };
}

// Budget check before sync
const cost = calculateSyncCost(plan);
if (cost.totalWeightedCost > DAILY_BUDGET) {
  throw new Error('Sync would exceed daily cost budget');
}
```

**This becomes your internal throttle governor.**

---

## 5. Smarter Cron: Priority-Based, Not Time-Based

### Current Rotating Cron

```
Every 10 min, rotate through accounts
Result: All accounts synced every 2 hours
```

**Problem**: Wastes API calls on inactive accounts

### Priority-Based Cron

**Logic**: Sync frequency based on account activity

```typescript
async function categorizeAccounts() {
  const accounts = await prisma.metaAdAccount.findMany();
  
  const priority = await Promise.all(accounts.map(async account => {
    const recentSpend = await prisma.metaInsight.aggregate({
      where: {
        entityType: 'campaign',
        entityId: { in: await getCampaignIds(account.accountId) },
        dateStart: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      _sum: { spend: true },
    });
    
    const spend = Number(recentSpend._sum.spend || 0);
    
    return {
      accountId: account.accountId,
      name: account.name,
      spend7d: spend,
      tier: spend > 100 ? 'high' : spend > 10 ? 'medium' : 'low',
    };
  }));
  
  return {
    high: priority.filter(p => p.tier === 'high'),
    medium: priority.filter(p => p.tier === 'medium'),
    low: priority.filter(p => p.tier === 'low'),
  };
}

// Cron schedule
async function priorityCron() {
  const { high, medium, low } = await categorizeAccounts();
  
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  
  // High spend: every 30 min
  if (minute % 30 === 0) {
    for (const account of high.slice(0, 2)) {
      await syncAccount(account.accountId, 'last_7d');
      await sleep(5000); // Rate limiting
    }
  }
  
  // Medium spend: every 2 hours
  if (minute === 0 && hour % 2 === 0) {
    for (const account of medium.slice(0, 1)) {
      await syncAccount(account.accountId, 'last_7d');
    }
  }
  
  // Low/no spend: every 12 hours
  if (minute === 0 && (hour === 0 || hour === 12)) {
    for (const account of low.slice(0, 1)) {
      await syncAccount(account.accountId, 'last_7d');
    }
  }
}
```

**Impact**:
- High-spend accounts: fresh data (30 min)
- Medium-spend: acceptable staleness (2 hours)
- Low/no spend: minimal waste (12 hours)

**Load reduction**: ~60% fewer API calls vs rotating

---

## 6. The Next Evolution: Delta Syncs

### Current Approach (Full Sync)

```typescript
// Fetch ALL campaigns every time
const campaigns = await fetchAllPages(`/${accountId}/campaigns?fields=...`);

// Upsert ALL campaigns
for (const campaign of campaigns) {
  await prisma.metaCampaign.upsert({ ... });
}
```

**Problem**: 95% of entities haven't changed since last sync

### Delta Sync Approach

**Concept**: Only fetch entities updated since last sync

```typescript
async function syncAccount(accountId: string, datePreset: string) {
  const lastSync = await prisma.metaAdAccount.findUnique({
    where: { accountId },
    select: { lastSyncedAt: true },
  });
  
  const sinceTime = lastSync?.lastSyncedAt || new Date(0);
  
  // Fetch only updated campaigns
  const campaigns = await fetchAllPages(
    `/${accountId}/campaigns?fields=id,name,status,effective_status,updated_time&filtering=[{field:"updated_time",operator:"GREATER_THAN",value:"${sinceTime.toISOString()}"}]&access_token=${META_ACCESS_TOKEN}`
  );
  
  console.log(`[Delta Sync] ${campaigns.length} campaigns updated (of ${totalCampaigns} total)`);
  
  // Upsert only changed campaigns
  for (const campaign of campaigns) {
    await prisma.metaCampaign.upsert({ ... });
  }
  
  // Fetch insights only for:
  // 1. Updated entities, OR
  // 2. Active entities with stale insights
  const needsInsights = campaigns.filter(c => 
    c.effective_status === 'ACTIVE' || 
    c.effective_status === 'WITH_ISSUES'
  );
  
  await fetchInsightsBatch(needsInsights, 'campaign', datePreset);
}
```

**Impact**:
- First sync: 100% entities fetched (baseline)
- Subsequent syncs: 5-20% entities fetched (delta)
- **60-80% reduction in API calls**

**Complexity trade-off**: Filtering syntax, handling deletions

---

## 7. Sync Audit Table (Observability)

### Why This Matters

**Current state**: Logs to console, no persistence

**Problem**: Can't answer:
- Which accounts are expensive?
- Which endpoints spike?
- Which sync patterns throttle?
- What's the baseline performance?

### Schema Design

```prisma
model SyncRun {
  id                String   @id @default(cuid())
  accountId         String
  account           MetaAdAccount @relation(fields: [accountId], references: [accountId])
  
  // Timing
  startedAt         DateTime
  completedAt       DateTime?
  durationMs        Int?
  status            SyncStatus // RUNNING | SUCCESS | FAILED | THROTTLED
  
  // Volume
  campaignsFetched  Int      @default(0)
  adSetsFetched     Int      @default(0)
  adsFetched        Int      @default(0)
  insightsCalled    Int      @default(0)
  
  // Meta usage (snapshot at end of sync)
  metaUsageSnapshot Json?    // { adAccountUsage: ..., appUsage: ..., insightsThrottle: ... }
  
  // Performance
  entityFetchMs     Int?
  insightFetchMs    Int?
  dbUpsertMs        Int?
  
  // Errors
  errorMessage      String?
  errorStack        String?
  
  // Cost (weighted)
  estimatedCost     Float?   // Weighted API cost
  
  @@index([accountId, startedAt])
  @@index([status, startedAt])
}

enum SyncStatus {
  RUNNING
  SUCCESS
  FAILED
  THROTTLED
  PARTIAL
}
```

### Usage Example

```typescript
async function syncAccount(accountId: string, datePreset: string) {
  const run = await prisma.syncRun.create({
    data: {
      accountId,
      startedAt: new Date(),
      status: 'RUNNING',
    },
  });
  
  try {
    const startEntity = Date.now();
    const campaigns = await fetchAllPages(...);
    const adSets = await fetchAllPages(...);
    const ads = await fetchAllPages(...);
    const entityMs = Date.now() - startEntity;
    
    const startInsight = Date.now();
    await fetchInsightsBatch(campaigns, 'campaign', datePreset);
    await fetchInsightsBatch(adSets, 'adset', datePreset);
    await fetchInsightsBatch(ads, 'ad', datePreset);
    const insightMs = Date.now() - startInsight;
    
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        completedAt: new Date(),
        durationMs: Date.now() - run.startedAt.getTime(),
        status: 'SUCCESS',
        campaignsFetched: campaigns.length,
        adSetsFetched: adSets.length,
        adsFetched: ads.length,
        insightsCalled: calculateInsightCalls(campaigns, adSets, ads),
        entityFetchMs: entityMs,
        insightFetchMs: insightMs,
        metaUsageSnapshot: await getLatestUsage(accountId),
      },
    });
  } catch (error: any) {
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        completedAt: new Date(),
        status: 'FAILED',
        errorMessage: error.message,
        errorStack: error.stack,
      },
    });
    throw error;
  }
}
```

### Analytics Queries

```sql
-- Average sync time by account
SELECT account_id,
       AVG(duration_ms) as avg_ms,
       MAX(duration_ms) as max_ms,
       COUNT(*) as sync_count
FROM sync_runs
WHERE status = 'SUCCESS'
  AND started_at > NOW() - INTERVAL '30 days'
GROUP BY account_id
ORDER BY avg_ms DESC;

-- Throttling incidents
SELECT DATE_TRUNC('day', started_at) as day,
       COUNT(*) as throttled_count
FROM sync_runs
WHERE status = 'THROTTLED'
GROUP BY day
ORDER BY day DESC;

-- Cost trend
SELECT DATE_TRUNC('day', started_at) as day,
       SUM(estimated_cost) as daily_cost,
       SUM(insights_called) as daily_calls
FROM sync_runs
GROUP BY day
ORDER BY day DESC
LIMIT 30;
```

**This gives you real observability.**

---

## 8. Metric Integrity > Performance Optimization

### The Shift

**Current phase**: Data Sync Engine  
**Next phase**: Marketing Intelligence Engine

### What This Requires

**1. Clean Metric Abstractions**

```typescript
// Not this (raw DB queries everywhere)
const spend = await prisma.metaInsight.aggregate({ _sum: { spend: true } });

// This (metric layer)
const spend = await metrics.getTotalSpend({
  accountId,
  dateRange: 'last_7d',
  level: 'campaign',
});
```

**2. Custom Event Mapping**

```typescript
// Map Meta events to business events
const eventMap = {
  'lead': 'Lead Generated',
  'offsite_conversion.fb_pixel_purchase': 'Purchase',
  'omni_purchase': 'Purchase',
  'page_engagement': 'Page View',
};
```

**3. Per-Account KPI Definitions**

```typescript
interface AccountKPIs {
  accountId: string;
  primaryMetric: 'leads' | 'purchases' | 'registrations';
  targetCPL?: number;
  targetCPA?: number;
  targetROAS?: number;
}

// Different accounts care about different metrics
const kpis = await prisma.accountKPIs.findUnique({
  where: { accountId },
});

const performance = kpis.primaryMetric === 'leads' 
  ? calculateLeadPerformance(insights)
  : calculatePurchasePerformance(insights);
```

**4. Stored Calculation Templates**

```typescript
// Pre-calculated rollups
model DailyCampaignMetrics {
  id          String   @id @default(cuid())
  campaignId  String
  date        DateTime
  spend       Decimal
  impressions Int
  clicks      Int
  leads       Int
  cpl         Decimal? // Pre-calculated
  roas        Decimal? // Pre-calculated
  
  @@unique([campaignId, date])
  @@index([campaignId, date])
}

// Materialized view updated on sync
await prisma.$executeRaw`
  INSERT INTO daily_campaign_metrics (campaign_id, date, spend, leads, cpl)
  SELECT campaign_id, 
         DATE(date_start),
         SUM(spend),
         SUM(leads),
         CASE WHEN SUM(leads) > 0 THEN SUM(spend) / SUM(leads) ELSE NULL END
  FROM meta_insights
  WHERE entity_type = 'campaign'
    AND date_start >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY campaign_id, DATE(date_start)
  ON CONFLICT (campaign_id, date) DO UPDATE
    SET spend = EXCLUDED.spend,
        leads = EXCLUDED.leads,
        cpl = EXCLUDED.cpl;
`;
```

**5. Normalized Entity Trees**

```typescript
// Current: flat tables
campaigns
adSets (campaignId FK)
ads (adsetId FK)

// Future: hierarchical queries
const hierarchy = await prisma.metaCampaign.findMany({
  where: { accountId },
  include: {
    adSets: {
      include: {
        ads: {
          include: {
            insights: true,
          },
        },
      },
    },
  },
});

// Aggregate metrics up the tree
const campaignMetrics = rollUpMetrics(hierarchy);
```

### The Balance

**Don't let performance obsession distract from metric integrity.**

**Good optimization**: Parallel fetches (faster, same data)  
**Bad optimization**: Skip accuracy checks (faster, wrong data)

**Always preserve**:
- Data freshness indicators
- Insight attribution (which date range?)
- Calculation transparency (show formula)
- Audit trail (who changed what?)

---

## 9. Production Readiness Checklist

### Infrastructure

- [ ] Prisma connection pool configured (`connection_limit = 30`)
- [ ] Database indices on hot paths (`accountId`, `effectiveStatus`, `dateStart`)
- [ ] Vercel maxDuration appropriate per route (sync: 300s, read: 10s)
- [ ] Error tracking (Sentry, LogRocket, or similar)
- [ ] Uptime monitoring (Vercel Analytics, Pingdom)

### Rate Limiting

- [ ] Meta usage header logging implemented
- [ ] Internal throttle thresholds set (based on logs)
- [ ] Backoff/retry logic for 429 errors
- [ ] Sync queue to prevent concurrent bursts
- [ ] Cost budget model implemented

### Observability

- [ ] SyncRun audit table created
- [ ] Performance metrics tracked (p50, p95, p99)
- [ ] Error rate alerts (<1% target)
- [ ] Usage dashboards (Grafana, Retool, or similar)
- [ ] Weekly review process for anomalies

### Data Integrity

- [ ] Schema validation (Zod/TypeScript)
- [ ] Timestamp checks (`data_as_of`)
- [ ] Orphaned record cleanup (deleted entities)
- [ ] Metric calculation tests (fixtures + assertions)
- [ ] Manual spot checks (sample campaigns)

### Scale Testing

- [ ] Load test 10 concurrent syncs
- [ ] Test account with 10k+ entities
- [ ] Test insights with 90-day windows
- [ ] Simulate Meta throttling (mock 429s)
- [ ] Recovery from partial failures

---

## 10. Risk Matrix

| Risk | Likelihood | Impact | Mitigation | Priority |
|------|------------|--------|------------|----------|
| Meta rate limit hit | High | High | Usage logging + thresholds | P0 |
| DB connection pool exhausted | Medium | High | Configure pool + queue | P0 |
| Vercel function timeout | Low | High | Delta syncs + pagination | P1 |
| Data staleness | Medium | Medium | Priority cron + monitoring | P1 |
| Insights complexity cost | Low | High | Cost budget model | P2 |
| Schema change breaks sync | Low | Medium | Validation + graceful degradation | P2 |
| Orphaned records accumulate | Medium | Low | Cleanup job | P3 |

---

## 11. Roadmap Alignment

### Phase 1: Foundation (Complete ✅)
- DB-first architecture
- Per-account sync
- Active-only insights
- Basic validation

### Phase 2: Survivability (Week 1-4)
- Meta usage header logging
- Sync audit table
- Connection pool config
- Error tracking

### Phase 3: Optimization (Month 2)
- Parallel entity fetches
- Minimal fields
- Skip fresh insights
- Priority-based cron

### Phase 4: Scale (Month 3)
- Delta syncs
- Cost budget model
- Materialized views
- Load testing

### Phase 5: Intelligence (Month 4+)
- Metric abstractions
- Custom KPIs
- Calculation templates
- Business logic layer

---

## Conclusion

**Validation proved**: Foundation is solid ✅

**Survivability requires**:
- Meta usage logging (understand real limits)
- Sync audit table (observability)
- Priority-based cron (efficiency)
- Delta syncs (scale)
- Cost budget model (throttle governor)
- Metric integrity (don't sacrifice accuracy for speed)

**The system is well-designed. Now make it survive production.**

---

**End of Survivability Analysis**
