import { Injectable, Logger } from '@nestjs/common';
import { execSync } from 'child_process';
import Client from 'ssh2-sftp-client';
import { cleanupDirectory, connectToTarget, ensureDirectory, getTargetCredentials } from '../helpers/helpers';

@Injectable()
export class RsyncService {
	private readonly logger = new Logger(RsyncService.name);

	public async run(): Promise<void> {
		this.logger.log('Running backup process FILE...');

		const { RSYNC__PATHS } = process.env;

		if (!RSYNC__PATHS) {
			this.logger.warn('RSYNC__PATHS is not set, skipping backup...');
			return;
		}

		const directory = `${process.env.TARGET_DIRECTORY}/rsync`;

		const client = new Client();

		try {
			this.logger.log('Connecting to target...');
			await connectToTarget(client);
			this.logger.log('Ensuring directory exists...');
			await ensureDirectory(client, directory);
			this.logger.log('Creating new backup...');
			await this.createBackup(client, directory, RSYNC__PATHS);
			this.logger.log('Cleanup up previous backups...');
			await cleanupDirectory(client, directory);
			this.logger.log('Process completed successfully');
		} catch (error) {
			this.logger.error(error);
		} finally {
			await client.end();
		}
	}

	private async createBackup(client: Client, directory: string, paths: string): Promise<void> {
		const { TARGET_HOST, TARGET_USERNAME, TARGET_PASSWORD } = getTargetCredentials();

		for (const filePath of paths.split(',')) {
			const [name, path] = filePath.split(':');
			const targetPath = `${directory}/${name}`;
			await ensureDirectory(client, targetPath);
			execSync(`sshpass -p '${TARGET_PASSWORD}' rsync -az ${path} ${TARGET_USERNAME}@${TARGET_HOST}:${targetPath}`);
		}
	}
}
