import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

const BASE_URL = 'https://api.paystack.co';

interface PaystackEnvelope<T> {
  status: boolean;
  message: string;
  data: T;
}

export interface PaystackSubaccount {
  subaccount_code: string;
  account_number: string;
  settlement_bank: string;
  active?: boolean;
}

export interface PaystackSplitShare {
  subaccount: string;
  // Kobo.
  share: number;
}

export interface PaystackInitialized {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface PaystackVerifiedTransaction {
  reference: string;
  status: string;
  // Kobo.
  amount: number;
  currency: string;
  paid_at?: string;
}

export interface PaystackSettlement {
  id: number;
  status: string;
  settlement_date?: string;
}

// Plain fetch to Paystack's REST API (no SDK). Amounts are in kobo, as Paystack expects.
@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);

  constructor(private readonly config: ConfigService) {}

  resolveAccount(accountNumber: string, bankCode: string) {
    const query = new URLSearchParams({
      account_number: accountNumber,
      bank_code: bankCode,
    });
    return this.request<{ account_name: string; account_number: string }>(
      'GET',
      `/bank/resolve?${query.toString()}`,
      undefined,
      "We couldn't verify that account number with the bank",
    );
  }

  createSubaccount(params: {
    businessName: string;
    bankCode: string;
    accountNumber: string;
    percentageCharge: number;
    email?: string;
  }) {
    return this.request<PaystackSubaccount>('POST', '/subaccount', {
      business_name: params.businessName,
      settlement_bank: params.bankCode,
      account_number: params.accountNumber,
      percentage_charge: params.percentageCharge,
      ...(params.email && { primary_contact_email: params.email }),
    });
  }

  updateSubaccount(
    code: string,
    params: {
      businessName?: string;
      bankCode?: string;
      accountNumber?: string;
      active?: boolean;
    },
  ) {
    return this.request<PaystackSubaccount>(
      'PUT',
      `/subaccount/${encodeURIComponent(code)}`,
      {
        ...(params.businessName && { business_name: params.businessName }),
        ...(params.bankCode && { settlement_bank: params.bankCode }),
        ...(params.accountNumber && { account_number: params.accountNumber }),
        ...(params.active !== undefined && { active: params.active }),
      },
    );
  }

  // A dynamic flat split: each subaccount gets its exact share, the main account keeps the rest
  // and bears Paystack's fee (the giver already paid it on top).
  initializeTransaction(params: {
    email: string;
    amountKobo: number;
    reference: string;
    shares: PaystackSplitShare[];
    callbackUrl?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.request<PaystackInitialized>(
      'POST',
      '/transaction/initialize',
      {
        email: params.email,
        amount: params.amountKobo,
        currency: 'NGN',
        reference: params.reference,
        ...(params.callbackUrl && { callback_url: params.callbackUrl }),
        ...(params.metadata && { metadata: params.metadata }),
        split: {
          type: 'flat',
          bearer_type: 'account',
          subaccounts: params.shares,
        },
      },
    );
  }

  verifyTransaction(reference: string) {
    return this.request<PaystackVerifiedTransaction>(
      'GET',
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );
  }

  listSettlements(subaccountCode: string, from: Date) {
    const query = new URLSearchParams({
      subaccount: subaccountCode,
      from: from.toISOString(),
      perPage: '100',
    });
    return this.request<PaystackSettlement[]>(
      'GET',
      `/settlement?${query.toString()}`,
    );
  }

  listSettlementTransactions(settlementId: number) {
    return this.request<{ reference: string }[]>(
      'GET',
      `/settlement/${settlementId}/transactions?perPage=500`,
    );
  }

  // Paystack signs the raw webhook body with HMAC-SHA512 of our secret key.
  isValidWebhookSignature(rawBody: Buffer | undefined, signature?: string) {
    const secret = this.config.get<string>('PAYSTACK_SECRET_KEY');
    if (!secret || !rawBody || !signature) return false;
    const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT',
    path: string,
    body?: Record<string, unknown>,
    badRequestMessage?: string,
  ): Promise<T> {
    const secret = this.config.get<string>('PAYSTACK_SECRET_KEY');
    if (!secret) {
      throw new ServiceUnavailableException('Payments are not set up yet');
    }
    let response: Response;
    try {
      response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
        },
        ...(body && { body: JSON.stringify(body) }),
      });
    } catch (err) {
      this.logger.error(
        `Paystack ${method} ${path} — ${(err as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'Payments are unavailable right now — try again shortly',
      );
    }
    const json = (await response
      .json()
      .catch(() => null)) as PaystackEnvelope<T> | null;
    if (!response.ok || !json?.status) {
      const message = json?.message ?? `status ${response.status}`;
      this.logger.warn(`Paystack ${method} ${path} — ${message}`);
      if (response.status >= 400 && response.status < 500) {
        throw new BadRequestException(badRequestMessage ?? message);
      }
      throw new BadGatewayException('Payment provider error — try again');
    }
    return json.data;
  }
}
