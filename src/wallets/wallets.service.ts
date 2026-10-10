import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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
}
