/**
 * Caching layer for RAG retrieval to reduce API calls and improve performance.
 * Implements LRU cache with TTL for embeddings and similarity scores.
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

class LRUCache<T> {
  private map = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private ttlMs: number; // Time to live in milliseconds

  constructor(maxSize: number = 100, ttlMs: number = 1800000) {
    // Default: 100 entries, 30-minute TTL
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  /**
   * Get value from cache if it exists and hasn't expired
   */
  get(key: string): T | null {
    const entry = this.map.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.map.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.map.delete(key);
    this.map.set(key, entry);

    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T) {
    // Remove if exists to update order
    this.map.delete(key);

    // If at capacity, remove least recently used (first entry)
    if (this.map.size >= this.maxSize) {
      const firstKey = this.map.keys().next().value as string | undefined;
      if (firstKey) {
        this.map.delete(firstKey);
      }
    }

    this.map.set(key, { value, timestamp: Date.now() });
  }

  /**
   * Clear all entries
   */
  clear() {
    this.map.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.map.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
    };
  }
}

// Query hash for caching identical RAG queries
function hashQuery(query: string): string {
  // Simple hash: use trimmed query as key
  // In production, could use crypto.subtle.digest for better distribution
  return Buffer.from(query.trim()).toString("base64");
}

// Caches
const embeddingCache = new LRUCache<number[]>(200, 1800000); // 30-minute TTL for embeddings
const retrievalCache = new LRUCache<unknown>(100, 300000); // 5-minute TTL for retrieval results
const sessionMetadataCache = new LRUCache<unknown>(100, 300000); // 5-minute TTL for session metadata

export {
  embeddingCache,
  retrievalCache,
  sessionMetadataCache,
  hashQuery,
  LRUCache,
};
