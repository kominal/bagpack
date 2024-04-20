import { Injectable, LoggerService } from '@nestjs/common';

@Injectable()
export class CustomerLogger implements LoggerService {
	private formatString(message: string, ...optionalParams: any[]): string {
		return message.replace(/{([0-9]+)}/g, (match, index) => (typeof optionalParams[index] === 'undefined' ? match : optionalParams[index]));
	}

	private logToConsole(level: string, message: any, ...optionalParams: any): void {
		const parameter = optionalParams[0] || [];
		// eslint-disable-next-line no-console
		if (typeof message === 'string') {
			console.log(`${new Date().toISOString()} [${level}] [${parameter[parameter.length - 1]}] ${this.formatString(message, parameter)}`);
		} else {
			console.log(`${new Date().toISOString()} [${level}] [${parameter[parameter.length - 1]}] ${message}`);
		}
	}

	public log(message: any, ...optionalParams: any): void {
		this.logToConsole('LOG    ', message, optionalParams);
	}

	public error(message: any, ...optionalParams: any): void {
		this.logToConsole('ERROR  ', message, optionalParams);
	}

	public warn(message: any, ...optionalParams: any): void {
		this.logToConsole('WARN   ', message, optionalParams);
	}

	public debug?(message: any, ...optionalParams: any): void {
		this.logToConsole('DEBUG  ', message, optionalParams);
	}

	public verbose?(message: any, ...optionalParams: any): void {
		this.logToConsole('VERBOSE', message, optionalParams);
	}
}
