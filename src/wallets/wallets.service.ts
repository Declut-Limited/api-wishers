import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { Wallet, WalletDocument } from './schemas/wallet.schema';

@Injectable()
export class WalletsService {
  constructor(
    @InjectModel(Wallet.name) private readonly walletModel: Model<Wallet>,
  ) {}

  // Idempotent: creates the empty wallet on first call, returns the existing one after.
  async ensureWallet(ownerId: string): Promise<WalletDocument> {
    return this.walletModel
      .findOneAndUpdate(
        { owner: ownerId },
        { $setOnInsert: { owner: ownerId } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  getMine(ownerId: string) {
    return this.ensureWallet(ownerId);
  }

  // A paid share: counts towards earnings and stays pending until Paystack settles it.
  async recordEarning(
    ownerId: string,
    amount: number,
    kind: 'contribution' | 'referral',
    session?: ClientSession,
  ): Promise<void> {
    await this.walletModel
      .updateOne(
        { owner: ownerId },
        {
          $inc: {
            allTimeBalance: amount,
            pendingBalance: amount,
            [kind === 'referral' ? 'referralEarnings' : 'contributedEarning']:
              amount,
          },
        },
        { upsert: true, session },
      )
      .exec();
  }

  async recordSettled(ownerId: string, amount: number): Promise<void> {
    await this.walletModel
      .updateOne(
        { owner: ownerId },
        { $inc: { pendingBalance: -amount, settledBalance: amount } },
      )
      .exec();
  }
}
