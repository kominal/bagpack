import { Injectable, Logger } from '@nestjs/common';
import { execSync } from 'child_process';
import Client from 'ssh2-sftp-client';
import { cleanupDirectory, ensureDirectory, generateFileName, getFileSize, getTargetCredentials } from '../helpers/helpers';
import { Result } from '../helpers/result';

@Injectable()
export class RsyncService {
	private readonly logger = new Logger(RsyncService.name);

	public async run(client: Client): Promise<Result[]> {
		this.logger.log('Running backup process RSYNC...');

		const { RSYNC__PATHS, RSYNC__MODE } = process.env;

		if (!RSYNC__PATHS) {
			this.logger.warn('RSYNC__PATHS is not set, skipping backup...');
			return [];
		}

		const directory = `${process.env.TARGET_DIRECTORY}/rsync`;

		const syncOnly = RSYNC__MODE === 'SYNC_ONLY';

		try {
			this.logger.log('Ensuring directory exists...');
			await ensureDirectory(client, directory);
			this.logger.log('Creating new backup...');
			const results = await this.createBackup(client, directory, RSYNC__PATHS, syncOnly);
			this.logger.log('Process completed successfully');

			return results;
		} catch (error) {
			this.logger.error(error);
		}

		return [];
	}

	private async createBackup(client: Client, directory: string, paths: string, syncOnly: boolean): Promise<Result[]> {
		const { TARGET_HOST, TARGET_USERNAME } = getTargetCredentials();

		const results: Result[] = [];

		for (const filePath of paths.split(',')) {
			try {
				const [name, path] = filePath.split(':');
				const targetPath = `${directory}/${name}`;
				await ensureDirectory(client, targetPath);
				const targetSyncPath = `${targetPath}/sync`;
				await ensureDirectory(client, targetSyncPath);
				this.logger.log('Syncing...');
				execSync(`rsync -e "ssh -o StrictHostKeyChecking=no" -az ${path} ${TARGET_USERNAME}@${TARGET_HOST}:${targetSyncPath}`);

				if (!syncOnly) {
					results.push({ name: `Rsync - ${name}`, success: true, size: 0, previousSizes: 0 });
				} else {
					this.logger.log('Zipping result...');

					const targetFile = `${targetPath}/${generateFileName('zip')}`;

					execSync(`ssh -o StrictHostKeyChecking=no ${TARGET_USERNAME}@${TARGET_HOST} "zip -qr ${targetFile} ${targetSyncPath}"`);
					this.logger.log('Cleanup up previous backups...');
					const previousSizes = await cleanupDirectory(client, targetPath);

					const size = await getFileSize(client, targetFile);

					results.push({ name: `Rsync - ${name}`, success: true, size, previousSizes });
				}
			} catch (e) {
				this.logger.error(e);
				results.push({ name: `Rsync - ${filePath}`, success: false, size: -1, previousSizes: [] });
			}
		}

		return results;
	}
}
