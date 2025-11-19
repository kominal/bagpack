import { Injectable, Logger } from '@nestjs/common';
import { execSync } from 'child_process';
import { Health } from '../helpers/health';
import { getTargetCredentials } from '../helpers/helpers';

@Injectable()
export class HealthService {
	private readonly logger = new Logger(HealthService.name);

	public async run(): Promise<Health> {
		const { TARGET_HOST, TARGET_USERNAME } = getTargetCredentials();

		this.logger.log('Loading result...');

		try {
			const result = execSync(`ssh ${TARGET_USERNAME}@${TARGET_HOST} "df -h | grep '/$' | sed -E 's/^[^%]*\s+([0-9]+)%.*$/\\1/'"`);

			const diskUsage = parseInt(result.toString().trim(), 10);

			return { success: true, diskUsage };
		} catch (e) {
			this.logger.error('Failed to get disk usage from target', e);
			return { success: false, diskUsage: -1 };
		}
	}
}
