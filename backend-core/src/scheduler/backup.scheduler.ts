import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import Client from 'ssh2-sftp-client';
import { connectToTarget, msToTime } from '../helpers/helpers';
import { Result } from '../helpers/result';
import { FileService } from '../services/file.service';
import { GitHubService } from '../services/github.service';
import { GitLabService } from '../services/gitlab.service';
import { HealthService } from '../services/health.service';
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
		private readonly mailService: MailService,
		private readonly healthService: HealthService
	) {}

	@Cron(CronExpression.EVERY_DAY_AT_2AM)
	public async run(): Promise<void> {
		const client = new Client();

		try {
			const time = new Date().getTime();
			this.logger.log('Running backup process...');

			this.logger.log('Connecting to target...');
			await connectToTarget(client);

			const results: (Result | undefined)[] = [];

			results.push(await this.fileService.run(client));
			results.push(await this.gitHubService.run(client));
			results.push(await this.gitLabService.run(client));
			results.push(await this.mongoDBService.run(client));
			results.push(...(await this.rsyncService.run(client)));

			const health = await this.healthService.run();

			const duration = new Date().getTime() - time;

			this.logger.log(`Process completed in ${msToTime(duration)}`);

			await this.mailService.sendResultMail(
				results.filter((r): r is Result => !!r),
				health,
				duration
			);
		} catch (e) {
			console.log(e);
			this.logger.error('Error during backup process', e);
			try {
				await client.end();
			} catch (e) {
				this.logger.error('Error closing SFTP client', e);
			}
		}
	}
}
