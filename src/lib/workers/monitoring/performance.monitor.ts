/**
 * Enhanced performance tracking for sequential processing
 */
export class SequentialPerformanceMonitor {
    private startTime = 0;
    private processedCount = 0;
    private lastReportTime = 0;
    private averageProcessingTime = 0;
    private totalCount = 0;

    start(totalCount: number): void {
        this.startTime = Date.now();
        this.processedCount = 0;
        this.lastReportTime = this.startTime;
        this.averageProcessingTime = 0;
        this.totalCount = totalCount;
        console.log(`🚀 Sequential Generation Started: Target ${totalCount} NFTs`);
    }

    recordProcessing(timePerItem: number): void {
        this.processedCount++;

        // Update running average
        this.averageProcessingTime =
            (this.averageProcessingTime * (this.processedCount - 1) + timePerItem) / this.processedCount;

        const now = Date.now();
        if (now - this.lastReportTime > 2000) {
            // Report every 2 seconds
            const elapsed = now - this.startTime;
            const rate = this.processedCount / (elapsed / 1000);
            const remaining = Math.max(0, this.totalCount - this.processedCount);
            const eta = (this.averageProcessingTime * remaining) / 1000 / 60;

            console.log(
                `⚡ Sequential Performance: ${this.processedCount}/${this.totalCount} NFTs | ` +
                `${rate.toFixed(1)} NFTs/sec | ETA: ${eta.toFixed(1)}min | ` +
                `Avg: ${this.averageProcessingTime.toFixed(1)}ms/item`
            );
            this.lastReportTime = now;
        }
    }

    finish(): void {
        const totalTime = Date.now() - this.startTime;
        const finalRate = this.processedCount / (totalTime / 1000);
        console.log(
            `🎯 Sequential Generation Complete: ${this.processedCount} NFTs in ${(totalTime / 1000).toFixed(1)}s | ` +
            `Average: ${finalRate.toFixed(1)} NFTs/sec`
        );
    }
}
