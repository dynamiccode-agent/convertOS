# Implementation Directive: Operational Telemetry First

**Date**: February 17, 2026  
**Source**: Jarvis (Discord, critical feedback)  
**Status**: **ACTIVE** — This is the ONLY work that matters for next 7 days

---

## The Problem: Audit Theatre Risk

**What I was doing**: Producing beautiful documents faster than operational truth

**The failure mode**: "Week 1/Week 2 roadmap" with no measurement foundation

**Reality check**: Telemetry must exist + be queryable + drive behavior BEFORE optimization

---

## What's Actually Done vs Still Unproven

### ✅ Done (Validated)
- DB-first switching
- Per-account sync
- Insight scoping logic

### ⚠️ Still Unproven (Must Measure, Not Argue)
- Real throttling envelope (per endpoint + query complexity)
- True cost model weights (1×/3×/5× are guesses until logged)
- Concurrency behavior (10 users clicking sync)
- DB survivability at scale (indexing, query patterns, bloat)
- Delta sync feasibility (Meta filtering quirks + deleted entities)

---

## Next 7 Days: The ONLY Work That Matters

**No refactors. No UI changes. No new features.**

### 1. Meta Usage Header Logging (Done Correctly)

**Not just**: Log headers  
**But**: Make it useful for correlation

**Schema**:
```typescript
interface MetaApiLog {
  id: string;
  accountId: string;
  endpointKey: string;        // 'insights_campaign', 'ads_list', 'adsets_list'
  paramsHash: string;          // Hash of query params (for complexity correlation)
  statusCode: number;
  latencyMs: number;
  retryCount: number;
  responseSizeBytes?: number;
  usageHeaders: Json;          // Raw x-ad-account-usage, x-app-usage, etc.
  timestamp: DateTime;
}
```

**Why `paramsHash`**: Correlate "what query shape triggered throttle"

**Why `endpointKey`**: Group by endpoint type for analysis

**Implementation location**: `src/lib/metaApiLogger.ts`

---

### 2. Sync Runs Audit Table (Single Source of Truth)

**Schema**:
```typescript
interface SyncRun {
  id: string;
  accountId: string;
  startedAt: DateTime;
  finishedAt?: DateTime;
  status: 'success' | 'partial' | 'fail' | 'throttled';
  
  // Volume
  campaignsFetched: number;
  adSetsFetched: number;
  adsFetched: number;
  insightsCalls: number;
  insightsRowsWritten: number;
  
  // Cost
  metaCallCountTotal: number;
  weightedCostTotal: number;  // Even if placeholder initially
  
  // Meta usage
  metaUsageEndSnapshot: Json;
  
  // Timing breakdown
  entityFetchMs?: number;
  insightsFetchMs?: number;
  dbWriteMs?: number;
  
  // Errors
  errorSummary?: string;
}
```

**Why timing breakdown**: Identify bottlenecks (network vs DB)

**Why `insightsRowsWritten`**: Compare to `insightsCalls` (not "coverage", just ratio)

**Implementation location**: Update `src/app/api/meta-ads/sync/route.ts`

---

### 3. Basic Governor (Even Dumb at First)

**Logic**: Pause/slow/stop when usage is high

```typescript
interface GovernorThresholds {
  appUsagePct: 80;        // If x-app-usage > 80%, pause
  accountUsagePct: 70;    // If x-ad-account-usage > 70%, pause
  insightsThrottlePct: 60; // If insights throttle > 60%, skip non-critical
}

async function shouldThrottle(accountId: string): Promise<boolean> {
  const latestLog = await getLatestMetaLog(accountId);
  
  const usage = latestLog.usageHeaders as {
    'x-app-usage'?: { call_count: number; total_time: number };
    'x-ad-account-usage'?: { acc_id_util_pct: number };
    'x-fb-ads-insights-throttle'?: { acc_id_util_pct: number };
  };
  
  // Check app-level usage
  if (usage['x-app-usage']?.call_count > 180) return true; // Near 200 limit
  
  // Check account-level usage
  const accountPct = usage['x-ad-account-usage']?.acc_id_util_pct || 0;
  if (accountPct > GovernorThresholds.accountUsagePct) return true;
  
  // Check insights throttle
  const insightsPct = usage['x-fb-ads-insights-throttle']?.acc_id_util_pct || 0;
  if (insightsPct > GovernorThresholds.insightsThrottlePct) return true;
  
  return false;
}

// Use in sync
if (await shouldThrottle(accountId)) {
  await logSyncRun({
    accountId,
    status: 'throttled',
    errorSummary: 'Skipped due to high Meta usage',
  });
  return { success: false, reason: 'throttled' };
}
```

