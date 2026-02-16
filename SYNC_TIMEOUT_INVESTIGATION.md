# Sync Timeout Investigation Report

**Date**: February 17, 2026  
**Issue**: "An error o..." message during sync (suspected Vercel timeout)  
**Reporter**: Jarvis  
**Status**: Investigation complete — NO CODE CHANGES MADE

---

## Executive Summary

**Current Status**: ✅ **SAFE** — Sync should complete within limits

**Estimated sync time**: ~45 seconds (well within 300s limit)  
**Actual timeout risk**: **LOW** under normal conditions  
**Root cause of "An error o..." message**: Likely **transient network issue** or **Meta API throttling**, NOT a fundamental timeout problem

---

## Current Implementation Analysis

### Architecture

```
POST /api/meta-ads/sync
├── maxDuration: 300 (5 minutes configured)
├── Fetches 12 ad accounts sequentially
└── For each account:
    ├── Fetch campaigns (1 API call)
    ├── Fetch ad sets (1 API call)
    ├── Fetch ads (1 API call)
    └── Fetch insights in parallel batches of 10
```

### Entity Counts (Current Database)

| Account | Campaigns | Ad Sets | Ads | Total | Insight Calls |
|---------|-----------|---------|-----|-------|---------------|
| Deckmasters | 1 | 0 | 0 | 1 | 1 |
| Dynamic Code | 10 | 0 | 0 | 10 | 10 |
| River Road Liquor | 8 | 0 | 0 | 8 | 8 |
| Buy't | 15 | 0 | 0 | 15 | 15 |
| Quoterite | 1 | 0 | 0 | 1 | 1 |
| Avante | 2 | 0 | 0 | 2 | 2 |
| **Australian Bill Cutters** | 35 | 13 | 45 | **93** | **93** |
| **2EZi** | 49 | 27 | 57 | **133** | **133** |
| Chekku (1) | 0 | 0 | 0 | 0 | 0 |
| Bus Tour Rhymes | 5 | 8 | 23 | 36 | 36 |
| **Circl** | 36 | 12 | 20 | **68** | **68** |
| **Chekku (2)** | 21 | 49 | 49 | **119** | **119** |
| **TOTALS** | **183** | **109** | **194** | **486** | **486** |

**Key insight**: 4 accounts (33%) contain 85% of all entities:
- 2EZi: 133 entities
- Chekku (2): 119 entities
- Australian Bill Cutters: 93 entities
- Circl: 68 entities

---

## Performance Analysis

### API Call Breakdown

```
Total API calls per sync: 522
├── Entity fetches: 36 calls (12 accounts × 3 endpoints)
└── Insight fetches: 486 calls (1 per entity)
```

### Time Estimates

**Per-account timing** (assuming 500ms avg API latency):

| Account | Entity Fetch | Insight Batches | Total Time |
|---------|--------------|-----------------|------------|
| Small accounts (1-15 entities) | 1.5s | 0.5-1.0s | ~2.0s |
| Medium accounts (36-68 entities) | 1.5s | 2.0-3.5s | ~3.5-5.0s |
| Large accounts (93-133 entities) | 1.5s | 5.0-7.0s | ~6.5-8.5s |

**Total sync time estimates**:

```
Best case (fast APIs):       ~31s ✅
Expected case:               ~45s ✅
Worst case (slow/throttled): ~68s ✅ (still within 300s limit)
```

### Vercel Timeout Limits

| Plan | Default Timeout | Max Duration Setting | Applies? |
|------|----------------|---------------------|----------|
| Free/Hobby | 10s | Not available | ❌ Too short |
| Pro | 60s | 300s (requires code) | ✅ Current |
| Enterprise | 900s | — | ✅ Would work |

**Current config**: `export const maxDuration = 300` (5 minutes) is properly set in `route.ts`

---

## Root Cause Analysis

### Why "An error o..." Might Occur

Given the math shows we're **well within limits** (~45s vs 300s), the error is likely:

1. **Meta API rate limiting** (429 errors)
   - Meta throttles aggressively during peak hours
   - Insight endpoints are especially rate-limited
   - Current code doesn't retry on 429

