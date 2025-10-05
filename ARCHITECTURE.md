# Architecture Overview

This document explains the architectural decisions and design patterns used in this wiki platform, with a focus on scalability from day one.

## Core Design Principles

1. **Read-Optimized**: The system is designed for read-heavy workloads (99%+ reads)
2. **Horizontally Scalable**: Every component can scale out, not just up
3. **Data Locality**: Keep frequently accessed data close to users
4. **Eventual Consistency**: Accept trade-offs where appropriate for better performance
5. **Cost-Effective**: Start cheap, scale when needed

## System Architecture

```
┌─────────────────┐
│   CDN/Edge      │ ← Static assets, HTML caching
└────────┬────────┘
         │
┌────────▼────────┐
│   Load Balancer │ ← Distributes traffic
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼──┐  ┌──▼───┐
│ App  │  │ App  │ ← Next.js instances (stateless)
└───┬──┘  └──┬───┘
    │        │
┌───▼────────▼───┐
│  Redis Cache   │ ← Hot data caching
└───┬────────┬───┘
    │        │
┌───▼───┐ ┌─▼─────┐
│Primary│ │Replica│ ← PostgreSQL (read/write)
│  DB   │ │  DB   │
└───────┘ └───────┘
```

## Data Model

### Database Schema Design

The schema is inspired by WikiMedia's proven architecture but modernized:

#### Pages Table
```sql
CREATE TABLE Page (
  id STRING PRIMARY KEY,
  namespace_id INT,
  title STRING,
  slug STRING UNIQUE,
  latest_revision_id STRING,
  -- Sharding key: hash(namespace_id, title)
  INDEX idx_namespace_title (namespace_id, title),
  INDEX idx_slug (slug)
);
```

**Sharding Strategy**: Logical sharding by `namespace_id + title` hash allows us to:
- Distribute data evenly across shards
- Maintain namespace locality (related pages together)
- Query single shard for most page operations

#### Revisions Table
```sql
CREATE TABLE Revision (
  id STRING PRIMARY KEY,
  page_id STRING,
  content TEXT,
  content_hash STRING,
  revision_number INT,
  timestamp TIMESTAMP,
  -- Partitioning: by timestamp (monthly)
  INDEX idx_page_revisions (page_id, revision_number),
  INDEX idx_timestamp (timestamp)
);
```

**Partitioning Strategy**: Time-based partitioning because:
- Old revisions are rarely accessed
- Archive old partitions to cheaper storage
- Queries mostly access recent revisions

#### Categories & Links
```sql
-- Many-to-many relationships
CREATE TABLE PageCategory (
  page_id STRING,
  category_id STRING,
  PRIMARY KEY (page_id, category_id),
  INDEX idx_category_pages (category_id)
);

CREATE TABLE PageLink (
  from_page_id STRING,
  to_page_id STRING,
  PRIMARY KEY (from_page_id, to_page_id),
  INDEX idx_backlinks (to_page_id)
);
```

**Indexing Strategy**: Bi-directional indexes for:
- Forward navigation (pages in category)
- Reverse navigation (backlinks, category membership)

## Caching Strategy

### Multi-Layer Caching

```
Request → CDN → Next.js Cache → Redis → Database
          ↓       ↓              ↓
        Static   Computed      Hot Data
        Assets   Pages         Metadata
```

### Cache Levels

1. **CDN Layer** (Cloudflare/Vercel Edge)
   - Static assets (JS, CSS, images): 1 year
   - HTML pages: 1 hour with stale-while-revalidate
   - Cache hit ratio target: 95%+

2. **Next.js Cache** (Built-in)
   - Data Cache: Caches fetch() results
   - Full Route Cache: Pre-rendered pages
   - Revalidation: Time-based (ISR) or on-demand

3. **Redis Cache** (Application layer)
   - Hot metadata: 1 hour
   - Search results: 5 minutes
   - Session data: 24 hours
   - Category listings: 1 hour

4. **Database** (PostgreSQL)
   - Query results cache
   - Shared buffers: 25% of RAM
   - Effective cache size: 75% of RAM

### Cache Invalidation

