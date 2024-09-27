import dayjs, { extend } from 'dayjs';
import Client from 'ssh2-sftp-client';

const customParseFormat = require('dayjs/plugin/customParseFormat');

extend(customParseFormat);

const DATE_FORMAT = 'YYYY-MM-DD_HH-mm-ss';

export function getTargetCredentials() {
	const { TARGET_CONNECTION_STRING } = process.env;

	const [TARGET_ACCESS_CONTROL, TARGET_URI] = TARGET_CONNECTION_STRING.split('@');
	const [TARGET_USERNAME, TARGET_PASSWORD] = TARGET_ACCESS_CONTROL.split(':');
	const [TARGET_HOST, TARGET_PORT] = TARGET_URI.split(':');

	return {
		TARGET_USERNAME,
		TARGET_PASSWORD,
		TARGET_HOST,
		TARGET_PORT,
	};
}

export async function connectToTarget(client: Client): Promise<void> {
	const { TARGET_HOST, TARGET_PORT, TARGET_USERNAME, TARGET_PASSWORD } = getTargetCredentials();

	await client.connect({
		host: TARGET_HOST,
		port: parseInt(TARGET_PORT || '22', 10),
		username: TARGET_USERNAME,
		password: TARGET_PASSWORD,
	});
}

export async function ensureDirectory(client: Client, directory: string): Promise<void> {
	if (await client.exists(directory)) {
		return;
	}
	await client.mkdir(directory, true);
}

export function generateFileName(fileExtension: string): string {
	return `${dayjs().format(DATE_FORMAT)}.${fileExtension}`;
}

function parseDate(fileName: string): Date {
	return dayjs(fileName.split('.')[0], DATE_FORMAT).toDate();
}

export async function cleanupDirectory(client: Client, directory: string): Promise<void> {
	const files = await client.list(directory);
	const now = Date.now();

	const week = 1000 * 60 * 60 * 24 * 7;
	const exceptions = [
		...files.filter((f) => now - parseDate(f.name).getTime() < week),
		...files.filter((f, index) => parseDate(f.name).getUTCDay() === 0 && index < 5),
		...files.filter((f, index) => parseDate(f.name).getUTCDate() === 1 && index < 12),
	];

	for (const file of files.filter((b) => !exceptions.includes(b))) {
		await client.delete(`${directory}/${file.name}`);
	}
}
