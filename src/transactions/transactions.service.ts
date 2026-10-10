import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Transaction } from './schemas/transaction.schema';
import { ListTransactionsDto } from './dto/list-transactions.dto';
import { pageWindow } from '../common/utils/paginate.util';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
  ) {}

  async listMine(ownerId: string, dto: ListTransactionsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const filter = { owner: ownerId, ...(dto.type ? { type: dto.type } : {}) };
    const { skip } = pageWindow(page, limit);
    const [results, total] = await Promise.all([
      this.transactionModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.transactionModel.countDocuments(filter),
    ]);
    return { results, total, page, limit };
  }

  async getMine(ownerId: string, id: string) {
    const transaction = await this.transactionModel.findById(id).exec();
    if (!transaction) throw new NotFoundException('Transaction not found');
    if (transaction.owner.toString() !== ownerId) {
      throw new ForbiddenException('You do not own this transaction');
    }
    return transaction;
  }
}
