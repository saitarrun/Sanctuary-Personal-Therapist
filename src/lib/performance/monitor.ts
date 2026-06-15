/**
 * Performance monitoring utilities for tracking metrics across the app.
 * Non-intrusive monitoring with < 5% overhead.
 */

export interface PerformanceMetrics {
  apiLatency: number[]; // milliseconds
  shaderRenderTime: number[]; // milliseconds
  ragRetrievalTime: number[]; // milliseconds
  databaseQueryTime: number[]; // milliseconds
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    apiLatency: [],
    shaderRenderTime: [],
    ragRetrievalTime: [],
    databaseQueryTime: [],
  };

  private maxSamples = 100; // Keep last 100 samples

  /**
   * Record API latency (e.g., chat endpoint response time)
   */
  recordApiLatency(ms: number) {
    this.metrics.apiLatency.push(ms);
    if (this.metrics.apiLatency.length > this.maxSamples) {
      this.metrics.apiLatency.shift();
    }
  }

  /**
   * Record shader render time per frame
   */
  recordShaderRenderTime(ms: number) {
    this.metrics.shaderRenderTime.push(ms);
    if (this.metrics.shaderRenderTime.length > this.maxSamples) {
      this.metrics.shaderRenderTime.shift();
    }
  }

  /**
   * Record RAG retrieval time
   */
  recordRagRetrievalTime(ms: number) {
    this.metrics.ragRetrievalTime.push(ms);
    if (this.metrics.ragRetrievalTime.length > this.maxSamples) {
      this.metrics.ragRetrievalTime.shift();
    }
  }

  /**
   * Record database query time
   */
  recordDatabaseQueryTime(ms: number) {
    this.metrics.databaseQueryTime.push(ms);
    if (this.metrics.databaseQueryTime.length > this.maxSamples) {
      this.metrics.databaseQueryTime.shift();
    }
  }

  /**
   * Calculate percentile from array of measurements
   */
  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get performance summary: p50, p95, p99
   */
  getMetricsSummary() {
    return {
      apiLatency: {
        p50: this.percentile(this.metrics.apiLatency, 50),
        p95: this.percentile(this.metrics.apiLatency, 95),
        p99: this.percentile(this.metrics.apiLatency, 99),
        count: this.metrics.apiLatency.length,
      },
      shaderRenderTime: {
        p50: this.percentile(this.metrics.shaderRenderTime, 50),
        p95: this.percentile(this.metrics.shaderRenderTime, 95),
        p99: this.percentile(this.metrics.shaderRenderTime, 99),
        count: this.metrics.shaderRenderTime.length,
      },
      ragRetrievalTime: {
        p50: this.percentile(this.metrics.ragRetrievalTime, 50),
        p95: this.percentile(this.metrics.ragRetrievalTime, 95),
        p99: this.percentile(this.metrics.ragRetrievalTime, 99),
        count: this.metrics.ragRetrievalTime.length,
      },
      databaseQueryTime: {
        p50: this.percentile(this.metrics.databaseQueryTime, 50),
        p95: this.percentile(this.metrics.databaseQueryTime, 95),
        p99: this.percentile(this.metrics.databaseQueryTime, 99),
        count: this.metrics.databaseQueryTime.length,
      },
    };
  }

  /**
   * Check for performance issues and log warnings
   */
  checkAlerts() {
    const summary = this.getMetricsSummary();

    // Alert if p99 latency > 5 seconds
    if (summary.apiLatency.p99 > 5000 && summary.apiLatency.count > 5) {
      console.warn(
        `[Performance] High API latency: p99=${summary.apiLatency.p99.toFixed(0)}ms`
      );
    }

    // Alert if average shader render time indicates frame drops < 30 FPS
    const avgShaderTime = this.metrics.shaderRenderTime.length
      ? this.metrics.shaderRenderTime.reduce((a, b) => a + b, 0) /
        this.metrics.shaderRenderTime.length
      : 0;
    const fps = avgShaderTime > 0 ? 1000 / avgShaderTime : 60;
    if (fps < 30 && this.metrics.shaderRenderTime.length > 10) {
      console.warn(
        `[Performance] Low FPS detected: ${fps.toFixed(1)} FPS (render time: ${avgShaderTime.toFixed(1)}ms)`
      );
    }
  }

  /**
   * Reset metrics (e.g., for fresh session)
   */
  reset() {
    this.metrics = {
      apiLatency: [],
      shaderRenderTime: [],
      ragRetrievalTime: [],
      databaseQueryTime: [],
    };
  }
}

// Global singleton
const monitor = new PerformanceMonitor();

export function getMonitor() {
  return monitor;
}
