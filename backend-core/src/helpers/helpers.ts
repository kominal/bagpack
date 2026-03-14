import dayjs, { extend } from 'dayjs';
import Client from 'ssh2-sftp-client';

const customParseFormat = require('dayjs/plugin/customParseFormat');

extend(customParseFormat);

const DATE_FORMAT = 'YYYY-MM-DD_HH-mm-ss';

export function getTargetCredentials() {
	const { TARGET_CONNECTION_STRING } = process.env;

	const [TARGET_USERNAME, TARGET_URI] = (TARGET_CONNECTION_STRING || '').split('@');
	const [TARGET_HOST, TARGET_PORT] = (TARGET_URI || '').split(':');

	return {
		TARGET_USERNAME,
		TARGET_HOST,
		TARGET_PORT,
	};
}

export function getTargetPort(): number {
	const { TARGET_PORT } = getTargetCredentials();
	return TARGET_PORT ? parseInt(TARGET_PORT, 10) : 22;
}

export async function connectToTarget(client: Client): Promise<void> {
	const { TARGET_HOST, TARGET_USERNAME } = getTargetCredentials();

	await client.connect({
		host: TARGET_HOST,
		port: getTargetPort(),
		username: TARGET_USERNAME,
		privateKey: process.env.TARGET_SSH_PRIVATE_KEY,
		keepaliveInterval: 10000,
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

export function bytesToSize(bytes: number): string {
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	if (bytes === 0) return '0 Byte';
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

export function msToTime(duration: number): string {
	const seconds = Math.floor((duration / 1000) % 60);
	const minutes = Math.floor((duration / (1000 * 60)) % 60);
	const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

	const hoursStr = hours < 10 ? '0' + hours : hours;
	const minutesStr = minutes < 10 ? '0' + minutes : minutes;
	const secondsStr = seconds < 10 ? '0' + seconds : seconds;
	return hoursStr + ':' + minutesStr + ':' + secondsStr;
}

export async function getFileSize(client: Client, path: string): Promise<number> {
	return client.stat(path).then((stat) => stat.size);
}

export async function cleanupDirectory(client: Client, directory: string): Promise<number[]> {
	await connectToTarget(client);

	const files = (await client.list(directory))
		.filter((f) => f.type === '-')
		.sort((a, b) => parseDate(b.name).getTime() - parseDate(a.name).getTime());
	const now = Date.now();

	const week = 1000 * 60 * 60 * 24 * 7;
	const exceptions = [
		...files.filter((f) => now - parseDate(f.name).getTime() < week),
		...files.filter((f, index) => parseDate(f.name).getUTCDay() === 0 && index < 5),
		...files.filter((f, index) => parseDate(f.name).getUTCDate() === 1 && index < 12),
	];

	const previousSizes = await Promise.all(files.slice(1, 4).map((file) => getFileSize(client, `${directory}/${file.name}`)));

	for (const file of files.filter((b) => !exceptions.includes(b))) {
		await client.delete(`${directory}/${file.name}`);
	}

	return previousSizes;
}