**Why**: Survivability beats speed

**Implementation location**: `src/lib/metaGovernor.ts`

---

## Cron Decision: What to Implement First

**NOT**: "Every 10 minutes sync all accounts"  
**NOT**: "Priority-based cron with spend detection"

**YES**: **Rotating Cron v1 (Simple, Safe)**

```typescript
// Every 10 minutes: sync ONE account (cursor in DB)
export async function GET(request: Request) {
  // Verify cron secret
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // Get next account to sync
  const accounts = await prisma.metaAdAccount.findMany({
    orderBy: { name: 'asc' }
  });
  
  const cursor = await prisma.syncCursor.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { lastIndex: 0 }
  });
  
  const nextIndex = (cursor.lastIndex + 1) % accounts.length;
  const account = accounts[nextIndex];
  
  // Check governor BEFORE syncing
  if (await shouldThrottle(account.accountId)) {
    await logSyncRun({
      accountId: account.accountId,
      status: 'throttled',
      errorSummary: 'Governor prevented sync due to high usage',
    });
    return Response.json({ skipped: true, reason: 'throttled' });
  }
  
  // Check if recently synced
  if (account.lastSyncedAt) {
    const minutesSince = (Date.now() - account.lastSyncedAt.getTime()) / 60000;
    if (minutesSince < 30) {
      return Response.json({ skipped: true, reason: 'recently_synced' });
    }
  }
  
  // Sync the account
  const result = await syncAccount(account.accountId, 'last_7d');
  
  // Update cursor
  await prisma.syncCursor.update({
    where: { id: 'singleton' },
    data: { lastIndex: nextIndex }
  });
  
  return Response.json({ success: true, account: account.name });
}
```

**With governor**:
- If throttling headers high → skip this run
- If account synced recently → skip
- If spend=0 and no activity → deprioritize (later)

**Once you have 7 days of header data, THEN switch to priority-based.**

---

## Pressure Test My Own Claims

### Claim 1: "7.5s → 1.7s from three tweaks"

**Status**: **Confident estimate, unproven**

**Reality**: Only possible if:
- Bottleneck is network waits (not DB)
- Repeated insight fetches eliminated (skip fresh works)
- DB writes are cheap (<10% of time)

**Validation required**:
```sql
-- Must answer: what's actually slow?
SELECT 
  AVG(entity_fetch_ms) as avg_entity,
  AVG(insights_fetch_ms) as avg_insights,
  AVG(db_write_ms) as avg_db
FROM sync_runs
WHERE status = 'success'
  AND started_at > NOW() - INTERVAL '7 days';
```

**Don't claim 4.4× speedup without this data.**

---

### Claim 2: "157 records for 117 calls = 134% coverage"

**Status**: **Misleading terminology**

**Problem**: "Coverage" implies correctness metric, but this is just "rows per call"

**Better terms**:
- `rowsWrittenPerCall` (157 / 117 = 1.34)
- `timeSlicesWritten` (multiple date ranges)

**Why this matters**: Don't accidentally convince yourself system is "more correct" when it's just "more rows"

**Validation required**:
```sql
-- Verify: are multiple date ranges intentional?
SELECT entity_id,
       COUNT(*) as insight_count,
       COUNT(DISTINCT date_start) as unique_dates
FROM meta_insights
WHERE entity_type = 'campaign'
  AND entity_id IN (SELECT campaign_id FROM meta_campaigns WHERE account_id = 'act_697495618573979')
GROUP BY entity_id
HAVING COUNT(*) > 1;
```

---

## Tie Back to Endgame: Performance Marketing OS

**Current state**: Data Sync Engine  
**Endgame**: Copilot for Performance Marketing

**Missing piece**: **Metric Dictionary**

### Why This Matters Now

**Example**: "Free Base Member" is not a Meta-native metric

**Current sync**: Stores raw Meta actions (`lead`, `offsite_conversion.fb_pixel_purchase`)

**Future Copilot**: Must answer "How many Free Base Members this week?"

