import { Injectable, Logger } from '@nestjs/common';
import { execSync } from 'child_process';
import { Health } from '../helpers/health';
import { getTargetCredentials } from '../helpers/helpers';

@Injectable()
export class HealthService {
	private readonly logger = new Logger(HealthService.name);

	public async run(): Promise<Health | undefined> {
		const { TARGET_HOST, TARGET_USERNAME, TARGET_PASSWORD } = getTargetCredentials();

		this.logger.log('Loading result...');

		console.log(
			`sshpass -p '${TARGET_PASSWORD}' ssh ${TARGET_USERNAME}@${TARGET_HOST} "df -h | grep '/$' | sed -E 's/^[^%]*\s+([0-9]+)%.*$/\\1/'"`
		);

		const result = execSync(
			`sshpass -p '${TARGET_PASSWORD}' ssh ${TARGET_USERNAME}@${TARGET_HOST} "df -h | grep '/$' | sed -E 's/^[^%]*\s+([0-9]+)%.*$/\\1/'"`
		);

		console.log(`Disk usage result: ${result}`);

		const diskUsage = parseInt(result.toString().trim(), 10);

		return { diskUsage };
	}
}
