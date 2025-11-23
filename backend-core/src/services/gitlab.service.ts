/* eslint-disable no-console */
import archiver from 'archiver';
import { existsSync, mkdirSync, PathLike } from 'fs';
import simpleGit from 'simple-git';
import Client from 'ssh2-sftp-client';
import { dirSync } from 'tmp';

import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { pipeline } from 'stream/promises';
import { cleanupDirectory, ensureDirectory, generateFileName, getFileSize } from '../helpers/helpers';
import { Result } from '../helpers/result';
import { ThroughputMeter } from '../helpers/throughput-meter';

@Injectable()
export class GitLabService {
	private readonly logger = new Logger(GitLabService.name);

	public async run(client: Client): Promise<Result | undefined> {
		this.logger.log('Running backup process GITLAB...');

		const { GITLAB_URL, GITLAB_GROUP_ID, GITLAB_ACCESS_TOKEN } = process.env;

		if (!GITLAB_URL || !GITLAB_GROUP_ID || !GITLAB_ACCESS_TOKEN) {
			this.logger.warn('GITLAB_URL, GITLAB_GROUP_ID or GITLAB_ACCESS_TOKEN is not set, skipping backup...');
			return undefined;
		}

		const directory = `${process.env.TARGET_DIRECTORY}/gitlab`;

		try {
			this.logger.log('Ensuring directory exists...');
			await ensureDirectory(client, directory);
			this.logger.log('Creating new backup...');
			const size = await this.createBackup(client, directory, GITLAB_URL, GITLAB_GROUP_ID, GITLAB_ACCESS_TOKEN);
			this.logger.log('Cleanup up previous backups...');
			const previousSizes = await cleanupDirectory(client, directory);
			this.logger.log('Process completed successfully');

			return { name: 'GitLab', success: true, size, previousSizes };
		} catch (error) {
			this.logger.error(error);
		}

		return { name: 'GitLab', success: false, size: -1, previousSizes: [] };
	}

	private async createBackup(client: Client, directory: string, url: string, groupId: string, accessToken: string): Promise<number> {
		const groups = await this.getGroups(url, groupId, accessToken);
		const rootRepositories = await this.getRepositories(url, groupId, accessToken);

		const tmpDir = dirSync({ unsafeCleanup: true });

		try {
			const git = simpleGit();

			this.logger.log(`Found ${rootRepositories.length} repositories. Cloning...`);

			for (const repository of rootRepositories) {
				try {
					console.log(`Cloning to ${tmpDir.name}/${repository.path}`);
					await git.clone(
						repository.http_url_to_repo.replace('https://', `https://oauth2:${accessToken}@`),
						`${tmpDir.name}/${repository.path}`
					);
				} catch (error) {
					console.log(`Failed to clone ${tmpDir.name}/${repository.path}`);
				}
			}

			this.logger.log(`Found ${groups.length} groups. Processing...`);

			for (const group of groups) {
				const path = `${tmpDir.name}/${group.full_path}`;

				this.createDirectory(path);

				const repositories = await this.getRepositories(url, group.id, accessToken);

				this.logger.log(`Found ${repositories.length} repositories. Cloning...`);

				for (const repository of repositories) {
					try {
						console.log(`Cloning ${path}/${repository.path}`);
						await git.clone(
							repository.http_url_to_repo.replace('https://', `https://oauth2:${accessToken}@`),
							`${path}/${repository.path}`
						);
					} catch (e) {
						console.log(e);
					}
				}
			}

			this.logger.log('Creating archive...');

			const archive = archiver('zip', { zlib: { level: 1 } });

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

			const startTime = Date.now();
			let lastBytesProcessed = 0;
			let lastReportDuration: number | null = null;
			archive.on('progress', (data) => {
				// The 'data' object provides useful metrics

				// 1. Progress (Files)
				const filesProcessed = data.entries.processed;
				const totalFiles = data.entries.total;

				// 2. Throughput (Bytes)
				const currentBytes = data.fs.processedBytes;
				const totalBytes = data.fs.totalBytes; // Total uncompressed source size
				const currentDuration = (Date.now() - startTime) / 1000;

				// Calculate instantaneous rate since the last event
				const bytesSinceLastEvent = currentBytes - lastBytesProcessed;
				const rateMBps = bytesSinceLastEvent / (1024 * 1024) / (currentDuration - (lastReportDuration || 0));

				// Display results
				const percentage = (currentBytes / totalBytes) * 100;

				// Use process.stdout.write for a single-line progress update (optional)
				this.logger.log(
					`\rProgress: ${percentage.toFixed(2)}% | ` + `Files: ${filesProcessed}/${totalFiles} | ` + `Rate: ${rateMBps.toFixed(2)} MB/s`
				);

				// Update state
				lastBytesProcessed = currentBytes;
				lastReportDuration = currentDuration;
			});

			archive.directory(tmpDir.name, false);
			archive.finalize();

			const throughputMeter = new ThroughputMeter({ reportInterval: 1000 });

			await pipeline(archive, throughputMeter, output);

			output.end();

			this.logger.log('Archive created successfully');

			return getFileSize(client, targetFile);
		} finally {
			tmpDir.removeCallback();
		}
	}

	private async getGroups(url: string, groupId: string, accessToken: string): Promise<any[]> {
		const groups: any[] = [];

		let total: number | undefined;
		for (let i = 1; total === undefined || groups.length < total; i += 1) {
			const groupRequest = await axios.get<any[]>(`https://${url}/api/v4/groups/${groupId}/subgroups?per_page=100&page=${i}`, {
				headers: { 'PRIVATE-TOKEN': accessToken },
			});
			groups.push(...groupRequest.data);

			total = groupRequest.headers['x-total'];
		}

		const temp = [];
		for (const group of groups) {
			const subGroups = await this.getGroups(url, group.id, accessToken);
			temp.push(...subGroups);
		}
		groups.push(...temp);

		return groups;
	}

	private async getRepositories(url: string, groupId: string, accessToken: string): Promise<any[]> {
		const repositories: any[] = [];

		let total: number | undefined;
		for (let i = 1; total === undefined || repositories.length < total; i += 1) {
			const repositoryRequest = await axios.get<any[]>(`https://${url}/api/v4/groups/${groupId}/projects?per_page=100&page=${i}`, {
				headers: { 'PRIVATE-TOKEN': accessToken },
			});
			repositories.push(...repositoryRequest.data);

			total = repositoryRequest.headers['x-total'];
		}

		return repositories;
	}

	private createDirectory(path: PathLike): void {
		if (!existsSync(path)) {
			mkdirSync(path, { recursive: true });
		}
	}
}
