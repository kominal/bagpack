import { MailerModule } from '@nestjs-modules/mailer';
import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BackupScheduler } from './scheduler/backup.scheduler';
import { FileService } from './services/file.service';
import { GitHubService } from './services/github.service';
import { GitLabService } from './services/gitlab.service';
import { MongoDBService } from './services/mongodb.service';
import { RsyncService } from './services/rsync.service';

export const moduleDefinition = {
	imports: [
		ConfigModule.forRoot(),
		MailerModule.forRoot({
			transport: process.env.MAIL_CONNECTION_STRING || 'smtps://user@example.com:topsecret@smtp.example.com',
		}),
		ScheduleModule.forRoot(),
	],
	providers: [BackupScheduler, FileService, GitHubService, GitLabService, MongoDBService, RsyncService],
};

@Module(moduleDefinition)
export class AppModule implements OnApplicationBootstrap {
	public constructor(private readonly backupScheduler: BackupScheduler) {}

	async onApplicationBootstrap(): Promise<void> {
		await this.backupScheduler.run();
	}
}
