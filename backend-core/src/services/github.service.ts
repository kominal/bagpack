import { Injectable, Logger } from '@nestjs/common';
import archiver from 'archiver';
import { Octokit } from 'octokit';
import simpleGit from 'simple-git';
import Client from 'ssh2-sftp-client';
import { pipeline } from 'stream/promises';
import { dirSync } from 'tmp';
import { cleanupDirectory, ensureDirectory, generateFileName, getFileSize } from '../helpers/helpers';
import { Result } from '../helpers/result';
import { ThroughputMeter } from '../helpers/throughput-meter';

@Injectable()
export class GitHubService {
	private readonly logger = new Logger(GitHubService.name);

	public async run(client: Client): Promise<Result | undefined> {
		this.logger.log('Running backup process GITHUB...');

		const { GITHUB_ORGANIZATION, GITHUB_PASSWORD } = process.env;

		if (!GITHUB_ORGANIZATION || !GITHUB_PASSWORD) {
			this.logger.warn('GITHUB_ORGANIZATION or GITHUB_PASSWORD is not set, skipping backup...');
			return undefined;
		}

		const directory = `${process.env.TARGET_DIRECTORY}/github`;

		try {
			this.logger.log('Ensuring directory exists...');
			await ensureDirectory(client, directory);
			this.logger.log('Creating new backup...');
			const size = await this.createBackup(client, directory, GITHUB_ORGANIZATION, GITHUB_PASSWORD);
			this.logger.log('Cleanup up previous backups...');
			const previousSizes = await cleanupDirectory(client, directory);
			this.logger.log('Process completed successfully');

			return { name: 'GitHub', success: true, size, previousSizes };
		} catch (error) {
			this.logger.error(error);
		}

		return { name: 'GitHub', success: false, size: -1, previousSizes: [] };
	}

	private async createBackup(client: Client, directory: string, organization: string, password: string): Promise<number> {
		const octokit = new Octokit({ auth: password });

		this.logger.log('Reading repositories from GitHub...');

		const repositories = await octokit.request('GET /orgs/{org}/repos', {
			org: organization,
			headers: { 'X-GitHub-Api-Version': '2022-11-28' },
		});

		const tmpDir = dirSync({ unsafeCleanup: true });
		try {
			const git = simpleGit();

			this.logger.log(`Found ${repositories.data.length} repositories. Cloning...`);

			for (const repository of repositories.data) {
				this.logger.log(`Cloning repository ${repository.name}...`);

				if (repository.clone_url) {
					await git.clone(repository.clone_url.replace('https://', `https://${password}@`), `${tmpDir.name}/${repository.name}`);
				}
			}

			this.logger.log('Creating archive...');

			const archive = archiver('zip', { zlib: { level: 9 } });

			const targetFile = `${directory}/${generateFileName('zip')}`;

			const output = client.createWriteStream(targetFile, { highWaterMark: 1024 * 1024 * 100 });

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

			archive.directory(tmpDir.name, false);
			archive.finalize();

			const throughputMeter = new ThroughputMeter({ reportInterval: 10000 });

			await pipeline(archive, throughputMeter, output);

			output.end();

			this.logger.log('Archive created successfully');

			return getFileSize(client, targetFile);
		} finally {
			tmpDir.removeCallback();
		}
	}
}
