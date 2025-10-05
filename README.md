# Wiki Platform - Next.js

A scalable, read-only wiki platform built with Next.js 14, designed to handle terabytes of data and hundreds of thousands of concurrent readers.

## 🚀 Features

- **Scalable Architecture**: Designed with horizontal scalability in mind
- **PostgreSQL Database**: With logical sharding support by namespace/title
- **Fast Search**: Full-text search with Postgres (Meilisearch/Elasticsearch ready)
- **Smart Caching**: Next.js built-in caching with Redis-ready architecture
- **Internal Wiki Links**: `[[Page Title]]` syntax support
- **Category System**: Hierarchical category organization
- **Revision History**: Track all page changes
- **Modern UI**: Clean, responsive interface with Tailwind CSS
- **SEO Optimized**: Server-side rendering for all pages

## 📋 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Styling**: Tailwind CSS
- **Search**: Postgres full-text search (extensible)
- **Deployment**: Vercel-ready, can run anywhere Node.js runs

## 🏗️ Architecture

### Database Schema

The database is designed to mirror WikiMedia's structure with modern optimizations:

- **Pages**: Core page table with namespace support
- **Revisions**: Full revision history (partition-ready)
- **Categories**: Hierarchical category system
- **Links**: Internal page links tracking
- **Templates**: Reusable content blocks
- **Media**: File metadata with S3-compatible storage support

### Scalability Design

1. **Logical Sharding**: Pages can be sharded by namespace + title hash
2. **Caching Layers**: 
   - Next.js automatic caching
   - Redis for hot metadata (ready to integrate)
   - CDN for static assets
3. **Read Optimization**: Optimized for read-heavy workloads
4. **Connection Pooling**: Ready for PgBouncer/Prisma Accelerate

## 🛠️ Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- npm/yarn/pnpm

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd wiki-platform
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Copy the example env file
cp .env.example .env

# Edit .env with your database credentials
# DATABASE_URL="postgresql://user:password@localhost:5432/wiki"
```

4. Set up the database:
```bash
# Generate Prisma Client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed the database with sample data
npm run seed
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the wiki.

## 📝 Creating Content

### Database Seeding

Use the seed script to populate your wiki:

```bash
npm run seed
```

This will create:
- Sample namespaces
- Example pages with content
- Categories
- Internal links

### Manual Content Creation

For now, content is created via direct database access or seed scripts. Future versions will include:
- Admin panel
- Content management UI
- API for bulk imports

### Wiki Syntax

The platform supports:
- **Internal Links**: `[[Page Title]]` or `[[Page Title|Display Text]]`
- **Categories**: `[[Category:Category Name]]`
- **Markdown**: Standard markdown syntax
- **Headings**: Auto-generated table of contents

## 🚀 Deployment

### Vercel (Recommended for Free Tier)

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables (DATABASE_URL)
4. Deploy!

**Free Tier Considerations:**
- Use Vercel Postgres (free tier: 256MB)
- Or use external Postgres (Supabase, Neon.tech free tiers)
- Automatic CDN and caching included

### Self-Hosted

1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

3. Use a process manager (PM2, systemd) for production

### Database Hosting Options (Free Tiers)

- **Neon**: 3GB storage, autoscaling
- **Supabase**: 500MB database, 1GB file storage
- **Railway**: $5 free credit monthly
- **Vercel Postgres**: 256MB storage

## 📈 Scaling Strategy

### Phase 1: Single Server (0-10K pages)
- Single Postgres instance
- Next.js caching
- Vercel free tier

### Phase 2: Read Replicas (10K-100K pages)
- Postgres with read replicas
- Redis cache layer
- CDN for assets

### Phase 3: Sharding (100K+ pages)
- Logical sharding by namespace
- Separate search infrastructure (Meilisearch/Elasticsearch)
- S3 for media files
- Multiple app instances

### Phase 4: Full Distribution (1M+ pages)
- Geographic distribution
- Dedicated search clusters
- Event-driven architecture (Kafka/Redpanda)
- Multi-region databases

## 🔧 Configuration

### Caching

Adjust cache times in `lib/cache.ts`:
```typescript
export const CacheDurations = {
  page: 3600,      // 1 hour
  category: 3600,  // 1 hour
  search: 300,     // 5 minutes
  list: 600,       // 10 minutes
}
```

### Database

Connection pooling can be configured via `DATABASE_URL_POOLING` for production use with Prisma Accelerate or PgBouncer.

## 🤝 Future Enhancements

- [ ] User authentication and permissions
- [ ] Page editing interface
- [ ] Real-time collaboration
- [ ] Advanced search with filters
- [ ] Page templates system
- [ ] File upload and management
- [ ] API for programmatic access
- [ ] Analytics and insights
- [ ] Multi-language support
- [ ] Discussion/talk pages

## 📄 License

MIT

## 🙏 Acknowledgments

Inspired by WikiMedia's architecture and designed for the modern web.