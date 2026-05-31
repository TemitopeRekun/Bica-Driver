/**
 * Location Persistence Queue
 * Enterprise-grade retry mechanism for driver location updates
 * Prevents one transient failure from causing stale location data
 */

export interface LocationUpdate {
  id: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  retryCount: number;
  lastErrorAt?: number;
}

export interface LocationQueueConfig {
  maxRetries: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  batchSize: number; // How many updates to process per batch
  cleanupIntervalMs: number; // How often to prune stale entries
}

export const DEFAULT_LOCATION_QUEUE_CONFIG: LocationQueueConfig = {
  maxRetries: 5,
  initialBackoffMs: 500,
  maxBackoffMs: 5000,
  batchSize: 3,
  cleanupIntervalMs: 30000,
};

/**
 * Manages location update queue with exponential backoff retry logic
 */
export class LocationPersistenceQueue {
  private queue: Map<string, LocationUpdate> = new Map();
  private isProcessing = false;
  private processInterval: ReturnType<typeof setInterval> | null = null;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private metrics = {
    totalEnqueued: 0,
    totalRetried: 0,
    totalFailed: 0,
    totalSucceeded: 0,
  };

  constructor(
    private persistFn: (lat: number, lng: number) => Promise<void>,
    private config: LocationQueueConfig = DEFAULT_LOCATION_QUEUE_CONFIG,
    private onSuccess?: (update: LocationUpdate) => void,
    private onFailure?: (update: LocationUpdate, error: Error) => void
  ) {}

  /**
   * Enqueue a location update for persistence
   */
  public enqueue(latitude: number, longitude: number): string {
    const id = `loc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.queue.set(id, {
      id,
      timestamp: Date.now(),
      latitude,
      longitude,
      retryCount: 0,
    });

    this.metrics.totalEnqueued += 1;

    // Start processing if not already running
    if (!this.isProcessing) {
      this.startProcessing();
    }

    return id;
  }

  /**
   * Start processing queue periodically
   */
  private startProcessing(): void {
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.processQueue();

    // Set up cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleEntries();
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Stop processing queue
   */
  public stop(): void {
    this.isProcessing = false;
    if (this.processInterval) clearInterval(this.processInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    this.queue.clear();
  }

  /**
   * Process queue with batch processing + exponential backoff
   */
  private async processQueue(): Promise<void> {
    if (!this.isProcessing || this.queue.size === 0) return;

    const batch = Array.from(this.queue.values()).slice(0, this.config.batchSize);

    for (const update of batch) {
      await this.processUpdate(update);
    }

    // Schedule next batch with staggered timing to prevent thundering
    if (this.queue.size > 0) {
      this.processInterval = setTimeout(() => this.processQueue(), 1000);
    } else {
      this.isProcessing = false;
    }
  }

  /**
   * Process single location update with retry logic
   */
  private async processUpdate(update: LocationUpdate): Promise<void> {
    try {
      await this.persistFn(update.latitude, update.longitude);
      
      // Success: remove from queue
      this.queue.delete(update.id);
      this.metrics.totalSucceeded += 1;
      this.onSuccess?.(update);

    } catch (error) {
      update.retryCount += 1;
      update.lastErrorAt = Date.now();
      this.metrics.totalRetried += 1;

      if (update.retryCount >= this.config.maxRetries) {
        // Max retries exceeded: remove and report failure
        this.queue.delete(update.id);
        this.metrics.totalFailed += 1;
        this.onFailure?.(update, error instanceof Error ? error : new Error(String(error)));
        
        console.error(
          `[LocationQueue] Location update failed after ${update.retryCount} retries:`,
          error
        );
      } else {
        // Update entry with retry info for next attempt
        this.queue.set(update.id, update);
        console.warn(
          `[LocationQueue] Location update failed (attempt ${update.retryCount}/${this.config.maxRetries}), will retry:`,
          error
        );
      }
    }
  }

  /**
   * Remove stale entries that have been in queue too long (5+ minutes)
   */
  private cleanupStaleEntries(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [id, update] of this.queue.entries()) {
      if (now - update.timestamp > maxAge) {
        this.queue.delete(id);
        this.metrics.totalFailed += 1;
        console.warn(`[LocationQueue] Removed stale entry (${id}) after 5 minutes`);
      }
    }
  }

  /**
   * Get current queue metrics
   */
  public getMetrics() {
    return {
      ...this.metrics,
      currentQueueSize: this.queue.size,
      isProcessing: this.isProcessing,
    };
  }

  /**
   * Get pending updates for debugging
   */
  public getPendingUpdates(): LocationUpdate[] {
    return Array.from(this.queue.values());
  }
}
