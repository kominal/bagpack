import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import archiver from 'archiver';
import { Octokit } from 'octokit';
import simpleGit from 'simple-git';
import Client from 'ssh2-sftp-client';
import { dirSync } from 'tmp';
import { cleanupDirectory, connectToTarget, ensureDirectory, generateFileName } from '../helpers/helpers';

@Injectable()
export class GitHubScheduler implements OnApplicationBootstrap {
	private readonly logger = new Logger(GitHubScheduler.name);

	async onApplicationBootstrap(): Promise<void> {
		await this.run();
	}

	@Cron(CronExpression.EVERY_DAY_AT_3AM)
	public async run(): Promise<void> {
		this.logger.log('Running backup process GITHUB...');

		const { GITHUB_ORGANIZATION, GITHUB_USERNAME, GITHUB_PASSWORD } = process.env;

		if (!GITHUB_ORGANIZATION || !GITHUB_USERNAME || !GITHUB_PASSWORD) {
			this.logger.warn('GITHUB_ORGANIZATION, GITHUB_USERNAME or GITHUB_PASSWORD is not set, skipping backup...');
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
			await this.createBackup(client, directory, GITHUB_ORGANIZATION, GITHUB_USERNAME, GITHUB_PASSWORD);
			this.logger.log('Cleanup up previous backups...');
			await cleanupDirectory(client, directory);
			this.logger.log('Process completed successfully');
		} catch (error) {
			this.logger.error(error);
		} finally {
			await client.end();
		}
	}

	private async createBackup(client: Client, directory: string, organization: string, username: string, password: string): Promise<string> {
		const octokit = new Octokit({ auth: password });

		const repositories = await octokit.request('GET /orgs/{org}/repos', {
			org: organization,
			headers: {
				'X-GitHub-Api-Version': '2022-11-28',
			},
		});

		const tmpDir = dirSync();
		try {
			const git = simpleGit();

			for (const repository of repositories.data) {
				this.logger.log(`Cloning repository ${repository.name}...`);

				await git.clone(repository.git_url.replace('https://', `https://${username}:${password}@`), `${tmpDir.name}/${repository.name}`);
			}

			const archive = archiver('zip', {
				zlib: { level: 9 },
			});

			const result = client.put(archive, `${directory}/${generateFileName('zip')}`);

			archive.directory(tmpDir.name, false);
			await archive.finalize();

			return result;
		} finally {
			tmpDir.removeCallback();
		}
	}
}
