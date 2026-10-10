import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  BankAccount,
  BankAccountDocument,
} from './schemas/bank-account.schema';
import { BankAccountDto } from './dto/bank-account.dto';
import { BankDirectoryService } from './bank-directory.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditEntityType } from '../audit-log/schemas/audit-log.schema';

@Injectable()
export class BankAccountsService {
  constructor(
    @InjectModel(BankAccount.name)
    private readonly bankAccountModel: Model<BankAccount>,
    private readonly bankDirectory: BankDirectoryService,
    private readonly auditLog: AuditLogService,
  ) {}

  listBanks() {
    return this.bankDirectory.listBanks();
  }

  async create(ownerId: string, dto: BankAccountDto) {
    if (await this.bankAccountModel.exists({ owner: ownerId })) {
      throw new ConflictException(
        'You already have a bank account — update it instead',
      );
    }
    const details = await this.lookUp(dto);
    const bankAccount = await this.bankAccountModel.create({
      owner: ownerId,
      ...details,
    });
    await this.auditLog.record({
      entityType: AuditEntityType.BANK_ACCOUNT,
      entityId: bankAccount._id.toString(),
      event: 'bank_account.created',
      actor: ownerId,
      metadata: { bankName: details.bankName },
    });
    return bankAccount;
  }

  async getMine(ownerId: string): Promise<BankAccountDocument | null> {
    return this.bankAccountModel.findOne({ owner: ownerId }).exec();
  }

  async update(ownerId: string, dto: BankAccountDto) {
    const existing = await this.findMine(ownerId);
    const details = await this.lookUp(dto);
    Object.assign(existing, details);
    await existing.save();
    await this.auditLog.record({
      entityType: AuditEntityType.BANK_ACCOUNT,
      entityId: existing._id.toString(),
      event: 'bank_account.updated',
      actor: ownerId,
      metadata: { bankName: details.bankName },
    });
    return existing;
  }

  async remove(ownerId: string): Promise<void> {
    const existing = await this.findMine(ownerId);
    await existing.deleteOne();
    await this.auditLog.record({
      entityType: AuditEntityType.BANK_ACCOUNT,
      entityId: existing._id.toString(),
      event: 'bank_account.deleted',
      actor: ownerId,
    });
  }

  private async findMine(ownerId: string): Promise<BankAccountDocument> {
    const bankAccount = await this.bankAccountModel
      .findOne({ owner: ownerId })
      .exec();
    if (!bankAccount) throw new NotFoundException('No bank account added yet');
    return bankAccount;
  }

  // Bank name and logo come from the directory, so an unknown bank code is rejected.
  private async lookUp(dto: BankAccountDto) {
    const bank = await this.bankDirectory.findBank(dto.bankCode);
    return {
      bankCode: bank.code,
      bankName: bank.name,
      logoUrl: bank.logoUrl,
      accountNumber: dto.accountNumber,
      accountName: dto.accountName.trim(),
      maskedAccountNumber: `•••• ${dto.accountNumber.slice(-4)}`,
    };
  }
}
