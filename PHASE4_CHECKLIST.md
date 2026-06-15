# Phase 4 Implementation Checklist

## Pre-Deployment

- [ ] **Review All Changes**
  ```bash
  git diff src/lib/
  git diff src/components/
  git diff src/app/api/chat/
  git status
  ```

- [ ] **Verify New Files**
  ```
  src/lib/performance/monitor.ts       ✓
  src/lib/rag/cache.ts                 ✓
  src/lib/webgl/shaderOptimizer.ts     ✓
  src/components/OptimizedShaderWrapper.tsx  ✓
  prisma/migrations/20260615_add_performance_indexes/  ✓
  .env.performance                     ✓
  PERFORMANCE.md                       ✓
  PHASE4_IMPLEMENTATION.md             ✓
  PHASE4_SUMMARY.md                    ✓
  ```

## Local Testing

- [ ] **Install Dependencies**
  ```bash
  npm install
  # Verify no conflicts or build errors
  ```

- [ ] **Build Project**
  ```bash
  npm run build
  # Check for TypeScript errors
  # Verify webpack bundle sizes
  ```

- [ ] **Generate Prisma Client**
  ```bash
  npm run build
  # Should auto-run in postinstall
  ```

- [ ] **Test Performance Monitor**
  ```bash
  npm run dev
  # Open browser console
  # Run in console:
  ```
  ```typescript
  import { getMonitor } from "@/lib/performance/monitor";
  const m = getMonitor();
  // Send a chat message
  setTimeout(() => console.log(m.getMetricsSummary()), 2000);
  ```

- [ ] **Test RAG Caching**
  ```bash
  # In browser console, send same query twice
  # Second should return 5-10ms (from cache)
  # First should return 300-500ms (from API)
  ```

- [ ] **Test Shader Frame Rate Limiting**
  ```bash
  # Monitor DevTools Performance tab
  # Should see stable 60 FPS (or configured max)
  # No frame drops
  ```

- [ ] **Test Lazy Loading**
  ```bash
  # Go to /shaders page
  # Switch between shaders
  # Should load quickly after first load
  # Check DevTools Network tab for chunk loading
  ```

## Database Migration

- [ ] **Backup Database**
  ```bash
  # For production PostgreSQL:
  pg_dump $DATABASE_URL > backup.sql
  ```

- [ ] **Apply Migration in Development**
  ```bash
  npm run db:migrate
  # Or for deployed DB:
  npm run db:deploy
  ```

- [ ] **Verify Indexes Created**
  ```sql
  -- From psql or database tool:
  SELECT indexname FROM pg_indexes WHERE tablename = 'Session';
  -- Should see: idx_session_updatedAt
  
  SELECT indexname FROM pg_indexes WHERE tablename = 'Message';
  -- Should see: idx_message_sessionId_createdAt, idx_message_crisisFlag
  
  SELECT indexname FROM pg_indexes WHERE tablename = 'Chunk';
  -- Should see: idx_chunk_documentId_ordinal
  ```

## Environment Configuration

- [ ] **Create .env.local**
  ```bash
  cp .env.performance .env.local
  # Add any production overrides
  # Make sure DATABASE_URL is set correctly
  ```

- [ ] **Validate Configuration**
  ```bash
  npm run dev
  # Check console for "Invalid environment configuration" errors
  # Should start without errors
  ```

- [ ] **Verify Environment Variables**
  ```bash
  # In Node.js:
  const config = getConfig();
  console.log({
    DATABASE_URL_POOL_SIZE: config.DATABASE_URL_POOL_SIZE,
    RAG_CACHE_TTL: config.RAG_CACHE_TTL,
    RAG_TIMEOUT: config.RAG_TIMEOUT,
    MAX_MESSAGE_HISTORY: config.MAX_MESSAGE_HISTORY,
  });
  ```

## Integration Testing

- [ ] **Test Chat API**
  - [ ] Send message → should see batched stream chunks
  - [ ] Check response headers for RateLimit- headers
  - [ ] Verify metadata (sources, crisis flag) in response
  - [ ] Send same query twice → second should be faster

- [ ] **Test RAG Retrieval**
  - [ ] First query: ~400-600ms
  - [ ] Second identical query: ~5-10ms (from cache)
  - [ ] Different query: ~400-600ms
  - [ ] Timeout test: set RAG_TIMEOUT=100, should fallback gracefully

- [ ] **Test Database**
  - [ ] History queries should be < 50ms with index
  - [ ] Session creation should be fast
  - [ ] Crisis detection queries should be instant with index

- [ ] **Test Shaders**
  - [ ] Frame rate limiting works (60 FPS stable)
  - [ ] GPU memory check runs (no errors)
  - [ ] Shader switching is smooth
  - [ ] Error fallback works (disable WebGL to test)

## Performance Benchmarking

- [ ] **Baseline Metrics**
  ```bash
  # Open DevTools Performance tab
  # Send 10 chat messages
  # Record metrics:
  - First message latency: ___ms
  - Avg message latency: ___ms
  - Max latency (p99): ___ms
  - Shader FPS: ___ avg, ___ min
  - Bundle size: ___KB
  ```

