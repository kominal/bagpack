import { Injectable, Logger } from '@nestjs/common';
import archiver from 'archiver';
import { Octokit } from 'octokit';
import simpleGit from 'simple-git';
import Client from 'ssh2-sftp-client';
import { pipeline } from 'stream/promises';
import { dirSync } from 'tmp';
import { cleanupDirectory, connectToTarget, ensureDirectory, generateFileName } from '../helpers/helpers';

@Injectable()
export class GitHubService {
	private readonly logger = new Logger(GitHubService.name);

	public async run(): Promise<void> {
		this.logger.log('Running backup process GITHUB...');

		const { GITHUB_ORGANIZATION, GITHUB_PASSWORD } = process.env;

		if (!GITHUB_ORGANIZATION || !GITHUB_PASSWORD) {
			this.logger.warn('GITHUB_ORGANIZATION or GITHUB_PASSWORD is not set, skipping backup...');
			return;
		}

		const directory = `${process.env.TARGET_DIRECTORY}/github`;

		const client = new Client();

		try {
			this.logger.log('Connecting to target...');
			await connectToTarget(client);
			this.logger.log('Ensuring directory exists...');
			await ensureDirectory(client, directory);
			this.logger.log('Creating new backup...');
			await this.createBackup(client, directory, GITHUB_ORGANIZATION, GITHUB_PASSWORD);
			this.logger.log('Cleanup up previous backups...');
			await cleanupDirectory(client, directory);
			this.logger.log('Process completed successfully');
		} catch (error) {
			this.logger.error(error);
		} finally {
			await client.end();
		}
	}

	private async createBackup(client: Client, directory: string, organization: string, password: string): Promise<void> {
		const octokit = new Octokit({ auth: password });

		const repositories = await octokit.request('GET /orgs/{org}/repos', {
			org: organization,
			headers: {
				'X-GitHub-Api-Version': '2022-11-28',
			},
		});

		const tmpDir = dirSync({ unsafeCleanup: true });
		try {
			const git = simpleGit();

			for (const repository of repositories.data) {
				this.logger.log(`Cloning repository ${repository.name}...`);

				await git.clone(repository.clone_url.replace('https://', `https://${password}@`), `${tmpDir.name}/${repository.name}`);
			}

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

			archive.directory(tmpDir.name, false);
			archive.finalize();

			await pipeline(archive, output);

			output.end();

			this.logger.log('Archive created successfully');
		} finally {
			tmpDir.removeCallback();
		}
	}
}