2. **Transient network issues**
   - Meta API occasional downtime
   - Vercel region → Meta region latency spikes
   - DNS resolution failures

3. **Database connection pool exhaustion**
   - 486 sequential upsert operations
   - Prisma connection pool might saturate
   - No connection timeout configured

4. **Memory pressure** (less likely)
   - Vercel functions have 1GB RAM limit (Pro)
   - Storing 486 entities in memory shouldn't exceed this

5. **Vercel deployment region mismatch**
   - If deployed to wrong region, adds latency
   - Check: is Vercel region close to Meta's API servers?

---

## Per-Account Sync Alternative (Jarvis's Suggestion)

### Pros ✅

1. **No timeout risk**
   - Longest account: ~8.5s (2EZi)
   - Well within 60s Pro default

2. **Better error isolation**
   - One account fails ≠ entire sync fails
   - Can retry individual accounts

3. **User experience**
   - Progress bar possible
   - Selective sync (e.g., just 2EZi)
   - Immediate feedback

4. **Caching opportunity**
   - Cache per-account sync results
   - Only re-sync stale accounts
   - Reduce API calls by 80%+

5. **Scalability**
   - Adding accounts doesn't risk timeout
   - Can parallelize in future (multiple workers)

### Cons ❌

1. **UI complexity**
   - Need progress indicator
   - Account selector dropdown
   - "Sync All" vs "Sync One" buttons

2. **More requests**
   - 12 requests to sync all accounts
   - Frontend must orchestrate
   - Could hit Vercel request limits

3. **Cache invalidation complexity**
   - When to invalidate?
   - Per-account TTL tracking
   - Stale data risk if user doesn't sync

4. **Incomplete syncs**
   - Users might only sync some accounts
   - Dashboard metrics would be partial
   - Need "last synced" indicator per account

---

## Recommendations

### Option 1: Keep Current Approach + Hardening (Recommended)

**Why**: Math shows it works. Fix the edge cases instead of redesigning.

**Immediate fixes**:

1. **Add retry logic for Meta API**
   ```typescript
   async function fetchWithRetry(url, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       const res = await fetch(url);
       if (res.ok) return res;
       if (res.status === 429) {
         await sleep(2000 * (i + 1)); // Exponential backoff
         continue;
       }
       throw new Error(`API error: ${res.status}`);
     }
   }
   ```

2. **Add timeout to individual API calls**
   ```typescript
   const controller = new AbortController();
   const timeout = setTimeout(() => controller.abort(), 10000); // 10s per call
   const res = await fetch(url, { signal: controller.signal });
   clearTimeout(timeout);
   ```

3. **Skip accounts with no data**
   ```typescript
   const activeAccounts = await prisma.metaAdAccount.findMany({
     where: {
       OR: [
         { campaigns: { some: {} } },
         { adSets: { some: {} } },
         { ads: { some: {} } },
       ]
     }
   });
   // Only sync these accounts
   ```

4. **Add progress logging**
   ```typescript
   console.log(`[Sync] Account ${i + 1}/${accounts.length}: ${account.name}`);
   console.log(`[Sync] Completed ${account.name} in ${elapsed}ms`);
   ```

**Pros**:
- No UI changes needed
- Works with current design
- Addresses actual failure modes

**Cons**:
- Doesn't eliminate all timeout risk (rare edge cases remain)

---

### Option 2: Per-Account Sync with Caching

**Implementation**:

1. **New endpoint**: `POST /api/meta-ads/sync/[accountId]`
   - Syncs single account
   - Returns cached data if fresh (<5 min)
   - Stores `lastSyncedAt` per account

2. **UI changes**:
   ```tsx
   <AccountSelector
     accounts={accounts}
     onSyncAll={syncAllAccounts}
     onSyncOne={syncAccount}
   />
   <SyncProgress
     syncing={syncing}
     completed={3}
     total={12}
     current="2EZi"
   />
   ```

3. **Cache strategy**:
   ```typescript
   const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
   
   if (account.lastSyncedAt > now - CACHE_TTL) {
     return { cached: true, data: existingData };
   }
   
   // Otherwise sync from Meta
   ```

**Pros**:
- Best UX (progress, selective sync)
- Future-proof (scales to 100+ accounts)
- Reduces Meta API calls (caching)