- [ ] **Cache Hit Metrics**
  ```bash
  # In console:
  import { embeddingCache, retrievalCache } from "@/lib/rag/cache";
  console.log(embeddingCache.getStats());
  console.log(retrievalCache.getStats());
  # Record hit rates
  ```

- [ ] **Monitor Alerts**
  ```bash
  # Set very tight thresholds to test:
  RAG_TIMEOUT=100
  # Send message → should see timeout warning in console
  # Response should still work (graceful fallback)
  ```

## Production Deployment

- [ ] **Pre-Deployment Checklist**
  - [ ] All tests passing
  - [ ] Database migration tested in staging
  - [ ] Environment variables confirmed
  - [ ] Documentation updated
  - [ ] Team notified of changes

- [ ] **Deploy Steps**
  ```bash
  # 1. Commit Phase 4 changes
  git add .
  git commit -m "Phase 4: Performance Optimization"
  
  # 2. Build for production
  npm run build
  
  # 3. Deploy to Vercel/server
  # (Your deployment process here)
  
  # 4. Run database migration
  npm run db:deploy
  
  # 5. Verify deployment
  # Open production app, test chat, verify metrics
  ```

- [ ] **Post-Deployment Verification**
  - [ ] App loads without errors
  - [ ] Chat API works
  - [ ] Shaders render smoothly
  - [ ] No console errors
  - [ ] Metrics visible in Sentry (Phase 2)

## Monitoring Setup

- [ ] **Enable Performance Monitoring**
  ```bash
  # In src/app/api/chat/route.ts, performance monitor is auto-integrated
  # Verify in Sentry dashboard
  ```

- [ ] **Setup Alerts** (Sentry Phase 2)
  - [ ] Alert on API latency p99 > 5s
  - [ ] Alert on error rate > 1%
  - [ ] Alert on crashed frames (WebGL)

- [ ] **Create Dashboard**
  ```bash
  # In Sentry:
  # Create widget showing:
  # - API latency trends
  # - Error rates
  # - Performance metrics
  # - Alert status
  ```

## Rollback Plan

If issues arise in production:

- [ ] **Disable Cache** (fastest rollback)
  ```typescript
  // In src/lib/rag/cache.ts:
  const embeddingCache = new LRUCache(200, 0); // TTL=0 disables
  ```

- [ ] **Disable Streaming Batching**
  ```typescript
  // In src/app/api/chat/route.ts:
  // Change to send every chunk without batching
  ```

- [ ] **Reduce Connection Pool**
  ```env
  DATABASE_URL_POOL_SIZE=5
  ```

- [ ] **Revert Deployment**
  ```bash
  # If serious issues, revert to previous commit:
  git revert HEAD
  npm run build && npm run db:deploy --version prev
  ```

## Post-Deployment (Day 1)

- [ ] **Monitor Application**
  - [ ] Check error rates (should be 0 change)
  - [ ] Monitor latency (should improve ~48%)
  - [ ] Check cache hit rates (should be 70%+)
  - [ ] Verify no database connection issues

- [ ] **Gather Metrics**
  ```bash
  # Collect baseline numbers:
  - API latency p50, p95, p99
  - Shader FPS average
  - Cache hit rate
  - Database query time
  - Error rate
  ```

- [ ] **Team Communication**
  - [ ] Update team on deployment status
  - [ ] Share performance improvements
  - [ ] Note any issues or anomalies
  - [ ] Plan next phase

## Post-Deployment (Week 1)

- [ ] **Analyze Metrics**
  - [ ] Compare before/after latency
  - [ ] Review cache effectiveness
  - [ ] Check for unexpected errors
  - [ ] Identify areas for further optimization

- [ ] **Tune Configuration** (if needed)
  - [ ] Adjust timeout values if RAG timing off
  - [ ] Adjust pool size if connection issues
  - [ ] Reduce FPS on low-end devices if needed
  - [ ] Extend cache TTL if hit rate low

- [ ] **Documentation**
  - [ ] Update runbook with performance tips
  - [ ] Document any configuration changes
  - [ ] Add performance troubleshooting guide
  - [ ] Share lessons learned with team

## Success Criteria

- [ ] ✅ No regressions (error rate unchanged)
- [ ] ✅ API latency improved by 40%+ (p99 < 2s)
- [ ] ✅ Shader FPS stable at 58-60
- [ ] ✅ Cache hit rate 70%+
- [ ] ✅ Bundle size reduced 40%+
- [ ] ✅ No database connection issues
- [ ] ✅ All tests passing
- [ ] ✅ Monitoring alerts functional

## Sign-Off

- [ ] Performance optimizations deployed
- [ ] Metrics verified in production
- [ ] Team notified and trained
- [ ] Documentation complete
- [ ] Ready for Phase 5

---

**Date Deployed**: ___________
**Deployed By**: ___________
**Monitoring Status**: ___________
**Issues Encountered**: None / ___________