```typescript
// Event-driven cache invalidation
async function updatePage(slug: string, content: string) {
  // 1. Update database
  await db.page.update({ where: { slug }, data: { content }})
  
  // 2. Invalidate Redis cache
  await redis.del(`page:${slug}`)
  
  // 3. Revalidate Next.js cache
  revalidateTag(`page:${slug}`)
  
  // 4. Clear CDN cache (via webhook)
  await fetch(`https://api.cloudflare.com/client/v4/zones/.../purge_cache`)
}
```

## Scalability Patterns

### Horizontal Scaling

#### Application Layer
- **Stateless servers**: No session state in app servers
- **Load balancing**: Round-robin or least-connections
- **Auto-scaling**: Based on CPU/memory metrics
- **Container orchestration**: Docker + Kubernetes/ECS

#### Database Layer
- **Read replicas**: Route reads to replicas (99% of traffic)
- **Connection pooling**: PgBouncer (500 connections → 50 actual)
- **Logical sharding**: Partition by namespace
- **Physical sharding**: Split across multiple servers when needed

#### Cache Layer
- **Redis Cluster**: Automatic sharding across nodes
- **Consistent hashing**: Minimize cache invalidation on scale
- **Sentinel**: Automatic failover

### Vertical Scaling Limits

```
Single Server Capacity:
- Database: ~1TB data, ~10K queries/sec
- Application: ~500 req/sec per core
- Redis: ~100K ops/sec

When to Shard:
- Database > 500GB
- Write IOPS > 5K/sec
- Query latency > 50ms p95
```

## Search Architecture

### Phase 1: PostgreSQL Full-Text Search
```sql
-- GIN index for full-text search
CREATE INDEX idx_page_search ON pages 
USING GIN(to_tsvector('english', title || ' ' || content));

-- Query
SELECT * FROM pages 
WHERE to_tsvector('english', title || ' ' || content) 
@@ to_tsquery('nextjs & react');
```

**Pros**: 
- No additional infrastructure
- Good for up to ~100K pages
- Integrated with database

**Cons**:
- Limited relevance tuning
- Performance degrades with scale
- Basic search features

### Phase 2: Meilisearch
```typescript
// Index pages in Meilisearch
await meili.index('pages').addDocuments([
  { id, title, content, namespace, categories }
])

// Search with typo tolerance, ranking
const results = await meili.index('pages').search('next.js', {
  attributesToHighlight: ['title', 'content'],
  limit: 20
})
```

**Pros**:
- Typo tolerance
- Instant search (<50ms)
- Simple to deploy
- Excellent for <10M pages

**When to Switch**: 
- >50K pages
- Need instant search
- Advanced ranking required

### Phase 3: Elasticsearch
For Wikipedia-scale (1M+ pages), migrate to Elasticsearch for:
- Distributed search
- Advanced analytics
- Multi-language support
- Complex aggregations

## Media Storage

### File Storage Strategy

```
Small Scale (<10K files):
  → Local filesystem or Vercel Blob

Medium Scale (<100K files):
  → S3-compatible storage (S3, R2, Backblaze B2)
  → CDN for delivery

Large Scale (>100K files):
  → S3 with CloudFront
  → Image optimization service
  → Multiple regions
```

### Image Optimization
```typescript
// Next.js automatic image optimization
<Image
  src="/uploads/image.jpg"
  width={800}
  height={600}
  alt="Description"
/>
```

Next.js automatically:
- Resizes images
- Converts to WebP
- Lazy loads
- Responsive sizes

## Performance Optimization

### Database Optimization

1. **Indexes**
```sql
-- Covering indexes for common queries
CREATE INDEX idx_page_list ON pages(namespace_id, updated_at DESC) 
  INCLUDE (title, slug);

-- Partial indexes for active pages
CREATE INDEX idx_active_pages ON pages(updated_at) 
  WHERE is_deleted = FALSE;
```

2. **Query Optimization**
```typescript
// Use select to fetch only needed fields
const pages = await prisma.page.findMany({
  select: {
    id: true,
    title: true,
    slug: true,
    updatedAt: true
  }
})

// Use cursor-based pagination for large sets
const pages = await prisma.page.findMany({
  take: 50,
  cursor: { id: lastId },
  orderBy: { id: 'asc' }
})
```

3. **Connection Pooling**
```typescript
// Use Prisma Accelerate or PgBouncer
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_POOLING
    }
  }
})
```

### Application Optimization

1. **Next.js Caching**
```typescript
// Static generation for unchanging pages
export const revalidate = 3600 // 1 hour

// Dynamic with cache
export async function generateStaticParams() {
  const pages = await getTopPages()
  return pages.map(p => ({ slug: p.slug }))
}
```

2. **React Optimization**
```typescript
// Memoize expensive computations
const toc = useMemo(() => generateTOC(content), [content])

