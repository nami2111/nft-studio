// src/lib/utils/performance-analyzer.ts

export interface GenerationMetrics {
  algorithm: string;
  collectionComplexity: string;
  startTime: number;
  totalGenerationTime: number;
  imageCompositionTime: number;
  traitSelectionTime: number;
  constraintValidationTime: number;
  progressUpdateTime: number;
  itemsGenerated: number;
  memoryUsage: MemorySnapshot[];
  cacheHitRate: number;
  workerCount: number;
}

export interface MemorySnapshot {
  used: number;
  total: number;
  limit: number;
  timestamp: number;
}

export interface PerformanceReport {
  algorithm: string;
  complexity: string;
  totalTime: number;
  timeBreakdown: {
    imageComposition: number;
    traitSelection: number;
    constraintValidation: number;
    progressUpdates: number;
    other: number;
  };
  memoryUsage: {
    peak: number;
    average: number;
    snapshots: number;
  };
  performanceMetrics: {
    itemsPerSecond: number;
    timePerItem: number;
    cacheEfficiency: number;
  };
  performanceRating: 'excellent' | 'good' | 'fair' | 'poor';
  recommendations: string[];
  comparisonToBaseline?: {
    speedImprovement: number;
    memoryImprovement: number;
  };
}

/**
 * Performance Analyzer for NFT Generation
 * Tracks and analyzes generation performance to identify bottlenecks
 * and measure the effectiveness of optimizations
 */
export class PerformanceAnalyzer {
  private currentMetrics: GenerationMetrics | null = null;
  private baselineMetrics: GenerationMetrics | null = null;
  private memoryCheckInterval: number | null = null;

  /**
   * Start performance analysis for a generation task
   */
  startAnalysis(algorithm: string, complexity: string, workerCount: number): void {
    this.currentMetrics = {
      algorithm,
      collectionComplexity: complexity,
      startTime: performance.now(),
      totalGenerationTime: 0,
      imageCompositionTime: 0,
      traitSelectionTime: 0,
      constraintValidationTime: 0,
      progressUpdateTime: 0,
      itemsGenerated: 0,
      memoryUsage: [],
      cacheHitRate: 0,
      workerCount
    };

    // Start memory monitoring
    this.startMemoryMonitoring();

    console.log(`📊 Performance analysis started: ${algorithm} on ${complexity} collection`);
  }

  /**
   * Record image composition time
   */
  recordImageComposition(duration: number): void {
    if (this.currentMetrics) {
      this.currentMetrics.imageCompositionTime += duration;
    }
  }

  /**
   * Record trait selection time
   */
  recordTraitSelection(duration: number): void {
    if (this.currentMetrics) {
      this.currentMetrics.traitSelectionTime += duration;
    }
  }

  /**
   * Record constraint validation time
   */
  recordConstraintValidation(duration: number): void {
    if (this.currentMetrics) {
      this.currentMetrics.constraintValidationTime += duration;
    }
  }

  /**
   * Record progress update time
   */
  recordProgressUpdate(duration: number): void {
    if (this.currentMetrics) {
      this.currentMetrics.progressUpdateTime += duration;
    }
  }

  /**
   * Record item generation completion
   */
  recordItemGenerated(): void {
    if (this.currentMetrics) {
      this.currentMetrics.itemsGenerated++;
    }
  }

  /**
   * Record cache hit rate
   */
  recordCacheHitRate(hitRate: number): void {
    if (this.currentMetrics) {
      this.currentMetrics.cacheHitRate = hitRate;
    }
  }

  /**
   * Start monitoring memory usage
   */
  private startMemoryMonitoring(): void {
    this.takeMemorySnapshot();
    
    // Monitor every 5 seconds during generation
    if (typeof window !== 'undefined' && 'setInterval' in window) {
      this.memoryCheckInterval = window.setInterval(() => {
        this.takeMemorySnapshot();
      }, 5000);
    }
  }

  /**
   * Take a memory usage snapshot
   */
  private takeMemorySnapshot(): void {
    if (!this.currentMetrics) return;

    if ('memory' in performance) {
      const mem = (performance as any).memory;
      const snapshot: MemorySnapshot = {
        used: mem.usedJSHeapSize,
        total: mem.totalJSHeapSize,
        limit: mem.jsHeapSizeLimit,
        timestamp: Date.now()
      };

      this.currentMetrics.memoryUsage.push(snapshot);
      
      // Keep only last 100 snapshots to prevent memory bloat
      if (this.currentMetrics.memoryUsage.length > 100) {
        this.currentMetrics.memoryUsage.shift();
      }
    }
  }

