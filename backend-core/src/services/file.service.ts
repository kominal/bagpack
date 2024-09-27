import { Injectable, Logger } from '@nestjs/common';
import archiver from 'archiver';
import Client from 'ssh2-sftp-client';
import { pipeline } from 'stream/promises';
import { cleanupDirectory, connectToTarget, ensureDirectory, generateFileName } from '../helpers/helpers';

@Injectable()
export class FileService {
	private readonly logger = new Logger(FileService.name);

	public async run(): Promise<void> {
		this.logger.log('Running backup process FILE...');

		const { FILE_PATHS } = process.env;

		if (!FILE_PATHS) {
			this.logger.warn('FILE_PATHS is not set, skipping backup...');
			return;
		}

		const directory = `${process.env.TARGET_DIRECTORY}/file`;

		const client = new Client();

		try {
			this.logger.log('Connecting to target...');
			await connectToTarget(client);
			this.logger.log('Ensuring directory exists...');
			await ensureDirectory(client, directory);
			this.logger.log('Creating new backup...');
			await this.createBackup(client, directory, FILE_PATHS);
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
		const archive = archiver('zip', {
			zlib: { level: 9 },
		});

		const output = client.createWriteStream(`${directory}/${generateFileName('zip')}`);

		archive.on('warning', (err) => {
			if (err.code === 'ENOENT') {
				console.log('warning', err);
			} else {
				throw err;
			}
		});
		archive.on('error', (err) => {
			throw err;
		});

		for (const filePath of paths.split(',')) {
			const [name, path] = filePath.split(':');
			archive.directory(path, name);
		}

		archive.finalize();

		await pipeline(archive, output);

		output.end();

		this.logger.log('Archive created successfully');
	}
}
