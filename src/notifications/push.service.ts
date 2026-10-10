import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[.+\]$/;

interface ExpoTicket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

export type PushResult = 'sent' | 'invalid_token' | 'failed';

// Sends through Expo's push service (it relays to FCM/APNs) — no Firebase needed. Never throws.
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(private readonly config: ConfigService) {}

  async send(
    token: string,
    payload: { title: string; body: string; data?: Record<string, string> },
  ): Promise<PushResult> {
    if (!EXPO_TOKEN_RE.test(token)) return 'invalid_token';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const accessToken = this.config.get<string>('EXPO_ACCESS_TOKEN');
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({ to: token, sound: 'default', ...payload }),
      });
      if (!response.ok) {
        this.logger.error(`Expo push failed — HTTP ${response.status}`);
        return 'failed';
      }
      const { data } = (await response.json()) as { data?: ExpoTicket };
      if (data?.status === 'ok') return 'sent';
      if (data?.details?.error === 'DeviceNotRegistered')
        return 'invalid_token';
      this.logger.error(`Expo push rejected: ${data?.message ?? 'unknown'}`);
      return 'failed';
    } catch (err) {
      this.logger.error('Expo push failed', err as Error);
      return 'failed';
    }
  }
}