// Lazy load components
const Editor = dynamic(() => import('./Editor'), { ssr: false })
```

3. **Bundle Optimization**
```typescript
// next.config.ts
module.exports = {
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['@prisma/client']
  }
}
```

## Monitoring & Observability

### Key Metrics

1. **Application Metrics**
   - Request rate (req/sec)
   - Response time (p50, p95, p99)
   - Error rate (%)
   - Cache hit ratio (%)

2. **Database Metrics**
   - Query time (ms)
   - Connections (active/idle)
   - Replication lag (sec)
   - Cache hit ratio (%)

3. **Infrastructure Metrics**
   - CPU usage (%)
   - Memory usage (%)
   - Disk I/O (IOPS)
   - Network throughput (Mbps)

### Logging Strategy

```typescript
// Structured logging
import pino from 'pino'

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty'
  }
})

logger.info({ 
  slug, 
  duration: Date.now() - start,
  userId 
}, 'Page viewed')
```

### Alerting

Set alerts for:
- Response time > 1s (p95)
- Error rate > 1%
- Database connections > 80% capacity
- CPU usage > 80% sustained
- Disk usage > 85%

## Security Considerations

### Input Validation
```typescript
// Sanitize all HTML output
import sanitizeHtml from 'sanitize-html'

const clean = sanitizeHtml(userContent, {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img']),
  allowedAttributes: {
    a: ['href', 'name', 'target'],
    img: ['src', 'alt']
  }
})
```

### Rate Limiting
```typescript
// Implement rate limiting
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
})
```

### SQL Injection Prevention
Prisma uses prepared statements automatically, protecting against SQL injection.

## Disaster Recovery

### Backup Strategy

1. **Database Backups**
   - Continuous WAL archiving
   - Daily full backups (retained 30 days)
   - Weekly backups (retained 1 year)
   - Off-site backup storage

2. **Point-in-Time Recovery**
   - WAL archiving enables PITR
   - Recover to any point in last 30 days

3. **Testing**
   - Monthly restore tests
   - Document recovery procedures

### High Availability

```
          ┌─────────┐
          │ Primary │
          │   DB    │
          └────┬────┘
               │
        ┌──────┴──────┐
        │             │
    ┌───▼───┐     ┌──▼────┐
    │Replica│     │Replica│
    │   1   │     │   2   │
    └───────┘     └───────┘
```

- Synchronous replication to one replica (no data loss)
- Asynchronous to others (minimal lag)
- Automatic failover with Patroni or similar

## Cost Analysis

### Cost Breakdown by Scale

**Small (10K pages, 10K visitors/day)**
```
Hosting: $0-20/month (Vercel hobby tier)
Database: $0-25/month (Neon/Supabase free tier)
CDN: $0 (Cloudflare free tier)
Total: $0-45/month
```

**Medium (100K pages, 100K visitors/day)**
```
Hosting: $20-50/month (Vercel Pro)
Database: $50-100/month (Managed Postgres)
Cache: $10-30/month (Redis)
Search: $20-50/month (Meilisearch Cloud)
CDN: $20/month (Cloudflare Pro)
Total: $120-250/month
```

**Large (1M+ pages, 1M visitors/day)**
```
Hosting: $200-500/month (Multiple instances)
Database: $500-2000/month (Replicas + sharding)
Cache: $100-300/month (Redis cluster)
Search: $200-500/month (Elasticsearch cluster)
CDN: $100-300/month (Enterprise CDN)
Storage: $50-200/month (S3 + CloudFront)
Total: $1,150-3,800/month
```

## Future Enhancements

### Short-term (1-3 months)
- [ ] Implement Redis caching
- [ ] Add Meilisearch for search
- [ ] Set up monitoring dashboard
- [ ] Implement rate limiting
- [ ] Add admin panel

### Medium-term (3-6 months)
- [ ] User authentication
- [ ] Page editing interface
- [ ] Comment system
- [ ] Advanced search filters
- [ ] API documentation
- [ ] Multi-language support

### Long-term (6-12 months)
- [ ] Real-time collaboration
- [ ] Machine learning for content recommendations
- [ ] GraphQL API
- [ ] Mobile apps
- [ ] Federated wiki network

## References

- [WikiMedia Architecture](https://wikitech.wikimedia.org/)
- [Next.js Docs](https://nextjs.org/docs)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Caching Best Practices](https://aws.amazon.com/caching/best-practices/)
- [Database Sharding](https://www.mongodb.com/basics/sharding)
