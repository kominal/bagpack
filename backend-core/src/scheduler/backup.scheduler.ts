import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Result } from '../helpers/result';
import { FileService } from '../services/file.service';
import { GitHubService } from '../services/github.service';
import { GitLabService } from '../services/gitlab.service';
import { MailService } from '../services/mail.service';
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
		private readonly rsyncService: RsyncService,
		private readonly mailService: MailService
	) {}

	@Cron(CronExpression.EVERY_DAY_AT_2AM)
	public async run(): Promise<void> {
		const time = new Date().getTime();
		this.logger.log('Running backup process...');

		const results: (Result | undefined)[] = [];

		results.push(await this.fileService.run());
		results.push(await this.gitHubService.run());
		results.push(await this.gitLabService.run());
		results.push(await this.mongoDBService.run());
		results.push(await this.rsyncService.run());

		this.logger.log(`Process completed in ${new Date().getTime() - time}ms`);

		await this.mailService.sendResultMail(results.filter(Boolean));
	}
}
