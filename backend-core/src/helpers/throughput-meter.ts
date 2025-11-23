import { Logger } from '@nestjs/common';
import { Transform } from 'stream';

export class ThroughputMeter extends Transform {
	private readonly logger = new Logger(ThroughputMeter.name);

	private totalBytes: number;
	private startTime: number;
	private reportInterval: number;
	private lastReportTime: number;
	private intervalId: NodeJS.Timeout;
	private lastBytesReported: number | null = null;

	constructor(options: { reportInterval?: number } = {}) {
		super();
		this.totalBytes = 0;
		this.startTime = Date.now();
		this.reportInterval = options.reportInterval || 2000; // Report every 2 seconds
		this.lastReportTime = this.startTime;

		// Set up an interval to report progress
		this.intervalId = setInterval(this.reportProgress.bind(this), this.reportInterval);
	}

	_transform(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
		this.totalBytes += chunk.length;
		// Pass the chunk through immediately
		this.push(chunk);
		callback();
	}

	_flush(callback: (error?: Error | null) => void) {
		// Report final metrics when the stream ends
		this.reportProgress();
		// Clear the interval
		clearInterval(this.intervalId);
		callback();
	}

	reportProgress() {
		const currentTime = Date.now();
		const elapsedTime = (currentTime - this.startTime) / 1000; // Time in seconds
		const currentDuration = (currentTime - this.lastReportTime) / 1000; // Duration since last report

		// Calculate MB/s
		const totalMB = this.totalBytes / (1024 * 1024);

		// Calculate the instantaneous rate since the last report
		// This is more useful for real-time monitoring
		const bytesSinceLastReport = this.totalBytes - (this.lastBytesReported || 0);
		const rateMBps = bytesSinceLastReport / (1024 * 1024) / currentDuration;

		this.logger.log(
			`Throughput Meter - Elapsed Time: ${elapsedTime.toFixed(2)}s, Total Data: ${totalMB.toFixed(2)} MB, Instantaneous Rate: ${rateMBps.toFixed(2)} MB/s`
		);

		// Update state for the next report
		this.lastReportTime = currentTime;
		this.lastBytesReported = this.totalBytes;
	}
}
