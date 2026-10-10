import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

export interface Bank {
  code: string;
  name: string;
  slug: string;
  logoUrl?: string;
}

interface DirectoryEntry {
  name: string;
  slug: string;
  code: string;
  logo?: string;
}

const BANKS_URL = 'https://nigerianbanks.xyz/';

// Nigerian bank list (names, codes, logos) from a free public directory — no API keys. Cached for a day; a stale cache beats failing.
@Injectable()
export class BankDirectoryService {
  private readonly logger = new Logger(BankDirectoryService.name);
  private cache: Bank[] | null = null;
  private cachedAt = 0;
  private readonly ttlMs = 24 * 60 * 60 * 1000;

  async listBanks(): Promise<Bank[]> {
    if (this.cache && Date.now() - this.cachedAt < this.ttlMs) {
      return this.cache;
    }
    try {
      const response = await fetch(BANKS_URL);
      if (!response.ok) throw new Error(`status ${response.status}`);
      const entries = (await response.json()) as DirectoryEntry[];
      this.cache = entries
        .map((b) => ({
          code: b.code,
          name: b.name,
          slug: b.slug,
          logoUrl: b.logo,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      this.cachedAt = Date.now();
    } catch (err) {
      this.logger.error(`Bank list fetch failed — ${(err as Error).message}`);
      if (!this.cache) {
        throw new ServiceUnavailableException(
          'Could not load banks right now — try again shortly',
        );
      }
    }
    return this.cache;
  }

  async findBank(code: string): Promise<Bank> {
    const bank = (await this.listBanks()).find((b) => b.code === code);
    if (!bank) throw new BadRequestException('Unknown bank');
    return bank;
  }
}
