import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import Client from 'ssh2-sftp-client';
import { cleanupDirectory, connectToTarget, ensureDirectory, generateFileName } from '../helpers/helpers';

@Injectable()
export class MongoDBService {
	private readonly logger = new Logger(MongoDBService.name);

	public async run(): Promise<void> {
		this.logger.log('Running backup process MONGODB...');

		const { MONGODB_CONNECTION_STRING } = process.env;

		if (!MONGODB_CONNECTION_STRING) {
			this.logger.warn('MONGODB_CONNECTION_STRING is not set, skipping backup...');
			return;
		}

		const directory = `${process.env.TARGET_DIRECTORY}/mongodb`;

		const client = new Client();

		try {
			this.logger.log('Connecting to target...');
			await connectToTarget(client);
			this.logger.log('Ensuring directory exists...');
			await ensureDirectory(client, directory);
			this.logger.log('Creating new backup...');
			await this.createBackup(client, directory, MONGODB_CONNECTION_STRING);
			this.logger.log('Cleanup up previous backups...');
			await cleanupDirectory(client, directory);
			this.logger.log('Process completed successfully');
		} catch (error) {
			this.logger.error(error);
		} finally {
			await client.end();
		}
	}

	private async createBackup(client: Client, directory: string, connectionString: string): Promise<string> {
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

		return client.put(stdout, `${directory}/${generateFileName('archive.gz')}`);
	}
}
