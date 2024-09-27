import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FileService } from '../services/file.service';
import { GitHubService } from '../services/github.service';
import { GitLabService } from '../services/gitlab.service';
import { MongoDBService } from '../services/mongodb.service';
import { RsyncService } from '../services/rsync.service';

@Injectable()
export class BackupScheduler {
	private readonly logger = new Logger(BackupScheduler.name);

	public constructor(
		private readonly fileService: FileService,
		private readonly gitHubService: GitHubService,
		private readonly gitLabService: GitLabService,
		private readonly mongoDBService: MongoDBService,
		private readonly rsyncService: RsyncService
	) {}

	@Cron(CronExpression.EVERY_DAY_AT_2AM)
	public async run(): Promise<void> {
		this.logger.log('Running backup process...');

		await this.fileService.run();
		await this.gitHubService.run();
		await this.gitLabService.run();
		await this.mongoDBService.run();
		await this.rsyncService.run();
	}
}
