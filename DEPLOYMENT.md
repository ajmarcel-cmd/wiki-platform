# Deployment & Scaling Guide

This guide covers deploying your wiki from development to production, and scaling it as your content and traffic grows.

## Quick Start (Local Development)

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your PostgreSQL connection string
   ```

3. **Set up database**:
   ```bash
   npm run db:generate
   npm run db:push
   npm run seed
   ```

4. **Run development server**:
   ```bash
   npm run dev
   ```

## Production Deployment Options

### Option 1: Vercel (Recommended for Getting Started)

**Pros**: Zero config, automatic CDN, free SSL, excellent Next.js support
**Cons**: Function execution limits on free tier

**Steps**:
1. Push code to GitHub
2. Import project on [vercel.com](https://vercel.com)
3. Set `DATABASE_URL` environment variable
4. Deploy

**Database Options for Vercel**:
- **Vercel Postgres** (Free: 256MB, 60 hours compute/month)
- **Neon** (Free: 3GB storage, 1 database)
- **Supabase** (Free: 500MB database, 1GB bandwidth/day)

**Free Tier Limits**:
- 100GB bandwidth/month
- Unlimited requests (with reasonable fair use)
- Serverless functions: 10 second timeout

### Option 2: Railway

**Pros**: Simple deployment, generous free tier, easy database management
**Cons**: Free tier requires credit card

**Steps**:
1. Connect GitHub repo on [railway.app](https://railway.app)
2. Add PostgreSQL database (included)
3. Environment variables set automatically
4. Deploy

**Free Tier**: $5 credit/month (enough for small wikis)

### Option 3: Fly.io

**Pros**: Global distribution, run anywhere, good for larger deployments
**Cons**: Requires Docker knowledge

**Steps**:
1. Install Fly CLI
2. `fly launch`
3. Add Postgres: `fly postgres create`
4. Deploy: `fly deploy`

**Free Tier**: 3 shared-cpu-1x VMs + 3GB storage

### Option 4: Self-Hosted (VPS)

**Pros**: Full control, cost-effective at scale
**Cons**: Requires server management

**Recommended Providers**:
- DigitalOcean ($4-6/month)
- Linode ($5/month)
- Hetzner (€4/month)

**Steps**:
1. Set up Node.js 18+ on your server
2. Install PostgreSQL
3. Clone repository
4. Build: `npm run build`
5. Start: `npm start`
6. Use PM2 or systemd for process management
7. Set up Nginx as reverse proxy

## Scaling Strategy

### Stage 1: Single Server (0-10,000 pages)
**Typical Traffic**: 0-10,000 visitors/day

**Infrastructure**:
- Single Next.js instance
- Single PostgreSQL instance
- Built-in Next.js caching

**Cost**: $0-10/month (free tiers possible)

**Setup**:
```bash
# Use Vercel + Neon (both free tier)
# No additional configuration needed
```

---

### Stage 2: Caching Layer (10K-100K pages)
**Typical Traffic**: 10K-100K visitors/day

**Infrastructure**:
- Multiple Next.js instances (load balanced)
- PostgreSQL with connection pooling
- Redis for hot data caching
- CDN for static assets

**Cost**: $50-200/month

**Setup**:

1. **Add Redis Caching**:
   ```typescript
   // lib/redis.ts
   import { Redis } from '@upstash/redis'
   
   export const redis = new Redis({
     url: process.env.REDIS_URL!,
     token: process.env.REDIS_TOKEN!,
   })
   ```

2. **Update Cache Functions**:
   ```typescript
   // Update lib/cache.ts to use Redis
   export async function getCached<T>(
     key: string,
     fetcher: () => Promise<T>,
     ttl: number = 3600
   ): Promise<T> {
     const cached = await redis.get<T>(key)
     if (cached) return cached
     
     const fresh = await fetcher()
     await redis.setex(key, ttl, fresh)
     return fresh
   }
   ```

3. **Connection Pooling**:
   ```bash
   # Add to .env
   DATABASE_URL_POOLING="prisma://..."
   # Use Prisma Accelerate or PgBouncer
   ```

**Redis Options**:
- Upstash (Free: 10K commands/day)
- Railway Redis ($1-5/month)
- Self-hosted Redis

---

### Stage 3: Database Scaling (100K-1M pages)
**Typical Traffic**: 100K-500K visitors/day

**Infrastructure**:
- Multiple app instances with auto-scaling
- PostgreSQL with read replicas
- Dedicated Redis cluster
- CDN (Cloudflare or AWS CloudFront)
- Search service (Meilisearch or Elasticsearch)

**Cost**: $200-1,000/month

**Database Optimizations**:

1. **Read Replicas**:
   ```typescript
   // lib/db.ts
   const primaryDb = new PrismaClient({
     datasources: { db: { url: process.env.DATABASE_URL } }
   })
   
   const replicaDb = new PrismaClient({
     datasources: { db: { url: process.env.DATABASE_REPLICA_URL } }
   })
   
   // Use replica for reads
   export const readDb = replicaDb
   export const writeDb = primaryDb
   ```

2. **Add Meilisearch**:
   ```typescript
   // lib/search.ts
   import { MeiliSearch } from 'meilisearch'
   
   const client = new MeiliSearch({
     host: process.env.MEILISEARCH_HOST!,
     apiKey: process.env.MEILISEARCH_KEY!,
   })
   
   export async function searchPages(query: string) {
     const index = client.index('pages')
     return await index.search(query)
   }
   ```

3. **Database Indexes**:
   ```sql
   -- Add to your migration
   CREATE INDEX CONCURRENTLY idx_page_search ON pages 
   USING GIN(to_tsvector('english', title || ' ' || content));
   ```

---

### Stage 4: Horizontal Scaling (1M+ pages)
**Typical Traffic**: 500K+ visitors/day

**Infrastructure**:
- Kubernetes or equivalent orchestration
- PostgreSQL with logical sharding by namespace
- Distributed cache (Redis Cluster)
- Dedicated search cluster
- S3 for media storage
- Event streaming (Kafka/Redpanda)
- Multi-region deployment

**Cost**: $1,000-10,000+/month

**Implementation**:

1. **Logical Sharding**:
   ```typescript
   // lib/sharding.ts
   function getShardForPage(namespace: string, title: string): string {
     const hash = hashString(`${namespace}:${title}`)
     const shardId = hash % TOTAL_SHARDS
     return process.env[`DATABASE_SHARD_${shardId}`]!
   }
   
   export function getDbForPage(namespace: string, title: string) {
     const shardUrl = getShardForPage(namespace, title)
     return new PrismaClient({ datasources: { db: { url: shardUrl } } })
   }
   ```

2. **Event-Driven Architecture**:
   ```typescript
   // For page updates, search indexing, cache invalidation
   import { Kafka } from 'kafkajs'
   
   const kafka = new Kafka({
     clientId: 'wiki',
     brokers: [process.env.KAFKA_BROKER!]
   })
   
   // Publish events
   await producer.send({
     topic: 'page-updates',
     messages: [{ value: JSON.stringify(pageData) }]
   })
   ```

3. **Geographic Distribution**:
   - Multi-region databases
   - Regional read replicas
   - Edge caching with Cloudflare or AWS CloudFront

---

## Monitoring & Observability

### Essential Metrics

1. **Application Metrics**:
   - Response time
   - Error rate
   - Request rate
   - Cache hit rate

2. **Database Metrics**:
   - Query performance
   - Connection pool usage
   - Replication lag
   - Storage usage

3. **Infrastructure Metrics**:
   - CPU/Memory usage
   - Disk I/O
   - Network traffic

### Recommended Tools

**Free/Affordable**:
- Vercel Analytics (built-in)
- PostgreSQL built-in stats
- Uptime Robot (monitoring)

**Production**:
- Datadog
- New Relic
- Grafana + Prometheus
- Sentry (error tracking)

## Cost Optimization

### Free Tier Strategy (0-$10/month)
```
Next.js App: Vercel Free Tier
Database: Neon Free Tier (3GB)
Redis: Upstash Free Tier (10K req/day)
CDN: Cloudflare Free Tier
Search: PostgreSQL full-text search
Media: Vercel Blob (100GB free)
```

**Limits**: ~10K pages, ~10K daily visitors

### Budget Strategy ($50-100/month)
```
Next.js App: Vercel Hobby ($20/month)
Database: Supabase Pro ($25/month) or Railway ($10-20)
Redis: Railway ($5/month)
CDN: Cloudflare Free Tier
Search: Self-hosted Meilisearch on Railway ($5)
Media: Cloudflare R2 ($0.015/GB)
```

**Capacity**: ~100K pages, ~100K daily visitors

### Growth Strategy ($200-500/month)
```
Next.js App: Vercel Pro ($20) + additional compute
Database: Managed PostgreSQL with replicas ($100-200)
Redis: Managed Redis cluster ($30-50)
CDN: Cloudflare Pro ($20)
Search: Managed Meilisearch ($30-50)
Media: S3/R2 storage (~$10)
Monitoring: Basic tier ($20-30)
```

**Capacity**: ~1M pages, ~500K daily visitors

## Performance Optimization Checklist

- [ ] Enable Next.js caching (`revalidate` on all routes)
- [ ] Add database indexes on frequently queried columns
- [ ] Use connection pooling (PgBouncer or Prisma Accelerate)
- [ ] Implement Redis caching for hot data
- [ ] Enable CDN for static assets
- [ ] Optimize images with next/image
- [ ] Use ISR (Incremental Static Regeneration) for semi-static pages
- [ ] Add database query optimization (EXPLAIN ANALYZE)
- [ ] Implement rate limiting
- [ ] Set up monitoring and alerts

## Security Checklist

- [ ] Use environment variables for secrets
- [ ] Enable HTTPS (automatic on Vercel/Cloudflare)
- [ ] Implement rate limiting
- [ ] Sanitize all user inputs (already done in markdown parsing)
- [ ] Use prepared statements (Prisma does this)
- [ ] Enable CORS properly
- [ ] Add security headers
- [ ] Regular dependency updates
- [ ] Database backups (automated on managed services)

## Backup Strategy

### Automated Backups
Most managed database services provide automated backups:
- **Vercel Postgres**: Daily backups (retained 7 days on free tier)
- **Neon**: Point-in-time recovery
- **Supabase**: Daily backups (retained 7 days)

### Manual Backups
```bash
# Backup database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Backup to S3
aws s3 cp backup_*.sql s3://your-bucket/backups/
```

## Troubleshooting

### High Database Load
- Check slow queries: `SELECT * FROM pg_stat_statements ORDER BY total_time DESC`
- Add indexes on frequently queried columns
- Enable query caching
- Consider read replicas

### High Memory Usage
- Check for memory leaks in Node.js
- Optimize database queries
- Implement proper pagination
- Use streaming for large datasets

### Slow Page Load
- Check Next.js caching configuration
- Optimize database queries
- Add Redis caching
- Enable CDN for static assets
- Optimize images

## Support & Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Vercel Deployment Docs](https://vercel.com/docs)

## Next Steps

1. Deploy to production
2. Set up monitoring
3. Configure automated backups
4. Implement caching strategy
5. Optimize database indexes
6. Plan for scaling based on growth
