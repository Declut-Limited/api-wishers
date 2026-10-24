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
import { BankAccountDto, ResolveBankAccountDto } from './dto/bank-account.dto';
import { BankDirectoryService } from './bank-directory.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditEntityType } from '../audit-log/schemas/audit-log.schema';
import { PaystackService } from '../paystack/paystack.service';
import { UsersService } from '../users/users.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class BankAccountsService {
  constructor(
    @InjectModel(BankAccount.name)
    private readonly bankAccountModel: Model<BankAccount>,
    private readonly bankDirectory: BankDirectoryService,
    private readonly auditLog: AuditLogService,
    private readonly paystack: PaystackService,
    private readonly usersService: UsersService,
    private readonly settings: SettingsService,
  ) {}

  listBanks() {
    return this.bankDirectory.listBanks();
  }

  // Lets the app show the account holder's name before the user saves.
  async resolve(dto: ResolveBankAccountDto) {
    const bank = await this.bankDirectory.findBank(dto.bankCode);
    const resolved = await this.paystack.resolveAccount(
      dto.accountNumber,
      bank.code,
    );
    return {
      bankCode: bank.code,
      bankName: bank.name,
      accountNumber: dto.accountNumber,
      accountName: resolved.account_name,
    };
  }

  async create(ownerId: string, dto: BankAccountDto) {
    // A removed (inactive) account is brought back, keeping its subaccount.
    const existing = await this.bankAccountModel
      .findOne({ owner: ownerId })
      .exec();
    if (existing?.active) {
      throw new ConflictException(
        'You already have a bank account — update it instead',
      );
    }
    const details = await this.lookUp(dto);
    const subaccountCode = await this.syncSubaccount(
      ownerId,
      details,
      existing?.subaccountCode,
    );

    let bankAccount: BankAccountDocument;
    if (existing) {
      Object.assign(existing, details, { subaccountCode, active: true });
      bankAccount = await existing.save();
    } else {
      bankAccount = await this.bankAccountModel.create({
        owner: ownerId,
        ...details,
        subaccountCode,
      });
    }
    await this.auditLog.record({
      entityType: AuditEntityType.BANK_ACCOUNT,
      entityId: bankAccount._id.toString(),
      event: 'bank_account.created',
      actor: ownerId,
      metadata: { bankName: details.bankName, subaccountCode },
    });
    return bankAccount;
  }

  async getMine(ownerId: string): Promise<BankAccountDocument | null> {
    return this.bankAccountModel
      .findOne({ owner: ownerId, active: true })
      .exec();
  }

  async update(ownerId: string, dto: BankAccountDto) {
    const existing = await this.findMine(ownerId);
    const details = await this.lookUp(dto);
    const subaccountCode = await this.syncSubaccount(
      ownerId,
      details,
      existing.subaccountCode,
    );
    Object.assign(existing, details, { subaccountCode });
    await existing.save();
    await this.auditLog.record({
      entityType: AuditEntityType.BANK_ACCOUNT,
      entityId: existing._id.toString(),
      event: 'bank_account.updated',
      actor: ownerId,
      metadata: { bankName: details.bankName, subaccountCode },
    });
    return existing;
  }

  // Paystack subaccounts can't be deleted, so the subaccount is deactivated and the record kept.
  async remove(ownerId: string): Promise<void> {
    const existing = await this.findMine(ownerId);
    if (existing.subaccountCode) {
      await this.paystack.updateSubaccount(existing.subaccountCode, {
        active: false,
      });
    }
    existing.active = false;
    await existing.save();
    await this.auditLog.record({
      entityType: AuditEntityType.BANK_ACCOUNT,
      entityId: existing._id.toString(),
      event: 'bank_account.deleted',
      actor: ownerId,
    });
  }

  private async findMine(ownerId: string): Promise<BankAccountDocument> {
    const bankAccount = await this.getMine(ownerId);
    if (!bankAccount) throw new NotFoundException('No bank account added yet');
    return bankAccount;
  }

  // Updates the user's existing subaccount, or creates their first one. Returns its code.
  private async syncSubaccount(
    ownerId: string,
    details: { bankCode: string; accountNumber: string },
    subaccountCode?: string,
  ): Promise<string> {
    const user = await this.usersService.findById(ownerId);
    if (!user) throw new NotFoundException('User not found');
    if (subaccountCode) {
      await this.paystack.updateSubaccount(subaccountCode, {
        businessName: user.name,
        bankCode: details.bankCode,
        accountNumber: details.accountNumber,
        active: true,
      });
      return subaccountCode;
    }
    const { wisherSharePercentage } = await this.settings.get();
    const created = await this.paystack.createSubaccount({
      businessName: user.name,
      bankCode: details.bankCode,
      accountNumber: details.accountNumber,
      percentageCharge: Math.max(0, 100 - wisherSharePercentage),
      email: user.email,
    });
    return created.subaccount_code;
  }

  // Bank name and logo come from the directory (unknown codes rejected); the account name from Paystack.
  private async lookUp(dto: BankAccountDto) {
    const bank = await this.bankDirectory.findBank(dto.bankCode);
    const resolved = await this.paystack.resolveAccount(
      dto.accountNumber,
      bank.code,
    );
    return {
      bankCode: bank.code,
      bankName: bank.name,
      logoUrl: bank.logoUrl,
      accountNumber: dto.accountNumber,
      accountName: resolved.account_name,
      maskedAccountNumber: `•••• ${dto.accountNumber.slice(-4)}`,
    };
  }
}
