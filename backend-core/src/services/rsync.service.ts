import { Injectable, Logger } from '@nestjs/common';
import { execSync } from 'child_process';
import {
	cleanupDirectory,
	connectToTarget,
	ensureDirectory,
	generateFileName,
	getFileSize,
	getTargetCredentials,
	getTargetPort,
} from '../helpers/helpers';
import { Result } from '../helpers/result';

@Injectable()
export class RsyncService {
	private readonly logger = new Logger(RsyncService.name);

	public async run(): Promise<Result[]> {
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
			const client = await connectToTarget();
			await ensureDirectory(client, directory);
			this.logger.log('Creating new backup...');
			const results = await this.createBackup(directory, RSYNC__PATHS, syncOnly);
			this.logger.log('Process completed successfully');

			return results;
		} catch (error) {
			this.logger.error(error);
		}

		return [{ name: 'Rsync', success: false, size: -1, previousSizes: [] }];
	}

	private async createBackup(directory: string, paths: string, syncOnly: boolean): Promise<Result[]> {
		const { TARGET_HOST, TARGET_USERNAME } = getTargetCredentials();
		const targetPort = getTargetPort();

		const results: Result[] = [];

		for (const filePath of paths.split(',')) {
			try {
				const [name, path] = filePath.split(':');
				const targetPath = `${directory}/${name}`;
				const targetSyncPath = `${targetPath}/sync`;

				const preClient = await connectToTarget();
				await ensureDirectory(preClient, targetPath);
				await ensureDirectory(preClient, targetSyncPath);
				await preClient.end();

				this.logger.log('Syncing...');
				execSync(
					`rsync -e "ssh -o StrictHostKeyChecking=no -p${targetPort}" -az ${path} ${TARGET_USERNAME}@${TARGET_HOST}:${targetSyncPath}`
				);

				if (syncOnly) {
					results.push({ name: `Rsync - ${name}`, success: true, size: 0, previousSizes: [] });
				} else {
					this.logger.log('Zipping result...');

					const targetFile = `${targetPath}/${generateFileName('zip')}`;

					execSync(
						`ssh -o StrictHostKeyChecking=no -p${targetPort} ${TARGET_USERNAME}@${TARGET_HOST} "zip -qr ${targetFile} ${targetSyncPath}"`
					);
					this.logger.log('Cleanup up previous backups...');

					const postClient = await connectToTarget();
					const previousSizes = await cleanupDirectory(postClient, targetPath);
					const size = await getFileSize(postClient, targetFile);
					await postClient.end();

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
