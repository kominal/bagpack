import { MailerService } from '@nestjs-modules/mailer';
import { ISendMailOptions } from '@nestjs-modules/mailer/dist/interfaces/send-mail-options.interface';
import { Injectable, Logger } from '@nestjs/common';
import mjml2html from 'mjml';
import { Health } from '../helpers/health';
import { bytesToSize, msToTime } from '../helpers/helpers';
import { Result } from '../helpers/result';

const LOGO =
	'data:image/png;base64,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';

const WARNING =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAB2AAAAdgB+lymcgAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAPaSURBVHic7ZlPaFxFHMc/v91tJBvSWAwWaUSxptWAYGyqRlBRkGg3mhy0jXioJ0UvWgRBEFyqtNpDqRe9iweNB02z3dLqyT8gdaVFhP4DIZLQSy9WaxuTfT8PG21M8nbnvZk3CTif0+68me98f7/9vfdmdiAQCAQCgUAgEPhfIqsxqSpChVGExwBFOM4ODougvr14T4CWyTHAp8DTSy59Ro0xKRP59JPzORkA23iV5cEDPLNwzSteK0CPcSNznAO6Yrr8ToGt8jgXfHnyWwFz7CM+eIBO5tjryw54rACt0k9EjdZJjxDukxI1H778VUDEIcP5cijvq/r5cbwkQCuMAQ8lGPIAFXZm5WcxmWdZx2mnyGngloRDp1nHHTLE5Sx8/UP2FdDB6yQPHqCHOV5zbWcpmVaAVukh4gzQkVLiCsKdUmLKpa/FZFsBEQdIHzxAOxH7XNlZicwqQCcZRPgubg7tHkI37WqYmPkEuXg8Vgp4WIb5JgufmSRAy+TYzvco21e83rGFaOALkPxCQ51cbQS5fD5GkJP8yEAW+4RsboEBno8LHoCuu68FD43PXf3xekI/29jt0OG/OE+ATtAJvNO8V96wbRHCfv2y6TI6Fe4roMCbwE3OdWEjs7zhWtRpArTKZpRXXGouYY8eYYtLQbcVEHEQuM6p5n9pQzngUtBZArTKo8BTrvSaMKIVhlyJOUmAjpNf2O354qDWWOdCyE0FFHkZuMuJlhl9XOBFF0LWCdAKG4C3HHhJhrBXJ+m2lbGvAOVt4AZrneRsQOwTb5UArdKH8EKKkYZtLXlJj9jdenYV0HjtJX8Y/XFmhbbTaRxYP3xTb4Z0klGEz1OP79lNtOk5AHIzHyPTH6WVAmFUSkykG5oCHaeNIj8DvWnGZ8Av5OiTHcwmHZjuFiiyh7UTPMBt1NMtwRNXgE6wkTxnaX7AsRqkOlVKXgEF9uMi+OLtRL1lot4yFDdbywGdzLfahi8nUQXoJPcg/IDt26Otm/q9R6GwvvF9/hL5E0/AXxetZIEIZVCe5ITpAONAVBHE+HSnudb1918LHqCwvtFmTw7hUJJTJfNgqjwLPJjG1TJmZ5a3XZ12Ig0MUmXMtLNRAnScNuDd1JaWIL+dRKY+BK2DziNTHyCXTrmSB3hvwXNrLyadbBc9seTbAYX6VefSwIgMc7hVp4KRlHCrrZsVqV/JRBYw9mz6DIj5w34No5w16WaWgA6OIfxkZcgvp/iTr0w6GiVAHmEeoQR8a2XLD1+jDMtO6iadky+Fj7KVOjcn9+UB4VcpcW61bQQCgUAgEAgEAoG1z9/1KeWl0De/zAAAAABJRU5ErkJggg==';

const ERROR =
	'data:image/png;base64,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';

const SUCCESS =
	'data:image/png;base64,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';

@Injectable()
export class MailService {
	private readonly logger = new Logger(MailService.name);

	public constructor(private mailerService: MailerService) {}

