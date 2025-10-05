# Advanced Features Guide

This wiki now includes enterprise-grade features for scalability and performance.

## 🔍 Advanced Search with Meilisearch

### What is it?
Meilisearch provides instant, typo-tolerant search with sub-50ms response times.

### Features
- ⚡ **Instant search**: Results as you type
- 🔤 **Typo tolerance**: Finds "javscript" when you search "javascript"
- 🎯 **Relevance ranking**: Best results first
- 🏷️ **Filtering**: Search within specific categories or namespaces
- 📊 **Sorting**: By relevance, date, or view count

### Setup

1. **Install Meilisearch**:

   **Option A: Cloud (Easiest)**
   - Go to [Meilisearch Cloud](https://www.meilisearch.com/cloud)
   - Create free account (100K searches/month free)
   - Get your host URL and API key

   **Option B: Local (Development)**
   ```powershell
   # Download from https://www.meilisearch.com/docs/learn/getting_started/installation
   
   # Run locally
   meilisearch --master-key="myMasterKey"
   ```

2. **Configure in .env**:
   ```
   MEILISEARCH_HOST="http://localhost:7700"
   MEILISEARCH_API_KEY="myMasterKey"
   ```

3. **Index your pages**:
   ```powershell
   npm run index-search
   ```

4. **Test it**:
   - Visit your wiki
   - Use the search bar
   - Notice the instant, typo-tolerant results!

### API Usage

Search with filters:
```typescript
// Search only in "Technology" category
const results = await searchWithMeilisearch('nextjs', {
  filter: 'categories = Technology',
  limit: 20
})

// Search and sort by view count
const results = await searchWithMeilisearch('react', {
  sort: ['viewCount:desc'],
  limit: 10
})
```

---

## 📁 Media Storage with S3

### What is it?
S3-compatible object storage for images, videos, PDFs, and other media files.

### Features
- ☁️ **Scalable storage**: Store terabytes of media
- 🚀 **CDN integration**: Fast delivery worldwide
- 💰 **Cost-effective**: Pay only for what you use
- 🔒 **Secure**: Presigned URLs for private content
- 🖼️ **Format support**: Images, videos, PDFs, etc.

### Setup

Choose **ONE** storage provider:

#### **Cloudflare R2** (Recommended)
- **Free tier**: 10GB storage, 1M reads/month
- **Pros**: No egress fees, simple setup
- **Cost**: $0.015/GB after free tier

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Create R2 bucket
3. Generate API token
4. Add to .env:
   ```
   AWS_REGION="auto"
   AWS_ACCESS_KEY_ID="your-r2-access-key"
   AWS_SECRET_ACCESS_KEY="your-r2-secret-key"
   AWS_S3_BUCKET="your-bucket-name"
   S3_ENDPOINT="https://your-account-id.r2.cloudflarestorage.com"
   CDN_URL="https://your-bucket.r2.dev"
   ```

#### **AWS S3**
- **Free tier**: 5GB storage, 20K reads/month (12 months)
- **Pros**: Industry standard, massive ecosystem

1. Create S3 bucket
2. Create IAM user with S3 permissions
3. Add to .env:
   ```
   AWS_REGION="us-east-1"
   AWS_ACCESS_KEY_ID="your-key"
   AWS_SECRET_ACCESS_KEY="your-secret"
   AWS_S3_BUCKET="your-bucket"
   ```

#### **Backblaze B2**
- **Free tier**: 10GB storage, 1GB daily downloads
- **Pros**: Very cheap, simple

1. Create B2 account and bucket
2. Generate application key
3. Add to .env:
   ```
   AWS_REGION="us-west-000"
   AWS_ACCESS_KEY_ID="your-key-id"
   AWS_SECRET_ACCESS_KEY="your-application-key"
   AWS_S3_BUCKET="your-bucket"
   S3_ENDPOINT="https://s3.us-west-000.backblazeb2.com"
   ```

### Usage

**Upload API**:
```bash
curl -X POST http://localhost:3000/api/media/upload \
  -F "file=@image.jpg"
```

**Response**:
```json
{
  "success": true,
  "media": {
    "id": "clx...",
    "filename": "image.jpg",
    "url": "https://cdn.example.com/media/123/abc.jpg",
    "mimeType": "image/jpeg",
    "byteSize": 150000
  }
}
```

**Embed in wiki pages**:
```markdown
![My Image](https://cdn.example.com/media/123/abc.jpg)
```

---

## 📡 Event Streaming

### What is it?
Decoupled, event-driven architecture for handling page updates, search indexing, and cache invalidation.

### Features
- 🔄 **Decoupled operations**: Search indexing doesn't slow down page saves
- 📊 **Event log**: Complete audit trail of all changes
- 🎯 **Real-time updates**: React to changes as they happen
- 🚀 **Scalable**: Handle millions of events per day

### Architecture

```
Page Update → Event Bus → Multiple Consumers:
                          ├─ Search Indexer
                          ├─ Cache Invalidator
                          ├─ Analytics Tracker
                          └─ Notification System
```

### Development Mode (Default)

In development, events use an **in-memory queue**:
- No external services needed
- Events processed immediately
- Perfect for local development

### Production Mode (Optional)

For production, integrate with **Kafka**:

1. **Get Kafka** (choose one):
   
   **Upstash Kafka** (Easiest)
   - Go to [upstash.com](https://upstash.com)
   - Create Kafka cluster
   - Free tier: 10K messages/day
   
   **Confluent Cloud**
   - Free tier available
   - Managed Kafka service
   
   **Self-hosted**
   - Use Docker: `docker-compose up -d kafka`

2. **Configure in .env**:
   ```
   KAFKA_BROKERS="your-broker:9092,broker2:9092"
   KAFKA_CLIENT_ID="wiki-app"
   ```

3. **Event Types**:
   - `page.created` - New page created
   - `page.updated` - Page content changed
   - `page.deleted` - Page removed
   - `page.viewed` - Page view tracked
   - `search.index.request` - Request to index page
   - `cache.invalidate` - Clear cached data
   - `media.uploaded` - New media file
   - `media.deleted` - Media removed

### Custom Event Handlers

Add your own handlers in `lib/event-handlers.ts`:

```typescript
await subscribeToEvents(async (event: WikiEvent) => {
  if (event.type === EventType.PAGE_CREATED) {
    // Send notification
    // Update analytics
    // Trigger webhooks
  }
})
```

---

## Performance Benefits

### Before Advanced Features
- Search: 200-500ms (database full-text)
- Media: Slow from app server
- Updates: Blocking operations

### After Advanced Features
- Search: <50ms (Meilisearch)
- Media: <100ms (CDN delivery)
- Updates: Non-blocking (event-driven)

---

## Cost Breakdown

### Free Tier (Small Wiki)
```
Meilisearch Cloud: $0 (100K searches/month)
Cloudflare R2: $0 (10GB storage)
Event Streaming: $0 (in-memory)
Total: $0/month
```

### Production (Medium Wiki)
```
Meilisearch: $0-29/month
S3/R2 Storage: $1-10/month
Kafka (Upstash): $0-10/month
Total: $1-49/month
```

### Enterprise (Large Wiki)
```
Meilisearch: $99/month
S3 + CloudFront: $50-200/month
Kafka Cluster: $50-500/month
Total: $199-799/month
```

---

## Monitoring

### Meilisearch Stats
```typescript
import { getSearchStats } from '@/lib/search'
const stats = await getSearchStats()
console.log(stats.numberOfDocuments, 'pages indexed')
```

### Storage Stats
```typescript
import { listMedia } from '@/lib/storage'
const media = await listMedia(100, 0)
console.log(media.length, 'media files')
```

### Event Stream Health
```typescript
// Check event processing
// Monitor event lag
// Track processing errors
```

---

## Best Practices

### Search
- Index pages immediately after creation
- Update index when content changes
- Use filters for category/namespace searches
- Implement search analytics

### Media
- Optimize images before upload
- Use CDN for delivery
- Set appropriate cache headers
- Clean up unused files

### Events
- Keep event payloads small
- Use event types consistently
- Handle failures gracefully
- Monitor event lag

---

## Troubleshooting

### Meilisearch not working
```powershell
# Check if Meilisearch is running
curl http://localhost:7700/health

# Re-index all pages
npm run index-search
```

### Media upload failing
```powershell
# Test S3 connection
# Check AWS credentials
# Verify bucket permissions
```

### Events not processing
```powershell
# Check event handlers initialized
# Monitor console for errors
# Verify Kafka connection (if using)
```

---

## Next Steps

1. ✅ Set up Meilisearch for instant search
2. ✅ Configure S3 for media storage
3. ✅ Test media upload API
4. ✅ Monitor event processing
5. ✅ Deploy to production

See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment guides!