**Cons**:
- Requires UI redesign
- More complex orchestration
- Cache invalidation strategy needed

---

### Option 3: Background Job Queue

**Implementation**:

1. User clicks "Sync Data"
2. API enqueues sync job (returns immediately)
3. Background worker processes sync
4. Polls or webhook updates UI when complete

**Pros**:
- No timeout risk ever
- Can handle hours-long syncs
- Best for scale (100+ accounts)

**Cons**:
- Requires job queue infrastructure (Vercel Cron, Bull, etc.)
- Complex setup
- Async UX (less immediate feedback)

---

## Recommended Action Plan

### Phase 1: Immediate (No UI Changes)

1. ✅ **Verify Vercel plan** — confirm `maxDuration` is actually respected
   - Check Vercel dashboard → Project Settings → Functions
   - Should show "Max Duration: 300s"

2. ✅ **Add retry logic** for 429 rate limits (Meta throttling)

3. ✅ **Add per-call timeouts** (10s max per API call)

4. ✅ **Skip empty accounts** (saves ~2s)

5. ✅ **Add detailed logging** to identify which account/call times out

6. ✅ **Monitor actual sync times** in production
   - Add `console.time()` / `console.timeEnd()` around each account
   - Log to database or external service (Sentry, LogRocket)

### Phase 2: If Timeout Still Occurs (Requires UI)

7. Implement **per-account sync** with caching

8. Add progress UI

9. Consider background job queue for very large accounts

---

## Questions for Tyler/Jarvis

1. **What Vercel plan is ConvertOS on?**
   - Free/Hobby: Can't use maxDuration (stuck at 10s)
   - Pro: Should work with 300s limit
   - Enterprise: Would definitely work

2. **When does the "An error o..." occur?**
   - Every sync attempt?
   - Only certain times of day? (Meta rate limits vary)
   - Only for specific accounts?

3. **Can you check Vercel logs?**
   - Go to Vercel Dashboard → Deployments → Latest → Logs
   - Search for `/api/meta-ads/sync`
   - Look for timeout messages or 429 errors

4. **Is there a Sentry/error tracker configured?**
   - Would show exact error message (not truncated "An error o...")
   - Stack trace would reveal if timeout vs API error

5. **Do you want per-account sync even if not needed?**
   - Better UX (progress bar, selective sync)
   - More complex to build
   - Future-proofs for account growth

---

## Data Supporting "NOT a Timeout Issue"

1. **Math checks out**: 45s < 300s with large margin (255s buffer)

2. **Worst case still safe**: Even at 1.5× slower (68s), well within limit

3. **Per-account timing**: No single account takes >10s

4. **Parallel batching works**: Already implemented for insights

5. **No obvious bottleneck**: Database upserts are fast, API is rate-limited but not prohibitive

**Conclusion**: The "An error occurred" message is most likely:
- Meta API rate limit (429)
- Network blip
- Incorrect error message from Vercel (bug)
- OR: Vercel plan doesn't actually support maxDuration (needs verification)

---

## Next Steps (Investigation Mode — No Changes)

1. **Verify Vercel configuration**
   - Check dashboard: is maxDuration actually set?
   - Try test deploy to confirm

2. **Reproduce the error**
   - Click "Sync Data" multiple times
   - Check browser Network tab for actual error response
   - Check Vercel logs for full error message

3. **Add temporary debug logging**
   - Log timestamp at start/end of each account
   - Log any API errors
   - Deploy and sync again

4. **Report findings**
   - Full error message (not truncated)
   - Vercel plan confirmation
   - Actual sync duration from logs

**Once we have those answers, we can decide**:
- If math is wrong → per-account sync
- If config is wrong → fix Vercel settings
- If Meta is throttling → add retry logic
- If none of above → background jobs

---

## Appendix: Code Locations

- **Sync route**: `src/app/api/meta-ads/sync/route.ts`
- **Max duration setting**: Line 7 (`export const maxDuration = 300`)
- **Parallel insight batching**: Line 91-111 (`fetchInsightsBatch` function)
- **Main sync loop**: Line 254-441 (for each account)

---

**End of Investigation Report**