	public async sendResultMail(results: Result[], health: Health, duration: number): Promise<void> {
		this.logger.log('Running mail service...');

		const { MAIL_CONNECTION_STRING, MAIL_RECIPIENTS, MAIL_SENDER } = process.env;

		if (!MAIL_CONNECTION_STRING || !MAIL_RECIPIENTS || !MAIL_SENDER) {
			this.logger.warn('MAIL_CONNECTION_STRING, MAIL_RECIPIENTS or MAIL_SENDER is not set, skipping report...');
			return;
		}

		const rows: string[] = [];

		let hasError = false;
		let hasWarning = false;
		let hasSucess = false;

		for (const result of results) {
			let icon = 'error.png';

			if (result.success) {
				icon = 'success.png';

				if (result.previousSizes.length > 0) {
					const previousSize = result.previousSizes[result.previousSizes.length - 1];
					if (result.size > previousSize * 1.1) {
						icon = 'warning.png';
					}
				}
			}

			if (icon === 'error.png') {
				hasError = true;
			} else if (icon === 'warning.png') {
				hasWarning = true;
			} else {
				hasSucess = true;
			}

			rows.push(`
          <tr style="border-bottom:1px solid #e9e9e9;">
            <td style="padding: 0 15px 0 0;">${result.name}</td>
            <td style="padding: 0 15px 0 0;">${bytesToSize(result.size)}</td>
            <td style="padding: 0 15px 0 0;">${result.previousSizes.map(bytesToSize).join(', ')}</td>
            <td style="padding:20px 5px 20px 10px"><img width="24px" src="cid:${icon}"></img></td>
          </tr>
            `);
		}

		const template = `<mjml>
  <mj-body width="1000px">
    <mj-section>
      <mj-column>
        <mj-image width="100px" src="cid:logo.png"></mj-image>
        <mj-text style="font-weight: bold; text-align: center;">Bagpack Backup Report</mj-text>
        <mj-divider border-color="#051b56"></mj-divider>        
        <mj-table>
          <tr style="border-bottom: 1px solid #e9e9e9; font-weight: bold;">
            <td style="padding: 0 15px 0 0;">Process</td>
            <td style="padding: 0 15px 0 0;">Previous Sizes</td>
            <td style="padding: 0 15px 0 0;">Size</td>
            <td style="padding:20px 5px 20px 10px">Status</td>
          </tr>
          ${rows.join('\n')}
          <tr style="border-bottom:1px solid #e9e9e9;">
            <td style="padding: 0 15px 0 0;">Disk space</td>
            <td style="padding: 0 15px 0 0;">-</td>
            <td style="padding: 0 0 0 15px;">${health.diskUsage} %</td>
            <td style="padding: 0 15px;"><img width="24px" src="cid:success.png"></img></td>
          </tr>
          <tr style="border-bottom:1px solid #e9e9e9;">
            <td style="padding: 0 15px 0 0;">Runtime</td>
            <td style="padding: 0 15px 0 0;">-</td>
            <td style="padding: 0 0 0 15px;">${msToTime(duration)} %</td>
            <td style="padding: 0 15px;"><img width="24px" src="cid:success.png"></img></td>
          </tr>
        </mj-table>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

		const attachments: ISendMailOptions['attachments'] = [];

		if (hasSucess) {
			attachments.push({ filename: 'success.png', path: SUCCESS, cid: 'success.png', contentDisposition: 'inline' });
		}
		if (hasWarning) {
			attachments.push({ filename: 'warning.png', path: WARNING, cid: 'warning.png', contentDisposition: 'inline' });
		}
		if (hasError) {
			attachments.push({ filename: 'error.png', path: ERROR, cid: 'error.png', contentDisposition: 'inline' });
		}

		try {
			await this.mailerService.sendMail({
				to: MAIL_RECIPIENTS.split(',').map((email) => email.trim()),
				from: `"Bagpack" <${MAIL_SENDER}>`,
				subject: 'Bagpack Backup Report',
				html: mjml2html(template).html,
				attachments: [{ filename: 'logo.png', path: LOGO, cid: 'logo.png', contentDisposition: 'inline' }, ...attachments],
			});
		} catch (e) {
			this.logger.error(e);
		}
	}
}
