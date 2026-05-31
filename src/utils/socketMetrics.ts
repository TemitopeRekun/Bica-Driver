/**
 * Socket.IO Reconnection Observability & Metrics
 * Enterprise-grade monitoring for WebSocket connection stability
 */

export interface SocketMetrics {
  totalConnections: number;
  totalReconnections: number;
  totalDisconnections: number;
  currentConnectionState: 'connected' | 'disconnected' | 'connecting';
  lastConnectedAt: number | null;
  lastDisconnectedAt: number | null;
  uptime: number; // milliseconds of connected time
  failureReasons: Record<string, number>; // Reason -> count
  reconnectAttempts: number;
  consecutiveFailures: number;
  averageReconnectTime: number; // ms
}

/**
 * Tracks socket reconnection events for observability
 */
export class SocketMetricsCollector {
  private metrics: SocketMetrics = {
    totalConnections: 0,
    totalReconnections: 0,
    totalDisconnections: 0,
    currentConnectionState: 'disconnected',
    lastConnectedAt: null,
    lastDisconnectedAt: null,
    uptime: 0,
    failureReasons: {},
    reconnectAttempts: 0,
    consecutiveFailures: 0,
    averageReconnectTime: 0,
  };

  private connectionStartTime: number | null = null;
  private reconnectAttemptTimes: number[] = [];
  private onMetricsChange?: (metrics: SocketMetrics) => void;

  constructor(onMetricsChange?: (metrics: SocketMetrics) => void) {
    this.onMetricsChange = onMetricsChange;
  }

  /**
   * Record successful connection
   */
  public recordConnect(): void {
    const now = Date.now();
    this.metrics.totalConnections += 1;
    this.metrics.currentConnectionState = 'connected';
    this.metrics.lastConnectedAt = now;
    this.connectionStartTime = now;
    this.metrics.consecutiveFailures = 0;
    this.reconnectAttemptTimes = [];

    console.log('[SocketMetrics] Connected', { total: this.metrics.totalConnections });
    this.notifyChange();
  }

  /**
   * Record disconnect event
   */
  public recordDisconnect(reason: string): void {
    const now = Date.now();
    this.metrics.totalDisconnections += 1;
    this.metrics.currentConnectionState = 'disconnected';
    this.metrics.lastDisconnectedAt = now;

    // Add uptime from this connection
    if (this.connectionStartTime) {
      this.metrics.uptime += now - this.connectionStartTime;
      this.connectionStartTime = null;
    }

    // Track failure reason
    this.metrics.failureReasons[reason] = (this.metrics.failureReasons[reason] || 0) + 1;
    this.metrics.consecutiveFailures += 1;

    console.log('[SocketMetrics] Disconnected', { reason, total: this.metrics.totalDisconnections });
    this.notifyChange();
  }

  /**
   * Record reconnection attempt
   */
  public recordReconnectAttempt(): void {
    this.metrics.currentConnectionState = 'connecting';
    this.metrics.reconnectAttempts += 1;
    this.reconnectAttemptTimes.push(Date.now());

    console.log('[SocketMetrics] Reconnect attempt', { attempt: this.metrics.reconnectAttempts });
    this.notifyChange();
  }

  /**
   * Calculate average reconnect time
   */
  private updateAverageReconnectTime(): void {
    if (this.reconnectAttemptTimes.length < 2) return;

    let totalTime = 0;
    for (let i = 1; i < this.reconnectAttemptTimes.length; i++) {
      totalTime += this.reconnectAttemptTimes[i] - this.reconnectAttemptTimes[i - 1];
    }

    this.metrics.averageReconnectTime = Math.round(totalTime / (this.reconnectAttemptTimes.length - 1));
  }

  /**
   * Get current metrics snapshot
   */
  public getMetrics(): SocketMetrics {
    this.updateAverageReconnectTime();
    return { ...this.metrics };
  }

  /**
   * Get health status
   */
  public getHealthStatus(): 'healthy' | 'degraded' | 'critical' {
    if (this.metrics.currentConnectionState === 'connected') return 'healthy';
    if (this.metrics.consecutiveFailures > 3) return 'critical';
    if (this.metrics.consecutiveFailures > 1) return 'degraded';
    return 'healthy';
  }

  /**
   * Reset metrics (e.g., on logout)
   */
  public reset(): void {
    this.metrics = {
      totalConnections: 0,
      totalReconnections: 0,
      totalDisconnections: 0,
      currentConnectionState: 'disconnected',
      lastConnectedAt: null,
      lastDisconnectedAt: null,
      uptime: 0,
      failureReasons: {},
      reconnectAttempts: 0,
      consecutiveFailures: 0,
      averageReconnectTime: 0,
    };
    this.connectionStartTime = null;
    this.reconnectAttemptTimes = [];
  }

  private notifyChange(): void {
    this.onMetricsChange?.(this.getMetrics());
  }
}

/**
 * Global socket metrics instance (singleton)
 */
let globalSocketMetrics: SocketMetricsCollector | null = null;

export const getSocketMetricsCollector = (): SocketMetricsCollector => {
  if (!globalSocketMetrics) {
    globalSocketMetrics = new SocketMetricsCollector();
  }
  return globalSocketMetrics;
};
