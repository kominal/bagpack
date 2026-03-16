import { Injectable, Logger } from '@nestjs/common';
import archiver from 'archiver';
import Client from 'ssh2-sftp-client';
import { pipeline } from 'stream/promises';
import { cleanupDirectory, connectToTarget, ensureDirectory, generateFileName, getFileSize } from '../helpers/helpers';
import { Result } from '../helpers/result';

@Injectable()
export class FileService {
	private readonly logger = new Logger(FileService.name);

	public async run(): Promise<Result | undefined> {
		this.logger.log('Running backup process FILE...');

		const { FILE_PATHS } = process.env;

		if (!FILE_PATHS) {
			this.logger.warn('FILE_PATHS is not set, skipping backup...');
			return undefined;
		}

		const directory = `${process.env.TARGET_DIRECTORY}/file`;

		try {
			this.logger.log('Ensuring directory exists...');
			const client = await connectToTarget();
			await ensureDirectory(client, directory);
			this.logger.log('Creating new backup...');
			const size = await this.createBackup(client, directory, FILE_PATHS);
			this.logger.log('Cleanup up previous backups...');
			const previousSizes = await cleanupDirectory(client, directory);
			this.logger.log('Process completed successfully');
			await client.end();

			return { name: 'File', success: true, size, previousSizes };
		} catch (error) {
			this.logger.error(error);
		}

		return { name: 'File', success: false, size: -1, previousSizes: [] };
	}

	private async createBackup(client: Client, directory: string, paths: string): Promise<number> {
		const archive = archiver('zip');

		const targetFile = `${directory}/${generateFileName('zip')}`;

		const output = client.createWriteStream(targetFile);

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

		return getFileSize(client, targetFile);
	}
}
