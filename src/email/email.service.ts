import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailtrapClient } from 'mailtrap';

// Lazy client: a missing MAILTRAP_API_KEY fails the send with a clear 500, not app boot.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private client: MailtrapClient | null = null;

  constructor(private readonly config: ConfigService) {}

  private getClient(): MailtrapClient {
    if (this.client) return this.client;

    const token = this.config.get<string>('MAILTRAP_API_KEY');
    if (!token) {
      throw new InternalServerErrorException(
        'Email delivery is not configured on this server yet',
      );
    }

    this.client = new MailtrapClient({ token });
    return this.client;
  }

  async sendEmail(params: {
    to: string;
    toName?: string;
    subject: string;
    html: string;
  }): Promise<void> {
    const fromEmail = this.config.get<string>('EMAIL_FROM');
    const fromName = this.config.get<string>('EMAIL_FROM_NAME', 'Wishers');

    if (!fromEmail) {
      throw new InternalServerErrorException(
        'Email delivery is not configured on this server yet',
      );
    }

    const client = this.getClient();

    try {
      await client.send({
        from: { email: fromEmail, name: fromName },
        to: [{ email: params.to, name: params.toName }],
        subject: params.subject,
        html: params.html,
      });
    } catch (err) {
      this.logger.error(`Mailtrap send failed: ${(err as Error).message}`);
      throw new InternalServerErrorException('Failed to send email');
    }
  }

  async sendOtpEmail(
    to: string,
    name: string,
    otp: string,
    expiryMinutes: number,
  ): Promise<void> {
    const { subject, html } = buildOtpEmailBody(name, otp, expiryMinutes);
    await this.sendEmail({ to, toName: name, subject, html });
  }
}

export function buildOtpEmailBody(
  name: string,
  otp: string,
  expiryMinutes: number,
): { subject: string; html: string } {
  return {
    subject: 'Your Wishers verification code',
    html: `<p>Hi ${escapeHtml(name)},</p><p>Your verification code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${otp}</p><p>This code expires in ${expiryMinutes} minutes. If you didn't request this, you can safely ignore this email.</p>`,
  };
}

// `name` is user-supplied and goes into an HTML body.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
