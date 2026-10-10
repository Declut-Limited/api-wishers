import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditEntityType, AuditLog } from './schemas/audit-log.schema';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectModel(AuditLog.name) private readonly auditLogModel: Model<AuditLog>,
  ) {}

  // Never throws — a logging hiccup must not fail the action being logged.
  async record(params: {
    entityType: AuditEntityType;
    entityId: string;
    event: string;
    actor: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.auditLogModel.create(params);
    } catch (err) {
      this.logger.error(
        `Failed to record audit event "${params.event}"`,
        err as Error,
      );
    }
  }
}
