import { MailerModule } from '@nestjs-modules/mailer';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { GitHubScheduler } from './scheduler/github.scheduler';
import { MongoDBScheduler } from './scheduler/mongodb.scheduler';

export const moduleDefinition = {
	imports: [
		ConfigModule.forRoot(),
		MailerModule.forRoot({
			transport: process.env.MAIL_CONNECTION_STRING || 'smtps://user@example.com:topsecret@smtp.example.com',
		}),
		ScheduleModule.forRoot(),
	],
	providers: [MongoDBScheduler, GitHubScheduler],
};

@Module(moduleDefinition)
export class AppModule {}
