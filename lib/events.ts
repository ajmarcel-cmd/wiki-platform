/**
 * Event streaming system for decoupled operations
 * Handles page updates, search indexing, cache invalidation
 * Uses Kafka for production or in-memory queue for development
 */

import { Kafka, Producer, Consumer, EachMessagePayload } from 'kafkajs'

// Kafka configuration
const KAFKA_BROKERS = process.env.KAFKA_BROKERS?.split(',') || []
const KAFKA_CLIENT_ID = process.env.KAFKA_CLIENT_ID || 'wiki-app'
const USE_KAFKA = KAFKA_BROKERS.length > 0

// In-memory event queue for development
const eventQueue: Array<{ topic: string; message: any }> = []
const eventHandlers: Map<string, Array<(message: any) => Promise<void>>> = new Map()

let kafka: Kafka | null = null
let producer: Producer | null = null
let consumer: Consumer | null = null

/**
 * Initialize Kafka connection
 */
function getKafkaClient() {
  if (!USE_KAFKA) return null

  if (!kafka) {
    kafka = new Kafka({
      clientId: KAFKA_CLIENT_ID,
      brokers: KAFKA_BROKERS,
    })
  }

  return kafka
}

/**
 * Get or create Kafka producer
 */
async function getProducer(): Promise<Producer | null> {
  if (!USE_KAFKA) return null

  const client = getKafkaClient()
  if (!client) return null

  if (!producer) {
    producer = client.producer()
    await producer.connect()
    console.log('✅ Kafka producer connected')
  }

  return producer
}

/**
 * Get or create Kafka consumer
 */
async function getConsumer(groupId: string): Promise<Consumer | null> {
  if (!USE_KAFKA) return null

  const client = getKafkaClient()
  if (!client) return null

  if (!consumer) {
    consumer = client.consumer({ groupId })
    await consumer.connect()
    console.log('✅ Kafka consumer connected')
  }

  return consumer
}

// Event types
export enum EventType {
  PAGE_CREATED = 'page.created',
  PAGE_UPDATED = 'page.updated',
  PAGE_DELETED = 'page.deleted',
  PAGE_VIEWED = 'page.viewed',
  SEARCH_INDEX_REQUEST = 'search.index.request',
  CACHE_INVALIDATE = 'cache.invalidate',
  MEDIA_UPLOADED = 'media.uploaded',
  MEDIA_DELETED = 'media.deleted',
}

export interface WikiEvent {
  type: EventType
  timestamp: number
  data: any
}

/**
 * Publish an event
 */
export async function publishEvent(event: WikiEvent): Promise<void> {
  if (USE_KAFKA) {
    // Use Kafka
    const kafkaProducer = await getProducer()
    if (!kafkaProducer) {
      console.warn('Kafka not available, using in-memory queue')
      eventQueue.push({ topic: 'wiki-events', message: event })
      processInMemoryEvents()
      return
    }

    try {
      await kafkaProducer.send({
        topic: 'wiki-events',
        messages: [
          {
            key: event.type,
            value: JSON.stringify(event),
          },
        ],
      })
    } catch (error) {
      console.error('Failed to publish event:', error)
    }
  } else {
    // Use in-memory queue
    eventQueue.push({ topic: 'wiki-events', message: event })
    // Process immediately in development
    processInMemoryEvents()
  }
}

/**
 * Process in-memory events (for development)
 */
async function processInMemoryEvents() {
  while (eventQueue.length > 0) {
    const item = eventQueue.shift()
    if (!item) continue

    const handlers = eventHandlers.get(item.topic) || []
    for (const handler of handlers) {
      try {
        await handler(item.message)
      } catch (error) {
        console.error('Event handler error:', error)
      }
    }
  }
}

/**
 * Subscribe to events
 */
export async function subscribeToEvents(
  handler: (event: WikiEvent) => Promise<void>,
  groupId: string = 'wiki-consumers'
): Promise<void> {
  if (USE_KAFKA) {
    // Use Kafka consumer
    const kafkaConsumer = await getConsumer(groupId)
    if (!kafkaConsumer) {
      console.warn('Kafka not available, using in-memory handlers')
      registerInMemoryHandler('wiki-events', handler)
      return
    }

    await kafkaConsumer.subscribe({ topic: 'wiki-events', fromBeginning: false })

    await kafkaConsumer.run({
      eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
        if (message.value) {
          const event: WikiEvent = JSON.parse(message.value.toString())
          await handler(event)
        }
      },
    })
  } else {
    // Use in-memory handlers
    registerInMemoryHandler('wiki-events', handler)
  }
}

/**
 * Register in-memory event handler
 */
function registerInMemoryHandler(topic: string, handler: (message: any) => Promise<void>) {
  const handlers = eventHandlers.get(topic) || []
  handlers.push(handler)
  eventHandlers.set(topic, handlers)
}

/**
 * Disconnect from Kafka
 */
export async function disconnectEvents(): Promise<void> {
  if (producer) {
    await producer.disconnect()
    producer = null
  }
  if (consumer) {
    await consumer.disconnect()
    consumer = null
  }
}

// Event publishing helpers

export async function publishPageCreated(pageId: string, slug: string, title: string) {
  await publishEvent({
    type: EventType.PAGE_CREATED,
    timestamp: Date.now(),
    data: { pageId, slug, title },
  })
}

export async function publishPageUpdated(pageId: string, slug: string, title: string) {
  await publishEvent({
    type: EventType.PAGE_UPDATED,
    timestamp: Date.now(),
    data: { pageId, slug, title },
  })
}

export async function publishPageDeleted(pageId: string, slug: string) {
  await publishEvent({
    type: EventType.PAGE_DELETED,
    timestamp: Date.now(),
    data: { pageId, slug },
  })
}

export async function publishPageViewed(slug: string) {
  await publishEvent({
    type: EventType.PAGE_VIEWED,
    timestamp: Date.now(),
    data: { slug },
  })
}

export async function publishSearchIndexRequest(pageId: string) {
  await publishEvent({
    type: EventType.SEARCH_INDEX_REQUEST,
    timestamp: Date.now(),
    data: { pageId },
  })
}

export async function publishCacheInvalidate(key: string) {
  await publishEvent({
    type: EventType.CACHE_INVALIDATE,
    timestamp: Date.now(),
    data: { key },
  })
}

export async function publishMediaUploaded(mediaId: string, filename: string) {
  await publishEvent({
    type: EventType.MEDIA_UPLOADED,
    timestamp: Date.now(),
    data: { mediaId, filename },
  })
}

export async function publishMediaDeleted(mediaId: string) {
  await publishEvent({
    type: EventType.MEDIA_DELETED,
    timestamp: Date.now(),
    data: { mediaId },
  })
}
