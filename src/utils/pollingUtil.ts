/**
 * Enterprise-grade polling utility with exponential backoff + jitter
 * Prevents thundering herd problem and API rate limiting
 */

export interface PollingConfig {
  /** Initial interval in milliseconds */
  initialIntervalMs: number;
  /** Maximum interval in milliseconds */
  maxIntervalMs: number;
  /** Backoff multiplier (e.g., 2 = double each time) */
  backoffMultiplier: number;
  /** Maximum number of poll attempts */
  maxAttempts: number;
  /** Enable random jitter to prevent synchronized polling (0-1) */
  jitterFactor: number;
}

export const DEFAULT_POLLING_CONFIG: PollingConfig = {
  initialIntervalMs: 1000,
  maxIntervalMs: 16000,
  backoffMultiplier: 2,
  maxAttempts: 48,
  jitterFactor: 0.15, // ±15% jitter
};

/**
 * Calculate next poll interval with exponential backoff + jitter
 * Prevents API thundering herd when 100s of users poll simultaneously
 */
export const calculateNextInterval = (
  config: PollingConfig,
  attemptNumber: number
): number => {
  // Exponential backoff: min(initialInterval * multiplier^attempt, maxInterval)
  let interval = Math.min(
    config.initialIntervalMs * Math.pow(config.backoffMultiplier, attemptNumber - 1),
    config.maxIntervalMs
  );

  // Add random jitter: ±jitterFactor of the interval
  const jitterRange = interval * config.jitterFactor;
  const jitter = (Math.random() - 0.5) * 2 * jitterRange;
  
  return Math.max(interval + jitter, config.initialIntervalMs);
};

/**
 * Generic polling orchestrator
 * Handles retry logic, backoff, and metrics
 */
export interface PollMetrics {
  totalAttempts: number;
  successCount: number;
  failureCount: number;
  lastError: Error | null;
  startTime: number;
  elapsedMs: number;
}

export class PollingManager {
  private metrics: PollMetrics = {
    totalAttempts: 0,
    successCount: 0,
    failureCount: 0,
    lastError: null,
    startTime: Date.now(),
    elapsedMs: 0,
  };

  private intervalId: ReturnType<typeof setTimeout> | null = null;
  private isActive = false;

  constructor(
    private pollFn: () => Promise<boolean>, // Returns true if should stop polling
    private config: PollingConfig = DEFAULT_POLLING_CONFIG,
    private onMetricsUpdate?: (metrics: PollMetrics) => void,
    private onError?: (error: Error, attemptNumber: number) => void
  ) {}

  /** Start polling with exponential backoff */
  public start(): void {
    if (this.isActive) return;
    
    this.isActive = true;
    this.metrics = {
      totalAttempts: 0,
      successCount: 0,
      failureCount: 0,
      lastError: null,
      startTime: Date.now(),
      elapsedMs: 0,
    };

    this.executePoll();
  }

  /** Stop polling */
  public stop(): void {
    this.isActive = false;
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
  }

  /** Get current metrics */
  public getMetrics(): PollMetrics {
    return {
      ...this.metrics,
      elapsedMs: Date.now() - this.metrics.startTime,
    };
  }

  private async executePoll(): Promise<void> {
    if (!this.isActive) return;

    this.metrics.totalAttempts += 1;

    try {
      const shouldStop = await this.pollFn();
      this.metrics.successCount += 1;

      if (shouldStop) {
        this.stop();
        return;
      }

      // Check if max attempts exceeded
      if (this.metrics.totalAttempts >= this.config.maxAttempts) {
        this.stop();
        return;
      }

      // Schedule next poll with exponential backoff
      const nextInterval = calculateNextInterval(this.config, this.metrics.totalAttempts);
      this.intervalId = setTimeout(() => this.executePoll(), nextInterval);
    } catch (error) {
      this.metrics.failureCount += 1;
      this.metrics.lastError = error instanceof Error ? error : new Error(String(error));

      this.onError?.(this.metrics.lastError, this.metrics.totalAttempts);

      if (this.metrics.totalAttempts >= this.config.maxAttempts) {
        this.stop();
        return;
      }

      // Retry with exponential backoff
      const nextInterval = calculateNextInterval(this.config, this.metrics.totalAttempts);
      this.intervalId = setTimeout(() => this.executePoll(), nextInterval);
    }

    this.onMetricsUpdate?.(this.getMetrics());
  }
}

/**
 * Hook-friendly polling function
 * Returns cleanup function to stop polling
 */
export const useExponentialBackoffPolling = (
  pollFn: () => Promise<boolean>,
  config: PollingConfig = DEFAULT_POLLING_CONFIG,
  onMetricsUpdate?: (metrics: PollMetrics) => void,
  onError?: (error: Error, attemptNumber: number) => void
): (() => void) => {
  const manager = new PollingManager(pollFn, config, onMetricsUpdate, onError);
  
  manager.start();
  
  return () => manager.stop();
};
