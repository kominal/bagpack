import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import Client from 'ssh2-sftp-client';
import { cleanupDirectory, connectToTarget, ensureDirectory, generateFileName, getFileSize } from '../helpers/helpers';
import { Result } from '../helpers/result';

@Injectable()
export class MongoDBService {
	private readonly logger = new Logger(MongoDBService.name);

	public async run(): Promise<Result | undefined> {
		this.logger.log('Running backup process MONGODB...');

		const { MONGODB_CONNECTION_STRING } = process.env;

		if (!MONGODB_CONNECTION_STRING) {
			this.logger.warn('MONGODB_CONNECTION_STRING is not set, skipping backup...');
			return undefined;
		}

		const directory = `${process.env.TARGET_DIRECTORY}/mongodb`;

		try {
			this.logger.log('Ensuring directory exists...');
			const client = await connectToTarget();
			await ensureDirectory(client, directory);
			this.logger.log('Creating new backup...');
			const size = await this.createBackup(client, directory, MONGODB_CONNECTION_STRING);
			this.logger.log('Cleanup up previous backups...');
			const previousSizes = await cleanupDirectory(client, directory);
			this.logger.log('Process completed successfully');
			await client.end();

			return { name: 'MongoDB', success: true, size, previousSizes };
		} catch (error) {
			this.logger.error(error);
			return { name: 'MongoDB', success: false, size: -1, previousSizes: [] };
		}
	}

	private async createBackup(client: Client, directory: string, connectionString: string): Promise<number> {
		const { stdout, stderr } = spawn('timeout', [
			'--kill-after=5s',
			'30m',
			'mongodump',
			'--uri',
			connectionString,
			'--readPreference=secondary',
			'--archive',
			'--gzip',
		]);

		stderr.on('data', (data) => {
			this.logger.error(data.toString());
		});

		const targetFile = `${directory}/${generateFileName('archive.gz')}`;

		await client.put(stdout, targetFile);

		return getFileSize(client, targetFile);
	}
}