  /**
   * Stop analysis and generate report
   */
  stopAnalysis(): PerformanceReport {
    if (!this.currentMetrics) {
      throw new Error('No active performance analysis');
    }

    // Stop memory monitoring
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }

    const totalTime = performance.now() - this.currentMetrics.startTime;
    this.currentMetrics.totalGenerationTime = totalTime;

    const report = this.generateReport(this.currentMetrics);
    
    console.log('📊 Performance report generated:', report);
    
    return report;
  }

  /**
   * Generate comprehensive performance report
   */
  private generateReport(metrics: GenerationMetrics): PerformanceReport {
    const itemsPerSecond = metrics.itemsGenerated / (metrics.totalGenerationTime / 1000);
    const timePerItem = metrics.totalGenerationTime / metrics.itemsGenerated;

    // Calculate time breakdown percentages
    const timeBreakdown = {
      imageComposition: (metrics.imageCompositionTime / metrics.totalGenerationTime) * 100,
      traitSelection: (metrics.traitSelectionTime / metrics.totalGenerationTime) * 100,
      constraintValidation: (metrics.constraintValidationTime / metrics.totalGenerationTime) * 100,
      progressUpdates: (metrics.progressUpdateTime / metrics.totalGenerationTime) * 100,
      other: 100 - (
        (metrics.imageCompositionTime + 
         metrics.traitSelectionTime + 
         metrics.constraintValidationTime + 
         metrics.progressUpdateTime) / metrics.totalGenerationTime * 100
      )
    };

    // Calculate memory usage statistics
    const memoryUsage = {
      peak: Math.max(...metrics.memoryUsage.map(m => m.used)),
      average: metrics.memoryUsage.length > 0 
        ? metrics.memoryUsage.reduce((sum, m) => sum + m.used, 0) / metrics.memoryUsage.length 
        : 0,
      snapshots: metrics.memoryUsage.length
    };

    // Determine performance rating
    const performanceRating = this.calculatePerformanceRating(itemsPerSecond, metrics.collectionComplexity);

    // Generate recommendations
    const recommendations = this.generateRecommendations(metrics, timeBreakdown, itemsPerSecond);

    // Calculate comparison to baseline if available
    const comparisonToBaseline = this.calculateBaselineComparison(metrics);

    return {
      algorithm: metrics.algorithm,
      complexity: metrics.collectionComplexity,
      totalTime: metrics.totalGenerationTime,
      timeBreakdown,
      memoryUsage,
      performanceMetrics: {
        itemsPerSecond,
        timePerItem,
        cacheEfficiency: metrics.cacheHitRate
      },
      performanceRating,
      recommendations,
      comparisonToBaseline
    };
  }

  /**
   * Calculate performance rating based on throughput and collection complexity
   */
  private calculatePerformanceRating(
    itemsPerSecond: number, 
    complexity: string
  ): 'excellent' | 'good' | 'fair' | 'poor' {
    const complexityMultiplier = {
      'simple': 1.0,
      'medium': 0.7,
      'complex': 0.4
    };

    const adjustedThroughput = itemsPerSecond / (complexityMultiplier[complexity as keyof typeof complexityMultiplier] || 0.5);

    if (adjustedThroughput > 50) return 'excellent';
    if (adjustedThroughput > 20) return 'good';
    if (adjustedThroughput > 5) return 'fair';
    return 'poor';
  }

  /**
   * Generate performance improvement recommendations
   */
  private generateRecommendations(
    metrics: GenerationMetrics, 
    timeBreakdown: any, 
    itemsPerSecond: number
  ): string[] {
    const recommendations: string[] = [];

    // Performance-based recommendations
    if (itemsPerSecond < 5) {
      recommendations.push('⚠️ Generation speed is slow. Consider using fast generation mode for simple collections.');
      recommendations.push('🔧 Enable parallel canvas composition for better performance.');
    }

    if (timeBreakdown.imageComposition > 60) {
      recommendations.push('🖼️ Image composition dominates processing time (60%+). Consider parallel composition.');
    }

    if (timeBreakdown.constraintValidation > 30) {
      recommendations.push('🧠 Constraint validation is slow (30%+). Consider simplifying rules or using fast validation.');
    }

    if (timeBreakdown.progressUpdates > 10) {
      recommendations.push('📊 Progress updates consume significant time (10%+). Enable batched progress updates.');
    }

    // Memory-based recommendations
    const peakMemory = Math.max(...metrics.memoryUsage.map(m => m.used));
    if (peakMemory > 500 * 1024 * 1024) { // 500MB
      recommendations.push('💾 High memory usage detected. Consider batch processing for large collections.');
    }

    if (metrics.cacheHitRate < 0.5) {
      recommendations.push('🎯 Low cache hit rate (50%). Consider adjusting cache size or algorithm.');
    }

    // Worker count recommendations
    if (metrics.workerCount < (navigator.hardwareConcurrency || 4) * 0.5) {
      recommendations.push('⚡ Underutilizing available CPU cores. Consider increasing worker count.');
    }

    // Algorithm-specific recommendations
    if (metrics.algorithm === 'existing-sophisticated' && metrics.collectionComplexity === 'simple') {
      recommendations.push('🚀 Simple collection detected. Fast generation could provide 3-5x speed improvement.');
    }

    return recommendations;
  }

  /**
   * Compare current performance to baseline
   */
  private calculateBaselineComparison(metrics: GenerationMetrics) {
    if (!this.baselineMetrics) {
      // Set current as baseline for future comparisons
      this.baselineMetrics = { ...metrics };
      return undefined;
    }

    const speedImprovement = this.baselineMetrics.itemsGenerated / (this.baselineMetrics.totalGenerationTime / 1000);
    const currentSpeed = metrics.itemsGenerated / (metrics.totalGenerationTime / 1000);

    const memoryImprovement = this.baselineMetrics.memoryUsage.length > 0 
      ? Math.max(...this.baselineMetrics.memoryUsage.map(m => m.used))
      : 0;
    const currentMemory = Math.max(...metrics.memoryUsage.map(m => m.used));

    return {
      speedImprovement: currentSpeed / speedImprovement,
      memoryImprovement: currentMemory / memoryImprovement
    };
  }

  /**
   * Set baseline metrics for future comparisons
   */
  setBaseline(metrics: GenerationMetrics): void {
    this.baselineMetrics = { ...metrics };
    console.log('📏 Performance baseline set for future comparisons');
  }

  /**
   * Clear all metrics and reset analyzer
   */
  clear(): void {
    this.currentMetrics = null;
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
    console.log('🧹 Performance analyzer cleared');
  }

  /**
   * Get current analysis status
   */
  getStatus(): {
    isActive: boolean;
    algorithm?: string;
    complexity?: string;
    elapsedTime: number;
    itemsPerSecond: number;
  } {
    if (!this.currentMetrics) {
      return {
        isActive: false,
        elapsedTime: 0,
        itemsPerSecond: 0
      };
    }

    const elapsedTime = performance.now() - this.currentMetrics.startTime;
    const itemsPerSecond = this.currentMetrics.itemsGenerated / (elapsedTime / 1000);

    return {
      isActive: true,
      algorithm: this.currentMetrics.algorithm,
      complexity: this.currentMetrics.collectionComplexity,
      elapsedTime,
      itemsPerSecond
    };
  }
}

// Global performance analyzer instance
export const performanceAnalyzer = new PerformanceAnalyzer();

// Convenience functions for easy use
export function startPerformanceAnalysis(
  algorithm: string, 
  complexity: string, 
  workerCount: number = 1
): void {
  performanceAnalyzer.startAnalysis(algorithm, complexity, workerCount);
}

export function recordImageComposition(duration: number): void {
  performanceAnalyzer.recordImageComposition(duration);
}

export function recordTraitSelection(duration: number): void {
  performanceAnalyzer.recordTraitSelection(duration);
}

export function recordConstraintValidation(duration: number): void {
  performanceAnalyzer.recordConstraintValidation(duration);
}

export function recordItemGenerated(): void {
  performanceAnalyzer.recordItemGenerated();
}

export function stopPerformanceAnalysis(): PerformanceReport {
  return performanceAnalyzer.stopAnalysis();
}

export function getPerformanceStatus() {
  return performanceAnalyzer.getStatus();
}