**Requires**:
```typescript
interface MetricDefinition {
  metricKey: 'free_base_member';
  displayName: 'Free Base Member';
  metaActionTypes: ['lead', 'omni_complete_registration'];
  fallbackRules: 'If both exist, prefer omni_complete_registration';
  accountOverrides?: {
    'act_697495618573979': {
      metaActionTypes: ['lead'],
      notes: '2EZi uses lead event for Free Base Member',
    }
  };
}
```

**Without this**: Copilot cannot answer reliably

**When to build**: After telemetry is in place (Week 2-3)

---

## Acceptance Criteria (Next 7 Days)

### 1. Meta Header Logging ✅
- [ ] `MetaApiLog` Prisma model created
- [ ] `logMetaApiCall()` helper implemented
- [ ] All Meta fetch calls wrapped with logging
- [ ] Logs include `endpointKey`, `paramsHash`, `usageHeaders`
- [ ] Test: Log appears in DB after sync

### 2. Sync Runs Audit Table ✅
- [ ] `SyncRun` Prisma model created
- [ ] One row written per sync attempt
- [ ] Timing breakdown captured (entity/insights/db ms)
- [ ] Status includes 'throttled' case
- [ ] Test: Query shows sync duration breakdown

### 3. Basic Governor ✅
- [ ] `shouldThrottle()` function implemented
- [ ] Checks `x-app-usage`, `x-ad-account-usage`, `x-fb-ads-insights-throttle`
- [ ] Sync pauses/skips if usage > thresholds
- [ ] Throttled syncs logged with reason
- [ ] Test: Mock high usage → sync skipped

### 4. Rotating Cron v1 ✅
- [ ] `/api/cron/rotate-sync` endpoint created
- [ ] One account per run (round-robin)
- [ ] Governor checked before sync
- [ ] Recently synced accounts skipped
- [ ] `vercel.json` cron configured (10 min)

### 5. Analysis Query ✅
**SQL query to summarize throttle incidents by endpoint_key**:

```sql
SELECT 
  endpoint_key,
  COUNT(*) as total_calls,
  COUNT(*) FILTER (WHERE status_code = 429) as throttled_count,
  AVG(latency_ms) as avg_latency,
  MAX((usage_headers->>'x-ad-account-usage')::jsonb->>'acc_id_util_pct') as peak_account_usage
FROM meta_api_logs
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY endpoint_key
ORDER BY throttled_count DESC;
```

---

## What NOT to Do (Next 7 Days)

- ❌ Implement parallel entity fetches (optimization before measurement)
- ❌ Implement minimal fields (complexity before baseline)
- ❌ Implement skip fresh insights (logic before telemetry)
- ❌ Implement priority-based cron (sophistication before data)
- ❌ Implement delta syncs (complexity before need)
- ❌ Build new UI features
- ❌ Refactor existing code
- ❌ Write more documentation

**Only**: Telemetry + Governor + Basic Cron

---

## Implementation Order

### Day 1-2: Schema + Logging
1. Add Prisma models (`MetaApiLog`, `SyncRun`, `SyncCursor`)
2. Run migration
3. Implement `logMetaApiCall()` helper
4. Wrap all Meta fetch calls with logging

### Day 3-4: Sync Runs + Governor
5. Update sync route to write `SyncRun` records
6. Add timing breakdown (entity/insights/db)
7. Implement `shouldThrottle()` governor
8. Test governor with mock high usage

### Day 5-6: Cron
9. Create `/api/cron/rotate-sync` endpoint
10. Implement round-robin logic
11. Add governor check
12. Configure `vercel.json` cron
13. Deploy and monitor first run

### Day 7: Validation
14. Run analysis query (throttle incidents)
15. Review sync_runs timing breakdown
16. Verify governor prevented sync when needed
17. Document findings (not plans)

---

## Success Metrics (End of Week 1)

**Not**: "We have a roadmap"  
**But**: "We have operational truth"

**Questions we can answer**:
- What's the actual throttle envelope per endpoint?
- Where is the sync bottleneck? (network vs DB)
- How many syncs got throttled?
- What's the average weighted cost per account?
- Which accounts are expensive?

**Deliverable**: One-page summary with SQL query results, NOT a plan.

---

## The Shift

**Before**: Beautiful documents → roadmap → implementation  
**After**: Telemetry → measurement → operational truth → optimization

**This directive supersedes all previous roadmaps.**

**Next milestone**: Operational telemetry exists + is queryable + drives behavior

---

**End of Implementation Directive**
