import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CustomerLogger } from './helpers/logger';

process.on('uncaughtException', (exception) => {
	console.log(exception);
});

export async function bootstrap(): Promise<void> {
	const app = await NestFactory.create(AppModule, {
		logger: new CustomerLogger(),
	});

	await app.init();
}
bootstrap();
