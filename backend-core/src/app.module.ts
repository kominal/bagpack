import { MailerModule } from '@nestjs-modules/mailer';
import { Module, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { FileScheduler } from './scheduler/file.scheduler';
import { GitHubScheduler } from './scheduler/github.scheduler';
import { GitLabScheduler } from './scheduler/gitlab.scheduler';
import { MongoDBScheduler } from './scheduler/mongodb.scheduler';

export const moduleDefinition = {
	imports: [
		ConfigModule.forRoot(),
		MailerModule.forRoot({
			transport: process.env.MAIL_CONNECTION_STRING || 'smtps://user@example.com:topsecret@smtp.example.com',
		}),
		ScheduleModule.forRoot(),
	],
	providers: [GitLabScheduler, MongoDBScheduler, GitHubScheduler, FileScheduler],
};

@Module(moduleDefinition)
export class AppModule implements OnApplicationBootstrap {
	public constructor(
		private readonly gitLabScheduler: GitLabScheduler,
		private readonly gitHubScheduler: GitHubScheduler,
		private readonly mongoDBScheduler: MongoDBScheduler,
		private readonly fileScheduler: FileScheduler
	) {}

	async onApplicationBootstrap(): Promise<void> {
		await this.gitLabScheduler.run();
		await this.gitHubScheduler.run();
		await this.mongoDBScheduler.run();
		await this.fileScheduler.run();
	}
}
