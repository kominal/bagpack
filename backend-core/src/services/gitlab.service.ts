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
			let currentProgress = 0;
			archive.on('progress', (progress) => {
				const percent = Math.round((progress.fs.processedBytes / progress.fs.totalBytes) * 100);
				if (percent % 10 === 0 && percent !== currentProgress) {
					this.logger.log(`Archive progress: ${percent}%`);
					currentProgress = percent;
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
